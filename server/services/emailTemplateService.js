/**
 * LOOOP Email Template Generator Service (Server CommonJS)
 * Standardized HTML email templates for all 23 transactional notifications.
 *
 * Design Guidelines:
 * - Brand: LOOOP
 * - Tagline: Share. Reuse. Connect.
 * - Clean white background (#ffffff)
 * - Soft rounded cards (#f8fafc with #e2e8f0 border)
 * - Mobile responsive, professional typography (-apple-system)
 * - Emerald Primary CTA Button (#059669)
 * - Special centered OTP card layout for verification codes
 */

function buildLooopEmailHtml({
  headline = 'Notification',
  recipientName = 'Member',
  bodyParagraphs = [],
  cardTitle = '',
  cardRows = [],
  isOtp = false,
  otpCode = '',
  otpExpiry = '10 minutes',
  buttonText = '',
  buttonUrl = '',
  extraNote = '',
  signoffTeam = '— The LOOOP Team',
  showFooterTagline = false
}) {
  const formattedName = recipientName ? recipientName.trim() : 'Member';

  // Format OTP individual colored boxes in a single responsive row
  let otpBoxesHtml = '';
  let otpDigitsArray = [];
  if (isOtp && otpCode) {
    otpDigitsArray = String(otpCode).replace(/\D/g, '').split('');
    const DIGIT_COLORS = [
      { bg: '#ecfdf5', border: '#10b981', color: '#047857', shadow: 'rgba(16, 185, 129, 0.22)' }, // 1: Emerald
      { bg: '#f0fdfa', border: '#14b8a6', color: '#0f766e', shadow: 'rgba(20, 184, 166, 0.22)' }, // 2: Teal
      { bg: '#eff6ff', border: '#3b82f6', color: '#1d4ed8', shadow: 'rgba(59, 130, 246, 0.22)' }, // 3: Blue
      { bg: '#eef2ff', border: '#6366f1', color: '#4338ca', shadow: 'rgba(99, 102, 241, 0.22)' }, // 4: Indigo
      { bg: '#faf5ff', border: '#a855f7', color: '#7e22ce', shadow: 'rgba(168, 85, 247, 0.22)' }, // 5: Purple
      { bg: '#fff1f2', border: '#f43f5e', color: '#be123c', shadow: 'rgba(244, 63, 94, 0.22)' }   // 6: Rose
    ];

    otpBoxesHtml = otpDigitsArray.map((digit, idx) => {
      const c = DIGIT_COLORS[idx % DIGIT_COLORS.length];
      return `<td class="otp-digit-td" align="center" valign="middle" style="padding: 0; width: 36px; min-width: 28px; max-width: 38px; height: 46px; min-height: 42px; max-height: 48px; background-color: ${c.bg}; border: 2px solid ${c.border}; border-radius: 10px; font-size: 24px; font-weight: 800; color: ${c.color}; text-align: center; line-height: 44px; box-shadow: 0 2px 6px ${c.shadow}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'SF Mono', Consolas, monospace;">${digit}</td>`;
    }).join('');
  }

  // Render Card rows key-value pairs
  const cardRowsHtml = cardRows && cardRows.length > 0
    ? cardRows.map(row => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f1f5f9;">
          <span style="color: #64748b; font-size: 14px; font-weight: 500;">${row.label}</span>
          <span style="color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${row.value}</span>
        </div>
      `).join('')
    : '';

  const cardHtml = isOtp
    ? `
      <div class="looop-otp-card" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0fdfa 100%); border: 2px solid #10b981; border-radius: 16px; padding: 22px 8px; text-align: center; margin: 22px 0; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.12); box-sizing: border-box;">
        <div style="display: inline-block; background-color: #065f46; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 14px; border-radius: 20px; letter-spacing: 1.2px; text-transform: uppercase;">
          ONE-TIME VERIFICATION CODE
        </div>
        <div style="margin: 16px auto 10px auto; text-align: center; width: 100%;">
          <table class="otp-table" role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto; border-collapse: separate; border-spacing: 4px; table-layout: fixed; width: auto;">
            <tr>
              ${otpBoxesHtml}
            </tr>
          </table>
        </div>
        <div style="margin: 6px auto 14px auto; font-size: 13px; font-weight: 700; color: #047857; letter-spacing: 3px; font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, monospace;">
          ${otpDigitsArray.join(' ')}
        </div>
        <div style="display: inline-block; background-color: #ffffff; border: 1.5px solid #a7f3d0; border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; color: #047857; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          ⏱ Valid for ${otpExpiry || '10 minutes'}
        </div>
      </div>
    `
    : (cardRows && cardRows.length > 0) || cardTitle
      ? `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
          ${cardTitle ? `<div style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">${cardTitle}</div>` : ''}
          ${cardRowsHtml}
        </div>
      `
      : '';

  const paragraphsHtml = bodyParagraphs.map(p => `
    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">${p}</p>
  `).join('');

  const buttonHtml = buttonText && buttonUrl
    ? `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${buttonUrl}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff !important; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          ${buttonText}
        </a>
      </div>
    `
    : '';

  const extraNoteHtml = extraNote
    ? `<p style="font-size: 14px; line-height: 1.5; color: #64748b; margin: 16px 0;">${extraNote}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .looop-container {
        padding: 20px 8px !important;
      }
      .looop-otp-card {
        padding: 16px 4px !important;
        border-radius: 12px !important;
      }
      .otp-digit-td {
        width: 32px !important;
        min-width: 26px !important;
        max-width: 34px !important;
        height: 42px !important;
        min-height: 38px !important;
        max-height: 44px !important;
        font-size: 20px !important;
        line-height: 40px !important;
        border-radius: 8px !important;
      }
      .otp-table {
        border-spacing: 3px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <div class="looop-container" style="max-width: 560px; width: 100%; margin: 0 auto; padding: 28px 12px; box-sizing: border-box; background-color: #ffffff;">
    
    <!-- LOOOP Header -->
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="font-size: 32px; font-weight: 800; color: #059669; letter-spacing: -0.5px; margin: 0; line-height: 1;">LOOOP</div>
      <div style="font-size: 13px; font-weight: 500; color: #64748b; margin-top: 6px; letter-spacing: 0.2px;">Share. Reuse. Connect.</div>
    </div>

    <div style="border-top: 1px solid #f1f5f9; margin-bottom: 28px;"></div>

    <!-- Headline -->
    <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 20px 0; line-height: 1.3; text-align: center;">${headline}</h1>

    <!-- Greeting -->
    <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 14px;">Hi ${formattedName},</div>

    <!-- Body Paragraphs (Top) -->
    ${paragraphsHtml}

    <!-- Clean Card (Details or OTP) -->
    ${cardHtml}

    <!-- Primary Button CTA -->
    ${buttonHtml}

    <!-- Extra Note / Disclaimer -->
    ${extraNoteHtml}

    <!-- Sign-off -->
    <div style="font-size: 15px; font-weight: 600; color: #475569; margin-top: 28px;">${signoffTeam}</div>

    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f1f5f9; text-align: center;">
      <div style="font-size: 14px; font-weight: 600; color: #059669; margin: 0 0 10px 0; letter-spacing: 0.3px;">Share. Reuse. Connect.</div>
      <div style="font-size: 12px; color: #94a3b8; margin: 4px 0; line-height: 1.5;">© 2026 LOOOP</div>
      <div style="font-size: 12px; color: #94a3b8; margin: 4px 0; line-height: 1.5;">You're receiving this because you have an account with LOOOP.</div>
    </div>

  </div>
</body>
</html>
  `.trim();
}

const looopEmailTemplates = {
  welcomeAccountCreated: ({ name = 'Member', appUrl = 'https://loop-five-azure.vercel.app' }) => ({
    subject: 'Welcome to LOOOP! Give Unused Things a New Life',
    html: buildLooopEmailHtml({
      headline: 'Welcome to LOOOP!',
      recipientName: name,
      bodyParagraphs: [
        'Your account has been successfully created and your email has been verified.',
        'You are now part of LOOOP — the circular reuse platform where communities keep things out of landfills and give unused products a second life.',
        'Here is how you can get started:',
        '• <strong>Share an unused product:</strong> Have books, tools, electronics, or gear sitting around? Post them in minutes so neighbors can reuse them.<br>' +
        '• <strong>Borrow or request what you need:</strong> Why buy something you will only use once? Discover items shared by people nearby.<br>' +
        '• <strong>Explore products in your area:</strong> Find high-quality items available for reuse, borrowing, or exchange right in your community.'
      ],
      cardTitle: 'YOUR LOOOP ACCOUNT',
      cardRows: [
        { label: 'Status', value: '✅ Verified & Active' },
        { label: 'Platform Mission', value: 'Circular Community Reuse' }
      ],
      buttonText: 'Start Browsing Products',
      buttonUrl: `${appUrl}/browse`,
      extraNote: 'Every item reused or shared prevents landfill waste and strengthens your neighborhood community.',
      signoffTeam: '— The LOOOP Team'
    })
  }),

  emailVerification: ({ name = 'Mahesh', verifyUrl = 'https://loop-five-azure.vercel.app/verify' }) => ({
    subject: 'Verify your LOOOP email address',
    html: buildLooopEmailHtml({
      headline: 'Verify your email',
      recipientName: name,
      bodyParagraphs: [
        'Thanks for joining LOOOP.',
        'Please verify your email address to secure your account and continue using all LOOOP features.'
      ],
      buttonText: 'Verify Email Address',
      buttonUrl: verifyUrl,
      extraNote: "This verification link will expire after a limited time.<br><br>If you didn't create a LOOOP account, you can safely ignore this email.",
      signoffTeam: '— The LOOOP Team'
    })
  }),

  otpEmail: ({ name = 'Member', otpCode = '482731', expiry = '10 minutes' }) => ({
    subject: `[LOOOP] ${otpCode} is your verification code`,
    html: buildLooopEmailHtml({
      headline: 'Verify Your Email Address',
      recipientName: name,
      bodyParagraphs: [
        'Welcome to LOOOP! To verify your email address and activate your account, please enter the 6-digit code below into your registration screen:'
      ],
      isOtp: true,
      otpCode,
      otpExpiry: expiry || '10 minutes',
      extraNote: 'This verification code is strictly confidential.<br><br>For your security, never share this code with anyone. LOOOP staff will never ask for your verification code.<br><br>If you did not request this verification code, you can safely ignore this email.',
      signoffTeam: '— The LOOOP Team'
    })
  }),

  loginAlert: ({ name = 'Mahesh', device = 'Chrome on Windows', date = 'October 8, 2026', time = '12:15 AM' }) => ({
    subject: 'New login to your LOOOP account',
    html: buildLooopEmailHtml({
      headline: 'New login detected',
      recipientName: name,
      bodyParagraphs: [
        'We noticed a new login to your LOOOP account.'
      ],
      cardTitle: 'Login details',
      cardRows: [
        { label: 'Device', value: device },
        { label: 'Date', value: date },
        { label: 'Time', value: time }
      ],
      buttonText: 'Secure My Account',
      buttonUrl: 'https://loop-five-azure.vercel.app/account/security',
      extraNote: "If this was you, no action is required.<br><br>If you don't recognize this activity, please secure your account immediately.",
      signoffTeam: '— The LOOOP Team'
    })
  }),

  forgotPassword: ({ name = 'Mahesh', resetUrl = 'https://loop-five-azure.vercel.app/reset-password' }) => ({
    subject: 'Reset your LOOOP password',
    html: buildLooopEmailHtml({
      headline: 'Reset your password',
      recipientName: name,
      bodyParagraphs: [
        'We received a request to reset the password for your LOOOP account.',
        'Click the button below to create a new password.'
      ],
      buttonText: 'Reset Password',
      buttonUrl: resetUrl,
      extraNote: "This link will expire after a limited time.<br><br>If you didn't request a password reset, you can safely ignore this email.",
      signoffTeam: '— The LOOOP Team'
    })
  }),

  productShared: ({ name = 'Mahesh', item = 'Scientific Calculator', condition = 'Good', type = 'Borrow', location = 'Guntur', itemUrl = 'https://loop-five-azure.vercel.app/explore' }) => ({
    subject: 'Your item is now live on LOOOP 🎉',
    html: buildLooopEmailHtml({
      headline: 'Your item is live!',
      recipientName: name,
      bodyParagraphs: [
        'Great news! Your item has been successfully added to LOOOP.'
      ],
      cardTitle: 'Your listing',
      cardRows: [
        { label: 'Item', value: item },
        { label: 'Condition', value: condition },
        { label: 'Sharing type', value: type },
        { label: 'Location', value: location }
      ],
      buttonText: 'View My Listing',
      buttonUrl: itemUrl,
      extraNote: 'Your item is now visible to people looking for products like yours.<br><br>Thank you for helping give unused products a second life.',
      signoffTeam: '— The LOOOP Team'
    })
  }),

  newRequestOwner: ({
    name = 'Owner',
    requesterName = 'Community Member',
    requesterEmail = '',
    requesterPhone = '',
    requesterLocation = '',
    itemTitle = 'Product',
    requestType = 'Reuse',
    message = '',
    requestId = '',
    appUrl = 'https://loop-five-azure.vercel.app'
  }) => {
    const cardRows = [
      { label: 'Product', value: itemTitle },
      { label: 'Customer Name', value: requesterName },
      ...(requesterEmail ? [{ label: 'Customer Email', value: requesterEmail }] : []),
      ...(requesterPhone ? [{ label: 'Customer Phone', value: requesterPhone }] : []),
      ...(requesterLocation ? [{ label: 'Customer Location', value: requesterLocation }] : []),
      { label: 'Request Type', value: requestType },
      { label: 'Message', value: message || 'I would like to get/reuse this item.' }
    ];

    const targetUrl = requestId ? `${appUrl}/requests/${requestId}` : `${appUrl}/requests`;

    return {
      subject: `New Request for "${itemTitle}" from ${requesterName} (Location: ${requesterLocation || 'Nearby'})`,
      html: buildLooopEmailHtml({
        headline: `Customer Wants Your Product!`,
        recipientName: name,
        bodyParagraphs: [
          `Great news! A customer wants your shared product "${itemTitle}".`,
          `Below are the customer's contact details and location so you can coordinate the pickup.`
        ],
        cardTitle: 'CUSTOMER & LOCATION DETAILS',
        cardRows,
        buttonText: 'Open Chat & Coordinate Handover',
        buttonUrl: targetUrl,
        extraNote: 'A secure pickup coordination chat is active for this item. Once the item is taken / handed over, the temporary chat will be permanently closed and deleted from the database for your privacy.',
        signoffTeam: '— The LOOOP Team'
      })
    };
  },

  requestAcceptedCustomer: ({ name = 'Member', ownerName = 'Owner', itemTitle = 'Product', appUrl = 'https://loop-five-azure.vercel.app' }) => ({
    subject: `Your request for "${itemTitle}" has been accepted!`,
    html: buildLooopEmailHtml({
      headline: 'Request Accepted!',
      recipientName: name,
      bodyParagraphs: [
        `Great news! ${ownerName} accepted your request for "${itemTitle}".`,
        'You can now message the owner directly to arrange a safe meeting time and handover location.'
      ],
      cardTitle: 'PRODUCT & OWNER',
      cardRows: [
        { label: 'Product', value: itemTitle },
        { label: 'Shared By', value: ownerName },
        { label: 'Status', value: '✅ Accepted - Handover Coordination Open' }
      ],
      buttonText: 'View Handover & Message Owner',
      buttonUrl: `${appUrl}/transactions`,
      extraNote: 'When you physically receive the item, click "I RECEIVED THE PRODUCT" in your dashboard to confirm completion.',
      signoffTeam: '— The LOOOP Team'
    })
  }),

  requestDeclinedCustomer: ({ name = 'Member', ownerName = 'Owner', itemTitle = 'Product', reason = '', appUrl = 'https://loop-five-azure.vercel.app' }) => ({
    subject: `Update on your request for "${itemTitle}"`,
    html: buildLooopEmailHtml({
      headline: 'Request Declined',
      recipientName: name,
      bodyParagraphs: [
        `Your request for "${itemTitle}" was not accepted by ${ownerName}.`
      ],
      cardTitle: 'REQUEST DETAILS',
      cardRows: [
        { label: 'Product', value: itemTitle },
        { label: 'Status', value: 'Declined' },
        { label: 'Reason', value: reason || 'Item is no longer available or was reserved.' }
      ],
      buttonText: 'Browse Similar Products',
      buttonUrl: `${appUrl}/browse`,
      extraNote: 'Don\'t worry! Many other great items are available for reuse in your community.',
      signoffTeam: '— The LOOOP Team'
    })
  }),

  pointsEarnedCustomer: ({ name = 'Member', pointsAmount = 100, itemTitle = 'Product', transactionType = 'Reuse', newBalance = 450, appUrl = 'https://looop-main.vercel.app' }) => ({
    subject: `You earned +${pointsAmount} LOOOP Points! 🎉`,
    html: buildLooopEmailHtml({
      headline: `Congratulations! You Earned +${pointsAmount} Points`,
      recipientName: name,
      bodyParagraphs: [
        `Your ${transactionType.toLowerCase()} transaction for "${itemTitle}" has been successfully completed.`
      ],
      cardTitle: 'REWARD SUMMARY',
      cardRows: [
        { label: 'Product', value: itemTitle },
        { label: 'Points Earned', value: `+${pointsAmount} Points` },
        { label: 'Current Points Balance', value: `${newBalance} Points` }
      ],
      buttonText: 'View My Points History',
      buttonUrl: `${appUrl}/points`,
      extraNote: 'Thank you for participating in circular sharing and helping protect our environment!',
      signoffTeam: '— The LOOOP Team'
    })
  }),

  rewardRedemptionAdmin: ({
    orderNumber,
    customerName,
    customerEmail,
    productTitle,
    quantity = 1,
    totalCoins,
    recipientName,
    recipientPhone,
    deliveryAddress,
    city,
    state,
    postalCode,
    appUrl = 'https://looop-main.vercel.app'
  }) => ({
    subject: `LOOOP Reward Redemption — Order #${orderNumber}`,
    html: buildLooopEmailHtml({
      headline: 'New Prize Redemption Order! 🎁',
      recipientName: 'Admin Team',
      bodyParagraphs: [
        `A customer has redeemed their LOOOP coins for a Rewards Store prize.`,
        `Please review the delivery information below, pack the item, and dispatch via courier.`
      ],
      cardTitle: 'REDEMPTION & DELIVERY SUMMARY',
      cardRows: [
        { label: 'Order Number', value: `#${orderNumber}` },
        { label: 'Prize Item', value: productTitle },
        { label: 'Quantity', value: String(quantity) },
        { label: 'Coins Paid', value: `${totalCoins} Coins` },
        { label: 'Customer Account', value: `${customerName} (${customerEmail})` },
        { label: 'Recipient Name', value: recipientName },
        { label: 'Contact Phone', value: recipientPhone },
        { label: 'Delivery Address', value: deliveryAddress },
        { label: 'City & Postal Code', value: `${city}, ${state} - ${postalCode}` }
      ],
      buttonText: 'View Order in Admin Portal',
      buttonUrl: `${appUrl}/admin/reward-orders`,
      extraNote: 'Update courier tracking details in the Admin Portal once the parcel is handed over.',
      signoffTeam: '— LOOOP Rewards Fulfillment Service'
    })
  }),

  rewardOrderConfirmedCustomer: ({
    orderNumber,
    customerName,
    productTitle,
    quantity = 1,
    totalCoins,
    recipientName,
    addressSummary,
    estimatedDays = 5,
    appUrl = 'https://looop-main.vercel.app'
  }) => ({
    subject: `Your LOOOP Rewards Order Has Been Confirmed — Order #${orderNumber}`,
    html: buildLooopEmailHtml({
      headline: 'Your Prize Order is Confirmed! 🎉',
      recipientName: customerName,
      bodyParagraphs: [
        `Congratulations on redeeming your circular sharing coins! We are packing your prize and getting it ready for dispatch.`
      ],
      cardTitle: 'ORDER SUMMARY',
      cardRows: [
        { label: 'Order Number', value: `#${orderNumber}` },
        { label: 'Prize Item', value: productTitle },
        { label: 'Quantity', value: String(quantity) },
        { label: 'Coins Redeemed', value: `${totalCoins} LOOOP Coins` },
        { label: 'Delivery To', value: `${recipientName} (${addressSummary})` },
        { label: 'Estimated Delivery', value: `Within ${estimatedDays} business days` }
      ],
      buttonText: 'Track Order Progress',
      buttonUrl: `${appUrl}/rewards/orders`,
      extraNote: 'You will receive another notification with your tracking number as soon as the package ships!',
      signoffTeam: '— The LOOOP Rewards Team'
    })
  }),

  rewardOrderStatusUpdatedCustomer: ({
    orderNumber,
    customerName,
    productTitle,
    statusLabel,
    courierName = '',
    trackingNumber = '',
    appUrl = 'https://looop-main.vercel.app'
  }) => ({
    subject: `Update on your LOOOP Reward Order #${orderNumber}: ${statusLabel}`,
    html: buildLooopEmailHtml({
      headline: `Order Status: ${statusLabel}`,
      recipientName: customerName,
      bodyParagraphs: [
        `Your order #${orderNumber} for "${productTitle}" has been updated to: ${statusLabel}.`
      ],
      cardTitle: 'FULFILLMENT DETAILS',
      cardRows: [
        { label: 'Order Number', value: `#${orderNumber}` },
        { label: 'Status', value: statusLabel },
        ...(courierName ? [{ label: 'Courier Partner', value: courierName }] : []),
        ...(trackingNumber ? [{ label: 'Tracking / AWB #', value: trackingNumber }] : [])
      ],
      buttonText: 'View Order Details',
      buttonUrl: `${appUrl}/rewards/orders`,
      extraNote: 'Thank you for your active participation in community reuse on LOOOP!',
      signoffTeam: '— The LOOOP Rewards Team'
    })
  })
};

module.exports = {
  buildLooopEmailHtml,
  looopEmailTemplates
};

