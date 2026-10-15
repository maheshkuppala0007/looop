import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  Coins,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  Plus,
  MapPin,
  ChevronRight,
  X,
  Package
} from 'lucide-react';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

const CATEGORIES = [
  'All',
  'Home & Kitchen',
  'Kitchen Appliances',
  'Electronics',
  'Household Products',
  'Personal Care'
];

export const RewardsStorePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [storeEnabled, setStoreEnabled] = useState(true);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [rewards, setRewards] = useState([]);
  const [totalRewards, setTotalRewards] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  // Customer Coin Balance
  const [balance, setBalance] = useState({ coins: 0, points: 0 });
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Redemption Modal State
  const [redeemProduct, setRedeemProduct] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  // New Address Form
  const [addressForm, setAddressForm] = useState({
    recipientName: user?.name || '',
    phone: user?.phone || '',
    addressLine1: '',
    addressLine2: '',
    locality: '',
    city: user?.city || '',
    state: user?.state || '',
    postalCode: '',
    country: 'India',
    deliveryInstructions: '',
    saveAddress: true
  });

  // Load Balance & Store
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Store Catalog
      const query = new URLSearchParams();
      if (selectedCategory !== 'All') query.append('category', selectedCategory);
      if (searchQuery.trim()) query.append('search', searchQuery.trim());
      if (sortBy) query.append('sort', sortBy);

      const res = await api.get(`/rewards?${query.toString()}`);
      if (res.data?.success) {
        setStoreEnabled(res.data.storeEnabled !== false);
        setMaintenanceMessage(res.data.maintenanceMessage || '');
        setRewards(res.data.rewards || []);
        setTotalRewards(res.data.total || 0);
      }

      // 2. Fetch User Coin Balance
      const bRes = await api.get('/coins/balance');
      if (bRes.data?.success) {
        setBalance({
          coins: bRes.data.coins || 0,
          points: bRes.data.points || 0
        });
      }
    } catch (err) {
      console.warn('Failed to load rewards store data:', err.message);
    } finally {
      setLoading(false);
      setBalanceLoading(false);
    }
  }, [selectedCategory, searchQuery, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Saved Addresses when opening redeem modal
  const handleOpenRedeemModal = async (product) => {
    setRedeemProduct(product);
    setOrderSuccess(null);
    try {
      const aRes = await api.get('/addresses');
      if (aRes.data?.success && aRes.data.addresses?.length > 0) {
        setSavedAddresses(aRes.data.addresses);
        const def = aRes.data.addresses.find((a) => a.isDefault) || aRes.data.addresses[0];
        setSelectedAddressId(def.id);
      } else {
        setSavedAddresses([]);
        setSelectedAddressId('new');
      }
    } catch {
      setSelectedAddressId('new');
    }
  };

  const handleConfirmRedeem = async (e) => {
    e.preventDefault();
    if (!redeemProduct) return;

    let deliveryPayload = null;
    let saveFlag = false;

    if (selectedAddressId !== 'new') {
      const chosen = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!chosen) {
        addToast({ title: 'Select Address', message: 'Please select a delivery address.', variant: 'warning' });
        return;
      }
      deliveryPayload = {
        recipientName: chosen.recipientName,
        phone: chosen.phone,
        addressLine1: chosen.addressLine1,
        addressLine2: chosen.addressLine2,
        locality: chosen.locality,
        city: chosen.city,
        state: chosen.state,
        postalCode: chosen.postalCode,
        country: chosen.country,
        deliveryInstructions: chosen.deliveryInstructions
      };
    } else {
      if (!addressForm.recipientName.trim() || !addressForm.phone.trim() || !addressForm.addressLine1.trim() || !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.postalCode.trim()) {
        addToast({ title: 'Incomplete Address', message: 'Please fill in all required delivery fields.', variant: 'warning' });
        return;
      }
      deliveryPayload = { ...addressForm };
      saveFlag = addressForm.saveAddress;
    }

    try {
      setIsRedeeming(true);
      const res = await api.post('/rewards/orders', {
        rewardProductId: redeemProduct.id,
        quantity: 1,
        deliveryAddress: deliveryPayload,
        saveAddress: saveFlag
      });

      if (res.data?.success) {
        setOrderSuccess(res.data.order);
        setBalance((prev) => ({
          ...prev,
          coins: res.data.newBalance ?? Math.max(0, prev.coins - redeemProduct.coinPrice)
        }));
        addToast({
          title: 'Order Confirmed! 🎉',
          message: `Your redemption order #${res.data.order?.orderNumber} has been submitted!`,
          variant: 'success'
        });
      }
    } catch (err) {
      addToast({
        title: 'Redemption Failed',
        message: err.response?.data?.message || 'Unable to complete prize redemption.',
        variant: 'danger'
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1rem 4rem 1rem' }} className="rewards-store-page">
      {/* 1. Header & Live Balance Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)',
          borderRadius: '24px',
          padding: '2.5rem 2rem',
          color: '#ffffff',
          marginBottom: '2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              <Gift size={14} />
              <span>LOOOP REWARDS STORE</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 900, margin: '0 0 0.5rem 0', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Redeem Community Coins for Prizes 🎁
            </h1>
            <p style={{ color: '#d1fae5', margin: 0, fontSize: '0.975rem', maxWidth: '580px', lineHeight: 1.5 }}>
              Use the coins you earned by sharing and reusing items in your community to claim mixers, electronics, home essentials, and gift prizes with free doorstep delivery.
            </p>
          </div>

          {/* User Balance Card */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '20px',
              padding: '1.25rem 1.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minWidth: '220px'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a7f3d0' }}>
              Your Available Coins
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 10px 0' }}>
              <Coins size={28} color="#fde047" />
              <span style={{ fontSize: '2.25rem', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                {balanceLoading ? '...' : balance.coins.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => navigate('/coins')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#6ee7b7',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>View Wallet & Ledger</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Store Offline Maintenance Alert if disabled by admin */}
      {!storeEnabled && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '2px solid #fecaca',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            color: '#991b1b'
          }}
        >
          <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800 }}>Rewards Store Temporarily Offline</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f1d1d', lineHeight: 1.5 }}>
              {maintenanceMessage || 'Our rewards store is undergoing maintenance or restocking. New redemption orders are temporarily paused. Existing orders are being dispatched normally.'}
            </p>
          </div>
        </div>
      )}

      {/* 3. Search & Category Filters Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: selectedCategory === cat ? '#059669' : '#e2e8f0',
                backgroundColor: selectedCategory === cat ? '#059669' : '#ffffff',
                color: selectedCategory === cat ? '#ffffff' : '#475569',
                fontSize: '0.85rem',
                fontWeight: selectedCategory === cat ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search and Sort */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search mixer, appliance..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '0.85rem',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="popular">Most Popular</option>
            <option value="price_asc">Coins: Low to High</option>
            <option value="price_desc">Coins: High to Low</option>
            <option value="newest">Newest Arrivals</option>
          </select>

          <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* 4. Products Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem 0' }}>
          <Spinner size="lg" />
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '1rem' }}>Loading rewards catalog...</p>
        </div>
      ) : rewards.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No Reward Prizes Found"
          description={searchQuery ? `No prizes match "${searchQuery}". Try clearing search filters.` : "The catalog is currently being updated with exciting new prizes."}
          actionLabel={searchQuery ? "Clear Filters" : "Refresh"}
          onAction={() => {
            setSearchQuery('');
            setSelectedCategory('All');
            loadData();
          }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {rewards.map((reward) => {
            const hasEnoughCoins = balance.coins >= reward.coinPrice;
            const shortfall = Math.max(0, reward.coinPrice - balance.coins);

            return (
              <div
                key={reward.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Product Image */}
                <div style={{ position: 'relative', height: '210px', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
                  <img
                    src={reward.primaryImage}
                    alt={reward.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '12px' }}
                  />
                  {reward.featured && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        backgroundColor: '#f59e0b',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      Featured Prize
                    </span>
                  )}
                  {reward.deliveryEligible && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        backgroundColor: 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(4px)',
                        color: '#065f46',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Truck size={12} />
                      <span>Free Doorstep Delivery</span>
                    </span>
                  )}
                </div>

                {/* Details */}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                      {reward.brand || reward.category}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: reward.stockQuantity > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {reward.stockQuantity > 0 ? (reward.stockQuantity <= 3 ? `Only ${reward.stockQuantity} left!` : 'In Stock') : 'Out of Stock'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.35, minHeight: '2.7rem' }}>
                    {reward.title}
                  </h3>

                  <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0 0 1rem 0', lineHeight: 1.4, flex: 1 }}>
                    {reward.shortDescription || 'Brand new platform prize eligible for instant coin redemption.'}
                  </p>

                  {/* Coin Price & CTA */}
                  <div style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                        Required Coins
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Coins size={18} color="#eab308" />
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                          {reward.coinPrice}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>coins</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!storeEnabled || reward.stockQuantity <= 0}
                      onClick={() => handleOpenRedeemModal(reward)}
                      style={{
                        backgroundColor: !storeEnabled || reward.stockQuantity <= 0 ? '#cbd5e1' : hasEnoughCoins ? '#059669' : '#f1f5f9',
                        color: !storeEnabled || reward.stockQuantity <= 0 ? '#64748b' : hasEnoughCoins ? '#ffffff' : '#059669',
                        border: hasEnoughCoins ? 'none' : '1px solid #059669',
                        borderRadius: '10px',
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: !storeEnabled || reward.stockQuantity <= 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {reward.stockQuantity <= 0 ? 'Out of Stock' : hasEnoughCoins ? 'Redeem Prize' : `Need +${shortfall}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Amazon-style Redemption Modal */}
      {redeemProduct && (
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
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              padding: '24px'
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setRedeemProduct(null)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            {orderSuccess ? (
              /* Success Confirmation View */
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#ecfdf5',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                  }}
                >
                  <CheckCircle2 size={36} color="#059669" />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  Redemption Order Placed! 🎉
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  Order Number: <strong style={{ color: '#059669' }}>#{orderSuccess.orderNumber}</strong>
                </p>

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    marginBottom: '1.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Prize Item:</span>
                    <strong style={{ color: '#0f172a' }}>{orderSuccess.productTitle}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Coins Redeemed:</span>
                    <strong style={{ color: '#059669' }}>{orderSuccess.totalCoins} Coins</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Deliver To:</span>
                    <span style={{ color: '#0f172a', textAlign: 'right' }}>
                      {orderSuccess.deliveryAddress?.recipientName}, {orderSuccess.deliveryAddress?.city} - {orderSuccess.deliveryAddress?.postalCode}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Estimated Dispatch:</span>
                    <span style={{ color: '#0f172a' }}>Within 24-48 hours via courier</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <Button variant="outline" onClick={() => setRedeemProduct(null)}>
                    Back to Store
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setRedeemProduct(null);
                      navigate('/rewards/orders');
                    }}
                  >
                    Track My Order
                  </Button>
                </div>
              </div>
            ) : (
              /* Order Confirmation & Address Form */
              <form onSubmit={handleConfirmRedeem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                  <ShoppingBag size={22} color="#059669" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Confirm Prize Redemption
                  </h2>
                </div>

                {/* Prize Summary Card */}
                <div
                  style={{
                    display: 'flex',
                    gap: '14px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px',
                    marginBottom: '1.25rem'
                  }}
                >
                  <img
                    src={redeemProduct.primaryImage}
                    alt={redeemProduct.title}
                    style={{ width: '64px', height: '64px', objectFit: 'contain', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.925rem', fontWeight: 700, color: '#0f172a' }}>
                      {redeemProduct.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.825rem' }}>
                      <span style={{ color: '#64748b' }}>Price: <strong style={{ color: '#059669' }}>{redeemProduct.coinPrice} coins</strong></span>
                      <span style={{ color: '#64748b' }}>Remaining Balance: <strong>{balance.coins - redeemProduct.coinPrice} coins</strong></span>
                    </div>
                  </div>
                </div>

                {/* Delivery Address Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <MapPin size={16} color="#059669" />
                    <span>Doorstep Delivery Address</span>
                  </label>

                  {/* Saved Addresses Selector */}
                  {savedAddresses.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {savedAddresses.map((addr) => (
                        <label
                          key={addr.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: '1px solid',
                            borderColor: selectedAddressId === addr.id ? '#059669' : '#e2e8f0',
                            backgroundColor: selectedAddressId === addr.id ? '#ecfdf5' : '#ffffff',
                            cursor: 'pointer',
                            fontSize: '0.825rem'
                          }}
                        >
                          <input
                            type="radio"
                            name="addressSelect"
                            value={addr.id}
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            style={{ marginTop: '3px' }}
                          />
                          <div>
                            <strong style={{ color: '#0f172a' }}>{addr.recipientName}</strong> • {addr.phone}
                            <span style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>
                              {addr.addressLine1}, {addr.city}, {addr.state} - {addr.postalCode}
                            </span>
                          </div>
                        </label>
                      ))}

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: '1px dashed #cbd5e1',
                          cursor: 'pointer',
                          fontSize: '0.825rem',
                          color: '#059669',
                          fontWeight: 700
                        }}
                      >
                        <input
                          type="radio"
                          name="addressSelect"
                          value="new"
                          checked={selectedAddressId === 'new'}
                          onChange={() => setSelectedAddressId('new')}
                        />
                        <span>+ Enter New Delivery Address</span>
                      </label>
                    </div>
                  )}

                  {/* New Address Inputs */}
                  {selectedAddressId === 'new' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Recipient Full Name *</label>
                        <input
                          type="text"
                          required
                          value={addressForm.recipientName}
                          onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                          placeholder="e.g. Rahul Sharma"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Phone Number *</label>
                        <input
                          type="tel"
                          required
                          value={addressForm.phone}
                          onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                          placeholder="e.g. +91 9876543210"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>House / Flat / Street Address *</label>
                        <input
                          type="text"
                          required
                          value={addressForm.addressLine1}
                          onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                          placeholder="e.g. #42, Green Avenue, 3rd Cross"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>City *</label>
                        <input
                          type="text"
                          required
                          value={addressForm.city}
                          onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                          placeholder="e.g. Bengaluru"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>State *</label>
                        <input
                          type="text"
                          required
                          value={addressForm.state}
                          onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                          placeholder="e.g. Karnataka"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>PIN / Postal Code *</label>
                        <input
                          type="text"
                          required
                          value={addressForm.postalCode}
                          onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                          placeholder="e.g. 560001"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Country</label>
                        <input
                          type="text"
                          value={addressForm.country}
                          disabled
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', fontSize: '0.825rem', color: '#64748b' }}
                        />
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={addressForm.saveAddress}
                            onChange={(e) => setAddressForm({ ...addressForm, saveAddress: e.target.checked })}
                          />
                          <span>Save this address to my profile for future orders</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Terms Notice */}
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
                  By clicking Confirm, {redeemProduct.coinPrice} coins will be securely deducted from your LOOOP wallet. Our team will pack and dispatch your prize to this address with full tracking.
                </p>

                {/* Modal Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <Button variant="outline" type="button" onClick={() => setRedeemProduct(null)} disabled={isRedeeming}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isRedeeming || balance.coins < redeemProduct.coinPrice}>
                    {isRedeeming ? 'Processing Redemption...' : `Confirm & Pay ${redeemProduct.coinPrice} Coins`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardsStorePage;
