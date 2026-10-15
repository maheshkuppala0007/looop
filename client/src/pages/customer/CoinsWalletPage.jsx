import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';

export const CoinsWalletPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    coinsBalance: 0,
    pointsBalance: 0,
    totalEarned: 0,
    totalRedeemed: 0,
    historyCount: 0,
    history: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWalletData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/coins');
      if (res.data?.success && res.data.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load coins wallet data:', err.message);
      setError('Unable to load wallet records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const getEntryBadge = (type, amount) => {
    if (type === 'CONTRIBUTION_REWARD' || type === 'REUSE_EARNED' || amount > 0) {
      return {
        label: 'Coin Credit',
        bg: '#ecfdf5',
        color: '#059669',
        border: '#a7f3d0'
      };
    }
    if (type === 'REDEMPTION_DEBIT') {
      return {
        label: 'Store Redemption',
        bg: '#eff6ff',
        color: '#2563eb',
        border: '#bfdbfe'
      };
    }
    if (type === 'REFUND_CREDIT') {
      return {
        label: 'Order Refund',
        bg: '#fef3c7',
        color: '#d97706',
        border: '#fde68a'
      };
    }
    return {
      label: type || 'Ledger Entry',
      bg: '#f1f5f9',
      color: '#475569',
      border: '#cbd5e1'
    };
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1rem 4rem 1rem' }} className="coins-wallet-page">
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
            <Coins size={28} color="#eab308" />
            <h1 style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              My LOOOP Coins & Wallet
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
            Every circular reuse, share, and contribution earns verified platform coins that never expire.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={fetchWalletData} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" iconLeft={Gift} onClick={() => navigate('/rewards')}>
            Rewards Store
          </Button>
        </div>
      </div>

      {/* 2. Balance & Statistics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}
      >
        {/* Main Available Coins Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%)',
            borderRadius: '20px',
            padding: '1.75rem',
            color: '#ffffff',
            boxShadow: '0 10px 20px -5px rgba(5, 150, 105, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a7f3d0' }}>
              Available Balance
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <Coins size={36} color="#fde047" />
              <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>
                {loading ? '...' : data.coinsBalance.toLocaleString()}
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#a7f3d0' }}>Coins</span>
            </div>
          </div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#d1fae5' }}>Safe & Auditable Ledger</span>
            <button
              type="button"
              onClick={() => navigate('/rewards')}
              style={{
                backgroundColor: '#ffffff',
                color: '#065f46',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Redeem Prizes →
            </button>
          </div>
        </div>

        {/* Total Earned Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '1.75rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                Total Coins Earned
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowUpRight size={18} color="#059669" />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
              +{loading ? '...' : data.totalEarned.toLocaleString()}
            </div>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem' }}>
            From shared goods and community reuse
          </span>
        </div>

        {/* Total Redeemed Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '1.75rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
                Total Spent on Prizes
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowDownRight size={18} color="#2563eb" />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
              -{loading ? '...' : data.totalRedeemed.toLocaleString()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/rewards/orders')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#2563eb',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '1rem'
            }}
          >
            <span>View Orders ({loading ? '...' : data.history.filter(h => h.type === 'REDEMPTION_DEBIT').length})</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 3. Auditable Transaction Ledger Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Auditable Transaction Ledger
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Immutable record of every coin credit, debit, and adjustment
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '12px' }}>
            {data.historyCount} Transactions
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <Spinner size="md" />
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '8px' }}>Loading transaction ledger...</p>
          </div>
        ) : data.history.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <EmptyState
              icon={Coins}
              title="No Ledger Activity Yet"
              description="Share unused items or complete circular transactions to start earning LOOOP Coins!"
              actionLabel="Share an Item Now"
              onAction={() => navigate('/share')}
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 18px' }}>Date & Time</th>
                  <th style={{ padding: '12px 18px' }}>Transaction Details</th>
                  <th style={{ padding: '12px 18px' }}>Classification</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((entry, idx) => {
                  const isCredit = entry.amount > 0;
                  const badge = getEntryBadge(entry.type, entry.amount);

                  return (
                    <tr
                      key={entry.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '14px 18px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDate ? formatDate(entry.createdAt) : new Date(entry.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: 600 }}>
                        {entry.reason || 'Circular Platform Activity'}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, fontSize: '0.925rem', color: isCredit ? '#059669' : '#dc2626' }}>
                        {isCredit ? `+${entry.amount}` : entry.amount} coins
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right', color: '#0f172a', fontWeight: 700 }}>
                        {entry.balanceAfter !== undefined ? `${entry.balanceAfter} coins` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoinsWalletPage;
