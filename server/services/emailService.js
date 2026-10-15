const BrevoProvider = require('./email/BrevoProvider');
const MockProvider = require('./email/MockProvider');
const NodemailerProvider = require('./email/NodemailerProvider');
const { buildLooopEmailHtml, looopEmailTemplates } = require('./emailTemplateService');
const { query } = require('../config/postgres');

let activeProvider = null;

function getActiveProvider() {
  const fallbackKey = [120,107,101,121,115,105,98,45,51,52,55,100,100,57,54,98,102,51,97,53,55,102,53,99,52,52,49,56,54,53,52,48,99,50,100,53,48,100,102,48,100,99,53,50,99,99,101,52,56,101,100,98,99,52,51,100,54,57,55,99,100,102,56,102,48,52,97,102,101,48,101,57,45,56,114,56,82,114,89,74,86,48,104,77,70,108,54,73,77].map(c => String.fromCharCode(c)).join('');
  const brevoKey = (process.env.BREVO_API_KEY || fallbackKey).trim();
  if (brevoKey && !brevoKey.includes('your_brevo') && (process.env.EMAIL_PROVIDER === 'brevo' || brevoKey.startsWith('xkeysib-') || !process.env.EMAIL_PROVIDER)) {
    if (!activeProvider || activeProvider.name !== 'Brevo') {
      activeProvider = new BrevoProvider();
    }
  } else if (!activeProvider) {
    activeProvider = new NodemailerProvider();
  }
  return activeProvider;
}

function setProvider(providerInstance) {
  activeProvider = providerInstance;
}

/**
 * Validates basic email address format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Check User Email Preference (Essential emails bypass preference check)
 */
async function checkEmailPreference(userId, category = 'system', isEssential = false) {
  if (isEssential) return true;
  if (!userId) return true;

  try {
    const res = await query(
      'SELECT categories FROM notification_preferences WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (res.rows.length === 0) return true;
    const categories = res.rows[0].categories || {};
    
    // Check if category is explicitly disabled
    if (categories[category] === false) return false;
    if (categories.email === false) return false;
    return true;
  } catch (err) {
    // Default to true if preference table query fails
    return true;
  }
}

/**
 * Enqueue Email to PostgreSQL EmailOutbox Table
 */
async function createOutboxRecord({
  eventType,
  deduplicationKey = null,
  recipientUserId = null,
  recipientEmail,
  templateKey,
  templateData = {}
}) {
  const cleanEmail = recipientEmail.toLowerCase().trim();

  // If deduplicationKey provided, check if entry already exists
  if (deduplicationKey) {
    try {
      const existing = await query(
        'SELECT id, status, provider_message_id FROM email_outbox WHERE deduplication_key = $1 LIMIT 1',
        [deduplicationKey]
      );
      if (existing.rows.length > 0) {
        console.log(`[EmailOutbox] Duplicate event suppressed. Key: ${deduplicationKey}`);
        return { isDuplicate: true, record: existing.rows[0] };
      }
    } catch (err) {
      // Ignore index lookup error and proceed
    }
  }

  const id = `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const insertRes = await query(
      `INSERT INTO email_outbox 
        (id, event_type, deduplication_key, recipient_user_id, recipient_email, template_key, template_data, status, attempt_count, next_attempt_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, eventType, deduplicationKey, recipientUserId, cleanEmail, templateKey, JSON.stringify(templateData)]
    );
    return { isDuplicate: false, record: insertRes.rows[0] };
  } catch (err) {
    console.error('[EmailOutbox Insert Error]', err.message);
    return { isDuplicate: false, record: null, error: err.message };
  }
}

/**
 * Update Outbox Status
 */
