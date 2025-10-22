const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const pool = require('../db/dbConfig');
const { getPuppeteerConfig } = require('../utils/puppeteerConfig');

const COOKIES_PATH = path.join(__dirname, '../.cache/linkedin-cookies.json');
const SESSION_PATH = path.join(__dirname, '../.cache/linkedin-session.json');

/**
 * Interactive login to LinkedIn - launches visible browser for manual login
 * Call this once to authenticate and save cookies
 */
const interactiveLogin = async () => {
  let browser = null;

  try {
    console.log('🌐 Launching browser for interactive LinkedIn login...');

    // Get platform-aware browser configuration (NON-headless for interactive login)
    const browserConfig = getPuppeteerConfig(false);

    // Launch in NON-headless mode so you can see and interact
    browser = await puppeteer.launch(browserConfig);

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📱 Navigating to LinkedIn login page...');
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('⏳ Please log in manually in the browser window...');
    console.log('   - Enter your email and password');
    console.log('   - Solve any CAPTCHAs');
    console.log('   - Complete any security verifications');
    console.log('   - Wait until you see your LinkedIn feed');

    // Wait for user to manually log in
    // We'll wait until they navigate away from login page
    await page.waitForFunction(
      () => !window.location.href.includes('/login'),
      { timeout: 300000 } // 5 minutes to log in manually
    );

    console.log('✅ Login detected! Waiting a few seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Save cookies
    const cookies = await page.cookies();

    // Get User-Agent and platform
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const platform = await page.evaluate(() => navigator.platform);

    // Save session data (cookies + metadata)
    const sessionData = {
      cookies,
      userAgent,
      platform,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(SESSION_PATH, JSON.stringify(sessionData, null, 2));
    // Keep the old format for backwards compatibility
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));

    console.log('💾 Session saved successfully!');
    console.log(`   Saved to: ${SESSION_PATH}`);
    console.log(`   Cookies: ${cookies.length}`);
    console.log(`   User-Agent: ${userAgent.substring(0, 50)}...`);

    await browser.close();

    return {
      success: true,
      message: 'LinkedIn authentication successful! Session saved.',
      cookieCount: cookies.length
    };

  } catch (error) {
    console.error('❌ Interactive login error:', error.message);

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Save LinkedIn session to database for a specific user
 */
const saveSessionToDb = async (userId, cookies, userAgent, platform) => {
  try {
    // Calculate expiration (1 year from now - typical LinkedIn session lifetime)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const query = `
      INSERT INTO linkedin_sessions (user_id, cookies, user_agent, platform, expires_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        cookies = EXCLUDED.cookies,
        user_agent = EXCLUDED.user_agent,
        platform = EXCLUDED.platform,
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      JSON.stringify(cookies),
      userAgent,
      platform,
      expiresAt
    ]);

    console.log(`✅ Saved LinkedIn session to database for user ${userId}`);
    console.log(`   Cookies: ${cookies.length}`);
    console.log(`   User-Agent: ${userAgent ? userAgent.substring(0, 50) + '...' : 'N/A'}`);

    return result.rows[0];
  } catch (error) {
    console.error('❌ Error saving session to database:', error.message);
    throw error;
  }
};

/**
 * Load LinkedIn session from database for a specific user
 */
const loadSessionFromDb = async (userId) => {
  try {
    const query = `
      SELECT * FROM linkedin_sessions
      WHERE user_id = $1
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log(`ℹ️  No LinkedIn session found for user ${userId}`);
      return null;
    }

    const session = result.rows[0];
    const cookies = JSON.parse(session.cookies);

    console.log(`✅ Loaded LinkedIn session from database for user ${userId}`);
    console.log(`   Cookies: ${cookies.length}`);
    console.log(`   User-Agent: ${session.user_agent ? session.user_agent.substring(0, 50) + '...' : 'N/A'}`);

    return {
      cookies,
      userAgent: session.user_agent,
      platform: session.platform,
      savedAt: session.created_at,
      updatedAt: session.updated_at
    };
  } catch (error) {
    console.error('❌ Error loading session from database:', error.message);
    return null;
  }
};

/**
 * Load saved LinkedIn session (cookies + metadata)
 * Returns null if no session file exists
 * @param {number} userId - Optional user ID to load session for specific user (database)
 */
const loadSession = async (userId = null) => {
  // If userId provided, try database first
  if (userId) {
    const dbSession = await loadSessionFromDb(userId);
    if (dbSession) {
      return dbSession;
    }
  }

  // Fallback to file-based session (for backward compatibility / local dev)
  try {
    const sessionString = await fs.readFile(SESSION_PATH, 'utf8');
    const session = JSON.parse(sessionString);
    console.log(`✅ Loaded LinkedIn session from file cache`);
    console.log(`   Cookies: ${session.cookies?.length || 0}`);
    console.log(`   User-Agent: ${session.userAgent ? session.userAgent.substring(0, 50) + '...' : 'N/A'}`);
    return session;
  } catch (error) {
    // Fallback to old cookies-only format
    try {
      const cookiesString = await fs.readFile(COOKIES_PATH, 'utf8');
      const cookies = JSON.parse(cookiesString);
      console.log(`✅ Loaded ${cookies.length} LinkedIn cookies from file cache (old format)`);
      return { cookies, userAgent: null, platform: null };
    } catch {
      console.log('ℹ️  No saved LinkedIn session found');
      return null;
    }
  }
};

/**
 * Load saved LinkedIn cookies (for backwards compatibility)
 * Returns null if no cookies file exists
 * @param {number} userId - Optional user ID to load cookies for specific user
 */
const loadCookies = async (userId = null) => {
  const session = await loadSession(userId);
  return session?.cookies || null;
};

/**
 * Get saved User-Agent
 * @param {number} userId - Optional user ID to get User-Agent for specific user
 */
const getUserAgent = async (userId = null) => {
  const session = await loadSession(userId);
  return session?.userAgent || null;
};

/**
 * Apply saved cookies to a Puppeteer page
 */
const applyCookies = async (page, cookies) => {
  if (!cookies || cookies.length === 0) {
    return false;
  }

  try {
    await page.setCookie(...cookies);
    console.log(`✅ Applied ${cookies.length} cookies to page`);
    return true;
  } catch (error) {
    console.error('❌ Error applying cookies:', error.message);
    return false;
  }
};

/**
 * Check if we have valid saved cookies
 */
const hasSavedCookies = async () => {
  try {
    await fs.access(COOKIES_PATH);
    return true;
  } catch {
    return false;
  }
};

/**
 * Clear saved cookies and session
 */
const clearCookies = async () => {
  try {
    // Clear both session and cookies files
    const promises = [
      fs.unlink(SESSION_PATH).catch(() => {}),
      fs.unlink(COOKIES_PATH).catch(() => {})
    ];
    await Promise.all(promises);
    console.log('✅ LinkedIn session and cookies cleared');
    return { success: true, message: 'Session and cookies cleared' };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true, message: 'No session to clear' };
    }
    throw error;
  }
};

module.exports = {
  interactiveLogin,
  loadCookies,
  loadSession,
  loadSessionFromDb,
  saveSessionToDb,
  getUserAgent,
  applyCookies,
  hasSavedCookies,
  clearCookies
};
