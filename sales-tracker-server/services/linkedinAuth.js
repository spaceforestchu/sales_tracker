const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
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
 * Load saved LinkedIn session (cookies + metadata)
 * Returns null if no session file exists
 */
const loadSession = async () => {
  try {
    const sessionString = await fs.readFile(SESSION_PATH, 'utf8');
    const session = JSON.parse(sessionString);
    console.log(`✅ Loaded LinkedIn session from cache`);
    console.log(`   Cookies: ${session.cookies?.length || 0}`);
    console.log(`   User-Agent: ${session.userAgent ? session.userAgent.substring(0, 50) + '...' : 'N/A'}`);
    return session;
  } catch (error) {
    // Fallback to old cookies-only format
    try {
      const cookiesString = await fs.readFile(COOKIES_PATH, 'utf8');
      const cookies = JSON.parse(cookiesString);
      console.log(`✅ Loaded ${cookies.length} LinkedIn cookies from cache (old format)`);
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
 */
const loadCookies = async () => {
  const session = await loadSession();
  return session?.cookies || null;
};

/**
 * Get saved User-Agent
 */
const getUserAgent = async () => {
  const session = await loadSession();
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
  getUserAgent,
  applyCookies,
  hasSavedCookies,
  clearCookies
};
