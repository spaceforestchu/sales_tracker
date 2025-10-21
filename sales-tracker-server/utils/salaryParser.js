/**
 * Salary Parser Utility
 * Parses various salary formats into normalized annual USD values
 *
 * Handles formats like:
 * - "$85.10/hour to $251,000/year + bonus"
 * - "$120k-$180k"
 * - "$85.10/yr - $251K/yr"
 * - "$150,000 - $200,000 per year"
 */

/**
 * Parse a salary string and extract min/max annual values
 * @param {string} salaryText - Raw salary text from job posting
 * @returns {object} { salary_range: string, salary_min: number|null, salary_max: number|null }
 */
function parseSalary(salaryText) {
  if (!salaryText || typeof salaryText !== 'string') {
    return { salary_range: null, salary_min: null, salary_max: null };
  }

  // Clean up the text
  let cleanText = salaryText
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Remove bonus/equity/benefits mentions
  cleanText = cleanText
    .replace(/\+?\s*(bonus|equity|benefits|stock|401k|insurance|pto|vacation).*$/i, '')
    .trim();

  // Find all dollar amounts with their units
  // Pattern matches: $85.10/hour, $120k, $251,000/year, etc.
  const salaryMatches = [];
  const regex = /\$\s*([\d,]+\.?\d*)\s*([kK])?\s*(?:\/\s*)?(hour|hr|year|yr|annual|annually|month|mo|monthly)?/g;

  let match;
  while ((match = regex.exec(cleanText)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''));
    const multiplier = match[2] ? 1000 : 1; // K or k means thousands
    const unit = match[3] || 'year'; // Default to year if no unit specified

    let annualAmount = amount * multiplier;

    // Convert to annual salary
    if (unit.startsWith('hour') || unit === 'hr') {
      annualAmount = annualAmount * 2080; // Standard 2080 work hours per year
    } else if (unit.startsWith('month') || unit === 'mo') {
      annualAmount = annualAmount * 12;
    }

    salaryMatches.push(Math.round(annualAmount));
  }

  // If no matches found, try a simpler pattern for ranges like "120-180k"
  if (salaryMatches.length === 0) {
    const simpleRange = cleanText.match(/([\d,]+)\s*[-–to]\s*([\d,]+)\s*([kK])?/);
    if (simpleRange) {
      const min = parseFloat(simpleRange[1].replace(/,/g, ''));
      const max = parseFloat(simpleRange[2].replace(/,/g, ''));
      const multiplier = simpleRange[3] ? 1000 : 1;

      salaryMatches.push(Math.round(min * multiplier));
      salaryMatches.push(Math.round(max * multiplier));
    }
  }

  // Determine min and max
  let salary_min = null;
  let salary_max = null;

  if (salaryMatches.length > 0) {
    salary_min = Math.min(...salaryMatches);
    salary_max = Math.max(...salaryMatches);

    // If they're the same, it's likely a single value, not a range
    if (salary_min === salary_max && salaryMatches.length === 1) {
      salary_min = null;
      salary_max = salaryMatches[0];
    }

    // Sanity checks - filter out unrealistic salaries
    if (salary_min !== null && (salary_min < 1000 || salary_min > 10000000)) {
      salary_min = null;
    }
    if (salary_max !== null && (salary_max < 1000 || salary_max > 10000000)) {
      salary_max = null;
    }
  }

  return {
    salary_range: salaryText.trim(),
    salary_min,
    salary_max
  };
}

/**
 * Format a salary range for display
 * @param {number} min - Minimum salary
 * @param {number} max - Maximum salary
 * @returns {string} Formatted salary range (e.g., "$120K - $180K")
 */
function formatSalaryRange(min, max) {
  const format = (num) => {
    if (num >= 1000) {
      return '$' + (num / 1000).toFixed(0) + 'K';
    }
    return '$' + num.toLocaleString();
  };

  if (min && max) {
    return `${format(min)} - ${format(max)}`;
  } else if (max) {
    return `Up to ${format(max)}`;
  } else if (min) {
    return `From ${format(min)}`;
  }
  return null;
}

module.exports = {
  parseSalary,
  formatSalaryRange
};
