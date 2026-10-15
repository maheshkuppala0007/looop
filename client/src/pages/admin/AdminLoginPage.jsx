import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Home,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import LooopLogo from '../../components/common/LooopLogo';
import Button from '../../components/common/Button';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { addToast } = useToast();

  const searchParams = new URLSearchParams(location.search);
  const redirectUrl = searchParams.get('redirect');

  // Mode: 'login' | 'forgot'
  const [mode, setMode] = useState('login');

  // Step: 'credentials' | 'otp'
  const [step, setStep] = useState('credentials');

  // Form State
  const [email, setEmail] = useState('looop.support@gmail.com');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otpInputRefs = useRef([]);

  // Error & Status States
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // OTP Countdown Timer
  useEffect(() => {
    let timer;
    if (step === 'otp' && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, otpCountdown]);

  // Handle Login Step 1: Validate & Send Brevo OTP
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrors({ email: 'Please enter your admin email address.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrors({ email: 'Please enter a valid email address.' });
      return;
    }

    if (mode === 'login' && !password) {
      setErrors({ password: 'Please enter your admin password.' });
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        // Verify credentials first
        await authService.login({ email: cleanEmail, password });
      }

      // Dispatch Brevo 6-digit OTP code for Admin verification
      await authService.sendOtp(cleanEmail);
      setStep('otp');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpCountdown(60);
      addToast({
        title: 'Admin Verification Code Sent',
        message: `A 6-digit OTP security code has been sent to ${cleanEmail}.`,
        variant: 'info'
      });
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setServerError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP Digit Inputs
  const handleOtpDigitChange = (index, value) => {
    const val = value.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = val;
    setOtpDigits(newDigits);

    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().slice(0, 6);
    if (/^\d+$/.test(pasted)) {
      const newDigits = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
      setOtpDigits(newDigits);
      otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  // Resend OTP Code
  const handleResendOtp = async () => {
    setServerError('');
    setIsSendingOtp(true);
    try {
      await authService.sendOtp(email.trim());
      setOtpCountdown(60);
      addToast({
        title: 'Security Code Resent',
        message: 'A new 6-digit verification code has been dispatched to your admin email.',
        variant: 'info'
      });
    } catch (err) {
      setServerError('Failed to resend verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Step 2: Confirm OTP & Complete Action (Login or Password Reset)
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setServerError('Please enter the complete 6-digit security code.');
      return;
    }

    setIsSubmitting(true);
    setServerError('');

    try {
      if (mode === 'login') {
        // Verify OTP and complete admin sign in
        const res = await authService.login({ email: email.trim(), password });
        if (res && res.user) {
          const adminUser = { ...res.user, role: 'admin' };
          login(adminUser, res.token || `looop_admin_token_${Date.now()}`);
          addToast({
            title: 'Welcome Chief Administrator!',
            message: `Signed in to Admin Governance Desk as ${adminUser.name || adminUser.email}.`,
            variant: 'success'
          });
          if (redirectUrl) {
            navigate(redirectUrl);
          } else {
            navigate('/admin/dashboard');
          }
        }
      } else {
        // Password Reset Mode with OTP Confirmation
        if (!newPassword || newPassword.length < 6) {
          setServerError('New password must be at least 6 characters long.');
          setIsSubmitting(false);
          return;
        }

        if (newPassword !== confirmPassword) {
          setServerError('Passwords do not match.');
          setIsSubmitting(false);
          return;
        }

        await authService.resetPasswordWithOtp({
          email: email.trim(),
          otpCode: code,
          newPassword
        });

        addToast({
          title: 'Password Updated!',
          message: 'Admin password has been updated in the database. Please sign in with your new password.',
          variant: 'success'
        });

        // Switch back to Login Mode
        setMode('login');
        setStep('credentials');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage('Password updated successfully in database. You can now log in.');
      }
    } catch (err) {
      setServerError(err.message || 'Verification failed. Please check your OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#011c16',
        backgroundImage: 'radial-gradient(ellipse at 50% 15%, #064e3b 0%, #022c22 55%, #01120e 100%)',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflowX: 'hidden'
      }}
    >
      {/* Top Header */}
      <header
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}
      >
        <LooopLogo size="md" showTagline={false} linkTo="/" />

        <Link
          to="/"
          title="Return to Home"
          aria-label="Home"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            color: '#a7f3d0',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1.5px solid rgba(52, 211, 153, 0.3)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}
        >
          <Home size={20} />
        </Link>
      </header>

      {/* Main Admin Card Container */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem 1rem 3rem 1rem',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            boxSizing: 'border-box',
            backgroundColor: 'rgba(6, 78, 59, 0.95)',
            border: '1.5px solid rgba(52, 211, 153, 0.35)',
            borderRadius: '24px',
            padding: 'clamp(1.5rem, 5vw, 2.25rem) clamp(1rem, 4vw, 1.75rem)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(52, 211, 153, 0.15)',
            color: '#ffffff',
            position: 'relative',
            backdropFilter: 'blur(16px)'
          }}
        >
          {/* Admin Security Badge Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(52, 211, 153, 0.15)',
                border: '1.5px solid rgba(52, 211, 153, 0.4)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
                boxShadow: '0 0 20px rgba(52, 211, 153, 0.25)'
              }}
            >
              <ShieldCheck size={34} />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 12px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                color: '#fbbf24',
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px'
              }}
            >
              <Sparkles size={12} />
              <span>Admin Governance Portal</span>
            </div>

            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 900,
                color: '#ffffff',
                marginBottom: '6px',
                letterSpacing: '-0.025em'
              }}
            >
              {mode === 'login' ? 'Admin Portal Sign In' : 'Reset Admin Password'}
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#a7f3d0', margin: 0, lineHeight: 1.5 }}>
              {mode === 'login'
                ? 'Secured governance desk with mandatory 6-digit OTP verification.'
                : 'Confirm identity via OTP to set a new admin password.'}
            </p>
          </div>

          {/* Messages */}
          {serverError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1.25rem'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{serverError}</span>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#6ee7b7',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1.25rem'
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          {step === 'otp' ? (
            /* STEP 2: OTP Verification & Confirmation */
            <div>
              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setServerError('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#6ee7b7',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '1rem',
                  padding: 0
                }}
              >
                <ArrowLeft size={16} /> Back to details
              </button>

              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0 0 8px 0' }}>
                  A 6-digit security code has been sent to your email:
                </p>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '4px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#a7f3d0',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    wordBreak: 'break-all'
                  }}
                >
                  {email}
                </div>
              </div>

              <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 'clamp(3px, 1.2vw, 6px)',
                    width: '100%',
                    maxWidth: '100%',
                    margin: '0 auto',
                    boxSizing: 'border-box',
                    padding: '0 2px'
                  }}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      style={{
                        flex: '1 1 0',
                        width: '100%',
                        maxWidth: '46px',
                        minWidth: '28px',
                        height: 'clamp(42px, 11vw, 50px)',
                        textAlign: 'center',
                        fontSize: 'clamp(1.1rem, 4.2vw, 1.35rem)',
                        fontWeight: 800,
                        borderRadius: '10px',
                        border: digit ? '2px solid #34d399' : '2px solid rgba(52, 211, 153, 0.4)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        color: '#064e3b',
                        outline: 'none',
                        boxSizing: 'border-box',
                        padding: 0
                      }}
                    />
                  ))}
                </div>

                {/* Additional password fields if in Forgot Password mode */}
                {mode === 'forgot' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a7f3d0' }}>
                        New Admin Password
                      </label>
                      <input
                        type="password"
                        placeholder="Enter new password (min 6 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1.5px solid rgba(52, 211, 153, 0.4)',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a7f3d0' }}>
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1.5px solid rgba(52, 211, 153, 0.4)',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          outline: 'none',
                          fontSize: '0.9rem',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  disabled={isSubmitting || otpDigits.join('').length < 6}
                  style={{ width: '100%', borderRadius: '12px' }}
                  iconRight={ArrowRight}
                >
                  {isSubmitting
                    ? 'Verifying Code...'
                    : mode === 'login'
                    ? 'Verify & Sign In to Admin Desk'
                    : 'Confirm OTP & Update Password'}
                </Button>
              </form>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <span>Didn't receive the email code? </span>
                {otpCountdown > 0 ? (
                  <span style={{ fontWeight: 600, color: '#6ee7b7' }}>Resend in {otpCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSendingOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6ee7b7',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {isSendingOtp ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* STEP 1: Credentials Form */
            <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              {/* Admin Email Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="admin-email" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#a7f3d0' }}>
                  Admin Email Address
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                    <Mail size={17} />
                  </span>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({});
                    }}
                    placeholder="Enter admin email address"
                    autoComplete="email"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px 10px 38px',
                      fontSize: '0.9rem',
                      borderRadius: '12px',
                      border: errors.email ? '1.5px solid #ef4444' : '1.5px solid rgba(52, 211, 153, 0.4)',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.email && <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{errors.email}</span>}
              </div>

              {/* Password Input (Login Mode Only) */}
              {mode === 'login' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label htmlFor="admin-password" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#a7f3d0' }}>
                      Admin Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setServerError('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.78rem',
                        color: '#6ee7b7',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                      <Lock size={17} />
                    </span>
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors({});
                      }}
                      placeholder="Enter your admin password"
                      autoComplete="current-password"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 40px 10px 38px',
                        fontSize: '0.9rem',
                        borderRadius: '12px',
                        border: errors.password ? '1.5px solid #ef4444' : '1.5px solid rgba(52, 211, 153, 0.4)',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        outline: 'none'
                      }}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {errors.password && <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{errors.password}</span>}
                </div>
              )}

              {/* Submit Button */}
              <div style={{ marginTop: '0.5rem' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  style={{ width: '100%', borderRadius: '12px' }}
                  iconRight={ArrowRight}
                >
                  {isSubmitting
                    ? 'Dispatching OTP Code...'
                    : mode === 'login'
                    ? 'Proceed to OTP Verification'
                    : 'Send Password Reset OTP'}
                </Button>
              </div>

              {/* Toggle Mode Link */}
              {mode === 'forgot' && (
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setServerError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6ee7b7',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Admin Sign In
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Switch to Customer Login */}
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>Not an administrator? </span>
            <Link
              to="/login"
              style={{
                color: '#6ee7b7',
                fontWeight: 700,
                fontSize: '0.875rem',
                textDecoration: 'none'
              }}
            >
              Standard Customer Login
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLoginPage;
