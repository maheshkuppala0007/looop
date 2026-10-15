const { query: pgQuery } = require('../config/postgres');
const notificationService = require('./notificationService');

/**
 * LOOOP Auditable Coin Ledger Service
 * Strictly database-backed against Neon PostgreSQL.
 * Handles atomic balance modifications, duplicate prevention, and ledger audits.
 */
class CoinLedgerService {
  /**
   * Get verified user coin balance from PostgreSQL
   */
  async getBalance(userId) {
    if (!userId) return { coins: 0, points: 0 };
    try {
      const res = await pgQuery(
        'SELECT id, name, email, COALESCE(coins, points, 0)::int as coins, COALESCE(points, 0)::int as points FROM users WHERE id = $1 LIMIT 1;',
        [String(userId)]
      );
      if (res?.rows?.[0]) {
        return {
          coins: res.rows[0].coins || 0,
          points: res.rows[0].points || 0,
          user: {
            id: res.rows[0].id,
            name: res.rows[0].name,
            email: res.rows[0].email
          }
        };
      }
      return { coins: 0, points: 0 };
    } catch (err) {
      console.error('[CoinLedgerService] Error fetching balance:', err.message);
      return { coins: 0, points: 0 };
    }
  }

  /**
   * Get paginated ledger history for user
   */
  async getLedger({ userId, page = 1, limit = 20 }) {
    if (!userId) return { history: [], total: 0, page: 1, totalPages: 1 };
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    try {
      const countRes = await pgQuery(
        'SELECT COUNT(*)::int as total FROM points_ledger WHERE user_id = $1;',
        [String(userId)]
      );
      const total = countRes?.rows?.[0]?.total || 0;

      const dataRes = await pgQuery(
        `SELECT 
           id, user_id AS "userId", amount, type, reason, 
           transaction_id AS "transactionId", item_id AS "itemId", 
           reference_type AS "referenceType", reference_id AS "referenceId",
           balance_after AS "balanceAfter", idempotency_key AS "idempotencyKey",
           created_at AS "createdAt"
         FROM points_ledger
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3;`,
        [String(userId), limitNum, offset]
      );

      const history = (dataRes?.rows || []).map((row) => ({
        id: row.id,
        _id: row.id,
        amount: row.amount,
        type: row.type,
        reason: row.reason,
        balanceAfter: row.balanceAfter,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        createdAt: row.createdAt
      }));

      return {
        history,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1
      };
    } catch (err) {
      console.error('[CoinLedgerService] Error fetching ledger:', err.message);
      return { history: [], total: 0, page: pageNum, totalPages: 1 };
    }
  }

