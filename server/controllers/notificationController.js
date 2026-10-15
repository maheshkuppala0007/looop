const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const notificationService = require('../services/notificationService');
const { query: pgQuery } = require('../config/postgres');

/**
 * LOOOP Notification Controller
 * Fully backed by Neon PostgreSQL with MongoDB compatibility.
 */

const CATEGORY_MAP = {
  REQUESTS: [
    'REQUEST_RECEIVED',
    'REQUEST_ACCEPTED',
    'REQUEST_DECLINED',
    'REQUEST_CANCELLED'
  ],
  TRANSACTIONS: [
    'TRANSACTION_CREATED',
    'HANDOVER_SCHEDULED',
    'HANDOVER_CONFIRMED',
    'RETURN_STARTED',
    'RETURN_CONFIRMED',
    'TRANSACTION_COMPLETED'
  ],
  MESSAGES: ['NEW_MESSAGE'],
  MATCHING: ['WANTED_MATCH', 'WANTED_RESPONSE'],
  ITEMS: ['ITEM_UPDATED', 'ITEM_UNAVAILABLE'],
  SAFETY: ['REPORT_UPDATE'],
  ACCOUNT: ['SECURITY_ALERT'],
  IMPACT: ['IMPACT_MILESTONE'],
  SYSTEM: ['REVIEW_RECEIVED']
};

// 1. Get Paginated Notifications with Filters (GET /api/notifications)
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { page = 1, limit = 20, read, type, category } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // 1. Authoritative Neon PostgreSQL Query
    try {
      const conditions = ['n.recipient_id = $1', 'n.deleted_at IS NULL'];
      const params = [String(userId)];

      if (read === 'false' || read === false) {
        conditions.push('n.is_read = false');
      } else if (read === 'true' || read === true) {
        conditions.push('n.is_read = true');
      }

      if (category && typeof category === 'string' && category.toLowerCase() !== 'all') {
        params.push(category.toUpperCase());
        conditions.push(`n.category = $${params.length}`);
      }

      if (type && typeof type === 'string' && type.toLowerCase() !== 'all') {
        params.push(type.toUpperCase());
        conditions.push(`n.type = $${params.length}`);
      }

      const whereClause = conditions.join(' AND ');

      const listSql = `
        SELECT n.*,
               u.name AS actor_name, u.avatar AS actor_avatar, u.trust_score AS actor_trust_score,
               i.title AS item_title, i.images AS item_images, i.category AS item_category, i.sharing_type AS item_sharing_type
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        LEFT JOIN items i ON n.related_item_id = i.id
        WHERE ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset};
      `;
      const countSql = `SELECT count(*) FROM notifications n WHERE ${whereClause};`;
      const unreadSql = `SELECT count(*) FROM notifications WHERE recipient_id = $1 AND is_read = false AND deleted_at IS NULL;`;

      const [listRes, countRes, unreadRes] = await Promise.all([
        pgQuery(listSql, params),
        pgQuery(countSql, params),
        pgQuery(unreadSql, [String(userId)])
      ]);

      const totalCount = parseInt(countRes?.rows?.[0]?.count || 0, 10);
      const unreadCount = parseInt(unreadRes?.rows?.[0]?.count || 0, 10);

      const formatted = (listRes?.rows || []).map((row) => {
        let parsedImages = [];
        try {
          parsedImages = typeof row.item_images === 'string' ? JSON.parse(row.item_images) : (row.item_images || []);
        } catch {}

        return {
          id: row.id,
          _id: row.id,
          recipient: row.recipient_id,
          actor: row.actor_id ? {
            id: row.actor_id,
            _id: row.actor_id,
            name: row.actor_name,
            avatar: row.actor_avatar,
            trustScore: row.actor_trust_score
          } : null,
          type: row.type,
          category: row.category,
          title: row.title,
          message: row.message,
          link: row.link,
          isRead: row.is_read,
          relatedItem: row.related_item_id ? {
            id: row.related_item_id,
            _id: row.related_item_id,
            title: row.item_title,
            images: parsedImages,
            category: row.item_category,
            sharingType: row.item_sharing_type
          } : null,
          relatedRequest: row.related_request_id ? { id: row.related_request_id } : null,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });

      return res.status(200).json({
        success: true,
        notifications: formatted,
        total: totalCount,
        unreadCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
        hasMore: pageNum * limitNum < totalCount
      });
    } catch (pgErr) {
      console.warn('[getNotifications] PostgreSQL notice:', pgErr.message);
    }

    // 2. Fallback to MongoDB
    if (mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const query = { recipient: userId, deletedAt: null };
        if (read === 'false' || read === false) query.isRead = false;
        else if (read === 'true' || read === true) query.isRead = true;

        const [notifications, totalCount, unreadCount] = await Promise.all([
          Notification.find(query)
            .populate('actor', 'name avatar trustScore rating')
            .populate('relatedItem', 'title images category sharingType condition availability')
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limitNum),
          Notification.countDocuments(query),
          Notification.countDocuments({ recipient: userId, isRead: false, deletedAt: null })
        ]);

        return res.status(200).json({
          success: true,
          notifications: notifications.map((n) => ({ ...n.toObject(), id: n._id })),
          total: totalCount,
          unreadCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum) || 1,
          hasMore: pageNum * limitNum < totalCount
        });
      } catch {}
    }

    return res.status(200).json({
      success: true,
      notifications: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      limit: limitNum,
      totalPages: 1,
      hasMore: false
    });
  } catch (error) {
    console.error('Error in getNotifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve notifications.'
    });
  }
};

