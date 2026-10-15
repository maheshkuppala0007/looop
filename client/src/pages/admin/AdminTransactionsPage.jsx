import React, { useState, useEffect, useCallback } from 'react';
import { Repeat, Eye, Calendar, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';
import adminService from '../../services/adminService';
import AdminTable from '../../components/admin/AdminTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import Avatar from '../../components/common/Avatar';
import Spinner from '../../components/common/Spinner';

export const AdminTransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Transaction Details Modal State
  const [selectedTx, setSelectedTx] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [txDetailsData, setTxDetailsData] = useState(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getTransactions({
        page,
        limit: 15,
        status: statusFilter,
        type: typeFilter
      });
      if (res?.success) {
        setTransactions(res.data.transactions || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleOpenDetails = async (tx) => {
    setSelectedTx(tx);
    setIsDetailsOpen(true);
    try {
      setDetailsLoading(true);
      const res = await adminService.getTransactionDetails(tx._id);
      if (res?.success) {
        setTxDetailsData(res.data);
      }
    } catch (err) {
      console.error('Failed to load transaction details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const columns = [
    {
      header: 'Item',
      accessor: 'item',
      render: (tx) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src={tx.item?.images?.[0]?.url || (typeof tx.item?.images?.[0] === 'string' ? tx.item.images[0] : '')}
            alt=""
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-xs)', objectFit: 'cover', backgroundColor: '#334155' }}
          />
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{tx.item?.title || 'Shared Product'}</span>
        </div>
      )
    },
    {
      header: 'Owner',
      accessor: 'owner',
      render: (tx) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Avatar src={tx.owner?.avatar} name={tx.owner?.name || 'Owner'} size="xs" />
          <span style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>{tx.owner?.name}</span>
        </div>
      )
    },
    {
      header: 'Recipient',
      accessor: 'recipient',
      render: (tx) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Avatar src={tx.recipient?.avatar} name={tx.recipient?.name || 'Recipient'} size="xs" />
          <span style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>{tx.recipient?.name}</span>
        </div>
      )
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (tx) => (
        <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
          {tx.type}
        </span>
      )
    },
    {
      header: 'Lifecycle Status',
      accessor: 'status',
      render: (tx) => <StatusBadge status={tx.status} />
    },
    {
      header: 'Created',
      render: (tx) => (
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
          {new Date(tx.createdAt).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (tx) => (
        <button
          type="button"
          onClick={() => handleOpenDetails(tx)}
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
          <span>Oversight</span>
        </button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
          Handover & Circulation Oversight
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
          Real-time monitoring of item exchanges, handover status, borrow returns, and reviews.
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
          <option value="">All Lifecycle Stages</option>
          <option value="PENDING_HANDOVER">Pending Handover</option>
          <option value="HANDOVER_SCHEDULED">Handover Scheduled</option>
          <option value="HANDED_OVER">Handed Over</option>
          <option value="ACTIVE">Active (Borrowed)</option>
          <option value="RETURN_PENDING">Return Pending</option>
          <option value="RETURNED">Returned</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
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
          <option value="">All Transaction Types</option>
          <option value="FREE">Free</option>
          <option value="GIVEAWAY">Giveaway</option>
          <option value="BORROW">Borrow</option>
          <option value="EXCHANGE">Exchange</option>
        </select>
      </AdminFilterBar>

      <AdminTable
        columns={columns}
        data={transactions}
        isLoading={isLoading}
        emptyMessage="No circular transactions match the selected filters."
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
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Transaction Oversight
              </h2>
              {txDetailsData?.transaction && <StatusBadge status={txDetailsData.transaction.status} />}
            </div>

            {detailsLoading || !txDetailsData ? (
              <div style={{ padding: '36px', textAlign: 'center' }}>
                <Spinner size="md" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Transacted Item</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{txDetailsData.transaction.item?.title}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Item Owner</span>
                    <span style={{ color: '#cbd5e1' }}>{txDetailsData.transaction.owner?.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>{txDetailsData.transaction.owner?.email}</span>
                  </div>
                  <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Recipient</span>
                    <span style={{ color: '#cbd5e1' }}>{txDetailsData.transaction.recipient?.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>{txDetailsData.transaction.recipient?.email}</span>
                  </div>
                </div>

                {/* Reviews on Transaction */}
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                    Transaction Reviews ({txDetailsData.reviews?.length || 0})
                  </h3>
                  {txDetailsData.reviews?.length === 0 ? (
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No reviews recorded for this transaction yet.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {txDetailsData.reviews.map((rev) => (
                        <div key={rev._id} style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{rev.reviewer?.name}</span>
                            <span style={{ color: '#fbbf24' }}>★ {rev.rating} / 5</span>
                          </div>
                          <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>"{rev.comment}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Created: {new Date(txDetailsData.transaction.createdAt).toLocaleString()}</span>
                  <span>Tx ID: {txDetailsData.transaction._id}</span>
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

export default AdminTransactionsPage;