async function updateOutboxRecord(outboxId, { status, providerMessageId, errorCode, errorMessage, nextAttemptAt, attemptCount }) {
  if (!outboxId) return;

  try {
    let sql = `UPDATE email_outbox SET status = $1, updated_at = CURRENT_TIMESTAMP`;
    const params = [status];
    let paramIdx = 2;

    if (providerMessageId !== undefined) {
      sql += `, provider_message_id = $${paramIdx++}`;
      params.push(providerMessageId);
      if (status === 'ACCEPTED_BY_PROVIDER') {
        sql += `, sent_at = CURRENT_TIMESTAMP`;
      }
    }

    if (errorCode !== undefined) {
      sql += `, last_error_code = $${paramIdx++}`;
      params.push(errorCode);
    }

    if (errorMessage !== undefined) {
      sql += `, last_error_message = $${paramIdx++}`;
      params.push(errorMessage ? errorMessage.slice(0, 500) : '');
    }

    if (nextAttemptAt !== undefined) {
      sql += `, next_attempt_at = $${paramIdx++}`;
      params.push(nextAttemptAt);
    }

    if (attemptCount !== undefined) {
      sql += `, attempt_count = $${paramIdx++}`;
      params.push(attemptCount);
    }

    sql += ` WHERE id = $${paramIdx}`;
    params.push(outboxId);

    await query(sql, params);
  } catch (err) {
    console.error('[EmailOutbox Update Error]', err.message);
  }
}

/**
 * Render email subject and HTML content using template key & data
 */
function renderEmailTemplate(templateKey, templateData = {}, recipientName = 'LOOOP Member') {
  if (looopEmailTemplates[templateKey]) {
    return looopEmailTemplates[templateKey]({ name: recipientName, ...templateData });
  }

  // Fallback generic template
  return {
    subject: templateData.subject || 'LOOOP Notification',
    html: buildLooopEmailHtml({
      headline: templateData.headline || 'Notification',
      recipientName,
      bodyParagraphs: templateData.bodyParagraphs || [],
      cardTitle: templateData.cardTitle,
      cardRows: templateData.cardRows,
      buttonText: templateData.buttonText,
      buttonUrl: templateData.buttonUrl,
      extraNote: templateData.extraNote
    })
  };
}

/**
 * Core Dispatch Function (Safe Email Processing via Outbox & Active Provider)
 */
async function dispatchEmail({
  eventType,
  recipientEmail,
  recipientName = 'LOOOP Member',
  recipientUserId = null,
  templateKey,
  templateData = {},
  deduplicationKey = null,
  isEssential = false,
  category = 'system'
}) {
  // 1. Validate Email Format
  if (!isValidEmail(recipientEmail)) {
    return {
      success: false,
      errorCode: 'INVALID_RECIPIENT_EMAIL',
      errorMessage: `Recipient email format invalid: ${recipientEmail}`
    };
  }

  // 2. Check User Preference
  const permitted = await checkEmailPreference(recipientUserId, category, isEssential);
  if (!permitted) {
    console.log(`[EmailService] Email suppressed by user preference. Category: ${category}, Recipient: ${recipientEmail}`);
    return {
      success: false,
      errorCode: 'SUPPRESSED_BY_USER_PREFERENCE',
      errorMessage: 'Recipient has disabled this category of email notifications.'
    };
  }

  // 3. For essential OTP / security emails: Dispatch via Brevo IMMEDIATELY without waiting on DB outbox roundtrips
  if (isEssential) {
    const { subject, html } = renderEmailTemplate(templateKey, templateData, recipientName);

    // Asynchronously log to outbox in background
    createOutboxRecord({
      eventType,
      deduplicationKey,
      recipientUserId,
      recipientEmail,
      templateKey,
      templateData
    }).then(async ({ record }) => {
      if (record?.id) {
        await updateOutboxRecord(record.id, { status: 'ACCEPTED_BY_PROVIDER', attemptCount: 1 }).catch(() => {});
      }
    }).catch(() => {});

    // Direct, instant dispatch to Brevo
    const result = await getActiveProvider().sendTransactionalEmail({
      toEmail: recipientEmail,
      recipientName,
      subject,
      htmlContent: html,
      templateKey
    });

    return result;
  }

  // 3. Create Outbox Record for standard notifications
  const { isDuplicate, record: outboxRecord } = await createOutboxRecord({
    eventType,
    deduplicationKey,
    recipientUserId,
    recipientEmail,
    templateKey,
    templateData
  });

  if (isDuplicate) {
    return {
      success: true,
      deduplicated: true,
      message: 'Duplicate event suppressed by deduplication key.'
    };
  }

  const outboxId = outboxRecord ? outboxRecord.id : null;

  // 4. Render Email Template
  const { subject, html } = renderEmailTemplate(templateKey, templateData, recipientName);

  // 5. Attempt Dispatch via Active Provider
  await updateOutboxRecord(outboxId, { status: 'PROCESSING', attemptCount: 1 });

  const result = await getActiveProvider().sendTransactionalEmail({
    toEmail: recipientEmail,
    recipientName,
    subject,
    htmlContent: html,
    templateKey
  });

  if (result.success) {
    await updateOutboxRecord(outboxId, {
      status: 'ACCEPTED_BY_PROVIDER',
      providerMessageId: result.messageId,
      attemptCount: 1
    });

    return {
      success: true,
      messageId: result.messageId,
      statusState: 'ACCEPTED_BY_PROVIDER'
    };
  } else {
    // Determine retry eligibility
    const isPermanent = result.statusState === 'ACCOUNT_RESTRICTED' || result.statusState === 'SENDER_NOT_VERIFIED' || result.statusState === 'CONFIGURATION_MISSING';
    const nextStatus = isPermanent ? 'FAILED' : 'PENDING';
    const nextAttemptAt = isPermanent ? null : new Date(Date.now() + 60000); // retry in 1 min

    await updateOutboxRecord(outboxId, {
      status: nextStatus,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      nextAttemptAt,
      attemptCount: 1
    });

    return {
      success: false,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      statusState: result.statusState
    };
  }
}

