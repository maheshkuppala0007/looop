const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { getIO } = require('../sockets');

// Central mapping from notification type to authoritative category
const TYPE_TO_CATEGORY = {
  REQUEST_RECEIVED: 'REQUESTS',
  REQUEST_ACCEPTED: 'REQUESTS',
  REQUEST_DECLINED: 'REQUESTS',
  REQUEST_CANCELLED: 'REQUESTS',
  TRANSACTION_CREATED: 'TRANSACTIONS',
  HANDOVER_SCHEDULED: 'TRANSACTIONS',
  HANDOVER_CONFIRMED: 'TRANSACTIONS',
  RETURN_STARTED: 'TRANSACTIONS',
  RETURN_CONFIRMED: 'TRANSACTIONS',
  TRANSACTION_COMPLETED: 'TRANSACTIONS',
  NEW_MESSAGE: 'MESSAGES',
  WANTED_MATCH: 'MATCHING',
  WANTED_RESPONSE: 'MATCHING',
  ITEM_UPDATED: 'ITEMS',
  ITEM_UNAVAILABLE: 'ITEMS',
  REPORT_UPDATE: 'SAFETY',
  SECURITY_ALERT: 'ACCOUNT',
  IMPACT_MILESTONE: 'IMPACT',
  REVIEW_RECEIVED: 'SYSTEM'
};

// Category to preference key mapping
const CATEGORY_TO_PREF_KEY = {
  REQUESTS: 'requests',
  TRANSACTIONS: 'transactions',
  MESSAGES: 'messages',
  MATCHING: 'matching',
  ITEMS: 'items',
  SAFETY: 'safety',
  ACCOUNT: 'account',
  IMPACT: 'impact',
  SYSTEM: 'system'
};

/**
 * Timezone-aware quiet hours checker
 */
function isCurrentTimeInQuietHours(quietHours) {
  if (!quietHours || !quietHours.enabled || !quietHours.start || !quietHours.end) {
    return false;
  }
  try {
    const tz = quietHours.timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const currentMins = hour * 60 + minute;

    const [startH, startM] = quietHours.start.split(':').map(Number);
    const [endH, endM] = quietHours.end.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins <= endMins) {
      return currentMins >= startMins && currentMins < endMins;
    } else {
      // Crosses midnight (e.g. 22:00 to 07:00)
      return currentMins >= startMins || currentMins < endMins;
    }
  } catch (err) {
    console.warn('[NotificationService] Quiet hours check error:', err.message);
    return false;
  }
}

/**
 * LOOOP Notification Service
 * Centralized service for creating, persisting, and real-time dispatching
 * of system notifications and activity alerts.
 */
class NotificationService {
  /**
   * Safe lookup or fallback auto-provisioning of user notification preferences
   */
  async getPreferences(userId) {
    if (!userId) return null;
    try {
      let pref = await NotificationPreference.findOne({ user: userId });
      if (!pref) {
        pref = await NotificationPreference.create({
          user: userId,
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
        });
      }
      return pref;
    } catch (err) {
      console.warn('[NotificationService] Failed to load preferences, using safe defaults:', err.message);
      return {
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
      };
    }
  }

