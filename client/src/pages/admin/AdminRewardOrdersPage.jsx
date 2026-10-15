import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Search,
  Filter,
  CheckCircle,
  Truck,
  RotateCcw,
  Coins,
  MapPin,
  Clock,
  Eye,
  X,
  RefreshCw,
  Send,
  AlertTriangle,
  User,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminTable from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

const STATUS_FILTERS = [
  { key: 'all', label: 'All Orders' },
  { key: 'ORDER_PLACED', label: 'New Orders' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PACKED', label: 'Packed' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled / Refunded' }
];

export const AdminRewardOrdersPage = () => {
  const { addToast } = useToast();

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Status Form in Modal
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Refund Confirmation Modal
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState('Order cancelled by administrator');
  const [isRefunding, setIsRefunding] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getAdminRewardOrders({
        page,
        limit: 15,
        status: statusFilter,
        search
      });
      if (res?.success) {
        setOrders(res.orders || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.warn('Failed to fetch admin reward orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOpenDetailModal = (order) => {
    setSelectedOrder(order);
    setCourierName(order.courierName || '');
    setTrackingNumber(order.trackingNumber || '');
    setAdminNotes(order.adminNotes || '');
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedOrder) return;
    try {
      setIsUpdatingStatus(true);
      const res = await adminService.updateAdminRewardOrderStatus(selectedOrder.id, {
        status: newStatus,
        courierName,
        trackingNumber,
        adminNotes
      });

      if (res?.success) {
        addToast({
          title: 'Order Status Updated',
          message: res.message || `Order #${selectedOrder.orderNumber} updated to ${newStatus}.`,
          variant: 'success'
        });
        setSelectedOrder((prev) => ({
          ...prev,
          status: newStatus,
          courierName,
          trackingNumber,
          adminNotes
        }));
        fetchOrders();
      }
    } catch (err) {
      addToast({
        title: 'Status Update Failed',
        message: err.response?.data?.message || err.message,
        variant: 'danger'
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    try {
      setIsRefunding(true);
      const res = await adminService.cancelAndRefundRewardOrder(refundTarget.id, refundReason);
      if (res?.success) {
        addToast({
          title: 'Order Cancelled & Refunded',
          message: res.message,
          variant: 'success'
        });
        setRefundTarget(null);
        if (selectedOrder && selectedOrder.id === refundTarget.id) {
          setSelectedOrder(null);
        }
        fetchOrders();
      }
    } catch (err) {
      addToast({ title: 'Refund Failed', message: err.message, variant: 'danger' });
    } finally {
      setIsRefunding(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return { label: 'Delivered', bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' };
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return { label: 'Shipped', bg: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' };
      case 'PACKED':
      case 'PROCESSING':
      case 'CONFIRMED':
        return { label: 'In Fulfillment', bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' };
      case 'CANCELLED':
        return { label: 'Cancelled & Refunded', bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' };
      default:
        return { label: 'New Order', bg: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', border: '1px solid #ef4444' };
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Order Details',
      accessor: 'orderNumber',
      render: (o) => (
        <div>
          <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.85rem' }}>
            #{o.orderNumber}
          </span>
          <span style={{ display: 'block', fontSize: '0.725rem', color: '#94a3b8' }}>
            {formatDate ? formatDate(o.placedAt || o.createdAt) : new Date(o.placedAt || o.createdAt).toLocaleDateString()}
          </span>
        </div>
      )
    },
    {
      header: 'Prize Product',
      accessor: 'productTitle',
      render: (o) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={o.productImage || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'}
            alt=""
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100';
            }}
            style={{ width: '40px', height: '40px', objectFit: 'contain', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}
          />
          <div>
            <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.825rem', display: 'block' }}>
              {o.productTitle}
            </span>
            <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
              Qty: {o.quantity} • Total: <strong style={{ color: '#fde047' }}>{o.totalCoins} Coins</strong>
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Customer',
      accessor: 'customerName',
      render: (o) => (
        <div>
          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.825rem', display: 'block' }}>
            {o.customerName || 'Customer'}
          </span>
          <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
            {o.customerEmail}
          </span>
        </div>
      )
    },
    {
      header: 'Shipping Destination',
      accessor: 'deliveryAddress',
      render: (o) => {
        const addr = o.deliveryAddress || {};
        return (
          <div>
            <span style={{ fontWeight: 600, color: '#cbd5e1', fontSize: '0.8rem', display: 'block' }}>
              {addr.recipientName || o.customerName}
            </span>
            <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
              {addr.city}, {addr.state} - {addr.postalCode}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (o) => {
        const badge = getStatusBadge(o.status);
        return (
          <span
            style={{
              fontSize: '0.725rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: badge.bg,
              color: badge.color,
              border: badge.border
            }}
          >
            {badge.label}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (o) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleOpenDetailModal(o)}
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #38bdf8',
              borderRadius: '6px',
              padding: '5px 10px',
              color: '#38bdf8',
              fontSize: '0.775rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Eye size={13} />
            <span>Process</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={24} color="#38bdf8" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Reward Redemption Orders
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Process prize fulfillment, assign courier tracking numbers, and manage doorstep delivery.
          </p>
        </div>

        <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={fetchOrders} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* 2. Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '1.25rem' }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: statusFilter === f.key ? '#38bdf8' : '#334155',
              backgroundColor: statusFilter === f.key ? '#1e293b' : 'transparent',
              color: statusFilter === f.key ? '#38bdf8' : '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: statusFilter === f.key ? 800 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3. Search Bar */}
      <div style={{ marginBottom: '1.25rem', maxWidth: '340px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by order #, prize, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 10px 8px 32px',
              color: '#f8fafc',
              fontSize: '0.825rem'
            }}
          />
        </div>
      </div>

      {/* 4. Table */}
      <AdminTable
        columns={columns}
        data={orders}
        isLoading={loading}
        emptyMessage="No redemption orders match this criteria."
      />

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
      />

      {/* 5. Amazon-style Order Details & Fulfillment Modal */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative',
              padding: '24px'
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <Package size={22} color="#38bdf8" />
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Order #{selectedOrder.orderNumber}
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Placed on {formatDate ? formatDate(selectedOrder.placedAt || selectedOrder.createdAt) : new Date(selectedOrder.placedAt || selectedOrder.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Section A: Customer Account Information */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '12px 16px', marginBottom: '1rem', fontSize: '0.825rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                Customer Account Information
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: '#f8fafc' }}>Name: <strong>{selectedOrder.customerName}</strong></span>
                <span style={{ color: '#94a3b8' }}>Email: {selectedOrder.customerEmail}</span>
                <span style={{ color: '#94a3b8' }}>User ID: <code>{selectedOrder.customerId}</code></span>
              </div>
            </div>

            {/* Section B: Prize Product Details */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '12px 16px', marginBottom: '1rem', display: 'flex', gap: '14px', alignItems: 'center' }}>
              <img
                src={selectedOrder.productImage || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100'}
                alt=""
                style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}
              />
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#f8fafc', fontSize: '0.925rem', display: 'block' }}>{selectedOrder.productTitle}</strong>
                <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                  <span>Qty: <strong style={{ color: '#f8fafc' }}>{selectedOrder.quantity}</strong></span>
                  <span>Total Paid: <strong style={{ color: '#fde047' }}>{selectedOrder.totalCoins} Coins</strong></span>
                  <span>Payment: <strong style={{ color: '#34d399' }}>Verified in Coins</strong></span>
                </div>
              </div>
            </div>

            {/* Section C: Complete Amazon-style Shipping Address */}
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '14px 16px', marginBottom: '1.25rem', fontSize: '0.825rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} />
                <span>Verified Recipient Shipping Address</span>
              </div>
              <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
                {selectedOrder.deliveryAddress?.recipientName}
              </div>
              <div style={{ color: '#34d399', fontWeight: 600, marginBottom: '4px' }}>
                📞 Contact Phone: {selectedOrder.deliveryAddress?.phone}
              </div>
              <div style={{ color: '#cbd5e1', lineHeight: 1.4 }}>
                {selectedOrder.deliveryAddress?.addressLine1} {selectedOrder.deliveryAddress?.addressLine2 || ''}
                {selectedOrder.deliveryAddress?.locality ? `, ${selectedOrder.deliveryAddress.locality}` : ''}
                <br />
                {selectedOrder.deliveryAddress?.city}, {selectedOrder.deliveryAddress?.state} - <strong>{selectedOrder.deliveryAddress?.postalCode}</strong>
                <br />
                {selectedOrder.deliveryAddress?.country || 'India'}
              </div>
            </div>

            {/* Section D: Courier Dispatch & Tracking Inputs */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '12px', padding: '14px', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Truck size={14} />
                <span>Courier Logistics & Tracking</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#cbd5e1', display: 'block', marginBottom: '2px' }}>Courier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. BlueDart / Delhivery / DTDC"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#cbd5e1', display: 'block', marginBottom: '2px' }}>Tracking / AWB Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BLD9876543210"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Section E: Admin Fulfillment Action Buttons */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Update Fulfillment Progression
              </span>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <button
                  type="button"
                  disabled={isUpdatingStatus || selectedOrder.status === 'CONFIRMED'}
                  onClick={() => handleUpdateStatus('CONFIRMED')}
                  style={{
                    backgroundColor: selectedOrder.status === 'CONFIRMED' ? '#059669' : '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Confirm Order
                </button>

                <button
                  type="button"
                  disabled={isUpdatingStatus || selectedOrder.status === 'PACKED'}
                  onClick={() => handleUpdateStatus('PACKED')}
                  style={{
                    backgroundColor: selectedOrder.status === 'PACKED' ? '#059669' : '#334155',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Mark as Packed
                </button>

                <button
                  type="button"
                  disabled={isUpdatingStatus || selectedOrder.status === 'SHIPPED'}
                  onClick={() => handleUpdateStatus('SHIPPED')}
                  style={{
                    backgroundColor: selectedOrder.status === 'SHIPPED' ? '#059669' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Dispatch via Courier (Ship)
                </button>

                <button
                  type="button"
                  disabled={isUpdatingStatus || selectedOrder.status === 'DELIVERED'}
                  onClick={() => handleUpdateStatus('DELIVERED')}
                  style={{
                    backgroundColor: selectedOrder.status === 'DELIVERED' ? '#059669' : '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Mark as Delivered 🎉
                </button>
              </div>

              {/* Cancel & Refund Action */}
              {selectedOrder.status !== 'CANCELLED' && (
                <div style={{ paddingTop: '10px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setRefundTarget(selectedOrder)}
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      color: '#f87171',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RotateCcw size={13} />
                    <span>Cancel & Refund {selectedOrder.totalCoins} Coins</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Refund Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(refundTarget)}
        title={`Cancel Order #${refundTarget?.orderNumber} & Refund Coins?`}
        message={`Are you sure you want to cancel this order? This will restore ${refundTarget?.quantity} unit(s) to inventory stock and credit ${refundTarget?.totalCoins} coins back to customer ${refundTarget?.customerName}.`}
        confirmLabel="Yes, Refund Coins"
        confirmVariant="danger"
        isLoading={isRefunding}
        onConfirm={handleConfirmRefund}
        onCancel={() => setRefundTarget(null)}
      />
    </div>
  );
};

export default AdminRewardOrdersPage;
