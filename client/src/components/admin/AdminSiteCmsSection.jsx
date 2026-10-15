import React, { useState, useEffect } from 'react';
import {
  Globe,
  Layout,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useSiteConfig } from '../../context/SiteConfigContext';
import contentService from '../../services/contentService';
import Spinner from '../common/Spinner';

export const AdminSiteCmsSection = () => {
  const { siteConfig, refreshSiteConfig } = useSiteConfig();
  const [config, setConfig] = useState(siteConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // New Link form state
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkPath, setNewLinkPath] = useState('');

  // New Custom Stat form state (e.g. Customers 10000+)
  const [newStatLabel, setNewStatLabel] = useState('Customers');
  const [newStatValue, setNewStatValue] = useState('10000+');
  const [newStatDesc, setNewStatDesc] = useState('Active community members in the loop');

  useEffect(() => {
    if (siteConfig) {
      setConfig({
        ...siteConfig,
        navLinks: siteConfig.navLinks || [],
        impactSection: {
          title: siteConfig.impactSection?.title || 'Reducing Waste Through Circular Reuse',
          subtitle: siteConfig.impactSection?.subtitle || 'Every item borrowed or gifted on LOOOP represents one less product manufactured, shipped in single-use plastic, or buried in a landfill.',
          badge: siteConfig.impactSection?.badge || 'Verified Community Impact',
          customCards: siteConfig.impactSection?.customCards || [
            { id: 'customers', label: 'Customers', value: '10000+', desc: 'Active community members' }
          ],
          hiddenCards: siteConfig.impactSection?.hiddenCards || []
        }
      });
    }
  }, [siteConfig]);

  const handleSaveAll = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setNotification(null);
      const res = await contentService.updateSiteSettings(config);

      if (res?.success) {
        setNotification({
          type: 'success',
          message: 'Website CMS, Navigation, Logo, and Impact section saved and updated live!'
        });
        if (refreshSiteConfig) await refreshSiteConfig();
      }
    } catch (err) {
      console.error('Failed to update site config:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save site configuration.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Nav link toggles
  const toggleNavLinkVisibility = (id) => {
    setConfig((prev) => ({
      ...prev,
      navLinks: prev.navLinks.map((link) =>
        link.id === id ? { ...link, visible: !link.visible } : link
      )
    }));
  };

  const updateNavLinkLabel = (id, newLabel) => {
    setConfig((prev) => ({
      ...prev,
      navLinks: prev.navLinks.map((link) =>
        link.id === id ? { ...link, label: newLabel } : link
      )
    }));
  };

  const deleteNavLink = (id) => {
    setConfig((prev) => ({
      ...prev,
      navLinks: prev.navLinks.filter((link) => link.id !== id)
    }));
  };

  const handleAddNavLink = (e) => {
    e.preventDefault();
    if (!newLinkLabel.trim() || !newLinkPath.trim()) return;

    const id = `nav_${Date.now()}`;
    setConfig((prev) => ({
      ...prev,
      navLinks: [
        ...prev.navLinks,
        {
          id,
          label: newLinkLabel.trim(),
          path: newLinkPath.trim(),
          visible: true
        }
      ]
    }));
    setNewLinkLabel('');
    setNewLinkPath('');
  };

  // Impact Cards toggles & custom stats
  const toggleDefaultCardHidden = (cardId) => {
    setConfig((prev) => {
      const currentHidden = prev.impactSection?.hiddenCards || [];
      const isHidden = currentHidden.includes(cardId);
      const newHidden = isHidden
        ? currentHidden.filter((id) => id !== cardId)
        : [...currentHidden, cardId];

      return {
        ...prev,
        impactSection: {
          ...prev.impactSection,
          hiddenCards: newHidden
        }
      };
    });
  };

  const handleAddCustomStat = (e) => {
    e.preventDefault();
    if (!newStatLabel.trim() || !newStatValue.trim()) return;

    const statId = `custom_${Date.now()}`;
    const newCard = {
      id: statId,
      label: newStatLabel.trim(),
      value: newStatValue.trim(),
      desc: newStatDesc.trim() || 'Community milestone'
    };

    setConfig((prev) => ({
      ...prev,
      impactSection: {
        ...prev.impactSection,
        customCards: [...(prev.impactSection?.customCards || []), newCard]
      }
    }));

    setNewStatLabel('');
    setNewStatValue('');
    setNewStatDesc('');
  };

  const deleteCustomStat = (statId) => {
    setConfig((prev) => ({
      ...prev,
      impactSection: {
        ...prev.impactSection,
        customCards: (prev.impactSection?.customCards || []).filter((c) => c.id !== statId)
      }
    }));
  };

  const updateCustomStat = (statId, field, val) => {
    setConfig((prev) => ({
      ...prev,
      impactSection: {
        ...prev.impactSection,
        customCards: (prev.impactSection?.customCards || []).map((c) =>
          c.id === statId ? { ...c, [field]: val } : c
        )
      }
    }));
  };

  const hiddenCards = config?.impactSection?.hiddenCards || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
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

      {/* 1. BRANDING & LOGO CONTROLS */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '14px',
          padding: '1.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.85rem' }}>
          <Globe size={20} color="#34d399" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Website Brand & Logo Configuration
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Modify the brand title, logo styling, and site-wide platform name.
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
              Website Title / Brand Name
            </label>
            <input
              type="text"
              value={config?.siteName || ''}
              onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
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
              Logo Display Text
            </label>
            <input
              type="text"
              value={config?.logoText || ''}
              onChange={(e) => setConfig({ ...config, logoText: e.target.value })}
              placeholder="e.g. Looop"
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
              Custom Logo Image URL (Optional)
            </label>
            <input
              type="url"
              value={config?.logoUrl || ''}
              onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
              placeholder="https://... (leave blank to use vector 3-ring logo)"
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
              Brand Tagline
            </label>
            <input
              type="text"
              value={config?.siteTagline || ''}
              onChange={(e) => setConfig({ ...config, siteTagline: e.target.value })}
              placeholder="Share. Reuse. Connect."
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
      </div>

      {/* 2. HEADER NAVIGATION LINKS MANAGER */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '14px',
          padding: '1.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.85rem' }}>
          <Layout size={20} color="#38bdf8" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Header Navigation Links Governance
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Control which links are present or hidden in the header (Home, Browse, How It Works, About, Impact, etc.) and customize labels.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {(config?.navLinks || []).map((link) => (
            <div
              key={link.id}
              style={{
                backgroundColor: '#0f172a',
                border: link.visible ? '1px solid #334155' : '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 260px' }}>
                <input
                  type="checkbox"
                  id={`link-vis-${link.id}`}
                  checked={link.visible !== false}
                  onChange={() => toggleNavLinkVisibility(link.id)}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateNavLinkLabel(link.id, e.target.value)}
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px 10px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    flex: '1 1 180px'
                  }}
                />
                <span style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                  {link.path}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: link.visible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: link.visible ? '#34d399' : '#f87171'
                  }}
                >
                  {link.visible ? 'Present in Header' : 'Hidden from Header'}
                </span>

                <button
                  type="button"
                  onClick={() => toggleNavLinkVisibility(link.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: link.visible ? '#fbbf24' : '#34d399',
                    padding: '5px 8px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {link.visible ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{link.visible ? 'Hide' : 'Show'}</span>
                </button>

                {!['home', 'browse', 'how-it-works', 'about'].includes(link.id) && (
                  <button
                    type="button"
                    onClick={() => deleteNavLink(link.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      borderRadius: '6px',
                      color: '#f87171',
                      padding: '5px 8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Custom Navigation Link */}
        <form onSubmit={handleAddNavLink} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px dashed #475569' }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}>Add New Link:</span>
          <input
            type="text"
            required
            placeholder="Label (e.g. Impact)"
            value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.85rem',
              flex: '1 1 120px'
            }}
          />
          <input
            type="text"
            required
            placeholder="Path (e.g. /#impact)"
            value={newLinkPath}
            onChange={(e) => setNewLinkPath(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.85rem',
              flex: '1 1 140px'
            }}
          />
          <button
            type="submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={15} />
            <span>Add Link</span>
          </button>
        </form>
      </div>

      {/* 3. VERIFIED COMMUNITY IMPACT SECTION GOVERNANCE (Photo 1 Controls) */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '14px',
          padding: '1.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.85rem' }}>
          <Sparkles size={20} color="#10b981" />
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Verified Community Impact Section Customizer
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Add new metrics like "10000+ Customers", toggle or remove any stat element in this section.
            </span>
          </div>
        </div>

        {/* Section Headings */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
              Section Title
            </label>
            <input
              type="text"
              value={config?.impactSection?.title || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  impactSection: { ...config.impactSection, title: e.target.value }
                })
              }
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
              Section Badge Tag
            </label>
            <input
              type="text"
              value={config?.impactSection?.badge || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  impactSection: { ...config.impactSection, badge: e.target.value }
                })
              }
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
            Section Description Subtitle
          </label>
          <textarea
            rows={2}
            value={config?.impactSection?.subtitle || ''}
            onChange={(e) =>
              setConfig({
                ...config,
                impactSection: { ...config.impactSection, subtitle: e.target.value }
              })
            }
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
              marginBottom: '1.5rem'
            }}
          />
        </div>

        {/* DEFAULT METRIC CARDS TOGGLE (Remove / Hide element as in Photo 1) */}
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Default Impact Stat Elements (Check to show, uncheck to remove/hide)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
          {[
            { id: 'itemsReused', label: 'Items Reused', desc: 'Increases dynamically on reuse' },
            { id: 'peopleHelped', label: 'People Helped', desc: 'Increases dynamically on connect' },
            { id: 'booksShared', label: 'Books Shared', desc: 'Increases on book sharing' },
            { id: 'electronicsShared', label: 'Electronics Shared', desc: 'Increases on electronics sharing' },
            { id: 'wasteAvoided', label: 'Waste Avoided', desc: 'Calculated in kg' }
          ].map((item) => {
            const isVisible = !hiddenCards.includes(item.id);

            return (
              <div
                key={item.id}
                onClick={() => toggleDefaultCardHidden(item.id)}
                style={{
                  backgroundColor: '#0f172a',
                  border: isVisible ? '1px solid #10b981' : '1px dashed #475569',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  opacity: isVisible ? 1 : 0.6,
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => toggleDefaultCardHidden(item.id)}
                  style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: isVisible ? '#ffffff' : '#94a3b8', fontSize: '0.9rem' }}>
                    {item.label}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {isVisible ? 'Visible in Section' : 'Hidden (Removed)'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CUSTOM STAT CARDS (e.g. Customers: 10000+) */}
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Custom Admin Impact Metric Cards (e.g. Customers: 10000+)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {(config?.impactSection?.customCards || []).map((card) => (
            <div
              key={card.id}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 240px' }}>
                <input
                  type="text"
                  value={card.label}
                  onChange={(e) => updateCustomStat(card.id, 'label', e.target.value)}
                  placeholder="Metric Label (e.g. Customers)"
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px 10px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    width: '120px'
                  }}
                />
                <input
                  type="text"
                  value={card.value}
                  onChange={(e) => updateCustomStat(card.id, 'value', e.target.value)}
                  placeholder="Value (e.g. 10000+)"
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #10b981',
                    borderRadius: '6px',
                    color: '#34d399',
                    padding: '6px 10px',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    width: '120px'
                  }}
                />
                <input
                  type="text"
                  value={card.desc}
                  onChange={(e) => updateCustomStat(card.id, 'desc', e.target.value)}
                  placeholder="Description"
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    flex: '1 1 180px'
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => deleteCustomStat(card.id)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  color: '#f87171',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            </div>
          ))}
        </div>

        {/* Add New Custom Stat Card */}
        <form onSubmit={handleAddCustomStat} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px dashed #475569' }}>
          <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}>Add Stat Card:</span>
          <input
            type="text"
            required
            placeholder="Label (e.g. Customers)"
            value={newStatLabel}
            onChange={(e) => setNewStatLabel(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.85rem',
              width: '120px'
            }}
          />
          <input
            type="text"
            required
            placeholder="Value (e.g. 10000+)"
            value={newStatValue}
            onChange={(e) => setNewStatValue(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #10b981',
              borderRadius: '6px',
              color: '#34d399',
              fontWeight: 800,
              fontSize: '0.85rem',
              width: '120px'
            }}
          />
          <input
            type="text"
            placeholder="Description (e.g. Active community members)"
            value={newStatDesc}
            onChange={(e) => setNewStatDesc(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.85rem',
              flex: '1 1 180px'
            }}
          />
          <button
            type="submit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <Plus size={15} />
            <span>Add Stat Card</span>
          </button>
        </form>
      </div>

      {/* Global Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '14px 28px',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
            transition: 'transform 0.15s ease'
          }}
        >
          {isSaving ? <Spinner size="sm" /> : <Save size={18} />}
          <span>Save Website CMS & Impact Settings</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSiteCmsSection;
