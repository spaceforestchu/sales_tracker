const pool = require('../db/dbConfig');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Total job postings
    const totalJobsResult = await pool.query(
      'SELECT COUNT(*) as count FROM job_postings'
    );
    const totalJobs = parseInt(totalJobsResult.rows[0].count);

    // Total outreach (all time)
    const totalOutreachResult = await pool.query(
      'SELECT COUNT(*) as count FROM outreach'
    );
    const totalOutreach = parseInt(totalOutreachResult.rows[0].count);

    // Last 7 days outreach
    const last7DaysOutreachResult = await pool.query(
      `SELECT COUNT(*) as count FROM outreach
       WHERE outreach_date >= CURRENT_DATE - INTERVAL '7 days'`
    );
    const last7DaysOutreach = parseInt(last7DaysOutreachResult.rows[0].count);

    // Active leads (NOT "Closed Won" or "Closed Lost")
    const activeLeadsResult = await pool.query(
      `SELECT COUNT(*) as count FROM outreach
       WHERE status NOT IN ('Closed Won', 'Closed Lost')`
    );
    const activeLeads = parseInt(activeLeadsResult.rows[0].count);

    res.json({
      totalJobs,
      totalOutreach,
      last7DaysOutreach,
      activeLeads,
      jobPostings: totalJobs // Same as totalJobs for now
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Error fetching dashboard statistics' });
  }
};

// Get closed won jobs with optional date filtering
const getClosedWonJobs = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        o.id,
        o.company_name,
        o.job_title as role,
        o.aligned_sector as industries,
        o.outreach_date as date,
        o.status,
        o.created_at,
        o.updated_at
      FROM outreach o
      WHERE o.status = 'Closed Won'
    `;

    const params = [];

    // Add date filtering if provided
    if (startDate) {
      params.push(startDate);
      query += ` AND o.outreach_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND o.outreach_date <= $${params.length}`;
    }

    query += ' ORDER BY o.outreach_date DESC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get closed won jobs error:', error);
    res.status(500).json({ error: 'Error fetching closed won jobs' });
  }
};

// Get outreach with date filtering
const getOutreachForDashboard = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        o.id,
        u.name as staff_member,
        o.contact_name as name,
        o.company_name,
        o.job_title as role,
        o.aligned_sector,
        o.outreach_date as date_of_initial_outreach,
        o.status,
        o.created_at,
        o.updated_at
      FROM outreach o
      LEFT JOIN users u ON o.staff_user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Add date filtering if provided
    if (startDate) {
      params.push(startDate);
      query += ` AND o.outreach_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND o.outreach_date <= $${params.length}`;
    }

    query += ' ORDER BY o.outreach_date DESC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get outreach for dashboard error:', error);
    res.status(500).json({ error: 'Error fetching outreach records' });
  }
};

module.exports = {
  getDashboardStats,
  getClosedWonJobs,
  getOutreachForDashboard
};
