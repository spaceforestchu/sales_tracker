const bcrypt = require('bcrypt');
const userQueries = require('../queries/userQueries');
const passwordResetQueries = require('../queries/passwordResetQueries');
const emailService = require('../services/emailService');

// Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Get user by email
    const user = await userQueries.getUserByEmail(email);

    // Always return success message to prevent email enumeration
    // Even if user doesn't exist, we return success
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.json({
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      console.log(`Password reset requested for deactivated account: ${email}`);
      return res.json({
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Check for rate limiting - prevent spam
    const hasRecent = await passwordResetQueries.hasRecentResetRequest(user.id, 5);
    if (hasRecent) {
      console.log(`Rate limit hit for password reset: ${email}`);
      return res.status(429).json({
        error: 'Please wait a few minutes before requesting another password reset.'
      });
    }

    // Create reset token
    const resetToken = await passwordResetQueries.createResetToken(user.id);

    // Construct reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken.token}`;

    // Send email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetUrl, user.name);
      console.log(`Password reset email sent to: ${email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't expose email sending failures to user
      return res.status(500).json({
        error: 'Failed to send password reset email. Please try again later.'
      });
    }

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Error processing password reset request' });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate input
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength (optional)
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Get valid reset token
    const resetToken = await passwordResetQueries.getValidResetToken(token);

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid or expired password reset token. Please request a new one.'
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user's password
    const query = `
      UPDATE users
      SET password = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, email
    `;
    const pool = require('../db/dbConfig');
    const result = await pool.query(query, [hashedPassword, resetToken.user_id]);
    const updatedUser = result.rows[0];

    // Mark token as used
    await passwordResetQueries.markTokenAsUsed(resetToken.id);

    console.log(`Password successfully reset for user: ${updatedUser.email}`);

    res.json({
      message: 'Password has been successfully reset. You can now login with your new password.',
      success: true
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
};

// Validate reset token (check if token is valid without using it)
const validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Check if token is valid
    const resetToken = await passwordResetQueries.getValidResetToken(token);

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid or expired password reset token',
        valid: false
      });
    }

    res.json({
      valid: true,
      email: resetToken.email,
      name: resetToken.name,
      message: 'Token is valid'
    });

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Error validating token' });
  }
};

module.exports = {
  requestPasswordReset,
  resetPassword,
  validateResetToken
};