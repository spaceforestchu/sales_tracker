const express = require('express');
const router = express.Router();
const { interactiveLogin, hasSavedCookies, clearCookies, saveSessionToDb, loadSessionFromDb } = require('../services/linkedinAuth');
const auth = require('../middleware/auth');
const adminAuth = auth.adminAuth;

/**
 * POST /api/linkedin-auth/login
 * Interactive LinkedIn login - opens browser for manual login
 * Admin only - should be called once to authenticate
 */
router.post('/login', auth, adminAuth, async (req, res) => {
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
router.get('/status', auth, async (req, res) => {
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
 * POST /api/linkedin-auth/upload-cookies
 * Manually upload LinkedIn session (cookies + userAgent + platform)
 * Saves to database for the authenticated user
 * Admin only
 */
router.post('/upload-cookies', auth, adminAuth, async (req, res) => {
  try {
    const { cookies, userAgent, platform } = req.body;
    const userId = req.user.id; // Get authenticated user's ID

    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ error: 'Invalid cookies format. Expected array of cookie objects.' });
    }

    // Save session to database for this user
    await saveSessionToDb(userId, cookies, userAgent, platform);

    // Also save to file for backward compatibility / local dev
    const fs = require('fs').promises;
    const path = require('path');
    const cacheDir = path.join(__dirname, '../.cache');
    const COOKIES_PATH = path.join(cacheDir, 'linkedin-cookies.json');
    const SESSION_PATH = path.join(cacheDir, 'linkedin-session.json');

    try {
      await fs.mkdir(cacheDir, { recursive: true });

      const sessionData = {
        cookies,
        userAgent: userAgent || null,
        platform: platform || null,
        savedAt: new Date().toISOString()
      };

      await fs.writeFile(SESSION_PATH, JSON.stringify(sessionData, null, 2));
      await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    } catch (fileError) {
      // File save is optional, don't fail if it errors
      console.log('ℹ️  Could not save to file cache (not critical):', fileError.message);
    }

    res.json({
      success: true,
      message: 'LinkedIn session uploaded successfully',
      cookieCount: cookies.length,
      hasUserAgent: !!userAgent,
      hasPlatform: !!platform,
      userId: userId
    });
  } catch (error) {
    console.error('Error uploading session:', error);
    res.status(500).json({ error: 'Error uploading session: ' + error.message });
  }
});

/**
 * DELETE /api/linkedin-auth/logout
 * Clear saved LinkedIn cookies
 * Admin only
 */
router.delete('/logout', auth, adminAuth, async (req, res) => {
  try {
    const result = await clearCookies();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error clearing cookies' });
  }
});

module.exports = router;
