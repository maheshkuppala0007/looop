import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  RefreshCw,
  ShieldCheck,
  Mail,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Send,
  Sparkles,
  Lock
} from 'lucide-react';
import LooopLogo from '../common/LooopLogo';
import { useSiteConfig } from '../../context/SiteConfigContext';
import contentService from '../../services/contentService';
import Button from '../common/Button';

export const Footer = () => {
  const { siteConfig } = useSiteConfig();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('INPUT'); // 'INPUT' | 'OTP' | 'SUCCESS'
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error' | 'info', text: '' }

  const handleSubscribeSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setIsLoading(true);
      setMessage(null);
      const res = await contentService.subscribeNewsletter(email.trim(), name.trim());

      if (res?.success) {
        setStep('OTP');
        setMessage({
          type: 'info',
          text: res.message || 'Verification code sent to your email! Please enter the 6-digit code below.'
        });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Subscription failed. Please check your email.';
      setMessage({
        type: 'error',
        text: errMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 6) {
      setMessage({ type: 'error', text: 'Please enter the complete 6-digit verification code.' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const res = await contentService.verifySubscriberOtp(email.trim(), otp.trim());

      if (res?.success) {
        setStep('SUCCESS');
        setMessage({
          type: 'success',
          text: res.message || 'Email successfully verified! You are now subscribed to LOOOP product releases and updates.'
        });
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Verification failed. The code may be incorrect or expired.';
      setMessage({
        type: 'error',
        text: errMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setEmail('');
    setOtp('');
    setName('');
    setStep('INPUT');
    setMessage(null);
  };

  return (
    <footer
      style={{
        background: 'linear-gradient(180deg, #052317 0%, #031810 50%, #010d08 100%)',
        color: '#f8fafc',
        borderTop: '1px solid rgba(16, 185, 129, 0.25)',
        paddingTop: '4.5rem',
        paddingBottom: '2.5rem',
        marginTop: '0',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '240px',
          background: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.15), transparent 70%)',
          pointerEvents: 'none'
        }}
      />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        {/* =========================================================================
            NEWSLETTER / EMAIL SUBSCRIPTION HERO CARD
            ========================================================================= */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 78, 59, 0.35) 100%)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            borderRadius: '16px',
            padding: '2.25rem 2rem',
            marginBottom: '4rem',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
              alignItems: 'center'
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#6ee7b7',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '0.75rem'
                }}
              >
                <Sparkles size={14} />
                <span>Verified Updates & Releases</span>
              </div>
              <h3 style={{ fontSize: 'clamp(1.35rem, 3vw, 1.75rem)', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                Subscribe for Product Updates & Alerts
              </h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.925rem', lineHeight: 1.6, margin: 0, maxWidth: '520px' }}>
                Join verified members who receive real-time notices on newly listed community goods, local sharing initiatives, and circular reuse announcements.
              </p>
            </div>

            <div>
              {step === 'INPUT' && (
                <form onSubmit={handleSubscribeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px', position: 'relative' }}>
                      <input
                        type="email"
                        required
                        placeholder="Enter your email address..."
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 14px 12px 40px',
                          backgroundColor: 'rgba(15, 23, 42, 0.75)',
                          border: '1px solid rgba(52, 211, 153, 0.35)',
                          borderRadius: '10px',
                          color: '#ffffff',
                          fontSize: '0.95rem',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                      <Mail size={16} color="#34d399" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      {isLoading ? 'Sending Code...' : 'Subscribe'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} color="#10b981" />
                    <span>Protected with two-factor email OTP verification. Zero spam guaranteed.</span>
                  </span>
                </form>
              )}

              {step === 'OTP' && (
                <form onSubmit={handleVerifyOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="Enter 6-digit OTP..."
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      style={{
                        flex: '1 1 180px',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        border: '2px solid #10b981',
                        borderRadius: '10px',
                        color: '#34d399',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        letterSpacing: '0.35em',
                        textAlign: 'center',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isLoading ? 'Verifying...' : 'Confirm OTP'}
                      <CheckCircle2 size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#cbd5e1' }}>Sent to: <strong>{email}</strong></span>
                    <button
                      type="button"
                      onClick={() => setStep('INPUT')}
                      style={{ background: 'transparent', border: 'none', color: '#6ee7b7', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                    >
                      Change Email
                    </button>
                  </div>
                </form>
              )}

              {step === 'SUCCESS' && (
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1.5px solid #10b981',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={24} color="#34d399" />
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                        Subscription Confirmed!
                      </div>
                      <div style={{ color: '#a7f3d0', fontSize: '0.8rem' }}>
                        {email} is registered for all official platform updates.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              )}

              {message && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor:
                      message.type === 'error'
                        ? 'rgba(239, 68, 68, 0.18)'
                        : message.type === 'info'
                        ? 'rgba(59, 130, 246, 0.18)'
                        : 'rgba(16, 185, 129, 0.18)',
                    color:
                      message.type === 'error'
                        ? '#fca5a5'
                        : message.type === 'info'
                        ? '#93c5fd'
                        : '#86efac',
                    border: `1px solid ${
                      message.type === 'error'
                        ? '#ef4444'
                        : message.type === 'info'
                        ? '#3b82f6'
                        : '#10b981'
                    }`
                  }}
                >
                  {message.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  <span>{message.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            MAIN FOOTER COLUMNS
            ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '3rem',
            marginBottom: '3.5rem'
          }}
        >
          {/* Brand & Mission Column */}
          <div style={{ maxWidth: '340px' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <LooopLogo
                size="md"
                showTagline={true}
                light={true}
                linkTo="/"
                customText={siteConfig?.logoText || siteConfig?.siteName || 'Looop'}
                customUrl={siteConfig?.logoUrl || ''}
              />
            </div>
            <p
              style={{
                fontSize: '0.9rem',
                color: '#94a3b8',
                lineHeight: 1.65,
                marginBottom: '1.25rem'
              }}
            >
              A sustainable, zero-waste neighborhood goods-sharing initiative. Borrow what you need, lend what you don't, and keep useful items circulating in the loop.
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#6ee7b7',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.4rem 0.85rem',
                borderRadius: '20px',
                fontWeight: 600
              }}
            >
              <RefreshCw size={14} />
              <span>100% Non-Commercial Sharing</span>
            </div>
          </div>

          {/* Real Contact & Administration Details */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: '#ffffff',
                marginBottom: '1.1rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              Contact & Administration
            </h4>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                fontSize: '0.9rem',
                padding: 0,
                margin: 0
              }}
            >
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <User size={16} color="#34d399" style={{ marginTop: '3px', flexShrink: 0 }} />
                <div>
                  <span style={{ color: '#e2e8f0', fontWeight: 600, display: 'block' }}>Mahesh Kuppala</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Platform Founder & Lead Administrator</span>
                </div>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} color="#34d399" style={{ flexShrink: 0 }} />
                <a
                  href="mailto:looop.support@gmail.com"
                  style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.2s' }}
                  className="footer-contact-link"
                >
                  looop.support@gmail.com
                </a>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={16} color="#34d399" style={{ flexShrink: 0 }} />
                <span style={{ color: '#cbd5e1' }}>+91 93902 44349</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={16} color="#34d399" style={{ marginTop: '3px', flexShrink: 0 }} />
                <span style={{ color: '#cbd5e1', lineHeight: 1.4 }}>
                  Agiripalli, Eluru District, Andhra Pradesh 521211, India
                </span>
              </li>
            </ul>
          </div>

          {/* Platform Navigation */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: '#ffffff',
                marginBottom: '1.1rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              Explore
            </h4>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.9rem',
                padding: 0,
                margin: 0
              }}
            >
              <li>
                <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none' }} className="footer-link">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/browse" style={{ color: '#94a3b8', textDecoration: 'none' }} className="footer-link">
                  Browse Available Items
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" style={{ color: '#94a3b8', textDecoration: 'none' }} className="footer-link">
                  How LOOOP Works
                </Link>
              </li>
              <li>
                <Link to="/about" style={{ color: '#94a3b8', textDecoration: 'none' }} className="footer-link">
                  About the Mission
                </Link>
              </li>
              <li>
                <a href="/#impact" style={{ color: '#94a3b8', textDecoration: 'none' }} className="footer-link">
                  Community Impact
                </a>
              </li>
            </ul>
          </div>

          {/* Account & Trust */}
          <div>
            <h4
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: '#ffffff',
                marginBottom: '1.1rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              Trust & Safety
            </h4>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.9rem',
                padding: 0,
                margin: 0
              }}
            >
              <li>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="#34d399" />
                  <span>Peer Trust & Handover Codes</span>
                </span>
              </li>
              <li>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  Zero Sales · Zero Commercial Ads
                </span>
              </li>
              <li>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  Privacy & Data Protection Verified
                </span>
              </li>
              <li>
                <Link to="/admin/dashboard" style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600 }} className="footer-link">
                  Admin Governance Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* =========================================================================
            BOTTOM COPYRIGHT BAR (Tech boilerplate completely removed)
            ========================================================================= */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            color: '#64748b',
            gap: '1rem'
          }}
        >
          <div>
            © {new Date().getFullYear()} <strong>LOOOP</strong> — Founded and Managed by <strong>Mahesh Kuppala</strong>. All rights reserved.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
            <span>Built for sustainable communities with</span>
            <Heart size={14} color="#ef4444" fill="#ef4444" />
          </div>
        </div>
      </div>

      <style>{`
        .footer-link:hover {
          color: #34d399 !important;
          padding-left: 3px;
          transition: all 0.2s ease;
        }
        .footer-contact-link:hover {
          color: #34d399 !important;
          text-decoration: underline;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
