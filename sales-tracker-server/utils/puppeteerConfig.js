const path = require('path');
const os = require('os');

/**
 * Get Puppeteer browser configuration that works across environments
 * - On Render (Linux): uses cached Chrome binary
 * - On local macOS: lets Puppeteer use system Chrome or download its own
 * - On local Linux: lets Puppeteer handle it
 */
function getPuppeteerConfig(headless = true) {
  const isRender = process.env.RENDER === 'true';
  const platform = os.platform();

  const config = {
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // Hide webdriver flag
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
    ]
  };

  // On Render or when explicitly set, use the configured path
  if (isRender || process.env.PUPPETEER_EXECUTABLE_PATH) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      path.join(__dirname, '../.cache/puppeteer/chrome/linux-141.0.7390.78/chrome-linux64/chrome');

    config.executablePath = executablePath;

    // Add memory optimization args for Render
    config.args.push(
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-notifications'
    );

    console.log(`🚀 Using configured Chrome at: ${executablePath}`);
  } else {
    // Local development - let Puppeteer use default browser
    console.log(`💻 Local development (${platform}): Using Puppeteer's default browser`);
  }

  return config;
}

module.exports = { getPuppeteerConfig };
