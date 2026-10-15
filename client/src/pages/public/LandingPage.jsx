import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSiteConfig } from '../../context/SiteConfigContext';
import AuthPromptModal from '../../components/common/AuthPromptModal';
import contentService from '../../services/contentService';
import { getLiveImpactMetrics, saveLiveImpactMetrics } from '../../utils/communityImpactTracker';
import {
  Sparkles,
  ArrowRight,
  RefreshCw,
  Gift,
  Clock,
  Repeat,
  ShieldCheck,
  Heart,
  TrendingUp,
  Package,
  CheckCircle2,
  Users,
  Search,
  MapPin,
  MessageSquare,
  Bookmark,
  Bell,
  Award,
  Zap,
  BookOpen,
  Laptop,
  Shirt,
  Wrench,
  ChevronRight,
  Key,
  Star
} from 'lucide-react';
import LooopHeroCanvas from '../../components/3d/LooopHeroCanvas';
import ItemCard from '../../components/common/ItemCard';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import { itemService } from '../../services/itemService';
import { mockCommunityImpact, mockCategories } from '../../data/mockData';
import AmazonItemCarousel from '../../components/home/AmazonItemCarousel';

const INITIAL_THREE_REVIEWS = [
  {
    id: 'srev_1',
    person: 'Aarav Sharma',
    role: 'Engineering Student · Indiranagar',
    item: 'Casio Scientific Calculator',
    rating: 5,
    quote: '“LOOOP completely transformed how our community shares resources! Instead of spending thousands on items I only need once, I found trustworthy neighbors ready to help. The secure handover code makes every transaction feel completely safe and professional.”',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    badge: 'Verified Borrower'
  },
  {
    id: 'srev_2',
    person: 'Ananya Deshmukh',
    role: 'Graduating Senior · HSR Layout',
    item: 'Calculus & Physics Book Set',
    rating: 5,
    quote: '“This website is an absolute game-changer. LOOOP brings true circular reuse into daily life with zero sales pressure, zero commercial ads, and 100% verified trust. Watching real waste avoided in our neighborhood gives real meaning to sharing.”',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    badge: 'Verified Sharer'
  },
  {
    id: 'srev_3',
    person: 'Sunil Kumar',
    role: 'Resident · JP Nagar Phase 3',
    item: 'Cordless Impact Drill & Bit Set',
    rating: 5,
    quote: '“I am genuinely impressed by how smoothly LOOOP works. My idle household tools and books are now helping students and families around me. High praise to Mahesh and the LOOOP team for building such a useful, clean, and honest platform!”',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    badge: 'Top Contributor'
  }
];

