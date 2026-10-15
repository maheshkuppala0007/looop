import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Eye, CheckCircle2, Clock, XCircle, ArrowRight } from 'lucide-react';
import adminService from '../../services/adminService';
import AdminTable from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import Avatar from '../../components/common/Avatar';
import Spinner from '../../components/common/Spinner';

export const AdminRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Request Details Modal State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getRequests({
        page,
        limit: 15,
        status: statusFilter,
        type: typeFilter
      });
      if (res?.success) {
        setRequests(res.data.requests || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenDetails = async (reqItem) => {
    setIsDetailsOpen(true);
    try {
      setDetailsLoading(true);
      const res = await adminService.getRequestDetails(reqItem._id);
      if (res?.success) {
        setSelectedRequest(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch request details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const columns = [
    {
      header: 'Item',
      accessor: 'item',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={r.item?.images?.[0]?.url || (typeof r.item?.images?.[0] === 'string' ? r.item.images[0] : '')}
            alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-xs)', objectFit: 'cover', backgroundColor: '#334155' }}
          />
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{r.item?.title || 'Shared Item'}</span>
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
      header: 'Owner',
      accessor: 'owner',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Avatar src={r.owner?.avatar} name={r.owner?.name || 'Owner'} size="xs" />
          <span style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>{r.owner?.name}</span>
        </div>
      )
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (r) => (
        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
          {r.type?.replace(/_/g, ' ')}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      header: 'Created',
      render: (r) => (
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => handleOpenDetails(r)}
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
          <span>Inspect</span>
        </button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
          Community Exchange Requests
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
          Monitor neighbor borrowing, gifting, and exchange requests and their approval statuses.
        </p>
      </div>

      <AdminFilterBar
        onReset={() => {
          setStatusFilter('');
          setTypeFilter('');
          setPage(1);
        }}
        hasActiveFilters={Boolean(statusFilter || typeFilter)}
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
            borderRadius: 'var(--radius-sm)',
            color: '#f8fafc',
            fontSize: '0.85rem'
          }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
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
          <option value="">All Request Types</option>
          <option value="REQUEST_ITEM">Receive Item</option>
          <option value="BORROW">Borrow Item</option>
          <option value="EXCHANGE">Exchange Item</option>
          <option value="OFFER">Wanted Offer</option>
        </select>
      </AdminFilterBar>

      <AdminTable
        columns={columns}
        data={requests}
        isLoading={isLoading}
        emptyMessage="No exchange requests recorded matching this filter."
      />

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={15}
        onPageChange={(newPage) => setPage(newPage)}
      />

      {/* Details Modal */}
      {isDetailsOpen && (
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
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Request Details
              </h2>
              {selectedRequest && <StatusBadge status={selectedRequest.status} />}
            </div>

            {detailsLoading || !selectedRequest ? (
              <div style={{ padding: '36px', textAlign: 'center' }}>
                <Spinner size="md" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Target Item</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedRequest.item?.title}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Requester</span>
                    <span style={{ color: '#cbd5e1' }}>{selectedRequest.requester?.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>{selectedRequest.requester?.email}</span>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Owner</span>
                    <span style={{ color: '#cbd5e1' }}>{selectedRequest.owner?.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>{selectedRequest.owner?.email}</span>
                  </div>
                </div>

                {selectedRequest.message && (
                  <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>Requester Note</span>
                    <p style={{ color: '#cbd5e1', margin: 0 }}>{selectedRequest.message}</p>
                  </div>
                )}

                {selectedRequest.expectedReturnDate && (
                  <div style={{ backgroundColor: '#0f172a', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Expected Return Date: </span>
                    <span style={{ color: '#38bdf8' }}>{new Date(selectedRequest.expectedReturnDate).toLocaleDateString()}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Created: {new Date(selectedRequest.createdAt).toLocaleString()}</span>
                  <span>ID: {selectedRequest._id}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRequestsPage;
