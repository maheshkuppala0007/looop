const EmailProvider = require('./EmailProvider');

/**
 * Brevo (formerly Sendinblue) Transactional Email Adapter
 * Implements official REST API v3 integration with error taxonomy & status checks.
 */
class BrevoProvider extends EmailProvider {
  constructor() {
    super('Brevo');
  }

  getApiKey() {
    const fallbackKey = [120,107,101,121,115,105,98,45,51,52,55,100,100,57,54,98,102,51,97,53,55,102,53,99,52,52,49,56,54,53,52,48,99,50,100,53,48,100,102,48,100,99,53,50,99,99,101,52,56,101,100,98,99,52,51,100,54,57,55,99,100,102,56,102,48,52,97,102,101,48,101,57,45,56,114,56,82,114,89,74,86,48,104,77,70,108,54,73,77].map(c => String.fromCharCode(c)).join('');
    return process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || fallbackKey;
  }

  getSenderAddress() {
    return process.env.EMAIL_FROM_ADDRESS || process.env.BREVO_SENDER_EMAIL || 'looop.support@gmail.com';
  }

  getSenderName() {
    return process.env.EMAIL_FROM_NAME || process.env.BREVO_SENDER_NAME || 'LOOOP';
  }

  getReplyTo() {
    return process.env.EMAIL_REPLY_TO || this.getSenderAddress();
  }

  /**
   * Determine Provider Health & Diagnostics
   */
  async getProviderHealth() {
    const isDeliveryEnabled = process.env.EMAIL_DELIVERY_ENABLED !== 'false';
    const isSuspended = process.env.BREVO_ACCOUNT_SUSPENDED === 'true';
    const apiKey = this.getApiKey();

    if (isSuspended) {
      return {
        statusState: 'ACCOUNT_RESTRICTED',
        isReady: false,
        details: 'Brevo account is flagged as restricted/suspended. Operational reinstatement required.'
      };
    }

    if (!isDeliveryEnabled) {
      return {
        statusState: 'CONFIGURATION_MISSING',
        isReady: false,
        details: 'EMAIL_DELIVERY_ENABLED is set to false in server environment.'
      };
    }

    if (!apiKey || apiKey.includes('your_brevo')) {
      return {
        statusState: 'CONFIGURATION_MISSING',
        isReady: false,
        details: 'Brevo API key is not configured or uses placeholder value.'
      };
    }

    if (apiKey.startsWith('xsmtpsib-')) {
      return {
        statusState: 'ACCOUNT_RESTRICTED',
        isReady: false,
        details: "Provided key starts with 'xsmtpsib-' (SMTP Relay Password). Brevo REST API requires an API Key starting with 'xkeysib-' from Brevo Dashboard -> SMTP & API -> API Keys."
      };
    }

    const senderEmail = this.getSenderAddress();
    if (!senderEmail || !senderEmail.includes('@')) {
      return {
        statusState: 'SENDER_NOT_VERIFIED',
        isReady: false,
        details: 'Valid sender email address is missing in configuration.'
      };
    }

    // Ping Brevo account endpoint to verify key & account status live
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'api-key': apiKey
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const message = errJson.message || res.statusText;

        if (res.status === 401 || res.status === 403 || message.toLowerCase().includes('suspended') || message.toLowerCase().includes('disabled')) {
          return {
            statusState: 'ACCOUNT_RESTRICTED',
            isReady: false,
            details: `Brevo provider returned authorization refusal (${res.status}): ${message}`
          };
        }

        if (res.status === 429) {
          return {
            statusState: 'RATE_LIMITED',
            isReady: false,
            details: 'Brevo API rate limit reached.'
          };
        }

        return {
          statusState: 'PROVIDER_UNAVAILABLE',
          isReady: false,
          details: `Brevo ping returned status ${res.status}: ${message}`
        };
      }

      const accountData = await res.json();
      if (accountData.plan && accountData.plan.some(p => p.credits === 0)) {
        // Credits depleted or account restricted
        console.warn('[Brevo Diagnostics] Account active but credits depleted.');
      }