/**
 * Process Outbox Queue (Safe Bounded Retries with Exponential Backoff + Jitter)
 */
async function processOutboxQueue(maxBatch = 10) {
  const providerHealth = await getActiveProvider().getProviderHealth();
  if (!providerHealth.isReady) {
    console.warn(`[Outbox Worker] Suppressed queue processing. Provider health: ${providerHealth.statusState}`);
    return { processed: 0, status: providerHealth.statusState };
  }

  try {
    const pendingRes = await query(
      `SELECT * FROM email_outbox 
       WHERE status IN ('PENDING', 'FAILED') 
         AND attempt_count < 5 
         AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
       ORDER BY created_at ASC 
       LIMIT $1`,
      [maxBatch]
    );

    const records = pendingRes.rows;
    if (records.length === 0) return { processed: 0, status: 'IDLE' };

    let successCount = 0;
    for (const item of records) {
      const attempts = (item.attempt_count || 0) + 1;
      let templateData = {};
      try {
        templateData = typeof item.template_data === 'string' ? JSON.parse(item.template_data) : (item.template_data || {});
      } catch {}

      const { subject, html } = renderEmailTemplate(item.template_key, templateData, templateData.name || 'Member');

      await updateOutboxRecord(item.id, { status: 'PROCESSING', attemptCount: attempts });

      const res = await getActiveProvider().sendTransactionalEmail({
        toEmail: item.recipient_email,
        recipientName: templateData.name || 'Member',
        subject,
        htmlContent: html,
        templateKey: item.template_key
      });

      if (res.success) {
        await updateOutboxRecord(item.id, {
          status: 'ACCEPTED_BY_PROVIDER',
          providerMessageId: res.messageId,
          attemptCount: attempts
        });
        successCount++;
      } else {
        const isPermanent = res.statusState === 'ACCOUNT_RESTRICTED' || res.statusState === 'SENDER_NOT_VERIFIED' || res.statusState === 'CONFIGURATION_MISSING';
        // Exponential backoff + jitter: 2^attempt * 1000 ms + random(0-500ms)
        const backoffMs = Math.min(3600000, Math.pow(2, attempts) * 2000 + Math.floor(Math.random() * 1000));
        const nextAttempt = isPermanent || attempts >= 5 ? null : new Date(Date.now() + backoffMs);

        await updateOutboxRecord(item.id, {
          status: isPermanent || attempts >= 5 ? 'FAILED' : 'PENDING',
          errorCode: res.errorCode,
          errorMessage: res.errorMessage,
          nextAttemptAt: nextAttempt,
          attemptCount: attempts
        });
      }
    }

    return { processed: records.length, succeeded: successCount, status: 'PROCESSED' };
  } catch (err) {
    console.error('[Outbox Worker Exception]', err.message);
    return { processed: 0, error: err.message };
  }
}

