import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, HelpCircle, Menu, X, ArrowRight, User, LogOut, Bell } from 'lucide-react';
import Button from '../common/Button';
import LooopLogo from '../common/LooopLogo';
import LocationBadge from '../location/LocationBadge';
import { useAuth } from '../../context/AuthContext';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { useNotification } from '../../context/NotificationContext';

export const Navbar = () => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { siteConfig } = useSiteConfig?.() || {};
  const { unreadCount = 0 } = useNotification?.() || {};
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = (siteConfig?.navLinks || [
    { id: 'home', label: 'Home', path: '/', visible: true },
    { id: 'browse', label: 'Browse', path: '/browse', visible: true },
    { id: 'how-it-works', label: 'How It Works', path: '/how-it-works', visible: true },
    { id: 'about', label: 'About', path: '/about', visible: true }
  ]).filter((link) => link.visible !== false);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: isScrolled ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: isScrolled ? '1px solid rgba(226, 232, 240, 0.9)' : '1px solid transparent',
        boxShadow: isScrolled ? '0 4px 20px -2px rgba(15, 23, 42, 0.05)' : 'none',
        height: 'var(--header-height, 68px)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div
        className="container"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem'
        }}
      >
        {/* Dynamic LOOOP Brand Mark */}
        <LooopLogo
          size="md"
          showTagline={false}
          linkTo="/"
          customText={siteConfig?.logoText || siteConfig?.siteName || 'Looop'}
          customUrl={siteConfig?.logoUrl || ''}
        />

        {/* Desktop Primary Navigation */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '2rem',
            fontSize: '0.925rem',
            fontWeight: 500
          }}
          className="desktop-nav"
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => {
            const active = isActive(link.path);
            const isBrowse = link.path.includes('browse');
            const isHowItWorks = link.path.includes('how-it-works');

            return (
              <Link
                key={link.id || link.path}
                to={link.path}
                style={{
                  color: active ? 'var(--color-primary-600)' : 'var(--color-slate-600)',
                  fontWeight: active ? 700 : 500,
                  textDecoration: 'none',
                  transition: 'color var(--transition-fast)',
                  position: 'relative',
                  padding: '6px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                className="nav-link"
              >
                {isBrowse && <Search size={15} />}
                {isHowItWorks && <HelpCircle size={15} />}
                <span>{link.label}</span>
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      left: '0',
                      right: '0',
                      height: '2px',
                      backgroundColor: 'var(--color-primary-500)',
                      borderRadius: '2px'
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Location Badge, Notifications & Auth Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="navbar-location-container">
            <LocationBadge />
          </div>

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {/* Real-time Notification Bell */}
              <Link
                to="/notifications"
                title="Notifications"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '1px solid var(--color-slate-200)',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: unreadCount > 0 ? '#059669' : 'var(--color-slate-600)',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
                className="navbar-bell-btn"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      minWidth: '17px',
                      height: '17px',
                      padding: '0 3px',
                      borderRadius: '9999px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 0 2px #ffffff'
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <div className="navbar-desktop-auth" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Link
                  to={user?.role === 'admin' || user?.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'}
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="secondary" size="sm" iconLeft={User}>
                    {user?.name ? user.name.split(' ')[0] : 'Dashboard'}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  title="Log out"
                  style={{ color: '#ef4444', padding: '6px 10px' }}
                >
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
          ) : (
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="sm">
                Login
              </Button>
            </Link>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-toggle-btn"
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-slate-700)',
              padding: '6px',
              borderRadius: 'var(--radius-sm)'
            }}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid var(--color-slate-200)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {navLinks.map((link) => {
            const active = isActive(link.path);
            const isBrowse = link.path.includes('browse');
            const isHowItWorks = link.path.includes('how-it-works');

            return (
              <Link
                key={`mobile-${link.id || link.path}`}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  color: active ? 'var(--color-primary-600)' : 'var(--color-slate-800)',
                  fontWeight: active ? 700 : 600,
                  textDecoration: 'none',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isBrowse && <Search size={16} />}
                {isHowItWorks && <HelpCircle size={16} />}
                <span>{link.label}</span>
              </Link>
            );
          })}

          <hr style={{ borderColor: 'var(--color-slate-100)', margin: '4px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <LocationBadge />
            </div>

            {isAuthenticated ? (
              <>
                <Link
                  to="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-primary-50)',
                    color: 'var(--color-primary-800)',
                    fontWeight: 700,
                    textDecoration: 'none',
                    fontSize: '0.95rem'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={18} color="var(--color-primary-600)" />
                    <span>Notifications</span>
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </Link>

                <Link
                  to={user?.role === 'admin' || user?.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="secondary" size="sm" style={{ width: '100%' }} iconLeft={User}>
                    {user?.name || 'Dashboard'}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  style={{ width: '100%', color: '#ef4444' }}
                >
                  Log Out
                </Button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm" style={{ width: '100%' }}>
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Media Query Styles */}
      <style>{`
        @media (min-width: 960px) {
          .desktop-nav { display: flex !important; }
          .mobile-toggle-btn { display: none !important; }
        }
        @media (max-width: 959px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle-btn { display: block !important; }
        }
        @media (max-width: 768px) {
          .navbar-location-container { display: none !important; }
          .navbar-desktop-auth { display: none !important; }
        }
        .nav-link:hover {
          color: var(--color-primary-600) !important;
        }
        .navbar-bell-btn:hover {
          border-color: var(--color-primary-400) !important;
          color: var(--color-primary-600) !important;
        }
      `}</style>
    </header>
  );
};

export default Navbar;
