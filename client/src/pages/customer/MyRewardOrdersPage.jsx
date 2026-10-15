import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  MapPin,
  AlertTriangle,
  RotateCcw,
  Coins,
  RefreshCw,
  ExternalLink,
  Gift,
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

const TIMELINE_STEPS = [
  { key: 'ORDER_PLACED', label: 'Order Placed' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PACKED', label: 'Packed' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' }
];

export const MyRewardOrdersPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Cancellation Dialog State
  const [cancelOrderTarget, setCancelOrderTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('Changed mind');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/rewards/orders/my');
      if (res.data?.success) {
        setOrders(res.data.orders || []);
        if (res.data.orders?.length > 0 && !expandedOrderId) {
          setExpandedOrderId(res.data.orders[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch orders:', err.message);
    } finally {
      setLoading(false);
    }
  }, [expandedOrderId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancelOrder = async () => {
    if (!cancelOrderTarget) return;
    try {
      setIsCancelling(true);
      const res = await api.post(`/rewards/orders/${cancelOrderTarget.id}/cancel`, {
        reason: cancelReason
      });

      if (res.data?.success) {
        addToast({
          title: 'Order Cancelled',
          message: res.data.message || 'Your order was cancelled and coins were refunded.',
          variant: 'success'
        });
        setCancelOrderTarget(null);
        fetchOrders();
      }
    } catch (err) {
      addToast({
        title: 'Cancellation Failed',
        message: err.response?.data?.message || 'Could not cancel this order.',
        variant: 'danger'
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const getStepStatus = (orderStatus, stepKey) => {
    if (orderStatus === 'CANCELLED') return 'cancelled';

    const orderStatusSeq = ['ORDER_PLACED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentIdx = orderStatusSeq.indexOf(orderStatus);
    const stepIdx = orderStatusSeq.indexOf(stepKey);

    if (currentIdx === -1 || stepIdx === -1) return 'pending';
    if (currentIdx >= stepIdx) return 'completed';
    return 'pending';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return { label: 'Delivered', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return { label: 'Shipped & En Route', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
      case 'PACKED':
      case 'PROCESSING':
      case 'CONFIRMED':
        return { label: 'Being Prepared', bg: '#fef3c7', color: '#d97706', border: '#fde68a' };
      case 'CANCELLED':
        return { label: 'Cancelled & Refunded', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
      default:
        return { label: 'Order Placed', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
    }
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 1rem 4rem 1rem' }} className="my-reward-orders-page">
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
            <Package size={28} color="#059669" />
            <h1 style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              My Rewards Store Orders
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
            Track the live fulfillment, courier dispatch, and delivery timeline of your redeemed circular prizes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={fetchOrders} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" iconLeft={Gift} onClick={() => navigate('/rewards')}>
            Browse Rewards
          </Button>
        </div>
      </div>

      {/* 2. Order List */}
      {loading ? (
        <div style={{ padding: '5rem', textAlign: 'center' }}>
          <Spinner size="lg" />
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '1rem' }}>Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No Reward Orders Yet"
          description="You haven't redeemed any prizes with your circular sharing coins yet. Explore mixer grinders, electronics, and household prizes in the store!"
          actionLabel="Explore Rewards Store"
          onAction={() => navigate('/rewards')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const badge = getStatusBadge(order.status);
            const isCancellable = order.status === 'ORDER_PLACED' || order.status === 'CONFIRMED';

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s ease'
                }}
              >
                {/* Order Summary Header */}
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Order Number</span>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>#{order.orderNumber}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Placed On</span>
                      <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                        {formatDate ? formatDate(order.placedAt || order.createdAt) : new Date(order.placedAt || order.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Coins Paid</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 800, fontSize: '0.925rem' }}>
                        <Coins size={15} color="#eab308" />
                        <span>{order.totalCoins} Coins</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.775rem',
                        fontWeight: 800,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`
                      }}
                    >
                      {badge.label}
                    </span>

                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      style={{
                        background: 'none',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        color: '#475569',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Main Product Details Card */}
                <div style={{ padding: '1.5rem', display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <img
                    src={order.productImage || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=120'}
                    alt={order.productTitle}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=120';
                    }}
                    style={{ width: '90px', height: '90px', objectFit: 'contain', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '6px' }}
                  />

                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      {order.productTitle}
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.825rem', color: '#64748b', marginBottom: '8px' }}>
                      <span>Qty: <strong style={{ color: '#0f172a' }}>{order.quantity}</strong></span>
                      <span>Unit: <strong style={{ color: '#0f172a' }}>{order.coinPricePerUnit} coins</strong></span>
                      <span>Total: <strong style={{ color: '#059669' }}>{order.totalCoins} coins</strong></span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem', color: '#475569' }}>
                      <MapPin size={15} color="#059669" />
                      <span>
                        Delivering to: <strong>{order.deliveryAddress?.recipientName}</strong> ({order.deliveryAddress?.city}, {order.deliveryAddress?.postalCode})
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {isCancellable && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setCancelOrderTarget(order)}
                        style={{
                          backgroundColor: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Cancel & Refund</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Timeline & Expanded Details */}
                {isExpanded && (
                  <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid #f1f5f9' }}>
                    {order.status === 'CANCELLED' ? (
                      /* Cancelled Alert Banner */
                      <div
                        style={{
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '12px',
                          padding: '14px',
                          marginTop: '1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          color: '#991b1b'
                        }}
                      >
                        <XCircle size={22} color="#dc2626" />
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.9rem' }}>Order Cancelled</strong>
                          <span style={{ fontSize: '0.825rem', color: '#7f1d1d' }}>
                            {order.cancellationReason || 'Order was cancelled and all coins have been safely refunded to your LOOOP wallet.'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Amazon-style Linear Timeline */
                      <div style={{ marginTop: '1.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', display: 'block', marginBottom: '14px' }}>
                          Fulfillment Progress
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', paddingBottom: '10px' }}>
                          {TIMELINE_STEPS.map((step, idx) => {
                            const stepStatus = getStepStatus(order.status, step.key);
                            const isCompleted = stepStatus === 'completed';

                            return (
                              <div
                                key={step.key}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  textAlign: 'center',
                                  flex: 1,
                                  minWidth: '90px',
                                  position: 'relative'
                                }}
                              >
                                {/* Step Icon Circle */}
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: isCompleted ? '#059669' : '#f1f5f9',
                                    border: isCompleted ? 'none' : '2px solid #cbd5e1',
                                    color: isCompleted ? '#ffffff' : '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    zIndex: 2,
                                    marginBottom: '6px'
                                  }}
                                >
                                  {isCompleted ? <CheckCircle2 size={18} /> : idx + 1}
                                </div>

                                <span style={{ fontSize: '0.75rem', fontWeight: isCompleted ? 700 : 500, color: isCompleted ? '#0f172a' : '#94a3b8' }}>
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Shipping & Courier Details if available */}
                    {order.trackingNumber && (
                      <div
                        style={{
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '12px',
                          padding: '12px 16px',
                          marginTop: '1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Truck size={20} color="#059669" />
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
                              Courier Partner: {order.courierName || 'Standard Express'}
                            </span>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#065f46' }}>
                              Tracking AWB: {order.trackingNumber}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>
                          Dispatched & On Time
                        </span>
                      </div>
                    )}

                    {/* Delivery Address Snapshot */}
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginTop: '1rem',
                        fontSize: '0.825rem'
                      }}
                    >
                      <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                        Delivery Address on File:
                      </strong>
                      <span style={{ color: '#475569', display: 'block' }}>
                        {order.deliveryAddress?.recipientName} • 📞 {order.deliveryAddress?.phone}
                      </span>
                      <span style={{ color: '#64748b', display: 'block' }}>
                        {order.deliveryAddress?.addressLine1} {order.deliveryAddress?.addressLine2 || ''}, {order.deliveryAddress?.locality || ''}, {order.deliveryAddress?.city}, {order.deliveryAddress?.state} - {order.deliveryAddress?.postalCode}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cancelOrderTarget)}
        title={`Cancel Order #${cancelOrderTarget?.orderNumber}?`}
        message={`Are you sure you want to cancel your redemption order for "${cancelOrderTarget?.productTitle}"? Your ${cancelOrderTarget?.totalCoins} LOOOP Coins will be refunded to your account immediately.`}
        confirmLabel="Yes, Cancel & Refund Coins"
        confirmVariant="danger"
        isLoading={isCancelling}
        onConfirm={handleCancelOrder}
        onCancel={() => setCancelOrderTarget(null)}
      />
    </div>
  );
};

export default MyRewardOrdersPage;
