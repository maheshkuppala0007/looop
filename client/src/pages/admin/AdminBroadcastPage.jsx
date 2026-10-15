import React, { useState, useEffect } from 'react';
import {
  Send,
  Users,
  Mail,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  FileText,
  ShieldCheck,
  Tag
} from 'lucide-react';
import contentService from '../../services/contentService';
import Spinner from '../../components/common/Spinner';

export const AdminBroadcastPage = () => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('New Platform Update');
  const [message, setMessage] = useState('');
  const [buttonText, setButtonText] = useState('Explore LOOOP Platform');
  const [buttonUrl, setButtonUrl] = useState('https://looop-main.vercel.app');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [bRes, sRes] = await Promise.all([
        contentService.getBroadcasts(),
        contentService.getSubscribers()
      ]);

      if (bRes?.success && Array.isArray(bRes.broadcasts)) {
        setBroadcasts(bRes.broadcasts);
      }
      if (sRes?.success && Array.isArray(sRes.subscribers)) {
        setSubscribers(sRes.subscribers);
      }
    } catch (err) {
      console.error('Failed to load broadcast data:', err);
      setNotification({ type: 'error', message: 'Failed to retrieve broadcast records.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      setNotification({ type: 'error', message: 'Title and update message are required.' });
      return;
    }

    try {
      setIsSending(true);
      setNotification(null);
      setConfirmModalOpen(false);

      const res = await contentService.sendBroadcast({
        title: title.trim(),
        category,
        message: message.trim(),
        buttonText: buttonText.trim(),
        buttonUrl: buttonUrl.trim()
      });

      if (res?.success) {
        setNotification({
          type: 'success',
          message: `Broadcast successfully dispatched to ${res.recipientCount || 'all'} verified subscribers and members via Brevo!`
        });
        setTitle('');
        setMessage('');
        await fetchData();
      }
    } catch (err) {
      console.error('Broadcast error:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to dispatch email broadcast.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const verifiedSubscribersCount = subscribers.filter((s) => s.verified).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1100px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
          Platform Updates & Member Broadcast
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
          Compose announcements or product news. Emails are dispatched via Brevo to all verified newsletter subscribers AND all registered customer logins.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Verified Subscribers</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>{verifiedSubscribersCount}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Confirmed via two-factor OTP</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Broadcasts Sent</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>{broadcasts.length}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Recorded in PostgreSQL database</div>
        </div>

        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Delivery Provider</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>Brevo API (Active)</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>Sender: looop.support@gmail.com</div>
        </div>
      </div>

      {notification && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${notification.type === 'error' ? '#ef4444' : '#10b981'}`,
            borderRadius: '8px',
            color: notification.type === 'error' ? '#f87171' : '#34d399',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Broadcast Composer */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Compose Platform Update
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Broadcast will be delivered directly to the inboxes of all verified subscribers and customer accounts.
            </span>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setConfirmModalOpen(true); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                Announcement Title / Subject *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Exciting New Books & Study Tools Just Shared in JP Nagar!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.925rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                Update Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.925rem',
                  boxSizing: 'border-box'
                }}
              >
                <option value="New Platform Update">New Platform Update</option>
                <option value="New Products & Goods">New Products & Goods Available</option>
                <option value="Community Milestone">Community Sustainability Milestone</option>
                <option value="Security & Guidelines">Safety, Trust & Handover Guidelines</option>
                <option value="Special Feature Release">Special Feature Release</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
              Message Body * (Supports multi-paragraph announcements)
            </label>
            <textarea
              required
              rows={6}
              placeholder="Type your platform announcement here. Detail new features, highlight recent community sharing successes, or inform members about new circular economy opportunities..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.925rem',
                lineHeight: 1.6,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                Call-to-Action Button Label
              </label>
              <input
                type="text"
                placeholder="e.g. Explore Newly Shared Items"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.925rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                Destination URL
              </label>
              <input
                type="url"
                placeholder="https://looop-main.vercel.app/browse"
                value={buttonUrl}
                onChange={(e) => setButtonUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.925rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={isSending || !title.trim() || !message.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: isSending || !title.trim() || !message.trim() ? '#475569' : '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isSending || !title.trim() || !message.trim() ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}
            >
              {isSending ? (
                <>
                  <Spinner size="sm" />
                  <span>Dispatching Emails...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Send Broadcast to All Subscribers & Members</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast History Table */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 2px 0' }}>
              Past Broadcast History
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Chronological log of sent updates and recipient metrics
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ minHeight: '20vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size="md" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
            <FileText size={32} color="#64748b" style={{ margin: '0 auto 0.75rem auto' }} />
            <h4 style={{ color: '#ffffff', margin: '0 0 0.25rem 0' }}>No broadcasts sent yet</h4>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>When you send an update above, its dispatch history and delivery report will show here.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Subject</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Recipients</th>
                  <th style={{ padding: '12px' }}>Sent By</th>
                </tr>
              </thead>
              <tbody>
                {broadcasts.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                    <td style={{ padding: '12px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {new Date(b.sent_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '12px', color: '#ffffff', fontWeight: 700 }}>
                      {b.title}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {b.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#34d399', fontWeight: 800 }}>
                      {b.recipient_count} recipients
                    </td>
                    <td style={{ padding: '12px', color: '#94a3b8' }}>
                      {b.sent_by || 'Mahesh Kuppala'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Confirm Broadcast Dispatch
              </h3>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1.25rem 0' }}>
              Are you sure you want to send this update to all <strong>verified newsletter subscribers</strong> and <strong>registered user accounts</strong>?
            </p>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px 14px', marginBottom: '1.5rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>Subject</div>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{title}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBroadcast}
                style={{
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 22px',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Yes, Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBroadcastPage;
