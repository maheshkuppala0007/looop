import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  Phone,
  Key,
  Copy,
  Check,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2
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
let persistentUsers = null;
let persistentTotal = 0;
let persistentTotalPages = 1;
let persistentRoleCounts = null;
let usersAlreadyLoaded = false;

export const AdminUsersPage = () => {
  const [users, setUsers] = useState(() => {
    if (persistentUsers && persistentUsers.length > 0) return persistentUsers;
    try {
      const cached = localStorage.getItem('looop_admin_users_cache');
      const parsed = cached ? JSON.parse(cached) : [];
      if (parsed.length > 0) {
        persistentUsers = parsed;
        return parsed;
      }
    } catch {}
    return [];
  });
  const [total, setTotal] = useState(() => {
    if (persistentTotal > 0) return persistentTotal;
    try {
      const cached = localStorage.getItem('looop_admin_users_total');
      return cached ? parseInt(cached, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [totalPages, setTotalPages] = useState(() => persistentTotalPages || 1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleCounts, setRoleCounts] = useState(() => {
    if (persistentRoleCounts) return persistentRoleCounts;
    try {
      const cached = localStorage.getItem('looop_admin_users_counts');
      return cached ? JSON.parse(cached) : { all: 0, customers: 0, admins: 0, active: 0, suspended: 0 };
    } catch {
      return { all: 0, customers: 0, admins: 0, active: 0, suspended: 0 };
    }
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (persistentUsers && persistentUsers.length > 0) {
      return false;
    }
    return true;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Password Visibility & Copy State
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // User Details Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userDetailsData, setUserDetailsData] = useState(null);

  // Status Change Dialog State
  const [statusDialogTarget, setStatusDialogTarget] = useState(null);
  const [statusDialogAction, setStatusDialogAction] = useState('suspended');
  const [isStatusDialogLoading, setIsStatusDialogLoading] = useState(false);

  // Delete User Confirmation State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      const res = await adminService.getUsers({
        page,
        limit,
        search,
        role: roleFilter,
        status: statusFilter
      });
      if (res?.success) {
        const uList = res.data.users || [];
        setUsers(uList);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        persistentUsers = uList;
        persistentTotal = res.data.total || 0;
        persistentTotalPages = res.data.totalPages || 1;
        usersAlreadyLoaded = true;
        if (res.data.counts) {
          setRoleCounts(res.data.counts);
          persistentRoleCounts = res.data.counts;
          try { localStorage.setItem('looop_admin_users_counts', JSON.stringify(res.data.counts)); } catch {}
        }
        if (page === 1 && !search && !roleFilter && !statusFilter) {
          try {
            localStorage.setItem('looop_admin_users_cache', JSON.stringify(uList));
            localStorage.setItem('looop_admin_users_total', String(res.data.total || 0));
          } catch {}
        }
      }
    } catch (err) {
      if (!silent) {
        console.error('Failed to fetch users:', err);
        setNotification({ type: 'error', message: 'Failed to retrieve registered users from database.' });
      }
    } finally {
      if (!silent) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, search, roleFilter, statusFilter]);

  // SWR: Render cached data immediately, but ALWAYS fetch live database users on mount!
  useEffect(() => {
    const hasCache = !!(persistentUsers && persistentUsers.length > 0);
    fetchUsers(hasCache);

    const interval = setInterval(() => {
      fetchUsers(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchUsers, page, limit, search, roleFilter, statusFilter]);

  const handleOpenDetails = async (user) => {
    setSelectedUser(user);
    setIsDetailsOpen(true);
    try {
      setDetailsLoading(true);
      const res = await adminService.getUserDetails(user._id);
      if (res?.success) {
        setUserDetailsData(res.data);
      }
    } catch (err) {
      console.error('Failed to load user details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenStatusDialog = (user, targetAction) => {
    setStatusDialogTarget(user);
    setStatusDialogAction(targetAction);
  };

  const handleConfirmStatusChange = async (reason) => {
    if (!statusDialogTarget) return;
    try {
      setIsStatusDialogLoading(true);
      const res = await adminService.updateUserStatus(statusDialogTarget._id, {
        accountStatus: statusDialogAction,
        reason
      });
      if (res?.success) {
        setNotification({
          type: 'success',
          message: `User ${statusDialogTarget.name} has been ${statusDialogAction === 'suspended' ? 'suspended' : 'activated'}.`
        });
        setStatusDialogTarget(null);
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update user status:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Error updating account status.'
      });
    } finally {
      setIsStatusDialogLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleteLoading(true);
      await adminService.deleteUser(deleteTarget._id || deleteTarget.id);
      try {
        const local = JSON.parse(localStorage.getItem('looop_registered_accounts') || '[]');
        const updated = local.filter((x) => x.email?.toLowerCase() !== deleteTarget.email?.toLowerCase());
        localStorage.setItem('looop_registered_accounts', JSON.stringify(updated));
      } catch {}
      setNotification({
        type: 'success',
        message: `User account for ${deleteTarget.name || deleteTarget.email} was removed permanently from the database.`
      });
      setDeleteTarget(null);
      persistentUsers = null;
      fetchUsers(false);
    } catch (err) {
      console.error('Failed to delete user:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Failed to delete user account.'
      });
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Auto-refresh when new user registers anywhere in the app
  useEffect(() => {
    const handleUsersUpdated = () => {
      fetchUsers(false);
    };
    window.addEventListener('looop_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('looop_users_updated', handleUsersUpdated);
  }, [fetchUsers]);

  const columns = [
    {
      header: 'User',
      accessor: 'name',
      width: '24%',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar src={u.avatar} name={u.name} size="sm" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc' }}>{u.name}</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.email}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Mobile / Phone',
      accessor: 'phone',
      width: '13%',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: u.phone ? '#f1f5f9' : '#64748b' }}>
          <Phone size={13} style={{ color: u.phone ? '#10b981' : '#64748b', flexShrink: 0 }} />
          <span>{u.phone || '—'}</span>
        </div>
      )
    },
    {
      header: 'Password',
      width: '18%',
      render: (u) => {
        const isVisible = !!visiblePasswords[u._id];
        const pwd = u.plainPassword || (u.password && !u.password.startsWith('$2') && u.password !== '••••••••' ? u.password : '') || 'Secret@123';
        const isCopied = copiedId === u._id;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <span
              style={{
                fontFamily: isVisible ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit',
                fontSize: '0.8rem',
                color: isVisible ? '#38bdf8' : '#94a3b8',
                backgroundColor: isVisible ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.7)',
                border: isVisible ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid #334155',
                padding: '3px 8px',
                borderRadius: '5px',
                maxWidth: '130px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: isVisible ? 700 : 400,
                letterSpacing: isVisible ? '0.02em' : '0.12em',
                userSelect: 'all'
              }}
              title={isVisible ? pwd : 'Click eye icon to reveal password'}
            >
              {isVisible ? pwd : '••••••••'}
            </span>
            <button
              type="button"
              title={isVisible ? 'Hide Password' : 'Show Password'}
              onClick={() => setVisiblePasswords(prev => ({ ...prev, [u._id]: !prev[u._id] }))}
              style={{
                background: 'none',
                border: 'none',
                color: isVisible ? '#38bdf8' : '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
            >
              {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              type="button"
              title="Copy Password"
              onClick={() => {
                navigator.clipboard.writeText(pwd);
                setCopiedId(u._id);
                setTimeout(() => setCopiedId(null), 2000);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: isCopied ? '#10b981' : '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px'
              }}
            >
              {isCopied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
        );
      }
    },
    {
      header: 'Role',
      accessor: 'role',
      render: (u) => (
        <span
          style={{
            fontSize: '0.725rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: u.role === 'admin' ? 'rgba(99, 102, 241, 0.2)' : '#334155',
            color: u.role === 'admin' ? '#818cf8' : '#cbd5e1'
          }}
        >
          {u.role}
        </span>
      )
    },
    {
      header: 'Account Status',
      accessor: 'accountStatus',
      render: (u) => <StatusBadge status={u.accountStatus || 'active'} />
    },
    {
      header: 'Member Since',
      accessor: 'createdAt',
      render: (u) => (
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
          {new Date(u.createdAt).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Circulation Activity',
      render: (u) => (
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: '#cbd5e1' }}>
          <span>Items: {u.itemsCount || 0}</span>
          <span>•</span>
          <span>Completed: {u.completedTransactionsCount || 0}</span>
        </div>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleOpenDetails(u)}
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
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Eye size={13} />
            <span>Details</span>
          </button>

          {u.accountStatus === 'suspended' ? (
            <button
              type="button"
              onClick={() => handleOpenStatusDialog(u, 'active')}
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
              <UserCheck size={13} />
              <span>Activate</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenStatusDialog(u, 'suspended')}
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
              <UserX size={13} />
              <span>Suspend</span>
            </button>
          )}

          {!['looop.support@gmail.com', 'maheshkuppala321@gmail.com', 'admin@looop.community'].includes(u.email?.toLowerCase()) && (
            <button
              type="button"
              title="Delete user account permanently"
              onClick={() => setDeleteTarget(u)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-xs)',
                color: '#f87171',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
            User Governance
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Manage registered members, inspect circulation activity, and administer account standing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '5px 12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            <span>Auto-Sync Active</span>
          </div>
          <button
            type="button"
            onClick={() => fetchUsers(false)}
            disabled={isLoading || isRefreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: (isLoading || isRefreshing) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={14} style={{ animation: (isLoading || isRefreshing) ? 'spin 1s linear infinite' : 'none' }} />
            <span>{(isLoading || isRefreshing) ? 'Updating...' : 'Refresh'}</span>
          </button>
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

      {/* Role & Standing Quick Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            borderRadius: '8px',
            backgroundColor: (!roleFilter && !statusFilter) ? '#0284c7' : '#1e293b',
            color: (!roleFilter && !statusFilter) ? '#ffffff' : '#94a3b8',
            border: `1px solid ${(!roleFilter && !statusFilter) ? '#38bdf8' : '#334155'}`,
            fontSize: '0.825rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span>All Users</span>
          <span style={{ backgroundColor: (!roleFilter && !statusFilter) ? '#0369a1' : '#0f172a', color: (!roleFilter && !statusFilter) ? '#ffffff' : '#cbd5e1', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
            {roleCounts.all || total || 5}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setSearch(''); setRoleFilter('customer'); setStatusFilter(''); setPage(1); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            borderRadius: '8px',
            backgroundColor: roleFilter === 'customer' ? '#059669' : '#1e293b',
            color: roleFilter === 'customer' ? '#ffffff' : '#94a3b8',
            border: `1px solid ${roleFilter === 'customer' ? '#34d399' : '#334155'}`,
            fontSize: '0.825rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span>Customers</span>
          <span style={{ backgroundColor: roleFilter === 'customer' ? '#047857' : '#0f172a', color: roleFilter === 'customer' ? '#ffffff' : '#34d399', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
            {roleCounts.customers ?? 1}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setSearch(''); setRoleFilter('admin'); setStatusFilter(''); setPage(1); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            borderRadius: '8px',
            backgroundColor: roleFilter === 'admin' ? '#4f46e5' : '#1e293b',
            color: roleFilter === 'admin' ? '#ffffff' : '#94a3b8',
            border: `1px solid ${roleFilter === 'admin' ? '#818cf8' : '#334155'}`,
            fontSize: '0.825rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span>Administrators</span>
          <span style={{ backgroundColor: roleFilter === 'admin' ? '#4338ca' : '#0f172a', color: roleFilter === 'admin' ? '#ffffff' : '#818cf8', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
            {roleCounts.admins ?? 4}
          </span>
        </button>

        <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#64748b' }}>
          Breakdown: <strong style={{ color: '#34d399' }}>{roleCounts.customers ?? 1} Customer{(roleCounts.customers === 1 ? '' : 's')}</strong> + <strong style={{ color: '#818cf8' }}>{roleCounts.admins ?? 4} Admins</strong> = <strong style={{ color: '#f8fafc' }}>{roleCounts.all || total || 5} Total Users</strong>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <AdminFilterBar
        onReset={() => {
          setSearch('');
          setRoleFilter('');
          setStatusFilter('');
          setPage(1);
        }}
        hasActiveFilters={Boolean(search || roleFilter || statusFilter)}
      >
        <AdminSearch
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search by name or email..."
        />

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
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
          <option value="">All Roles</option>
          <option value="customer">Customer</option>
          <option value="admin">Administrator</option>
        </select>

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
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </AdminFilterBar>

      {/* Users Table */}
      <AdminTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No registered users match your search criteria."
      />

      {/* Pagination with rows per page selector and smart Next/Previous controls */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={(newPage) => setPage(newPage)}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        limitOptions={[2, 5, 10, 15, 25, 50]}
      />

      {/* User Details Modal */}
      {isDetailsOpen && selectedUser && (
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar src={selectedUser.avatar} name={selectedUser.name} size="md" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    {selectedUser.name}
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{selectedUser.email}</span>
                </div>
              </div>
              <StatusBadge status={selectedUser.accountStatus || 'active'} />
            </div>

            {detailsLoading ? (
              <div style={{ padding: '36px', textAlign: 'center' }}>
                <Spinner size="md" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.875rem' }}>
                {/* Customer Account & Authentication Credentials */}
                <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid #334155' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#38bdf8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={15} /> Customer Account & Login Credentials
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Full Name</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedUser.name}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Email Address</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedUser.email}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Mobile / Phone Number</span>
                      <span style={{ color: (selectedUser.phone || userDetailsData?.user?.phone) ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                        {selectedUser.phone || userDetailsData?.user?.phone || 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Account Password</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        {(() => {
                          const modalPwd = selectedUser.plainPassword || userDetailsData?.user?.plainPassword || (selectedUser.password && !selectedUser.password.startsWith('$2') && selectedUser.password !== '••••••••' ? selectedUser.password : '') || 'Secret@123';
                          return (
                            <>
                              <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                                {visiblePasswords['modal'] ? modalPwd : '••••••••'}
                              </span>
                              <button
                                type="button"
                                title={visiblePasswords['modal'] ? 'Hide Password' : 'Show Password'}
                                onClick={() => setVisiblePasswords(prev => ({ ...prev, modal: !prev.modal }))}
                                style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
                              >
                                {visiblePasswords['modal'] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                type="button"
                                title="Copy Password"
                                onClick={() => {
                                  navigator.clipboard.writeText(modalPwd);
                                  setCopiedId('modal');
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                style={{ background: 'none', border: 'none', color: copiedId === 'modal' ? '#10b981' : '#94a3b8', cursor: 'pointer', padding: 0 }}
                              >
                                {copiedId === 'modal' ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Overview */}
                <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Location</span>
                      <span style={{ color: '#f8fafc' }}>
                        {selectedUser.city || 'Not specified'}, {selectedUser.state || ''}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Trust Score</span>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>{selectedUser.trustScore || 95} / 100</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Registered</span>
                      <span style={{ color: '#cbd5e1' }}>{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>User ID</span>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'monospace' }}>{selectedUser._id}</span>
                    </div>
                  </div>
                </div>

                {/* Circulation Records */}
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                    Recent Listings ({userDetailsData?.items?.length || 0})
                  </h3>
                  {userDetailsData?.items?.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>No listings created by this user.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {userDetailsData?.items?.slice(0, 5).map((item) => (
                        <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#0f172a', borderRadius: 'var(--radius-xs)' }}>
                          <span style={{ color: '#cbd5e1' }}>{item.title}</span>
                          <StatusBadge status={item.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Moderation History */}
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                    Moderation Reports Involving User ({userDetailsData?.reportsAgainst?.length || 0})
                  </h3>
                  {userDetailsData?.reportsAgainst?.length === 0 ? (
                    <p style={{ color: '#10b981', fontSize: '0.8rem' }}>✓ Clean standing. No reports filed against this user.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {userDetailsData?.reportsAgainst?.map((rep) => (
                        <div key={rep._id} style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-xs)' }}>
                          <span style={{ color: '#f87171', fontWeight: 600 }}>{rep.reason}</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>{rep.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
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

      {/* Confirmation Dialog for Suspension / Activation */}
      <ConfirmDialog
        isOpen={Boolean(statusDialogTarget)}
        title={statusDialogAction === 'suspended' ? `Suspend ${statusDialogTarget?.name}?` : `Reactivate ${statusDialogTarget?.name}?`}
        message={
          statusDialogAction === 'suspended'
            ? 'Suspended users will be immediately blocked from signing in, publishing listings, sending messages, or requesting items.'
            : 'Reactivating this user will restore their standard platform access privileges.'
        }
        confirmLabel={statusDialogAction === 'suspended' ? 'Suspend Account' : 'Reactivate Account'}
        confirmVariant={statusDialogAction === 'suspended' ? 'danger' : 'primary'}
        requireReason={statusDialogAction === 'suspended'}
        reasonPlaceholder="Specify violation (e.g. fraudulent listing, harassment, terms violation)..."
        isLoading={isStatusDialogLoading}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusDialogTarget(null)}
      />

      {/* Confirmation Dialog for Permanent User Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={`Permanently Delete ${deleteTarget?.name || deleteTarget?.email}?`}
        message={`Are you sure you want to permanently delete ${deleteTarget?.email} from the database? Once deleted, this email address will be immediately freed up and eligible for new registration.`}
        confirmLabel="Delete User Permanently"
        confirmVariant="danger"
        isLoading={isDeleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AdminUsersPage;
