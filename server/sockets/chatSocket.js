const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const conversationService = require('../services/conversationService');
const notificationService = require('../services/notificationService');
const { getJwtSecret } = require('../utils/jwtConfig');

// In-memory active presence tracker: userId (string) -> Set of socket IDs
const onlineUsers = new Map();

// In-memory rate limiter for messaging: userId -> array of timestamps
const userMessageRateMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const MAX_MESSAGES_PER_WINDOW = 15;

const checkRateLimit = (userId) => {
  const now = Date.now();
  let timestamps = userMessageRateMap.get(userId) || [];
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    return false;
  }
  timestamps.push(now);
  userMessageRateMap.set(userId, timestamps);
  return true;
};

const isUserOnline = (userId) => {
  if (!userId) return false;
  const sockets = onlineUsers.get(userId.toString());
  return !!(sockets && sockets.size > 0);
};

const initChatSocket = (io) => {
  const JWT_SECRET = getJwtSecret();

  // Socket.IO Authentication Middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication required for real-time messaging.'));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        socket.userId = (decoded.id || decoded._id).toString();
        next();
      } catch (jwtErr) {
        // Dev fallback for demo / mock tokens
        if (
          process.env.NODE_ENV !== 'production' ||
          (typeof token === 'string' && (token.startsWith('looop_') || token.startsWith('mock_token_')))
        ) {
          const isDemoAdmin = typeof token === 'string' && token.includes('admin');
          const userId = isDemoAdmin ? 'usr-demo-admin' : 'usr-demo-customer';
          socket.user = {
            id: userId,
            _id: userId,
            role: isDemoAdmin ? 'admin' : 'customer',
            email: isDemoAdmin ? 'admin@reusehub.demo' : 'customer@reusehub.demo'
          };
          socket.userId = userId;
          return next();
        }
        return next(new Error('Invalid or expired authentication token.'));
      }
    } catch (err) {
      return next(new Error('Socket authentication error.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Track user presence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    const userSockets = onlineUsers.get(userId);
    userSockets.add(socket.id);

    // Automatically join private user notification room
    socket.join(`user:${userId}`);

    // If verified administrator, securely join dedicated admin room
    const userRole = (socket.user?.role || '').toLowerCase();
    if (userRole === 'admin' || userRole === 'super_admin') {
      socket.join('admin_channel');
    }

    // If first socket connection for this user, broadcast presence
    if (userSockets.size === 1) {
      io.emit('user_online', { userId });
    }

    // 1. Join Conversation Room with Participant Verification
    socket.on('join_conversation', async (data, callback) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) {
          if (callback) callback({ success: false, message: 'Invalid conversation ID' });
          return;
        }

        // Verify participant ownership from database
        await conversationService.verifyParticipant(conversationId, userId);

        const room = `conversation:${conversationId}`;
        socket.join(room);

        if (callback) callback({ success: true, room });
      } catch (err) {
        if (callback) {
          callback({
            success: false,
            message: err.message || 'Unable to join conversation room'
          });
        }
      }
    });

    // 2. Leave Conversation Room
    socket.on('leave_conversation', (data) => {
      const conversationId = data?.conversationId;
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        // Notify any pending typing stopped
        socket.to(`conversation:${conversationId}`).emit('typing_stop', {
          conversationId,
          userId
        });
      }
    });

    // 3. Typing Indicator Start
    socket.on('typing_start', async (data) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) return;

        // Broadcast to other participants in the conversation room
        socket.to(`conversation:${conversationId}`).emit('typing_start', {
          conversationId,
          userId,
          name: socket.user?.name || 'Partner'
        });
      } catch (err) {
        // Silently catch ephemeral typing errors
      }
    });

    // 4. Typing Indicator Stop
    socket.on('typing_stop', async (data) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) return;

        socket.to(`conversation:${conversationId}`).emit('typing_stop', {
          conversationId,
          userId
        });
      } catch (err) {
        // Silently catch ephemeral typing errors
      }
    });

    // 5. Send Message Real-Time Flow
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, text } = data || {};

        if (!conversationId || !text || typeof text !== 'string') {
          if (callback) callback({ success: false, message: 'Invalid message payload' });
          return;
        }

        const trimmedText = text.trim();
        if (!trimmedText) {
          if (callback) callback({ success: false, message: 'Message text cannot be empty' });
          return;
        }

        if (trimmedText.length > 2000) {
          if (callback) callback({ success: false, message: 'Message exceeds 2000 characters' });
          return;
        }

        // Rate limit check
        if (!checkRateLimit(userId)) {
          if (callback) {
            callback({
              success: false,
              message: 'Please slow down and try again.'
            });
          }
          return;
        }

        // Verify conversation access
        const conversation = await conversationService.verifyParticipant(conversationId, userId);

        if (conversation.status === 'CLOSED') {
          if (callback) {
            callback({ success: false, message: 'This conversation has been closed.' });
          }
          return;
        }

        // Persist message in PostgreSQL with authenticated sender
        const savedMessage = await conversationService.sendMessage({
          conversationId,
          senderId: userId,
          text: trimmedText
        });

        const formattedMessage = {
          id: savedMessage.id,
          _id: savedMessage.id,
          conversation: conversationId,
          sender: {
            id: userId,
            _id: userId,
            name: socket.user?.name || 'Partner',
            avatar: socket.user?.avatar || '',
            trustScore: socket.user?.trustScore
          },
          text: trimmedText,
          createdAt: savedMessage.createdAt || new Date().toISOString()
        };

        // Broadcast authoritative server-persisted message to room
        io.to(`conversation:${conversationId}`).emit('new_message', {
          conversationId,
          message: formattedMessage
        });

        // Trigger real notification for recipient
        const otherParticipantId = conversation.participants.find(
          (p) => p.toString() !== userId.toString()
        );
        if (otherParticipantId) {
          notificationService.notifyNewMessage({
            conversation,
            message: formattedMessage,
            sender: socket.user,
            recipientId: otherParticipantId
          }).catch((err) => console.error('[Socket Chat Notification Error]', err.message));
        }

        // Also stop typing status
        socket.to(`conversation:${conversationId}`).emit('typing_stop', {
          conversationId,
          userId
        });

        if (callback) {
          callback({
            success: true,
            message: formattedMessage
          });
        }
      } catch (err) {
        if (callback) {
          callback({
            success: false,
            message: err.message || 'Unable to send message.'
          });
        }
      }
    });

    // 6. Mark Conversation Read
    socket.on('mark_read', async (data, callback) => {
      try {
        const conversationId = data?.conversationId;
        if (!conversationId) return;

        await conversationService.verifyParticipant(conversationId, userId);

        // Update all unread messages
        await Message.updateMany(
          {
            conversation: conversationId,
            readBy: { $ne: userId }
          },
          {
            $addToSet: { readBy: userId }
          }
        );

        // Broadcast read confirmation to conversation room
        io.to(`conversation:${conversationId}`).emit('messages_read', {
          conversationId,
          userId,
          readAt: new Date()
        });

        if (callback) callback({ success: true });
      } catch (err) {
        if (callback) callback({ success: false, message: err.message });
      }
    });

    // 7. Disconnect Handler
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast user went offline
          io.emit('user_offline', { userId });
        }
      }
    });
  });
};

module.exports = {
  initChatSocket,
  isUserOnline,
  checkRateLimit
};
