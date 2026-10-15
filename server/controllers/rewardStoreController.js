const { query: pgQuery } = require('../config/postgres');
const coinLedgerService = require('../services/coinLedgerService');
const emailService = require('../services/emailService');
const { getIO } = require('../sockets');

/**
 * LOOOP Rewards Store Controller
 * PostgreSQL backed circular economy prizes and coin redemption system.
 */

// Helper to retrieve the current Rewards Store master setting
const getStoreSettingsHelper = async () => {
  try {
    const res = await pgQuery(
      "SELECT value FROM admin_settings WHERE key = 'rewards_store_settings' LIMIT 1;"
    );
    if (res?.rows?.[0]?.value) {
      const val = typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
      return {
        enabled: val.enabled !== undefined ? Boolean(val.enabled) : true,
        maintenanceMessage: val.maintenanceMessage || 'The Rewards Store is temporarily offline for catalog updates. Please check back shortly!',
        updatedAt: val.updatedAt || null,
        updatedBy: val.updatedBy || 'Platform Admin'
      };
    }
  } catch (err) {
    console.warn('[rewardStoreController] Store setting check notice:', err.message);
  }
  return {
    enabled: true,
    maintenanceMessage: 'The Rewards Store is temporarily offline. Please check back shortly!'
  };
};

// -------------------------------------------------------------
// 1. STORE MASTER SWITCH
// -------------------------------------------------------------
exports.getStoreSettings = async (req, res) => {
  try {
    const settings = await getStoreSettingsHelper();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to read store settings.' });
  }
};

exports.updateStoreSettings = async (req, res) => {
  try {
    const { enabled, maintenanceMessage } = req.body;
    const adminId = req.user?.id || req.user?._id || 'admin';
    const adminEmail = req.user?.email || 'admin@looop.community';

    const newValue = {
      enabled: Boolean(enabled),
      maintenanceMessage: (maintenanceMessage || '').trim() || 'The Rewards Store is temporarily offline. Please check back shortly!',
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail
    };

    await pgQuery(
      `INSERT INTO admin_settings (id, key, value, label, description, category, updated_by_id, updated_at)
       VALUES ('set-rewards-store', 'rewards_store_settings', $1::jsonb, 'Rewards Store Master Switch', 'Master switch for customer prize redemption store', 'REWARDS', $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by_id = EXCLUDED.updated_by_id, updated_at = NOW();`,
      [JSON.stringify(newValue), String(adminId)]
    );

    // Audit log
    try {
      await pgQuery(
        `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, target_title, metadata, created_at, updated_at)
         VALUES ($1, $2, 'REWARDS_STORE_SWITCH_TOGGLED', 'SETTINGS', 'rewards_store_settings', $3, $4::jsonb, NOW(), NOW());`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          String(adminId),
          enabled ? 'Store Set LIVE' : 'Store Set OFFLINE',
          JSON.stringify(newValue)
        ]
      );
    } catch {}

    // Emit live socket event if available
    try {
      const io = getIO();
      if (io) {
        io.emit('rewards_store_status_changed', { enabled: Boolean(enabled) });
      }
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Rewards Store is now ${enabled ? 'LIVE' : 'OFFLINE'}.`,
      settings: newValue
    });
  } catch (error) {
    console.error('[rewardStoreController.updateStoreSettings] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update store settings.' });
  }
};

// -------------------------------------------------------------
// 2. CUSTOMER REWARDS STORE CATALOG
// -------------------------------------------------------------
exports.getRewardProducts = async (req, res) => {
  try {
    const storeStatus = await getStoreSettingsHelper();
    if (!storeStatus.enabled) {
      return res.status(200).json({
        success: true,
        storeEnabled: false,
        maintenanceMessage: storeStatus.maintenanceMessage,
        rewards: [],
        total: 0
      });
    }

    const { category, search, sort = 'popular', page = 1, limit = 24 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const offset = (pageNum - 1) * limitNum;

    let whereSql = "WHERE is_published = true AND is_active = true";
    const params = [];
    let paramIdx = 1;

    if (category && category.toLowerCase() !== 'all') {
      whereSql += ` AND LOWER(category) = LOWER($${paramIdx++})`;
      params.push(category.trim());
    }

    if (search && search.trim()) {
      whereSql += ` AND (title ILIKE $${paramIdx} OR brand ILIKE $${paramIdx} OR short_description ILIKE $${paramIdx})`;
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    let orderSql = 'ORDER BY featured DESC, created_at DESC';
    if (sort === 'price_asc') orderSql = 'ORDER BY coin_price ASC, created_at DESC';
    if (sort === 'price_desc') orderSql = 'ORDER BY coin_price DESC, created_at DESC';
    if (sort === 'newest') orderSql = 'ORDER BY created_at DESC';

    const countRes = await pgQuery(
      `SELECT COUNT(*)::int as total FROM reward_products ${whereSql};`,
      params
    );
    const total = countRes?.rows?.[0]?.total || 0;

    const dataRes = await pgQuery(
      `SELECT 
         id, title, slug, short_description AS "shortDescription",
         category, brand, specifications, images, coin_price AS "coinPrice",
         stock_quantity AS "stockQuantity", reserved_quantity AS "reservedQuantity",
         featured, delivery_eligible AS "deliveryEligible",
         estimated_delivery_days AS "estimatedDeliveryDays", condition, sku,
         created_at AS "createdAt"
       FROM reward_products
       ${whereSql}
       ${orderSql}
       LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
      [...params, limitNum, offset]
    );

    const rewards = (dataRes?.rows || []).map((p) => {
      let parsedImages = [];
      try {
        parsedImages = typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []);
      } catch {
        parsedImages = [];
      }
      let parsedSpecs = [];
      try {
        parsedSpecs = typeof p.specifications === 'string' ? JSON.parse(p.specifications) : (p.specifications || []);
      } catch {
        parsedSpecs = [];
      }

      return {
        id: p.id,
        _id: p.id,
        title: p.title,
        slug: p.slug,
        shortDescription: p.shortDescription,
        category: p.category,
        brand: p.brand,
        specifications: parsedSpecs,
        images: parsedImages,
        primaryImage: parsedImages.find((img) => img.isPrimary)?.url || parsedImages[0]?.url || (typeof parsedImages[0] === 'string' ? parsedImages[0] : 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400'),
        coinPrice: p.coinPrice,
        stockQuantity: p.stockQuantity,
        inStock: p.stockQuantity > 0,
        featured: p.featured,
        deliveryEligible: p.deliveryEligible,
        estimatedDeliveryDays: p.estimatedDeliveryDays,
        condition: p.condition,
        sku: p.sku
      };
    });

    return res.status(200).json({
      success: true,
      storeEnabled: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      rewards
    });
  } catch (error) {
    console.error('[rewardStoreController.getRewardProducts] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reward products.' });
  }
};

