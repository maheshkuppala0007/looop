import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  MapPin,
  Calendar,
  Star,
  Package,
  Repeat,
  CheckCircle2,
  Clock,
  Edit3,
  Heart,
  HelpCircle,
  Award,
  AlertCircle,
  Eye,
  Lock,
  Sparkles,
  Bell
} from 'lucide-react';
import Card from '../../components/common/Card';
import Avatar from '../../components/common/Avatar';
import WhatsAppDpUploader from '../../components/profile/WhatsAppDpUploader';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Tabs from '../../components/common/Tabs';
import Skeleton from '../../components/common/Skeleton';
import ItemCard from '../../components/common/ItemCard';
import RatingStars from '../../components/reviews/RatingStars';
import RatingSummary from '../../components/reviews/RatingSummary';
import ReviewList from '../../components/reviews/ReviewList';
import EditProfileModal from '../../components/profile/EditProfileModal';
import NotificationPreferencesModal from '../../components/notifications/NotificationPreferencesModal';
import { userService } from '../../services/userService';
import { reviewService } from '../../services/reviewService';
import { itemService } from '../../services/itemService';
import { impactService } from '../../services/impactService';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatters';
import { Link } from 'react-router-dom';

export const ProfilePage = () => {
  const { user: authUser } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [impactSummary, setImpactSummary] = useState(null);

  const [sharedItems, setSharedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [activeTab, setActiveTab] = useState('items');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userService.getMyProfile();
      if (res && res.success) {
        setProfileData(res.user);
        setStats(res.stats);
        setProfileCompletion(res.profileCompletion);

        const currentUserId = res.user._id || res.user.id;

        // Fetch user reviews, summary, items, and real impact in parallel
        try {
          const [revRes, sumRes, itemsRes, impactRes] = await Promise.all([
            reviewService.getUserReviews(currentUserId, { page: 1, limit: 10 }),
            reviewService.getUserReviewSummary(currentUserId),
            itemService.getMyItems({ limit: 12 }),
            impactService.getMyImpact().catch(() => null)
          ]);

          if (revRes && revRes.success) {
            setReviews(revRes.reviews || []);
            setReviewsTotal(revRes.total || 0);
            setReviewsPage(revRes.page || 1);
            setReviewsTotalPages(revRes.totalPages || 1);
          }

          if (sumRes && sumRes.success) {
            setReviewSummary(sumRes.summary);
          }

          if (itemsRes) {
            setSharedItems(itemsRes.items || []);
          }

          if (impactRes && impactRes.success) {
            setImpactSummary(impactRes);
          }
        } catch (subErr) {
          console.warn('Sub-resource fetch error:', subErr);
        }
      } else {
        throw new Error(res?.message || 'Failed to load profile.');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err.response?.data?.message || err.message || 'Unable to load profile data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLoadMoreReviews = async () => {
    if (loadingMoreReviews || reviewsPage >= reviewsTotalPages) return;
    setLoadingMoreReviews(true);
    try {
      const nextPage = reviewsPage + 1;
      const currentUserId = profileData._id || profileData.id;
      const res = await reviewService.getUserReviews(currentUserId, { page: nextPage, limit: 10 });
      if (res && res.success) {
        setReviews((prev) => [...prev, ...(res.reviews || [])]);
        setReviewsPage(nextPage);
      }
    } catch (err) {
      console.error('Failed to load more reviews:', err);
    } finally {
      setLoadingMoreReviews(false);
    }
  };

  const handleProfileUpdated = (updatedUser) => {
    setProfileData(updatedUser);
    loadProfile();
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <Card style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Skeleton width="96px" height="96px" circle />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <Skeleton width="220px" height="28px" />
              <Skeleton width="160px" height="18px" />
              <Skeleton width="280px" height="16px" />
            </div>
          </div>
        </Card>
        <Card style={{ padding: '2rem' }}>
          <Skeleton width="100%" height="150px" />
        </Card>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <Card style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem auto' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '8px' }}>
          Unable to Load Profile
        </h2>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {error || 'An unexpected error occurred while fetching your profile.'}
        </p>
        <Button variant="primary" onClick={loadProfile}>
          Retry Loading
        </Button>
      </Card>
    );
  }

  const memberSinceFormatted = profileData.createdAt ? formatDate(profileData.createdAt) : 'Recently';
  const averageRating = reviewSummary?.averageRating || profileData.rating || 0;
  const totalReviews = reviewSummary?.totalReviews || profileData.reviewsCount || 0;
  const completedTxCount = stats?.completedTransactions || 0;
  const activeItemsCount = stats?.activeItems || sharedItems.length || 0;

  // Format location string safely
  const locationDisplay = [profileData.locality, profileData.city, profileData.state]
    .filter(Boolean)
    .join(', ');

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. Profile Header Card */}
      <Card
        style={{
          padding: '2.5rem',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-slate-200)',
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.03)'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1.75rem'
          }}
        >
          {/* Avatar & Main Info */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
            <WhatsAppDpUploader
              currentAvatar={profileData.avatar}
              userName={profileData.name}
              size="xl"
              onAvatarUpdated={(newAvatar) => {
                setProfileData((prev) => ({ ...prev, avatar: newAvatar }));
              }}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--color-slate-900)', margin: 0 }}>
                  {profileData.name}
                </h1>
                {profileData.verified && (
                  <Badge variant="success">
                    <ShieldCheck size={13} style={{ marginRight: '4px' }} />
                    Verified Sharer
                  </Badge>
                )}
                {profileData.profileVisibility === 'community' && (
                  <Badge variant="secondary">
                    <Lock size={12} style={{ marginRight: '4px' }} />
                    Community Only
                  </Badge>
                )}
              </div>

              {/* Bio */}
              {profileData.bio ? (
                <p style={{ fontSize: '0.925rem', color: 'var(--color-slate-600)', margin: '4px 0 10px 0', maxWidth: '550px', lineHeight: 1.5 }}>
                  {profileData.bio}
                </p>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-400)', fontStyle: 'italic', margin: '4px 0 10px 0' }}>
                  No bio added yet. Add a short introduction so neighbors know who they are sharing with!
                </p>
              )}

              {/* Location & Member Since */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: 'var(--color-slate-500)', fontSize: '0.85rem', marginBottom: '10px' }}>
                {locationDisplay ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={15} color="var(--color-primary-600)" />
                    {locationDisplay}
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-slate-400)' }}>
                    <MapPin size={15} />
                    Location not specified
                  </span>
                )}

                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={15} />
                  Member since {memberSinceFormatted}
                </span>
              </div>

              {/* Rating Summary Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RatingStars rating={Math.round(averageRating)} size={16} />
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-slate-800)' }}>
                  {totalReviews > 0 ? averageRating.toFixed(1) : 'New Member'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                  ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Notification Preferences & Edit Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              onClick={() => setIsNotifModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Bell size={15} />
              <span>Notifications</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Edit3 size={15} />
              <span>Edit Profile</span>
            </Button>
          </div>
        </div>

        {/* Real MongoDB Metrics Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1rem',
            paddingTop: '1.75rem',
            marginTop: '1.75rem',
            borderTop: '1px solid var(--color-slate-100)',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-slate-900)' }}>
              {activeItemsCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Active Items
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--color-primary-600)' }}>
              {completedTxCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Handovers Completed
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0284c7' }}>
              {stats?.itemsShared || sharedItems.length}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Items Shared
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706' }}>
              {totalReviews}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Reviews Received
            </div>
          </div>

          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#059669' }}>
              {totalReviews > 0 ? averageRating.toFixed(1) : '—'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Average Rating
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Dual Trust Indicators & Profile Completion Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {/* Transparent Trust Indicators */}
        <Card style={{ padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#059669" />
            <span>Community Trust & Verification</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-100)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--color-slate-800)', display: 'block' }}>
                  Authenticated Account
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                  Email confirmed and secured by cryptographic token
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-100)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: completedTxCount > 0 ? '#ecfdf5' : '#f1f5f9', color: completedTxCount > 0 ? '#059669' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Repeat size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--color-slate-800)', display: 'block' }}>
                  {completedTxCount} Completed {completedTxCount === 1 ? 'Handover' : 'Handovers'}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                  Confirmed by both parties via secure handover confirmation
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-100)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: totalReviews > 0 ? '#ecfdf5' : '#f1f5f9', color: totalReviews > 0 ? '#059669' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--color-slate-800)', display: 'block' }}>
                  {totalReviews > 0 ? `${averageRating.toFixed(1)} Community Rating` : 'Awaiting First Review'}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                  Calculated exclusively from genuine completed transactions
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Deterministic Profile Completion */}
        {profileCompletion && (
          <Card style={{ padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--color-primary-600)" />
                <span>Profile Completion</span>
              </h2>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--color-primary-700)' }}>
                {profileCompletion.percentage}%
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: '8px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <div
                style={{
                  height: '100%',
                  width: `${profileCompletion.percentage}%`,
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>

            {/* Criteria checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {profileCompletion.steps?.map((step) => (
                <div
                  key={step.field}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: step.completed ? 'var(--color-slate-800)' : 'var(--color-slate-400)'
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: step.completed ? '#ecfdf5' : '#f1f5f9',
                      color: step.completed ? '#059669' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {step.completed ? <CheckCircle2 size={12} /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />}
                  </div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>

            {profileCompletion.percentage < 100 && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-slate-100)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary-700)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Complete missing details →
                </button>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* 3. Environmental & Reuse Impact Section */}
      <Card style={{ padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Repeat size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                Environmental & Reuse Impact
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                Real circular circulation verified through completed handovers
              </span>
            </div>
          </div>

          <Link
            to="/customer/impact"
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-primary-700)',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>Full Impact Dashboard →</span>
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-slate-900)' }}>
              {impactSummary?.totalItemsReused ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Items Reused
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2563eb' }}>
              {impactSummary?.itemsShared ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Items Shared
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669' }}>
              {impactSummary?.completedReuseTransactions ?? 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Handovers Completed
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>
              {impactSummary?.milestones?.filter((m) => m.achieved).length || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
              Milestones Earned
            </div>
          </div>
        </div>

        {/* Environmental Estimates Snapshot */}
        {impactSummary?.environmentalMetrics && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: '#f8fafc', border: '1px solid var(--color-slate-200)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.8rem' }}>
            <div style={{ color: 'var(--color-slate-600)' }}>
              {impactSummary.environmentalMetrics.co2eAvoided !== null ? (
                <span>Estimated <strong>{impactSummary.environmentalMetrics.co2eAvoided} kg CO₂e</strong> emissions averted.</span>
              ) : (
                <span>Environmental conversion factors are currently being verified for your items.</span>
              )}
            </div>
            <Badge variant={impactSummary.environmentalMetrics.co2eAvoided !== null ? 'success' : 'neutral'} size="sm">
              {impactSummary.environmentalMetrics.co2eAvoided !== null ? 'Factor Configured' : 'Estimate Unavailable'}
            </Badge>
          </div>
        )}
      </Card>


      {/* 3. Interests Showcase */}
      {profileData.interests && profileData.interests.length > 0 && (
        <Card style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px 0' }}>
            Sharing Interests & Communities
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {profileData.interests.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-primary-50)',
                  border: '1px solid var(--color-primary-200)',
                  color: 'var(--color-primary-800)',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* 4. Tabbed Content: Items I'm Sharing vs Community Reviews vs Rating Breakdown */}
      <div>
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'items', label: "Items I'm Sharing", count: sharedItems.length },
            { id: 'reviews', label: 'Community Feedback', count: totalReviews },
            { id: 'summary', label: 'Rating Breakdown' }
          ]}
          style={{ marginBottom: '1.5rem' }}
        />

        {/* Tab 1: Items */}
        {activeTab === 'items' && (
          <div>
            {sharedItems.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '20px'
                }}
              >
                {sharedItems.map((item) => (
                  <ItemCard key={item.id || item._id} item={item} />
                ))}
              </div>
            ) : (
              <Card style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                <Package size={36} color="var(--color-slate-400)" style={{ margin: '0 auto 10px auto' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-slate-800)', margin: '0 0 6px 0' }}>
                  No active listings yet
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)', margin: '0 0 1.25rem 0' }}>
                  You don't have any items actively listed for sharing or lending right now.
                </p>
                <Button variant="primary" onClick={() => (window.location.href = '/share')}>
                  List an Item to Share
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* Tab 2: Reviews List */}
        {activeTab === 'reviews' && (
          <ReviewList
            reviews={reviews}
            loading={false}
            currentUserId={profileData._id || profileData.id}
            page={reviewsPage}
            totalPages={reviewsTotalPages}
            onLoadMore={handleLoadMoreReviews}
            loadingMore={loadingMoreReviews}
            emptyTitle="No reviews yet"
            emptyDescription="Complete a transaction with a neighbor to receive verified community feedback."
          />
        )}

        {/* Tab 3: Rating Breakdown */}
        {activeTab === 'summary' && (
          <div style={{ maxWidth: '640px' }}>
            <RatingSummary
              averageRating={reviewSummary?.averageRating || averageRating}
              totalReviews={reviewSummary?.totalReviews || totalReviews}
              distribution={reviewSummary?.distribution}
            />
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={profileData}
        onSuccess={handleProfileUpdated}
      />

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />
    </div>
  );
};

export default ProfilePage;
