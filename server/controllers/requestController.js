const mongoose = require('mongoose');
const Request = require('../models/Request');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const WantedItem = require('../models/WantedItem');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { query: pgQuery } = require('../config/postgres');
const conversationService = require('../services/conversationService');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { getIO } = require('../sockets');

/**
 * Request Controller
 * Fully backed by Neon PostgreSQL with MongoDB compatibility.
 * Supports string/UUID item IDs, automatic real-time socket alerts,
 * and Brevo email notifications to the owner and requester.
 */

// 1. Create a Request or Offer (POST /api/requests)
exports.createRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to create a request.'
      });
    }

    const {
      itemId,
      wantedItemId,
      type,
      message = '',
      expectedReturnDate,
      offeredItemId,
      location,
      phone
    } = req.body || {};

    const trimmedMessage = (message || '').trim();

    // ====================================================
    // CASE A: Direct Request on an Available Item
    // ====================================================
    if (itemId) {
      const cleanItemId = String(itemId).trim();
      let item = null;
      let ownerUser = null;

      // 1. Query Neon PostgreSQL as authoritative store
      try {
        const itemRes = await pgQuery(`
          SELECT i.*, 
                 u.name AS owner_name, 
                 u.email AS owner_email, 
                 u.phone AS owner_phone, 
                 u.avatar AS owner_avatar,
                 u.trust_score AS owner_trust_score,
                 u.rating AS owner_rating
          FROM items i
          LEFT JOIN users u ON i.owner_id = u.id
          WHERE i.id = $1 LIMIT 1;
        `, [cleanItemId]);

        if (itemRes?.rows?.[0]) {
          item = itemRes.rows[0];
          ownerUser = {
            id: item.owner_id,
            _id: item.owner_id,
            name: item.owner_name,
            email: item.owner_email,
            phone: item.owner_phone,
            avatar: item.owner_avatar,
            trustScore: item.owner_trust_score,
            rating: item.owner_rating
          };
        }
      } catch (pgErr) {
        console.warn('[createRequest] PostgreSQL lookup notice:', pgErr.message);
      }

      // 2. Fallback to MongoDB if not found in PostgreSQL
      if (!item && mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(cleanItemId)) {
        try {
          const mItem = await Item.findById(cleanItemId).populate('owner');
          if (mItem) {
            item = {
              id: mItem._id.toString(),
              _id: mItem._id.toString(),
              title: mItem.title,
              sharing_type: mItem.sharingType,
              availability: mItem.availability,
              status: mItem.status,
              condition: mItem.condition,
              owner_id: mItem.owner?._id ? mItem.owner._id.toString() : mItem.owner?.toString()
            };
            ownerUser = mItem.owner;
          }
        } catch {}
      }

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'The requested item was not found.'
        });
      }

      // 3. Availability check
      const availabilityLower = (item.availability || '').toLowerCase();
      const statusLower = (item.status || '').toLowerCase();
      if (availabilityLower === 'unavailable' || statusLower === 'removed' || statusLower === 'reused') {
        return res.status(400).json({
          success: false,
          message: 'This item is no longer available.'
        });
      }

      // 4. Ownership check: Requester cannot request own item
      if (item.owner_id && String(item.owner_id) === String(userId)) {
        return res.status(400).json({
          success: false,
          message: 'You cannot request your own item.'
        });
      }

      // 5. Duplicate pending request check in PostgreSQL
      try {
        const dupCheck = await pgQuery(`
          SELECT id FROM requests 
          WHERE item_id = $1 AND requester_id = $2 AND status = 'PENDING' 
          LIMIT 1;
        `, [cleanItemId, String(userId)]);

        if (dupCheck?.rows?.length > 0) {
          return res.status(400).json({
            success: false,
            message: "You've already requested this item. Please wait for the owner's response."
          });
        }
      } catch (dupErr) {
        console.warn('[createRequest] Duplicate check notice:', dupErr.message);
      }

      // 6. Request type compatibility & validation
      let resolvedType = type;
      if (!resolvedType) {
        if (item.sharing_type === 'borrow') resolvedType = 'BORROW';
        else if (item.sharing_type === 'exchange') resolvedType = 'EXCHANGE';
        else resolvedType = 'REQUEST_ITEM';
      }

      let parsedReturnDate = null;
      if (resolvedType === 'BORROW' || item.sharing_type === 'borrow') {
        resolvedType = 'BORROW';
        if (expectedReturnDate) {
          const retDate = new Date(expectedReturnDate);
          if (!isNaN(retDate.getTime())) {
            parsedReturnDate = retDate;
          }
        }
      }

      // 7. Generate authoritative request ID
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const requesterName = req.user?.name || 'A community member';
      const itemTitle = item.title || 'your item';

      // 8. Insert into PostgreSQL requests table
      try {
        await pgQuery(`
          INSERT INTO requests (
            id, item_id, requester_id, owner_id, type, message, 
            expected_return_date, offered_item_id, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', NOW(), NOW());
        `, [
          requestId,
          cleanItemId,
          String(userId),
          String(item.owner_id),
          resolvedType,
          trimmedMessage,
          parsedReturnDate,
          offeredItemId ? String(offeredItemId) : null
        ]);
      } catch (pgInsertErr) {
        console.error('[createRequest] PostgreSQL insert error:', pgInsertErr.message);
      }

      // 9. Sync to MongoDB if connected
      if (mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(cleanItemId)) {
        try {
          const mReq = new Request({
            item: cleanItemId,
            requester: userId,
            owner: item.owner_id,
            type: resolvedType,
            message: trimmedMessage,
            expectedReturnDate: parsedReturnDate,
            offeredItem: offeredItemId || null,
            status: 'PENDING'
          });
          await mReq.save();
        } catch {}
      }

      // 10. Persist in-app notification for item owner in PostgreSQL
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      try {
        await pgQuery(`
          INSERT INTO notifications (
            id, recipient_id, actor_id, type, category, title, message, link, dedupe_key,
            related_entity_type, related_entity_id, related_item_id, related_request_id,
            is_read, created_at, updated_at
          ) VALUES ($1, $2, $3, 'REQUEST_RECEIVED', 'REQUESTS', $4, $5, $6, $7, 'Request', $8, $9, $10, false, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          notifId,
          String(item.owner_id),
          String(userId),
          'New request received',
          `${requesterName} requested your item "${itemTitle}".`,
          `/requests/${requestId}`,
          `REQUEST_RECEIVED:${requestId}`,
          requestId,
          cleanItemId,
          requestId
        ]);
      } catch (notifErr) {
        console.warn('[createRequest] Notification creation notice:', notifErr.message);
      }

      // 11. Real-time Socket.IO dispatch to owner's screen
      try {
        const io = getIO();
        if (io && item.owner_id) {
          const targetOwnerId = String(item.owner_id);
          io.to(`user:${targetOwnerId}`).emit('new_notification', {
            notification: {
              id: notifId,
              recipient: targetOwnerId,
              actor: {
                id: userId,
                name: requesterName,
                avatar: req.user?.avatar || ''
              },
              type: 'REQUEST_RECEIVED',
              category: 'REQUESTS',
              title: 'New request received',
              message: `${requesterName} requested your item "${itemTitle}".`,
              link: `/requests/${requestId}`,
              createdAt: new Date()
            },
            quietHoursSuppressed: false
          });
          io.to(`user:${targetOwnerId}`).emit('notification_count_updated', {
            recipient: targetOwnerId
          });
        }
      } catch (socketErr) {
        console.warn('[createRequest] Socket notification notice:', socketErr.message);
      }

      // 12. Transactional email dispatch to owner via Brevo Email
      if (ownerUser?.email) {
        emailService.sendRequestReceivedEmail({
          toEmail: ownerUser.email,
          recipientName: ownerUser.name || 'Owner',
          recipientUserId: ownerUser.id,
          requesterName,
          requesterEmail: req.user?.email || '',
          requesterPhone: phone || req.user?.phone || '',
          requesterLocation: location || req.user?.city || 'Local Area',
          itemTitle,
          requestType: resolvedType === 'BORROW' ? 'Borrow' : 'Reuse',
          message: trimmedMessage,
          requestId
        }).catch((e) => console.error('[createRequest] Email dispatch notice:', e.message));
      }

      // Parse images safely for response payload
      let parsedImages = [];
      try {
        parsedImages = typeof item.images === 'string' ? JSON.parse(item.images) : (item.images || []);
      } catch {}

      return res.status(201).json({
        success: true,
        message: 'Your request has been submitted to the owner.',
        request: {
          id: requestId,
          _id: requestId,
          itemId: item.id,
          item: {
            id: item.id,
            _id: item.id,
            title: item.title,
            images: parsedImages,
            sharingType: item.sharing_type,
            condition: item.condition,
            location: {
              city: item.city || '',
              locality: item.locality || ''
            }
          },
          ownerId: item.owner_id,
          requesterId: userId,
          type: resolvedType,
          status: 'PENDING',
          message: trimmedMessage,
          createdAt: new Date().toISOString()
        }
      });
    }

    // ====================================================
    // CASE B: Offer on a Wanted Item
    // ====================================================
    if (wantedItemId) {
      const cleanWantedId = String(wantedItemId).trim();
      let wantedItem = null;

      try {
        const wRes = await pgQuery('SELECT * FROM wanted_items WHERE id = $1 LIMIT 1', [cleanWantedId]);
        if (wRes?.rows?.[0]) wantedItem = wRes.rows[0];
      } catch {}

      if (!wantedItem && mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(cleanWantedId)) {
        try {
          wantedItem = await WantedItem.findById(cleanWantedId);
        } catch {}
      }

      if (!wantedItem) {
        return res.status(404).json({
          success: false,
          message: 'The wanted request was not found.'
        });
      }

      const offerId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      try {
        await pgQuery(`
          INSERT INTO requests (id, wanted_item_id, requester_id, owner_id, type, message, offered_item_id, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 'OFFER', $5, $6, 'PENDING', NOW(), NOW());
        `, [
          offerId,
          cleanWantedId,
          String(userId),
          String(wantedItem.requester_id || wantedItem.requester),
          trimmedMessage,
          offeredItemId ? String(offeredItemId) : null
        ]);
      } catch {}

      return res.status(201).json({
        success: true,
        message: 'Your offer has been submitted to the requester.',
        request: { id: offerId, _id: offerId, status: 'PENDING' }
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Please provide either an itemId or a wantedItemId.'
    });
  } catch (error) {
    console.error('Error in createRequest:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to submit request. Please try again.'
    });
  }
};

// 2. Get Requests Created by Authenticated User (GET /api/requests/my)
exports.getMyRequests = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let formatted = [];

    // 1. PostgreSQL Authoritative Query
    try {
      const pgRes = await pgQuery(`
        SELECT r.*,
               i.title AS item_title, i.images AS item_images, i.sharing_type AS item_sharing_type,
               i.condition AS item_condition, i.availability AS item_availability, i.status AS item_status,
               i.city AS item_city, i.locality AS item_locality,
               u.name AS owner_name, u.avatar AS owner_avatar, u.trust_score AS owner_trust_score,
               u.rating AS owner_rating, u.email AS owner_email, u.phone AS owner_phone
        FROM requests r
        LEFT JOIN items i ON r.item_id = i.id
        LEFT JOIN users u ON r.owner_id = u.id
        WHERE r.requester_id = $1
        ORDER BY r.created_at DESC;
      `, [String(userId)]);

      if (pgRes?.rows) {
        formatted = pgRes.rows.map((row) => {
          let parsedImages = [];
          try {
            parsedImages = typeof row.item_images === 'string' ? JSON.parse(row.item_images) : (row.item_images || []);
          } catch {}

          return {
            id: row.id,
            _id: row.id,
            type: row.type,
            message: row.message,
            status: row.status,
            expectedReturnDate: row.expected_return_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            item: row.item_id ? {
              id: row.item_id,
              _id: row.item_id,
              title: row.item_title,
              images: parsedImages,
              sharingType: row.item_sharing_type,
              condition: row.item_condition,
              availability: row.item_availability,
              status: row.item_status,
              location: { city: row.item_city, locality: row.item_locality }
            } : null,
            owner: row.owner_id ? {
              id: row.owner_id,
              _id: row.owner_id,
              name: row.owner_name,
              avatar: row.owner_avatar,
              trustScore: row.owner_trust_score,
              rating: row.owner_rating,
              email: row.owner_email,
              phone: row.owner_phone
            } : null,
            requester: {
              id: userId,
              _id: userId,
              name: req.user?.name,
              email: req.user?.email
            }
          };
        });
      }
    } catch (pgErr) {
      console.warn('[getMyRequests] PostgreSQL query notice:', pgErr.message);
    }

    // 2. Fallback to MongoDB if PostgreSQL yielded empty and Mongo connected
    if (formatted.length === 0 && mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const mRequests = await Request.find({ requester: userId })
          .populate('item', 'title images sharingType condition availability status location')
          .populate('owner', 'name avatar trustScore rating email')
          .sort({ createdAt: -1 });

        formatted = mRequests.map((r) => ({
          ...r.toObject(),
          id: r._id
        }));
      } catch {}
    }

    return res.status(200).json({
      success: true,
      count: formatted.length,
      requests: formatted
    });
  } catch (error) {
    console.error('Error in getMyRequests:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve your sent requests.'
    });
  }
};

// 3. Get Requests Received by Authenticated User (GET /api/requests/received)
exports.getReceivedRequests = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    let formatted = [];

    // 1. PostgreSQL Authoritative Query
    try {
      const pgRes = await pgQuery(`
        SELECT r.*,
               i.title AS item_title, i.images AS item_images, i.sharing_type AS item_sharing_type,
               i.condition AS item_condition, i.availability AS item_availability, i.status AS item_status,
               i.city AS item_city, i.locality AS item_locality,
               u.name AS requester_name, u.avatar AS requester_avatar, u.trust_score AS requester_trust_score,
               u.rating AS requester_rating, u.email AS requester_email, u.phone AS requester_phone
        FROM requests r
        LEFT JOIN items i ON r.item_id = i.id
        LEFT JOIN users u ON r.requester_id = u.id
        WHERE r.owner_id = $1
        ORDER BY r.created_at DESC;
      `, [String(userId)]);

      if (pgRes?.rows) {
        formatted = pgRes.rows.map((row) => {
          let parsedImages = [];
          try {
            parsedImages = typeof row.item_images === 'string' ? JSON.parse(row.item_images) : (row.item_images || []);
          } catch {}

          return {
            id: row.id,
            _id: row.id,
            type: row.type,
            message: row.message,
            status: row.status,
            expectedReturnDate: row.expected_return_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            item: row.item_id ? {
              id: row.item_id,
              _id: row.item_id,
              title: row.item_title,
              images: parsedImages,
              sharingType: row.item_sharing_type,
              condition: row.item_condition,
              availability: row.item_availability,
              status: row.item_status,
              location: { city: row.item_city, locality: row.item_locality }
            } : null,
            requester: row.requester_id ? {
              id: row.requester_id,
              _id: row.requester_id,
              name: row.requester_name,
              avatar: row.requester_avatar,
              trustScore: row.requester_trust_score,
              rating: row.requester_rating,
              email: row.requester_email,
              phone: row.requester_phone
            } : null,
            owner: {
              id: userId,
              _id: userId,
              name: req.user?.name,
              email: req.user?.email
            }
          };
        });
      }
    } catch (pgErr) {
      console.warn('[getReceivedRequests] PostgreSQL query notice:', pgErr.message);
    }

    // 2. Fallback to MongoDB if PostgreSQL yielded empty and Mongo connected
    if (formatted.length === 0 && mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        const mRequests = await Request.find({ owner: userId })
          .populate('item', 'title images sharingType condition availability status location')
          .populate('requester', 'name avatar trustScore rating email')
          .sort({ createdAt: -1 });

        formatted = mRequests.map((r) => ({
          ...r.toObject(),
          id: r._id
        }));
      } catch {}
    }

    return res.status(200).json({
      success: true,
      count: formatted.length,
      requests: formatted
    });
  } catch (error) {
    console.error('Error in getReceivedRequests:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve received requests.'
    });
  }
};

// 4. Get Request by ID (GET /api/requests/:id)
exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const cleanId = String(id).trim();

    // 1. PostgreSQL Lookup
    try {
      const pgRes = await pgQuery(`
        SELECT r.*,
               i.title AS item_title, i.images AS item_images, i.category AS item_category,
               i.condition AS item_condition, i.sharing_type AS item_sharing_type,
               i.availability AS item_availability, i.status AS item_status,
               i.city AS item_city, i.locality AS item_locality,
               u_req.name AS requester_name, u_req.avatar AS requester_avatar, u_req.trust_score AS requester_trust_score,
               u_req.rating AS requester_rating, u_req.email AS requester_email, u_req.phone AS requester_phone,
               u_own.name AS owner_name, u_own.avatar AS owner_avatar, u_own.trust_score AS owner_trust_score,
               u_own.rating AS owner_rating, u_own.email AS owner_email, u_own.phone AS owner_phone
        FROM requests r
        LEFT JOIN items i ON r.item_id = i.id
        LEFT JOIN users u_req ON r.requester_id = u_req.id
        LEFT JOIN users u_own ON r.owner_id = u_own.id
        WHERE r.id = $1 LIMIT 1;
      `, [cleanId]);

      if (pgRes?.rows?.[0]) {
        const row = pgRes.rows[0];
        const isRequester = String(row.requester_id) === String(userId);
        const isOwner = String(row.owner_id) === String(userId);
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'ADMIN';

        if (!isRequester && !isOwner && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to view this request.'
          });
        }

        let parsedImages = [];
        try {
          parsedImages = typeof row.item_images === 'string' ? JSON.parse(row.item_images) : (row.item_images || []);
        } catch {}

        return res.status(200).json({
          success: true,
          request: {
            id: row.id,
            _id: row.id,
            type: row.type,
            message: row.message,
            status: row.status,
            expectedReturnDate: row.expected_return_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            item: row.item_id ? {
              id: row.item_id,
              _id: row.item_id,
              title: row.item_title,
              images: parsedImages,
              category: row.item_category,
              condition: row.item_condition,
              sharingType: row.item_sharing_type,
              availability: row.item_availability,
              status: row.item_status,
              location: { city: row.item_city, locality: row.item_locality }
            } : null,
            requester: {
              id: row.requester_id,
              _id: row.requester_id,
              name: row.requester_name,
              avatar: row.requester_avatar,
              trustScore: row.requester_trust_score,
              rating: row.requester_rating,
              email: row.requester_email,
              phone: row.requester_phone
            },
            owner: {
              id: row.owner_id,
              _id: row.owner_id,
              name: row.owner_name,
              avatar: row.owner_avatar,
              trustScore: row.owner_trust_score,
              rating: row.owner_rating,
              email: row.owner_email,
              phone: row.owner_phone
            }
          }
        });
      }
    } catch (pgErr) {
      console.warn('[getRequestById] PostgreSQL query notice:', pgErr.message);
    }

    // 2. Fallback to MongoDB
    if (mongoose.connection?.readyState === 1 && mongoose.Types.ObjectId.isValid(cleanId)) {
      try {
        const mReq = await Request.findById(cleanId)
          .populate('item')
          .populate('requester')
          .populate('owner');
        if (mReq) {
          return res.status(200).json({
            success: true,
            request: { ...mReq.toObject(), id: mReq._id }
          });
        }
      } catch {}
    }

    return res.status(404).json({
      success: false,
      message: 'Request not found.'
    });
  } catch (error) {
    console.error('Error in getRequestById:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load request details.'
    });
  }
};

// 5. Accept Request (PATCH /api/requests/:id/accept)
exports.acceptRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const cleanId = String(id).trim();

    // 1. Fetch request from PostgreSQL
    let requestRow = null;
    try {
      const rCheck = await pgQuery(`
        SELECT r.*, 
               i.title AS item_title, i.sharing_type AS item_sharing_type,
               u_req.name AS requester_name, u_req.email AS requester_email,
               u_own.name AS owner_name, u_own.email AS owner_email
        FROM requests r
        LEFT JOIN items i ON r.item_id = i.id
        LEFT JOIN users u_req ON r.requester_id = u_req.id
        LEFT JOIN users u_own ON r.owner_id = u_own.id
        WHERE r.id = $1 LIMIT 1;
      `, [cleanId]);
      if (rCheck?.rows?.[0]) requestRow = rCheck.rows[0];
    } catch {}

    if (!requestRow) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (String(requestRow.owner_id) !== String(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the item owner can accept this request.' });
    }

    if (requestRow.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request is already marked as ${requestRow.status.toLowerCase()}.`
      });
    }

    // 2. Mark request as ACCEPTED and reserve the item in PostgreSQL
    try {
      await pgQuery("UPDATE requests SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW() WHERE id = $1", [cleanId]);
      if (requestRow.item_id) {
        await pgQuery("UPDATE items SET availability = 'Reserved', updated_at = NOW() WHERE id = $1", [requestRow.item_id]);
      }
    } catch (pgUpErr) {
      console.warn('[acceptRequest] PostgreSQL update notice:', pgUpErr.message);
    }

    // 2.5 Ensure conversation is created in PostgreSQL between owner and requester
    const convId = `conv_${cleanId}`;
    try {
      await pgQuery(`
        INSERT INTO conversations (
          id, request_id, item_id, participant_ids, status, created_at, updated_at
        ) VALUES ($1, $2, $3, ARRAY[$4, $5], 'ACTIVE', NOW(), NOW())
        ON CONFLICT (request_id) DO UPDATE SET status = 'ACTIVE', updated_at = NOW();
      `, [
        convId,
        cleanId,
        requestRow.item_id || null,
        String(requestRow.owner_id),
        String(requestRow.requester_id)
      ]);
    } catch (cErr) {
      console.warn('[acceptRequest] Conversation creation notice:', cErr.message);
    }

    // 3. Notify requester in PostgreSQL
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await pgQuery(`
        INSERT INTO notifications (
          id, recipient_id, actor_id, type, category, title, message, link, dedupe_key,
          related_entity_type, related_entity_id, related_item_id, related_request_id,
          is_read, created_at, updated_at
        ) VALUES ($1, $2, $3, 'REQUEST_ACCEPTED', 'REQUESTS', $4, $5, $6, $7, 'Request', $8, $9, $10, false, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [
        notifId,
        String(requestRow.requester_id),
        String(userId),
        'Request Accepted!',
        `Your request for "${requestRow.item_title || 'the item'}" has been accepted by ${requestRow.owner_name || 'the owner'}.`,
        `/requests/${cleanId}`,
        `REQUEST_ACCEPTED:${cleanId}`,
        cleanId,
        requestRow.item_id,
        cleanId
      ]);
    } catch {}

    // 4. Socket dispatch to requester
    try {
      const io = getIO();
      if (io && requestRow.requester_id) {
        io.to(`user:${requestRow.requester_id}`).emit('new_notification', {
          notification: {
            id: notifId,
            recipient: requestRow.requester_id,
            actor: { id: userId, name: requestRow.owner_name || 'Owner' },
            type: 'REQUEST_ACCEPTED',
            category: 'REQUESTS',
            title: 'Request Accepted!',
            message: `Your request for "${requestRow.item_title || 'the item'}" has been accepted.`,
            link: `/requests/${cleanId}`,
            createdAt: new Date()
          }
        });
        io.to(`user:${requestRow.requester_id}`).emit('notification_count_updated', {
          recipient: requestRow.requester_id
        });
      }
    } catch {}

    // 5. Send Email to requester via Brevo
    if (requestRow.requester_email) {
      emailService.sendRequestAcceptedEmail({
        toEmail: requestRow.requester_email,
        recipientName: requestRow.requester_name || 'Community Member',
        recipientUserId: requestRow.requester_id,
        ownerName: requestRow.owner_name || 'Owner',
        itemTitle: requestRow.item_title || 'the product'
      }).catch((e) => console.error('[acceptRequest] Email notice:', e.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Request accepted successfully. Handover coordination and messaging are now open.',
      conversationId: convId,
      request: { id: cleanId, _id: cleanId, status: 'ACCEPTED', conversationId: convId }
    });
  } catch (error) {
    console.error('Error in acceptRequest:', error);
    return res.status(500).json({ success: false, message: 'Unable to accept request.' });
  }
};

// 6. Decline Request (PATCH /api/requests/:id/decline)
exports.declineRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body || {};
    const userId = req.user?.id || req.user?._id;
    const cleanId = String(id).trim();

    let requestRow = null;
    try {
      const rCheck = await pgQuery(`
        SELECT r.*, i.title AS item_title, u_req.email AS requester_email, u_req.name AS requester_name, u_own.name AS owner_name
        FROM requests r
        LEFT JOIN items i ON r.item_id = i.id
        LEFT JOIN users u_req ON r.requester_id = u_req.id
        LEFT JOIN users u_own ON r.owner_id = u_own.id
        WHERE r.id = $1 LIMIT 1;
      `, [cleanId]);
      if (rCheck?.rows?.[0]) requestRow = rCheck.rows[0];
    } catch {}

    if (!requestRow) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (String(requestRow.owner_id) !== String(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the item owner can decline this request.' });
    }

    if (requestRow.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request is already marked as ${requestRow.status.toLowerCase()}.`
      });
    }

    try {
      await pgQuery("UPDATE requests SET status = 'DECLINED', declined_at = NOW(), updated_at = NOW() WHERE id = $1", [cleanId]);
    } catch {}

    // Send email to requester via Brevo
    if (requestRow.requester_email) {
      emailService.sendRequestDeclinedEmail({
        toEmail: requestRow.requester_email,
        recipientName: requestRow.requester_name || 'Member',
        recipientUserId: requestRow.requester_id,
        ownerName: requestRow.owner_name || 'Owner',
        itemTitle: requestRow.item_title || 'the item',
        reason: reason ? String(reason).trim() : ''
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'Request declined.',
      request: { id: cleanId, _id: cleanId, status: 'DECLINED' }
    });
  } catch (error) {
    console.error('Error in declineRequest:', error);
    return res.status(500).json({ success: false, message: 'Unable to decline request.' });
  }
};

