import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  Repeat,
  ShieldCheck,
  User,
  MessageSquare,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import Spinner from '../../components/common/Spinner';
import Skeleton from '../../components/common/Skeleton';
import RequestStatusBadge from '../../components/requests/RequestStatusBadge';
import RequestTimeline from '../../components/requests/RequestTimeline';
import RequestItemCard from '../../components/requests/RequestItemCard';
import RequestActions from '../../components/requests/RequestActions';
import RapidoHandoverChatBox from '../../components/requests/RapidoHandoverChatBox';
import { requestService } from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

export const RequestDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null); // 'accept' | 'decline' | 'cancel' | null

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestService.getRequestById(id);
      if (res && res.request) {
        setRequest(res.request);
      } else {
        throw new Error('Request record not found.');
      }
    } catch (err) {
      console.error('Failed to load request details:', err);
      const status = err.response?.status;
      if (status === 404) {
        setError('Request not found. It may have been removed or does not exist.');
      } else if (status === 403) {
        setError('You do not have permission to view this request.');
      } else {
        setError(err.response?.data?.message || err.message || "We couldn't load this request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  useEffect(() => {
    // Keep window at top when opening request details
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id]);

  // Handle Accept
  const handleAccept = async () => {
    if (loadingAction) return;
    setLoadingAction('accept');
    try {
      const res = await requestService.acceptRequest(id);
      if (res && res.success) {
        addToast({
          title: 'Request Accepted',
          message: 'You have accepted this request. Handover coordination is now unlocked.',
          variant: 'success'
        });
        setRequest(res.request);
      } else {
        throw new Error(res?.message || 'Failed to accept request.');
      }
    } catch (err) {
      addToast({
        title: 'Action Error',
        message: err.response?.data?.message || err.message || 'Unable to accept request.',
        variant: 'error'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle Decline
  const handleDecline = async () => {
    if (loadingAction) return;
    setLoadingAction('decline');
    try {
      const res = await requestService.declineRequest(id);
      if (res && res.success) {
        addToast({
          title: 'Request Declined',
          message: 'The requester has been notified that this request was declined.',
          variant: 'info'
        });
        setRequest(res.request);
      } else {
        throw new Error(res?.message || 'Failed to decline request.');
      }
    } catch (err) {
      addToast({
        title: 'Action Error',
        message: err.response?.data?.message || err.message || 'Unable to decline request.',
        variant: 'error'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle Cancel
  const handleCancel = async () => {
    if (loadingAction) return;
    setLoadingAction('cancel');
    try {
      const res = await requestService.cancelRequest(id);
      if (res && res.success) {
        addToast({
          title: 'Request Cancelled',
          message: 'Your request has been cancelled.',
          variant: 'info'
        });
        setRequest(res.request);
      } else {
        throw new Error(res?.message || 'Failed to cancel request.');
      }
    } catch (err) {
      addToast({
        title: 'Action Error',
        message: err.response?.data?.message || err.message || 'Unable to cancel request.',
        variant: 'error'
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Loading Skeleton State (Preserves page structure & avoids layout shift)
  if (loading) {
    return (
      <div style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '4rem' }}>
        {/* Breadcrumb Skeleton */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', alignItems: 'center' }}>
          <Skeleton width="70px" height="18px" />
          <Skeleton width="14px" height="14px" />
          <Skeleton width="120px" height="18px" />
        </div>

        {/* Header Skeleton */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Skeleton width="340px" height="36px" style={{ marginBottom: '8px' }} />
          <Skeleton width="220px" height="20px" />
        </div>

        {/* Two-column Layout Skeleton */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 1fr',
            gap: '1.5rem',
            alignItems: 'start'
          }}
          className="request-details-grid"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Skeleton height="80px" borderRadius="var(--radius-lg)" />
            <Skeleton height="150px" borderRadius="var(--radius-lg)" />
            <Skeleton height="140px" borderRadius="var(--radius-lg)" />
          </div>
          <div>
            <Skeleton height="260px" borderRadius="var(--radius-lg)" />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !request) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
        <Card style={{ padding: '3rem 2rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-xl)' }}>
          <AlertCircle size={48} color="var(--color-danger, #ef4444)" style={{ margin: '0 auto 1.25rem auto' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
            {error ? 'Unable to Open Request' : 'Request Not Found'}
          </h2>
          <p style={{ color: 'var(--color-slate-600)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            {error || 'The requested record could not be loaded or you may not be authorized to view it.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/requests" style={{ textDecoration: 'none' }}>
              <Button variant="primary" iconLeft={ArrowLeft}>
                Back to Requests
              </Button>
            </Link>
            <Button variant="outline" iconLeft={RefreshCw} onClick={fetchRequest}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Derive roles robustly
  const cleanUserId = String(user?.id || user?._id || '');
  const requesterId = String(request.requester?._id || request.requester?.id || request.requester_id || request.requester || '');
  const ownerId = String(request.owner?._id || request.owner?.id || request.owner_id || request.owner || '');

  const isRequester = Boolean(cleanUserId && (requesterId === cleanUserId || (request.requester?.email && user?.email && request.requester.email.toLowerCase() === user.email.toLowerCase())));
  const isOwner = Boolean(cleanUserId && (ownerId === cleanUserId || (request.owner?.email && user?.email && request.owner.email.toLowerCase() === user.email.toLowerCase())));

  const status = (request.status || 'PENDING').toUpperCase();
  const targetItem = request.item || request.wantedItem;
  const itemTitle = targetItem?.title || 'Shared Item';

  // Request Type User-friendly Label
  const getRequestTypeLabel = () => {
    switch (request.type) {
      case 'BORROW':
        return 'Borrow Item';
      case 'EXCHANGE':
        return 'Exchange Item';
      case 'OFFER':
        return 'Wanted Item Offer';
      case 'REQUEST_ITEM':
      case 'REQUEST':
      default:
        return 'Request Item';
    }
  };

  // Status Banner Message according to Section 5
  const getStatusBannerContent = () => {
    switch (status) {
      case 'PENDING':
        return {
          title: isOwner ? 'Action Needed' : 'Pending Response',
          message: isOwner
            ? 'This request is waiting for your response.'
            : "Your request is waiting for the item owner's response.",
          variant: isOwner ? 'warning' : 'info'
        };
      case 'ACCEPTED':
        return {
          title: 'Request Accepted',
          message: 'The request has been accepted. Safe handover coordination is now open.',
          variant: 'success'
        };
      case 'DECLINED':
        return {
          title: 'Request Declined',
          message: 'This request was declined by the item owner.',
          variant: 'danger'
        };
      case 'CANCELLED':
        return {
          title: 'Request Cancelled',
          message: 'This request has been cancelled.',
          variant: 'neutral'
        };
      case 'COMPLETED':
        return {
          title: 'Request Completed',
          message: 'This request has been completed.',
          variant: 'info'
        };
      default:
        return {
          title: status,
          message: `This request is currently ${status.toLowerCase()}.`,
          variant: 'neutral'
        };
    }
  };

  const statusBanner = getStatusBannerContent();

  return (
    <div style={{ maxWidth: '1050px', width: '100%', margin: '0 auto', paddingBottom: '4rem', boxSizing: 'border-box' }} className="request-details-page">
      {/* 1. Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '1.25rem',
          fontSize: '0.85rem',
          color: 'var(--color-slate-500)'
        }}
      >
        <Link
          to="/requests"
          style={{
            color: 'var(--color-slate-600)',
            textDecoration: 'none',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          className="hover:underline"
        >
          <ArrowLeft size={14} />
          <span>Requests</span>
        </Link>
        <ChevronRight size={14} color="var(--color-slate-400)" />
        <span style={{ color: 'var(--color-slate-900)', fontWeight: 700 }}>
          Request Details
        </span>
      </nav>

      {/* 2. Request Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '1.5rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--color-primary-700)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              {getRequestTypeLabel()}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-300)' }}>•</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
              Created {formatDate(request.createdAt)}
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.5rem, 2.4vw, 2rem)',
              fontWeight: 900,
              color: 'var(--color-slate-900)',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
              lineHeight: 1.25
            }}
          >
            Request for {itemTitle}
          </h1>

          <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)', fontFamily: 'monospace' }}>
            Reference ID: {request.id || request._id}
          </div>
        </div>

        <div>
          <RequestStatusBadge status={request.status} size="lg" />
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
          gap: '1.5rem',
          alignItems: 'start',
          width: '100%',
          minWidth: 0
        }}
        className="request-details-grid"
      >
        {/* ==================================================== */}
        {/* LEFT COLUMN: Main Request Information & Details      */}
        {/* ==================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, width: '100%' }}>
          {/* 3. Status Banner */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor:
                statusBanner.variant === 'success'
                  ? '#ecfdf5'
                  : statusBanner.variant === 'warning'
                  ? '#fffbeb'
                  : statusBanner.variant === 'danger'
                  ? '#fef2f2'
                  : '#f8fafc',
              border: `1px solid ${
                statusBanner.variant === 'success'
                  ? '#a7f3d0'
                  : statusBanner.variant === 'warning'
                  ? '#fde68a'
                  : statusBanner.variant === 'danger'
                  ? '#fecaca'
                  : '#e2e8f0'
              }`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div style={{ flexShrink: 0 }}>
              {statusBanner.variant === 'success' ? (
                <CheckCircle2 size={24} color="#059669" />
              ) : statusBanner.variant === 'danger' ? (
                <XCircle size={24} color="#dc2626" />
              ) : (
                <Clock
                  size={24}
                  color={statusBanner.variant === 'warning' ? '#d97706' : '#64748b'}
                />
              )}
            </div>

            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  color:
                    statusBanner.variant === 'success'
                      ? '#064e3b'
                      : statusBanner.variant === 'warning'
                      ? '#92400e'
                      : statusBanner.variant === 'danger'
                      ? '#991b1b'
                      : '#334155'
                }}
              >
                {statusBanner.title}
              </div>
              <p
                style={{
                  fontSize: '0.85rem',
                  margin: '2px 0 0 0',
                  color:
                    statusBanner.variant === 'success'
                      ? '#047857'
                      : statusBanner.variant === 'warning'
                      ? '#b45309'
                      : statusBanner.variant === 'danger'
                      ? '#b91c1c'
                      : '#475569',
                  lineHeight: 1.45
                }}
              >
                {statusBanner.message}
              </p>
            </div>
          </div>

          {/* 4. Requested Item Card */}
          <RequestItemCard
            item={request.item || request.wantedItem}
            title={request.type === 'OFFER' ? 'Wanted Item Request' : 'Requested Item'}
          />

          {/* 5. Offered Item Card (For EXCHANGE or Wanted Item OFFER) */}
          {request.offeredItem && (
            <RequestItemCard
              item={request.offeredItem}
              title="Offered Item in Exchange"
              isOffered={true}
              badgeText="Offered"
            />
          )}

          {/* 6. Request Information Card */}
          <Card style={{ padding: '1.5rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)' }}>
            <h3
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: 'var(--color-slate-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: '0 0 1rem 0'
              }}
            >
              Request Information
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                backgroundColor: '#f8fafc',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-200)'
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Request Type
                </div>
                <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '2px' }}>
                  {getRequestTypeLabel()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Current Status
                </div>
                <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '2px', textTransform: 'capitalize' }}>
                  {status.toLowerCase()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Created Date
                </div>
                <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '2px' }}>
                  {formatDate(request.createdAt)}
                </div>
              </div>

              {request.updatedAt && request.updatedAt !== request.createdAt && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Last Updated
                  </div>
                  <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-slate-800)', marginTop: '2px' }}>
                    {formatDate(request.updatedAt)}
                  </div>
                </div>
              )}
            </div>

            {/* Borrow Return Date info if type === BORROW */}
            {request.type === 'BORROW' && request.expectedReturnDate && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary-50)',
                  border: '1px solid var(--color-primary-100)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Calendar size={18} color="var(--color-primary-700)" />
                <div style={{ fontSize: '0.875rem', color: 'var(--color-primary-900)' }}>
                  <strong>Expected Return Date:</strong>{' '}
                  {new Date(request.expectedReturnDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </Card>

          {/* Handover & Pickup Coordination - Only shown once request is mutually ACCEPTED */}
          {request?.status === 'ACCEPTED' && (isOwner || isRequester) && (
            <div style={{ marginBottom: '1.25rem' }}>
              <RapidoHandoverChatBox
                request={request}
                onRequestUpdated={fetchRequest}
              />
            </div>
          )}

          {/* 7. Request Message */}
          <Card style={{ padding: '1.5rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)' }}>
            <h3
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: 'var(--color-slate-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: '0 0 1rem 0'
              }}
            >
              {isRequester ? 'Your Message' : 'Message from Requester'}
            </h3>

            {request.message ? (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--color-slate-200)',
                  fontSize: '0.925rem',
                  color: 'var(--color-slate-700)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line'
                }}
              >
                "{request.message}"
              </div>
            ) : (
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc',
                  border: '1px dashed var(--color-slate-200)',
                  fontSize: '0.875rem',
                  color: 'var(--color-slate-400)',
                  fontStyle: 'italic'
                }}
              >
                No written message was provided with this request.
              </div>
            )}
          </Card>

          {/* 8. People Involved */}
          <Card style={{ padding: '1.5rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)' }}>
            <h3
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: 'var(--color-slate-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: '0 0 1rem 0'
              }}
            >
              People Involved
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.25rem'
              }}
            >
              {/* Requester Box */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {request.requester?._id || request.requester?.id ? (
                  <Link to={`/users/${request.requester._id || request.requester.id}`} style={{ textDecoration: 'none' }}>
                    <Avatar
                      src={request.requester?.avatar}
                      name={request.requester?.name || 'Requester'}
                      size="md"
                    />
                  </Link>
                ) : (
                  <Avatar
                    src={request.requester?.avatar}
                    name={request.requester?.name || 'Requester'}
                    size="md"
                  />
                )}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>
                    Requester {isRequester ? '(You)' : ''}
                  </div>
                  {request.requester?._id || request.requester?.id ? (
                    <Link
                      to={`/users/${request.requester._id || request.requester.id}`}
                      style={{ fontWeight: 800, color: 'var(--color-slate-900)', fontSize: '1rem', marginTop: '2px', textDecoration: 'none', display: 'block' }}
                      className="hover:underline"
                    >
                      {isRequester ? 'You' : request.requester?.name || 'Community Member'}
                    </Link>
                  ) : (
                    <div style={{ fontWeight: 800, color: 'var(--color-slate-900)', fontSize: '1rem', marginTop: '2px' }}>
                      {isRequester ? 'You' : request.requester?.name || 'Community Member'}
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                    <ShieldCheck size={12} />
                    <span>Verified Community Member</span>
                  </div>
                </div>
              </div>

              {/* Owner Box */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {request.owner?._id || request.owner?.id ? (
                  <Link to={`/users/${request.owner._id || request.owner.id}`} style={{ textDecoration: 'none' }}>
                    <Avatar
                      src={request.owner?.avatar}
                      name={request.owner?.name || 'Owner'}
                      size="md"
                    />
                  </Link>
                ) : (
                  <Avatar
                    src={request.owner?.avatar}
                    name={request.owner?.name || 'Owner'}
                    size="md"
                  />
                )}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>
                    Item Owner {isOwner ? '(You)' : ''}
                  </div>
                  {request.owner?._id || request.owner?.id ? (
                    <Link
                      to={`/users/${request.owner._id || request.owner.id}`}
                      style={{ fontWeight: 800, color: 'var(--color-slate-900)', fontSize: '1rem', marginTop: '2px', textDecoration: 'none', display: 'block' }}
                      className="hover:underline"
                    >
                      {isOwner ? 'You' : request.owner?.name || 'Community Member'}
                    </Link>
                  ) : (
                    <div style={{ fontWeight: 800, color: 'var(--color-slate-900)', fontSize: '1rem', marginTop: '2px' }}>
                      {isOwner ? 'You' : request.owner?.name || 'Community Member'}
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                    <ShieldCheck size={12} />
                    <span>Verified Community Member</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 9. Timeline / Activity */}
          <Card style={{ padding: '1.5rem', border: '1px solid var(--color-slate-200)', borderRadius: 'var(--radius-lg)' }}>
            <h3
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: 'var(--color-slate-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                margin: '0 0 1rem 0'
              }}
            >
              Request Timeline
            </h3>

            <RequestTimeline request={request} />
          </Card>
        </div>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: Actions & Status Management Panel      */}
        {/* ==================================================== */}
        <div style={{ position: 'sticky', top: '2rem', minWidth: 0, width: '100%' }} className="request-details-right-col">
          <RequestActions
            request={request}
            isOwner={isOwner}
            isRequester={isRequester}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onCancel={handleCancel}
            loadingAction={loadingAction}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .request-details-grid {
            grid-template-columns: 1fr !important;
          }
          .request-details-right-col {
            position: static !important;
          }
        }
        @media (max-width: 640px) {
          .request-details-page {
            padding-bottom: 2rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RequestDetails;
