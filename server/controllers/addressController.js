const { query: pgQuery } = require('../config/postgres');

/**
 * Controller for Customer Saved Delivery Addresses
 * Strictly scoped to authenticated customer.
 */

// GET /api/addresses
exports.getMyAddresses = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const resDb = await pgQuery(
      `SELECT 
         id, recipient_name AS "recipientName", phone,
         address_line1 AS "addressLine1", address_line2 AS "addressLine2",
         locality, city, state, postal_code AS "postalCode", country,
         delivery_instructions AS "deliveryInstructions",
         is_default AS "isDefault", created_at AS "createdAt"
       FROM customer_addresses
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC;`,
      [String(userId)]
    );

    return res.status(200).json({
      success: true,
      addresses: resDb?.rows || []
    });
  } catch (error) {
    console.error('[addressController.getMyAddresses] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve addresses.' });
  }
};

// POST /api/addresses
exports.createAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const {
      recipientName,
      phone,
      addressLine1,
      addressLine2 = '',
      locality = '',
      city,
      state,
      postalCode,
      country = 'India',
      deliveryInstructions = '',
      isDefault = false
    } = req.body;

    if (!recipientName || !recipientName.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    if (!addressLine1 || !addressLine1.trim()) {
      return res.status(400).json({ success: false, message: 'Address line 1 is required.' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ success: false, message: 'City is required.' });
    }
    if (!state || !state.trim()) {
      return res.status(400).json({ success: false, message: 'State is required.' });
    }
    if (!postalCode || !postalCode.trim()) {
      return res.status(400).json({ success: false, message: 'Postal/PIN code is required.' });
    }

    const addressId = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // If marked default, unset other defaults for this user
    if (isDefault) {
      await pgQuery('UPDATE customer_addresses SET is_default = false WHERE user_id = $1;', [String(userId)]);
    }

    const insertRes = await pgQuery(
      `INSERT INTO customer_addresses (
         id, user_id, recipient_name, phone, address_line1, address_line2,
         locality, city, state, postal_code, country, delivery_instructions, is_default,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING id, recipient_name AS "recipientName", phone, address_line1 AS "addressLine1", address_line2 AS "addressLine2", locality, city, state, postal_code AS "postalCode", country, is_default AS "isDefault";`,
      [
        addressId,
        String(userId),
        recipientName.trim().substring(0, 150),
        phone.trim().substring(0, 30),
        addressLine1.trim(),
        (addressLine2 || '').trim(),
        (locality || '').trim().substring(0, 120),
        city.trim().substring(0, 100),
        state.trim().substring(0, 100),
        postalCode.trim().substring(0, 20),
        (country || 'India').trim().substring(0, 60),
        (deliveryInstructions || '').trim(),
        Boolean(isDefault)
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Delivery address saved successfully.',
      address: insertRes.rows[0]
    });
  } catch (error) {
    console.error('[addressController.createAddress] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save address.' });
  }
};

// DELETE /api/addresses/:id
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    const delRes = await pgQuery(
      'DELETE FROM customer_addresses WHERE id = $1 AND user_id = $2 RETURNING id;',
      [String(id), String(userId)]
    );

    if (delRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Address not found or unauthorized.' });
    }

    return res.status(200).json({ success: true, message: 'Address deleted successfully.' });
  } catch (error) {
    console.error('[addressController.deleteAddress] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete address.' });
  }
};