// 7. Cancel Request (PATCH /api/requests/:id/cancel)
exports.cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const cleanId = String(id).trim();

    let requestRow = null;
    try {
      const rCheck = await pgQuery('SELECT * FROM requests WHERE id = $1 LIMIT 1', [cleanId]);
      if (rCheck?.rows?.[0]) requestRow = rCheck.rows[0];
    } catch {}

    if (!requestRow) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (String(requestRow.requester_id) !== String(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the requester can cancel this request.' });
    }

    if (requestRow.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a request that is already ${requestRow.status.toLowerCase()}.`
      });
    }

    try {
      await pgQuery("UPDATE requests SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1", [cleanId]);
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Your request has been cancelled.',
      request: { id: cleanId, _id: cleanId, status: 'CANCELLED' }
    });
  } catch (error) {
    console.error('Error in cancelRequest:', error);
    return res.status(500).json({ success: false, message: 'Unable to cancel request.' });
  }
};

// 8. Mark Item as Taken & Permanently Delete Chat from Database (POST /api/requests/:id/taken)
exports.markItemTaken = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const cleanId = String(id).trim();

    let requestRow = null;
    try {
      const rCheck = await pgQuery('SELECT * FROM requests WHERE id = $1 LIMIT 1', [cleanId]);
      if (rCheck?.rows?.[0]) requestRow = rCheck.rows[0];
    } catch {}

    if (!requestRow) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const userEmail = req.user?.email ? req.user.email.toLowerCase().trim() : null;
    let isOwner = String(requestRow.owner_id) === String(userId);
    let isRequester = String(requestRow.requester_id) === String(userId);
    if (!isOwner && !isRequester && userEmail) {
      try {
        const uRes = await pgQuery('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [userEmail]);
        if (uRes?.rows?.[0]?.id) {
          if (String(uRes.rows[0].id) === String(requestRow.owner_id)) isOwner = true;
          if (String(uRes.rows[0].id) === String(requestRow.requester_id)) isRequester = true;
        }
      } catch {}
    }

    if (!isOwner && !isRequester && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the item owner or requester can mark this item as taken.'
      });
    }

    if (requestRow.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        message: 'This item is already marked as taken.',
        request: { id: cleanId, status: 'COMPLETED' }
      });
    }

    // 1. Mark request as COMPLETED in PostgreSQL
    try {
      await pgQuery("UPDATE requests SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW() WHERE id = $1", [cleanId]);
      if (requestRow.item_id) {
        await pgQuery("UPDATE items SET availability = 'Unavailable', status = 'reused', updated_at = NOW() WHERE id = $1", [requestRow.item_id]);
      }
      // Permanently delete all chat messages from database for privacy
      await pgQuery('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE request_id = $1)', [cleanId]);
      await pgQuery("UPDATE conversations SET status = 'CLOSED', last_message_text = '[Item Taken - Chat securely deleted]' WHERE request_id = $1", [cleanId]);
    } catch (e) {
      console.warn('[markItemTaken] PostgreSQL sync notice:', e.message);
    }

    // Real-time broadcast to close chat on both customers' screens immediately
    try {
      const io = getIO();
      if (io) {
        io.to(`conversation:conv_${cleanId}`).emit('item_taken', {
          requestId: cleanId,
          message: 'Item has been taken! Handover complete and chat messages have been permanently deleted.'
        });
        if (requestRow.owner_id) io.to(`user:${requestRow.owner_id}`).emit('item_taken', { requestId: cleanId });
        if (requestRow.requester_id) io.to(`user:${requestRow.requester_id}`).emit('item_taken', { requestId: cleanId });
      }
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Item successfully marked as taken! Handover complete and chat messages have been permanently deleted from the database.',
      request: { id: cleanId, _id: cleanId, status: 'COMPLETED' }
    });
  } catch (error) {
    console.error('Error in markItemTaken:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark item as taken.' });
  }
};