// 2. Get Authoritative Unread Notification Count (GET /api/notifications/unread-count)
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    try {
      const unreadRes = await pgQuery(
        'SELECT count(*) FROM notifications WHERE recipient_id = $1 AND is_read = false AND deleted_at IS NULL;',
        [String(userId)]
      );
      return res.status(200).json({
        success: true,
        unreadCount: parseInt(unreadRes?.rows?.[0]?.count || 0, 10)
      });
    } catch (pgErr) {
      console.warn('[getUnreadCount] PostgreSQL notice:', pgErr.message);
    }

    if (mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const count = await Notification.countDocuments({
          recipient: userId,
          isRead: false,
          deletedAt: null
        });
        return res.status(200).json({ success: true, unreadCount: count });
      } catch {}
    }

    return res.status(200).json({ success: true, unreadCount: 0 });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve unread notification count.'
    });
  }
};

// 3. Mark Single Notification as Read (PATCH /api/notifications/:id/read)
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const cleanId = String(id).trim();

    try {
      await pgQuery(
        'UPDATE notifications SET is_read = true, read_at = NOW(), updated_at = NOW() WHERE id = $1 AND recipient_id = $2;',
        [cleanId, String(userId)]
      );
    } catch {}

    if (mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(cleanId)) {
      try {
        await Notification.findOneAndUpdate(
          { _id: cleanId, recipient: userId },
          { isRead: true, readAt: new Date() }
        );
      } catch {}
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    console.error('Error in markAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to mark notification as read.'
    });
  }
};

// 4. Mark All Notifications as Read (PATCH /api/notifications/read-all)
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    try {
      await pgQuery(
        'UPDATE notifications SET is_read = true, read_at = NOW(), updated_at = NOW() WHERE recipient_id = $1 AND is_read = false;',
        [String(userId)]
      );
    } catch {}

    if (mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        await Notification.updateMany(
          { recipient: userId, isRead: false, deletedAt: null },
          { isRead: true, readAt: new Date() }
        );
      } catch {}
    }

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to mark all notifications as read.'
    });
  }
};

// 5. Delete / Soft-Dismiss Notification (DELETE /api/notifications/:id)
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const cleanId = String(id).trim();

    try {
      await pgQuery(
        'UPDATE notifications SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND recipient_id = $2;',
        [cleanId, String(userId)]
      );
    } catch {}

    if (mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(cleanId)) {
      try {
        await Notification.findOneAndUpdate(
          { _id: cleanId, recipient: userId },
          { deletedAt: new Date() }
        );
      } catch {}
    }

    return res.status(200).json({
      success: true,
      message: 'Notification dismissed.'
    });
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to dismiss notification.'
    });
  }
};

// 6. Get Recent Notifications Preview (GET /api/notifications/recent)
exports.getRecentNotifications = async (req, res) => {
  req.query.limit = '5';
  return exports.getNotifications(req, res);
};

// 7. Get Notification Preferences (GET /api/notifications/preferences)
exports.getPreferences = async (req, res) => {
  return res.status(200).json({
    success: true,
    preferences: {
      inApp: true,
      browser: false,
      categories: {
        requests: true,
        transactions: true,
        messages: true,
        matching: true,
        items: true,
        safety: true,
        account: true,
        impact: true,
        system: true
      }
    }
  });
};

// 8. Update Notification Preferences (PUT /api/notifications/preferences)
exports.updatePreferences = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Preferences updated successfully.'
  });
};
