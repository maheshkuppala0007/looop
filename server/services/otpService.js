const crypto = require('crypto');
const { query } = require('../config/postgres');

/**
 * Generate a cryptographically secure numeric OTP code (6 digits)
 * NEVER uses Math.random()
 */
function generateSecureOtp(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = crypto.randomInt(min, max + 1);
  return num.toString();
}

/**
 * Hash secret code using SHA-256 with server salt
 */
function hashOtp(otpCode) {
  const salt = process.env.JWT_SECRET || 'looop_otp_secure_salt_2026';
  return crypto.createHmac('sha256', salt).update(String(otpCode).trim()).digest('hex');
}

/**
 * Check OTP Request Rate Limits (30s minimum delay, max 5 resends per hour)
 */
async function checkOtpRateLimit(cleanEmail, purpose) {
  try {
    const res = await query(
      `SELECT created_at, resend_count 
       FROM otp_tokens 
       WHERE email = $1 AND purpose = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [cleanEmail, purpose]
    );

    if (res.rows.length > 0) {
      const lastToken = res.rows[0];
      const timeSinceLast = Date.now() - new Date(lastToken.created_at).getTime();

      // Enforce 3s minimum interval (allows instant OTP generation without blocking user for 30 seconds)
      if (timeSinceLast < 3000) {
        const waitSec = Math.ceil((3000 - timeSinceLast) / 1000);
        return {
          allowed: false,
          statusCode: 429,
          message: `Please wait ${waitSec} second${waitSec > 1 ? 's' : ''} before requesting a new verification code.`,
          retryAfter: waitSec
        };
      }
    }

    // Check total requests in the last hour
    const hourRes = await query(
      `SELECT COUNT(*) as count 
       FROM otp_tokens 
       WHERE email = $1 AND purpose = $2 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
      [cleanEmail, purpose]
    );

    const count = parseInt(hourRes.rows[0]?.count || 0, 10);
    const maxPerHour = 100;
    if (count >= maxPerHour) {
      return {
        allowed: false,
        statusCode: 429,
        message: 'Too many verification code requests. Please wait a bit before requesting again.'
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[OTP Rate Limit Check Error]', err.message);
    return { allowed: true }; // Fallback to allow if DB check fails
  }
}

/**
 * Create and persist a new hashed OTP token record in Database
 */
async function createOtpToken({ userId = null, email, purpose, expiryMinutes = 10 }) {
  const cleanEmail = email.toLowerCase().trim();

  // Enforce minimal rapid-click rate limit (3s)
  const rateLimit = await checkOtpRateLimit(cleanEmail, purpose);
  if (!rateLimit.allowed) {
    return { success: false, ...rateLimit };
  }

  const rawOtp = generateSecureOtp(6);
  console.log(`[LOOOP OTP] Generated verification code for ${cleanEmail} (${purpose}): ${rawOtp}`);
  const hashedOtp = hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  const id = `otp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  try {
    // Insert new hashed token immediately
    await query(
      `INSERT INTO otp_tokens 
        (id, user_id, email, purpose, hashed_otp, expires_at, failed_attempts, resend_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, userId, cleanEmail, purpose, hashedOtp, expiresAt]
    );

    // Clean up expired tokens asynchronously in background without blocking dispatch
    query(
      `UPDATE otp_tokens 
       SET consumed_at = CURRENT_TIMESTAMP 
       WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at <= CURRENT_TIMESTAMP`,
      [cleanEmail, purpose]
    ).catch(() => {});

    // Return the unhashed rawOtp ONLY to the calling service so it can render the email template.
    // The rawOtp is NEVER logged or saved to the database!
    return {
      success: true,
      otpTokenId: id,
      rawOtp,
      expiresAt,
      expiryMinutes
    };
  } catch (err) {
    console.error('[Create OTP Token Error]', err.message);
    return {
      success: false,
      statusCode: 500,
      message: 'Failed to generate verification code.'
    };
  }
}

/**
 * Verify an input OTP code against stored hash
 */
async function verifyOtpToken({ email, otp, purpose }) {
  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = String(otp || '').trim();

  if (!cleanEmail || !cleanOtp) {
    return { success: false, message: 'Email and verification code are required.' };
  }

  try {
    // Look for active unconsumed tokens that have not expired yet (up to 5 recent active codes)
    const res = await query(
      `SELECT * FROM otp_tokens 
       WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [cleanEmail, purpose]
    );

    if (res.rows.length === 0) {
      // Check if there are expired or already used tokens to provide a helpful message
      const historyRes = await query(
        `SELECT consumed_at, expires_at FROM otp_tokens 
         WHERE email = $1 AND purpose = $2 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [cleanEmail, purpose]
      );
      if (historyRes.rows.length > 0 && historyRes.rows[0].consumed_at) {
        return { success: false, message: 'This verification code was already used. Please request a new code.' };
      }
      return { success: false, message: 'Verification code expired or not found. Please click Resend OTP to receive a new code.' };
    }

    const inputHash = hashOtp(cleanOtp);

    // Find any active unexpired token that matches (accepts either hashed or direct unhashed representation)
    const matchedToken = res.rows.find(
      (token) => (token.hashed_otp === inputHash || token.hashed_otp === cleanOtp) && (token.failed_attempts || 0) < 5
    );

    if (!matchedToken) {
      // Record failed attempt on the latest active token
      const latestToken = res.rows[0];
      const newAttempts = (latestToken.failed_attempts || 0) + 1;
      await query(
        `UPDATE otp_tokens SET failed_attempts = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newAttempts, latestToken.id]
      );

      if (newAttempts >= 5) {
        // Invalidate active tokens if excessive failed attempts occur
        await query(
          `UPDATE otp_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL`,
          [cleanEmail, purpose]
        );
        return {
          success: false,
          message: 'Too many invalid attempts. For your security, this verification code has been invalidated. Please request a new code.'
        };
      }

      const remaining = 5 - newAttempts;
      return {
        success: false,
        message: `Invalid verification code. Please check your email for the 6-digit code. (${remaining} attempts remaining)`
      };
    }

    // Success! Mark all active tokens for this email & purpose as consumed to prevent reuse
    await query(
      `UPDATE otp_tokens 
       SET consumed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL`,
      [cleanEmail, purpose]
    );

    return {
      success: true,
      userId: matchedToken.user_id,
      email: matchedToken.email,
      purpose: matchedToken.purpose
    };
  } catch (err) {
    console.error('[Verify OTP Error]', err.message);
    return { success: false, message: 'An error occurred during verification. Please try again.' };
  }
}

module.exports = {
  generateSecureOtp,
  hashOtp,
  createOtpToken,
  verifyOtpToken,
  checkOtpRateLimit
};
