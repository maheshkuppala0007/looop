import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Inbox,
  Send,
  Check,
  X,
  Clock,
  Calendar,
  Package,
  ArrowRight,
  Eye,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Repeat,
  ShieldCheck,
  Ban,
  MessageSquare
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import Tabs from '../../components/common/Tabs';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import RequestStatusBadge from '../../components/requests/RequestStatusBadge';
import { requestService } from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

export const RequestsPage = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: 'my' (My Requests) or 'received' (Offers I Received)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'offers' || tabParam === 'received' ? 'received' : 'my'
  );

  const [myRequests, setMyRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [myRes, receivedRes] = await Promise.all([
        requestService.getMyRequests(),
        requestService.getReceivedRequests()
      ]);

      setMyRequests(myRes?.requests || []);
      setReceivedRequests(receivedRes?.requests || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError(err.response?.data?.message || err.message || 'Unable to load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams(newTab === 'received' ? { tab: 'offers' } : { tab: 'my' });
  };

  // Accept a received request
  const handleAccept = async (reqId) => {
    if (actionLoadingId) return;
    setActionLoadingId(reqId);
    try {
      const res = await requestService.acceptRequest(reqId);
      if (res && res.success) {
        addToast({
          title: 'Request Accepted!',
          message: 'You have accepted the request. Safe handover coordination is now unlocked.',
          variant: 'success'
        });
        // Update local list
        setReceivedRequests((prev) =>
          prev.map((r) => ((r.id || r._id) === reqId ? { ...r, status: 'ACCEPTED' } : r))
        );
      } else {
        throw new Error(res?.message || 'Could not accept request.');
      }
    } catch (err) {
      console.error('Accept error:', err);
      addToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Unable to accept request.',
        variant: 'error'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline a received request
  const handleDecline = async (reqId) => {
    if (actionLoadingId) return;
    if (!window.confirm('Are you sure you want to decline this request?')) {
      return;
    }
    setActionLoadingId(reqId);
    try {
      const res = await requestService.declineRequest(reqId);
      if (res && res.success) {
        addToast({
          title: 'Request Declined',
          message: 'The requester has been notified respectfully.',
          variant: 'info'
        });
        setReceivedRequests((prev) =>
          prev.map((r) => ((r.id || r._id) === reqId ? { ...r, status: 'DECLINED' } : r))
        );
      } else {
        throw new Error(res?.message || 'Could not decline request.');
      }
    } catch (err) {
      console.error('Decline error:', err);
      addToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Unable to decline request.',
        variant: 'error'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel an outgoing pending request
  const handleCancel = async (reqId) => {
    if (actionLoadingId) return;
    if (!window.confirm('Are you sure you want to cancel your request?')) {
      return;
    }
    setActionLoadingId(reqId);
    try {
      const res = await requestService.cancelRequest(reqId);
      if (res && res.success) {
        addToast({
          title: 'Request Cancelled',
          message: 'Your request has been cancelled.',
          variant: 'info'
        });
        setMyRequests((prev) =>
          prev.map((r) => ((r.id || r._id) === reqId ? { ...r, status: 'CANCELLED' } : r))
        );
      } else {
        throw new Error(res?.message || 'Could not cancel request.');
      }
    } catch (err) {
      console.error('Cancel error:', err);
      addToast({
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Unable to cancel request.',
        variant: 'error'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'BORROW':
        return 'Borrow Request';
      case 'EXCHANGE':
        return 'Exchange Request';
      case 'OFFER':
        return 'Wanted Item Offer';
      case 'REQUEST_ITEM':
      default:
        return 'Item Request';
    }
  };

  const pendingReceivedCount = receivedRequests.filter((r) => r.status === 'PENDING').length;
  const activeMyCount = myRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
              fontWeight: 900,
              color: 'var(--color-slate-900)',
              margin: '0 0 0.5rem 0',
              letterSpacing: '-0.02em'
            }}
          >
            Requests & Offers
          </h1>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.95rem', margin: 0 }}>
            Track items you have requested from neighbors and manage incoming offers on your listings.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          iconLeft={RefreshCw}
          onClick={loadRequests}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={handleTabChange}
        tabs={[
          {
            id: 'my',
            label: 'My Requests',
            count: activeMyCount > 0 ? activeMyCount : undefined,
            icon: Send
          },
          {
            id: 'received',
            label: 'Offers I Received',
            count: pendingReceivedCount > 0 ? pendingReceivedCount : undefined,
            icon: Inbox
          }
        ]}
        style={{ marginBottom: '1.75rem' }}
      />

      {/* Error Banner */}
      {error && (
        <Card
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-danger-bg, #fef2f2)',
            border: '1px solid var(--color-danger-border, #fecaca)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '0.9rem' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={loadRequests}>
            Try Again
          </Button>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Spinner size="lg" />
          <span style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)' }}>
            Loading requests from database...
          </span>
        </div>
      ) : activeTab === 'my' ? (
        /* ==================================================== */
        /* TAB 1: MY REQUESTS (SENT)                            */
        /* ==================================================== */
        myRequests.length === 0 ? (
          <EmptyState
            icon={Send}
            title="You haven't sent any requests yet"
            description="Explore items shared by neighbors in your community. You can request free items, ask to borrow tools, or propose an exchange."
            actionLabel="Browse Available Items"
            onAction={() => navigate('/browse')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {myRequests.map((req) => {
              const reqId = req.id || req._id;
              const isPending = req.status === 'PENDING';
              const targetItem = req.item || req.wantedItem;
              const itemTitle = targetItem?.title || 'Shared Item';
              const itemImg = Array.isArray(targetItem?.images) && targetItem.images.length > 0
                ? (typeof targetItem.images[0] === 'string' ? targetItem.images[0] : targetItem.images[0]?.url)
                : null;
              const ownerName = req.owner?.name || 'Owner';
              const isBorrow = req.type === 'BORROW' || req.expectedReturnDate;
              const isExchange = req.type === 'EXCHANGE' || req.offeredItem;

              return (
                <Card key={reqId} style={{ padding: '1.5rem', transition: 'box-shadow 0.2s ease' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '1rem',
                      borderBottom: '1px solid var(--color-slate-100)',
                      paddingBottom: '1rem'
                    }}
                  >
                    {/* Item and Target Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                      {itemImg ? (
                        <img
                          src={itemImg}
                          alt={itemTitle}
                          style={{
                            width: '56px',
                            height: '56px',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-slate-200)',
                            flexShrink: 0
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-primary-50)',
                            color: 'var(--color-primary-700)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Package size={26} />
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--color-primary-700)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em'
                            }}
                          >
                            {getTypeLabel(req.type)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>•</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                            Sent {formatDate(req.createdAt)}
                          </span>
                        </div>

                        <h3
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: 'var(--color-slate-900)',
                            margin: '0 0 2px 0'
                          }}
                        >
                          {itemTitle}
                        </h3>

                        <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)' }}>
                          Owner: <strong>{ownerName}</strong>
                          {req.owner?.trustScore && ` (${req.owner.trustScore}% Trust)`}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <RequestStatusBadge status={req.status} />
                    </div>
                  </div>

                  {/* Message / Details Body */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--color-slate-200)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      fontSize: '0.9rem',
                      color: 'var(--color-slate-700)',
                      lineHeight: 1.5,
                      marginBottom: '1.25rem'
                    }}
                  >
                    {req.message ? (
                      <div>
                        <strong style={{ color: 'var(--color-slate-800)' }}>Your Note:</strong>{' '}
                        <span>"{req.message}"</span>
                      </div>
                    ) : (
                      <em style={{ color: 'var(--color-slate-500)' }}>No message included</em>
                    )}

                    {/* Borrow Expected Return Date */}
                    {isBorrow && req.expectedReturnDate && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--color-primary-800)',
                          fontSize: '0.825rem',
                          fontWeight: 600
                        }}
                      >
                        <Calendar size={14} />
                        <span>Expected Return: {new Date(req.expectedReturnDate).toLocaleDateString()}</span>
                      </div>
                    )}

                    {/* Exchange Offered Item */}
                    {isExchange && req.offeredItem && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#065f46',
                          fontSize: '0.825rem',
                          fontWeight: 600
                        }}
                      >
                        <Repeat size={14} />
                        <span>Offered in exchange: {req.offeredItem.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <Link
                      to={`/requests/${reqId}`}
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--color-primary-700)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>View Details</span>
                      <ArrowRight size={14} />
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {req.item && (
                        <Link
                          to={`/items/${req.item.id || req.item._id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Button variant="outline" size="sm" iconLeft={Eye}>
                            View Item
                          </Button>
                        </Link>
                      )}

                      {req.status === 'ACCEPTED' && (
                        <Link
                          to={`/requests/${reqId}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Button
                            variant="primary"
                            size="sm"
                            iconLeft={MessageSquare}
                            style={{
                              backgroundColor: '#059669',
                              borderColor: '#059669',
                              fontWeight: 700,
                              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                            }}
                          >
                            Chat with {ownerName || 'Owner'}
                          </Button>
                        </Link>
                      )}

                      {isPending && (
                        <Button
                          variant="secondary"
                          size="sm"
                          iconLeft={Ban}
                          loading={actionLoadingId === reqId}
                          disabled={actionLoadingId === reqId}
                          onClick={() => handleCancel(reqId)}
                        >
                          Cancel Request
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        /* ==================================================== */
        /* TAB 2: OFFERS I RECEIVED                             */
        /* ==================================================== */
        receivedRequests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No requests or offers received yet"
            description="When neighbors request to borrow, receive, or exchange your shared items, or offer items for your wanted requests, they will show up here."
            actionLabel="Share an Item"
            onAction={() => navigate('/share')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {receivedRequests.map((req) => {
              const reqId = req.id || req._id;
              const isPending = req.status === 'PENDING';
              const targetItem = req.item || req.wantedItem;
              const itemTitle = targetItem?.title || 'Your Listing';
              const requester = req.requester || { name: 'Community Member' };
              const isBorrow = req.type === 'BORROW' || req.expectedReturnDate;
              const isExchange = req.type === 'EXCHANGE' || req.offeredItem;

              return (
                <Card key={reqId} style={{ padding: '1.5rem', transition: 'box-shadow 0.2s ease' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '1rem',
                      borderBottom: '1px solid var(--color-slate-100)',
                      paddingBottom: '1rem'
                    }}
                  >
                    {/* Requester Profile Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '260px' }}>
                      <Avatar
                        src={requester.avatar}
                        name={requester.name}
                        size="md"
                      />

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--color-primary-700)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em'
                            }}
                          >
                            {getTypeLabel(req.type)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>•</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                            Received {formatDate(req.createdAt)}
                          </span>
                        </div>

                        <h3
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: 'var(--color-slate-900)',
                            margin: '0 0 2px 0'
                          }}
                        >
                          {requester.name}
                        </h3>

                        <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)' }}>
                          For item: <strong>{itemTitle}</strong>
                          {requester.trustScore && ` • ${requester.trustScore}% Trust`}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <RequestStatusBadge status={req.status} />
                    </div>
                  </div>

                  {/* Message & Offer Details */}
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--color-slate-200)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      fontSize: '0.9rem',
                      color: 'var(--color-slate-700)',
                      lineHeight: 1.5,
                      marginBottom: '1.25rem'
                    }}
                  >
                    {req.message ? (
                      <div>
                        <strong style={{ color: 'var(--color-slate-800)' }}>Requester Message:</strong>{' '}
                        <span>"{req.message}"</span>
                      </div>
                    ) : (
                      <em style={{ color: 'var(--color-slate-500)' }}>No message included</em>
                    )}

                    {/* Borrow Expected Return Date */}
                    {isBorrow && req.expectedReturnDate && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--color-primary-800)',
                          fontSize: '0.825rem',
                          fontWeight: 600
                        }}
                      >
                        <Calendar size={14} />
                        <span>Expected Return Date: {new Date(req.expectedReturnDate).toLocaleDateString()}</span>
                      </div>
                    )}

                    {/* Exchange or Wanted Offered Item */}
                    {req.offeredItem && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                      >
                        <Repeat size={16} color="#065f46" />
                        <div style={{ fontSize: '0.85rem', color: '#064e3b' }}>
                          <strong>Item Offered:</strong> {req.offeredItem.title}{' '}
                          {req.offeredItem.condition && `(Condition: ${req.offeredItem.condition})`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <Link
                      to={`/requests/${reqId}`}
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--color-primary-700)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>View Full Details</span>
                      <ArrowRight size={14} />
                    </Link>

                    {isPending ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          iconLeft={X}
                          loading={actionLoadingId === reqId}
                          disabled={actionLoadingId === reqId}
                          onClick={() => handleDecline(reqId)}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          iconLeft={Check}
                          loading={actionLoadingId === reqId}
                          disabled={actionLoadingId === reqId}
                          onClick={() => handleAccept(reqId)}
                        >
                          Accept
                        </Button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {req.status === 'ACCEPTED' && (
                          <Link
                            to={`/requests/${reqId}`}
                            style={{ textDecoration: 'none' }}
                          >
                            <Button
                              variant="primary"
                              size="sm"
                              iconLeft={MessageSquare}
                              style={{
                                backgroundColor: '#059669',
                                borderColor: '#059669',
                                fontWeight: 700,
                                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                              }}
                            >
                              Chat with {requester.name || 'Requester'}
                            </Button>
                          </Link>
                        )}
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', fontStyle: 'italic' }}>
                          Processed ({req.status.toLowerCase()})
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

export default RequestsPage;
