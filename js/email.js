/**
 * email.js — Automated Premium Email Confirmation Coordinator
 *
 * Configured via .env SMTP credentials.
 * Automatically falls back to mock console-logging if SMTP settings are missing,
 * ensuring registration NEVER crashes due to email network or setup issues.
 */

const nodemailer = require('nodemailer');

const isMailConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter = null;

if (isMailConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Verify connection configuration on startup
  transporter.verify((err, success) => {
    if (err) {
      console.warn('⚠️  SMTP Transporter verification failed. Please verify credentials in .env:', err.message);
    } else {
      console.log('✅ SMTP Transporter connected. Automatic email receipts enabled.');
    }
  });
} else {
  console.log('ℹ️  SMTP credentials not configured. Email confirmations will run in Mock Mode (logged to console).');
}

/**
 * Sends a confirmation email to the participant with their entry details.
 * Runs asynchronously and catches errors internally so it never blocks the HTTP response.
 *
 * @param {string} toEmail - Participant's email address
 * @param {Object} details - Participant's details (name, phone, tier, amount, payment_id, solution)
 */
async function sendConfirmationEmail(toEmail, details) {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const fromName = process.env.SMTP_FROM_NAME || 'Xeliance Power';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@xeliancepower.com';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contest Registration Confirmed</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #0A0A0F;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #F5F5F0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #12121A;
          border: 1px solid rgba(212, 160, 23, 0.35);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 0 30px rgba(212, 160, 23, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #161622, #0A0A0F);
          padding: 30px 20px;
          text-align: center;
          border-bottom: 1px solid rgba(212, 160, 23, 0.2);
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #FFD700;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          color: #FFF1A8;
          margin-bottom: 20px;
          font-weight: 600;
        }
        .intro-text {
          font-size: 15px;
          line-height: 1.6;
          color: #9E9E9E;
          margin-bottom: 30px;
        }
        .receipt-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(212, 160, 23, 0.15);
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 30px;
        }
        .receipt-title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #D4A017;
          margin-bottom: 16px;
          font-weight: 700;
        }
        .receipt-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .receipt-item {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          padding-bottom: 8px;
        }
        .receipt-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .receipt-label {
          color: #9E9E9E;
        }
        .receipt-value {
          color: #F5F5F0;
          font-weight: 600;
        }
        .solution-card {
          background: rgba(212, 160, 23, 0.04);
          border: 1px dashed rgba(212, 160, 23, 0.25);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .solution-title {
          font-size: 14px;
          color: #FFD700;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .solution-body {
          font-size: 14px;
          line-height: 1.7;
          color: #E2E2D9;
          font-style: italic;
          margin: 0;
          white-space: pre-wrap;
        }
        .footer {
          background: #0A0A0F;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #6C6C6C;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }
        .footer a {
          color: #D4A017;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>XELIANCE POWER</h1>
        </div>
        <div class="content">
          <div class="greeting">Hi ${details.name},</div>
          <div class="intro-text">
            Your registration for the <strong>Environmental Stewardship Challenge</strong> has been securely logged! 
            Thank you for participating and contributing your innovative strategy. Below is your official transaction receipt and submission copy.
          </div>
          
          <div class="receipt-card">
            <div class="receipt-title">Registration Receipt</div>
            <div class="receipt-grid">
              <div class="receipt-item">
                <span class="receipt-label">Participant Name</span>
                <span class="receipt-value">${details.name}</span>
              </div>
              <div class="receipt-item">
                <span class="receipt-label">Registered Phone</span>
                <span class="receipt-value">${details.phone}</span>
              </div>
              <div class="receipt-item">
                <span class="receipt-label">Entry Option</span>
                <span class="receipt-value">${details.tier}</span>
              </div>
              <div class="receipt-item">
                <span class="receipt-label">Amount Paid</span>
                <span class="receipt-value">₹${Number(details.amount).toLocaleString('en-IN')}</span>
              </div>
              <div class="receipt-item">
                <span class="receipt-label">Payment Reference ID</span>
                <span class="receipt-value" style="font-family: monospace;">${details.payment_id}</span>
              </div>
              <div class="receipt-item">
                <span class="receipt-label">Date & Time</span>
                <span class="receipt-value">${dateStr}</span>
              </div>
              <div class="receipt-item">
                <span class="receipt-label">Registration Status</span>
                <span class="receipt-value" style="color: #4CAF50;">Captured & Verified</span>
              </div>
            </div>
          </div>

          <div class="solution-card">
            <div class="solution-title">Your Submitted Strategy</div>
            <p class="solution-body">${details.solution}</p>
          </div>

          <div class="intro-text" style="margin-bottom: 0;">
            Our expert jury panel is currently reviewing all entries on merit. You can check the live status of your entry or download updates at any time by visiting our <a href="https://xeliancepower.com/status.html" style="color: #FFD700; text-decoration: underline;">Status Portal</a>.
          </div>
        </div>
        <div class="footer">
          © 2025 Xeliance Power. All rights reserved.<br>
          Licensed Real Estate Company · Jaipur, Rajasthan, India.<br>
          For queries, contact <a href="mailto:ar.aadityasharma@gmail.com">ar.aadityasharma@gmail.com</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: 'Contest Entry Confirmation — Xeliance Power',
    html: htmlContent
  };

  if (isMailConfigured && transporter) {
    try {
      console.log(`✉️ Sending confirmation email to ${toEmail}...`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`❌ Failed to send SMTP email to ${toEmail}:`, err.message);
      return { success: false, error: err.message };
    }
  } else {
    // Mock logger fallback
    console.log(`------------------------------------------------------------`);
    console.log(`[MOCK EMAIL SENT]`);
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Body Details:`);
    console.log(`  Name: ${details.name}`);
    console.log(`  Tier: ${details.tier} (Paid ₹${details.amount})`);
    console.log(`  Payment ID: ${details.payment_id}`);
    console.log(`  Solution Strategy: "${details.solution}"`);
    console.log(`------------------------------------------------------------`);
    return { success: true, mock: true };
  }
}

module.exports = { sendConfirmationEmail };
