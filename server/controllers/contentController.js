const { query } = require('../config/postgres');
const otpService = require('../services/otpService');
const emailService = require('../services/emailService');

const DEFAULT_SITE_CONFIG = {
  siteName: 'LOOOP',
  siteTagline: 'Share. Reuse. Connect.',
  logoText: 'Looop',
  logoUrl: '',
  navLinks: [
    { id: 'home', label: 'Home', path: '/', visible: true },
    { id: 'browse', label: 'Browse', path: '/browse', visible: true },
    { id: 'how-it-works', label: 'How LOOOP Works', path: '/how-it-works', visible: true },
    { id: 'about', label: 'About the Mission', path: '/about', visible: true },
    { id: 'impact', label: 'Community Impact', path: '/#impact', visible: true }
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

/**
 * 1. GET PUBLIC SITE SETTINGS (Branding, Navigation, Impact config)
 */
exports.getSiteSettings = async (req, res) => {
  try {
    const dbRes = await query("SELECT value FROM admin_settings WHERE key = 'site_config' LIMIT 1");
    if (dbRes.rows.length > 0 && dbRes.rows[0].value) {
      return res.status(200).json({
        success: true,
        settings: dbRes.rows[0].value
      });
    }
    return res.status(200).json({
      success: true,
      settings: DEFAULT_SITE_CONFIG
    });
  } catch (err) {
    console.error('[Content] Error fetching site settings:', err);
    return res.status(200).json({
      success: true,
      settings: DEFAULT_SITE_CONFIG
    });
  }
};

/**
 * 2. UPDATE SITE SETTINGS (Admin Only)
 */
exports.updateSiteSettings = async (req, res) => {
  try {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid site settings payload.' });
    }

    // Merge with existing or default
    const currentRes = await query("SELECT value FROM admin_settings WHERE key = 'site_config' LIMIT 1");
    const existing = currentRes.rows.length > 0 ? currentRes.rows[0].value : DEFAULT_SITE_CONFIG;

    const merged = {
      ...existing,
      ...newSettings,
      impactSection: {
        ...existing.impactSection,
        ...(newSettings.impactSection || {})
      }
    };

    await query(
      `INSERT INTO admin_settings (id, key, value, label, description, category, updated_at)
       VALUES ('setting_site_config', 'site_config', $1, 'Site Branding & Header CMS', 'Admin controls for logo, site title, nav links, and impact stats', 'CMS', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(merged)]
    );

    return res.status(200).json({
      success: true,
      message: 'Website settings saved and updated successfully.',
      settings: merged
    });
  } catch (err) {
    console.error('[Content] Error updating site settings:', err);
    return res.status(500).json({ success: false, message: 'Failed to update site settings.' });
  }
};

/**
 * 3. GET PUBLISHED REVIEWS (Public)
 */
exports.getPublicReviews = async (req, res) => {
  try {
    const dbRes = await query(
      `SELECT id, person, role, item, rating, quote, avatar, badge, display_order, created_at
       FROM site_reviews 
       WHERE is_published = TRUE 
       ORDER BY display_order ASC, created_at DESC 
       LIMIT 12`
    );

    return res.status(200).json({
      success: true,
      reviews: dbRes.rows
    });
  } catch (err) {
    console.error('[Content] Error fetching public reviews:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reviews.' });
  }
};

/**
 * 4. GET ALL REVIEWS (Admin - Published + Unpublished)
 */
exports.getAdminReviews = async (req, res) => {
  try {
    const dbRes = await query(
      `SELECT * FROM site_reviews ORDER BY display_order ASC, created_at DESC`
    );

    return res.status(200).json({
      success: true,
      reviews: dbRes.rows
    });
  } catch (err) {
    console.error('[Content] Error fetching admin reviews:', err);
    return res.status(500).json({ success: false, message: 'Failed to load reviews.' });
  }
};

/**
 * 5. CREATE REVIEW (Admin)
 */
exports.createReview = async (req, res) => {
  try {
    const { person, role, item, rating, quote, avatar, badge, is_published, display_order } = req.body;

    if (!person || !quote) {
      return res.status(400).json({ success: false, message: 'Reviewer name and review quote are required.' });
    }

    const id = `srev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const numRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    const published = is_published !== false;
    const order = parseInt(display_order, 10) || 0;
    const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

    const insertRes = await query(
      `INSERT INTO site_reviews (id, person, role, item, rating, quote, avatar, badge, is_published, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        person.trim(),
        (role || 'Community Member').trim(),
        (item || 'Platform Experience').trim(),
        numRating,
        quote.trim(),
        avatar ? avatar.trim() : defaultAvatar,
        (badge || 'Verified Member').trim(),
        published,
        order
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Review created successfully.',
      review: insertRes.rows[0]
    });
  } catch (err) {
    console.error('[Content] Error creating review:', err);
    return res.status(500).json({ success: false, message: 'Failed to create review.' });
  }
};

/**
 * 6. UPDATE REVIEW (Admin)
 */
exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { person, role, item, rating, quote, avatar, badge, is_published, display_order } = req.body;

    const existingRes = await query('SELECT * FROM site_reviews WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const current = existingRes.rows[0];
    const updateRes = await query(
      `UPDATE site_reviews 
       SET person = $1, role = $2, item = $3, rating = $4, quote = $5, avatar = $6, badge = $7, is_published = $8, display_order = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        person !== undefined ? person.trim() : current.person,
        role !== undefined ? role.trim() : current.role,
        item !== undefined ? item.trim() : current.item,
        rating !== undefined ? Math.max(1, Math.min(5, parseInt(rating, 10))) : current.rating,
        quote !== undefined ? quote.trim() : current.quote,
        avatar !== undefined ? avatar.trim() : current.avatar,
        badge !== undefined ? badge.trim() : current.badge,
        is_published !== undefined ? Boolean(is_published) : current.is_published,
        display_order !== undefined ? parseInt(display_order, 10) : current.display_order,
        id
      ]
    );

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully.',
      review: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[Content] Error updating review:', err);
    return res.status(500).json({ success: false, message: 'Failed to update review.' });
  }
};

/**
 * 7. TOGGLE REVIEW PUBLISH STATUS (Admin)
 */
exports.toggleReviewPublish = async (req, res) => {
  try {
    const { id } = req.params;
    const existingRes = await query('SELECT id, is_published FROM site_reviews WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const newStatus = !existingRes.rows[0].is_published;
    await query('UPDATE site_reviews SET is_published = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, id]);

    return res.status(200).json({
      success: true,
      message: `Review ${newStatus ? 'published' : 'unpublished'} successfully.`,
      is_published: newStatus
    });
  } catch (err) {
    console.error('[Content] Error toggling review publish:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle review status.' });
  }
};

/**
 * 8. DELETE REVIEW PERMANENTLY (Admin)
 */
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const deleteRes = await query('DELETE FROM site_reviews WHERE id = $1 RETURNING id', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Review permanently deleted from the database.'
    });
  } catch (err) {
    console.error('[Content] Error deleting review:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete review.' });
  }
};

