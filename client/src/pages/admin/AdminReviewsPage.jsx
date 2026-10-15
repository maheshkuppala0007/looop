import React, { useState, useEffect } from 'react';
import {
  Star,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  X
} from 'lucide-react';
import contentService from '../../services/contentService';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

export const AdminReviewsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    person: '',
    role: '',
    item: '',
    rating: 5,
    quote: '',
    avatar: '',
    badge: 'Verified Member',
    is_published: true,
    display_order: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const res = await contentService.getAdminReviews();
      if (res?.success && Array.isArray(res.reviews)) {
        setReviews(res.reviews);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
      setNotification({ type: 'error', message: 'Failed to load website testimonials.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const openCreateModal = () => {
    setEditingReview(null);
    setFormData({
      person: '',
      role: '',
      item: '',
      rating: 5,
      quote: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      badge: 'Verified Member',
      is_published: true,
      display_order: reviews.length + 1
    });
    setModalOpen(true);
  };

  const openEditModal = (review) => {
    setEditingReview(review);
    setFormData({
      person: review.person || '',
      role: review.role || '',
      item: review.item || '',
      rating: review.rating || 5,
      quote: review.quote || '',
      avatar: review.avatar || '',
      badge: review.badge || 'Verified Member',
      is_published: review.is_published !== false,
      display_order: review.display_order || 0
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.person.trim() || !formData.quote.trim()) {
      setNotification({ type: 'error', message: 'Person name and quote are required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setNotification(null);

      if (editingReview) {
        const res = await contentService.updateReview(editingReview.id, formData);
        if (res?.success) {
          setNotification({ type: 'success', message: 'Review updated successfully!' });
        }
      } else {
        const res = await contentService.createReview(formData);
        if (res?.success) {
          setNotification({ type: 'success', message: 'New testimonial created successfully!' });
        }
      }

      setModalOpen(false);
      await fetchReviews();
    } catch (err) {
      console.error('Error saving review:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save review.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (review) => {
    try {
      const res = await contentService.toggleReviewPublish(review.id);
      if (res?.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === review.id ? { ...r, is_published: res.is_published } : r))
        );
        setNotification({
          type: 'success',
          message: `Review by ${review.person} is now ${res.is_published ? 'published live' : 'hidden from public'}.`
        });
      }
    } catch (err) {
      console.error('Failed to toggle publish:', err);
      setNotification({ type: 'error', message: 'Could not toggle publish status.' });
    }
  };

  const handleDeletePermanently = async (review) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete the review by "${review.person}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      const res = await contentService.deleteReview(review.id);
      if (res?.success) {
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        setNotification({ type: 'success', message: 'Review permanently deleted from database.' });
      }
    } catch (err) {
      console.error('Failed to delete review:', err);
      setNotification({ type: 'error', message: 'Failed to delete review.' });
    }
  };

  const publishedCount = reviews.filter((r) => r.is_published).length;
  const draftCount = reviews.length - publishedCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
            Website Testimonials & Review Governance
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Control which customer feedbacks are published on the website, create new testimonials, and manage reviews permanently.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}
        >
          <Plus size={18} />
          <span>Add New Review</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Testimonials</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>{reviews.length}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>In PostgreSQL Database</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Published Live</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34d399', marginTop: '4px' }}>{publishedCount}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Visible on Homepage (Top 3 prioritized)</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Draft / Unpublished</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>{draftCount}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>Hidden from Visitors</div>
        </div>
      </div>

      {notification && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${notification.type === 'error' ? '#ef4444' : '#10b981'}`,
            borderRadius: '8px',
            color: notification.type === 'error' ? '#f87171' : '#34d399',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Reviews Table / List */}
      {isLoading ? (
        <div style={{ minHeight: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="lg" />
        </div>
      ) : reviews.length === 0 ? (
        <div
          style={{
            backgroundColor: '#1e293b',
            border: '1px dashed #475569',
            borderRadius: '12px',
            padding: '3rem',
            textAlign: 'center',
            color: '#94a3b8'
          }}
        >
          <MessageSquare size={36} color="#64748b" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ color: '#ffffff', margin: '0 0 0.5rem 0' }}>No Testimonials Found</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Click "Add New Review" above to create customer appreciation testimonials.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                backgroundColor: '#1e293b',
                border: rev.is_published ? '1px solid #334155' : '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={rev.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                    alt={rev.person}
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #334155' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        {rev.person}
                      </h3>
                      {rev.badge && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            color: '#6ee7b7'
                          }}
                        >
                          {rev.badge}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block' }}>
                      {rev.role} · Item: <span style={{ color: '#38bdf8' }}>{rev.item}</span>
                    </span>
                    <div style={{ display: 'flex', gap: '2px', color: '#f59e0b', fontSize: '0.9rem', marginTop: '2px' }}>
                      {'★'.repeat(rev.rating || 5)}
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: rev.is_published ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: rev.is_published ? '#34d399' : '#fbbf24',
                      border: `1px solid ${rev.is_published ? '#10b981' : '#f59e0b'}`
                    }}
                  >
                    {rev.is_published ? 'Published (Live)' : 'Unpublished (Hidden)'}
                  </span>

                  <button
                    onClick={() => handleTogglePublish(rev)}
                    title={rev.is_published ? 'Unpublish review' : 'Publish review'}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: rev.is_published ? '#fbbf24' : '#34d399',
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {rev.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{rev.is_published ? 'Unpublish' : 'Publish'}</span>
                  </button>

                  <button
                    onClick={() => openEditModal(rev)}
                    title="Edit review"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <Edit size={14} />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeletePermanently(rev)}
                    title="Delete permanently from database"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      color: '#f87171',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Quote Content */}
              <div
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  color: '#e2e8f0',
                  fontStyle: 'italic'
                }}
              >
                "{rev.quote}"
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {editingReview ? 'Edit Testimonial' : 'Create New Testimonial'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Reviewer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={formData.person}
                  onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Role / Neighborhood
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Engineering Student · Indiranagar"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Item / Experience
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Casio Scientific Calculator"
                    value={formData.item}
                    onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Star Rating (1 - 5)
                  </label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value, 10) })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value={5}>5 Stars ★★★★★</option>
                    <option value={4}>4 Stars ★★★★☆</option>
                    <option value={3}>3 Stars ★★★☆☆</option>
                    <option value={2}>2 Stars ★★☆☆☆</option>
                    <option value={1}>1 Star ★☆☆☆☆</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                    Verification Badge
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified Borrower / Verified Sharer"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Testimonial Quote * (Appreciating LOOOP platform)
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share how LOOOP transformed sharing, saved money, connected neighbors, or reduced waste..."
                  value={formData.quote}
                  onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="publishToggle"
                  checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                />
                <label htmlFor="publishToggle" style={{ fontSize: '0.9rem', color: '#ffffff', cursor: 'pointer', fontWeight: 600 }}>
                  Publish Immediately on Website (Homepage Testimonials)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    color: '#cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 22px',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Saving...' : editingReview ? 'Save Changes' : 'Create Testimonial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviewsPage;