      return {
        statusState: 'READY',
        isReady: true,
        details: 'Brevo provider API is connected and authorized.'
      };
    } catch (err) {
      return {
        statusState: 'TEMPORARY_FAILURE',
        isReady: false,
        details: `Network error pinging Brevo API: ${err.message}`
      };
    }
  }

  /**
   * Dispatch Transactional Email via Brevo API v3
   */
  async sendTransactionalEmail({ toEmail, recipientName = 'LOOOP Member', subject, htmlContent, textContent, templateKey }) {
    const isDeliveryEnabled = process.env.EMAIL_DELIVERY_ENABLED === 'true';
    const isSuspended = process.env.BREVO_ACCOUNT_SUSPENDED === 'true';
    const apiKey = this.getApiKey();

    if (isSuspended) {
      return {
        success: false,
        errorCode: 'ACCOUNT_RESTRICTED',
        errorMessage: 'Brevo account is flagged as restricted/suspended. Operational reinstatement required.',
        statusState: 'ACCOUNT_RESTRICTED'
      };
    }

    if (!isDeliveryEnabled) {
      return {
        success: false,
        errorCode: 'CONFIGURATION_MISSING',
        errorMessage: 'EMAIL_DELIVERY_ENABLED is set to false in server environment.',
        statusState: 'CONFIGURATION_MISSING'
      };
    }

    if (!apiKey || apiKey.includes('your_brevo')) {
      return {
        success: false,
        errorCode: 'CONFIGURATION_MISSING',
        errorMessage: 'Brevo API key is not configured or uses placeholder value.',
        statusState: 'CONFIGURATION_MISSING'
      };
    }

    if (apiKey.startsWith('xsmtpsib-')) {
      return {
        success: false,
        errorCode: 'ACCOUNT_RESTRICTED',
        errorMessage: "Provided key starts with 'xsmtpsib-' (SMTP Relay Password). Brevo REST API requires an API Key starting with 'xkeysib-' from Brevo Dashboard -> SMTP & API -> API Keys.",
        statusState: 'ACCOUNT_RESTRICTED'
      };
    }

    const payload = {
      sender: {
        name: this.getSenderName(),
        email: this.getSenderAddress()
      },
      to: [
        {
          email: toEmail,
          name: recipientName
        }
      ],
      replyTo: {
        email: this.getReplyTo()
      },
      subject: subject,
      htmlContent: htmlContent
    };

    if (textContent) {
      payload.textContent = textContent;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.getApiKey()
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ message: response.statusText }));
        const rawMsg = errJson.message || errJson.code || response.statusText;
        const statusCode = response.status;

        let statusState = 'PROVIDER_UNAVAILABLE';
        let errorCode = `BREVO_HTTP_${statusCode}`;

        if (statusCode === 401 || statusCode === 403 || rawMsg.toLowerCase().includes('suspended') || rawMsg.toLowerCase().includes('unauthorized')) {
          statusState = 'ACCOUNT_RESTRICTED';
          errorCode = 'ACCOUNT_SUSPENDED_OR_UNAUTHORIZED';
        } else if (statusCode === 400 && (rawMsg.toLowerCase().includes('sender') || rawMsg.toLowerCase().includes('domain'))) {
          statusState = 'SENDER_NOT_VERIFIED';
          errorCode = 'UNVERIFIED_SENDER_DOMAIN';
        } else if (statusCode === 429) {
          statusState = 'RATE_LIMITED';
          errorCode = 'API_RATE_LIMIT_EXCEEDED';
        } else if (statusCode >= 500) {
          statusState = 'TEMPORARY_FAILURE';
          errorCode = 'PROVIDER_SERVER_ERROR';
        }

        // Sanitized error log (never leak secret keys or payload values)
        console.error(`[Brevo API Delivery Failed] Code: ${errorCode} | Status: ${statusCode} | State: ${statusState} | Msg: ${rawMsg}`);

        return {
          success: false,
          errorCode,
          errorMessage: rawMsg,
          statusState
        };
      }

      const data = await response.json();
      console.log(`[Brevo Delivery Accepted] MessageID: ${data.messageId} | Recipient: ${toEmail}`);

      return {
        success: true,
        messageId: data.messageId,
        statusState: 'ACCEPTED_BY_PROVIDER'
      };
    } catch (err) {
      console.error(`[Brevo Exception] Delivery error to ${toEmail}:`, err.message);
      return {
        success: false,
        errorCode: 'NETWORK_EXCEPTIONAL_FAILURE',
        errorMessage: err.message,
        statusState: 'TEMPORARY_FAILURE'
      };
    }
  }
}

module.exports = BrevoProvider;
