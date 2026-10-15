import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  PackageOpen,
  RefreshCw,
  LayoutDashboard,
  Search,
  Sparkles,
  Send,
  Heart
} from 'lucide-react';
import { itemService } from '../../services/itemService';
import { requestService } from '../../services/requestService';
import { reportService } from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

// Subcomponents
import ItemImageGallery from '../../components/itemDetail/ItemImageGallery';
import ItemHeaderInfo from '../../components/itemDetail/ItemHeaderInfo';
import ItemActions from '../../components/itemDetail/ItemActions';
import ItemDetailsContent from '../../components/itemDetail/ItemDetailsContent';
import OwnerProfileCard from '../../components/itemDetail/OwnerProfileCard';
import ApproximateLocationCard from '../../components/itemDetail/ApproximateLocationCard';
import RequestItemModal from '../../components/itemDetail/RequestItemModal';
import ReportListingModal from '../../components/itemDetail/ReportListingModal';
import ItemDetailSkeleton from '../../components/itemDetail/ItemDetailSkeleton';
import ItemCard from '../../components/common/ItemCard';
import Button from '../../components/common/Button';
import AuthPromptModal from '../../components/common/AuthPromptModal';

export const ItemDetailPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const currentUser = user;

  // Item & Related State
  const [item, setItem] = useState(null);
  const [relatedItems, setRelatedItems] = useState([]);
  const [wantedMatches, setWantedMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Modals State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Auth Prompt Modal State
  const [authPromptConfig, setAuthPromptConfig] = useState({
    isOpen: false,
    title: 'Sign In or Create Account',
    actionTitle: 'Account Required',
    actionDescription: 'Please log in or create an account to continue.',
    redirectPath: window.location.pathname
  });

  // 1. Fetch Item Data
  const loadItemData = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const data = await itemService.getItemById(id);

      if (!data) {
        setNotFound(true);
      } else {
        const itemObj = data.item || data;
        setItem(itemObj);
        setIsSaved(Boolean(itemObj.saved));

        // Fetch similar items prioritizing AVAILABLE items
        try {
          const similar = await itemService.getSimilarItems(itemObj.id || itemObj._id, {
            category: itemObj.category,
            subcategory: itemObj.subcategory,
            sharingType: itemObj.sharingType,
            limit: 6
          });
          setRelatedItems(similar || []);
        } catch {
          setRelatedItems([]);
        }

        // Fetch matching wanted requests
        try {
          const matchRes = await itemService.getItemMatches(itemObj._id || itemObj.id);
          if (matchRes && matchRes.success) {
            setWantedMatches(matchRes.matches || []);
          }
        } catch {
          setWantedMatches([]);
        }
      }
    } catch (err) {
      console.error('Error fetching item details:', err);
      setError('Unable to load this item right now. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItemData();
    window.scrollTo(0, 0);
  }, [loadItemData]);

  // Handle returning unauthenticated user with action=request or intent=request in URL query parameter
  useEffect(() => {
    const isRequestIntent = searchParams.get('action') === 'request' || searchParams.get('intent') === 'request';
    if (item && (isAuthenticated || user) && isRequestIntent) {
      setRequestModalOpen(true);
      addToast({
        title: 'Continue Your Request',
        message: 'Your account is verified. Continue with your reuse request?',
        variant: 'info'
      });
    }
  }, [item, isAuthenticated, user, searchParams]);

  // Auth-guarded action triggers
  const handleRequestClick = () => {
    if (!isAuthenticated && !user) {
      const currentUrl = window.location.pathname + window.location.search;
      const separator = currentUrl.includes('?') ? '&' : '?';
      setAuthPromptConfig({
        isOpen: true,
        title: 'Sign In to Request Item',
        actionTitle: 'Account Required to Reuse or Borrow',
        actionDescription: `To request or borrow "${item?.title || 'this item'}", please sign in or create an account. You will automatically return here to complete your request.`,
        redirectPath: `${currentUrl}${separator}action=request`
      });
      return;
    }
    setRequestModalOpen(true);
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated && !user) {
      setAuthPromptConfig({
        isOpen: true,
        title: 'Sign In or Create Account',
        actionTitle: 'Account Required to Save Items',
        actionDescription: `To save "${item?.title || 'this item'}" to your favorites collection, please sign in or create a free account.`,
        redirectPath: window.location.pathname + window.location.search
      });
      return;
    }
    try {
      await itemService.saveItem(item.id);
      setIsSaved(!isSaved);
      addToast({
        title: !isSaved ? 'Item Saved' : 'Removed from Saved',
        message: !isSaved ? `"${item.title}" saved to your collection.` : 'Removed from saved items.',
        variant: !isSaved ? 'success' : 'info'
      });
    } catch {
      addToast({
        title: 'Error',
        message: 'Could not update saved status.',
        variant: 'error'
      });
    }
  };

  const handleReportClick = () => {
    if (!isAuthenticated && !user) {
      setAuthPromptConfig({
        isOpen: true,
        title: 'Sign In or Create Account',
        actionTitle: 'Account Required to Report',
        actionDescription: 'To submit a listing report to community moderation, please sign in or create a free account.',
        redirectPath: window.location.pathname + window.location.search
      });
      return;
    }
    setReportModalOpen(true);
  };

  // 2. Request Submission Flow
  const handleRequestSubmit = async (requestFormData) => {
    if (!item) return;

    setRequestSubmitting(true);
    setRequestError(null);

    try {
      const result = await requestService.createRequest({
        itemId: item.id || item._id,
        ...requestFormData
      });

      if (result && result.success) {
        setRequestModalOpen(false);
        addToast({
          title: 'Request Sent Successfully!',
          message: `Your reuse request for "${item.title || 'this item'}" has been sent to ${item.owner?.name || 'the owner'}. You will receive a notification when they respond.`,
          variant: 'success'
        });
        navigate('/requests');
      } else {
        throw new Error(result?.message || 'Failed to submit request to server.');
      }
    } catch (err) {
      console.error('Request failed:', err);
      const errMsg = err.response?.data?.message || err.message || 'Unable to submit request. Please try again.';
      setRequestError(errMsg);
    } finally {
      setRequestSubmitting(false);
    }
  };

  // 3. Report Submission Flow
  const handleReportSubmit = async (reportFormData) => {
    if (!item) return;

    setReportSubmitting(true);

    try {
      await reportService.createReport(item.id, reportFormData);
      setReportModalOpen(false);
      addToast({
        title: 'Report Received',
        message: 'Thank you for keeping LOOOP safe. Our community moderation team has logged your report.',
        variant: 'info'
      });
    } catch (err) {
      console.error('Report submission error:', err);
      addToast({
        title: 'Report Error',
        message: 'Could not submit report. Please try again later.',
        variant: 'error'
      });
    } finally {
      setReportSubmitting(false);
    }
  };

  // 4. Loading State
  if (loading) {
    return <ItemDetailSkeleton />;
  }

  // 5. Not Found State (Invalid ID or Deleted Item)
  if (notFound || !item) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '4rem 1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-slate-200)',
          maxWidth: '540px',
          margin: '2rem auto'
        }}
        className="item-not-found-card"
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}
        >
          <PackageOpen size={32} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
          Item Not Found
        </h1>
        <p style={{ fontSize: '0.925rem', color: 'var(--color-slate-600)', lineHeight: 1.6, marginBottom: '2rem' }}>
          This item may have been removed, completed by another community member, or the link is incorrect.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => navigate('/browse')} iconLeft={Search}>
            Back to Browse
          </Button>
          <Button variant="primary" onClick={() => navigate('/dashboard')} iconLeft={LayoutDashboard}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // 6. Error State (Network or API issue)
  if (error) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '4rem 1.5rem',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid #fee2e2',
          maxWidth: '540px',
          margin: '2rem auto'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto'
          }}
        >
          <AlertCircle size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.5rem' }}>
          Unable to Load Item
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', marginBottom: '2rem' }}>
          {error}
        </p>
        <Button variant="primary" iconLeft={RefreshCw} onClick={loadItemData}>
          Retry
        </Button>
      </div>
    );
  }

  // Derive primary button label for mobile sticky bar
  const isOwner = currentUser && item.owner && (currentUser.id === item.owner.id || currentUser.email === item.owner.email);
  const isAvailable = item.status === 'AVAILABLE' || !item.status;

  return (
    <div className="container item-detail-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '3rem', padding: '2.5rem 1.5rem 5rem 1.5rem' }}>
      {/* Top Header & Breadcrumb Info */}
      <ItemHeaderInfo item={item} />

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 1fr',
          gap: '2.5rem',
          alignItems: 'start'
        }}
        className="item-detail-main-grid"
      >
        {/* Left Column: Gallery & Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <ItemImageGallery images={item.images} itemTitle={item.title} />

          <ItemDetailsContent item={item} />
        </div>

        {/* Right Column: Actions, Owner, and Location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Action Bar (Request / Save / Share / Report) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-slate-200)',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
            }}
          >
            <ItemActions
              item={item}
              currentUser={currentUser}
              onRequestClick={handleRequestClick}
              onReportClick={handleReportClick}
              isSaved={isSaved}
              onSaveToggle={handleSaveToggle}
            />
          </div>

          {/* Owner Profile Card */}
          <OwnerProfileCard owner={item.owner} />

          {/* Approximate Location & Privacy Card */}
          <ApproximateLocationCard
            location={item.location}
            coordinates={item.locationCoordinates?.coordinates || item.coordinates}
          />
        </div>
      </div>

      {/* YOU MAY ALSO REUSE (Similar Products) Section */}
      {relatedItems.length > 0 && (
        <section style={{ paddingTop: '2.5rem', borderTop: '1px solid var(--color-slate-200)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={18} color="#059669" />
                <span>YOU MAY ALSO REUSE</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', margin: '4px 0 0 0' }}>
                Similar useful items shared by neighbors in your community
              </p>
            </div>
            <Link
              to={`/browse?category=${item.category}`}
              style={{
                fontSize: '0.85rem',
                color: 'var(--color-primary-700)',
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              See All in Category →
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {relatedItems.map((rItem, index) => (
              <ItemCard key={rItem.id || rItem._id || index} item={rItem} />
            ))}
          </div>
        </section>
      )}

      {/* Community Wanted Item Matches (Neighbors Looking for Similar Items) */}
      {wantedMatches && wantedMatches.length > 0 && (
        <section style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--color-slate-900)', margin: 0 }}>
                Neighbors Looking for Similar Items ({wantedMatches.length})
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                Active Wanted Requests
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
              Deterministic local matching • User privacy protected
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem'
            }}
          >
            {wantedMatches.map((match, idx) => {
              const wanted = match.wantedItem;
              if (!wanted) return null;
              return (
                <div
                  key={match.matchId || idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid var(--color-slate-200)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                      {wanted.title}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        backgroundColor: '#ecfdf5',
                        color: '#059669',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {match.score}% match
                    </span>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {wanted.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                    <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize', fontWeight: 600 }}>
                      Prefers: {wanted.preferredSharingType?.replace('_', ' ')}
                    </span>
                    {match.distanceKm !== null && match.distanceKm !== undefined && (
                      <span style={{ color: '#059669', fontWeight: 700 }}>
                        ~{match.distanceKm} km away
                      </span>
                    )}
                  </div>

                  {match.matchReasons && match.matchReasons.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)', backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
                      ✓ {match.matchReasons[0]}
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                    <Link
                      to={`/wanted/${wanted._id || wanted.id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        padding: '6px 12px',
                        backgroundColor: 'var(--color-slate-100)',
                        color: 'var(--color-slate-800)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      View Wanted Request
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Sticky Mobile Action Bar (Visible only on <= 768px viewports) */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--color-slate-200)',
          padding: '12px 16px',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.08)',
          zIndex: 40,
          display: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
        className="mobile-sticky-action-bar"
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.title}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
            {item.sharingType === 'give_away' ? 'Free Giveaway' : item.sharingType === 'borrow' ? 'Available to Borrow' : 'For Exchange'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant={isSaved ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleSaveToggle}
            aria-label="Save item"
            iconLeft={Heart}
          />

          {!isOwner && isAvailable && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRequestClick}
              iconLeft={Send}
            >
              Request
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Request Modal */}
      <RequestItemModal
        item={item}
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSubmit={handleRequestSubmit}
        isSubmitting={requestSubmitting}
        error={requestError}
      />

      {/* Report Listing Modal */}
      <ReportListingModal
        item={item}
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onSubmit={handleReportSubmit}
        isSubmitting={reportSubmitting}
      />

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={authPromptConfig.isOpen}
        onClose={() => setAuthPromptConfig((prev) => ({ ...prev, isOpen: false }))}
        title={authPromptConfig.title}
        actionTitle={authPromptConfig.actionTitle}
        actionDescription={authPromptConfig.actionDescription}
        redirectPath={authPromptConfig.redirectPath}
      />

      <style>{`
        @media (max-width: 900px) {
          .item-detail-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .mobile-sticky-action-bar {
            display: flex !important;
          }
          .item-detail-page-container {
            padding-bottom: 5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ItemDetailPage;
