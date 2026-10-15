import React, { useState, useRef } from 'react';
import { Camera, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import Avatar from '../common/Avatar';
import { userService } from '../../services/userService';
import { useToast } from '../../hooks/useToast';

/**
 * WhatsAppDpUploader
 * WhatsApp-style profile picture (DP) manager:
 * - Circular DP with camera action badge
 * - Instant file picker on tap / click
 * - Shows real uploaded photo; if absent or removed, strictly shows WhatsApp-style name initial letter
 * - Options to Change Photo or Remove Photo
 */
export const WhatsAppDpUploader = ({
  currentAvatar = '',
  userName = 'User',
  size = 'xl',
  onAvatarUpdated
}) => {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const hasPhoto = Boolean(
    currentAvatar &&
    typeof currentAvatar === 'string' &&
    currentAvatar.trim() !== '' &&
    !currentAvatar.includes('unsplash.com') &&
    currentAvatar !== '[object Object]'
  );

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({
        title: 'Invalid File',
        message: 'Please choose an image file (JPG, PNG, WEBP).',
        variant: 'error'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast({
        title: 'File Too Large',
        message: 'Image size must be under 10 MB.',
        variant: 'error'
      });
      return;
    }

    setUploading(true);
    setShowMenu(false);

    try {
      const res = await userService.uploadAvatar(file);
      if (res && res.success && res.avatar) {
        addToast({
          title: 'Profile Photo Updated',
          message: 'Your new WhatsApp-style profile DP has been published.',
          variant: 'success'
        });

        // Sync with local user session
        try {
          const stored = JSON.parse(localStorage.getItem('looop_user') || '{}');
          stored.avatar = res.avatar;
          localStorage.setItem('looop_user', JSON.stringify(stored));
        } catch {}

        if (onAvatarUpdated) {
          onAvatarUpdated(res.avatar);
        }
      } else {
        throw new Error(res?.message || 'Failed to upload photo.');
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      // Fallback: compress to DataURL and save via updateMyProfile
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result;
          if (dataUrl) {
            const updateRes = await userService.updateMyProfile({ avatar: dataUrl });
            if (updateRes?.success) {
              addToast({
                title: 'Profile Photo Saved',
                message: 'Your profile photo is now updated.',
                variant: 'success'
              });
              try {
                const stored = JSON.parse(localStorage.getItem('looop_user') || '{}');
                stored.avatar = dataUrl;
                localStorage.setItem('looop_user', JSON.stringify(stored));
              } catch {}
              if (onAvatarUpdated) onAvatarUpdated(dataUrl);
            }
          }
        };
        reader.readAsDataURL(file);
      } catch (fallbackErr) {
        addToast({
          title: 'Upload Failed',
          message: err.response?.data?.message || err.message || 'Unable to update profile photo.',
          variant: 'error'
        });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setUploading(true);
    setShowMenu(false);
    try {
      const res = await userService.updateMyProfile({ avatar: '' });
      if (res && res.success) {
        addToast({
          title: 'Photo Removed',
          message: 'Profile photo removed. Initial letter avatar is now visible.',
          variant: 'info'
        });

        try {
          const stored = JSON.parse(localStorage.getItem('looop_user') || '{}');
          stored.avatar = '';
          localStorage.setItem('looop_user', JSON.stringify(stored));
        } catch {}

        if (onAvatarUpdated) {
          onAvatarUpdated('');
        }
      }
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      addToast({
        title: 'Error',
        message: 'Could not remove photo. Please try again.',
        variant: 'error'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Main Circular DP */}
      <div
        style={{
          position: 'relative',
          cursor: uploading ? 'wait' : 'pointer',
          borderRadius: '50%',
          display: 'inline-block',
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)'
        }}
        onClick={() => {
          if (uploading) return;
          if (hasPhoto) {
            setShowMenu(!showMenu);
          } else {
            fileInputRef.current?.click();
          }
        }}
        title={hasPhoto ? 'Click to change or remove profile photo' : 'Click to upload WhatsApp profile DP'}
      >
        <Avatar
          src={currentAvatar}
          name={userName}
          size={size}
        />

        {/* Uploading Spinner Overlay */}
        {uploading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}
          >
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}

        {/* WhatsApp-Style Camera Icon Badge */}
        {!uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasPhoto) {
                setShowMenu(!showMenu);
              } else {
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload Profile Photo"
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: size === '2xl' ? '32px' : '28px',
              height: size === '2xl' ? '32px' : '28px',
              borderRadius: '50%',
              backgroundColor: '#00A884', // Official WhatsApp teal/green
              color: '#ffffff',
              border: '2.5px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
              transition: 'transform 0.15s ease, background-color 0.15s ease'
            }}
            className="whatsapp-camera-badge"
          >
            <Camera size={size === '2xl' ? 16 : 14} />
          </button>
        )}
      </div>

      {/* Popover Menu for Change / Remove Photo */}
      {showMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
            onClick={() => setShowMenu(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '8px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid var(--color-slate-200)',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
              padding: '6px',
              minWidth: '180px',
              zIndex: 70,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setShowMenu(false);
                fileInputRef.current?.click();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-slate-800)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Camera size={15} color="#00A884" />
              <span>Change Photo</span>
            </button>

            <button
              type="button"
              onClick={handleRemovePhoto}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#ef4444',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Trash2 size={15} color="#ef4444" />
              <span>Remove Photo</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default WhatsAppDpUploader;