/**
 * 9. GET LIVE REAL IMPACT STATS
 * Starts strictly at 0 and increments dynamically when actions occur in the platform.
 */
exports.getLiveImpactStats = async (req, res) => {
  try {
    // 1. Completed transactions count (Reuse actions)
    const txRes = await query(
      `SELECT 
         COUNT(*) filter (where LOWER(status) IN ('completed', 'returned', 'confirmed')) as items_reused,
         (SELECT COUNT(DISTINCT uid) FROM (
            SELECT owner_id as uid FROM transactions WHERE LOWER(status) IN ('completed', 'returned', 'confirmed')
            UNION
            SELECT recipient_id as uid FROM transactions WHERE LOWER(status) IN ('completed', 'returned', 'confirmed')
          ) u) as people_helped
       FROM transactions`
    );

    // 2. Count by category from completed reuse transactions
    const catRes = await query(
      `SELECT 
         COUNT(*) filter (where LOWER(i.category) IN ('books', 'book', 'education', 'study')) as books_shared,
         COUNT(*) filter (where LOWER(i.category) IN ('electronics', 'gadgets', 'appliances', 'computers')) as electronics_shared
       FROM transactions t
       JOIN items i ON t.item_id = i.id
       WHERE LOWER(t.status) IN ('completed', 'returned', 'confirmed')`
    );

    // 3. Waste avoided calculation
    const txRow = txRes.rows[0] || {};
    const catRow = catRes.rows[0] || {};

    const itemsReused = parseInt(txRow.items_reused || 0, 10);
    const peopleHelped = parseInt(txRow.people_helped || 0, 10);
    const booksShared = parseInt(catRow.books_shared || 0, 10);
    const electronicsShared = parseInt(catRow.electronics_shared || 0, 10);
    const wasteAvoidedKg = Math.round(itemsReused * 3); // 3 kg average diverted per completed reuse

    // 4. Fetch admin custom settings & overrides
    const configRes = await query("SELECT value FROM admin_settings WHERE key = 'site_config' LIMIT 1");
    const siteConfig = configRes.rows.length > 0 ? configRes.rows[0].value : DEFAULT_SITE_CONFIG;
    const impactSection = siteConfig?.impactSection || DEFAULT_SITE_CONFIG.impactSection;

    return res.status(200).json({
      success: true,
      metrics: {
        itemsReused,
        peopleHelped,
        booksShared,
        electronicsShared,
        wasteAvoidedKg
      },
      impactSection
    });
  } catch (err) {
    console.error('[Content] Error calculating impact stats:', err);
    return res.status(200).json({
      success: true,
      metrics: {
        itemsReused: 0,
        peopleHelped: 0,
        booksShared: 0,
        electronicsShared: 0,
        wasteAvoidedKg: 0
      },
      impactSection: DEFAULT_SITE_CONFIG.impactSection
    });
  }
};