export const LandingPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [realItems, setRealItems] = useState(() => itemService.getCachedItems(24));
  // Live impact counts start strictly at 0 and increment as actions occur
  const [liveImpact, setLiveImpact] = useState({
    itemsReused: 0,
    peopleHelped: 0,
    booksShared: 0,
    electronicsShared: 0,
    wasteAvoidedKg: 0
  });
  const [reviews, setReviews] = useState(INITIAL_THREE_REVIEWS);
  const { user, isAuthenticated } = useAuth();
  const { siteConfig } = useSiteConfig();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.removeItem('looop_community_shared_items');
      localStorage.removeItem('looop_instant_products_cache_v5');
      localStorage.removeItem('looop_instant_products_cache_v4');
    } catch {}
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Fetch items
    const fetchItems = async () => {
      try {
        const res = await itemService.discoverItems({ limit: 24 });
        if (isMounted && res?.items) {
          const itemsFromDb = (res.items || []).filter((i) => !itemService.isMockItem(i));
          setRealItems(itemsFromDb);
        }
      } catch (err) {
        console.warn('Silent background item sync notice:', err);
      }
    };

    // Fetch real live impact counts from backend database
    const fetchImpact = async () => {
      try {
        const res = await contentService.getLiveImpactStats();
        if (isMounted && res?.success && res.metrics) {
          setLiveImpact(res.metrics);
        }
      } catch (err) {
        console.warn('Silent impact sync notice:', err);
      }
    };

    // Fetch approved website-appreciating reviews
    const fetchReviews = async () => {
      try {
        const res = await contentService.getPublicReviews();
        if (isMounted && res?.success && res.reviews && res.reviews.length > 0) {
          setReviews(res.reviews);
        }
      } catch (err) {
        console.warn('Silent reviews sync notice:', err);
      }
    };

    fetchItems();
    fetchImpact();
    fetchReviews();

    return () => { isMounted = false; };
  }, []);

  const isLoggedIn = !!(user && (isAuthenticated || user.id || user.email));

  const handleShareClick = () => {
    if (isLoggedIn) {
      navigate('/share');
    } else {
      setShowAuthModal(true);
    }
  };

  const filteredItems = selectedCategory === 'all'
    ? realItems
    : realItems.filter(item => {
        const cat = (item.category || '').toLowerCase();
        const sel = selectedCategory.toLowerCase();
        return cat === sel || cat.includes(sel) || sel.includes(cat);
      });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden' }}>
      {/* =========================================================================
          1. HERO SECTION
          ========================================================================= */}
      <section
        style={{
          position: 'relative',
          paddingTop: '3.5rem',
          paddingBottom: '5rem',
          overflow: 'hidden',
          background: `
            radial-gradient(ellipse 70% 55% at 65% 5%, rgba(52, 211, 153, 0.13) 0%, transparent 65%),
            radial-gradient(ellipse 55% 45% at 10% 90%, rgba(16, 185, 129, 0.09) 0%, transparent 60%),
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(209, 250, 229, 0.35) 0%, transparent 55%),
            linear-gradient(160deg, #f0fdf9 0%, #ffffff 45%, #f8fafc 100%)
          `
        }}
        aria-label="Hero Section"
      >
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              alignItems: 'center',
              gap: 'clamp(1.5rem, 4vw, 3rem)'
            }}
          >
            {/* Left: Headline & Messaging */}
            <div>
              {/* Product Category Tag */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--color-primary-800)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  marginBottom: '1.25rem',
                  letterSpacing: '0.01em'
                }}
              >
                <Sparkles size={16} color="var(--color-primary-600)" />
                <span>LOOOP · Community Unused-Item Sharing Platform</span>
              </div>

              {/* Main Headline */}
              <h1
                style={{
                  fontSize: 'clamp(2.6rem, 5.5vw, 4.25rem)',
                  fontWeight: 900,
                  letterSpacing: '-0.035em',
                  lineHeight: 1.1,
                  marginBottom: '1.25rem',
                  color: 'var(--color-slate-900)'
                }}
              >
                Share. Reuse.{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #047857 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  Connect.
                </span>
              </h1>

              {/* Sub-Headline & Supporting Message */}
              <p
                style={{
                  fontSize: 'clamp(1.1rem, 2vw, 1.25rem)',
                  color: 'var(--color-slate-600)',
                  lineHeight: 1.65,
                  marginBottom: '2rem',
                  maxWidth: '560px'
                }}
              >
                An unused item in your cupboard can become useful to someone else.
                Give away, lend, borrow, and exchange study gear, electronics, and tools with trustworthy neighbors in your local community.
              </p>

              {/* Primary Dual Call-To-Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  marginBottom: '2.5rem'
                }}
              >
                <Link to="/browse" style={{ textDecoration: 'none' }}>
                  <Button
                    variant="outline"
                    size="lg"
                    iconRight={ArrowRight}
                    style={{
                      backgroundColor: '#ecfdf5',
                      borderColor: 'var(--color-primary-500)',
                      borderWidth: '2px',
                      color: 'var(--color-primary-700)',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.22)',
                      transition: 'all 0.25s ease'
                    }}
                    className="highlighted-share-btn"
                  >
                    Browse Items
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="lg"
                  iconLeft={Gift}
                  onClick={handleShareClick}
                  style={{
                    backgroundColor: '#ecfdf5',
                    borderColor: 'var(--color-primary-500)',
                    borderWidth: '2px',
                    color: 'var(--color-primary-700)',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.22)',
                    transition: 'all 0.25s ease'
                  }}
                  className="highlighted-share-btn"
                >
                  Share an Item
                </Button>
              </div>

              {/* Verified Trust & Social Proof Badges */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--color-slate-600)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} color="var(--color-primary-600)" />
                  <span style={{ fontWeight: 600 }}>100% Non-Commercial</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="var(--color-primary-600)" />
                  <span style={{ fontWeight: 600 }}>Verified Peer Trust</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={16} color="var(--color-primary-600)" />
                  <span style={{ fontWeight: 600 }}>Safe Handover Codes</span>
                </div>
              </div>
            </div>

            {/* Right: 3D Loop Composition + Floating Everyday Object Cards */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'clamp(280px, 50vw, 440px)'
              }}
            >
              {/* Interactive 3D Torus Loop Canvas */}
              <LooopHeroCanvas />

              {/* Floating Item Card 1: Study Calculator (Top-Left) */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '-10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.94)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  maxWidth: '230px',
                  zIndex: 2,
                  animation: 'floatSlow 4s ease-in-out infinite'
                }}
                className="hero-floating-card"
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                    flexShrink: 0
                  }}
                >
                  <Laptop size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-slate-900)', display: 'block', lineHeight: 1.2 }}>
                    Casio Calculator
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>
                    Borrow · Indiranagar
                  </span>
                </div>
              </div>

              {/* Floating Item Card 2: Textbooks (Bottom-Left) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '-5px',
                  backgroundColor: 'rgba(255, 255, 255, 0.94)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  maxWidth: '230px',
                  zIndex: 2,
                  animation: 'floatSlow 4.5s ease-in-out infinite 0.8s'
                }}
                className="hero-floating-card"
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#059669',
                    flexShrink: 0
                  }}
                >
                  <BookOpen size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-slate-900)', display: 'block', lineHeight: 1.2 }}>
                    Calculus & Physics Set
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
                    Give Away · HSR Layout
                  </span>
                </div>
              </div>

              {/* Floating Concept Pill: The Loop Flow (Bottom-Right) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '0px',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--color-primary-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  maxWidth: '260px',
                  zIndex: 2
                }}
                className="hero-floating-card"
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-50)',
                    color: 'var(--color-primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <RefreshCw size={16} />
                </div>
                <div style={{ color: 'var(--color-slate-800)', fontSize: '0.78rem', lineHeight: 1.35 }}>
                  <strong style={{ color: 'var(--color-primary-700)' }}>The LOOOP Principle:</strong>
                  <br />
                  Own → Don't Need → Share → Reuse
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. AMAZON-STYLE AUTO-MOVING LISTED ITEMS CAROUSEL
          ========================================================================= */}
      <AmazonItemCarousel items={realItems} />

      {/* =========================================================================
          2.5. RECENTLY SHARED COMMUNITY PRODUCTS (UNIVERSAL MOBILE & DESKTOP VISIBILITY)
          ========================================================================= */}
      <section
        style={{
          padding: '4.5rem 0',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--color-slate-100)'
        }}
        aria-label="Recently Shared Items"
      >
        <div className="container">
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: '2rem',
              flexWrap: 'wrap',
              gap: '1.25rem'
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--color-primary-700)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem'
                }}
              >
                <Sparkles size={14} />
                <span>Live Community Feed</span>
              </div>
              <h2
                style={{
                  fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  color: 'var(--color-slate-900)'
                }}
              >
                Recently Shared by Neighbors
              </h2>
              <p style={{ color: 'var(--color-slate-600)', fontSize: '1rem', marginTop: '0.35rem' }}>
                Every shared item is saved in real time and discoverable on all mobile phones & desktops.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                size="sm"
                iconLeft={Gift}
                onClick={handleShareClick}
                style={{
                  borderColor: 'var(--color-primary-500)',
                  color: 'var(--color-primary-700)',
                  fontWeight: 600
                }}
              >
                Share an Item
              </Button>
              <Link to="/browse" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm" iconRight={ArrowRight}>
                  View All ({realItems.length})
                </Button>
              </Link>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              paddingBottom: '0.75rem',
              marginBottom: '2rem',
              WebkitOverflowScrolling: 'touch'
            }}
            className="category-filter-scroll"
          >
            {[
              { id: 'all', label: `✨ All Items (${realItems.length})` },
              { id: 'books', label: '📚 Books & Notes' },
              { id: 'electronics', label: '💻 Electronics' },
              { id: 'study', label: '✏️ Study & Office' },
              { id: 'tools', label: '🔧 Tools & DIY' },
              { id: 'sports', label: '⚽ Sports & Hobbies' },
              { id: 'fashion', label: '👕 Clothing' },
              { id: 'other', label: '📦 Other' }
            ].map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  type="button"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 700 : 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: isSelected ? '1.5px solid var(--color-primary-600)' : '1px solid var(--color-slate-200)',
                    backgroundColor: isSelected ? 'var(--color-primary-50)' : '#ffffff',
                    color: isSelected ? 'var(--color-primary-800)' : 'var(--color-slate-700)',
                    boxShadow: isSelected ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none'
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Products Grid - 100% Mobile & Desktop Responsive */}
          {filteredItems.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                gap: '1.5rem',
                width: '100%'
              }}
            >
              {filteredItems.map((item) => (
                <ItemCard key={item.id || item._id} item={item} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                backgroundColor: 'var(--color-slate-50)',
                borderRadius: 'var(--radius-xl)',
                border: '1px dashed var(--color-slate-200)'
              }}
            >
              <Package size={40} color="var(--color-slate-400)" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.5rem' }}>
                No items in this category yet
              </h3>
              <p style={{ color: 'var(--color-slate-500)', fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
                Have an unused item at home or work? Share it with your community in just two minutes.
              </p>
              <Button variant="primary" size="md" iconLeft={Gift} onClick={handleShareClick}>
                Be the first to share in this category
              </Button>
            </div>
          )}

          {/* Bottom Explore Banner */}
          <div
            style={{
              marginTop: '3rem',
              padding: '1.5rem 2rem',
              backgroundColor: '#f0fdf4',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#166534' }}>
                  Looking for something specific?
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#15803d' }}>
                  Explore the full catalog with custom filters, search by keywords, condition, and distance.
                </p>
              </div>
            </div>

            <Link to="/browse" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" iconRight={ArrowRight} style={{ backgroundColor: '#ffffff', borderColor: '#86efac', color: '#166534', fontWeight: 700 }}>
                Open Search & Filters
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. CUSTOMER FEEDBACKS & COMMUNITY REVIEWS SECTION
          ========================================================================= */}
      <section style={{ padding: '5.5rem 0', background: 'linear-gradient(180deg, #ffffff 0%, #fafdf9 50%, #f4fdf8 100%)', borderTop: '1px solid var(--color-slate-100)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 3.5rem auto' }}>
            <Badge variant="success" style={{ marginBottom: '0.75rem' }}>Customer Feedbacks</Badge>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.6rem)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.025em' }}>
              Real Customer Feedbacks & Community Stories
            </h2>
            <p style={{ color: 'var(--color-slate-600)', fontSize: '1.05rem', lineHeight: 1.65 }}>
              “Your unused item could be exactly what someone else needs.”
              See how verified members appreciate the platform, trust the handover system, and build a greener neighborhood.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: 'clamp(1rem, 3vw, 2rem)'
            }}
          >
            {reviews.slice(0, 3).map((story, i) => (
              <Card key={story.id || i} hoverable className="feature-highlight-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <Avatar src={story.avatar} name={story.person} size="lg" />
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                      {story.person}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', display: 'block' }}>
                      {story.role}
                    </span>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '4px', color: '#f59e0b' }}>
                      {'★'.repeat(story.rating || 5)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--color-primary-50)',
                    border: '1px solid var(--color-primary-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Gift size={15} color="var(--color-primary-600)" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary-800)' }}>
                    Item / Experience: {story.item}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-700)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                  {story.quote}
                </p>

                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-100)' }}>
                  <Badge variant="success">{story.badge || 'Verified Member'}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. REDUCING WASTE THROUGH CIRCULAR REUSE & IMPACT CALCULATOR SECTION
          ========================================================================= */}
      <section
        id="impact"
        style={{
          padding: '5.5rem 0',
          background: `
            radial-gradient(ellipse 60% 50% at 80% 20%, rgba(52, 211, 153, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 15% 75%, rgba(6, 78, 59, 0.7) 0%, transparent 60%),
            linear-gradient(135deg, #052e16 0%, #064e3b 40%, #065f46 75%, #047857 100%)
          `,
          color: '#ffffff'
        }}
        aria-label="Environmental and Community Impact"
      >
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 3.5rem auto' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.22)',
                borderRadius: 'var(--radius-full)',
                color: '#a7f3d0',
                fontSize: '0.8rem',
                fontWeight: 700,
                marginBottom: '1rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              <Sparkles size={14} />
              <span>{siteConfig?.impactSection?.badge || 'Verified Community Impact'}</span>
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.6rem)', fontWeight: 800, color: '#ffffff', marginBottom: '1rem', letterSpacing: '-0.025em' }}>
              {siteConfig?.impactSection?.title || 'Reducing Waste Through Circular Reuse'}
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.65 }}>
              {siteConfig?.impactSection?.subtitle || 'Every item borrowed or gifted on LOOOP represents one less product manufactured, shipped in single-use plastic, or buried in a landfill.'}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
              gap: 'clamp(1rem, 2.5vw, 1.75rem)',
              textAlign: 'center'
            }}
          >
            {(() => {
              const hidden = siteConfig?.impactSection?.hiddenCards || [];
              const defaultCards = [
                { id: 'itemsReused', label: 'Items Reused', value: liveImpact.itemsReused, icon: RefreshCw, desc: 'Active items in community use' },
                { id: 'peopleHelped', label: 'People Helped', value: liveImpact.peopleHelped, icon: Users, desc: 'Neighbors connected' },
                { id: 'booksShared', label: 'Books Shared', value: liveImpact.booksShared, icon: BookOpen, desc: 'Study sets & novels' },
                { id: 'electronicsShared', label: 'Electronics Shared', value: liveImpact.electronicsShared, icon: Laptop, desc: 'Gadgets & peripherals' },
                { id: 'wasteAvoided', label: 'Waste Avoided', value: `${liveImpact.wasteAvoidedKg} kg`, icon: TrendingUp, desc: 'Solid waste kept out of landfills' }
              ];

              const customCards = (siteConfig?.impactSection?.customCards || []).map((c) => ({
                id: c.id || `custom-${c.label}`,
                label: c.label,
                value: c.value,
                icon: Users,
                desc: c.desc || 'Active community members'
              }));

              const allCards = [...defaultCards, ...customCards].filter((card) => !hidden.includes(card.id));

              return allCards.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.id || i}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '2rem 1.25rem',
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      transition: 'transform 0.2s, background-color 0.2s'
                    }}
                  >
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(16, 185, 129, 0.25)',
                        color: '#a7f3d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem'
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <div
                      style={{
                        fontSize: '2.5rem',
                        fontWeight: 900,
                        fontFamily: 'var(--font-brand)',
                        color: '#ffffff',
                        marginBottom: '0.35rem',
                        lineHeight: 1.1
                      }}
                    >
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 700, marginBottom: '0.25rem' }}>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {stat.desc}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </section>




      {/* Floating Card CSS Keyframes */}
      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .feature-highlight-card:hover {
          border-color: var(--color-primary-300) !important;
          box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.1) !important;
          transform: translateY(-2px);
        }
        .highlighted-share-btn:hover {
          background-color: var(--color-primary-600) !important;
          color: #ffffff !important;
          border-color: var(--color-primary-600) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4) !important;
        }
        .browse-hover-highlight-btn {
          background-color: #ffffff !important;
          color: var(--color-slate-700) !important;
          border: 1.5px solid var(--color-slate-300) !important;
          font-weight: 600 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .browse-hover-highlight-btn:hover {
          background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600)) !important;
          color: #ffffff !important;
          border-color: var(--color-primary-600) !important;
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35) !important;
          transform: translateY(-2px);
        }
        @media (max-width: 640px) {
          .hero-floating-card {
            display: none !important;
          }
        }
      `}</style>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign In or Create Account"
        actionTitle="Account Required to Share"
        actionDescription="To share an unused item with your community on LOOOP, please sign in or create a free account."
        redirectPath="/share"
      />
    </div>
  );
};

export default LandingPage;
