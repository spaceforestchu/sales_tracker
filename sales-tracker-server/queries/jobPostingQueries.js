const pool = require('../db/dbConfig');

// Get all job postings
const getAllJobPostings = async () => {
  const query = 'SELECT * FROM job_postings ORDER BY created_at DESC';
  const result = await pool.query(query);
  return result.rows;
};

// Get job posting by ID
const getJobPostingById = async (id) => {
  const query = 'SELECT * FROM job_postings WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Create new job posting
const createJobPosting = async (jobPostingData) => {
  const {
    job_title,
    company_name,
    job_url,
    experience_level,
    source,
    ownership,
    aligned_sector,
    notes,
    staff_user_id,
    salary_range,
    salary_min,
    salary_max
  } = jobPostingData;

  const query = `
    INSERT INTO job_postings (
      job_title,
      company_name,
      job_url,
      experience_level,
      source,
      ownership,
      aligned_sector,
      notes,
      staff_user_id,
      salary_range,
      salary_min,
      salary_max,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
    RETURNING *
  `;

  const values = [
    job_title,
    company_name,
    job_url || null,
    experience_level || null,
    source || null,
    ownership || null,
    aligned_sector ? JSON.stringify(aligned_sector) : null,
    notes || null,
    staff_user_id,
    salary_range || null,
    salary_min || null,
    salary_max || null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// Update job posting
const updateJobPosting = async (id, updateData) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = [
    'job_title',
    'company_name',
    'job_url',
    'experience_level',
    'source',
    'ownership',
    'aligned_sector',
    'notes',
    'status',
    'is_shared',
    'shared_date',
    'salary_range',
    'salary_min',
    'salary_max'
  ];

  console.log('Update data received:', updateData);

  for (const [key, value] of Object.entries(updateData)) {
    console.log(`Checking field: ${key}, value: ${value}, allowed: ${allowedFields.includes(key)}, undefined: ${value === undefined}`);
    if (allowedFields.includes(key) && value !== undefined) {
      fields.push(`${key} = $${paramCount}`);
      values.push(key === 'aligned_sector' && typeof value === 'object' ? JSON.stringify(value) : value);
      paramCount++;
    }
  }

  console.log('Fields to update:', fields);
  console.log('Values:', values);

  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const query = `
    UPDATE job_postings
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};

// Delete job posting
const deleteJobPosting = async (id) => {
  const query = 'DELETE FROM job_postings WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Get job postings by ownership
const getJobPostingsByOwnership = async (ownership) => {
  const query = 'SELECT * FROM job_postings WHERE ownership = $1 ORDER BY created_at DESC';
  const result = await pool.query(query, [ownership]);
  return result.rows;
};

module.exports = {
  getAllJobPostings,
  getJobPostingById,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  getJobPostingsByOwnership
};
