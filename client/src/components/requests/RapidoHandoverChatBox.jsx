import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Phone,
  Sparkles,
  Lock,
  PackageCheck,
  MessageSquare
} from 'lucide-react';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';
import { messageService } from '../../services/messageService';
import { requestService } from '../../services/requestService';
import socketService from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

/**
 * RapidoHandoverChatBox
 * Real-time, WhatsApp-style coordination chatbox for product handover.
 * Exclusively visible to the two customers (requester and owner).
 * Delivers messages instantly within seconds via Socket.IO.
 * Once the item is marked as "Taken" / Handover complete, the chatbox
 * permanently closes and wipes all conversation messages from the database.
 */
export const RapidoHandoverChatBox = ({
  request,
  onRequestUpdated
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTakenModalOpen, setIsTakenModalOpen] = useState(false);
  const [markingTaken, setMarkingTaken] = useState(false);
  const [isTaken, setIsTaken] = useState(request?.status === 'COMPLETED');

  const messagesContainerRef = useRef(null);
  const pollTimerRef = useRef(null);

  const currentUserId = String(user?.id || user?._id || '');
  const targetReqId = String(request?.id || request?._id || '');

  const ownerId = String(request?.owner?.id || request?.owner?._id || request?.owner_id || request?.owner || '');
  const requesterId = String(request?.requester?.id || request?.requester?._id || request?.requester_id || request?.requester || '');

  const isOwner = ownerId === currentUserId;
  const isRequester = requesterId === currentUserId;
  const partner = isOwner ? request?.requester : request?.owner;

  // Partner display location
  const partnerLocation = isOwner
    ? request?.location || request?.requester?.locality || request?.requester?.city || 'Customer Area'
    : request?.item?.location?.city || request?.item?.location?.locality || request?.owner?.city || 'Item Pickup Point';

  const partnerPhone = partner?.phone || request?.phone || '';

  // Scroll ONLY the inner message container, never the browser window
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Load conversation and messages
  const loadConversationAndMessages = useCallback(async () => {
    if (!targetReqId) return;
    try {
      const convRes = await messageService.getConversationByRequest(targetReqId);
      if (convRes?.isTaken || convRes?.closed) {
        setIsTaken(true);
        setConversation(null);
        setMessages([]);
        setLoading(false);
        return;
      }

      const activeConv = convRes?.conversation || convRes;
      const convId = convRes?.conversationId || activeConv?.id || activeConv?._id;

      if (convId) {
        setConversation({ ...activeConv, id: convId, _id: convId });

        // Fetch messages history
        const msgRes = await messageService.getMessages(convId);
        if (msgRes?.messages) {
          setMessages(msgRes.messages);
        }

        // Join real-time socket room
        socketService.joinConversation(convId);
      }
    } catch (err) {
      console.warn('[HandoverChat] Failed to load conversation:', err.message);
    } finally {
      setLoading(false);
    }
  }, [targetReqId]);

  useEffect(() => {
    if (request?.status === 'COMPLETED') {
      setIsTaken(true);
      setLoading(false);
      return;
    }

    loadConversationAndMessages();

    // Listen for real-time messages & item taken events via Socket
    const handleNewMessage = (payload) => {
      const msg = payload?.message || payload;
      if (!msg) return;
      setMessages((prev) => {
        const msgId = msg.id || msg._id;
        // Avoid duplicate if optimistic message already exists
        const exists = prev.some((m) => (m.id || m._id) === msgId || (m.isOptimistic && m.text === msg.text));
        if (exists) {
          return prev.map((m) => (m.isOptimistic && m.text === msg.text ? msg : m));
        }
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 50);
    };

    const handleItemTaken = () => {
      setIsTaken(true);
      setMessages([]);
      setConversation(null);
      addToast({
        title: 'Item Handover Complete!',
        message: 'The item was marked as taken. This chat has been permanently closed and deleted from the database.',
        variant: 'info'
      });
      if (onRequestUpdated) onRequestUpdated();
    };

    socketService.on('new_message', handleNewMessage);
    socketService.on('item_taken', handleItemTaken);
    socketService.on('chat_closed_item_taken', handleItemTaken);

    // Fast polling fallback (every 3 seconds) for WhatsApp-fast reliability
    const convId = conversation?.id || conversation?._id;
    pollTimerRef.current = setInterval(() => {
      const activeId = conversation?.id || conversation?._id;
      if (activeId && !isTaken) {
        messageService.getMessages(activeId).then((res) => {
          if (res?.messages && res.messages.length > 0) {
            setMessages((prev) => {
              if (prev.length === res.messages.length) {
                const lastPrev = prev[prev.length - 1];
                const lastNew = res.messages[res.messages.length - 1];
                if ((lastPrev?.id || lastPrev?._id) === (lastNew?.id || lastNew?._id)) {
                  return prev;
                }
              }
              return res.messages;
            });
          }
        }).catch(() => {});
      }
    }, 3000);

    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('item_taken', handleItemTaken);
      socketService.off('chat_closed_item_taken', handleItemTaken);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (convId) socketService.leaveConversation(convId);
    };
  }, [targetReqId, request?.status, conversation?.id, conversation?._id, isTaken, loadConversationAndMessages, addToast, onRequestUpdated]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Send Message (Optimistic UI - Instant 0-second display)
  const handleSendMessage = async (textToSend) => {
    const content = (textToSend || text).trim();
    const convId = conversation?.id || conversation?._id;
    if (!content || !convId || sending) return;

    setSending(true);
    setText('');

    // Instant optimistic message bubble
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      _id: tempId,
      conversation: convId,
      sender: {
        id: currentUserId,
        _id: currentUserId,
        name: user?.name || 'You',
        avatar: user?.avatar || ''
      },
      text: content,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 30);

    try {
      const res = await messageService.sendMessage(convId, content);
      if (res?.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.message : m))
        );
      }
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      addToast({
        title: 'Failed to Send',
        message: err.response?.data?.message || err.message || 'Could not send message. Please try again.',
        variant: 'error'
      });
      setText(content);
    } finally {
      setSending(false);
    }
  };

  // Quick WhatsApp pickup coordination chips
  const quickChips = [
    "📍 I'm at the pickup location",
    "⏰ Will reach in 10 minutes",
    "👋 Can you share the exact landmark?",
    "📦 The item is ready for handover",
    "🤝 Ready to meet right now"
  ];

  // Handle Mark Item as Taken (Permanently wipes chat from DB)
  const handleConfirmMarkTaken = async () => {
    setMarkingTaken(true);
    try {
      const res = await requestService.markItemTaken(targetReqId);
      if (res && res.success) {
        setIsTaken(true);
        setIsTakenModalOpen(false);
        setMessages([]);
        setConversation(null);

        addToast({
          title: 'Item Handover Complete!',
          message: 'The item was marked as taken. This chat has been permanently closed and wiped from the database for your privacy.',
          variant: 'success'
        });

        if (onRequestUpdated) onRequestUpdated();
      } else {
        throw new Error(res?.message || 'Failed to mark item as taken.');
      }
    } catch (err) {
      addToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Unable to mark item as taken.',
        variant: 'error'
      });
    } finally {
      setMarkingTaken(false);
    }
  };

  // ====================================================
  // 1. COMPLETED / ITEM TAKEN STATE (Chat is closed & deleted)
  // ====================================================
  if (isTaken || request?.status === 'COMPLETED') {
    return (
      <div
        id="chat"
        style={{
          border: '1.5px solid #a7f3d0',
          backgroundColor: '#f0fdf4',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#dcfce7',
            color: '#15803d',
            marginBottom: '12px'
          }}
        >
          <PackageCheck size={28} />
        </div>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#166534' }}>
          Item Handover Concluded (Item Taken)
        </h4>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.875rem', color: '#15803d', lineHeight: 1.5 }}>
          This item has been successfully received. All chat coordination messages have been permanently deleted from the database for your privacy.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#dcfce7',
            padding: '6px 14px',
            borderRadius: '999px',
            border: '1px solid #bbf7d0',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#065f46'
          }}
        >
          <Lock size={14} />
          <span>Chat securely closed & database records purged</span>
        </div>
      </div>
    );
  }

  // ====================================================
  // 2. ACTIVE WHATSAPP-STYLE HANDOVER CHATBOX
  // ====================================================
  return (
    <>
      <div
        id="chat"
        style={{
          border: '1.5px solid #059669',
          borderRadius: '18px',
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 24px rgba(5, 150, 105, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '620px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box'
        }}
      >
        {/* Top Header - WhatsApp Green Theme */}
        <div
          style={{
            backgroundColor: '#075E54', // WhatsApp Deep Green
            color: '#ffffff',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderBottom: '2px solid #004D40',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar
              src={partner?.avatar}
              name={partner?.name || 'Partner'}
              size="md"
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  {partner?.name || 'Community Member'}
                </span>
                <span
                  style={{
                    backgroundColor: '#25D366',
                    color: '#075E54',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  {isOwner ? 'Requester' : 'Owner'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#A7F3D0', marginTop: '2px' }}>
                <MapPin size={13} />
                <span>{partnerLocation}</span>
                {partnerPhone && (
                  <>
                    <span style={{ margin: '0 4px', opacity: 0.6 }}>•</span>
                    <Phone size={12} />
                    <span>{partnerPhone}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Mark Taken CTA in Header */}
          <button
            type="button"
            onClick={() => setIsTakenModalOpen(true)}
            style={{
              backgroundColor: '#25D366',
              color: '#075E54',
              border: 'none',
              borderRadius: '10px',
              padding: '7px 14px',
              fontSize: '0.78rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              transition: 'transform 0.15s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <CheckCircle2 size={15} />
            <span>Product Received</span>
          </button>
        </div>

        {/* Ephemeral Privacy Warning Pill */}
        <div
          style={{
            backgroundColor: '#DCF8C6',
            padding: '7px 14px',
            fontSize: '0.75rem',
            color: '#075E54',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            borderBottom: '1px solid #C8E6C9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={13} />
            <span>
              <strong>Private Coordination Chat:</strong> Messages are visible only to you and {partner?.name || 'the other member'}.
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#1B5E20', fontWeight: 700 }}>
            ⚡ Purged upon handover
          </span>
        </div>

        {/* Messages Scroll Area - Scroll is strictly confined to this container */}
        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '360px',
            padding: '16px',
            backgroundColor: '#ECE5DD', // WhatsApp chat wallpaper background
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            minHeight: '260px'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Spinner size="md" />
              <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>Connecting to chat...</p>
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                padding: '14px 18px',
                borderRadius: '12px',
                margin: 'auto',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                maxWidth: '380px'
              }}
            >
              <div style={{ color: '#059669', marginBottom: '6px' }}>
                <Sparkles size={22} style={{ display: 'inline-block' }} />
              </div>
              <h5 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>
                Coordination Chat Ready!
              </h5>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                Send a quick message or tap the chips below to agree on the pickup time and exact spot.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const senderId = String(m.sender?.id || m.sender?._id || m.sender_id || m.sender || '');
              const isMine = senderId === currentUserId;
              const timeStr = m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={m.id || m._id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMine ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    alignSelf: isMine ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      backgroundColor: isMine ? '#DCF8C6' : '#ffffff', // WhatsApp green bubble for sender
                      color: '#111827',
                      padding: '8px 12px',
                      borderRadius: isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      fontSize: '0.875rem',
                      lineHeight: 1.45,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      wordBreak: 'break-word'
                    }}
                  >
                    {m.text}
                  </div>
                  {timeStr && (
                    <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', padding: '0 4px' }}>
                      {timeStr} {isMine && '✓✓'}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none'
          }}
        >
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={sending}
              onClick={() => handleSendMessage(chip)}
              style={{
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '999px',
                padding: '4px 10px',
                fontSize: '0.725rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#ecfdf5';
                e.currentTarget.style.borderColor = '#a7f3d0';
                e.currentTarget.style.color = '#047857';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.color = '#334155';
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Message Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            padding: '10px 14px',
            backgroundColor: '#f0f2f5',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message (sends instantly)..."
            disabled={sending}
            maxLength={1000}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 14px',
              borderRadius: '24px',
              border: '1.5px solid #cbd5e1',
              fontSize: '0.875rem',
              color: '#0f172a',
              outline: 'none',
              backgroundColor: '#ffffff',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => (e.target.style.borderColor = '#075E54')}
            onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            style={{
              backgroundColor: text.trim() ? '#075E54' : '#94a3b8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              flexShrink: 0,
              transition: 'background-color 0.15s ease'
            }}
          >
            {sending ? <Spinner size="sm" /> : <Send size={18} />}
          </button>
        </form>

        {/* Bottom Taken Bar */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Handover done? Click below to delete chat & conclude.
          </div>
          <Button
            variant="primary"
            size="sm"
            iconLeft={CheckCircle2}
            onClick={() => setIsTakenModalOpen(true)}
            style={{ fontSize: '0.78rem', padding: '6px 14px', backgroundColor: '#059669', flexShrink: 0 }}
          >
            Mark as Taken
          </Button>
        </div>
      </div>

      {/* Confirmation Modal: Mark as Taken & Permanently Delete Chat */}
      <Modal
        isOpen={isTakenModalOpen}
        onClose={() => !markingTaken && setIsTakenModalOpen(false)}
        title="Confirm Item Handover"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '14px',
              borderRadius: '12px',
              marginBottom: '1rem'
            }}
          >
            <Trash2 size={24} color="#dc2626" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', color: '#991b1b', lineHeight: 1.45 }}>
              <strong>Permanent Privacy Notice:</strong> Marking this item as taken will conclude the handover and <strong>permanently delete all chat messages from the database</strong>. This action cannot be undone.
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#334155', margin: '0 0 1.25rem 0', lineHeight: 1.5 }}>
            Have you met {partner?.name || 'the member'} and completed the physical handover of <strong>"{request?.item?.title || 'the item'}"</strong>?
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button
              variant="outline"
              disabled={markingTaken}
              onClick={() => setIsTakenModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              iconLeft={CheckCircle2}
              loading={markingTaken}
              onClick={handleConfirmMarkTaken}
            >
              Yes, Item Taken (Delete Chat)
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RapidoHandoverChatBox;
