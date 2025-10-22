const puppeteer = require('puppeteer');
const path = require('path');
const { loadCookies, loadSession, applyCookies } = require('./linkedinAuth');
const { getPuppeteerConfig } = require('../utils/puppeteerConfig');
const { parseSalary } = require('../utils/salaryParser');

// Scrape job details from various job posting websites using Puppeteer
const scrapeJobPosting = async (url, userId = null) => {
  let browser = null;

  try {
    // Detect which site the URL is from
    const site = detectJobSite(url);

    // Get platform-aware browser configuration
    const browserConfig = getPuppeteerConfig(true);

    // Launch browser with platform-specific settings
    browser = await puppeteer.launch(browserConfig);

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Load session if LinkedIn (to get matching User-Agent)
    let userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    if (site === 'linkedin') {
      const session = await loadSession(userId);
      if (session) {
        // Use the exact same User-Agent that was used when cookies were created
        if (session.userAgent) {
          userAgent = session.userAgent;
          console.log(`✅ Using saved User-Agent: ${userAgent.substring(0, 50)}...`);
        }

        await applyCookies(page, session.cookies);
        console.log(userId ? `✅ Using LinkedIn session for user ${userId}` : '✅ Using saved LinkedIn session');
      } else {
        throw new Error('LinkedIn authentication required. Please upload your LinkedIn cookies at /linkedin-auth.html');
      }
    }

    // Set user agent (use stored one for LinkedIn, default for others)
    await page.setUserAgent(userAgent);

    // Stealth measures to avoid detection
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Mock plugins and languages to look more real
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override the chrome property
      window.chrome = {
        runtime: {},
      };

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    // Navigate to the URL with timeout
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Add random human-like delay (2-4 seconds) to avoid detection
    const randomDelay = 2000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, randomDelay));

    // Check if we're on a login page (for LinkedIn)
    if (site === 'linkedin') {
      const currentUrl = page.url();
      const isLoginPage = await page.evaluate(() => {
        return window.location.href.includes('/login') ||
               window.location.href.includes('/uas/login') ||
               document.querySelector('input[name="session_key"]') !== null || // Login form
               document.title.toLowerCase().includes('sign in');
      });

      if (isLoginPage || currentUrl.includes('/login')) {
        throw new Error('LinkedIn authentication expired or invalid. Please re-upload your LinkedIn cookies.');
      }
    }

    // Scrape based on site
    let jobData = {};

    switch (site) {
      case 'greenhouse':
        jobData = await scrapeGreenhouse(page);
        break;
      case 'linkedin':
        jobData = await scrapeLinkedIn(page);
        break;
      case 'indeed':
        jobData = await scrapeIndeed(page);
        break;
      default:
        jobData = await scrapeGeneric(page);
    }

    await browser.close();

    return {
      success: true,
      data: jobData,
      source: site
    };

  } catch (error) {
    console.error('Error scraping job posting:', error.message);

    // Close browser if still open
    if (browser) {
      await browser.close();
    }

    // Provide user-friendly error messages
    let userMessage = error.message;

    if (error.message.includes('Timeout') || error.message.includes('timeout')) {
      userMessage = 'Request timed out. The page took too long to load. Please try again or enter details manually.';
    } else if (error.message.includes('Navigation failed')) {
      userMessage = 'Could not load the page. Please check the URL or enter details manually.';
    } else if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
      userMessage = 'Invalid URL. Please check the URL and try again.';
    }

    return {
      success: false,
      error: userMessage
    };
  }
};

// Login to LinkedIn
const loginToLinkedIn = async (page) => {
  const linkedinEmail = process.env.LINKEDIN_EMAIL;
  const linkedinPassword = process.env.LINKEDIN_PASSWORD;

  // Check if credentials are provided
  if (!linkedinEmail || !linkedinPassword) {
    throw new Error('LinkedIn credentials not configured. Please add LINKEDIN_EMAIL and LINKEDIN_PASSWORD to .env file.');
  }

  try {
    console.log('Logging into LinkedIn...');

    // Navigate to LinkedIn login page
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait for login form
    await page.waitForSelector('#username', { timeout: 15000 });

    // Enter email
    await page.type('#username', linkedinEmail, { delay: 100 });

    // Enter password
    await page.type('#password', linkedinPassword, { delay: 100 });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click sign in button
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {
        // Ignore navigation timeout - sometimes LinkedIn doesn't trigger navigation
      })
    ]);

    // Wait a bit for page to settle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if login was successful
    const currentUrl = page.url();
    console.log('After login, URL is:', currentUrl);

    // Check if we're still on login page or hit a challenge
    if (currentUrl.includes('/login-submit') || currentUrl.includes('/uas/login-submit')) {
      // Sometimes LinkedIn keeps us on login-submit but we're actually logged in
      // Check for error messages
      const hasError = await page.evaluate(() => {
        return document.querySelector('.form__label--error') !== null ||
               document.querySelector('[role="alert"]') !== null;
      });

      if (hasError) {
        throw new Error('LinkedIn login failed. Please check credentials.');
      }
    }

    if (currentUrl.includes('/checkpoint/challenge') || currentUrl.includes('/challenge')) {
      throw new Error('LinkedIn security challenge detected. This account may require verification. Please login manually first or use a different account.');
    }

    console.log('LinkedIn login successful!');

    // Wait a bit after login
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error('LinkedIn login error:', error.message);
    throw new Error(`LinkedIn login failed: ${error.message}`);
  }
};

