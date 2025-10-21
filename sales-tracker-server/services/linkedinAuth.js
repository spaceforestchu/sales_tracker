const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

const COOKIES_PATH = path.join(__dirname, '../.cache/linkedin-cookies.json');

/**
 * Interactive login to LinkedIn - launches visible browser for manual login
 * Call this once to authenticate and save cookies
 */
const interactiveLogin = async () => {
  let browser = null;

  try {
    console.log('🌐 Launching browser for interactive LinkedIn login...');

    // Get the executable path
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      path.join(__dirname, '../.cache/puppeteer/chrome/linux-141.0.7390.78/chrome-linux64/chrome');

    // Launch in NON-headless mode so you can see and interact
    browser = await puppeteer.launch({
      headless: false, // Visible browser!
      executablePath: executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1920,1080'
      ]
    });

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
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));

    console.log('💾 Cookies saved successfully!');
    console.log(`   Saved to: ${COOKIES_PATH}`);
    console.log('   These cookies will be used for future scraping.');

    await browser.close();

    return {
      success: true,
      message: 'LinkedIn authentication successful! Cookies saved.',
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
 * Load saved LinkedIn cookies
 * Returns null if no cookies file exists
 */
const loadCookies = async () => {
  try {
    const cookiesString = await fs.readFile(COOKIES_PATH, 'utf8');
    const cookies = JSON.parse(cookiesString);
    console.log(`✅ Loaded ${cookies.length} LinkedIn cookies from cache`);
    return cookies;
  } catch (error) {
    console.log('ℹ️  No saved LinkedIn cookies found');
    return null;
  }
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
 * Clear saved cookies
 */
const clearCookies = async () => {
  try {
    await fs.unlink(COOKIES_PATH);
    console.log('✅ LinkedIn cookies cleared');
    return { success: true, message: 'Cookies cleared' };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true, message: 'No cookies to clear' };
    }
    throw error;
  }
};

module.exports = {
  interactiveLogin,
  loadCookies,
  applyCookies,
  hasSavedCookies,
  clearCookies
};