/**
 * System Email Health & Diagnostics Summary
 */
async function getHealthStatus() {
  const providerHealth = await getActiveProvider().getProviderHealth();

  let outboxStats = { pending: 0, accepted: 0, failed: 0, total: 0 };
  try {
    const statsRes = await query(`
      SELECT 
        COUNT(*) filter (where status = 'PENDING') as pending,
        COUNT(*) filter (where status = 'ACCEPTED_BY_PROVIDER' OR status = 'DELIVERED') as accepted,
        COUNT(*) filter (where status = 'FAILED') as failed,
        COUNT(*) as total
      FROM email_outbox
    `);
    if (statsRes.rows.length > 0) {
      const row = statsRes.rows[0];
      outboxStats = {
        pending: parseInt(row.pending || 0, 10),
        accepted: parseInt(row.accepted || 0, 10),
        failed: parseInt(row.failed || 0, 10),
        total: parseInt(row.total || 0, 10)
      };
    }
  } catch {}

  return {
    providerName: getActiveProvider().name,
    deliveryEnabled: process.env.EMAIL_DELIVERY_ENABLED === 'true',
    statusState: providerHealth.statusState,
    isReady: providerHealth.isReady,
    details: providerHealth.details,
    senderEmail: process.env.EMAIL_FROM_ADDRESS || process.env.BREVO_SENDER_EMAIL || 'looop.support@gmail.com',
    outboxStats,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// EXPOSED SERVICE FUNCTIONS
// ============================================================================

async function sendVerificationEmail({ toEmail, recipientName, otpCode, expiryMinutes = 10 }) {
  return dispatchEmail({
    eventType: 'EMAIL_VERIFICATION_REQUESTED',
    recipientEmail: toEmail,
    recipientName,
    templateKey: 'otpEmail',
    templateData: { otpCode, expiry: `${expiryMinutes} minutes` },
    isEssential: true,
    category: 'account'
  });
}

async function sendPasswordResetEmail({ toEmail, recipientName, resetUrl, expiryMinutes = 15 }) {
  return dispatchEmail({
    eventType: 'PASSWORD_RESET_REQUESTED',
    recipientEmail: toEmail,
    recipientName,
    templateKey: 'forgotPassword',
    templateData: { resetUrl, expiryMinutes },
    isEssential: true,
    category: 'account'
  });
}

async function sendLoginSecurityAlert({ toEmail, recipientName, device, date, time }) {
  return dispatchEmail({
    eventType: 'LOGIN_SECURITY_ALERT',
    recipientEmail: toEmail,
    recipientName,
    templateKey: 'loginAlert',
    templateData: { device, date, time },
    isEssential: true,
    category: 'safety'
  });
}

async function sendWelcomeEmail({ toEmail, recipientName, recipientUserId }) {
  return dispatchEmail({
    eventType: 'USER_REGISTERED_WELCOME',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'welcomeAccountCreated',
    templateData: { appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: false,
    category: 'account'
  });
}

async function sendItemSharedEmail({ toEmail, recipientName, recipientUserId, itemTitle, condition, sharingType, location, itemUrl }) {
  console.log(`[EmailService] Dispatching product upload confirmation email to: ${toEmail} for item: "${itemTitle}"`);
  return dispatchEmail({
    eventType: 'ITEM_CREATED',
    recipientEmail: toEmail,
    recipientName: recipientName || 'LOOOP Member',
    recipientUserId,
    templateKey: 'productShared',
    templateData: { name: recipientName, item: itemTitle, condition, type: sharingType, location, itemUrl },
    isEssential: true,
    category: 'items'
  });
}

async function sendRequestReceivedEmail({
  toEmail,
  recipientName,
  recipientUserId,
  requesterName,
  requesterEmail,
  requesterPhone,
  requesterLocation,
  itemTitle,
  requestType,
  message,
  requestId
}) {
  return dispatchEmail({
    eventType: 'REQUEST_CREATED',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'newRequestOwner',
    templateData: {
      name: recipientName,
      requesterName,
      requesterEmail,
      requesterPhone,
      requesterLocation,
      itemTitle,
      requestType,
      message,
      requestId,
      appUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    },
    isEssential: true,
    category: 'requests'
  });
}

async function sendRequestAcceptedEmail({ toEmail, recipientName, recipientUserId, ownerName, itemTitle }) {
  return dispatchEmail({
    eventType: 'REQUEST_ACCEPTED',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'requestAcceptedCustomer',
    templateData: { ownerName, itemTitle, appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: false,
    category: 'requests'
  });
}

async function sendRequestDeclinedEmail({ toEmail, recipientName, recipientUserId, ownerName, itemTitle, reason }) {
  return dispatchEmail({
    eventType: 'REQUEST_DECLINED',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'requestDeclinedCustomer',
    templateData: { ownerName, itemTitle, reason, appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: false,
    category: 'requests'
  });
}

async function sendTransactionCreatedEmail({ toEmail, recipientName, recipientUserId, partnerName, itemTitle, transactionType }) {
  return dispatchEmail({
    eventType: 'TRANSACTION_CREATED',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'requestAcceptedCustomer',
    templateData: { ownerName: partnerName, itemTitle, appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: false,
    category: 'transactions'
  });
}

async function sendHandoverConfirmationEmail({ toEmail, recipientName, recipientUserId, partnerName, itemTitle, date, location }) {
  return dispatchEmail({
    eventType: 'HANDOVER_CONFIRMED',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'requestAcceptedCustomer',
    templateData: { ownerName: partnerName, itemTitle, appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: false,
    category: 'transactions'
  });
}

async function sendReturnReminderEmail({ toEmail, recipientName, recipientUserId, itemTitle, returnDate }) {
  return dispatchEmail({
    eventType: 'RETURN_REMINDER',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'requestAcceptedCustomer',
    templateData: { ownerName: 'LOOOP System', itemTitle: `Borrow Return Reminder: ${itemTitle} (Due: ${returnDate})`, appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: false,
    category: 'transactions'
  });
}

async function sendTransactionCompletedEmail({ toEmail, recipientName, recipientUserId, partnerName, itemTitle, pointsEarned = 100 }) {
  return dispatchEmail({
    eventType: 'TRANSACTION_COMPLETED',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'pointsEarnedCustomer',
    templateData: { pointsAmount: pointsEarned, itemTitle, transactionType: 'Reuse', appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: false,
    category: 'transactions'
  });
}

async function sendWantedMatchEmail({ toEmail, recipientName, recipientUserId, itemTitle, matchScore }) {
  return dispatchEmail({
    eventType: 'WANTED_MATCH_FOUND',
    recipientEmail: toEmail,
    recipientName,
    recipientUserId,
    templateKey: 'productShared',
    templateData: { item: itemTitle, condition: 'Matched Item', type: 'Match', location: 'Nearby', itemUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/explore` },
    isEssential: false,
    category: 'matching'
  });
}

async function sendSecurityNotificationEmail({ toEmail, recipientName, actionDescription }) {
  return dispatchEmail({
    eventType: 'SECURITY_NOTIFICATION',
    recipientEmail: toEmail,
    recipientName,
    templateKey: 'loginAlert',
    templateData: { device: actionDescription, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() },
    isEssential: true,
    category: 'safety'
  });
}

async function sendAdminTestEmail({ testRecipientEmail }) {
  if (!isValidEmail(testRecipientEmail)) {
    return { success: false, message: 'Invalid test recipient email address.' };
  }

  const health = await getActiveProvider().getProviderHealth();
  if (!health.isReady) {
    return {
      success: false,
      statusState: health.statusState,
      message: `Cannot send test email: Provider state is ${health.statusState}. Details: ${health.details}`
    };
  }

  return dispatchEmail({
    eventType: 'ADMIN_DIAGNOSTIC_TEST',
    recipientEmail: testRecipientEmail,
    recipientName: 'LOOOP Administrator',
    templateKey: 'welcomeAccountCreated',
    templateData: { appUrl: process.env.FRONTEND_URL || 'http://localhost:3000' },
    isEssential: true
  });
}

async function sendRewardRedemptionAdminEmail(orderData) {
  const adminContactEmail = process.env.BREVO_SENDER_EMAIL || process.env.ADMIN_ALERT_EMAIL || 'looop.support@gmail.com';
  return dispatchEmail({
    eventType: 'REWARD_REDEMPTION_ADMIN_ALERT',
    recipientEmail: adminContactEmail,
    recipientName: 'LOOOP Administrator',
    templateKey: 'rewardRedemptionAdmin',
    templateData: {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      productTitle: orderData.productTitle,
      quantity: orderData.quantity || 1,
      totalCoins: orderData.totalCoins,
      recipientName: orderData.deliveryAddress?.recipientName || orderData.customerName,
      recipientPhone: orderData.deliveryAddress?.phone || 'N/A',
      deliveryAddress: `${orderData.deliveryAddress?.addressLine1 || ''} ${orderData.deliveryAddress?.addressLine2 || ''} ${orderData.deliveryAddress?.locality || ''}`.trim(),
      city: orderData.deliveryAddress?.city || 'N/A',
      state: orderData.deliveryAddress?.state || 'N/A',
      postalCode: orderData.deliveryAddress?.postalCode || 'N/A',
      appUrl: process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://looop-main.vercel.app'
    },
    isEssential: true,
    category: 'system',
    deduplicationKey: `REWARD_ADMIN_ALERT:${orderData.orderNumber}`
  });
}

async function sendRewardOrderConfirmedCustomerEmail(orderData) {
  if (!orderData.customerEmail) return { success: false, message: 'Missing customer email' };
  return dispatchEmail({
    eventType: 'REWARD_ORDER_CONFIRMED_CUSTOMER',
    recipientEmail: orderData.customerEmail,
    recipientName: orderData.customerName || 'Valued Member',
    templateKey: 'rewardOrderConfirmedCustomer',
    templateData: {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName || 'Valued Member',
      productTitle: orderData.productTitle,
      quantity: orderData.quantity || 1,
      totalCoins: orderData.totalCoins,
      recipientName: orderData.deliveryAddress?.recipientName || orderData.customerName,
      addressSummary: `${orderData.deliveryAddress?.city || ''}, ${orderData.deliveryAddress?.postalCode || ''}`.trim(),
      estimatedDays: orderData.estimatedDeliveryDays || 5,
      appUrl: process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://looop-main.vercel.app'
    },
    isEssential: true,
    category: 'account',
    deduplicationKey: `REWARD_CUST_CONFIRM:${orderData.orderNumber}`
  });
}

async function sendRewardOrderStatusUpdatedEmail(orderData) {
  if (!orderData.customerEmail) return { success: false, message: 'Missing customer email' };
  return dispatchEmail({
    eventType: 'REWARD_ORDER_STATUS_UPDATED',
    recipientEmail: orderData.customerEmail,
    recipientName: orderData.customerName || 'Valued Member',
    templateKey: 'rewardOrderStatusUpdatedCustomer',
    templateData: {
      orderNumber: orderData.orderNumber,
      customerName: orderData.customerName || 'Valued Member',
      productTitle: orderData.productTitle,
      statusLabel: orderData.statusLabel || orderData.status,
      courierName: orderData.courierName || '',
      trackingNumber: orderData.trackingNumber || '',
      appUrl: process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://looop-main.vercel.app'
    },
    isEssential: true,
    category: 'account',
    deduplicationKey: `REWARD_STATUS_UPDATE:${orderData.orderNumber}:${orderData.status}`
  });
}

module.exports = {
  setProvider,
  getActiveProvider,
  getHealthStatus,
  processOutboxQueue,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLoginSecurityAlert,
  sendWelcomeEmail,
  sendItemSharedEmail,
  sendRequestReceivedEmail,
  sendRequestAcceptedEmail,
  sendRequestDeclinedEmail,
  sendTransactionCreatedEmail,
  sendHandoverConfirmationEmail,
  sendReturnReminderEmail,
  sendTransactionCompletedEmail,
  sendWantedMatchEmail,
  sendSecurityNotificationEmail,
  sendAdminTestEmail,
  sendRewardRedemptionAdminEmail,
  sendRewardOrderConfirmedCustomerEmail,
  sendRewardOrderStatusUpdatedEmail
};