// Detect which job site the URL is from
const detectJobSite = (url) => {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('greenhouse.io')) return 'greenhouse';
  if (urlLower.includes('linkedin.com')) return 'linkedin';
  if (urlLower.includes('indeed.com')) return 'indeed';

  return 'generic';
};

// Scrape Greenhouse job postings
const scrapeGreenhouse = async (page) => {
  const jobData = await page.evaluate(() => {
    const data = {};

    // Job Title
    const titleElement = document.querySelector('h1.app-title') ||
                         document.querySelector('h1') ||
                         document.querySelector('title');
    data.job_title = titleElement ? titleElement.textContent.trim() : '';

    // Company Name - extract from pathname (more reliable for Greenhouse)
    const pathname = window.location.pathname;
    const pathParts = pathname.split('/');
    // Greenhouse URLs are like: /company-name/jobs/id
    if (pathParts.length >= 2 && pathParts[1]) {
      data.company_name = pathParts[1]
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    } else {
      // Fallback to hostname
      const urlParts = window.location.hostname.split('.');
      if (urlParts.length > 0 && urlParts[0] !== 'boards' && urlParts[0] !== 'job-boards') {
        data.company_name = urlParts[0]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
    }

    // Extract salary
    const salaryMatch = document.body.textContent.match(/\$[\d,]+\s*[-–]\s*\$[\d,]+/);
    data.salary_range = salaryMatch ? salaryMatch[0] : null;

    return data;
  });

  // Analyze text for experience level and sector
  const bodyText = await page.evaluate(() => document.body.textContent);
  jobData.experience_level = extractExperienceLevel(bodyText);
  jobData.aligned_sector = extractSector(bodyText);

  // Parse salary to extract min/max values
  if (jobData.salary_range) {
    const parsedSalary = parseSalary(jobData.salary_range);
    jobData.salary_range = parsedSalary.salary_range;
    jobData.salary_min = parsedSalary.salary_min;
    jobData.salary_max = parsedSalary.salary_max;
  }

  return jobData;
};

// Scrape LinkedIn job postings
const scrapeLinkedIn = async (page) => {
  // Log current URL and page title for debugging
  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log('📍 Current URL:', currentUrl);
  console.log('📄 Page title:', pageTitle);

  const jobData = await page.evaluate(() => {
    const data = {};

    // Job Title - try multiple selectors (LinkedIn uses many different class names)
    const titleElement = document.querySelector('h1.top-card-layout__title') ||
                         document.querySelector('h1.topcard__title') ||
                         document.querySelector('.job-details-jobs-unified-top-card__job-title') ||
                         document.querySelector('h1.jobs-unified-top-card__job-title') ||
                         document.querySelector('h1') ||
                         document.querySelector('[class*="job-title"]');
    data.job_title = titleElement ? titleElement.textContent.trim() : '';

    // Company Name - try multiple selectors
    const companyElement = document.querySelector('.topcard__org-name-link') ||
                          document.querySelector('.job-details-jobs-unified-top-card__company-name') ||
                          document.querySelector('.jobs-unified-top-card__company-name') ||
                          document.querySelector('[class*="company-name"]') ||
                          document.querySelector('.top-card-layout__card a');
    data.company_name = companyElement ? companyElement.textContent.trim() : '';

    // Salary - look for salary information in multiple places
    // First try the salary button (most reliable)
    let salaryElement = document.querySelector('button .tvm__text strong') ||
                       document.querySelector('.tvm__text strong') ||
                       document.querySelector('[class*="salary"]') ||
                       document.querySelector('.job-details-jobs-unified-top-card__job-insight');

    data.salary_range = salaryElement ? salaryElement.textContent.trim() : null;

    // Clean up salary if found - only keep if it has a dollar sign
    if (data.salary_range && !data.salary_range.includes('$')) {
      data.salary_range = null;
    }

    // Additional cleanup: remove extra whitespace and normalize separators
    if (data.salary_range) {
      data.salary_range = data.salary_range.replace(/\s+/g, ' ').trim();
    }

    return data;
  });

  console.log('📋 Scraped job title:', jobData.job_title);
  console.log('🏢 Scraped company:', jobData.company_name);

  // Early detection: If job title contains login-related keywords, something's wrong
  if (jobData.job_title && (jobData.job_title.toLowerCase().includes('sign in') ||
      jobData.job_title.toLowerCase().includes('login'))) {
    console.error('⚠️  Detected login page - job title is:', jobData.job_title);
    throw new Error('LinkedIn authentication expired or invalid. The page shows a login prompt instead of the job posting.');
  }

  // Analyze description for experience level and sector
  const description = await page.evaluate(() => {
    const descElement = document.querySelector('.description__text') ||
                       document.querySelector('.jobs-description') ||
                       document.querySelector('[class*="description"]') ||
                       document.body;
    return descElement ? descElement.textContent : '';
  });

  jobData.experience_level = extractExperienceLevel(jobData.job_title + ' ' + description);
  jobData.aligned_sector = extractSector(jobData.job_title + ' ' + description);

  // If no salary found in top card, search description text
  if (!jobData.salary_range || !jobData.salary_range.includes('$')) {
    console.log('No salary in top card, searching description...');

    // Look for salary patterns in description
    // Patterns: "$173,000 - $197,400", "$120k-$180k", "$85.10/hour to $251,000/year"
    const salaryPatterns = [
      /\$[\d,]+\.?\d*\s*[-–—to]+\s*\$[\d,]+\.?\d*\s*(?:\/\s*)?(?:hour|hr|year|yr|annual|annually)?/gi,
      /\$[\d,]+\.?\d*\s*[kK]?\s*[-–—to]+\s*\$?[\d,]+\.?\d*\s*[kK]?\s*(?:\/\s*)?(?:hour|hr|year|yr|annual|annually)?/gi,
    ];

    for (const pattern of salaryPatterns) {
      const match = description.match(pattern);
      if (match && match[0]) {
        console.log('Found salary in description:', match[0]);
        jobData.salary_range = match[0].trim();
        break;
      }
    }

    if (!jobData.salary_range) {
      console.log('No salary pattern matched in description');
      console.log('Description preview:', description.substring(0, 500));
    }
  } else {
    console.log('Salary found in top card:', jobData.salary_range);
  }

  // Parse salary to extract min/max values
  if (jobData.salary_range) {
    const parsedSalary = parseSalary(jobData.salary_range);
    jobData.salary_range = parsedSalary.salary_range;
    jobData.salary_min = parsedSalary.salary_min;
    jobData.salary_max = parsedSalary.salary_max;
  }

  return jobData;
};

// Scrape Indeed job postings
const scrapeIndeed = async (page) => {
  const jobData = await page.evaluate(() => {
    const data = {};

    // Job Title
    const titleElement = document.querySelector('h1.jobsearch-JobInfoHeader-title') ||
                         document.querySelector('h1[class*="jobTitle"]') ||
                         document.querySelector('h1');
    data.job_title = titleElement ? titleElement.textContent.trim() : '';

    // Company Name
    const companyElement = document.querySelector('[data-company-name="true"]') ||
                          document.querySelector('[class*="company"]') ||
                          document.querySelector('.icl-u-lg-mr--sm');
    data.company_name = companyElement ? companyElement.textContent.trim() : '';

    // Salary
    const salaryMatch = document.body.textContent.match(/\$[\d,]+\s*[-–]\s*\$[\d,]+/);
    data.salary_range = salaryMatch ? salaryMatch[0] : null;

    return data;
  });

  // Get description for analysis
  const description = await page.evaluate(() => {
    const descElement = document.querySelector('#jobDescriptionText') ||
                       document.querySelector('[class*="description"]') ||
                       document.body;
    return descElement ? descElement.textContent : '';
  });

  jobData.experience_level = extractExperienceLevel(jobData.job_title + ' ' + description);
  jobData.aligned_sector = extractSector(jobData.job_title + ' ' + description);

  // Parse salary to extract min/max values
  if (jobData.salary_range) {
    const parsedSalary = parseSalary(jobData.salary_range);
    jobData.salary_range = parsedSalary.salary_range;
    jobData.salary_min = parsedSalary.salary_min;
    jobData.salary_max = parsedSalary.salary_max;
  }

  return jobData;
};

// Generic scraper for other sites
const scrapeGeneric = async (page) => {
  const jobData = await page.evaluate(() => {
    const data = {};

    // Try to find job title - look for largest h1 or title-like elements
    const titleElement = document.querySelector('h1') ||
                         document.querySelector('[class*="job-title"]') ||
                         document.querySelector('[class*="title"]') ||
                         document.querySelector('title');
    data.job_title = titleElement ? titleElement.textContent.trim() : '';

    // Try to extract company name from URL hostname
    const hostname = window.location.hostname;
    const domainParts = hostname.split('.');

    // Get the main domain (e.g., "healthee" from "healthee.com")
    const mainDomain = domainParts.length >= 2 ? domainParts[domainParts.length - 2] : domainParts[0];

    // Capitalize first letter
    data.company_name = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);

    // Try to find company name in page content as fallback
    const companyElement = document.querySelector('[class*="company-name"]') ||
                          document.querySelector('[data-company]');

    // Only use page content if it looks valid (not a label or placeholder)
    if (companyElement) {
      const companyText = companyElement.textContent.trim();
      // Avoid labels like "Company name*", "Company:", etc.
      if (companyText &&
          !companyText.includes('*') &&
          !companyText.endsWith(':') &&
          companyText.length > 2 &&
          companyText.length < 50) {
        data.company_name = companyText;
      }
    }

    // Salary
    const salaryMatch = document.body.textContent.match(/\$[\d,]+\s*[-–]\s*\$[\d,]+/);
    data.salary_range = salaryMatch ? salaryMatch[0] : null;

    return data;
  });

  const bodyText = await page.evaluate(() => document.body.textContent);
  jobData.experience_level = extractExperienceLevel(bodyText);
  jobData.aligned_sector = extractSector(bodyText);

  // Parse salary to extract min/max values
  if (jobData.salary_range) {
    const parsedSalary = parseSalary(jobData.salary_range);
    jobData.salary_range = parsedSalary.salary_range;
    jobData.salary_min = parsedSalary.salary_min;
    jobData.salary_max = parsedSalary.salary_max;
  }

  return jobData;
};

