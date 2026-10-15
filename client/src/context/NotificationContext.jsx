import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from '../hooks/useToast';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // User notification preferences
  const [preferences, setPreferences] = useState(null);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  // Fetch unread count from authoritative backend API
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationService.getUnreadCount();
      const count = typeof res?.count === 'number' ? res.count : (typeof res?.unreadCount === 'number' ? res.unreadCount : 0);
      setUnreadCount(count);
    } catch (err) {
      console.error('[NotificationContext] Failed to fetch unread count:', err.message);
    }
  }, [isAuthenticated]);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated) {
      setPreferences(null);
      return;
    }
    setLoadingPreferences(true);
    try {
      const res = await notificationService.getPreferences();
      if (res && res.preferences) {
        setPreferences(res.preferences);
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to fetch preferences:', err.message);
    } finally {
      setLoadingPreferences(false);
    }
  }, [isAuthenticated]);

  // Update user preferences
  const updatePreferences = useCallback(async (updatedPrefs) => {
    try {
      const res = await notificationService.updatePreferences(updatedPrefs);
      if (res && res.preferences) {
        setPreferences(res.preferences);
        addToast({
          title: 'Preferences Updated',
          message: 'Your notification preferences have been saved.',
          variant: 'success'
        });
        return res.preferences;
      }
    } catch (err) {
      console.error('[NotificationContext] Failed to update preferences:', err.message);
      addToast({
        title: 'Update Failed',
        message: err?.response?.data?.message || 'Unable to update preferences. Please try again.',
        variant: 'danger'
      });
      throw err;
    }
  }, [addToast]);

  // Fetch paginated notifications with optional filters
  const fetchNotifications = useCallback(async (params = {}) => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await notificationService.getNotifications(params);
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setPagination({
          page: res.page || 1,
          totalPages: res.totalPages || 1,
          total: res.total || res.notifications.length,
          limit: res.limit || 20
        });
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Notifications could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await notificationService.markAsRead(id);
      if (res && res.notification) {
        setNotifications((prev) =>
          prev.map((notif) =>
            (notif._id === id || notif.id === id)
              ? { ...notif, isRead: true, readAt: res.notification.readAt }
              : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[NotificationContext] Error marking as read:', err.message);
      addToast({
        title: 'Error',
        message: 'Unable to update this notification.',
        variant: 'danger'
      });
    }
  }, [addToast]);

  // Mark all unread notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      addToast({
        title: 'All Read',
        message: 'All notifications marked as read.',
        variant: 'info'
      });
    } catch (err) {
      console.error('[NotificationContext] Error marking all read:', err.message);
      addToast({
        title: 'Error',
        message: 'Failed to mark all as read. Please try again.',
        variant: 'danger'
      });
    }
  }, [addToast]);

  // Dismiss / delete notification
  const deleteNotification = useCallback(async (id) => {
    if (!id) return;
    try {
      // Find notification to see if it was unread
      const target = notifications.find((n) => n._id === id || n.id === id);
      await notificationService.deleteNotification(id);

      setNotifications((prev) => prev.filter((n) => n._id !== id && n.id !== id));
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      addToast({
        title: 'Dismissed',
        message: 'Notification removed.',
        variant: 'info',
        duration: 3000
      });
    } catch (err) {
      console.error('[NotificationContext] Error dismissing notification:', err.message);
      addToast({
        title: 'Cannot Dismiss',
        message: err?.response?.data?.message || 'Unable to dismiss this notification.',
        variant: 'danger'
      });
    }
  }, [notifications, addToast]);

  // Handle incoming real-time notification
  const handleRealtimeNotification = useCallback((payload) => {
    const notification = payload?.notification || payload;
    const quietHoursSuppressed = !!payload?.quietHoursSuppressed;

    if (!notification || (!notification._id && !notification.id)) return;
    const notifId = notification._id || notification.id;

    // Prepend to notifications list avoiding duplicates
    setNotifications((prev) => {
      const exists = prev.some((n) => (n._id || n.id) === notifId);
      if (exists) return prev;
      return [notification, ...prev];
    });

    // Increment unread count
    setUnreadCount((prev) => prev + 1);

    // Suppress redundant toast if user is currently inside the active conversation
    const isCurrentChat =
      notification.type === 'NEW_MESSAGE' &&
      notification.relatedEntityId &&
      location.pathname.includes(notification.relatedEntityId.toString());

    if (isCurrentChat) {
      return;
    }

    // Skip toast if quiet hours suppressed (non-security events)
    if (quietHoursSuppressed && notification.category !== 'ACCOUNT') {
      return;
    }

    // Show lightweight in-app toast
    addToast({
      title: notification.title || 'New Notification',
      message: notification.message || 'You have a new update in LOOOP.',
      variant: notification.category === 'ACCOUNT' ? 'danger' : 'info',
      duration: 5000,
      action: notification.link
        ? {
            label: 'View',
            onClick: () => navigate(notification.link)
          }
        : undefined
    });

    // Native Browser Notification (if permission granted and user enabled)
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      preferences?.browser
    ) {
      try {
        const nativeNotif = new window.Notification(notification.title || 'LOOOP', {
          body: notification.message,
          icon: '/favicon.ico'
        });
        if (notification.link) {
          nativeNotif.onclick = () => {
            window.focus();
            navigate(notification.link);
          };
        }
      } catch (browserErr) {
        console.warn('Native notification failed:', browserErr);
      }
    }
  }, [location.pathname, navigate, addToast, preferences?.browser]);

  // Listen to Socket.IO real-time notification events
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const onNewNotification = (data) => {
      if (data) {
        handleRealtimeNotification(data);
      }
    };

    const onCountUpdated = () => {
      fetchUnreadCount();
    };

    socket.on('new_notification', onNewNotification);
    socket.on('notification_count_updated', onCountUpdated);

    return () => {
      socket.off('new_notification', onNewNotification);
      socket.off('notification_count_updated', onCountUpdated);
    };
  }, [socket, isAuthenticated, handleRealtimeNotification, fetchUnreadCount]);

  // Sync state on user login / logout + periodic polling fallback
  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      fetchPreferences();

      // Reliable 15-second polling ensures user never misses a notification even without WebSockets
      const interval = setInterval(() => {
        fetchUnreadCount();
      }, 15000);

      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setPreferences(null);
    }
  }, [isAuthenticated, user, fetchUnreadCount, fetchPreferences]);

  const value = {
    notifications,
    unreadCount,
    pagination,
    loading,
    error,
    preferences,
    loadingPreferences,
    fetchNotifications,
    fetchUnreadCount,
    fetchPreferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    handleRealtimeNotification
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