/**
 * 10. SUBSCRIBE NEWSLETTER (Checks duplicate, sends OTP via Brevo)
 */
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email format.' });
    }

    // Check if subscriber already exists and is verified
    const existing = await query('SELECT * FROM subscribers WHERE email = $1 LIMIT 1', [cleanEmail]);
    if (existing.rows.length > 0 && existing.rows[0].verified) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already subscribed to LOOOP updates and announcements.'
      });
    }

    // If subscriber doesn't exist, insert unverified record
    if (existing.rows.length === 0) {
      const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await query(
        `INSERT INTO subscribers (id, email, name, verified, status, subscribed_at)
         VALUES ($1, $2, $3, FALSE, 'PENDING_VERIFICATION', CURRENT_TIMESTAMP)`,
        [subscriberId, cleanEmail, (name || 'LOOOP Subscriber').trim()]
      );
    }

    // Generate 6-digit OTP
    const otpResult = await otpService.createOtpToken({
      email: cleanEmail,
      purpose: 'NEWSLETTER_SUBSCRIBE',
      expiryMinutes: 10
    });

    if (!otpResult.success) {
      return res.status(otpResult.statusCode || 400).json({
        success: false,
        message: otpResult.message || 'Unable to generate verification code right now. Please try again shortly.'
      });
    }

    // Send OTP verification email via Brevo
    const emailRes = await emailService.sendVerificationEmail({
      toEmail: cleanEmail,
      recipientName: name || 'LOOOP Subscriber',
      otpCode: otpResult.rawOtp,
      expiryMinutes: 10
    });

    if (!emailRes.success) {
      console.warn('[Newsletter] Failed to dispatch OTP email:', emailRes.errorMessage);
    }

    // Return success WITHOUT exposing OTP
    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please enter the 6-digit code to confirm your subscription.',
      email: cleanEmail
    });
  } catch (err) {
    console.error('[Newsletter] Subscribe Error:', err);
    return res.status(500).json({ success: false, message: 'Subscription request failed. Please try again.' });
  }
};

/**
 * 11. VERIFY SUBSCRIBER OTP
 */
exports.verifySubscriberOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and 6-digit verification code are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    const verifyResult = await otpService.verifyOtpToken({
      email: cleanEmail,
      otp: cleanOtp,
      purpose: 'NEWSLETTER_SUBSCRIBE'
    });

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message || 'Invalid or expired verification code.'
      });
    }

    // Mark subscriber as verified in PostgreSQL
    await query(
      `UPDATE subscribers 
       SET verified = TRUE, status = 'ACTIVE', verified_at = CURRENT_TIMESTAMP
       WHERE email = $1`,
      [cleanEmail]
    );

    return res.status(200).json({
      success: true,
      message: 'Email successfully verified! You are now subscribed to LOOOP product releases and community updates.'
    });
  } catch (err) {
    console.error('[Newsletter] Verify OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
};

/**
 * 12. GET BROADCAST UPDATES LIST (Admin)
 */
exports.getBroadcasts = async (req, res) => {
  try {
    const listRes = await query('SELECT * FROM broadcast_updates ORDER BY sent_at DESC LIMIT 50');
    return res.status(200).json({
      success: true,
      broadcasts: listRes.rows
    });
  } catch (err) {
    console.error('[Broadcast] Error fetching broadcasts:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve broadcast history.' });
  }
};