exports.getRewardProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const resDb = await pgQuery(
      `SELECT 
         id, title, slug, short_description AS "shortDescription", description,
         category, brand, specifications, images, coin_price AS "coinPrice",
         stock_quantity AS "stockQuantity", reserved_quantity AS "reservedQuantity",
         is_published AS "isPublished", is_active AS "isActive", featured,
         delivery_eligible AS "deliveryEligible", estimated_delivery_days AS "estimatedDeliveryDays",
         condition, sku, created_at AS "createdAt"
       FROM reward_products
       WHERE id = $1 OR slug = $1 LIMIT 1;`,
      [String(id)]
    );

    if (!resDb?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Reward product not found.' });
    }

    const p = resDb.rows[0];
    let parsedImages = [];
    try {
      parsedImages = typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []);
    } catch {
      parsedImages = [];
    }
    let parsedSpecs = [];
    try {
      parsedSpecs = typeof p.specifications === 'string' ? JSON.parse(p.specifications) : (p.specifications || []);
    } catch {
      parsedSpecs = [];
    }

    return res.status(200).json({
      success: true,
      reward: {
        id: p.id,
        _id: p.id,
        title: p.title,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        category: p.category,
        brand: p.brand,
        specifications: parsedSpecs,
        images: parsedImages,
        primaryImage: parsedImages.find((img) => img.isPrimary)?.url || parsedImages[0]?.url || (typeof parsedImages[0] === 'string' ? parsedImages[0] : 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400'),
        coinPrice: p.coinPrice,
        stockQuantity: p.stockQuantity,
        inStock: p.stockQuantity > 0,
        featured: p.featured,
        deliveryEligible: p.deliveryEligible,
        estimatedDeliveryDays: p.estimatedDeliveryDays,
        condition: p.condition,
        sku: p.sku
      }
    });
  } catch (error) {
    console.error('[rewardStoreController.getRewardProductById] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reward product.' });
  }
};

