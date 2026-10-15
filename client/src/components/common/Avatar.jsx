import React, { useState } from 'react';

const sizeMap = {
  xs: { dim: 24, font: '0.65rem' },
  sm: { dim: 32, font: '0.75rem' },
  md: { dim: 40, font: '0.875rem' },
  lg: { dim: 52, font: '1.1rem' },
  xl: { dim: 72, font: '1.5rem' },
  '2xl': { dim: 96, font: '2rem' }
};

// WhatsApp-style avatar background palette
const AVATAR_PALETTE = [
  '#00A884', // WhatsApp Teal
  '#059669', // Emerald
  '#0284c7', // Sky Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#d97706', // Amber
  '#0d9488', // Dark Teal
  '#2563eb'  // Blue
];

function getAvatarColor(name = '') {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

function getInitials(str) {
  if (!str) return 'U';
  const parts = str.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return str.slice(0, Math.min(2, str.length)).toUpperCase();
}

/**
 * Avatar Component
 * Strict behavior:
 * - If user uploaded a real photo (not Unsplash/placeholder), display the photo.
 * - If no photo uploaded or image fails: ALWAYS display WhatsApp-style colored circle with initial letter(s).
 * - Never shows random placeholder photos.
 */
export const Avatar = ({
  src,
  name = 'User',
  size = 'md',
  online = null,
  trustScore = null,
  className = '',
  style = {}
}) => {
  const { dim, font } = sizeMap[size] || sizeMap.md;
  const [imgFailed, setImgFailed] = useState(false);

  // Strict check: Ignore Unsplash, test-avatar or empty/null mock links
  const isRealPhoto = Boolean(
    src &&
    typeof src === 'string' &&
    src.trim() !== '' &&
    !src.includes('unsplash.com') &&
    !src.includes('test-avatar') &&
    src !== '[object Object]' &&
    !imgFailed
  );

  const bgColor = getAvatarColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={`avatar-wrapper ${className}`}
      style={{
        position: 'relative',
        width: `${dim}px`,
        height: `${dim}px`,
        flexShrink: 0,
        borderRadius: '50%',
        ...style
      }}
    >
      {isRealPhoto ? (
        <img
          src={src}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
          }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          title={name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: bgColor,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: font,
            fontWeight: 800,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            border: '2px solid #ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            userSelect: 'none'
          }}
        >
          {initials}
        </div>
      )}

      {/* Online indicator */}
      {online !== null && (
        <span
          title={online ? 'Online' : 'Offline'}
          style={{
            position: 'absolute',
            bottom: '0px',
            right: '0px',
            width: size === 'sm' || size === 'xs' ? '8px' : '11px',
            height: size === 'sm' || size === 'xs' ? '8px' : '11px',
            borderRadius: '50%',
            backgroundColor: online ? '#10b981' : '#94a3b8',
            border: '2px solid #ffffff'
          }}
        />
      )}
    </div>
  );
};

export default Avatar;
