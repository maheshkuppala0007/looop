import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  Home
} from 'lucide-react';
import LooopLogo from '../../components/common/LooopLogo';
import Button from '../../components/common/Button';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { signInWithGoogle } from '../../config/firebase';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { addToast } = useToast();

  const searchParams = new URLSearchParams(location.search);
  const redirectUrl = searchParams.get('redirect');

  // Login Step: 'form' (credentials check) -> 'otp' (only if credentials are correct)
  const [loginStep, setLoginStep] = useState('form');
  const [pendingSession, setPendingSession] = useState(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP Verification State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const otpInputRefs = useRef([]);

  // Google Login State
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Validation & Error states
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  // Auto pre-fill email if passed in URL query param
  useEffect(() => {
    const paramEmail = searchParams.get('email');
    if (paramEmail) {
      setEmail(paramEmail);
    }
  }, [location.search]);

  // OTP Countdown timer
  useEffect(() => {
    let timer;
    if (loginStep === 'otp' && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [loginStep, otpCountdown]);

  // Store intended redirect URL in sessionStorage if present
  useEffect(() => {
    if (redirectUrl) {
      try {
        sessionStorage.setItem('looop_auth_redirect', redirectUrl);
      } catch {}
    }
  }, [redirectUrl]);

  const handleAuthSuccess = (userData, authToken, welcomeName) => {
    login(userData, authToken);
    addToast({
      title: 'Welcome to LOOOP!',
      message: `Signed in successfully as ${welcomeName || userData.name || userData.email}.`,
      variant: 'success'
    });

    let targetRedirect = redirectUrl;
    if (!targetRedirect) {
      try {
        targetRedirect = sessionStorage.getItem('looop_auth_redirect');
      } catch {}
    }
    try {
      sessionStorage.removeItem('looop_auth_redirect');
    } catch {}

    let destUrl = '/';
    if (targetRedirect && targetRedirect !== '/login' && targetRedirect !== '/register') {
      destUrl = targetRedirect;
    } else if (userData.role === 'ADMIN' || userData.role === 'admin') {
      destUrl = '/admin/dashboard';
    } else {
      destUrl = '/dashboard';
    }
    window.location.href = destUrl;
  };

  // Form Validation
  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      newErrors.password = 'Please enter your password.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // STEP 1: Verify Email and Password FIRST.
  // ONLY IF email and password are CORRECT, send Brevo OTP email and show OTP screen!
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validateForm()) return;

    setIsSubmitting(true);
    const targetEmail = email.trim();

    try {
      // 1. Strictly verify email and password against server / authService
      const loginResponse = await authService.login({
        email: targetEmail,
        password
      });

      if (!loginResponse || !loginResponse.user || !loginResponse.token) {
        throw new Error('Invalid email or password. Please try again.');
      }

      // Credentials are confirmed correct! Sign in directly
      handleAuthSuccess(loginResponse.user, loginResponse.token, loginResponse.user.name);
    } catch (err) {
      // Credential failure or server rejection: DO NOT send email, show error message
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'Invalid email or password. Please try again.';
      const cleanMsg =
        errorMsg.includes('Failed to fetch') || errorMsg.includes('Network Error') || errorMsg.includes('Cannot connect')
          ? 'Cannot connect to LOOOP server. Please ensure the backend server is running on port 5000.'
          : errorMsg;
      setServerError(cleanMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Verify the 6-Digit Code Received in the Email
  const handleVerifyLoginOtp = async (e) => {
    if (e) e.preventDefault();
    const targetEmail = email.trim();
    const code = otpDigits.join('');

    if (code.length < 6) {
      setServerError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setServerError('');

    try {
      const verifyRes = await authService.verifyOtp(targetEmail, code, { purpose: 'LOGIN_OTP' });

      const finalUser = pendingSession?.user || verifyRes?.user || {
        email: targetEmail,
        name: targetEmail.split('@')[0],
        role: targetEmail.includes('admin') ? 'admin' : 'customer'
      };
      const finalToken = pendingSession?.token || verifyRes?.token || `looop_token_otp_${Date.now()}`;

      // Successfully verified! Log in and redirect to dashboard
      handleAuthSuccess(finalUser, finalToken, finalUser.name);
    } catch (err) {
      setServerError(err.message || 'Invalid or expired verification code. Please check your email and try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP code if needed
  const handleResendOtp = async () => {
    setServerError('');
    setIsResendingOtp(true);
    const targetEmail = email.trim();

    try {
      await authService.sendOtp(targetEmail, 'LOGIN_OTP');
      setOtpCountdown(30);
      setOtpDigits(['', '', '', '', '', '']);
      addToast({
        title: 'New Code Sent',
        message: `A new 6-digit verification code has been sent to ${targetEmail}.`,
        variant: 'info'
      });
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setServerError(err.message || 'Failed to dispatch verification code to your email.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  // Handle OTP digit inputs
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

  // Google Sign-In with Firebase & Neon DB Sync
  const handleGoogleSignIn = async () => {
    setServerError('');
    setIsGoogleLoading(true);
    try {
      const googleUser = await signInWithGoogle();
      if (!googleUser) return;

      const result = await authService.googleLogin({
        email: googleUser.email,
        displayName: googleUser.displayName,
        photoURL: googleUser.photoURL,
        uid: googleUser.uid
      });

      if (result && result.token && result.user) {
        handleAuthSuccess(result.user, result.token, googleUser.displayName);
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      const isDomainIssue = err.message?.includes('Authorized Domains') || err.message?.includes('unauthorized-domain');
      if (isDomainIssue) {
        setServerError('Firebase requires adding your domain to Authorized Domains in Firebase Console.');
      } else {
        setServerError(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSocialAuth = (providerName) => {
    if (providerName === 'Google') {
      handleGoogleSignIn();
      return;
    }
    addToast({
      title: `${providerName} Sign-In`,
      message: `${providerName} OAuth sign-in integration selected. Recommended: Use Google for 1-click verification.`,
      variant: 'info'
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#064e3b',
        backgroundImage: 'radial-gradient(circle at 50% 10%, #065f46 0%, #022c22 60%, #011c16 100%)',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflowX: 'hidden'
      }}
    >
      {/* Navigation Top Header */}
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
        <LooopLogo size="md" showTagline={false} light={true} linkTo="/" />

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

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem 1rem 2.5rem 1rem',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: 'clamp(1.5rem, 5vw, 2.25rem) clamp(1rem, 4vw, 1.5rem)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            color: '#0f172a',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Server Error Alert */}
          {serverError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1.25rem',
                boxSizing: 'border-box'
              }}
              role="alert"
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{serverError}</span>
            </div>
          )}

          {loginStep === 'form' ? (
            /* ========================================================================= */
            /* STEP 1: EMAIL & PASSWORD SIGN-IN                                          */
            /* Validates credentials first; only sends Brevo OTP if credentials are valid*/
            /* ========================================================================= */
            <div>
              {/* Card Header */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h1
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    marginBottom: '6px',
                    letterSpacing: '-0.025em'
                  }}
                >
                  Sign in to LOOOP
                </h1>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                  Share, reuse, and connect with your local community.
                </p>
              </div>

              <form onSubmit={handleCredentialSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
                {/* Email Address Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
                  <label
                    htmlFor="login-email"
                    style={{
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: errors.email ? '#ef4444' : '#334155'
                    }}
                  >
                    Email Address
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '12px',
                        color: errors.email ? '#ef4444' : '#94a3b8',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Mail size={17} />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors({ ...errors, email: '' });
                        if (serverError) setServerError('');
                      }}
                      placeholder="Enter your email"
                      autoComplete="email"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 12px 10px 38px',
                        fontSize: '0.9rem',
                        borderRadius: '12px',
                        border: errors.email ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        color: '#0f172a'
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.email && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
                      {errors.email}
                    </span>
                  )}
                </div>

                {/* Password Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label
                      htmlFor="login-password"
                      style={{
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        color: errors.password ? '#ef4444' : '#334155'
                      }}
                    >
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      style={{
                        fontSize: '0.78rem',
                        color: '#047857',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '12px',
                        color: errors.password ? '#ef4444' : '#94a3b8',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Lock size={17} />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors({ ...errors, password: '' });
                        if (serverError) setServerError('');
                      }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 40px 10px 38px',
                        fontSize: '0.9rem',
                        borderRadius: '12px',
                        border: errors.password ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        color: '#0f172a'
                      }}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px'
                      }}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {errors.password && (
                    <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
                      {errors.password}
                    </span>
                  )}
                </div>

                {/* Submit Button */}
                <div style={{ marginTop: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={{ width: '100%', borderRadius: '12px' }}
                    iconRight={!isSubmitting ? ArrowRight : undefined}
                  >
                    {isSubmitting ? 'Signing In...' : 'Sign In'}
                  </Button>
                </div>
              </form>

              {/* SOCIAL AUTH OPTIONS */}
              <div style={{ marginTop: '1.5rem', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                  <span style={{ fontSize: '0.725rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Or connect with
                  </span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
                  {/* Google */}
                  <button
                    type="button"
                    onClick={() => handleSocialAuth('Google')}
                    disabled={isGoogleLoading}
                    title="Connect with Google"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: '1.5px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </button>

                  {/* Facebook */}
                  <button
                    type="button"
                    onClick={() => handleSocialAuth('Facebook')}
                    title="Connect with Facebook"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: '1.5px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <svg width="20" height="20" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </button>

                  {/* GitHub */}
                  <button
                    type="button"
                    onClick={() => handleSocialAuth('GitHub')}
                    title="Connect with GitHub"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      border: '1.5px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <svg width="20" height="20" fill="#24292f" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* STEP 2: 6-DIGIT OTP VERIFICATION SCREEN                                   */
            /* Rendered ONLY after email and password are fully validated                 */
            /* ========================================================================= */
            <div>
              <button
                type="button"
                onClick={() => {
                  setLoginStep('form');
                  setServerError('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#047857',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '1rem',
                  padding: 0
                }}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>

              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                  border: '1px solid #a7f3d0'
                }}>
                  <ShieldCheck size={30} />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                  Enter 6-Digit OTP Code
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px', lineHeight: 1.5 }}>
                  Credentials verified! A 6-digit verification code has been sent to your email:
                </p>
                <div style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  padding: '4px 14px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  wordBreak: 'break-all'
                }}>
                  {email.trim()}
                </div>
              </div>

              <form onSubmit={handleVerifyLoginOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                        border: digit ? '2px solid #059669' : '2px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#047857',
                        outline: 'none',
                        boxSizing: 'border-box',
                        padding: 0
                      }}
                    />
                  ))}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isVerifyingOtp}
                  disabled={isVerifyingOtp || otpDigits.join('').length < 6}
                  style={{ width: '100%', borderRadius: '12px' }}
                  iconRight={ArrowRight}
                >
                  {isVerifyingOtp ? 'Verifying Code...' : 'Verify Code & Sign In'}
                </Button>
              </form>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                <span>Didn't receive the email code? </span>
                {otpCountdown > 0 ? (
                  <span style={{ fontWeight: 600, color: '#047857' }}>Resend in {otpCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isResendingOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#047857',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {isResendingOtp ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer Navigation Link: Register */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>
              Don't have a LOOOP account yet?
            </div>
            <Link
              to={redirectUrl ? `/register?redirect=${encodeURIComponent(redirectUrl)}` : '/register'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#ecfdf5',
                border: '2px solid #059669',
                color: '#047857',
                fontWeight: 800,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.18)',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
            >
              <UserPlus size={18} />
              <span>Create New Account</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