// -------------------------------------------------------------
// 3. ATOMIC REDEMPTION ORDER CREATION
// -------------------------------------------------------------
exports.createRedemptionOrder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required to redeem rewards.' });
    }

    // 1. Strict Backend Master Switch Check
    const storeStatus = await getStoreSettingsHelper();
    if (!storeStatus.enabled) {
      return res.status(403).json({
        success: false,
        message: storeStatus.maintenanceMessage || 'Rewards Store is currently offline. Redemptions are paused.'
      });
    }

    const { rewardProductId, quantity = 1, deliveryAddress, saveAddress = false } = req.body;
    const reqQty = Math.max(1, parseInt(quantity, 10) || 1);

    if (!rewardProductId) {
      return res.status(400).json({ success: false, message: 'Reward product ID is required.' });
    }

    if (!deliveryAddress || !deliveryAddress.recipientName || !deliveryAddress.phone || !deliveryAddress.addressLine1 || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Complete delivery address (recipient name, phone, address line, city, state, postal code) is required for shipping fulfillment.'
      });
    }

    // 2. Fetch authoritative prize record and stock from PostgreSQL
    const prodRes = await pgQuery(
      `SELECT id, title, coin_price, stock_quantity, is_published, is_active, images, delivery_eligible, estimated_delivery_days
       FROM reward_products WHERE id = $1 LIMIT 1;`,
      [String(rewardProductId)]
    );

    if (!prodRes?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Prize not found in rewards catalog.' });
    }

    const product = prodRes.rows[0];
    if (!product.is_published || !product.is_active) {
      return res.status(400).json({ success: false, message: 'This reward product is currently not available for redemption.' });
    }

    if (product.stock_quantity < reqQty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory. Only ${product.stock_quantity} unit(s) remaining in stock.`
      });
    }

    // Backend authoritative calculation
    const unitCoinPrice = Number(product.coin_price);
    const totalCoinsRequired = unitCoinPrice * reqQty;

    // 3. Verify Customer Coin Balance from PostgreSQL
    const balanceInfo = await coinLedgerService.getBalance(userId);
    if (balanceInfo.coins < totalCoinsRequired) {
      const shortfall = totalCoinsRequired - balanceInfo.coins;
      return res.status(400).json({
        success: false,
        message: `Insufficient coin balance. Your balance: ${balanceInfo.coins} coins. Required: ${totalCoinsRequired} coins. You need ${shortfall} more coins.`,
        currentBalance: balanceInfo.coins,
        requiredCoins: totalCoinsRequired,
        shortfall
      });
    }

    // 4. Generate unique Human-readable order number
    const orderNumber = `LOOOP-ORD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = `rord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Parse primary image for snapshot
    let primaryImg = '';
    try {
      const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || []);
      primaryImg = imgs.find((i) => i.isPrimary)?.url || imgs[0]?.url || (typeof imgs[0] === 'string' ? imgs[0] : '');
    } catch {}

    // 5. Atomic Stock Deduction
    const stockDeductRes = await pgQuery(
      `UPDATE reward_products 
       SET stock_quantity = stock_quantity - $1,
           updated_at = NOW()
       WHERE id = $2 AND stock_quantity >= $1
       RETURNING stock_quantity;`,
      [reqQty, String(rewardProductId)]
    );

    if (!stockDeductRes?.rows?.[0]) {
      return res.status(409).json({
        success: false,
        message: 'Could not reserve inventory. Item stock was just claimed by another order.'
      });
    }

    // 6. Atomic Coin Debit via Ledger
    let debitResult = null;
    try {
      debitResult = await coinLedgerService.debitForRedemption({
        userId,
        amount: totalCoinsRequired,
        orderNumber,
        orderId,
        productTitle: product.title,
        idempotencyKey: `REDEEM:${orderNumber}`
      });
    } catch (debitErr) {
      // Rollback stock reservation if coin debit fails
      await pgQuery('UPDATE reward_products SET stock_quantity = stock_quantity + $1 WHERE id = $2;', [reqQty, String(rewardProductId)]);
      if (debitErr.message === 'INSUFFICIENT_COINS') {
        return res.status(400).json({ success: false, message: 'Insufficient coin balance.' });
      }
      throw debitErr;
    }

    // 7. Insert Redemption Order in PostgreSQL
    const addressSnapshot = {
      recipientName: String(deliveryAddress.recipientName).trim(),
      phone: String(deliveryAddress.phone).trim(),
      addressLine1: String(deliveryAddress.addressLine1).trim(),
      addressLine2: String(deliveryAddress.addressLine2 || '').trim(),
      locality: String(deliveryAddress.locality || '').trim(),
      city: String(deliveryAddress.city).trim(),
      state: String(deliveryAddress.state).trim(),
      postalCode: String(deliveryAddress.postalCode).trim(),
      country: String(deliveryAddress.country || 'India').trim(),
      deliveryInstructions: String(deliveryAddress.deliveryInstructions || '').trim()
    };

    const orderInsertRes = await pgQuery(
      `INSERT INTO reward_orders (
         id, order_number, customer_id, reward_product_id, product_title, product_image,
         quantity, coin_price_per_unit, total_coins, delivery_address, delivery_method,
         status, payment_status, placed_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, 'ORDER_PLACED', 'PAID_IN_COINS', NOW(), NOW(), NOW())
       RETURNING *;`,
      [
        orderId,
        orderNumber,
        String(userId),
        String(rewardProductId),
        product.title,
        primaryImg,
        reqQty,
        unitCoinPrice,
        totalCoinsRequired,
        JSON.stringify(addressSnapshot),
        'Standard Courier Delivery'
      ]
    );

    const savedOrder = orderInsertRes.rows[0];

    // Optionally save customer address for future redemptions
    if (saveAddress) {
      try {
        const addrId = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await pgQuery(
          `INSERT INTO customer_addresses (id, user_id, recipient_name, phone, address_line1, address_line2, locality, city, state, postal_code, country, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
           ON CONFLICT DO NOTHING;`,
          [
            addrId,
            String(userId),
            addressSnapshot.recipientName,
            addressSnapshot.phone,
            addressSnapshot.addressLine1,
            addressSnapshot.addressLine2,
            addressSnapshot.locality,
            addressSnapshot.city,
            addressSnapshot.state,
            addressSnapshot.postalCode,
            addressSnapshot.country
          ]
        );
      } catch {}
    }

    // Customer details for email & notifications
    const custInfo = balanceInfo.user || { name: req.user?.name || 'Customer', email: req.user?.email || '' };

    // 8. In-App Notifications
    // Customer In-App Notification
    try {
      await pgQuery(
        `INSERT INTO notifications (id, recipient_id, type, category, title, message, link, is_read, created_at, updated_at)
         VALUES ($1, $2, 'REWARD_ORDER_PLACED', 'ACCOUNT', $3, $4, '/rewards/orders', false, NOW(), NOW());`,
        [
          `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          String(userId),
          'Reward Order Placed! 🎉',
          `Order #${orderNumber} for "${product.title}" has been confirmed. Coins used: ${totalCoinsRequired}.`
        ]
      );
    } catch {}

    // Admin In-App Notification
    try {
      // Find admin user(s) to notify
      const adminUsers = await pgQuery("SELECT id FROM users WHERE LOWER(role) = 'admin' LIMIT 5;");
      for (const adm of adminUsers.rows || []) {
        await pgQuery(
          `INSERT INTO notifications (id, recipient_id, type, category, title, message, link, is_read, created_at, updated_at)
           VALUES ($1, $2, 'NEW_REWARD_ORDER', 'SYSTEM', $3, $4, '/admin/reward-orders', false, NOW(), NOW());`,
          [
            `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            adm.id,
            `New Prize Redemption Order #${orderNumber}! 🎁`,
            `${custInfo.name} redeemed "${product.title}" for ${totalCoinsRequired} coins. Deliver to: ${addressSnapshot.city}, ${addressSnapshot.postalCode}.`
          ]
        );
      }
    } catch {}

    // Emit live Socket.IO notification to admins & customer
    try {
      const io = getIO();
      if (io) {
        io.to('admin_channel').emit('new_reward_order', {
          orderNumber,
          productTitle: product.title,
          totalCoins: totalCoinsRequired,
          customerName: custInfo.name
        });
        io.to(`user:${userId}`).emit('reward_order_created', {
          orderNumber,
          newBalance: debitResult.newBalance
        });
      }
    } catch {}

    // 9. Send Transactional Emails via Brevo
    const orderEmailPayload = {
      orderNumber,
      customerName: custInfo.name,
      customerEmail: custInfo.email,
      productTitle: product.title,
      quantity: reqQty,
      totalCoins: totalCoinsRequired,
      deliveryAddress: addressSnapshot,
      estimatedDeliveryDays: product.estimated_delivery_days || 5
    };

    // Admin dispatch (includes full shipping address)
    emailService.sendRewardRedemptionAdminEmail(orderEmailPayload)
      .then(() => console.log(`[RewardStore] Admin notification email dispatched for order #${orderNumber}`))
      .catch((err) => console.warn('[RewardStore] Admin email dispatch notice:', err.message));

    // Customer confirmation dispatch
    if (custInfo.email) {
      emailService.sendRewardOrderConfirmedCustomerEmail(orderEmailPayload)
        .then(() => console.log(`[RewardStore] Customer confirmation email dispatched to ${custInfo.email}`))
        .catch((err) => console.warn('[RewardStore] Customer email dispatch notice:', err.message));
    }

    return res.status(201).json({
      success: true,
      message: 'Your reward redemption order has been placed successfully!',
      order: {
        id: savedOrder.id,
        orderNumber: savedOrder.order_number,
        productTitle: savedOrder.product_title,
        quantity: savedOrder.quantity,
        totalCoins: savedOrder.total_coins,
        status: savedOrder.status,
        placedAt: savedOrder.placed_at,
        deliveryAddress: addressSnapshot
      },
      newBalance: debitResult.newBalance
    });
  } catch (error) {
    console.error('[rewardStoreController.createRedemptionOrder] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process prize redemption order.' });
  }
};

