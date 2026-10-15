import React, { useState } from 'react';
import { X, Save, AlertCircle, Plus, Check } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import WhatsAppDpUploader from './WhatsAppDpUploader';
import { userService } from '../../services/userService';

/**
 * EditProfileModal Component
 * Allows authenticated members to update their profile information.
 */
export const EditProfileModal = ({
  isOpen,
  onClose,
  user,
  onSuccess
}) => {
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || '');
  const [locality, setLocality] = useState(user?.locality || '');
  const [state, setState] = useState(user?.state || '');
  const [profileVisibility, setProfileVisibility] = useState(user?.profileVisibility || 'public');
  const [interests, setInterests] = useState(user?.interests || []);
  const [newInterest, setNewInterest] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleAddInterest = () => {
    const trimmed = newInterest.trim();
    if (trimmed && !interests.includes(trimmed) && interests.length < 15) {
      setInterests([...interests, trimmed]);
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (tagToRemove) => {
    setInterests(interests.filter((i) => i !== tagToRemove));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        avatar,
        bio: bio.trim(),
        city: city.trim(),
        locality: locality.trim(),
        state: state.trim(),
        profileVisibility,
        interests
      };

      const res = await userService.updateMyProfile(payload);
      if (res && res.success) {
        onSuccess(res.user);
        onClose();
      } else {
        throw new Error(res?.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      const msg = err.response?.data?.message || err.message || 'Unable to save profile changes.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Your Community Profile" maxWidth="560px">
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Email Read-only Banner */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--color-slate-200)',
            fontSize: '0.8rem',
            color: 'var(--color-slate-600)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Account Email: <strong>{user?.email}</strong></span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-slate-400)', fontWeight: 600 }}>
            Read-only
          </span>
        </div>

        {/* WhatsApp-Style DP Photo Manager */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0' }}>
          <WhatsAppDpUploader
            currentAvatar={avatar}
            userName={name || user?.name}
            size="2xl"
            onAvatarUpdated={(newAvatar) => setAvatar(newAvatar)}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', marginTop: '8px', fontWeight: 600 }}>
            Tap camera to upload or change WhatsApp-style DP
          </span>
        </div>

        {/* Name */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '5px' }}>
            Full Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            maxLength={80}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-slate-300)',
              fontSize: '0.9rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Bio */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
              About You / Bio
            </label>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>
              {bio.length} / 500
            </span>
          </div>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={saving}
            maxLength={500}
            placeholder="Introduce yourself to neighbors, what you love to share, or hobbies..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-slate-300)',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Location Grid: City, Locality, State */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '4px' }}>
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={saving}
              placeholder="e.g. Bengaluru"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-300)',
                fontSize: '0.85rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '4px' }}>
              Locality / Neighborhood
            </label>
            <input
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              disabled={saving}
              placeholder="e.g. Indiranagar"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-300)',
                fontSize: '0.85rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '4px' }}>
              State
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={saving}
              placeholder="e.g. Karnataka"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-300)',
                fontSize: '0.85rem',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Interests */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '5px' }}>
            Sharing Interests
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddInterest();
                }
              }}
              placeholder="e.g. Board Games, Gardening Tools, Books"
              disabled={saving}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-slate-300)',
                fontSize: '0.85rem'
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddInterest}
              disabled={!newInterest.trim() || saving}
            >
              <Plus size={15} />
              <span>Add</span>
            </Button>
          </div>

          {interests.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {interests.map((interest) => (
                <span
                  key={interest}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-primary-50)',
                    color: 'var(--color-primary-800)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: '1px solid var(--color-primary-200)'
                  }}
                >
                  <span>{interest}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(interest)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--color-primary-600)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Remove interest"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Profile Visibility */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '5px' }}>
            Profile Visibility
          </label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-slate-700)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="profileVisibility"
                value="public"
                checked={profileVisibility === 'public'}
                onChange={() => setProfileVisibility('public')}
                disabled={saving}
              />
              <span>Public (Visible to everyone)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-slate-700)', cursor: 'pointer' }}>
              <input
                type="radio"
                name="profileVisibility"
                value="community"
                checked={profileVisibility === 'community'}
                onChange={() => setProfileVisibility('community')}
                disabled={saving}
              />
              <span>Community Only (Logged-in members)</span>
            </label>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.85rem'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-slate-100)' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Spinner size="sm" />
                <span>Saving...</span>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Save size={15} />
                <span>Save Profile</span>
              </span>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditProfileModal;
