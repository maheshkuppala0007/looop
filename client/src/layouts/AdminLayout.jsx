import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  AlertTriangle,
  FolderTree,
  Repeat,
  BarChart3,
  Settings,
  Shield,
  FileText,
  LogOut,
  ArrowLeft,
  Activity,
  Menu,
  X,
  ChevronRight,
  Coins,
  MessageSquare,
  Bell,
  Search,
  RefreshCw,
  Gift,
  Clock,
  Star,
  Send,
  ShoppingBag,
  PackageCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import adminService from '../services/adminService';

export const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [badgeCounts, setBadgeCounts] = useState({
    pendingItems: 0,
    pendingRewardOrders: 0,
    openReports: 0,
    pendingRequests: 0,
    pointsSystem: 'ACTIVE'
  });
  const [dbStatus, setDbStatus] = useState('Connected');

  // Verify database connectivity and load badge counts without slowing down page navigation
  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      try {
        const res = await adminService.getDashboard('30d');
        if (mounted && res?.success && res.data?.metrics) {
          setBadgeCounts({
            pendingItems: res.data.metrics.pendingItems || 0,
            pendingRewardOrders: res.data.metrics.pendingRewardOrders || 0,
            openReports: res.data.metrics.openReports || 0,
            pendingRequests: res.data.metrics.pendingRequests || 0,
            pointsSystem: 'ACTIVE'
          });
          setDbStatus('Connected');
        }
      } catch (err) {
        if (mounted) {
          // Fast fallback health ping
          try {
            const hRes = await fetch('http://localhost:5000/api/health').then(r => r.json());
            if (mounted) {
              setDbStatus(hRes?.data?.database === 'Connected' ? 'Connected' : 'Degraded');
            }
          } catch {
            if (mounted) setDbStatus('Disconnected');
          }
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Products & Items', path: '/admin/products', icon: Package, count: badgeCounts.pendingItems > 0 ? badgeCounts.pendingItems : undefined, alert: true },
    { label: 'Rewards Store (Prizes)', path: '/admin/rewards', icon: Gift },
    { label: 'Reward Orders', path: '/admin/reward-orders', icon: PackageCheck, count: badgeCounts.pendingRewardOrders > 0 ? badgeCounts.pendingRewardOrders : undefined, alert: true },
    { label: 'Users Governance', path: '/admin/users', icon: Users },
    { label: 'Reuse Requests', path: '/admin/reuse-requests', icon: Gift },
    { label: 'Borrow Requests', path: '/admin/borrow-requests', icon: Clock },
    { label: 'All Requests', path: '/admin/requests', icon: FileText, count: badgeCounts.pendingRequests > 0 ? badgeCounts.pendingRequests : undefined },
    { label: 'Transactions Ledger', path: '/admin/transactions', icon: Repeat },
    { label: 'Points Engine', path: '/admin/points', icon: Coins, count: 'ACTIVE' },
    { label: 'Messages Oversight', path: '/admin/messages', icon: MessageSquare },
    { label: 'Notifications Hub', path: '/admin/notifications', icon: Bell },
    { label: 'Reports & Disputes', path: '/admin/reports', icon: AlertTriangle, count: badgeCounts.openReports > 0 ? badgeCounts.openReports : undefined, alert: true },
    { label: 'Categories Taxonomy', path: '/admin/categories', icon: FolderTree },
    { label: 'Analytics & Impact', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Website Reviews', path: '/admin/reviews', icon: Star },
    { label: 'Broadcast Updates', path: '/admin/broadcasts', icon: Send },
    { label: 'Platform Settings', path: '/admin/settings', icon: Settings },
    { label: 'Security Audit Logs', path: '/admin/audit-logs', icon: Shield }
  ];


  const isActive = (path) => {
    if (path === '/admin/dashboard') return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    const query = encodeURIComponent(globalSearch.trim());
    navigate(`/admin/products?search=${query}`);
  };

  // Current Nav label
  const currentNav = navItems.find((n) => isActive(n.path)) || { label: 'Admin Portal' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 95
          }}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        style={{
          width: '260px',
          backgroundColor: '#0b1329',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          transform: sidebarOpen ? 'translateX(0)' : undefined,
          transition: 'transform 0.25s ease',
          boxShadow: '4px 0 24px rgba(0,0,0,0.4)'
        }}
        className="admin-sidebar"
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0f172a'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                backgroundColor: '#38bdf8',
                boxShadow: '0 0 14px rgba(56, 189, 248, 0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: '#0f172a',
                fontSize: '0.85rem'
              }}
            >
              L
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
              LOOOP
            </span>
            <span
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '0.625rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                letterSpacing: '0.05em'
              }}
            >
              ADMIN PORTAL
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="sidebar-close-btn"
            style={{ display: 'none', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Portal Switcher Banner inside Sidebar */}
        <div style={{ padding: '10px 14px', backgroundColor: '#090d16', borderBottom: '1px solid #1e293b' }}>
          <Link
            to="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.78rem',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <ArrowLeft size={14} />
            <span>OPEN CUSTOMER PORTAL</span>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            flex: 1,
            overflowY: 'auto'
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              paddingLeft: '10px',
              marginBottom: '4px'
            }}
          >
            SaaS Operations Center
          </div>

          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: active ? '#1e293b' : 'transparent',
                  color: active ? '#ffffff' : '#94a3b8',
                  textDecoration: 'none',
                  fontSize: '0.825rem',
                  fontWeight: active ? 700 : 500,
                  borderLeft: active ? '3px solid #38bdf8' : '3px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={16} color={active ? '#38bdf8' : '#64748b'} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      backgroundColor: item.alert ? '#ef4444' : item.count === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : '#334155',
                      color: item.count === 'ACTIVE' ? '#34d399' : '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      border: item.count === 'ACTIVE' ? '1px solid rgba(16, 185, 129, 0.4)' : 'none'
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div style={{ padding: '14px', borderTop: '1px solid #1e293b', backgroundColor: '#090d16' }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '9px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <LogOut size={15} />
            <span>Sign Out Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          marginLeft: '260px',
          width: 'calc(100% - 260px)',
          maxWidth: 'calc(100vw - 260px)',
          minWidth: 0,
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}
        className="admin-main-wrapper"
      >
        {/* Top Navigation Header */}
        <header
          style={{
            height: '64px',
            backgroundColor: '#0f172a',
            borderBottom: '1px solid #1e293b',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="admin-menu-toggle"
              style={{ display: 'none', background: 'none', border: 'none', color: '#f8fafc', cursor: 'pointer' }}
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b' }}>
              <span style={{ fontWeight: 600 }}>Admin</span>
              <ChevronRight size={14} />
              <span style={{ color: '#f8fafc', fontWeight: 700 }}>{currentNav.label}</span>
            </div>
          </div>

          {/* Global Search Bar & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <form onSubmit={handleGlobalSearch} style={{ position: 'relative', width: '280px' }} className="admin-search-form">
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Global admin search..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '7px 12px 7px 34px',
                  borderRadius: '20px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  fontSize: '0.825rem',
                  outline: 'none'
                }}
              />
            </form>

            {/* Quick System Status Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
              <Activity size={14} color={dbStatus === 'Connected' ? '#34d399' : (dbStatus === 'Checking...' ? '#fbbf24' : '#f87171')} />
              <span className="health-label">Database:</span>
              <span style={{
                color: dbStatus === 'Connected' ? '#34d399' : (dbStatus === 'Checking...' ? '#fbbf24' : '#f87171'),
                fontWeight: 700
              }}>
                {dbStatus}
              </span>
            </div>

            {/* User Profile Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '8px', borderLeft: '1px solid #1e293b' }}>
              <Avatar
                src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                name={user?.name || 'Admin User'}
                size="sm"
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
                  {user?.name || 'System Admin'}
                </span>
                <span style={{ fontSize: '0.675rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  {user?.role || 'ADMIN'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main
          style={{
            padding: '24px',
            flex: 1,
            backgroundColor: '#090d16',
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            overflowX: 'hidden'
          }}
        >
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .admin-sidebar { transform: translateX(-100%); }
          .admin-main-wrapper { 
            margin-left: 0 !important; 
            width: 100vw !important; 
            max-width: 100vw !important; 
          }
          .admin-menu-toggle { display: block !important; }
          .sidebar-close-btn { display: block !important; }
          .health-label { display: none; }
          .admin-search-form { width: 160px !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminLayout;
