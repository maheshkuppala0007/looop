import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Eye, CheckCircle2, Clock } from 'lucide-react';
import adminService from '../../services/adminService';
import AdminTable from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import Avatar from '../../components/common/Avatar';
import Spinner from '../../components/common/Spinner';

export const AdminReuseRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getRequests({
        page,
        limit: 15,
        status: statusFilter,
        type: 'REQUEST_ITEM'
      });
      if (res?.success) {
        setRequests(res.data.requests || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load reuse requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const columns = [
    {
      header: 'Reuse Product',
      accessor: 'item',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={r.item?.images?.[0]?.url || (typeof r.item?.images?.[0] === 'string' ? r.item.images[0] : '')}
            alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', backgroundColor: '#334155' }}
          />
          <span style={{ fontWeight: 700, color: '#f8fafc' }}>{r.item?.title || 'Reuse Item'}</span>
        </div>
      )
    },
    {
      header: 'Requester',
      accessor: 'requester',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Avatar src={r.requester?.avatar} name={r.requester?.name || 'User'} size="xs" />
          <span style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>{r.requester?.name}</span>
        </div>
      )
    },
    {
      header: 'Product Owner',
      accessor: 'owner',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Avatar src={r.owner?.avatar} name={r.owner?.name || 'Owner'} size="xs" />
          <span style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>{r.owner?.name}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      header: 'Created Date',
      render: (r) => (
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          <Gift size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
            Reuse (Giveaway) Requests Oversight
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Monitor neighbor requests for free giveaway items and handovers.
          </p>
        </div>
      </div>

      <AdminFilterBar
        onReset={() => {
          setStatusFilter('');
          setPage(1);
        }}
        hasActiveFilters={Boolean(statusFilter)}
      >
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
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: '0.85rem'
          }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </AdminFilterBar>

      <AdminTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        emptyMessage="No reuse requests recorded matching this filter."
      />

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={15}
        onPageChange={(newPage) => setPage(newPage)}
      />
    </div>
  );
};

export default AdminReuseRequestsPage;
