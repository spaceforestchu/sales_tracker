const pool = require('../db/dbConfig');
const crypto = require('crypto');

// Create a new password reset token
const createResetToken = async (userId) => {
  try {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Insert the token into database
    const query = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await pool.query(query, [userId, token, expiresAt]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating reset token:', error);
    throw error;
  }
};

// Get valid reset token
const getValidResetToken = async (token) => {
  try {
    const query = `
      SELECT prt.*, u.name, u.email, u.id as user_id
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = $1
        AND prt.expires_at > NOW()
        AND prt.used = false
    `;

    const result = await pool.query(query, [token]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting reset token:', error);
    throw error;
  }
};

// Mark token as used
const markTokenAsUsed = async (tokenId) => {
  try {
    const query = `
      UPDATE password_reset_tokens
      SET used = true, used_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [tokenId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error marking token as used:', error);
    throw error;
  }
};

// Clean up expired tokens (optional maintenance)
const cleanupExpiredTokens = async () => {
  try {
    const query = `
      DELETE FROM password_reset_tokens
      WHERE expires_at < NOW()
        OR (used = true AND used_at < NOW() - INTERVAL '7 days')
    `;

    const result = await pool.query(query);
    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    throw error;
  }
};

// Check if user has recent reset request (rate limiting)
const hasRecentResetRequest = async (userId, minutesAgo = 5) => {
  try {
    const query = `
      SELECT COUNT(*)
      FROM password_reset_tokens
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '${minutesAgo} minutes'
    `;

    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error checking recent reset requests:', error);
    throw error;
  }
};

module.exports = {
  createResetToken,
  getValidResetToken,
  markTokenAsUsed,
  cleanupExpiredTokens,
  hasRecentResetRequest
};