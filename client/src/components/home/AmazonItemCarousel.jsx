import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, MapPin } from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { formatLocation } from '../../utils/formatters';
import { itemService } from '../../services/itemService';

export const AmazonItemCarousel = ({ items = [] }) => {
  const displayItems = Array.isArray(items) ? items.filter((i) => !itemService.isMockItem(i)) : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const carouselRef = useRef(null);
  const navigate = useNavigate();

  // Screen-size responsive items per view
  const getItemsPerPage = () => {
    if (typeof window === 'undefined') return 4;
    const width = window.innerWidth;
    if (width < 640) return 1;
    if (width < 960) return 2;
    if (width < 1280) return 3;
    return 4;
  };

  const [itemsPerPage, setItemsPerPage] = useState(getItemsPerPage());

  useEffect(() => {
    const handleResize = () => setItemsPerPage(getItemsPerPage());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalItems = displayItems.length;
  const maxIndex = Math.max(0, totalItems - itemsPerPage);

  // Automatic smooth infinite rotation timer (scrolls automatically every 3 seconds)
  useEffect(() => {
    if (isPaused || totalItems <= itemsPerPage) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 3000);

    return () => clearInterval(timer);
  }, [isPaused, maxIndex, totalItems, itemsPerPage]);

  const getSharingBadgeVariant = (type) => {
    switch (type) {
      case 'give_away': return 'success';
      case 'borrow': return 'info';
      case 'exchange': return 'warning';
      default: return 'neutral';
    }
  };

  const formatSharingType = (type) => {
    switch (type) {
      case 'give_away': return 'Give Away';
      case 'borrow': return 'Borrow';
      case 'exchange': return 'Exchange';
      default: return type || 'Available';
    }
  };

  if (!displayItems || displayItems.length === 0) return null;

  return (
    <section
      style={{
        padding: '5rem 0',
        background: 'linear-gradient(180deg, #f0fdf9 0%, #f8fffe 60%, #ffffff 100%)',
        borderTop: '1px solid rgba(16, 185, 129, 0.12)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.1)'
      }}
      aria-label="Available Items Carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container">
        {/* Section Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: '2.5rem',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}
        >
          <div>
            <Badge variant="success" style={{ marginBottom: '0.5rem' }}>
              <Sparkles size={13} style={{ marginRight: '4px' }} />
              Trending Items
            </Badge>
            <h2
              style={{
                fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: 'var(--color-slate-900)'
              }}
            >
              Explore Listed Items Nearby
            </h2>
            <p style={{ color: 'var(--color-slate-600)', fontSize: '1rem', marginTop: '0.35rem' }}>
              Discover functional electronics, books, study gear, and tools shared by neighbors.
            </p>
          </div>

          <div>
            <Link to="/browse" style={{ textDecoration: 'none' }}>
              <Button variant="outline" size="sm" iconRight={ArrowRight} className="browse-hover-highlight-btn">
                View All Catalog
              </Button>
            </Link>
          </div>
        </div>

        {/* Carousel Window */}
        <div style={{ overflow: 'hidden', position: 'relative', borderRadius: 'var(--radius-lg)' }}>
          <div
            ref={carouselRef}
            style={{
              display: 'flex',
              transform: `translateX(calc(-${currentIndex} * (${100 / itemsPerPage}% + ${1.25 / itemsPerPage}rem)))`,
              transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
              gap: '1.25rem',
              justifyContent: totalItems <= 2 ? 'flex-start' : 'initial'
            }}
          >
            {displayItems.map((item) => {
              const itemImg = Array.isArray(item.images) && item.images.length > 0
                ? (typeof item.images[0] === 'string' ? item.images[0] : (item.images[0]?.url || ''))
                : '';

              const flexBasis = totalItems === 1
                ? 'min(100%, 360px)'
                : totalItems === 2
                ? 'min(calc(50% - 0.75rem), 360px)'
                : `calc(${100 / itemsPerPage}% - ${(1.25 * (itemsPerPage - 1)) / itemsPerPage}rem)`;

              return (
                <div
                  key={item.id || item._id}
                  style={{
                    flex: `0 0 ${flexBasis}`,
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-slate-200)',
                      overflow: 'hidden',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      cursor: 'pointer'
                    }}
                    className="amazon-item-card"
                    onClick={() => navigate(`/items/${item.id || item._id}`)}
                  >
                    {/* Item Image Box */}
                    <div style={{ position: 'relative', width: '100%', height: '210px', backgroundColor: 'var(--color-slate-100)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {itemImg ? (
                        <img
                          src={itemImg}
                          alt={item.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.35s ease'
                          }}
                          className="amazon-card-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span style={{ color: 'var(--color-slate-400)', fontSize: '0.8rem', fontWeight: 600 }}>No Photo</span>
                      )}
                      <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                        <Badge variant={getSharingBadgeVariant(item.sharingType)}>
                          {formatSharingType(item.sharingType)}
                        </Badge>
                      </div>
                      {item.condition && (
                        <div style={{ position: 'absolute', bottom: '12px', right: '12px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#ffffff', fontSize: '0.72rem', padding: '3px 8px', borderRadius: 'var(--radius-sm)', textTransform: 'capitalize' }}>
                          {item.condition.replace('_', ' ')}
                        </div>
                      )}
                    </div>

                    {/* Content Box */}
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                        {item.category || 'General'}
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)', marginBottom: '0.5rem', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-600)', marginBottom: '1.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', flexGrow: 1 }}>
                        {item.description}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.85rem', borderTop: '1px solid var(--color-slate-100)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-slate-500)', fontWeight: 500 }}>
                          <MapPin size={14} color="var(--color-primary-600)" />
                          <span>{formatLocation(item.location, 'Local Neighborhood')}</span>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary-600)' }}>
                          View →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dots Pagination */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '1.75rem' }}>
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              style={{
                width: currentIndex === idx ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: currentIndex === idx ? 'var(--color-primary-600)' : 'var(--color-slate-300)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      <style>{`
        .amazon-item-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 28px -4px rgba(15, 23, 42, 0.12) !important;
          border-color: var(--color-primary-300) !important;
        }
        .amazon-item-card:hover .amazon-card-img {
          transform: scale(1.05);
        }
      `}</style>
    </section>
  );
};

export default AmazonItemCarousel;