/**
 * 13. SEND BROADCAST UPDATE (Admin -> All Verified Subscribers + All Customer Logins)
 */
exports.sendBroadcast = async (req, res) => {
  try {
    const { title, category, message, buttonText, buttonUrl } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Update title and message body are required.' });
    }

    // 1. Fetch all verified newsletter subscribers
    const subRes = await query(
      `SELECT email, name FROM subscribers WHERE verified = TRUE AND status = 'ACTIVE'`
    );

    // 2. Fetch all registered users in database
    const userRes = await query(
      `SELECT email, name FROM users WHERE account_status = 'active'`
    );

    // 3. Deduplicate recipients by lowercase email
    const recipientMap = new Map();
    for (const sub of subRes.rows) {
      const email = (sub.email || '').toLowerCase().trim();
      if (email) recipientMap.set(email, sub.name || 'LOOOP Subscriber');
    }
    for (const u of userRes.rows) {
      const email = (u.email || '').toLowerCase().trim();
      if (email && !recipientMap.has(email)) {
        recipientMap.set(email, u.name || 'LOOOP Member');
      }
    }

    const totalRecipients = recipientMap.size;
    console.log(`[Broadcast] Preparing dispatch to ${totalRecipients} unique recipients.`);

    // 4. Dispatch email to each recipient
    const paragraphs = message.split('\n\n').filter(Boolean);
    let successCount = 0;

    for (const [recEmail, recName] of recipientMap.entries()) {
      try {
        await emailService.dispatchEmail({
          eventType: 'ADMIN_BROADCAST_UPDATE',
          recipientEmail: recEmail,
          recipientName: recName,
          templateKey: 'genericAnnouncement',
          templateData: {
            subject: `[LOOOP Update] ${title}`,
            headline: title,
            bodyParagraphs: paragraphs.length > 0 ? paragraphs : [message],
            cardTitle: category || 'Platform Update',
            cardRows: [
              { label: 'Category', value: category || 'Platform Update' },
              { label: 'Date', value: new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' }) }
            ],
            buttonText: buttonText || 'Visit LOOOP Community',
            buttonUrl: buttonUrl || (process.env.FRONTEND_URL || 'https://looop-main.vercel.app'),
            extraNote: 'You received this email because you are a verified subscriber or registered member of LOOOP.'
          },
          isEssential: false,
          category: 'system'
        });
        successCount++;
      } catch (sendErr) {
        console.warn(`[Broadcast] Failed sending to ${recEmail}:`, sendErr.message);
      }
    }

    // 5. Record broadcast in database
    const broadcastId = `bcast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const adminName = req.user?.name || 'Administrator (Mahesh Kuppala)';

    await query(
      `INSERT INTO broadcast_updates (id, title, category, message, recipient_count, sent_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [broadcastId, title.trim(), category || 'Platform Update', message.trim(), totalRecipients, adminName]
    );

    return res.status(200).json({
      success: true,
      message: `Broadcast announcement successfully sent to ${totalRecipients} verified subscribers and members.`,
      recipientCount: totalRecipients,
      dispatchedCount: successCount
    });
  } catch (err) {
    console.error('[Broadcast] Error sending broadcast:', err);
    return res.status(500).json({ success: false, message: 'Failed to send broadcast update.' });
  }
};

/**
 * 14. GET SUBSCRIBERS LIST (Admin)
 */
exports.getSubscribers = async (req, res) => {
  try {
    const listRes = await query('SELECT * FROM subscribers ORDER BY subscribed_at DESC LIMIT 100');
    return res.status(200).json({
      success: true,
      subscribers: listRes.rows
    });
  } catch (err) {
    console.error('[Newsletter] Error fetching subscribers:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve subscribers.' });
  }
};
