const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getJwtSecret } = require('../utils/jwtConfig');
const { query: pgQuery } = require('../config/postgres');
const { invalidateDashboardCache } = require('../services/adminDashboardService');
const { invalidateAnalyticsCache } = require('../services/adminAnalyticsService');
const emailService = require('../services/emailService');
const otpService = require('../services/otpService');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (userId, role = 'customer', email = '') => {
  const cleanEmail = (email || '').toLowerCase().trim();
  const isSuperAdmin =
    cleanEmail === 'maheshkuppala321@gmail.com' ||
    cleanEmail === 'looop.support@gmail.com' ||
    cleanEmail === 'admin@looop.community';
  const effectiveRole = isSuperAdmin ? 'admin' : role;
  return jwt.sign({ id: userId, role: effectiveRole, email: cleanEmail }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN
  });
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    let user = null;

    // 1. Try PostgreSQL lookup first
    try {
      const pgRes = await pgQuery(
        'SELECT id, name, email, password, role, avatar, account_status, trust_score, rating FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [cleanEmail]
      );
      if (pgRes && pgRes.rows && pgRes.rows.length > 0) {
        const row = pgRes.rows[0];
        user = {
          _id: row.id,
          id: row.id,
          name: row.name,
          email: row.email,
          password: row.password,
          role: row.role,
          avatar: row.avatar,
          accountStatus: row.account_status,
          trustScore: row.trust_score,
          rating: row.rating
        };
      }
    } catch (pgErr) {
      // Ignore PG error and fallback to Mongo
    }

    // 2. Try MongoDB lookup if not found in PG
    if (!user && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ email: cleanEmail }).select('+password');
      } catch (mongoErr) {
        // Fallback
      }
    }

    const cleanPhone = String(req.body.phone || req.body.number || '').trim();

    if (!user) {
      // First-time customer login: immediately create and store customer details in PostgreSQL database!
      const assignedId = `usr_${Date.now()}`;
      const defaultName = req.body.name?.trim() || cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const hashedPassword = await bcrypt.hash(password, 10);
      const isSuperAdmin =
        cleanEmail === 'maheshkuppala321@gmail.com' ||
        cleanEmail === 'looop.support@gmail.com' ||
        cleanEmail === 'admin@looop.community';
      const roleToAssign = isSuperAdmin ? 'admin' : 'customer';

      try {
        await pgQuery(
          `INSERT INTO users (id, name, email, phone, password, plain_password, role, account_status, verified, trust_score, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', true, 100, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE SET 
             name = EXCLUDED.name, 
             phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
             password = EXCLUDED.password, 
             plain_password = EXCLUDED.plain_password, 
             role = EXCLUDED.role, 
             updated_at = NOW();`,
          [assignedId, defaultName, cleanEmail, cleanPhone, hashedPassword, String(password), roleToAssign]
        );
        invalidateDashboardCache();
        invalidateAnalyticsCache();
        console.log(`[Neon PostgreSQL] New customer auto-registered on login: ${cleanEmail} (${assignedId})`);
      } catch (insertErr) {
        console.error('[Neon PostgreSQL] Auto-register on login error:', insertErr.message);
      }

      user = {
        _id: assignedId,
        id: assignedId,
        name: defaultName,
        email: cleanEmail,
        phone: cleanPhone,
        password: hashedPassword,
        plainPassword: String(password),
        role: roleToAssign,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        accountStatus: 'active',
        trustScore: 100,
        rating: 5.0
      };
    } else {
      // Check account suspension status
      if (user.accountStatus === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact platform support.'
        });
      }

      // Verify bcrypt password
      const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
      if (!isMatch && user.password !== password) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }

      // Keep plain_password and phone up-to-date in database for admin visibility
      try {
        await pgQuery(
          `UPDATE users 
           SET plain_password = $1, 
               phone = CASE WHEN $2 <> '' THEN $2 ELSE phone END, 
               updated_at = NOW() 
           WHERE LOWER(email) = $3;`,
          [String(password), cleanPhone, cleanEmail]
        );
      } catch (updateErr) {
        console.error('Update plain_password notice:', updateErr.message);
      }
    }

    const isSuperAdmin =
      cleanEmail === 'maheshkuppala321@gmail.com' ||
      cleanEmail === 'looop.support@gmail.com' ||
      cleanEmail === 'admin@looop.community';
    if (isSuperAdmin) {
      user.role = 'admin';
    }

    const token = generateToken(user._id || user.id, user.role, cleanEmail);

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user: {
        id: user._id || user.id,
        _id: user._id || user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || cleanPhone || '',
        role: user.role,
        trustScore: user.trustScore || 100,
        rating: user.rating || 5.0,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while signing in.'
    });
  }
};

exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: 'Valid email address is required.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    let exists = false;

    // 1. Check PostgreSQL
    try {
      const pgCheck = await pgQuery('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
      if (pgCheck && pgCheck.rows && pgCheck.rows.length > 0) {
        exists = true;
      }
    } catch {}

    // 2. Check MongoDB
    if (!exists && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const mongoUser = await User.findOne({ email: cleanEmail });
        if (mongoUser) exists = true;
      } catch {}
    }

    return res.status(200).json({
      success: true,
      exists,
      message: exists ? 'An account with this email address already exists.' : 'Email is available.'
    });
  } catch (error) {
    console.error('checkEmail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check email status.' });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.'
      });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).toLowerCase().trim();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters.'
      });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check duplicate in PG
    try {
      const pgCheck = await pgQuery('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
      if (pgCheck && pgCheck.rows && pgCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.'
        });
      }
    } catch {}

    // Check duplicate in Mongo
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const existing = await User.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.'
        });
      }
    }

    // Hash password securely with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    const isAdmin =
      cleanEmail === 'maheshkuppala321@gmail.com' ||
      cleanEmail === 'admin@looop.community' ||
      cleanEmail.includes('admin');
    const roleToAssign = isAdmin ? 'admin' : 'customer';

    let assignedId = `usr_${Date.now()}`;

    // 1. Insert into Mongo if active
    let mongoUser = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        mongoUser = await User.create({
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          role: roleToAssign,
          trustScore: 100
        });
        if (mongoUser?._id) {
          assignedId = String(mongoUser._id);
        }
      } catch (mErr) {
        console.warn('MongoDB insert warning:', mErr.message);
      }
    }

    const cleanPhone = String(req.body.phone || req.body.number || '').trim();

    // 2. Immediately upload user to Neon PostgreSQL database (required)
    try {
      await pgQuery(
        `INSERT INTO users (id, name, email, phone, password, plain_password, role, account_status, verified, trust_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', true, 100, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET 
           name = EXCLUDED.name, 
           phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
           password = EXCLUDED.password, 
           plain_password = EXCLUDED.plain_password, 
           role = EXCLUDED.role, 
           updated_at = NOW();`,
        [assignedId, cleanName, cleanEmail, cleanPhone, hashedPassword, String(password), roleToAssign]
      );
      console.log(`[Neon PostgreSQL] User registered with ID: ${assignedId}, phone: ${cleanPhone || 'N/A'}`);
    } catch (pgErr) {
      console.error('[Neon PostgreSQL] Registration save error:', pgErr.message);
      // Remove any legacy Mongo record so we don't orphan a user that isn't in the primary DB
      if (mongoUser?._id) {
        try { await User.deleteOne({ _id: mongoUser._id }); } catch {}
      }
      if (pgErr.code === '23505' || pgErr.code === '11000') {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.'
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to create account. Please try again.'
      });
    }

    // 3. Immediately clear dashboard and analytics caches so numbers increment right away
    invalidateDashboardCache();
    invalidateAnalyticsCache();

    // 4. Generate secure verification OTP & attempt email dispatch
    const otpRes = await otpService.createOtpToken({ userId: assignedId, email: cleanEmail, purpose: 'EMAIL_VERIFICATION' });
    let deliveryNotice = null;
    if (otpRes.success) {
      const emailRes = await emailService.sendVerificationEmail({
        toEmail: cleanEmail,
        recipientName: cleanName,
        otpCode: otpRes.rawOtp
      });
      if (!emailRes.success) {
        deliveryNotice = emailRes.errorMessage || 'Email service unavailable.';
      }
    } else {
      deliveryNotice = otpRes.message;
    }

    const token = generateToken(assignedId, roleToAssign, cleanEmail);

    return res.status(201).json({
      success: true,
      message: deliveryNotice
        ? `Account created successfully. Note: ${deliveryNotice}`
        : 'Account created successfully. Please enter the verification code sent to your email.',
      emailDeliveryUnavailable: Boolean(deliveryNotice),
      token,
      user: {
        id: assignedId,
        _id: assignedId,
        name: cleanName,
        email: cleanEmail,
        role: roleToAssign,
        verified: false,
        trustScore: 100
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.code === 11000 || error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address.'
      });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    let user = null;
    try {
      const pgRes = await pgQuery('SELECT id, name, email, account_status FROM users WHERE LOWER(email) = $1 LIMIT 1', [cleanEmail]);
      if (pgRes.rows.length > 0) user = pgRes.rows[0];
    } catch {}

    const responsePayload = {
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been dispatched.'
    };

    if (user && user.account_status !== 'suspended') {
      const otpRes = await otpService.createOtpToken({
        userId: user.id,
        email: cleanEmail,
        purpose: 'PASSWORD_RESET',
        expiryMinutes: 15
      });

      if (otpRes.success) {
        const appUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
        const resetUrl = `${appUrl}/reset-password?code=${otpRes.rawOtp}&email=${encodeURIComponent(cleanEmail)}`;
        await emailService.sendPasswordResetEmail({
          toEmail: cleanEmail,
          recipientName: user.name || 'LOOOP Member',
          resetUrl,
          expiryMinutes: 15
        });

        if (process.env.NODE_ENV !== 'production') {
          responsePayload.resetToken = otpRes.rawOtp;
        }
      }
    }

    // Anti-enumeration: Return generic success regardless of account existence
    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not process password reset request.'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, token, password } = req.body || {};
    const resetCode = code || token || req.params?.token;
    const targetEmail = email || req.body?.email;

    if (!resetCode) {
      return res.status(400).json({
        success: false,
        message: 'Password reset code is required.'
      });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    let cleanEmail = targetEmail ? String(targetEmail).toLowerCase().trim() : '';

    if (!cleanEmail && resetCode) {
      try {
        const hashedInput = otpService.hashOtp(resetCode);
        const otpCheck = await pgQuery(
          `SELECT email FROM otp_tokens WHERE hashed_otp = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL LIMIT 1`,
          [hashedInput]
        );
        if (otpCheck.rows.length > 0) {
          cleanEmail = otpCheck.rows[0].email;
        }
      } catch (err) {}
    }

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address or reset token is required.'
      });
    }
    const verifyRes = await otpService.verifyOtpToken({
      email: cleanEmail,
      otp: resetCode,
      purpose: 'PASSWORD_RESET'
    });

    if (!verifyRes.success) {
      return res.status(400).json({
        success: false,
        message: verifyRes.message || 'Invalid or expired password reset code.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pgQuery('UPDATE users SET password = $1, updated_at = NOW() WHERE LOWER(email) = $2', [hashedPassword, cleanEmail]);

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await User.updateOne({ email: cleanEmail }, { password: hashedPassword });
      } catch {}
    }

    emailService.sendSecurityNotificationEmail({
      toEmail: cleanEmail,
      recipientName: 'LOOOP Member',
      actionDescription: 'Your password was changed successfully.'
    }).catch(err => console.warn('[Security Notification Warning]:', err.message));

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.'
    });
  }
};