// -------------------------------------------------------------
// 4. CUSTOMER ORDERS & TRACKING
// -------------------------------------------------------------
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const resDb = await pgQuery(
      `SELECT 
         id, order_number AS "orderNumber", product_title AS "productTitle",
         product_image AS "productImage", quantity, coin_price_per_unit AS "coinPricePerUnit",
         total_coins AS "totalCoins", delivery_address AS "deliveryAddress",
         delivery_method AS "deliveryMethod", status, payment_status AS "paymentStatus",
         courier_name AS "courierName", tracking_number AS "trackingNumber",
         cancellation_reason AS "cancellationReason",
         placed_at AS "placedAt", confirmed_at AS "confirmedAt",
         packed_at AS "packedAt", shipped_at AS "shippedAt",
         delivered_at AS "deliveredAt", cancelled_at AS "cancelledAt",
         created_at AS "createdAt"
       FROM reward_orders
       WHERE customer_id = $1
       ORDER BY created_at DESC;`,
      [String(userId)]
    );

    const orders = (resDb?.rows || []).map((o) => ({
      ...o,
      deliveryAddress: typeof o.deliveryAddress === 'string' ? JSON.parse(o.deliveryAddress) : o.deliveryAddress
    }));

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('[rewardStoreController.getMyOrders] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve orders.' });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    const resDb = await pgQuery(
      `SELECT 
         id, order_number AS "orderNumber", product_title AS "productTitle",
         product_image AS "productImage", quantity, coin_price_per_unit AS "coinPricePerUnit",
         total_coins AS "totalCoins", delivery_address AS "deliveryAddress",
         delivery_method AS "deliveryMethod", status, payment_status AS "paymentStatus",
         admin_notes AS "adminNotes", courier_name AS "courierName",
         tracking_number AS "trackingNumber", cancellation_reason AS "cancellationReason",
         placed_at AS "placedAt", confirmed_at AS "confirmedAt",
         packed_at AS "packedAt", shipped_at AS "shippedAt",
         delivered_at AS "deliveredAt", cancelled_at AS "cancelledAt",
         created_at AS "createdAt"
       FROM reward_orders
       WHERE (id = $1 OR order_number = $1) AND customer_id = $2
       LIMIT 1;`,
      [String(id), String(userId)]
    );

    if (!resDb?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = resDb.rows[0];
    order.deliveryAddress = typeof order.deliveryAddress === 'string' ? JSON.parse(order.deliveryAddress) : order.deliveryAddress;

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch order details.' });
  }
};

