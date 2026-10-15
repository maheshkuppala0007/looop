import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, LayoutDashboard, Search, Sparkles, ArrowRight, Share2 } from 'lucide-react';
import Button from '../common/Button';
import Card from '../common/Card';

export const PublishSuccessState = ({ item, onShareAnother }) => {
  const navigate = useNavigate();

  const itemId = item?._id || item?.id;
  const itemTitle = item?.title || 'Your Item';
  const rawFirst = item?.images && item.images.length > 0 ? item.images[0] : null;
  const primaryImage = rawFirst
    ? (typeof rawFirst === 'string' ? rawFirst : rawFirst.url || '')
    : '';

  return (
    <div style={{ maxWidth: '640px', margin: '2rem auto', textAlign: 'center' }}>
      <Card style={{ padding: '2.5rem 2rem', position: 'relative', overflow: 'hidden' }}>
        {/* Soft Background Radial Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(255, 255, 255, 0) 70%)',
            pointerEvents: 'none'
          }}
        />

        {/* Animated Checkmark Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
            boxShadow: '0 0 0 8px #d1fae5',
            animation: 'scaleCheck 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <CheckCircle2 size={36} />
        </div>

        {/* Title and Tagline */}
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', marginBottom: '0.5rem' }}>
          Your item is now shared with the community.
        </h2>
        <p style={{ color: 'var(--color-slate-600)', fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto 1.75rem auto', lineHeight: 1.5 }}>
          “{itemTitle}” is now visible on the Discovery feed. Nearby neighbors can discover it and send reuse requests.
        </p>

        {/* Item Preview Snapshot */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--color-slate-200)',
            maxWidth: '440px',
            margin: '0 auto 2rem auto',
            textAlign: 'left'
          }}
        >
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={itemTitle}
              style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-md)', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-md)', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
              <Package size={24} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
              {item?.category || 'Community Item'}
            </div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {itemTitle}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
              {item?.location?.city || (typeof item?.location === 'string' ? item.location : 'Bengaluru')} &bull; Available
            </div>
          </div>
        </div>

        {/* Primary and Secondary Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px', margin: '0 auto' }}>
          {/* Primary CTA: View Real Created Item */}
          {itemId && (
            <Button
              variant="primary"
              size="lg"
              iconLeft={Eye}
              onClick={() => navigate(`/items/${itemId}`)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              View Item Listing
            </Button>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Button
              variant="outline"
              size="md"
              iconLeft={LayoutDashboard}
              onClick={() => navigate('/dashboard')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Dashboard
            </Button>

            <Button
              variant="secondary"
              size="md"
              iconLeft={Search}
              onClick={() => navigate('/browse')}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Browse Items
            </Button>
          </div>

          {onShareAnother && (
            <button
              type="button"
              onClick={onShareAnother}
              style={{
                background: 'none',
                border: 'none',
                color: '#059669',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginTop: '10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Share2 size={14} />
              <span>Share another unused item</span>
            </button>
          )}
        </div>
      </Card>

      <style>{`
        @keyframes scaleCheck {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default PublishSuccessState;
