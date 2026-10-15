import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  Plus,
  Search,
  Filter,
  Coins,
  Package,
  CheckCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Power,
  Truck,
  Layers
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminTable from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import { useToast } from '../../hooks/useToast';

export const AdminRewardsPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Master Switch State
  const [storeSettings, setStoreSettings] = useState({
    enabled: true,
    maintenanceMessage: ''
  });
  const [switchLoading, setSwitchLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState(false);
  const [tempMessage, setTempMessage] = useState('');

  // Delete Target Dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStoreSettings = async () => {
    try {
      const res = await adminService.getRewardsSettings();
      if (res?.success && res.settings) {
        setStoreSettings(res.settings);
        setTempMessage(res.settings.maintenanceMessage || '');
      }
    } catch (err) {
      console.warn('Failed to fetch rewards settings:', err);
    }
  };

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getAdminRewards({
        page,
        limit: 15,
        category: categoryFilter,
        status: statusFilter,
        search
      });
      if (res?.success) {
        setRewards(res.rewards || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.warn('Failed to fetch admin rewards:', err);
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter, statusFilter, search]);

  useEffect(() => {
    fetchStoreSettings();
    fetchRewards();
  }, [fetchRewards]);

  const handleToggleStoreSwitch = async () => {
    try {
      setSwitchLoading(true);
      const newEnabled = !storeSettings.enabled;
      const res = await adminService.updateRewardsSettings({
        enabled: newEnabled,
        maintenanceMessage: tempMessage || storeSettings.maintenanceMessage
      });
      if (res?.success) {
        setStoreSettings(res.settings);
        addToast({
          title: `Rewards Store ${newEnabled ? 'LIVE' : 'OFFLINE'}`,
          message: res.message || `Store switch updated successfully.`,
          variant: newEnabled ? 'success' : 'warning'
        });
      }
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to toggle store switch.', variant: 'danger' });
    } finally {
      setSwitchLoading(false);
    }
  };

  const handleSaveMaintenanceMessage = async () => {
    try {
      setSwitchLoading(true);
      const res = await adminService.updateRewardsSettings({
        enabled: storeSettings.enabled,
        maintenanceMessage: tempMessage
      });
      if (res?.success) {
        setStoreSettings(res.settings);
        setEditingMessage(false);
        addToast({ title: 'Message Updated', message: 'Maintenance message saved.', variant: 'success' });
      }
    } catch {
      addToast({ title: 'Error', message: 'Failed to update message.', variant: 'danger' });
    } finally {
      setSwitchLoading(false);
    }
  };

  const handleTogglePublish = async (reward) => {
    try {
      const res = await adminService.updateAdminReward(reward.id, {
        isPublished: !reward.isPublished
      });
      if (res?.success) {
        addToast({
          title: 'Status Updated',
          message: `"${reward.title}" is now ${!reward.isPublished ? 'published' : 'draft'}.`,
          variant: 'info'
        });
        fetchRewards();
      }
    } catch {
      addToast({ title: 'Error', message: 'Failed to update publication status.', variant: 'danger' });
    }
  };

  const handleDeleteReward = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await adminService.deleteAdminReward(deleteTarget.id);
      if (res?.success) {
        addToast({ title: 'Prize Removed', message: res.message, variant: 'success' });
        setDeleteTarget(null);
        fetchRewards();
      }
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to delete reward prize.', variant: 'danger' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Prize Details',
      accessor: 'title',
      render: (r) => {
        const img = r.images?.[0]?.url || (typeof r.images?.[0] === 'string' ? r.images[0] : 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={img}
              alt=""
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100';
              }}
              style={{ width: '48px', height: '48px', objectFit: 'contain', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}
            />
            <div>
              <span style={{ fontWeight: 700, color: '#f8fafc', display: 'block', fontSize: '0.85rem' }}>
                {r.title}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {r.brand ? `${r.brand} • ` : ''}{r.category} • SKU: {r.sku || 'N/A'}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Coin Price',
      accessor: 'coinPrice',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fde047', fontWeight: 800, fontSize: '0.875rem' }}>
          <Coins size={14} />
          <span>{r.coinPrice} Coins</span>
        </div>
      )
    },
    {
      header: 'Inventory Stock',
      accessor: 'stockQuantity',
      render: (r) => (
        <div>
          <span style={{ fontWeight: 700, color: r.stockQuantity > 0 ? (r.stockQuantity <= 3 ? '#f59e0b' : '#34d399') : '#f87171', fontSize: '0.85rem' }}>
            {r.stockQuantity} units
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>
            {r.stockQuantity > 0 ? (r.stockQuantity <= 3 ? 'Low Stock' : 'In Stock') : 'Out of Stock'}
          </span>
        </div>
      )
    },
    {
      header: 'Catalog Status',
      accessor: 'isPublished',
      render: (r) => (
        <span
          style={{
            fontSize: '0.725rem',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: r.isPublished ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
            color: r.isPublished ? '#34d399' : '#94a3b8',
            border: r.isPublished ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(148, 163, 184, 0.4)'
          }}
        >
          {r.isPublished ? '● LIVE IN STORE' : '○ DRAFT'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => handleTogglePublish(r)}
            title={r.isPublished ? 'Set to Draft' : 'Publish to Store'}
            style={{
              background: 'none',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px',
              color: r.isPublished ? '#fbbf24' : '#34d399',
              cursor: 'pointer'
            }}
          >
            {r.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/admin/rewards/${r.id}/edit`)}
            title="Edit Prize"
            style={{
              background: 'none',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px',
              color: '#38bdf8',
              cursor: 'pointer'
            }}
          >
            <Edit size={14} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(r)}
            title="Delete Prize"
            style={{
              background: 'none',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px',
              color: '#f87171',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={14} />
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
            <Gift size={24} color="#38bdf8" />
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Rewards Store Catalog & Prizes
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Manage commercial prizes (mixers, electronics, kitchen goods) available for customer coin redemption.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="primary" iconLeft={Plus} onClick={() => navigate('/admin/rewards/new')}>
            Upload New Prize
          </Button>
          <Button variant="outline" iconLeft={Package} onClick={() => navigate('/admin/reward-orders')}>
            View Reward Orders
          </Button>
        </div>
      </div>

      {/* 2. Master On/Off Switch Card */}
      <div
        style={{
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          border: '1px solid #334155',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: storeSettings.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Power size={22} color={storeSettings.enabled ? '#34d399' : '#f87171'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                Rewards Store Master Switch:
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: storeSettings.enabled ? '#059669' : '#dc2626',
                  color: '#ffffff',
                  letterSpacing: '0.05em'
                }}
              >
                {storeSettings.enabled ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              {storeSettings.enabled
                ? 'Store is published. Customers can browse and redeem eligible prizes.'
                : 'Store is offline. Customer redemptions are paused. Existing orders are preserved safely.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            disabled={switchLoading}
            onClick={handleToggleStoreSwitch}
            style={{
              backgroundColor: storeSettings.enabled ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              border: `1px solid ${storeSettings.enabled ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
              borderRadius: '8px',
              padding: '8px 16px',
              color: storeSettings.enabled ? '#fca5a5' : '#86efac',
              fontWeight: 800,
              fontSize: '0.825rem',
              cursor: switchLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {switchLoading ? 'Switching...' : storeSettings.enabled ? 'Turn OFFLINE' : 'Turn LIVE'}
          </button>
        </div>
      </div>

      {/* 3. Catalog Filters */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search prize, brand, SKU..."
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

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#cbd5e1',
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          <option value="">All Categories</option>
          <option value="Home & Kitchen">Home & Kitchen</option>
          <option value="Kitchen Appliances">Kitchen Appliances</option>
          <option value="Electronics">Electronics</option>
          <option value="Household Products">Household Products</option>
          <option value="Personal Care">Personal Care</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#cbd5e1',
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          <option value="">All Publication States</option>
          <option value="published">Live Published</option>
          <option value="draft">Drafts Only</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>

        <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={fetchRewards} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* 4. Table */}
      <AdminTable
        columns={columns}
        data={rewards}
        isLoading={loading}
        emptyMessage="No reward prizes found in catalog. Click 'Upload New Prize' to add products."
      />

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={15}
        onPageChange={(p) => setPage(p)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.title}"?`}
        message={`Are you sure you want to permanently remove "${deleteTarget?.title}" from the rewards catalog? If the prize has active orders, it will be safely archived instead.`}
        confirmLabel="Delete Prize"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteReward}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AdminRewardsPage;