  /**
   * Award coins to a customer (e.g. for sharing an approved product or admin bonus)
   * Protected with strict idempotency to prevent duplicate awards.
   */
  async awardCoins({
    userId,
    amount,
    reason,
    referenceType = 'ITEM_CONTRIBUTION',
    referenceId = null,
    adminId = null,
    idempotencyKey = null
  }) {
    if (!userId || !amount || amount <= 0) {
      throw new Error('Valid userId and positive coin amount are required.');
    }

    const key = idempotencyKey || (referenceId ? `AWARD:${referenceType}:${referenceId}` : `AWARD:${userId}:${Date.now()}`);

    // Check duplicate idempotency key
    if (key) {
      const existing = await pgQuery(
        'SELECT id, amount, balance_after FROM points_ledger WHERE idempotency_key = $1 LIMIT 1;',
        [key]
      );
      if (existing?.rows?.[0]) {
        console.log(`[CoinLedgerService] Duplicate award prevented by idempotency key: ${key}`);
        return {
          duplicate: true,
          ledgerId: existing.rows[0].id,
          amount: existing.rows[0].amount,
          balanceAfter: existing.rows[0].balance_after
        };
      }
    }

    // Atomically increment coins and points on customer account
    const updateRes = await pgQuery(
      `UPDATE users 
       SET coins = COALESCE(coins, points, 0) + $1,
           points = COALESCE(points, 0) + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, coins, points;`,
      [amount, String(userId)]
    );

    if (!updateRes?.rows?.[0]) {
      throw new Error(`Customer ${userId} not found in database.`);
    }

    const newBalance = updateRes.rows[0].coins;
    const ledgerId = `cld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Insert auditable ledger row
    await pgQuery(
      `INSERT INTO points_ledger (
         id, user_id, amount, type, reason, balance_after,
         reference_type, reference_id, idempotency_key, created_by_admin_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());`,
      [
        ledgerId,
        String(userId),
        amount,
        'CONTRIBUTION_REWARD',
        reason || `Contribution Reward: +${amount} LOOOP Coins`,
        newBalance,
        referenceType,
        referenceId ? String(referenceId) : null,
        key,
        adminId ? String(adminId) : null
      ]
    );

    // If linked to an item, mark item as coins awarded
    if (referenceType === 'ITEM_CONTRIBUTION' && referenceId) {
      try {
        await pgQuery(
          'UPDATE items SET coins_awarded = $1, coins_awarded_at = NOW(), updated_at = NOW() WHERE id = $2;',
          [amount, String(referenceId)]
        );
      } catch (itemErr) {
        console.warn('[CoinLedgerService] Item coins_awarded flag notice:', itemErr.message);
      }
    }

    // In-app customer notification
    try {
      await pgQuery(
        `INSERT INTO notifications (id, recipient_id, type, category, title, message, link, is_read, created_at, updated_at)
         VALUES ($1, $2, 'COINS_AWARDED', 'ACCOUNT', $3, $4, '/coins', false, NOW(), NOW());`,
        [
          `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          String(userId),
          `+${amount} LOOOP Coins Credited! 🎉`,
          reason ? `${reason}. Your updated balance is ${newBalance} coins.` : `You were awarded ${amount} coins. Available balance: ${newBalance} coins.`
        ]
      );
    } catch (notifErr) {
      console.warn('[CoinLedgerService] Notification notice:', notifErr.message);
    }

    // Audit log if awarded by admin
    if (adminId) {
      try {
        await pgQuery(
          `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, target_title, metadata, created_at, updated_at)
           VALUES ($1, $2, 'COINS_AWARDED', 'USER', $3, $4, $5::jsonb, NOW(), NOW());`,
          [
            `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            String(adminId),
            String(userId),
            updateRes.rows[0].email,
            JSON.stringify({ amount, reason, referenceType, referenceId, newBalance })
          ]
        );
      } catch {}
    }

    return {
      success: true,
      amount,
      newBalance,
      ledgerId
    };
  }

  /**
   * Debit coins for Rewards Store prize redemption
   * Throws error if customer balance is insufficient.
   */
  async debitForRedemption({
    userId,
    amount,
    orderNumber,
    orderId,
    productTitle,
    idempotencyKey
  }) {
    if (!userId || !amount || amount <= 0) {
      throw new Error('Valid userId and positive amount are required.');
    }

    const key = idempotencyKey || `REDEEM:${orderNumber || orderId}`;

    // Verify balance atomically with row update
    const updateRes = await pgQuery(
      `UPDATE users 
       SET coins = coins - $1,
           points = GREATEST(0, points - $1),
           updated_at = NOW()
       WHERE id = $2 AND COALESCE(coins, points, 0) >= $1
       RETURNING id, coins, points;`,
      [amount, String(userId)]
    );

    if (!updateRes?.rows?.[0]) {
      throw new Error('INSUFFICIENT_COINS');
    }

    const newBalance = updateRes.rows[0].coins;
    const ledgerId = `cld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await pgQuery(
      `INSERT INTO points_ledger (
         id, user_id, amount, type, reason, balance_after,
         reference_type, reference_id, idempotency_key, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());`,
      [
        ledgerId,
        String(userId),
        -amount,
        'REDEMPTION_DEBIT',
        `Redeemed: ${productTitle || 'Reward Prize'} (Order #${orderNumber})`,
        newBalance,
        'REWARD_ORDER',
        String(orderId || orderNumber),
        key
      ]
    );

    return {
      success: true,
      amountDebited: amount,
      newBalance,
      ledgerId
    };
  }

  /**
   * Refund coins on order cancellation
   * Protected against duplicate refunding.
   */
  async refundCoins({
    userId,
    amount,
    orderNumber,
    orderId,
    reason,
    adminId = null
  }) {
    if (!userId || !amount || amount <= 0) {
      throw new Error('Valid userId and amount required for refund.');
    }

    const key = `REFUND:${orderNumber || orderId}`;
    const checkDup = await pgQuery(
      'SELECT id FROM points_ledger WHERE idempotency_key = $1 LIMIT 1;',
      [key]
    );
    if (checkDup?.rows?.[0]) {
      console.warn(`[CoinLedgerService] Refund already processed for key: ${key}`);
      return { alreadyRefunded: true };
    }

    // Atomically restore coins
    const updateRes = await pgQuery(
      `UPDATE users 
       SET coins = COALESCE(coins, points, 0) + $1,
           points = COALESCE(points, 0) + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, coins;`,
      [amount, String(userId)]
    );

    const newBalance = updateRes?.rows?.[0]?.coins || 0;
    const ledgerId = `cld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await pgQuery(
      `INSERT INTO points_ledger (
         id, user_id, amount, type, reason, balance_after,
         reference_type, reference_id, idempotency_key, created_by_admin_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());`,
      [
        ledgerId,
        String(userId),
        amount,
        'REFUND_CREDIT',
        `Refund: ${reason || `Cancelled Order #${orderNumber}`}`,
        newBalance,
        'REWARD_ORDER',
        String(orderId || orderNumber),
        key,
        adminId ? String(adminId) : null
      ]
    );

    // Notify customer
    try {
      await pgQuery(
        `INSERT INTO notifications (id, recipient_id, type, category, title, message, link, is_read, created_at, updated_at)
         VALUES ($1, $2, 'COINS_REFUNDED', 'ACCOUNT', $3, $4, '/coins', false, NOW(), NOW());`,
        [
          `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          String(userId),
          `+${amount} Coins Refunded`,
          `Coins for Order #${orderNumber} have been refunded. New balance: ${newBalance} coins.`
        ]
      );
    } catch {}

    return {
      success: true,
      amountRefunded: amount,
      newBalance,
      ledgerId
    };
  }
}

module.exports = new CoinLedgerService();
