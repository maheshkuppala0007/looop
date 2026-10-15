import React, { createContext, useContext, useState, useEffect } from 'react';
import contentService from '../services/contentService';

const DEFAULT_CONFIG = {
  siteName: 'LOOOP',
  siteTagline: 'Share. Reuse. Connect.',
  logoText: 'Looop',
  logoUrl: '',
  navLinks: [
    { id: 'home', label: 'Home', path: '/', visible: true },
    { id: 'browse', label: 'Browse', path: '/browse', visible: true },
    { id: 'how-it-works', label: 'How LOOOP Works', path: '/how-it-works', visible: true },
    { id: 'about', label: 'About the Mission', path: '/about', visible: true }
  ],
  impactSection: {
    title: 'Reducing Waste Through Circular Reuse',
    subtitle: 'Every item borrowed or gifted on LOOOP represents one less product manufactured, shipped in single-use plastic, or buried in a landfill.',
    badge: 'Verified Community Impact',
    customCards: [
      { id: 'customers', label: 'Customers', value: '10000+', desc: 'Active community members', visible: true }
    ],
    hiddenCards: []
  }
};

const SiteConfigContext = createContext({
  siteConfig: DEFAULT_CONFIG,
  loading: true,
  refreshSiteConfig: async () => {}
});

export const SiteConfigProvider = ({ children }) => {
  const [siteConfig, setSiteConfig] = useState(() => {
    try {
      const cached = localStorage.getItem('looop_site_config_cache');
      return cached ? JSON.parse(cached) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const res = await contentService.getSiteSettings();
      if (res?.success && res.settings) {
        setSiteConfig(res.settings);
        localStorage.setItem('looop_site_config_cache', JSON.stringify(res.settings));
      }
    } catch (err) {
      console.warn('Could not load remote site settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <SiteConfigContext.Provider value={{ siteConfig, loading, refreshSiteConfig: fetchConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
};

export const useSiteConfig = () => useContext(SiteConfigContext);

export default SiteConfigContext;
