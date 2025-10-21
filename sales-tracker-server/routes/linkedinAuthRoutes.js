const express = require('express');
const router = express.Router();
const { interactiveLogin, hasSavedCookies, clearCookies } = require('../services/linkedinAuth');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

/**
 * POST /api/linkedin-auth/login
 * Interactive LinkedIn login - opens browser for manual login
 * Admin only - should be called once to authenticate
 */
router.post('/login', verifyToken, verifyAdmin, async (req, res) => {
  try {
    console.log('🔐 Starting interactive LinkedIn login...');
    const result = await interactiveLogin();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        cookieCount: result.cookieCount
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('LinkedIn auth route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete LinkedIn authentication'
    });
  }
});

/**
 * GET /api/linkedin-auth/status
 * Check if we have saved LinkedIn cookies
 */
router.get('/status', verifyToken, async (req, res) => {
  try {
    const hasAuth = await hasSavedCookies();
    res.json({
      authenticated: hasAuth,
      message: hasAuth
        ? 'LinkedIn cookies are saved and ready to use'
        : 'No LinkedIn authentication found. Admin needs to authenticate.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error checking authentication status' });
  }
});

/**
 * DELETE /api/linkedin-auth/logout
 * Clear saved LinkedIn cookies
 * Admin only
 */
router.delete('/logout', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await clearCookies();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error clearing cookies' });
  }
});

module.exports = router;
