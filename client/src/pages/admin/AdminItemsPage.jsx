import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  HelpCircle,
  Eye,
  EyeOff,
  Trash2,
  RotateCcw,
  AlertTriangle,
  MapPin,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Coins,
  XCircle,
  Award,
  Sparkles
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminTable from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminSearch from '../../components/admin/AdminSearch';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Avatar from '../../components/common/Avatar';
import Spinner from '../../components/common/Spinner';

// Module-scoped persistent cache that survives React Router unmount/remount
let persistentItems = null;
let persistentWanted = null;
let persistentTotal = 0;
let persistentWantedTotal = 0;
let persistentTotalPages = 1;
let itemsAlreadyLoaded = false;
let wantedAlreadyLoaded = false;

// Clear old cache keys once to ensure deleted products are removed immediately
try {
  localStorage.removeItem('looop_admin_items_cache');
  localStorage.removeItem('looop_admin_items_total');
  localStorage.removeItem('looop_admin_items_cache_v3');
  localStorage.removeItem('looop_admin_items_total_v3');
} catch {}

const getItemImageUrl = (item) => {
  const first = item?.images?.[0];
  if (!first) return 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100';
  if (typeof first === 'string') return first;
  return first.url || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100';
};

export const AdminItemsPage = () => {
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'wanted'
  const [items, setItems] = useState(() => {
    if (persistentItems && persistentItems.length > 0) return persistentItems;
    try {
      const cached = localStorage.getItem('looop_admin_items_cache_v4');
      const parsed = cached ? JSON.parse(cached) : null;
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        persistentItems = parsed;
        itemsAlreadyLoaded = true;
        return parsed;
      }
    } catch {}
    return [];
  });
  const [wantedItems, setWantedItems] = useState(() => persistentWanted || []);
  const [total, setTotal] = useState(() => {
    if (persistentTotal >= 0 && itemsAlreadyLoaded) return persistentTotal;
    try {
      const cached = localStorage.getItem('looop_admin_items_total_v4');
      return cached ? parseInt(cached, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [totalPages, setTotalPages] = useState(() => persistentTotalPages || 1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sharingTypeFilter, setSharingTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(() => {
    if (itemsAlreadyLoaded && persistentItems && persistentItems.length > 0) {
      return false;
    }
    return true;
  });
  const [notification, setNotification] = useState(null);

  // Moderation Dialog State
  const [modTargetItem, setModTargetItem] = useState(null);
  const [modAction, setModAction] = useState('hide'); // 'hide' | 'remove' | 'restore'
  const [isModLoading, setIsModLoading] = useState(false);

  // Details Modal State
  const [detailsItem, setDetailsItem] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [fullDetails, setFullDetails] = useState(null);

  // Award Coins State
  const [awardItem, setAwardItem] = useState(null);
  const [awardCoins, setAwardCoins] = useState(50);
  const [awardReason, setAwardReason] = useState('Product contribution approved');
  const [isAwardLoading, setIsAwardLoading] = useState(false);

  // Reject Item State
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('Product details did not meet platform guidelines');
  const [isRejectLoading, setIsRejectLoading] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      if (activeTab === 'items') {
        const res = await adminService.getItems({
          page,
          limit: 15,
          search,
          category: categoryFilter,
          sharingType: sharingTypeFilter,
          status: statusFilter
        });
        if (res?.success) {
          const list = res.data?.items || [];
          setItems(list);
          setTotal(res.data?.total || 0);
          setTotalPages(res.data?.totalPages || 1);
          persistentItems = list;
          persistentTotal = res.data?.total || 0;
          persistentTotalPages = res.data?.totalPages || 1;
          itemsAlreadyLoaded = true;
          if (page === 1 && !search && !categoryFilter && !sharingTypeFilter && !statusFilter) {
            try {
              localStorage.setItem('looop_admin_items_cache_v4', JSON.stringify(list));
              localStorage.setItem('looop_admin_items_total_v4', String(res.data?.total || 0));
            } catch {}
          }
        }
      } else {
        const res = await adminService.getWantedItems({
          page,
          limit: 15,
          search,
          category: categoryFilter,
          status: statusFilter
        });
        if (res?.success) {
          const wList = res.data?.wantedItems || [];
          setWantedItems(wList);
          setTotal(res.data?.total || 0);
          setTotalPages(res.data?.totalPages || 1);
          persistentWanted = wList;
          persistentWantedTotal = res.data?.total || 0;
          wantedAlreadyLoaded = true;
        }
      }
    } catch (err) {
      console.error('Failed to load listings:', err);
      if (!persistentItems || persistentItems.length === 0) {
        setNotification({ type: 'error', message: 'Failed to retrieve listings from database.' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, search, categoryFilter, statusFilter, sharingTypeFilter]);

  // SWR: render cached immediately, but ALWAYS fetch fresh data quietly in background
  useEffect(() => {
    if (activeTab === 'items') {
      const hasCached = items && items.length > 0;
      fetchData(hasCached);
    } else {
      const hasCached = wantedItems && wantedItems.length > 0;
      fetchData(hasCached);
    }
  }, [activeTab, page, search, categoryFilter, statusFilter, sharingTypeFilter, fetchData]);

  const handleOpenDetails = async (item) => {
    setDetailsItem(item);
    setIsDetailsOpen(true);
    try {
      setDetailsLoading(true);
      const res = await adminService.getItemDetails(item._id);
      if (res?.success) {
        setFullDetails(res.data);
      }
    } catch (err) {
      console.error('Failed to load item details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenModeration = (item, action) => {
    setModTargetItem(item);
    setModAction(action);
  };

  const handleConfirmModeration = async (reason) => {
    if (!modTargetItem) return;
    try {
      setIsModLoading(true);
      if (modAction === 'delete_permanently') {
        const itemId = modTargetItem._id || modTargetItem.id;
        const res = await adminService.deleteItem(itemId);
        if (res?.success) {
          setNotification({
            type: 'success',
            message: res.message || `"${modTargetItem.title}" has been permanently deleted from the database.`
          });
          setItems((prev) => prev.filter((i) => (i._id || i.id) !== itemId));
          setTotal((prev) => Math.max(0, prev - 1));
          setModTargetItem(null);
          setIsDetailsOpen(false);
          fetchData(true);
        } else {
          setNotification({
            type: 'error',
            message: res?.message || 'Failed to delete item from database.'
          });
        }
        return;
      }

      const res = await adminService.moderateItem(modTargetItem._id, {
        action: modAction,
        reason
      });
      if (res?.success) {
        setNotification({
          type: 'success',
          message: res.message || 'Item moderation completed successfully.'
        });
        setModTargetItem(null);
        fetchData();
      }
    } catch (err) {
      console.error('Item moderation error:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to moderate listing.'
      });
    } finally {
      setIsModLoading(false);
    }
  };

  const handleApproveItem = async (itemId) => {
    try {
      setIsLoading(true);
      const res = await adminService.approveItem(itemId);
      if (res?.success) {
        setNotification({ type: 'success', message: res.message || 'Listing approved and published!' });
        fetchData();
      }
    } catch (err) {
      console.error('Approval error:', err);
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to approve listing.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAwardCoinsSubmit = async () => {
    if (!awardItem) return;
    try {
      setIsAwardLoading(true);
      const itemId = awardItem._id || awardItem.id;
      const res = await adminService.awardItemCoins(itemId, {
        coins: Number(awardCoins),
        reason: awardReason
      });
      if (res?.success) {
        setNotification({
          type: 'success',
          message: res.message || `Successfully awarded ${awardCoins} coins to ${awardItem.owner?.name || 'contributor'}!`
        });
        setItems(prev => prev.map(i => {
          if ((i._id || i.id) === itemId) {
            return { ...i, coins_awarded: Number(awardCoins), coinsAwarded: Number(awardCoins) };
          }
          return i;
        }));
        setAwardItem(null);
        if (detailsItem && (detailsItem._id || detailsItem.id) === itemId) {
          setDetailsItem(prev => ({ ...prev, coins_awarded: Number(awardCoins), coinsAwarded: Number(awardCoins) }));
        }
      } else {
        setNotification({
          type: 'error',
          message: res?.message || 'Failed to award coins.'
        });
      }
    } catch (err) {
      console.error('Award coins error:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to award coins.'
      });
    } finally {
      setIsAwardLoading(false);
    }
  };

  const handleRejectItemSubmit = async () => {
    if (!rejectItem) return;
    try {
      setIsRejectLoading(true);
      const itemId = rejectItem._id || rejectItem.id;
      const res = await adminService.rejectItem(itemId, rejectReason);
      if (res?.success) {
        setNotification({
          type: 'success',
          message: res.message || 'Product listing rejected and contributor notified.'
        });
        setItems(prev => prev.map(i => {
          if ((i._id || i.id) === itemId) {
            return { ...i, status: 'rejected' };
          }
          return i;
        }));
        setRejectItem(null);
        setIsDetailsOpen(false);
        fetchData(true);
      } else {
        setNotification({
          type: 'error',
          message: res?.message || 'Failed to reject listing.'
        });
      }
    } catch (err) {
      console.error('Reject error:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to reject listing.'
      });
    } finally {
      setIsRejectLoading(false);
    }
  };

  // Item Table Columns
  const itemColumns = [
    {
      header: 'Listing',
      accessor: 'title',
      render: (item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={getItemImageUrl(item)}
            alt=""
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100';
            }}
            style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-xs)', objectFit: 'cover', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>{item.title}</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {item.category} • {item.sharingType?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Owner',
      accessor: 'owner',
      render: (item) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar src={item.owner?.avatar} name={item.owner?.name || 'User'} size="xs" />
            <span style={{ color: '#cbd5e1', fontSize: '0.825rem', fontWeight: 600 }}>{item.owner?.name || 'Owner'}</span>
          </div>
          {item.owner?.phone && (
            <span style={{ color: '#34d399', fontSize: '0.72rem', paddingLeft: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📞</span>
              <span>{item.owner.phone}</span>
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Condition',
      accessor: 'condition',
      render: (item) => (
        <span style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'capitalize' }}>
          {item.condition?.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: 'Approx. Location',
      render: (item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '0.8rem' }}>
          <MapPin size={12} />
          <span>{item.location?.city || 'Local area'}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (item) => <StatusBadge status={item.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            onClick={() => handleOpenDetails(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              backgroundColor: '#334155',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              color: '#f8fafc',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            <Eye size={12} />
            <span>Details</span>
          </button>

          {(item.status === 'pending moderation' || item.status === 'pending_approval' || item.approvalStatus === 'PENDING') && (
            <>
              <button
                type="button"
                onClick={() => handleApproveItem(item._id || item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  color: '#022c22',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <CheckCircle size={12} />
                <span>Approve &amp; Publish</span>
              </button>
              <button
                type="button"
                onClick={() => setRejectItem(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#fca5a5',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <XCircle size={12} />
                <span>Reject</span>
              </button>
            </>
          )}

          {(item.status === 'active' || item.status === 'approved') && (
            (item.coins_awarded || item.coinsAwarded) ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  color: '#facc15',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
              >
                <Sparkles size={11} />
                +{item.coins_awarded || item.coinsAwarded} Coins
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAwardItem(item);
                  setAwardCoins(50);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#fef08a',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Coins size={12} />
                <span>Award Coins</span>
              </button>
            )
          )}

          {item.status === 'suspended' || item.status === 'removed' ? (
            <>
              <button
                type="button"
                onClick={() => handleOpenModeration(item, 'restore')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#34d399',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={12} />
                <span>Restore</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenModeration(item, 'delete_permanently')}
                title="Permanently erase from PostgreSQL database"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#fca5a5',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={12} />
                <span>Delete from DB</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleOpenModeration(item, 'hide')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#fbbf24',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <EyeOff size={12} />
                <span>Hide</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenModeration(item, 'remove')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#f87171',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={12} />
                <span>Remove</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenModeration(item, 'delete_permanently')}
                title="Permanently erase from PostgreSQL database"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#fca5a5',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={12} />
                <span>Delete from DB</span>
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  // Wanted Table Columns
  const wantedColumns = [
    {
      header: 'Wanted Request',
      accessor: 'title',
      render: (w) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{w.title}</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {w.category} • Prefers: {w.preferredSharingType}
          </span>
        </div>
      )
    },
    {
      header: 'Requester',
      accessor: 'requester',
      render: (w) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar src={w.requester?.avatar} name={w.requester?.name || 'Requester'} size="xs" />
          <span style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>{w.requester?.name || 'Requester'}</span>
        </div>
      )
    },
    {
      header: 'Urgency',
      accessor: 'urgency',
      render: (w) => (
        <span
          style={{
            fontSize: '0.725rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: w.urgency === 'high' ? '#f87171' : '#94a3b8'
          }}
        >
          {w.urgency || 'Normal'}
        </span>
      )
    },
    {
      header: 'Location',
      render: (w) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '0.8rem' }}>
          <MapPin size={12} />
          <span>{w.location?.city || 'Local area'}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (w) => <StatusBadge status={w.status} />
    },
    {
      header: 'Created',
      render: (w) => (
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
          {new Date(w.createdAt).toLocaleDateString()}
        </span>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header with Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
            Listing Governance & Oversight
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Moderate shared circular goods, review prohibited items, and monitor community wanted requests.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => fetchData(false)}
            disabled={isLoading}
            title="Refresh listings from database"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-sm)',
              color: '#38bdf8',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', backgroundColor: '#1e293b', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid #334155' }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('items');
                setStatusFilter('');
                setPage(1);
              }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: activeTab === 'items' && !statusFilter ? 'var(--color-primary-600)' : 'transparent',
                color: activeTab === 'items' && !statusFilter ? '#ffffff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              All Listed
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('items');
                setStatusFilter('pending moderation');
                setPage(1);
              }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: activeTab === 'items' && (statusFilter === 'pending moderation' || statusFilter === 'pending_approval') ? '#ef4444' : 'transparent',
                color: activeTab === 'items' && (statusFilter === 'pending moderation' || statusFilter === 'pending_approval') ? '#ffffff' : '#fca5a5',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Pending Review</span>
              {items.filter(i => i.status === 'pending moderation' || i.status === 'pending_approval' || i.approvalStatus === 'PENDING').length > 0 && (
                <span style={{ backgroundColor: '#ffffff', color: '#dc2626', fontSize: '0.7rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>
                  {items.filter(i => i.status === 'pending moderation' || i.status === 'pending_approval' || i.approvalStatus === 'PENDING').length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('items');
                setStatusFilter('active');
                setPage(1);
              }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: activeTab === 'items' && statusFilter === 'active' ? '#10b981' : 'transparent',
                color: activeTab === 'items' && statusFilter === 'active' ? '#ffffff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Active / Approved
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('wanted');
                setStatusFilter('');
                setPage(1);
              }}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: activeTab === 'wanted' ? 'var(--color-primary-600)' : 'transparent',
                color: activeTab === 'wanted' ? '#ffffff' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Wanted Requests
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${notification.type === 'error' ? 'var(--color-danger)' : '#10b981'}`,
            borderRadius: 'var(--radius-sm)',
            color: notification.type === 'error' ? '#f87171' : '#34d399',
            fontSize: '0.85rem'
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Filters Bar */}
      <AdminFilterBar
        onReset={() => {
          setSearch('');
          setCategoryFilter('');
          setStatusFilter('');
          setSharingTypeFilter('');
          setPage(1);
        }}
        hasActiveFilters={Boolean(search || categoryFilter || statusFilter || sharingTypeFilter)}
      >
        <AdminSearch
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search listing titles..."
        />

        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '8px 12px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 'var(--radius-sm)',
            color: '#f8fafc',
            fontSize: '0.85rem'
          }}
        >
          <option value="">All Categories</option>
          <option value="books">Books</option>
          <option value="electronics">Electronics</option>
          <option value="education">Study Materials</option>
          <option value="furniture">Furniture</option>
          <option value="clothing">Clothing</option>
          <option value="sports">Sports</option>
          <option value="tools">Tools</option>
          <option value="home">Home Items</option>
          <option value="accessories">Accessories</option>
          <option value="mobility">Vehicles / Mobility</option>
          <option value="other">Other</option>
        </select>

        {activeTab === 'items' && (
          <select
            value={sharingTypeFilter}
            onChange={(e) => {
              setSharingTypeFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-sm)',
              color: '#f8fafc',
              fontSize: '0.85rem'
            }}
          >
            <option value="">All Sharing Types</option>
            <option value="give_away">Give Away</option>
            <option value="borrow">Borrow</option>
            <option value="exchange">Exchange</option>
            <option value="free">Free</option>
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '8px 12px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 'var(--radius-sm)',
            color: '#f8fafc',
            fontSize: '0.85rem'
          }}
        >
          <option value="">All Statuses</option>
          <option value="pending moderation">Pending Moderation</option>
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended / Hidden</option>
          <option value="removed">Removed</option>
        </select>
      </AdminFilterBar>

      {/* Main Table */}
      <AdminTable
        columns={activeTab === 'items' ? itemColumns : wantedColumns}
        data={activeTab === 'items' ? items : wantedItems}
        isLoading={isLoading}
        emptyMessage={`No ${activeTab === 'items' ? 'items' : 'wanted requests'} found matching current criteria.`}
      />

      {/* Pagination */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={15}
        onPageChange={(newPage) => setPage(newPage)}
      />

      {/* Moderation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(modTargetItem)}
        title={
          modAction === 'delete_permanently'
            ? `Delete "${modTargetItem?.title}" from Database?`
            : modAction === 'remove'
            ? `Remove "${modTargetItem?.title}"?`
            : modAction === 'hide'
            ? `Hide "${modTargetItem?.title}" from search?`
            : `Restore "${modTargetItem?.title}" to active?`
        }
        message={
          modAction === 'delete_permanently'
            ? `⚠️ CRITICAL: This will permanently erase "${modTargetItem?.title}" from the PostgreSQL database and storage. It cannot be recovered.`
            : modAction === 'remove'
            ? 'Removing this item will revoke public visibility. Historical transaction records will be preserved safely. Items in active exchange cannot be removed.'
            : modAction === 'hide'
            ? 'Hiding will set the item availability to Unavailable while under administrative review.'
            : 'Restoring will return the listing to active community discovery.'
        }
        confirmLabel={
          modAction === 'delete_permanently'
            ? 'Delete from Database'
            : modAction === 'remove'
            ? 'Remove Listing'
            : modAction === 'hide'
            ? 'Hide Listing'
            : 'Restore Listing'
        }
        confirmVariant={modAction === 'delete_permanently' || modAction === 'remove' ? 'danger' : modAction === 'hide' ? 'warning' : 'primary'}
        requireReason={modAction !== 'restore' && modAction !== 'delete_permanently'}
        reasonPlaceholder="Specify moderation reason (e.g. prohibited goods, inaccurate description, copyright issue)..."
        isLoading={isModLoading}
        onConfirm={handleConfirmModeration}
        onCancel={() => setModTargetItem(null)}
      />

      {/* Item Details Modal */}
      {isDetailsOpen && detailsItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                {detailsItem.title}
              </h2>
              <StatusBadge status={detailsItem.status} />
            </div>

            {detailsLoading ? (
              <div style={{ padding: '36px', textAlign: 'center' }}>
                <Spinner size="md" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.875rem' }}>
                {/* Images Preview */}
                {detailsItem.images?.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {detailsItem.images.map((img, i) => {
                      const imgUrl = typeof img === 'string' ? img : (img?.url || '');
                      return (
                        <img
                          key={i}
                          src={imgUrl}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=100';
                          }}
                          style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Description */}
                <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>Description</span>
                  <p style={{ color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>{detailsItem.description}</p>
                </div>

                {/* Metadata Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Category</span>
                    <span style={{ color: '#f8fafc', display: 'block' }}>{detailsItem.category}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Sharing Model</span>
                    <span style={{ color: '#f8fafc', display: 'block', textTransform: 'capitalize' }}>
                      {detailsItem.sharingType?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Condition</span>
                    <span style={{ color: '#f8fafc', display: 'block', textTransform: 'capitalize' }}>
                      {detailsItem.condition?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Owner</span>
                    <span style={{ color: '#f8fafc', display: 'block' }}>
                      {detailsItem.owner?.name} ({detailsItem.owner?.email})
                    </span>
                    {detailsItem.owner?.phone && (
                      <span style={{ color: '#34d399', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>
                        📞 Phone: {detailsItem.owner.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Active Transaction Warning */}
                {fullDetails?.hasActiveTransaction && (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fbbf24',
                      fontSize: '0.8rem'
                    }}
                  >
                    ⚠️ This item is currently locked in an active handover or exchange transaction.
                  </div>
                )}

                {/* Reward / Coins Status */}
                {(detailsItem.coins_awarded || detailsItem.coinsAwarded) ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 14px',
                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#facc15',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}
                  >
                    <Sparkles size={16} />
                    <span>Reward Credited: +{detailsItem.coins_awarded || detailsItem.coinsAwarded} Coins transferred to contributor's account</span>
                  </div>
                ) : (detailsItem.status === 'active' || detailsItem.status === 'approved') ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div>
                      <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem', display: 'block' }}>Platform Reward</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Award LOOOP coins to {detailsItem.owner?.name} for this contribution</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAwardItem(detailsItem);
                        setAwardCoins(50);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        backgroundColor: '#eab308',
                        border: 'none',
                        borderRadius: 'var(--radius-xs)',
                        color: '#713f12',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      <Coins size={14} />
                      <span>Award Coins</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(detailsItem.status === 'pending moderation' || detailsItem.status === 'pending_approval' || detailsItem.approvalStatus === 'PENDING') && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleApproveItem(detailsItem._id || detailsItem.id);
                        setIsDetailsOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: '#022c22',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <CheckCircle size={14} />
                      <span>Approve &amp; Publish</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectItem(detailsItem)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#f87171',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <XCircle size={14} />
                      <span>Reject</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleOpenModeration(detailsItem, 'delete_permanently');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete from DB</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#334155',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f8fafc',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Award Coins Modal */}
      {awardItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#facc15'
                }}
              >
                <Coins size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Award Contribution Coins
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Reward contributor for sharing a high-quality product
                </span>
              </div>
            </div>

            {/* Contributor & Product Summary */}
            <div style={{ backgroundColor: '#0f172a', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Contributor</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                  {awardItem.owner?.name || 'Contributor'} ({awardItem.owner?.email || ''})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Product</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>
                  {awardItem.title}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Condition / Sharing</span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', textTransform: 'capitalize' }}>
                  {awardItem.condition?.replace(/_/g, ' ') || 'Good'} • {awardItem.sharingType?.replace(/_/g, ' ') || 'Sharing'}
                </span>
              </div>
            </div>

            {/* Quick Coin Select */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Select Coin Amount
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {[25, 50, 100, 200].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAwardCoins(amt)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: awardCoins === amt ? 'rgba(234, 179, 8, 0.25)' : '#0f172a',
                      border: `1px solid ${awardCoins === amt ? '#eab308' : '#334155'}`,
                      borderRadius: 'var(--radius-xs)',
                      color: awardCoins === amt ? '#facc15' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    +{amt} Coins
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="10000"
                value={awardCoins}
                onChange={(e) => setAwardCoins(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              />
            </div>

            {/* Admin Note / Reason */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Reward Policy / Note
              </label>
              <input
                type="text"
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder="e.g. Quality product contribution approved"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f8fafc',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setAwardItem(null)}
                disabled={isAwardLoading}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#334155',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: isAwardLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAwardCoinsSubmit}
                disabled={isAwardLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 20px',
                  backgroundColor: '#eab308',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#713f12',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: isAwardLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isAwardLoading ? <Spinner size="xs" /> : <Coins size={16} />}
                <span>Confirm &amp; Award {awardCoins} Coins</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Listing Modal */}
      {rejectItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f87171'
                }}
              >
                <XCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Reject Product Listing
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Provide feedback to the contributor explaining the rejection
                </span>
              </div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '14px' }}>
              Are you sure you want to reject <strong style={{ color: '#f8fafc' }}>"{rejectItem.title}"</strong>?
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Rejection Reason (Sent to Contributor)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Inappropriate item, poor photo quality, or incomplete description..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                disabled={isRejectLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#334155',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: isRejectLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectItemSubmit}
                disabled={isRejectLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: isRejectLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isRejectLoading ? <Spinner size="xs" /> : <XCircle size={14} />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminItemsPage;
