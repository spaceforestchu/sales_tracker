-- Migration: Add salary parsing columns to job_postings table
-- This allows us to store both the raw salary text and parsed numeric values

-- Expand salary_range to handle longer text
ALTER TABLE job_postings
  ALTER COLUMN salary_range TYPE TEXT;

-- Add columns for parsed salary values (in annual USD)
ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS salary_max INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN job_postings.salary_range IS 'Raw salary text as scraped from job posting';
COMMENT ON COLUMN job_postings.salary_min IS 'Minimum annual salary in USD (parsed from salary_range)';
COMMENT ON COLUMN job_postings.salary_max IS 'Maximum annual salary in USD (parsed from salary_range)';

-- Create index for salary filtering/sorting
CREATE INDEX IF NOT EXISTS idx_job_postings_salary_min ON job_postings(salary_min);
CREATE INDEX IF NOT EXISTS idx_job_postings_salary_max ON job_postings(salary_max);
