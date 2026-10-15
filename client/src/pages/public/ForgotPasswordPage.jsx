import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Send
} from 'lucide-react';
import LooopLogo from '../../components/common/LooopLogo';
import Button from '../../components/common/Button';
import { authService } from '../../services/authService';
import { useToast } from '../../hooks/useToast';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Reset Steps: 'request' | 'otp' | 'success'
  const [step, setStep] = useState('request');

  // Form State
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const otpInputRefs = useRef([]);

  // Errors state
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  // OTP Countdown timer
  useEffect(() => {
    let timer;
    if (step === 'otp' && otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, otpCountdown]);

  // Handle Send Reset OTP
  const handleSendResetOtp = async (e) => {
    if (e) e.preventDefault();
    setServerError('');
    setErrors({});

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrors({ email: 'Please enter a valid email address.' });
      return;
    }

    setIsSendingOtp(true);
    try {
      await authService.sendOtp(cleanEmail, 'PASSWORD_RESET');
      setStep('otp');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpCountdown(60);
      addToast({
        title: 'Reset Code Sent',
        message: `A 6-digit password recovery code has been sent to ${cleanEmail}. Please check your inbox or spam folder.`,
        variant: 'info'
      });
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setServerError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const rawVal = value.replace(/\D/g, '');
    if (rawVal.length > 1) {
      const digits = rawVal.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      digits.forEach((ch, i) => {
        if (i < 6) newDigits[i] = ch;
      });
      setOtpDigits(newDigits);
      otpInputRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    const val = rawVal.slice(-1);
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
    const cleanDigits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (cleanDigits) {
      const newDigits = cleanDigits.split('').concat(Array(6).fill('')).slice(0, 6);
      setOtpDigits(newDigits);
      otpInputRefs.current[Math.min(cleanDigits.length, 5)]?.focus();
    }
  };

  // Submit OTP + New Password to update database
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const newErr = {};

    const code = otpDigits.join('');
    if (code.length < 6) {
      setServerError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (!newPassword) {
      newErr.newPassword = 'Please create a new password.';
    } else if (newPassword.length < 6) {
      newErr.newPassword = 'Password must be at least 6 characters long.';
    }

    if (!confirmPassword) {
      newErr.confirmPassword = 'Please confirm your new password.';
    } else if (newPassword !== confirmPassword) {
      newErr.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newErr).length > 0) {
      setErrors(newErr);
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPasswordWithOtp({
        email: email.trim(),
        otpCode: code,
        newPassword
      });

      setStep('success');
      addToast({
        title: 'Password Updated!',
        message: 'Your password has been successfully updated in the database.',
        variant: 'success'
      });
    } catch (err) {
      setServerError(err.message || 'Invalid or expired verification code. Please check and try again.');
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
          to="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            color: '#a7f3d0',
            textDecoration: 'none',
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Sign In</span>
        </Link>
      </header>

      {/* Main Container - 100% Mobile Responsive */}
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
              Reset Your Password
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
              Verify your email with OTP code to update your password.
            </p>
          </div>

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

          {step === 'request' && (
            /* Step 1: Request Reset OTP */
            <form onSubmit={handleSendResetOtp} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
                <label
                  htmlFor="forgot-email"
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
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: '' });
                    }}
                    placeholder="Enter your email address"
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
                    disabled={isSendingOtp}
                  />
                </div>
                {errors.email && (
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
                    {errors.email}
                  </span>
                )}
              </div>

              <div style={{ marginTop: '0.4rem', width: '100%', boxSizing: 'border-box' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSendingOtp}
                  disabled={isSendingOtp}
                  style={{ width: '100%', borderRadius: '12px' }}
                  iconRight={!isSendingOtp ? Send : undefined}
                >
                  {isSendingOtp ? 'Sending code...' : 'Send OTP Code'}
                </Button>
              </div>
            </form>
          )}

          {step === 'otp' && (
            /* Step 2: Enter OTP & New Password */
            <form onSubmit={handleResetPasswordSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                  Enter 6-digit code sent to your email:
                </p>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    padding: '3px 12px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    wordBreak: 'break-all'
                  }}
                >
                  {email}
                </div>
              </div>

              {/* 6 Digit OTP Box Inputs */}
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
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    maxLength={idx === 0 ? 6 : 1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
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
                      outline: 'none',
                      color: '#047857',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                      padding: 0
                    }}
                  />
                ))}
              </div>

              {/* New Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
                <label htmlFor="new-pass" style={{ fontSize: '0.825rem', fontWeight: 600, color: errors.newPassword ? '#ef4444' : '#334155' }}>
                  New Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                  <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                    <Lock size={17} />
                  </span>
                  <input
                    id="new-pass"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errors.newPassword) setErrors({ ...errors, newPassword: '' });
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 40px 10px 38px',
                      fontSize: '0.9rem',
                      borderRadius: '12px',
                      border: errors.newPassword ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                      outline: 'none',
                      color: '#0f172a'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.newPassword && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{errors.newPassword}</span>}
              </div>

              {/* Confirm Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
                <label htmlFor="confirm-pass" style={{ fontSize: '0.825rem', fontWeight: 600, color: errors.confirmPassword ? '#ef4444' : '#334155' }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                  <span style={{ position: 'absolute', left: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                    <Lock size={17} />
                  </span>
                  <input
                    id="confirm-pass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 40px 10px 38px',
                      fontSize: '0.9rem',
                      borderRadius: '12px',
                      border: errors.confirmPassword ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                      outline: 'none',
                      color: '#0f172a'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.confirmPassword && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{errors.confirmPassword}</span>}
              </div>

              <div style={{ marginTop: '0.4rem' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  style={{ width: '100%', borderRadius: '12px' }}
                  iconRight={ArrowRight}
                >
                  {isSubmitting ? 'Updating Password...' : 'Confirm & Update Password'}
                </Button>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.825rem', color: '#64748b' }}>
                <span>Didn't receive code? </span>
                {otpCountdown > 0 ? (
                  <span style={{ fontWeight: 600, color: '#047857' }}>Resend in {otpCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendResetOtp}
                    disabled={isSendingOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#047857',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </form>
          )}

          {step === 'success' && (
            /* Step 3: Success Screen */
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto',
                border: '1px solid #a7f3d0'
              }}>
                <CheckCircle2 size={34} />
              </div>

              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.5rem' }}>
                Password Reset Complete!
              </h2>

              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.55, marginBottom: '1.5rem' }}>
                Your new password has been updated in our database. You can now sign in with your updated credentials.
              </p>

              <Button
                variant="primary"
                size="lg"
                style={{ width: '100%', borderRadius: '12px' }}
                onClick={() => navigate(`/login?email=${encodeURIComponent(email)}`)}
                iconRight={ArrowRight}
              >
                Sign In to Your Account
              </Button>
            </div>
          )}

          {/* Footer Link */}
          <div
            style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: '#64748b'
            }}
          >
            <span>Remember your password? </span>
            <Link
              to="/login"
              style={{
                color: '#047857',
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;

