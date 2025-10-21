const jobPostingQueries = require('../queries/jobPostingQueries');
const jobScraper = require('../services/jobScraper');

// Get all job postings
const getAllJobPostings = async (req, res) => {
  try {
    const jobPostings = await jobPostingQueries.getAllJobPostings();
    res.json(jobPostings);
  } catch (error) {
    console.error('Get all job postings error:', error);
    res.status(500).json({ error: 'Error fetching job postings' });
  }
};

// Get job posting by ID
const getJobPostingById = async (req, res) => {
  try {
    const { id } = req.params;
    const jobPosting = await jobPostingQueries.getJobPostingById(id);
    
    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    res.json(jobPosting);
  } catch (error) {
    console.error('Get job posting by ID error:', error);
    res.status(500).json({ error: 'Error fetching job posting' });
  }
};

// Create new job posting
const createJobPosting = async (req, res) => {
  try {
    const {
      job_title,
      company_name,
      job_posting_url,
      experience_level,
      source,
      ownership,
      aligned_sector,
      notes,
      salary_range,
      salary_min,
      salary_max
    } = req.body;

    if (!job_title || !company_name) {
      return res.status(400).json({ error: 'Job title and company name are required' });
    }

    const jobPostingData = {
      job_title,
      company_name,
      job_url: job_posting_url, // Map to database column name
      experience_level,
      source,
      ownership,
      aligned_sector,
      notes,
      salary_range,
      salary_min,
      salary_max,
      staff_user_id: req.user.id // From auth middleware
    };

    const newJobPosting = await jobPostingQueries.createJobPosting(jobPostingData);
    res.status(201).json({ message: 'Job posting created successfully', jobPosting: newJobPosting });
  } catch (error) {
    console.error('Create job posting error:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Error creating job posting' });
  }
};

// Update job posting
const updateJobPosting = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Map job_posting_url to job_url if present
    if (updateData.job_posting_url) {
      updateData.job_url = updateData.job_posting_url;
      delete updateData.job_posting_url;
    }

    const updatedJobPosting = await jobPostingQueries.updateJobPosting(id, updateData);
    
    if (!updatedJobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    res.json({ message: 'Job posting updated successfully', jobPosting: updatedJobPosting });
  } catch (error) {
    console.error('Update job posting error:', error);
    res.status(500).json({ error: 'Error updating job posting' });
  }
};

// Delete job posting
const deleteJobPosting = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedJobPosting = await jobPostingQueries.deleteJobPosting(id);
    
    if (!deletedJobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    res.json({ message: 'Job posting deleted successfully', jobPosting: deletedJobPosting });
  } catch (error) {
    console.error('Delete job posting error:', error);
    res.status(500).json({ error: 'Error deleting job posting' });
  }
};

// Scrape job posting from URL
const scrapeJobUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await jobScraper.scrapeJobPosting(url);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      data: result.data,
      source: result.source
    });
  } catch (error) {
    console.error('Scrape job URL error:', error);
    res.status(500).json({ error: 'Error scraping job posting URL' });
  }
};

module.exports = {
  getAllJobPostings,
  getJobPostingById,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  scrapeJobUrl
};