// Customer Cancellation (Permitted if status is ORDER_PLACED or CONFIRMED)
exports.cancelCustomerOrder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const { reason = 'Cancelled by customer' } = req.body;

    // Check order status
    const orderRes = await pgQuery(
      `SELECT id, order_number, customer_id, reward_product_id, quantity, total_coins, status
       FROM reward_orders
       WHERE (id = $1 OR order_number = $1) AND customer_id = $2
       LIMIT 1;`,
      [String(id), String(userId)]
    );

    if (!orderRes?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orderRes.rows[0];
    if (order.status !== 'ORDER_PLACED' && order.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because it is already ${order.status.toLowerCase()}. Only un-dispatched orders can be cancelled.`
      });
    }

    // 1. Update order status to CANCELLED atomically
    await pgQuery(
      `UPDATE reward_orders 
       SET status = 'CANCELLED',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $2;`,
      [reason.trim(), order.id]
    );

    // 2. Restore Inventory
    if (order.reward_product_id) {
      await pgQuery(
        'UPDATE reward_products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2;',
        [order.quantity, order.reward_product_id]
      );
    }

    // 3. Refund Coins via Ledger
    const refundRes = await coinLedgerService.refundCoins({
      userId,
      amount: order.total_coins,
      orderNumber: order.order_number,
      orderId: order.id,
      reason: `Customer cancellation of order #${order.order_number}`
    });

    return res.status(200).json({
      success: true,
      message: `Order #${order.order_number} has been cancelled and ${order.total_coins} coins have been refunded to your account.`,
      newBalance: refundRes.newBalance
    });
  } catch (error) {
    console.error('[rewardStoreController.cancelCustomerOrder] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel order.' });
  }
};

