import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Loader2, MapPin, Layers } from 'lucide-react';
import Badge from './Badge';
import { formatSharingType, formatCondition } from '../../utils/formatters';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import AuthPromptModal from './AuthPromptModal';

export const ItemCard = ({ item, onSaveToggle, isSaved: propIsSaved, isSaving = false }) => {
  const itemId = item?.id || item?._id;
  const [isSaved, setIsSaved] = useState(propIsSaved ?? item?.isSaved ?? item?.saved ?? false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const cardRef = useRef(null);
  const [transformStyle, setTransformStyle] = useState('');
  const [imageTransformStyle, setImageTransformStyle] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  
  const { addToast } = useToast();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (propIsSaved !== undefined) {
      setIsSaved(propIsSaved);
    } else if (item?.isSaved !== undefined) {
      setIsSaved(Boolean(item.isSaved));
    }
  }, [propIsSaved, item?.isSaved]);

  if (!item) return null;

  const sharingInfo = formatSharingType(item.sharingType);
  const conditionInfo = formatCondition(item.condition);
  const images = Array.isArray(item.images) ? item.images : [];
  const primaryImage =
    images.length > 0
      ? typeof images[0] === 'string'
        ? images[0]
        : images[0]?.url || null
      : null;
      
  const photoCount = images.length;
  const isItemUnavailable = item.isUnavailable || item.availability === 'Unavailable' || item.status === 'removed' || item.status === 'RESERVED';

  const handleSaveClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;

    if (!isAuthenticated && !user) {
      setShowAuthModal(true);
      return;
    }

    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    if (onSaveToggle) {
      onSaveToggle(itemId, nextSaved);
    } else {
      addToast({
        title: nextSaved ? 'Item Saved' : 'Removed from Saved',
        message: nextSaved ? `"${item.title}" added to your saved list.` : `"${item.title}" removed from saved items.`,
        variant: nextSaved ? 'success' : 'info'
      });
    }
  };

  // 3D Tilt Mouse Move Handler
  const handleMouseMove = (e) => {
    if (!cardRef.current || window.innerWidth <= 768) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate rotation (-5 to +5 deg)
    const rotateX = ((mouseY / height) - 0.5) * -10;
    const rotateY = ((mouseX / width) - 0.5) * 10;
    
    // Parallax image shift
    const imgTranslateX = ((mouseX / width) - 0.5) * -12;
    const imgTranslateY = ((mouseY / height) - 0.5) * -12;

    setTransformStyle(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) translateZ(12px)`);
    setImageTransformStyle(`scale(1.06) translateX(${imgTranslateX.toFixed(2)}px) translateY(${imgTranslateY.toFixed(2)}px)`);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) translateZ(0px)');
    setImageTransformStyle('scale(1) translateX(0px) translateY(0px)');
  };

  // Extract clean location text
  const rawLocation = typeof item.location === 'string' ? item.location : item.location?.city || item.location?.address || 'Bengaluru';
  const distanceText = item.distanceKm ? ` · ${item.distanceKm} km` : '';
  const displayLocation = `${rawLocation}${distanceText}`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="item-card premium-3d-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        position: 'relative',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        border: isHovered ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1.5px solid #e2e8f0',
        boxShadow: isHovered
          ? '0 20px 35px -10px rgba(15, 23, 42, 0.12), 0 8px 16px -4px rgba(16, 185, 129, 0.08)'
          : '0 4px 14px rgba(15, 23, 42, 0.04)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease, border-color 0.3s ease',
        transform: transformStyle || 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
        transformStyle: 'preserve-3d',
        opacity: isItemUnavailable ? 0.85 : 1
      }}
    >
      <Link
        to={`/items/${itemId}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          textDecoration: 'none',
          color: 'inherit'
        }}
      >
        {/* A. Product Image Container (approx 55-60% of card) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '220px',
            backgroundColor: '#f1f5f9',
            overflow: 'hidden',
            borderTopLeftRadius: '18px',
            borderTopRightRadius: '18px'
          }}
        >
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={item.title}
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: isItemUnavailable ? 'grayscale(40%)' : 'none',
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: imageTransformStyle || 'scale(1)'
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              No Photo Available
            </div>
          )}

          {/* B. Status Badge (Top-Left Pill) */}
          <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 3, display: 'flex', gap: '6px' }}>
            <Badge variant={sharingInfo.badgeVariant}>
              {sharingInfo.label.toUpperCase()}
            </Badge>
            {isItemUnavailable && (
              <Badge variant="warning">
                {item.status === 'RESERVED' ? 'RESERVED' : 'UNAVAILABLE'}
              </Badge>
            )}
          </div>

          {/* C. Wishlist Heart Button (Top-Right) */}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving}
            aria-label={isSaved ? 'Remove from saved items' : 'Save item'}
            title={isSaved ? 'Remove from saved items' : 'Save item'}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 3,
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease',
              transform: isSaved ? 'scale(1.05)' : 'scale(1)'
            }}
            className="wishlist-btn-3d"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" color="#10b981" />
            ) : (
              <Heart
                size={18}
                color={isSaved ? '#ef4444' : '#64748b'}
                fill={isSaved ? '#ef4444' : 'none'}
                style={{ transition: 'all 0.2s ease' }}
              />
            )}
          </button>

          {/* Multiple Photos Count Badge (Bottom-Right of Image) */}
          {photoCount > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '12px',
                zIndex: 3,
                backgroundColor: 'rgba(15, 23, 42, 0.72)',
                backdropFilter: 'blur(4px)',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                letterSpacing: '0.02em',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
              }}
            >
              <Layers size={11} />
              <span>+{photoCount} Photos</span>
            </div>
          )}
        </div>

        {/* Card Body Information */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1, gap: '10px' }}>
          {/* D. Product Title (Max 2 lines, strong typography) */}
          <h3
            style={{
              fontSize: '1.025rem',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.35,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.7em'
            }}
          >
            {item.title}
          </h3>

          {/* E. Condition Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '0.725rem',
                fontWeight: 700,
                color: '#047857',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.01em'
              }}
            >
              {conditionInfo.label}
            </span>
          </div>

          {/* F. Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>
            <MapPin size={13} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayLocation}
            </span>
          </div>

          {/* G. Primary Action: VIEW PRODUCT → */}
          <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
            <div
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: isItemUnavailable ? '#f1f5f9' : '#059669',
                color: isItemUnavailable ? '#64748b' : '#ffffff',
                fontSize: '0.825rem',
                fontWeight: 800,
                textAlign: 'center',
                letterSpacing: '0.04em',
                boxShadow: isItemUnavailable ? 'none' : (isHovered ? '0 6px 18px rgba(16, 185, 129, 0.35)' : '0 2px 8px rgba(16, 185, 129, 0.2)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.3s ease',
                transform: isHovered && !isItemUnavailable ? 'translateY(-2px)' : 'translateY(0px)'
              }}
              className="view-product-btn-3d"
            >
              <span>VIEW PRODUCT</span>
              <ArrowRight size={14} style={{ transition: 'transform 0.2s ease', transform: isHovered ? 'translateX(3px)' : 'translateX(0)' }} />
            </div>
          </div>
        </div>
      </Link>

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign In or Create Account"
        actionTitle="Account Required to Save Items"
        actionDescription={`To save "${item.title || 'this item'}" to your wishlist, please sign in or create a free account.`}
        redirectPath={window.location.pathname + window.location.search}
      />

      <style>{`
        .wishlist-btn-3d:hover {
          transform: scale(1.12) !important;
          background-color: #ffffff !important;
        }
        @media (max-width: 768px) {
          .premium-3d-card {
            transform: none !important;
          }
          .premium-3d-card:active {
            transform: scale(0.98) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ItemCard;