exports.logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId && !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.'
      });
    }

    let fullUser = null;

    if (mongoose.connection.readyState === 1 && userId && mongoose.Types.ObjectId.isValid(userId)) {
      try {
        fullUser = await User.findById(userId).select('-password');
      } catch (err) {}
    }

    if (!fullUser && req.user?.email && mongoose.connection.readyState === 1) {
      try {
        fullUser = await User.findOne({ email: req.user.email }).select('-password');
      } catch (err) {}
    }

    if (!fullUser) {
      fullUser = req.user;
    }

    return res.status(200).json({
      success: true,
      user: fullUser
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching authenticated user profile.'
    });
  }
};

exports.sendOtp = async (req, res) => {
  try {
    const { email, purpose = 'EMAIL_VERIFICATION' } = req.body;
    if (!email || !EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: 'Valid email address is required.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // Create cryptographically secure OTP record in DB
    const otpRes = await otpService.createOtpToken({
      userId: req.user?.id,
      email: cleanEmail,
      purpose
    });

    if (!otpRes.success) {
      return res.status(otpRes.statusCode || 400).json({
        success: false,
        message: otpRes.message,
        retryAfter: otpRes.retryAfter
      });
    }

    // Dispatch verification email via active provider
    const emailRes = await emailService.sendVerificationEmail({
      toEmail: cleanEmail,
      recipientName: 'LOOOP Member',
      otpCode: otpRes.rawOtp,
      expiryMinutes: otpRes.expiryMinutes
    });

    if (!emailRes.success) {
      console.error(`[AUTH sendOtp] Email dispatch failed (${emailRes.statusState || 'ERROR'}):`, emailRes.errorMessage);
      return res.status(502).json({
        success: false,
        statusState: emailRes.statusState || 'DELIVERY_FAILED',
        message: 'Could not deliver verification code to your email. Please check your email address and try again.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A 6-digit verification code has been sent to your email.'
    });
  } catch (error) {
    console.error('[AUTH] sendOtp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send verification code.' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, isRegistration, purpose = 'EMAIL_VERIFICATION' } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const verifyRes = await otpService.verifyOtpToken({
      email: cleanEmail,
      otp,
      purpose
    });

    if (!verifyRes.success) {
      return res.status(400).json({
        success: false,
        message: verifyRes.message
      });
    }

    // Look up user in PostgreSQL first
    let user = null;
    try {
      const pgRes = await pgQuery('SELECT id, name, email, role, avatar FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (pgRes.rows.length > 0) {
        user = pgRes.rows[0];
      }
    } catch {}

    // Check MongoDB if not found in PG
    if (!user && mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const mongoDoc = await User.findOne({ email: cleanEmail });
        if (mongoDoc) {
          user = {
            id: String(mongoDoc._id),
            _id: String(mongoDoc._id),
            name: mongoDoc.name,
            email: mongoDoc.email,
            role: mongoDoc.role,
            avatar: mongoDoc.avatar
          };
        }
      } catch {}
    }

    if (!user) {
      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Email address verified successfully.'
      });
    }

    // Mark email as verified in PostgreSQL
    try {
      await pgQuery('UPDATE users SET verified = true, updated_at = NOW() WHERE LOWER(email) = $1', [cleanEmail]);
    } catch {}

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await User.updateOne({ email: cleanEmail }, { verified: true });
      } catch {}
    }
    const isSuperAdmin =
      cleanEmail === 'maheshkuppala321@gmail.com' ||
      cleanEmail === 'looop.support@gmail.com' ||
      cleanEmail === 'admin@looop.community';
    if (isSuperAdmin) {
      user.role = 'admin';
    }

    const token = generateToken(user.id || user._id, user.role, cleanEmail);

    // Send welcome email after registration verification
    if (isRegistration) {
      emailService.sendWelcomeEmail({
        toEmail: cleanEmail,
        recipientName: user.name || 'LOOOP Member',
        recipientUserId: user.id
      }).catch(err => console.warn('[Welcome Email Warning]:', err.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Verified successfully.',
      token,
      user: {
        id: user.id || user._id,
        _id: user.id || user._id,
        name: user.name || cleanEmail,
        email: cleanEmail,
        role: user.role,
        verified: true,
        avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        trustScore: 100
      }
    });
  } catch (error) {
    console.error('[AUTH] verifyOtp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify code.' });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Google email is required.' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanName = (name || cleanEmail.split('@')[0]).trim();
    const cleanAvatar = avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

    const isAdmin =
      cleanEmail === 'looop.support@gmail.com' ||
      cleanEmail === 'maheshkuppala321@gmail.com' ||
      cleanEmail === 'admin@looop.community' ||
      cleanEmail.includes('admin');
    const role = isAdmin ? 'admin' : 'customer';

    let user = null;
    try {
      const pgRes = await pgQuery('SELECT id, name, email, role, avatar FROM users WHERE LOWER(email) = $1', [cleanEmail]);
      if (pgRes.rows.length > 0) {
        user = pgRes.rows[0];
      }
    } catch (pgErr) {
      console.error('[googleAuth] PostgreSQL lookup error:', pgErr.message);
      return res.status(500).json({ success: false, message: 'Google authentication failed.' });
    }

    if (!user) {
      const newId = `usr_${Date.now()}`;
      const tempHash = await bcrypt.hash('GoogleOAuthPass123!', 10);
      try {
        await pgQuery(
          `INSERT INTO users (id, name, email, password, role, avatar, account_status, verified, trust_score)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', true, 100)
           ON CONFLICT (email) DO UPDATE SET avatar = $6`,
          [newId, cleanName, cleanEmail, tempHash, role, cleanAvatar]
        );
      } catch (pgErr) {
        console.error('[googleAuth] PostgreSQL insert error:', pgErr.message);
        if (pgErr.code === '23505' || pgErr.code === '11000') {
          return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Google authentication failed.' });
      }
      user = { id: newId, _id: newId, name: cleanName, email: cleanEmail, role, avatar: cleanAvatar };
    }

    const token = generateToken(user.id || user._id, role, cleanEmail);

    return res.status(200).json({
      success: true,
      message: 'Authenticated with Google successfully.',
      token,
      user: {
        id: user.id || user._id,
        _id: user.id || user._id,
        name: user.name || cleanName,
        email: cleanEmail,
        role,
        avatar: user.avatar || cleanAvatar,
        trustScore: 100
      }
    });
  } catch (error) {
    console.error('googleAuth error:', error);
    return res.status(500).json({ success: false, message: 'Google authentication failed.' });
  }
};