// -------------------------------------------------------------
// 5. ADMIN PRIZE MANAGEMENT (CRUD)
// -------------------------------------------------------------
exports.adminGetRewards = async (req, res) => {
  try {
    const { category, search, status, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereSql = "WHERE 1=1";
    const params = [];
    let paramIdx = 1;

    if (category && category !== 'All') {
      whereSql += ` AND LOWER(category) = LOWER($${paramIdx++})`;
      params.push(category);
    }

    if (status === 'published') {
      whereSql += " AND is_published = true";
    } else if (status === 'draft') {
      whereSql += " AND is_published = false";
    } else if (status === 'out_of_stock') {
      whereSql += " AND stock_quantity <= 0";
    }

    if (search && search.trim()) {
      whereSql += ` AND (title ILIKE $${paramIdx} OR brand ILIKE $${paramIdx} OR sku ILIKE $${paramIdx})`;
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const countRes = await pgQuery(`SELECT COUNT(*)::int as total FROM reward_products ${whereSql};`, params);
    const total = countRes?.rows?.[0]?.total || 0;

    const dataRes = await pgQuery(
      `SELECT 
         id, title, slug, short_description AS "shortDescription", description,
         category, brand, specifications, images, coin_price AS "coinPrice",
         stock_quantity AS "stockQuantity", reserved_quantity AS "reservedQuantity",
         is_published AS "isPublished", is_active AS "isActive", featured,
         delivery_eligible AS "deliveryEligible", estimated_delivery_days AS "estimatedDeliveryDays",
         condition, sku, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM reward_products
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
      [...params, limitNum, offset]
    );

    const rewards = (dataRes?.rows || []).map((p) => ({
      ...p,
      images: typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []),
      specifications: typeof p.specifications === 'string' ? JSON.parse(p.specifications) : (p.specifications || [])
    }));

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      rewards
    });
  } catch (error) {
    console.error('[rewardStoreController.adminGetRewards] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin rewards.' });
  }
};

exports.adminCreateReward = async (req, res) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const {
      title,
      category = 'Home & Kitchen',
      brand = '',
      shortDescription = '',
      description = '',
      specifications = [],
      images = [],
      coinPrice,
      stockQuantity = 1,
      isPublished = true,
      featured = false,
      deliveryEligible = true,
      estimatedDeliveryDays = 5,
      condition = 'brand_new',
      sku = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Product title is required.' });
    }

    const parsedPrice = parseInt(coinPrice, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive coin price is required.' });
    }

    const parsedStock = parseInt(stockQuantity, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ success: false, message: 'Stock quantity cannot be negative.' });
    }

    const id = `rwd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + `-${id.slice(-4)}`;

    const formattedImages = Array.isArray(images)
      ? images.map((img, idx) => ({
          url: typeof img === 'string' ? img : (img.url || ''),
          isPrimary: typeof img === 'object' && img.isPrimary !== undefined ? Boolean(img.isPrimary) : idx === 0,
          caption: typeof img === 'object' ? (img.caption || '') : ''
        }))
      : [];

    const formattedSpecs = Array.isArray(specifications)
      ? specifications.map((s) => ({
          key: typeof s === 'string' ? 'Feature' : (s.key || ''),
          value: typeof s === 'string' ? s : (s.value || '')
        }))
      : [];

    const insertRes = await pgQuery(
      `INSERT INTO reward_products (
         id, title, slug, short_description, description, category, brand,
         specifications, images, coin_price, stock_quantity, reserved_quantity,
         is_published, is_active, featured, delivery_eligible, estimated_delivery_days,
         condition, sku, created_by_admin_id, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8::jsonb, $9::jsonb, $10, $11, 0,
         $12, true, $13, $14, $15,
         $16, $17, $18, NOW(), NOW()
       ) RETURNING *;`,
      [
        id,
        title.trim().substring(0, 200),
        slug,
        (shortDescription || '').trim().substring(0, 500),
        (description || '').trim(),
        (category || 'Home & Kitchen').trim().substring(0, 80),
        (brand || '').trim().substring(0, 100),
        JSON.stringify(formattedSpecs),
        JSON.stringify(formattedImages),
        parsedPrice,
        parsedStock,
        Boolean(isPublished),
        Boolean(featured),
        Boolean(deliveryEligible),
        parseInt(estimatedDeliveryDays, 10) || 5,
        condition || 'brand_new',
        (sku || `SKU-${Date.now().toString().slice(-6)}`).trim(),
        adminId ? String(adminId) : null
      ]
    );

    // Audit log
    try {
      await pgQuery(
        `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, target_title, metadata, created_at, updated_at)
         VALUES ($1, $2, 'REWARD_PRODUCT_CREATED', 'REWARD_PRODUCT', $3, $4, $5::jsonb, NOW(), NOW());`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          String(adminId || 'admin'),
          id,
          title.trim(),
          JSON.stringify({ coinPrice: parsedPrice, stock: parsedStock, category })
        ]
      );
    } catch {}

    return res.status(201).json({
      success: true,
      message: 'Reward prize created successfully.',
      reward: insertRes.rows[0]
    });
  } catch (error) {
    console.error('[rewardStoreController.adminCreateReward] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create reward product.' });
  }
};

exports.adminUpdateReward = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || req.user?._id;

    const {
      title,
      category,
      brand,
      shortDescription,
      description,
      specifications,
      images,
      coinPrice,
      stockQuantity,
      isPublished,
      featured,
      deliveryEligible,
      estimatedDeliveryDays,
      condition,
      sku
    } = req.body;

    const checkRes = await pgQuery('SELECT id FROM reward_products WHERE id = $1 LIMIT 1;', [String(id)]);
    if (!checkRes?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Reward product not found.' });
    }

    const updates = [];
    const params = [String(id)];
    let paramIdx = 2;

    if (title !== undefined) {
      updates.push(`title = $${paramIdx++}`);
      params.push(title.trim().substring(0, 200));
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIdx++}`);
      params.push(category.trim().substring(0, 80));
    }
    if (brand !== undefined) {
      updates.push(`brand = $${paramIdx++}`);
      params.push(brand.trim().substring(0, 100));
    }
    if (shortDescription !== undefined) {
      updates.push(`short_description = $${paramIdx++}`);
      params.push(shortDescription.trim().substring(0, 500));
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      params.push(description.trim());
    }
    if (coinPrice !== undefined) {
      const price = parseInt(coinPrice, 10);
      if (price > 0) {
        updates.push(`coin_price = $${paramIdx++}`);
        params.push(price);
      }
    }
    if (stockQuantity !== undefined) {
      const stock = parseInt(stockQuantity, 10);
      if (stock >= 0) {
        updates.push(`stock_quantity = $${paramIdx++}`);
        params.push(stock);
      }
    }
    if (isPublished !== undefined) {
      updates.push(`is_published = $${paramIdx++}`);
      params.push(Boolean(isPublished));
    }
    if (featured !== undefined) {
      updates.push(`featured = $${paramIdx++}`);
      params.push(Boolean(featured));
    }
    if (deliveryEligible !== undefined) {
      updates.push(`delivery_eligible = $${paramIdx++}`);
      params.push(Boolean(deliveryEligible));
    }
    if (estimatedDeliveryDays !== undefined) {
      updates.push(`estimated_delivery_days = $${paramIdx++}`);
      params.push(parseInt(estimatedDeliveryDays, 10) || 5);
    }
    if (condition !== undefined) {
      updates.push(`condition = $${paramIdx++}`);
      params.push(condition);
    }
    if (sku !== undefined) {
      updates.push(`sku = $${paramIdx++}`);
      params.push(sku.trim());
    }
    if (images !== undefined && Array.isArray(images)) {
      updates.push(`images = $${paramIdx++}::jsonb`);
      params.push(JSON.stringify(images));
    }
    if (specifications !== undefined && Array.isArray(specifications)) {
      updates.push(`specifications = $${paramIdx++}::jsonb`);
      params.push(JSON.stringify(specifications));
    }

    updates.push(`updated_by_admin_id = $${paramIdx++}`);
    params.push(adminId ? String(adminId) : null);
    updates.push('updated_at = NOW()');

    const updateSql = `UPDATE reward_products SET ${updates.join(', ')} WHERE id = $1 RETURNING *;`;
    const updateRes = await pgQuery(updateSql, params);

    return res.status(200).json({
      success: true,
      message: 'Reward product updated successfully.',
      reward: updateRes.rows[0]
    });
  } catch (error) {
    console.error('[rewardStoreController.adminUpdateReward] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update reward product.' });
  }
};

exports.adminDeleteReward = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || req.user?._id;

    // Check if there are active orders
    const checkOrders = await pgQuery(
      "SELECT id FROM reward_orders WHERE reward_product_id = $1 AND status NOT IN ('DELIVERED', 'CANCELLED') LIMIT 1;",
      [String(id)]
    );

    if (checkOrders?.rows?.length > 0) {
      // Soft-archive instead of hard-delete to protect historical orders
      await pgQuery("UPDATE reward_products SET is_published = false, is_active = false, updated_at = NOW() WHERE id = $1;", [String(id)]);
      return res.status(200).json({
        success: true,
        message: 'Reward product has active orders and was unpublished & archived instead of permanently deleted.'
      });
    }

    const delRes = await pgQuery('DELETE FROM reward_products WHERE id = $1 RETURNING id, title;', [String(id)]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Reward product not found.' });
    }

    return res.status(200).json({ success: true, message: 'Reward prize deleted permanently.' });
  } catch (error) {
    console.error('[rewardStoreController.adminDeleteReward] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete reward product.' });
  }
};

// -------------------------------------------------------------
// 6. ADMIN REWARD ORDERS FULFILLMENT & TRACKING
// -------------------------------------------------------------
exports.adminGetOrders = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereSql = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (status && status !== 'all') {
      whereSql += ` AND UPPER(o.status) = UPPER($${paramIdx++})`;
      params.push(status);
    }

    if (search && search.trim()) {
      whereSql += ` AND (o.order_number ILIKE $${paramIdx} OR o.product_title ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`;
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const countRes = await pgQuery(
      `SELECT COUNT(*)::int as total 
       FROM reward_orders o
       LEFT JOIN users u ON o.customer_id = u.id
       ${whereSql};`,
      params
    );
    const total = countRes?.rows?.[0]?.total || 0;

    const dataRes = await pgQuery(
      `SELECT 
         o.id, o.order_number AS "orderNumber", o.customer_id AS "customerId",
         o.reward_product_id AS "rewardProductId", o.product_title AS "productTitle",
         o.product_image AS "productImage", o.quantity, o.coin_price_per_unit AS "coinPricePerUnit",
         o.total_coins AS "totalCoins", o.delivery_address AS "deliveryAddress",
         o.delivery_method AS "deliveryMethod", o.status, o.payment_status AS "paymentStatus",
         o.admin_notes AS "adminNotes", o.courier_name AS "courierName",
         o.tracking_number AS "trackingNumber", o.cancellation_reason AS "cancellationReason",
         o.placed_at AS "placedAt", o.confirmed_at AS "confirmedAt",
         o.packed_at AS "packedAt", o.shipped_at AS "shippedAt",
         o.delivered_at AS "deliveredAt", o.cancelled_at AS "cancelledAt",
         o.created_at AS "createdAt", o.updated_at AS "updatedAt",
         u.name AS "customerName", u.email AS "customerEmail", u.phone AS "customerPhone", u.avatar AS "customerAvatar"
       FROM reward_orders o
       LEFT JOIN users u ON o.customer_id = u.id
       ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
      [...params, limitNum, offset]
    );

    const orders = (dataRes?.rows || []).map((o) => ({
      ...o,
      deliveryAddress: typeof o.deliveryAddress === 'string' ? JSON.parse(o.deliveryAddress) : o.deliveryAddress
    }));

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      orders
    });
  } catch (error) {
    console.error('[rewardStoreController.adminGetOrders] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin orders.' });
  }
};

