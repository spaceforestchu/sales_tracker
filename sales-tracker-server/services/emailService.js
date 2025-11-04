const nodemailer = require('nodemailer');

// Create transporter for Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // App-specific password from Gmail
    }
  });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetUrl, userName) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `Sales Tracker <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request - Sales Tracker',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
              border-radius: 10px;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              padding: 20px;
              background-color: white;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4CAF50;
              color: white !important;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: 600;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sales Tracker</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Hi ${userName || 'User'},</p>
              <p>We received a request to reset your password for your Sales Tracker account.</p>
              <p>Click the button below to reset your password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
                ${resetUrl}
              </p>
              <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
              <p>If you didn't request a password reset, please ignore this email. Your password won't be changed.</p>
              <div class="footer">
                <p>This is an automated email from Sales Tracker. Please do not reply.</p>
                <p>For security reasons, this password reset link will expire in 1 hour.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Password Reset Request - Sales Tracker

      Hi ${userName || 'User'},

      We received a request to reset your password for your Sales Tracker account.

      To reset your password, click the following link:
      ${resetUrl}

      This link will expire in 1 hour for security reasons.

      If you didn't request a password reset, please ignore this email. Your password won't be changed.

      This is an automated email from Sales Tracker. Please do not reply.
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail
};