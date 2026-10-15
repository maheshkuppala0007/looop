import React, { useState } from 'react';
import {
  Sparkles,
  MapPin,
  ShieldCheck,
  Eye,
  Heart,
  Clock,
  Gift,
  Repeat,
  HeartHandshake,
  Lightbulb,
  CheckCircle2,
  Tag
} from 'lucide-react';
import Badge from '../common/Badge';
import { formatLocation } from '../../utils/formatters';

export const LiveListingPreview = ({
  title = '',
  category = 'books',
  subcategory = '',
  brand = '',
  model = '',
  sharingType = 'give_away',
  condition = 'good',
  location = 'Indiranagar, Bengaluru',
  images = [],
  borrowSettings = {},
  exchangeDetails = {},
  currentUser = null
}) => {
  const [cardTransform, setCardTransform] = useState('rotateX(0deg) rotateY(0deg)');
  const [isHovered, setIsHovered] = useState(false);

  // Fallback presentation data
  const displayTitle = title.trim() || 'Untitled Community Item';
  const rawImg = images && images.length > 0 ? images[0] : null;
  const displayImage = rawImg
    ? (typeof rawImg === 'string' ? rawImg : (rawImg.url || ''))
    : '';

  const conditionLabels = {
    new: { label: 'New', variant: 'success' },
    like_new: { label: 'Like New', variant: 'info' },
    good: { label: 'Good Condition', variant: 'warning' },
    fair: { label: 'Fair Condition', variant: 'secondary' },
    needs_repair: { label: 'Needs Repair', variant: 'danger' }
  };

  const sharingTypeConfig = {
    free: { label: 'Free', icon: HeartHandshake, bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    give_away: { label: 'Give Away', icon: Gift, bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    borrow: { label: 'Borrow / Lend', icon: Clock, bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
    exchange: { label: 'Exchange', icon: Repeat, bg: '#fffbeb', color: '#b45309', border: '#fde68a' }
  };

  const currentSharing = sharingTypeConfig[sharingType] || sharingTypeConfig.give_away;
  const SharingIcon = currentSharing.icon;
  const currentCondition = conditionLabels[condition] || conditionLabels.good;

  // Gentle 3D perspective mouse tracker
  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = (-y / 24).toFixed(2);
    const rotateY = (x / 24).toFixed(2);
    setCardTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCardTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)');
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const ownerName = currentUser?.name || 'Aarav Sharma';
  const trustScore = currentUser?.trustScore || 98;

  return (
    <div style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header with explicit PREVIEW indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
            Listing Preview
          </h2>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Sparkles size={11} />
            Live Preview
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>
          Updates in real time
        </span>
      </div>

      {/* 3D FLOATING ITEM CARD CONTAINER */}
      <div
        style={{
          perspective: '1000px',
          transition: 'transform 0.15s ease-out'
        }}
      >
        <div
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: cardTransform,
            transformStyle: 'preserve-3d',
            transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.5s ease-out',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            border: '1px solid var(--color-slate-200)',
            boxShadow: isHovered
              ? '0 20px 35px -8px rgba(15, 23, 42, 0.18), 0 0 12px rgba(16, 185, 129, 0.15)'
              : '0 8px 24px -4px rgba(15, 23, 42, 0.08)',
            position: 'relative'
          }}
          className="preview-3d-card"
        >
          {/* Card Top: Primary Image + Overlay Pills */}
          <div style={{ position: 'relative', width: '100%', height: '220px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {displayImage ? (
              <img
                src={displayImage}
                alt="Listing preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                <ImageIcon size={36} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Photos will appear here</span>
              </div>
            )}

            {/* Top Left: Sharing Type Badge */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                backgroundColor: currentSharing.bg,
                color: currentSharing.color,
                border: `1px solid ${currentSharing.border}`,
                borderRadius: 'var(--radius-full)',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <SharingIcon size={13} />
              <span>{currentSharing.label}</span>
            </div>

            {/* Top Right: Condition Pill */}
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <Badge variant={currentCondition.variant}>{currentCondition.label}</Badge>
            </div>

            {/* Image Count Indicator */}
            {images.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backdropFilter: 'blur(4px)'
                }}
              >
                1 of {images.length} photos
              </div>
            )}
          </div>

          {/* Card Body */}
          <div style={{ padding: '1.25rem' }}>
            {/* Category / Subcategory & Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#059669',
                  letterSpacing: '0.04em'
                }}
              >
                {category}
              </span>
              {subcategory && subcategory !== 'General' && (
                <>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-slate-300)' }}>&bull;</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>
                    {subcategory}
                  </span>
                </>
              )}
              {brand && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.7rem',
                    color: 'var(--color-slate-400)',
                    fontWeight: 600
                  }}
                >
                  {brand} {model ? `(${model})` : ''}
                </span>
              )}
            </div>

            {/* Item Title */}
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--color-slate-900)',
                lineHeight: 1.3,
                marginBottom: '8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {displayTitle}
            </h3>

            {/* Conditional Sharing Notes */}
            {sharingType === 'borrow' && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '6px 10px',
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #e0f2fe',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Clock size={13} flexShrink={0} />
                <span>
                  Max lend: <strong>{borrowSettings.maxDurationDays || 14} {borrowSettings.maxDurationUnit || 'days'}</strong>
                </span>
              </div>
            )}

            {sharingType === 'exchange' && exchangeDetails.wantedItems && (
              <div
                style={{
                  marginBottom: '10px',
                  padding: '6px 10px',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Repeat size={13} flexShrink={0} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Wants: <strong>{exchangeDetails.wantedItems}</strong>
                </span>
              </div>
            )}

            {/* Location Approx */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.8rem',
                color: 'var(--color-slate-500)',
                marginBottom: '14px'
              }}
            >
              <MapPin size={14} color="#059669" flexShrink={0} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatLocation(location, 'Neighborhood Area')} &bull; ~1 km
              </span>
            </div>

            {/* Card Footer: Owner Trust Meter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--color-slate-100)',
                paddingTop: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.72rem'
                  }}
                >
                  {ownerName.charAt(0)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                    {ownerName}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <ShieldCheck size={11} />
                    {trustScore}% Trust
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--color-slate-400)',
                  backgroundColor: 'var(--color-slate-50)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-xs)'
                }}
              >
                Available now
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Community Sharing Tips Widget */}
      <div
        style={{
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--color-slate-200)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
          <Lightbulb size={16} color="#d97706" />
          <span>Tips for Fast Community Discovery</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.78rem', color: 'var(--color-slate-600)', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
          <li>
            <strong>Clear, daylight photos</strong> get up to 3x more reuse requests.
          </li>
          <li>
            <strong>Honest condition details</strong> build neighbor trust and high feedback scores.
          </li>
          <li>
            Keep location approximate to protect your home privacy.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default LiveListingPreview;