exports.adminGetOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const resDb = await pgQuery(
      `SELECT 
         o.id, o.order_number AS "orderNumber", o.customer_id AS "customerId",
         o.reward_product_id AS "rewardProductId", o.product_title AS "productTitle",
         o.product_image AS "productImage", o.quantity, o.coin_price_per_unit AS "coinPricePerUnit",
         o.total_coins AS "totalCoins", o.delivery_address AS "deliveryAddress",
         o.delivery_method AS "deliveryMethod", o.status, o.payment_status AS "paymentStatus",
         o.admin_notes AS "adminNotes", o.courier_name AS "courierName",
         o.tracking_number AS "trackingNumber", o.cancellation_reason AS "cancellationReason",
         o.placed_at AS "placedAt", o.confirmed_at AS "confirmedAt",
         o.packed_at AS "packedAt", o.shipped_at AS "shippedAt",
         o.delivered_at AS "deliveredAt", o.cancelled_at AS "cancelledAt",
         o.created_at AS "createdAt", o.updated_at AS "updatedAt",
         u.name AS "customerName", u.email AS "customerEmail", u.phone AS "customerPhone", u.avatar AS "customerAvatar"
       FROM reward_orders o
       LEFT JOIN users u ON o.customer_id = u.id
       WHERE o.id = $1 OR o.order_number = $1
       LIMIT 1;`,
      [String(id)]
    );

    if (!resDb?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = resDb.rows[0];
    order.deliveryAddress = typeof order.deliveryAddress === 'string' ? JSON.parse(order.deliveryAddress) : order.deliveryAddress;

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve order details.' });
  }
};

