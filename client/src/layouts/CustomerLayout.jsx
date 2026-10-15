import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  PlusCircle,
  HelpCircle,
  Inbox,
  MessageSquare,
  Bell,
  User,
  LogOut,
  ShieldCheck,
  Repeat,
  Bookmark,
  Sparkles,
  Menu,
  X,
  PackageCheck,
  ArrowRight,
  Leaf,
  Coins,
  Gift,
  Package
} from 'lucide-react';
import LooopLogo from '../components/common/LooopLogo';
import Avatar from '../components/common/Avatar';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { useToast } from '../hooks/useToast';

export const CustomerLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadTotal } = useSocket();
  const { unreadCount: unreadNotifsCount } = useNotification();
  const { addToast } = useToast();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentUser = user || { name: 'Member', email: '' };
  const displayName = currentUser?.name || 'Member';
  const trustScore = currentUser?.trustScore || 100;

  // Real backend unread counts
  const unreadMessagesCount = unreadTotal || 0;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/browse');
    }
  };

  const handleLogout = () => {
    logout();
    addToast({
      title: 'Signed Out',
      message: 'You have been logged out of your LOOOP session.',
      variant: 'info'
    });
    navigate('/login');
  };

  // Grouped Navigation Structure
  const navigationGroups = [
    {
      group: 'Main',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }
      ]
    },
    {
      group: 'Discover & Share',
      items: [
        { label: 'Browse Items', path: '/browse', icon: Search },
        { label: 'Rewards Store', path: '/rewards', icon: Gift },
        { label: 'Wanted Items', path: '/wanted', icon: HelpCircle },
        { label: 'Share an Item', path: '/share', icon: PlusCircle, isCta: true }
      ]
    },
    {
      group: 'Activity',
      items: [
        { label: 'Requests', path: '/requests', icon: Inbox },
        { label: 'Offers', path: '/requests?tab=offers', icon: Sparkles },
        { label: 'My Items', path: '/my-items', icon: PackageCheck },
        { label: 'Saved Items', path: '/saved', icon: Bookmark },
        { label: 'Transactions', path: '/transactions', icon: Repeat },
        { label: 'Reward Orders', path: '/rewards/orders', icon: Package }
      ]
    },
    {
      group: 'Community',
      items: [
        { label: 'Messages', path: '/messages', icon: MessageSquare, badge: unreadMessagesCount },
        { label: 'Notifications', path: '/notifications', icon: Bell, badge: unreadNotifsCount },
        { label: 'Impact', path: '/impact', icon: Leaf }
      ]
    },
    {
      group: 'Account',
      items: [
        { label: 'Coins Wallet', path: '/coins', icon: Coins },
        { label: 'My Profile', path: '/profile', icon: User }
      ]
    }
  ];


  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/customer/dashboard';
    }
    if (path === '/share') {
      return location.pathname === '/share' || location.pathname === '/customer/share';
    }
    if (path === '/wanted') {
      return location.pathname.startsWith('/wanted') || location.pathname.startsWith('/customer/wanted');
    }
    if (path === '/requests') {
      return (location.pathname === '/requests' || location.pathname === '/customer/requests') && !location.search.includes('offers');
    }
    if (path === '/requests?tab=offers') {
      return (location.pathname === '/requests' || location.pathname === '/customer/requests') && location.search.includes('offers');
    }
    if (path === '/transactions') {
      return location.pathname === '/transactions' || location.pathname.startsWith('/transactions/') || location.pathname === '/customer/transactions';
    }
    if (path === '/my-items') {
      return location.pathname === '/my-items' || location.pathname === '/customer/my-items';
    }
    if (path === '/saved') {
      return location.pathname === '/saved' || location.pathname === '/customer/saved';
    }
    return location.pathname === path;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', color: 'var(--color-slate-900)' }}>
      {/* 1. DESKTOP PERSISTENT SIDEBAR */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid var(--color-slate-200)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
          flexShrink: 0
        }}
        className="customer-desktop-sidebar"
      >
        {/* Sidebar Header: Brand */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-slate-100)' }}>
          <LooopLogo size="sm" showTagline={true} linkTo="/dashboard" />
        </div>

        {/* Sidebar Navigation Links (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {navigationGroups.map((group) => (
            <div key={group.group}>
              <div
                style={{
                  padding: '0 0.75rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-slate-400)',
                  marginBottom: '0.4rem'
                }}
              >
                {group.group}
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {group.items.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;

                  if (item.isCta) {
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                          margin: '4px 0',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                          transition: 'transform var(--transition-fast)'
                        }}
                        className="sidebar-cta-btn"
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Icon size={17} />
                          <span>{item.label}</span>
                        </span>
                        <ArrowRight size={14} />
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontWeight: active ? 700 : 500,
                        color: active ? '#047857' : 'var(--color-slate-600)',
                        backgroundColor: active ? '#ecfdf5' : 'transparent',
                        textDecoration: 'none',
                        transition: 'all var(--transition-fast)'
                      }}
                      className={active ? 'sidebar-link-active' : 'sidebar-link'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={17} color={active ? '#059669' : 'var(--color-slate-400)'} />
                        <span>{item.label}</span>
                      </span>
                      {item.badge && item.badge > 0 && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: active ? '#059669' : 'var(--color-slate-200)',
                            color: active ? '#ffffff' : 'var(--color-slate-700)'
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: User Brief & Logout */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--color-slate-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff'
          }}
        >
          <Link
            to="/profile"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
          >
            <Avatar src={currentUser.avatar} name={displayName} size="sm" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-slate-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <ShieldCheck size={12} />
                <span>Verified Member</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-slate-400)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color var(--transition-fast)'
            }}
            className="sidebar-logout-btn"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER NAVIGATION & OVERLAY */}
      {mobileDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex'
          }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(2px)'
            }}
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div
            style={{
              position: 'relative',
              width: '82%',
              maxWidth: '310px',
              backgroundColor: '#ffffff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 101
            }}
            className="mobile-drawer-pane"
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-slate-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <LooopLogo size="sm" showTagline={false} linkTo="/dashboard" />
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-slate-500)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {navigationGroups.map((group) => (
                <div key={group.group}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-slate-400)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {group.items.map((item) => {
                      const active = isActive(item.path);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileDrawerOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            fontWeight: active ? 700 : 500,
                            color: active ? '#047857' : 'var(--color-slate-700)',
                            backgroundColor: active ? '#ecfdf5' : 'transparent',
                            textDecoration: 'none'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Icon size={18} color={active ? '#059669' : 'var(--color-slate-400)'} />
                            <span>{item.label}</span>
                          </span>
                          {item.badge && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 'var(--radius-full)', backgroundColor: '#059669', color: '#fff' }}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Logout */}
            <div style={{ padding: '1.25rem', borderTop: '1px solid var(--color-slate-100)' }}>
              <Button
                variant="outline"
                size="md"
                style={{ width: '100%' }}
                iconLeft={LogOut}
                onClick={handleLogout}
              >
                Log Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
        {/* TOPBAR HEADER */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            backgroundColor: '#ffffff',
            borderBottom: '1px solid var(--color-slate-200)',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          {/* Left: Mobile Toggle & Brand Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-slate-100)',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-slate-700)'
              }}
              className="mobile-menu-toggle"
            >
              <Menu size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="customer-portal-badge">
              <Badge variant="success">Customer Portal</Badge>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-400)', display: 'none' }} className="brand-tagline-indicator">
                Share. Reuse. Connect.
              </span>
            </div>
          </div>

          {/* Center: Prominent Dashboard Search */}
          <form
            onSubmit={handleSearchSubmit}
            style={{
              flex: 1,
              maxWidth: '540px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: '12px',
                color: 'var(--color-slate-400)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Search size={17} />
            </span>
            <input
              type="text"
              placeholder="Search items, categories, or nearby listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 14px 8px 38px',
                fontSize: '0.875rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-slate-300)',
                backgroundColor: '#f8fafc',
                color: 'var(--color-slate-900)',
                outline: 'none',
                transition: 'all var(--transition-fast)'
              }}
              className="dashboard-search-input"
            />
          </form>

          {/* Right: Quick Share, Notifications & Profile Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Link
              to="/share"
              style={{ textDecoration: 'none' }}
              className="topbar-share-btn-wrapper"
            >
              <Button variant="primary" size="sm" iconLeft={PlusCircle}>
                Share Item
              </Button>
            </Link>

            {/* Notifications Button */}
            <Link
              to="/notifications"
              title="Notifications"
              aria-label={`View notifications${unreadNotifsCount > 0 ? ` (${unreadNotifsCount} unread)` : ''}`}
              style={{
                position: 'relative',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-slate-200)',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: unreadNotifsCount > 0 ? '#059669' : 'var(--color-slate-600)',
                textDecoration: 'none',
                transition: 'all var(--transition-fast)'
              }}
              className="topbar-icon-btn"
            >
              <Bell size={18} />
              {unreadNotifsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 4px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 0 2px #ffffff'
                  }}
                >
                  {unreadNotifsCount > 99 ? '99+' : unreadNotifsCount}
                </span>
              )}
            </Link>

            {/* Profile Avatar Pill */}
            <Link
              to="/profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                padding: '3px 8px 3px 4px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-slate-200)',
                backgroundColor: '#ffffff',
                transition: 'border-color var(--transition-fast)'
              }}
              className="topbar-profile-pill"
            >
              <Avatar src={currentUser.avatar} name={displayName} size="sm" />
              <div style={{ display: 'none', flexDirection: 'column' }} className="topbar-user-info">
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-slate-800)', lineHeight: 1.1 }}>
                  {displayName.split(' ')[0]}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600 }}>
                  {trustScore}% Trust
                </span>
              </div>
            </Link>
          </div>
        </header>

        {/* MAIN DASHBOARD CONTENT VIEWPORT */}
        <main style={{ flex: 1, padding: '1.75rem 2rem 5rem 2rem', minWidth: 0, width: '100%', boxSizing: 'border-box' }} className="customer-main-content">
          <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>{children}</div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (<= 768px) */}
      <nav className="customer-mobile-bottom-nav" aria-label="Quick Actions">
        <Link
          to="/dashboard"
          className={`bottom-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </Link>

        <Link
          to="/browse"
          className={`bottom-nav-item ${isActive('/browse') ? 'active' : ''}`}
        >
          <Search size={20} />
          <span>Browse</span>
        </Link>

        {/* Center Floating Share Action */}
        <Link
          to="/share"
          className="bottom-nav-center-action"
          aria-label="Share an item"
        >
          <PlusCircle size={24} />
          <span>Share</span>
        </Link>

        <Link
          to="/requests"
          className={`bottom-nav-item ${isActive('/requests') ? 'active' : ''}`}
        >
          <Inbox size={20} />
          <span>Requests</span>
        </Link>

        <Link
          to="/profile"
          className={`bottom-nav-item ${isActive('/profile') ? 'active' : ''}`}
        >
          <User size={20} />
          <span>Profile</span>
        </Link>
      </nav>

      {/* Embedded Responsive & Micro-Interaction Styling */}
      <style>{`
        .sidebar-link:hover {
          background-color: var(--color-slate-100) !important;
          color: var(--color-slate-900) !important;
        }
        .sidebar-logout-btn:hover {
          color: var(--color-danger) !important;
          background-color: var(--color-danger-bg) !important;
        }
        .dashboard-search-input:focus {
          background-color: #ffffff !important;
          border-color: var(--color-primary-500) !important;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18) !important;
        }
        .topbar-icon-btn:hover, .topbar-profile-pill:hover {
          border-color: var(--color-primary-300) !important;
        }
        .sidebar-cta-btn:hover {
          transform: translateY(-1px);
        }

        /* Mobile Bottom Nav styles */
        .customer-mobile-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 62px;
          background-color: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid var(--color-slate-200);
          z-index: 50;
          align-items: center;
          justify-content: space-around;
          padding: 0 8px;
          box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.05);
        }

        .bottom-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--color-slate-500);
          text-decoration: none;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
          min-width: 54px;
        }

        .bottom-nav-item.active {
          color: #047857;
        }

        .bottom-nav-center-action {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: linear-gradient(135deg, #059669, #10b981);
          color: #ffffff;
          border-radius: var(--radius-full);
          padding: 8px 14px;
          font-size: 0.7rem;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
          transform: translateY(-8px);
          transition: transform var(--transition-fast);
        }

        .bottom-nav-center-action:active {
          transform: translateY(-6px) scale(0.96);
        }

        .bottom-nav-badge {
          position: absolute;
          top: -4px;
          right: -8px;
          background-color: #ef4444;
          color: #ffffff;
          font-size: 0.6rem;
          font-weight: 800;
          border-radius: var(--radius-full);
          padding: 1px 4px;
          min-width: 14px;
          text-align: center;
        }

        @media (min-width: 768px) {
          .topbar-user-info { display: flex !important; }
          .brand-tagline-indicator { display: inline !important; }
        }

        @media (max-width: 1024px) {
          .customer-desktop-sidebar {
            display: none !important;
          }
          .mobile-menu-toggle {
            display: flex !important;
          }
          .customer-main-content {
            padding: 1.25rem 1rem 4rem 1rem !important;
          }
        }

        @media (max-width: 768px) {
          .customer-mobile-bottom-nav {
            display: flex !important;
          }
          .customer-main-content {
            padding: 1rem 0.85rem 5.5rem 0.85rem !important;
          }
        }

        @media (max-width: 640px) {
          .topbar-share-btn-wrapper {
            display: none !important;
          }
        }

        @media (max-width: 480px) {
          .customer-portal-badge {
            display: none !important;
          }
          .dashboard-search-input {
            font-size: 0.8rem !important;
            padding: 6px 10px 6px 32px !important;
          }
          .customer-main-content {
            padding: 0.85rem 0.5rem 5.5rem 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomerLayout;
