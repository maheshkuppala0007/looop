import React from 'react';
import { Link } from 'react-router-dom';

export const LooopLogo = ({
  size = 'md',
  showTagline = false,
  light = false,
  linkTo = '/',
  customText = '',
  customUrl = '',
  customTagline = ''
}) => {
  const sizeMap = {
    sm: { iconWidth: 28, iconHeight: 20, ringSize: 13, text: '1.2rem', gap: '0.5rem', imgHeight: 28 },
    md: { iconWidth: 38, iconHeight: 26, ringSize: 17, text: '1.45rem', gap: '0.75rem', imgHeight: 36 },
    lg: { iconWidth: 52, iconHeight: 36, ringSize: 24, text: '2.1rem', gap: '1rem', imgHeight: 48 }
  };

  const current = sizeMap[size] || sizeMap.md;
  const displayText = customText || 'Looop';
  const displayTagline = customTagline || 'Share. Reuse. Connect.';

  const content = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: current.gap,
        textDecoration: 'none',
        userSelect: 'none'
      }}
      className="looop-brand-mark"
    >
      {customUrl ? (
        <img
          src={customUrl}
          alt={displayText}
          style={{ height: `${current.imgHeight}px`, objectFit: 'contain', borderRadius: '4px' }}
        />
      ) : (
        /* Creative Three Interlocking Circles (The Three O's in LOOOP) */
        <div
          style={{
            position: 'relative',
            width: `${current.iconWidth}px`,
            height: `${current.iconHeight}px`,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }}
          aria-hidden="true"
        >
          {/* Ring 1: Share (Emerald) */}
          <div
            style={{
              position: 'absolute',
              left: '0px',
              width: `${current.ringSize}px`,
              height: `${current.ringSize}px`,
              borderRadius: '50%',
              border: `3px solid ${light ? '#34d399' : '#10b981'}`,
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.35)',
              transition: 'transform 0.3s ease'
            }}
            className="logo-ring-1"
          />
          {/* Ring 2: Reuse (Teal) */}
          <div
            style={{
              position: 'absolute',
              left: `${current.iconWidth * 0.28}px`,
              width: `${current.ringSize}px`,
              height: `${current.ringSize}px`,
              borderRadius: '50%',
              border: `3px solid ${light ? '#2dd4bf' : '#0d9488'}`,
              opacity: 0.95,
              boxShadow: '0 0 10px rgba(13, 148, 136, 0.3)',
              transition: 'transform 0.3s ease'
            }}
            className="logo-ring-2"
          />
          {/* Ring 3: Connect (Deep Jade) */}
          <div
            style={{
              position: 'absolute',
              left: `${current.iconWidth * 0.56}px`,
              width: `${current.ringSize}px`,
              height: `${current.ringSize}px`,
              borderRadius: '50%',
              border: `3px solid ${light ? '#6ee7b7' : '#047857'}`,
              boxShadow: '0 0 10px rgba(4, 120, 87, 0.35)',
              transition: 'transform 0.3s ease'
            }}
            className="logo-ring-3"
          />
        </div>
      )}

      {/* Brand Typography */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontFamily: 'var(--font-brand)',
            fontSize: current.text,
            fontWeight: 900,
            letterSpacing: '-0.035em',
            color: light ? '#ffffff' : 'var(--color-slate-900)',
            lineHeight: 1
          }}
        >
          {displayText}
        </span>

        {showTagline && (
          <span
            style={{
              fontSize: '0.675rem',
              fontWeight: 700,
              color: light ? '#a7f3d0' : 'var(--color-primary-700)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginTop: '3px'
            }}
          >
            {displayTagline}
          </span>
        )}
      </div>

      <style>{`
        .looop-brand-mark:hover .logo-ring-1 { transform: translateY(-1px) scale(1.05); }
        .looop-brand-mark:hover .logo-ring-2 { transform: translateY(1px) scale(1.05); }
        .looop-brand-mark:hover .logo-ring-3 { transform: translateY(-1px) scale(1.05); }
      `}</style>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} style={{ textDecoration: 'none', display: 'inline-flex' }}>
        {content}
      </Link>
    );
  }

  return content;
};

export default LooopLogo;