exports.adminUpdateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, courierName, trackingNumber, adminNotes } = req.body;
    const adminId = req.user?.id || req.user?._id;

    const validStatuses = ['ORDER_PLACED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status. Allowed: ${validStatuses.join(', ')}`
      });
    }

    const targetStatus = status.toUpperCase();

    // Fetch existing order with customer info
    const existingRes = await pgQuery(
      `SELECT o.*, u.name AS "customerName", u.email AS "customerEmail"
       FROM reward_orders o
       LEFT JOIN users u ON o.customer_id = u.id
       WHERE o.id = $1 OR o.order_number = $1
       LIMIT 1;`,
      [String(id)]
    );

    if (!existingRes?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const existingOrder = existingRes.rows[0];
    const updates = ['status = $2', 'updated_at = NOW()'];
    const params = [existingOrder.id, targetStatus];
    let paramIdx = 3;

    if (courierName !== undefined) {
      updates.push(`courier_name = $${paramIdx++}`);
      params.push((courierName || '').trim());
    }
    if (trackingNumber !== undefined) {
      updates.push(`tracking_number = $${paramIdx++}`);
      params.push((trackingNumber || '').trim());
    }
    if (adminNotes !== undefined) {
      updates.push(`admin_notes = $${paramIdx++}`);
      params.push((adminNotes || '').trim());
    }

    // Set timeline timestamps
    if (targetStatus === 'CONFIRMED' && !existingOrder.confirmed_at) {
      updates.push('confirmed_at = NOW()');
    } else if (targetStatus === 'PACKED' && !existingOrder.packed_at) {
      updates.push('packed_at = NOW()');
    } else if (targetStatus === 'SHIPPED' && !existingOrder.shipped_at) {
      updates.push('shipped_at = NOW()');
    } else if (targetStatus === 'DELIVERED' && !existingOrder.delivered_at) {
      updates.push('delivered_at = NOW()');
    } else if (targetStatus === 'CANCELLED' && !existingOrder.cancelled_at) {
      updates.push('cancelled_at = NOW()');
    }

    const updateSql = `UPDATE reward_orders SET ${updates.join(', ')} WHERE id = $1 RETURNING *;`;
    const updateRes = await pgQuery(updateSql, params);
    const updated = updateRes.rows[0];

    // Status label for notifications and emails
    const statusLabels = {
      CONFIRMED: 'Confirmed by Fulfillment Team',
      PROCESSING: 'Processing in Warehouse',
      PACKED: 'Packed & Ready for Dispatch',
      SHIPPED: 'Shipped via Courier',
      OUT_FOR_DELIVERY: 'Out for Delivery to Your Address',
      DELIVERED: 'Delivered Successfully 🎉',
      CANCELLED: 'Cancelled'
    };

    const statusLabel = statusLabels[targetStatus] || targetStatus;

    // Notify customer in-app
    try {
      await pgQuery(
        `INSERT INTO notifications (id, recipient_id, type, category, title, message, link, is_read, created_at, updated_at)
         VALUES ($1, $2, 'ORDER_STATUS_UPDATE', 'ACCOUNT', $3, $4, '/rewards/orders', false, NOW(), NOW());`,
        [
          `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          existingOrder.customer_id,
          `Order #${existingOrder.order_number}: ${statusLabel}`,
          trackingNumber ? `Your parcel has been dispatched. Courier: ${courierName || 'Courier'}. Tracking: ${trackingNumber}.` : `Your order for "${existingOrder.product_title}" is now ${statusLabel.toLowerCase()}.`
        ]
      );
    } catch {}

    // Send Status Update Email via Brevo
    if (existingOrder.customerEmail) {
      emailService.sendRewardOrderStatusUpdatedEmail({
        orderNumber: existingOrder.order_number,
        customerName: existingOrder.customerName,
        customerEmail: existingOrder.customerEmail,
        productTitle: existingOrder.product_title,
        status: targetStatus,
        statusLabel,
        courierName: courierName || existingOrder.courier_name || '',
        trackingNumber: trackingNumber || existingOrder.tracking_number || ''
      }).catch((err) => console.warn('[rewardStore] Customer status email notice:', err.message));
    }

    // Audit log
    try {
      await pgQuery(
        `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, target_title, metadata, created_at, updated_at)
         VALUES ($1, $2, 'REWARD_ORDER_STATUS_UPDATED', 'REWARD_ORDER', $3, $4, $5::jsonb, NOW(), NOW());`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          String(adminId || 'admin'),
          existingOrder.id,
          existingOrder.order_number,
          JSON.stringify({ from: existingOrder.status, to: targetStatus, courierName, trackingNumber })
        ]
      );
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Order #${existingOrder.order_number} status updated to ${statusLabel}.`,
      order: updated
    });
  } catch (error) {
    console.error('[rewardStoreController.adminUpdateOrderStatus] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update order status.' });
  }
};

exports.adminCancelAndRefundOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by administrator' } = req.body;
    const adminId = req.user?.id || req.user?._id;

    const existingRes = await pgQuery(
      `SELECT id, order_number, customer_id, reward_product_id, quantity, total_coins, status
       FROM reward_orders
       WHERE id = $1 OR order_number = $1
       LIMIT 1;`,
      [String(id)]
    );

    if (!existingRes?.rows?.[0]) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = existingRes.rows[0];
    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Order has already been cancelled.' });
    }

    // 1. Update status to CANCELLED
    await pgQuery(
      `UPDATE reward_orders 
       SET status = 'CANCELLED',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           refunded_at = NOW(),
           updated_at = NOW()
       WHERE id = $2;`,
      [reason.trim(), order.id]
    );

    // 2. Restore Inventory
    if (order.reward_product_id) {
      await pgQuery(
        'UPDATE reward_products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2;',
        [order.quantity, order.reward_product_id]
      );
    }

    // 3. Refund Coins via Ledger
    const refundRes = await coinLedgerService.refundCoins({
      userId: order.customer_id,
      amount: order.total_coins,
      orderNumber: order.order_number,
      orderId: order.id,
      reason: `Admin cancellation of order #${order.order_number}: ${reason}`,
      adminId
    });

    // 4. Audit Log
    try {
      await pgQuery(
        `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, target_title, metadata, created_at, updated_at)
         VALUES ($1, $2, 'REWARD_ORDER_ADMIN_CANCEL_REFUND', 'REWARD_ORDER', $3, $4, $5::jsonb, NOW(), NOW());`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          String(adminId || 'admin'),
          order.id,
          order.order_number,
          JSON.stringify({ amount: order.total_coins, reason })
        ]
      );
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Order #${order.order_number} cancelled and ${order.total_coins} coins refunded successfully.`
    });
  } catch (error) {
    console.error('[rewardStoreController.adminCancelAndRefundOrder] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process cancellation and refund.' });
  }
};
