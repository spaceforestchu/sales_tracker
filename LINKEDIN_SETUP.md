# LinkedIn Scraping Setup

## Easy Method: Export Cookies from Your Browser

Since you're already logged into LinkedIn in your browser, you can export those cookies!

### Option 1: Use a Chrome Extension (Easiest)

1. **Install "Get cookies.txt LOCALLY" extension**
   - https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc

2. **Go to LinkedIn.com** (make sure you're logged in)

3. **Click the extension icon** → Export cookies

4. **Convert to JSON format** (I can help with this)

5. **Upload via API** to your deployed app

### Option 2: Manual Cookie Export

1. **Open LinkedIn.com** in Chrome
2. **Open DevTools** (F12 or Cmd+Option+I)
3. **Go to Application tab** → Cookies → https://www.linkedin.com
4. **Copy all cookies** (especially `li_at` and `JSESSIONID`)
5. Send them to the backend via the upload endpoint

### Option 3: Skip LinkedIn Scraping

For now, you can:
- Use the scraper for **Greenhouse, Indeed, and other sites** (works perfectly!)
- Manually enter LinkedIn job details (faster than fighting LinkedIn's bot detection)

## Why is LinkedIn Hard to Scrape?

- Very aggressive bot detection
- Requires CAPTCHAs frequently
- Blocks automated logins
- Can ban accounts for scraping

## Recommended Solution

**Just skip LinkedIn scraping** for now. The team can:
1. Copy job title and company name from LinkedIn (takes 5 seconds)
2. Use the scraper for other job boards (works great!)
3. Save time not fighting LinkedIn's anti-bot systems

LinkedIn scraping is honestly more trouble than it's worth!