  /**
   * Core notification creation method with deduplication, preference-awareness,
   * and real-time dispatch.
   */
  async createNotification(params) {
    try {
      const {
        recipient,
        actor = null,
        type,
        category: explicitCategory = null,
        title,
        message,
        link = null,
        dedupeKey = null,
        relatedEntityType = null,
        relatedEntityId = null,
        relatedItem = null,
        relatedWantedItem = null,
        relatedRequest = null,
        relatedTransaction = null,
        relatedConversation = null
      } = params;

      if (!recipient || !type || !title || !message) {
        console.warn('[NotificationService] Missing required notification fields:', { recipient, type, title });
        return null;
      }

      const toId = (val) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (val._id) return val._id;
        if (val.id) return val.id;
        return val;
      };

      const normalizedRecipient = toId(recipient);
      const normalizedActor = toId(actor);
      const normalizedItem = toId(relatedItem);
      const normalizedWanted = toId(relatedWantedItem);
      const normalizedRequest = toId(relatedRequest);
      const normalizedTransaction = toId(relatedTransaction);
      const normalizedConversation = toId(relatedConversation);
      const normalizedEntityId = toId(relatedEntityId);

      // Determine authoritative category
      const category = explicitCategory || TYPE_TO_CATEGORY[type] || 'SYSTEM';

      // 1. Persist Notification in Neon PostgreSQL
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      try {
        const { query: pgQuery } = require('../config/postgres');
        await pgQuery(`
          INSERT INTO notifications (
            id, recipient_id, actor_id, type, category, title, message, link, dedupe_key,
            related_entity_type, related_entity_id, related_item_id, related_wanted_item_id,
            related_request_id, related_transaction_id, related_conversation_id, is_read, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, false, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          notifId,
          String(normalizedRecipient),
          normalizedActor ? String(normalizedActor) : null,
          type,
          category,
          title,
          message,
          link,
          dedupeKey,
          relatedEntityType,
          normalizedEntityId ? String(normalizedEntityId) : null,
          normalizedItem ? String(normalizedItem) : null,
          normalizedWanted ? String(normalizedWanted) : null,
          normalizedRequest ? String(normalizedRequest) : null,
          normalizedTransaction ? String(normalizedTransaction) : null,
          normalizedConversation ? String(normalizedConversation) : null
        ]);
      } catch (pgNotifErr) {
        console.warn('[NotificationService] PostgreSQL save notice:', pgNotifErr.message);
      }

      // 2. Real-time dispatch via Socket.IO
      const io = getIO();
      if (io && normalizedRecipient) {
        const targetUserId = normalizedRecipient.toString();
        io.to(`user:${targetUserId}`).emit('new_notification', {
          notification: {
            id: notifId,
            _id: notifId,
            recipient: targetUserId,
            actor: normalizedActor ? { id: normalizedActor } : null,
            type,
            category,
            title,
            message,
            link,
            isRead: false,
            createdAt: new Date()
          },
          quietHoursSuppressed: false
        });
        io.to(`user:${targetUserId}`).emit('notification_count_updated', {
          recipient: targetUserId
        });
      }

      // 3. Persist Notification in MongoDB if connected
      let notification = { id: notifId, _id: notifId, type, category, title, message };
      if (mongoose.connection?.readyState === 1) {
        try {
          const mNotif = new Notification({
            recipient: normalizedRecipient,
            actor: normalizedActor,
            type,
            category,
            title,
            message,
            link,
            dedupeKey,
            relatedEntityType,
            relatedEntityId: normalizedEntityId,
            relatedItem: normalizedItem,
            relatedWantedItem: normalizedWanted,
            relatedRequest: normalizedRequest,
            relatedTransaction: normalizedTransaction,
            relatedConversation: normalizedConversation,
            isRead: false
          });
          await mNotif.save();
          notification = mNotif;
        } catch {}
      }

      return notification;
    } catch (error) {
      console.error('[NotificationService] Error creating notification:', error.message);
      return null;
    }
  }

  // ====================================================
  // 1. REQUEST NOTIFICATIONS
  // ====================================================

  /**
   * User A creates request for User B's item -> Notify User B (owner)
   */
  async notifyRequestReceived({ request, item, actor, requester }) {
    const recipient = request?.owner || item?.owner;
    if (!request || !recipient) return null;

    const itemName = item?.title || 'your item';
    const actorUser = actor || requester;
    const actorName = actorUser?.name || 'A community member';
    const requestId = request._id || request.id;

    return await this.createNotification({
      recipient,
      actor: actorUser?._id || request?.requester,
      type: 'REQUEST_RECEIVED',
      category: 'REQUESTS',
      title: 'New request received',
      message: `${actorName} requested your item "${itemName}".`,
      link: `/requests/${requestId}`,
      dedupeKey: `REQUEST_RECEIVED:${requestId}`,
      relatedEntityType: 'Request',
      relatedEntityId: requestId,
      relatedItem: item?._id || request?.item,
      relatedRequest: requestId
    });
  }

  /**
   * User B accepts request -> Notify User A (requester)
   */
  async notifyRequestAccepted({ request, item, actor, transaction, conversation }) {
    if (!request || !request.requester) return null;

    const itemName = item?.title || 'the item';
    const actorName = actor?.name || 'The owner';
    const requestId = request._id || request.id;
    const txId = transaction?._id || request.transaction;

    return await this.createNotification({
      recipient: request.requester,
      actor: actor?._id || request.owner,
      type: 'REQUEST_ACCEPTED',
      category: 'REQUESTS',
      title: 'Request accepted!',
      message: `${actorName} accepted your request for "${itemName}". Handover coordination is now open.`,
      link: txId ? `/transactions/${txId}` : `/requests/${requestId}`,
      dedupeKey: `REQUEST_ACCEPTED:${requestId}`,
      relatedEntityType: txId ? 'Transaction' : 'Request',
      relatedEntityId: txId || requestId,
      relatedItem: item?._id || request.item,
      relatedRequest: requestId,
      relatedTransaction: txId || null,
      relatedConversation: conversation?._id || request.conversation || null
    });
  }

  /**
   * User B declines request -> Notify User A (requester)
   */
  async notifyRequestDeclined({ request, item, actor }) {
    if (!request || !request.requester) return null;

    const itemName = item?.title || 'the item';
    const actorName = actor?.name || 'The owner';
    const requestId = request._id || request.id;

    return await this.createNotification({
      recipient: request.requester,
      actor: actor?._id || request.owner,
      type: 'REQUEST_DECLINED',
      category: 'REQUESTS',
      title: 'Request declined',
      message: `Your request for "${itemName}" was declined by ${actorName}.`,
      link: `/requests/${requestId}`,
      dedupeKey: `REQUEST_DECLINED:${requestId}`,
      relatedEntityType: 'Request',
      relatedEntityId: requestId,
      relatedItem: item?._id || request.item,
      relatedRequest: requestId
    });
  }

  /**
   * User A cancels pending request -> Notify User B (owner)
   */
  async notifyRequestCancelled({ request, item, actor }) {
    const recipient = request?.owner || item?.owner;
    if (!request || !recipient) return null;

    const itemName = item?.title || 'your item';
    const actorName = actor?.name || 'The requester';
    const requestId = request._id || request.id;

    return await this.createNotification({
      recipient,
      actor: actor?._id || request?.requester,
      type: 'REQUEST_CANCELLED',
      category: 'REQUESTS',
      title: 'Request cancelled',
      message: `${actorName} cancelled their request for "${itemName}".`,
      link: `/requests/${requestId}`,
      dedupeKey: `REQUEST_CANCELLED:${requestId}`,
      relatedEntityType: 'Request',
      relatedEntityId: requestId,
      relatedItem: item?._id || request?.item,
      relatedRequest: requestId
    });
  }

  // ====================================================
  // 2. TRANSACTION NOTIFICATIONS
  // ====================================================

  /**
   * Handover meeting details updated -> Notify other participant
   */
  async notifyHandoverScheduled({ transaction, item, actor, recipientId }) {
    if (!transaction || !recipientId) return null;

    const itemName = item?.title || 'the item';
    const actorName = actor?.name || 'Your partner';
    const txId = transaction._id || transaction.id;

    return await this.createNotification({
      recipient: recipientId,
      actor: actor?._id || actor,
      type: 'HANDOVER_SCHEDULED',
      category: 'TRANSACTIONS',
      title: 'Handover details updated',
      message: `${actorName} scheduled meeting details for "${itemName}". Check the transaction page for time & location.`,
      link: `/transactions/${txId}`,
      relatedEntityType: 'Transaction',
      relatedEntityId: txId,
      relatedItem: item?._id || transaction.item,
      relatedTransaction: txId
    });
  }

  /**
   * One participant confirms handover (or both confirm)
   */
  async notifyHandoverConfirmed({ transaction, item, actor, recipientId, bothConfirmed }) {
    if (!transaction) return null;

    const itemName = item?.title || 'the item';
    const actorName = actor?.name || 'Your partner';
    const txId = transaction._id || transaction.id;

    if (bothConfirmed) {
      const ownerId = transaction.owner?._id || transaction.owner;
      const recipientUser = transaction.recipient?._id || transaction.recipient;

      await Promise.all([
        this.createNotification({
          recipient: ownerId,
          actor: actor?._id || actor,
          type: 'HANDOVER_CONFIRMED',
          category: 'TRANSACTIONS',
          title: 'Handover complete!',
          message: `Both parties confirmed handover for "${itemName}". Sharing is now active.`,
          link: `/transactions/${txId}`,
          dedupeKey: `HANDOVER_CONFIRMED:${txId}:${ownerId}`,
          relatedEntityType: 'Transaction',
          relatedEntityId: txId,
          relatedItem: item?._id || transaction.item,
          relatedTransaction: txId
        }),
        this.createNotification({
          recipient: recipientUser,
          actor: actor?._id || actor,
          type: 'HANDOVER_CONFIRMED',
          category: 'TRANSACTIONS',
          title: 'Handover complete!',
          message: `Both parties confirmed handover for "${itemName}". Sharing is now active.`,
          link: `/transactions/${txId}`,
          dedupeKey: `HANDOVER_CONFIRMED:${txId}:${recipientUser}`,
          relatedEntityType: 'Transaction',
          relatedEntityId: txId,
          relatedItem: item?._id || transaction.item,
          relatedTransaction: txId
        })
      ]);
      return true;
    }

    if (recipientId) {
      return await this.createNotification({
        recipient: recipientId,
        actor: actor?._id || actor,
        type: 'HANDOVER_CONFIRMED',
        category: 'TRANSACTIONS',
        title: 'Handover confirmed by partner',
        message: `${actorName} confirmed the item handover for "${itemName}". Please confirm when you have completed it.`,
        link: `/transactions/${txId}`,
        relatedEntityType: 'Transaction',
        relatedEntityId: txId,
        relatedItem: item?._id || transaction.item,
        relatedTransaction: txId
      });
    }

    return null;
  }

  /**
   * Borrower starts return -> Notify Owner
   */
  async notifyReturnStarted({ transaction, item, actor }) {
    if (!transaction || !transaction.owner) return null;

    const itemName = item?.title || 'your borrowed item';
    const actorName = actor?.name || 'The borrower';
    const txId = transaction._id || transaction.id;

    return await this.createNotification({
      recipient: transaction.owner,
      actor: actor?._id || actor,
      type: 'RETURN_STARTED',
      category: 'TRANSACTIONS',
      title: 'Item return initiated',
      message: `${actorName} initiated the return process for "${itemName}". Coordinate to receive it back.`,
      link: `/transactions/${txId}`,
      dedupeKey: `RETURN_STARTED:${txId}`,
      relatedEntityType: 'Transaction',
      relatedEntityId: txId,
      relatedItem: item?._id || transaction.item,
      relatedTransaction: txId
    });
  }

  /**
   * Return confirmed / Transaction completed
   */
  async notifyReturnConfirmed({ transaction, item, actor, recipientId, completed }) {
    if (!transaction) return null;

    const itemName = item?.title || 'the item';
    const actorName = actor?.name || 'Your partner';
    const txId = transaction._id || transaction.id;

    if (completed) {
      const ownerId = transaction.owner?._id || transaction.owner;
      const recipientUser = transaction.recipient?._id || transaction.recipient;

      await Promise.all([
        this.createNotification({
          recipient: ownerId,
          actor: actor?._id || actor,
          type: 'TRANSACTION_COMPLETED',
          category: 'TRANSACTIONS',
          title: 'Transaction completed!',
          message: `Return confirmed and transaction completed for "${itemName}". Thank you for circular sharing!`,
          link: `/transactions/${txId}`,
          dedupeKey: `TRANSACTION_COMPLETED:${txId}:${ownerId}`,
          relatedEntityType: 'Transaction',
          relatedEntityId: txId,
          relatedItem: item?._id || transaction.item,
          relatedTransaction: txId
        }),
        this.createNotification({
          recipient: recipientUser,
          actor: actor?._id || actor,
          type: 'TRANSACTION_COMPLETED',
          category: 'TRANSACTIONS',
          title: 'Transaction completed!',
          message: `Return confirmed and transaction completed for "${itemName}". Thank you for circular sharing!`,
          link: `/transactions/${txId}`,
          dedupeKey: `TRANSACTION_COMPLETED:${txId}:${recipientUser}`,
          relatedEntityType: 'Transaction',
          relatedEntityId: txId,
          relatedItem: item?._id || transaction.item,
          relatedTransaction: txId
        })
      ]);
      return true;
    }

    if (recipientId) {
      return await this.createNotification({
        recipient: recipientId,
        actor: actor?._id || actor,
        type: 'RETURN_CONFIRMED',
        category: 'TRANSACTIONS',
        title: 'Return confirmation registered',
        message: `${actorName} confirmed item return for "${itemName}".`,
        link: `/transactions/${txId}`,
        relatedEntityType: 'Transaction',
        relatedEntityId: txId,
        relatedItem: item?._id || transaction.item,
        relatedTransaction: txId
      });
    }

    return null;
  }

  // ====================================================
  // 3. CHAT / MESSAGING NOTIFICATIONS
  // ====================================================

  /**
   * New chat message sent -> Notify the other participant
   */
  async notifyNewMessage({ conversation, message, sender, recipientId }) {
    if (!conversation || !recipientId || !sender) return null;

    // Do not notify self
    const senderId = (sender._id || sender.id || sender).toString();
    if (senderId === recipientId.toString()) return null;

    const senderName = sender.name || 'Your partner';
    const messagePreview = message.text && message.text.length > 50
      ? `${message.text.substring(0, 50)}...`
      : (message.text || 'Sent you a message');
    const convId = conversation._id || conversation.id;

    return await this.createNotification({
      recipient: recipientId,
      actor: senderId,
      type: 'NEW_MESSAGE',
      category: 'MESSAGES',
      title: `New message from ${senderName}`,
      message: messagePreview,
      link: `/messages/${convId}`,
      relatedEntityType: 'Conversation',
      relatedEntityId: convId,
      relatedConversation: convId,
      relatedItem: conversation.item || null,
      relatedTransaction: conversation.transaction || null
    });
  }

  // ====================================================
  // 4. WANTED ITEM & MATCHING NOTIFICATIONS
  // ====================================================

  /**
   * Offer submitted to a WantedItem request -> Notify Wanted requester
   */
  async notifyWantedResponse({ wantedItem, request, actor }) {
    if (!wantedItem || !wantedItem.requester) return null;

    const actorName = actor?.name || 'A community member';
    const wantedTitle = wantedItem.title || 'your wanted item';
    const wantedId = wantedItem._id || wantedItem.id;
    const reqId = request?._id || request?.id;

    return await this.createNotification({
      recipient: wantedItem.requester,
      actor: actor?._id || request?.requester,
      type: 'WANTED_RESPONSE',
      category: 'MATCHING',
      title: 'New offer on your wanted item',
      message: `${actorName} submitted an offer to help with "${wantedTitle}".`,
      link: `/wanted/${wantedId}`,
      dedupeKey: `WANTED_RESPONSE:${wantedId}:${reqId}`,
      relatedEntityType: 'WantedItem',
      relatedEntityId: wantedId,
      relatedRequest: reqId || null
    });
  }

  /**
   * Real Wanted Match Notification
   */
  async notifyWantedMatch({ requester, item, wantedItem, distanceKm, matchScore }) {
    if (!requester || !item || !wantedItem) return null;

    const itemId = item._id || item.id;
    const wantedId = wantedItem._id || wantedItem.id;
    const dedupeKey = `WANTED_MATCH:${requester}:${itemId}:${wantedId}`;

    const existing = await Notification.findOne({
      recipient: requester,
      dedupeKey,
      deletedAt: null
    });
    if (existing) {
      return existing;
    }

    const distText = distanceKm !== null && distanceKm !== undefined ? ` (~${distanceKm} km away)` : '';
    const locText = item.location?.city ? ` in ${item.location.city}` : '';

    return await this.createNotification({
      recipient: requester,
      actor: item.owner?._id || item.owner,
      type: 'WANTED_MATCH',
      category: 'MATCHING',
      title: 'Item Match Found!',
      message: `A matching "${item.title}" is available${locText}${distText} for your wanted request "${wantedItem.title}".`,
      link: `/wanted/${wantedId}`,
      dedupeKey,
      relatedEntityType: 'Item',
      relatedEntityId: itemId,
      relatedItem: itemId,
      relatedWantedItem: wantedId
    });
  }

  // ====================================================
  // 5. SECURITY & REPORT NOTIFICATIONS
  // ====================================================

  /**
   * Security Event (password change, reset, account update)
   * High priority, protected notification
   */
  async notifySecurityEvent({ userId, title, message }) {
    if (!userId) return null;

    return await this.createNotification({
      recipient: userId,
      type: 'SECURITY_ALERT',
      category: 'ACCOUNT',
      title: title || 'Security Alert',
      message: message || 'Important security activity occurred on your account.',
      link: '/profile',
      relatedEntityType: 'User',
      relatedEntityId: userId
    });
  }

  /**
   * Report Status Update Notification
   */
  async notifyReportUpdate({ userId, reportId, status, details }) {
    if (!userId) return null;

    const statusLabels = {
      RESOLVED: 'resolved',
      DISMISSED: 'dismissed',
      UNDER_REVIEW: 'under review',
      ACTION_TAKEN: 'action taken'
    };

    const label = statusLabels[status] || 'updated';

    return await this.createNotification({
      recipient: userId,
      type: 'REPORT_UPDATE',
      category: 'SAFETY',
      title: 'Safety Report Update',
      message: details || `A report regarding community safety has been ${label}.`,
      link: '/profile',
      dedupeKey: `REPORT_UPDATE:${reportId}:${status}`,
      relatedEntityType: 'User',
      relatedEntityId: userId
    });
  }

  // ====================================================
  // 6. IMPACT MILESTONE NOTIFICATIONS
  // ====================================================

  /**
   * Genuinely earned sustainability milestone notification
   */
  async notifyImpactMilestone({ userId, milestoneTitle, targetCount, milestoneKey }) {
    if (!userId || !milestoneTitle) return null;

    const dedupeKey = `IMPACT_MILESTONE:${userId}:${milestoneKey || targetCount || milestoneTitle}`;

    return await this.createNotification({
      recipient: userId,
      type: 'IMPACT_MILESTONE',
      category: 'IMPACT',
      title: 'Sustainability Milestone Earned! 🌿',
      message: `Congratulations! You unlocked the "${milestoneTitle}" milestone for your circular sharing on LOOOP.`,
      link: '/impact',
      dedupeKey,
      relatedEntityType: 'Impact',
      relatedEntityId: null
    });
  }
}

module.exports = new NotificationService();
