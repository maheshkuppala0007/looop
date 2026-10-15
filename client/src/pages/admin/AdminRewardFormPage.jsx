import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Gift,
  Upload,
  Coins,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Star,
  Image as ImageIcon,
  Truck,
  Plus,
  X,
  FileText,
  Save,
  Eye
} from 'lucide-react';
import adminService from '../../services/adminService';
import api from '../../services/api';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import { useToast } from '../../hooks/useToast';

const CATEGORIES = [
  'Home & Kitchen',
  'Kitchen Appliances',
  'Electronics',
  'Household Products',
  'Personal Care',
  'Everyday Goods'
];

export const AdminRewardFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    category: 'Home & Kitchen',
    condition: 'brand_new',
    shortDescription: '',
    description: '',
    coinPrice: 150,
    stockQuantity: 10,
    sku: '',
    isPublished: true,
    featured: false,
    deliveryEligible: true,
    estimatedDeliveryDays: 5,
    images: [],
    specifications: [
      { key: 'Warranty', value: '1 Year Brand Warranty' },
      { key: 'Power / Material', value: 'Standard High Grade' }
    ]
  });

  // Load existing prize if editing
  useEffect(() => {
    if (isEditing) {
      const loadPrize = async () => {
        try {
          setLoading(true);
          const res = await api.get(`/rewards/${id}`);
          if (res.data?.success && res.data.reward) {
            const p = res.data.reward;
            setFormData({
              title: p.title || '',
              brand: p.brand || '',
              category: p.category || 'Home & Kitchen',
              condition: p.condition || 'brand_new',
              shortDescription: p.shortDescription || '',
              description: p.description || '',
              coinPrice: p.coinPrice || 150,
              stockQuantity: p.stockQuantity ?? 10,
              sku: p.sku || '',
              isPublished: p.isPublished !== false,
              featured: Boolean(p.featured),
              deliveryEligible: p.deliveryEligible !== false,
              estimatedDeliveryDays: p.estimatedDeliveryDays || 5,
              images: p.images || [],
              specifications: p.specifications?.length > 0 ? p.specifications : [{ key: '', value: '' }]
            });
          }
        } catch (err) {
          addToast({ title: 'Error', message: 'Failed to load prize details.', variant: 'danger' });
          navigate('/admin/rewards');
        } finally {
          setLoading(false);
        }
      };
      loadPrize();
    }
  }, [id, isEditing, navigate, addToast]);

  // Handle Multi-file Upload (Phone gallery / PC files)
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate files: reject arbitrary PDFs as primary photos
    const validImages = [];
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        validImages.push(f);
      } else {
        addToast({
          title: 'Invalid File',
          message: `"${f.name}" is not an image (JPG, PNG, WebP supported).`,
          variant: 'warning'
        });
      }
    }

    if (validImages.length === 0) return;

    setUploadProgress('Uploading photos to storage...');
    try {
      const uploadedList = [];
      for (let i = 0; i < validImages.length; i++) {
        const file = validImages[i];
        const data = new FormData();
        data.append('file', file);
        const res = await api.post('/items/upload-media', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data?.success && res.data.file?.url) {
          uploadedList.push({
            url: res.data.file.url,
            isPrimary: formData.images.length === 0 && uploadedList.length === 0,
            caption: file.name
          });
        }
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...uploadedList]
      }));
      addToast({
        title: 'Photos Uploaded',
        message: `${uploadedList.length} photo(s) added successfully.`,
        variant: 'success'
      });
    } catch (err) {
      addToast({ title: 'Upload Failed', message: 'Could not upload selected photos.', variant: 'danger' });
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Image actions
  const handleRemoveImage = (index) => {
    setFormData((prev) => {
      const filtered = prev.images.filter((_, i) => i !== index);
      // Ensure at least one is primary if list not empty
      if (filtered.length > 0 && !filtered.some((img) => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return { ...prev, images: filtered };
    });
  };

  const handleSetPrimary = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => ({ ...img, isPrimary: i === index }))
    }));
  };

  // Specifications helpers
  const handleAddSpec = () => {
    setFormData((prev) => ({
      ...prev,
      specifications: [...prev.specifications, { key: '', value: '' }]
    }));
  };

  const handleUpdateSpec = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.specifications];
      updated[index][field] = value;
      return { ...prev, specifications: updated };
    });
  };

  const handleRemoveSpec = (index) => {
    setFormData((prev) => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index)
    }));
  };

  // Submit Handler
  const handleSubmit = async (publishFlag) => {
    if (!formData.title.trim()) {
      addToast({ title: 'Title Required', message: 'Please enter a prize title.', variant: 'warning' });
      return;
    }
    if (formData.coinPrice <= 0) {
      addToast({ title: 'Price Required', message: 'Please set a positive coin price.', variant: 'warning' });
      return;
    }
    if (formData.images.length === 0) {
      addToast({ title: 'Photos Required', message: 'Please upload at least one photo of the prize.', variant: 'warning' });
      return;
    }

    const payload = {
      ...formData,
      isPublished: publishFlag !== undefined ? publishFlag : formData.isPublished,
      specifications: formData.specifications.filter((s) => s.key.trim() && s.value.trim())
    };

    try {
      setSubmitting(true);
      if (isEditing) {
        await adminService.updateAdminReward(id, payload);
        addToast({ title: 'Prize Updated', message: 'Reward product saved successfully.', variant: 'success' });
      } else {
        await adminService.createAdminReward(payload);
        addToast({ title: 'Prize Created', message: 'New reward prize added to catalog.', variant: 'success' });
      }
      navigate('/admin/rewards');
    } catch (err) {
      addToast({
        title: 'Save Failed',
        message: err.response?.data?.message || err.message || 'Could not save prize.',
        variant: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const primaryPhoto = formData.images.find((img) => img.isPrimary)?.url || formData.images[0]?.url || 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400';

  if (loading) {
    return (
      <div style={{ padding: '5rem', textAlign: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* 1. Header Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate('/admin/rewards')}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Rewards Catalog</span>
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" onClick={() => handleSubmit(false)} disabled={submitting}>
            Save as Draft
          </Button>
          <Button variant="primary" iconLeft={Save} onClick={() => handleSubmit(true)} disabled={submitting}>
            {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Publish to Store'}
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
          {isEditing ? `Edit Reward Prize: ${formData.title}` : 'Upload New Rewards Store Prize 🎁'}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
          Provide prize specifications, commercial photographs, coin redemption price, and delivery conditions.
        </p>
      </div>

      {/* 2. Responsive 2-Column Layout (Form on Left, Live Preview on Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          alignItems: 'flex-start'
        }}
      >
        {/* Left Column: Form Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section A: Product Information */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 1rem 0' }}>
              1. Prize Details
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Prize Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Philips 750W Mixer Grinder with 3 Jars"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Philips, Prestige, Bajaj"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Short Description (Catalog subtitle)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Heavy-duty 750W motor with 100% copper winding and 3 stainless steel jars."
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Full Description & Specifications
                </label>
                <textarea
                  rows={4}
                  placeholder="Full product details, warranty terms, inclusions in the box..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Section B: Photographs (Gallery / Files / Preview) */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                2. Commercial Photographs *
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {formData.images.length} photos added
              </span>
            </div>

            {/* Hidden Input for Phone Gallery / Files */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #475569',
                borderRadius: '12px',
                padding: '1.75rem',
                textAlign: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                cursor: 'pointer',
                marginBottom: '1rem',
                transition: 'border-color 0.2s ease'
              }}
            >
              <Upload size={32} color="#38bdf8" style={{ margin: '0 auto 8px auto' }} />
              <strong style={{ color: '#f8fafc', display: 'block', fontSize: '0.875rem' }}>
                Select Photos from Gallery or Computer
              </strong>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                Supports JPG, PNG, and WebP images. Tap to open gallery on mobile.
              </span>
            </div>

            {uploadProgress && (
              <div style={{ padding: '8px', color: '#38bdf8', fontSize: '0.8rem', textAlign: 'center' }}>
                {uploadProgress}
              </div>
            )}

            {/* Uploaded Photos Thumbnails */}
            {formData.images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px' }}>
                {formData.images.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      height: '90px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: img.isPrimary ? '2px solid #38bdf8' : '1px solid #334155',
                      backgroundColor: '#0f172a'
                    }}
                  >
                    <img
                      src={img.url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                    />
                    {/* Primary Star */}
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      title="Set as Primary Image"
                      style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        backgroundColor: img.isPrimary ? '#38bdf8' : 'rgba(0,0,0,0.6)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        color: '#ffffff'
                      }}
                    >
                      <Star size={12} fill={img.isPrimary ? '#ffffff' : 'none'} />
                    </button>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px 4px',
                        cursor: 'pointer',
                        color: '#ffffff'
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: Pricing, Stock & Logistics */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 1rem 0' }}>
              3. Coin Price & Inventory
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Coin Redemption Price *
                </label>
                <div style={{ position: 'relative' }}>
                  <Coins size={16} color="#fde047" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.coinPrice}
                    onChange={(e) => setFormData({ ...formData, coinPrice: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: '100%', padding: '9px 12px 9px 34px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem', fontWeight: 800 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Stock Inventory Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value, 10) || 0 })}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Estimated Delivery Range (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={formData.estimatedDeliveryDays}
                  onChange={(e) => setFormData({ ...formData, estimatedDeliveryDays: parseInt(e.target.value, 10) || 5 })}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  SKU / Inventory Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. SKU-KITCH-750W"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            {/* Toggles */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #334155', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.825rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                />
                <span>Featured Prize on Store Homepage</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.825rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                />
                <span>Publish Immediately to Live Store</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Live Amazon-style Preview Card */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <Eye size={14} color="#38bdf8" />
            <span>Live Customer Store Preview</span>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              maxWidth: '360px',
              margin: '0 auto'
            }}
          >
            {/* Preview Image */}
            <div style={{ height: '220px', backgroundColor: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
              <img
                src={primaryPhoto}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '16px' }}
              />
              {formData.featured && (
                <span style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: '#f59e0b', color: '#ffffff', fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px' }}>
                  FEATURED
                </span>
              )}
              {formData.deliveryEligible && (
                <span style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(255,255,255,0.92)', color: '#065f46', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Truck size={12} />
                  <span>Free Doorstep Delivery</span>
                </span>
              )}
            </div>

            {/* Preview Info */}
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                  {formData.brand || formData.category}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: formData.stockQuantity > 0 ? '#10b981' : '#ef4444' }}>
                  {formData.stockQuantity > 0 ? `${formData.stockQuantity} in stock` : 'Out of stock'}
                </span>
              </div>

              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.35 }}>
                {formData.title || 'Product Title Appears Here'}
              </h4>

              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                {formData.shortDescription || 'Short description appears here for shoppers.'}
              </p>

              <div style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                    Coin Price
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Coins size={16} color="#eab308" />
                    <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                      {formData.coinPrice}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>coins</span>
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'default'
                  }}
                >
                  Redeem Prize
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRewardFormPage;
