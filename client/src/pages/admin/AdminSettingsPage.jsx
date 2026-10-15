import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Globe,
  UploadCloud,
  MapPin,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import adminService from '../../services/adminService';
import Spinner from '../../components/common/Spinner';
import AdminSiteCmsSection from '../../components/admin/AdminSiteCmsSection';
import AdminImpactFactorsSection from '../../components/admin/AdminImpactFactorsSection';
import AdminUploadRulesSettings from '../../components/admin/AdminUploadRulesSettings';
import AdminLocationRulesSettings from '../../components/admin/AdminLocationRulesSettings';

export const AdminSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('cms'); // 'cms' | 'engine' | 'upload' | 'location' | 'impact'
  const [settings, setSettings] = useState({
    defaultMatchThreshold: 60,
    defaultSearchRadiusKm: 25,
    itemsPerPage: 20,
    maintenanceMode: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const res = await adminService.getSettings();
        if (res?.success && res.settings) {
          setSettings((prev) => ({ ...prev, ...res.settings }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        setNotification({ type: 'error', message: 'Failed to retrieve platform settings.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setNotification(null);
      const res = await adminService.updateSettings(settings);
      if (res?.success) {
        setNotification({
          type: 'success',
          message: 'Platform configuration updated and saved safely.'
        });
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save settings.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1050px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
          Platform Settings & Governance
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
          Manage global site branding, header navigation links, verified impact metrics, matching thresholds, and discovery rules.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #334155',
          paddingBottom: '2px',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'cms', label: 'Website CMS & Branding', icon: Globe },
          { id: 'engine', label: 'Matching & Core Engine', icon: Sliders },
          { id: 'upload', label: 'Product Upload Rules', icon: UploadCloud },
          { id: 'location', label: 'Location & Discovery Rules', icon: MapPin },
          { id: 'impact', label: 'Environmental Multipliers', icon: TrendingUp }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: isActive ? '#1e293b' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #10b981' : '3px solid transparent',
                borderRadius: '8px 8px 0 0',
                color: isActive ? '#ffffff' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={16} color={isActive ? '#10b981' : '#64748b'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {notification && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${notification.type === 'error' ? 'var(--color-danger)' : '#10b981'}`,
            borderRadius: 'var(--radius-sm)',
            color: notification.type === 'error' ? '#f87171' : '#34d399',
            fontSize: '0.875rem'
          }}
        >
          {notification.message}
        </div>
      )}

      {/* TAB 1: WEBSITE CMS & BRANDING */}
      {activeTab === 'cms' && <AdminSiteCmsSection />}

      {/* TAB 2: MATCHING & CORE ENGINE */}
      {activeTab === 'engine' && (
        isLoading ? (
          <div style={{ minHeight: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
            {/* Smart Matching & Discovery Parameters */}
            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                <Sliders size={18} color="var(--color-primary-400)" />
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Smart Discovery & Matching Thresholds
                </h2>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                    Default Match Compatibility Threshold
                  </label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary-400)' }}>
                    {settings.defaultMatchThreshold} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  step="5"
                  value={settings.defaultMatchThreshold}
                  onChange={(e) => setSettings({ ...settings, defaultMatchThreshold: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', accentColor: 'var(--color-primary-500)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                    Default Discovery Radius
                  </label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary-400)' }}>
                    {settings.defaultSearchRadiusKm} km
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={settings.defaultSearchRadiusKm}
                  onChange={(e) => setSettings({ ...settings, defaultSearchRadiusKm: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', accentColor: 'var(--color-primary-500)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Default Items Per Page (Catalog / Explore)
                </label>
                <select
                  value={settings.itemsPerPage}
                  onChange={(e) => setSettings({ ...settings, itemsPerPage: parseInt(e.target.value, 10) })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value={12}>12 items per page</option>
                  <option value={20}>20 items per page</option>
                  <option value={24}>24 items per page</option>
                  <option value={48}>48 items per page</option>
                </select>
              </div>
            </div>

            {/* Platform Maintenance Mode */}
            <div
              style={{
                backgroundColor: '#1e293b',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color={settings.maintenanceMode ? '#f87171' : '#64748b'} />
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                    Platform Maintenance Mode
                  </span>
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  When active, non-admin members receive a maintenance advisory banner on new listing creation.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
                style={{
                  padding: '6px 14px',
                  backgroundColor: settings.maintenanceMode ? 'rgba(239, 68, 68, 0.2)' : '#334155',
                  border: `1px solid ${settings.maintenanceMode ? 'var(--color-danger)' : '#475569'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: settings.maintenanceMode ? '#f87171' : '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {settings.maintenanceMode ? 'ACTIVE (Enabled)' : 'Disabled'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}
              >
                {isSaving ? <Spinner size="sm" /> : <Save size={16} />}
                <span>Save Configuration</span>
              </button>
            </div>
          </form>
        )
      )}

      {/* TAB 3: PRODUCT UPLOAD RULES */}
      {activeTab === 'upload' && <AdminUploadRulesSettings />}

      {/* TAB 4: LOCATION & GPS RULES */}
      {activeTab === 'location' && <AdminLocationRulesSettings />}

      {/* TAB 5: ENVIRONMENTAL IMPACT FACTORS */}
      {activeTab === 'impact' && <AdminImpactFactorsSection />}
    </div>
  );
};

export default AdminSettingsPage;