// Extract experience level from text
const extractExperienceLevel = (text) => {
  const textLower = text.toLowerCase();

  if (textLower.includes('senior') || textLower.includes('sr.') || textLower.includes('lead') || textLower.includes('principal') || textLower.includes('staff')) {
    return 'Senior';
  } else if (textLower.includes('mid') || textLower.includes('intermediate') || textLower.match(/\b\d+\+?\s*years/)) {
    return 'Mid-Level';
  } else if (textLower.includes('junior') || textLower.includes('jr.') || textLower.includes('entry') || textLower.includes('associate')) {
    return 'Entry Level';
  }

  return null;
};

// Extract aligned sector from text using keyword analysis
const extractSector = (text) => {
  const textLower = text.toLowerCase();

  // Healthcare (check first - more specific)
  if (textLower.match(/health|medical|hospital|clinic|nurse|doctor|patient|pharma|pharmacy|care|healthcare/)) {
    return ['Healthcare'];
  }
  // Technology/Software
  else if (textLower.match(/software|developer|engineer|tech|programming|code|web|app|data|cloud|ai|machine learning/)) {
    return ['Software Engineer'];
  }
  // Finance
  else if (textLower.match(/finance|banking|investment|accounting|financial|trading|analyst/)) {
    return ['Finance'];
  }
  // Manufacturing
  else if (textLower.match(/manufacturing|production|factory|industrial|assembly/)) {
    return ['Manufacturing'];
  }
  // Retail
  else if (textLower.match(/retail|store|sales|customer service|merchandis/)) {
    return ['Retail'];
  }
  // Construction
  else if (textLower.match(/construction|building|contractor|architect|civil engineer/)) {
    return ['Construction'];
  }
  // Professional Services
  else if (textLower.match(/consulting|professional services|advisory|legal|law/)) {
    return ['Professional Services'];
  }
  // Education
  else if (textLower.match(/education|teacher|professor|school|university|academic|training/)) {
    return ['Education'];
  }

  return ['Other'];
};

module.exports = {
  scrapeJobPosting
};
