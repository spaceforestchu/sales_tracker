import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { jobPostingAPI, userAPI, activityAPI, applicationAPI, builderAPI } from '../services/api';
import { exportJobPostingsToCSV } from '../utils/csvExport';
import '../styles/Overview.css';
import '../styles/AllLeads.css';
import '../styles/QuickActions.css';

const JobPostings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [jobPostings, setJobPostings] = useState([]);
  const [filteredJobPostings, setFilteredJobPostings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Search enhancements
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem('jobPostingSearchHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [dateRange, setDateRange] = useState({
    from: '',
    to: ''
  });
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    experienceLevel: '',
    owner: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, shared, not_shared

  // Bulk selection state
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);

  // Modal state
  const [activeModal, setActiveModal] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedJobDetails, setSelectedJobDetails] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [viewApplicationsJobId, setViewApplicationsJobId] = useState(null);

  // Application tracking state
  const [applications, setApplications] = useState([]);
  const [allJobApplications, setAllJobApplications] = useState({}); // Store applications for all jobs
  const [builders, setBuilders] = useState([]);
  const [showAddBuilderForm, setShowAddBuilderForm] = useState(false);
  const [showApplicationsList, setShowApplicationsList] = useState(false);
  const [newApplicationForm, setNewApplicationForm] = useState({
    builder_name: '',
    status: 'Shared',
    shared_date: new Date().toISOString().split('T')[0],
    applied_date: '',
    notes: ''
  });

  // Form states
  const [newJobPostingForm, setNewJobPostingForm] = useState({
    lead_type: 'job',
    company_name: '',
    job_title: '',
    job_posting_url: '',
    experience_level: '',
    salary_range: '',
    outreach_date: new Date().toISOString().split('T')[0],
    source: [],
    stage: 'Job Posted',
    ownership: user?.name || '',
    notes: '',
    aligned_sector: [],
    is_shared: false,
    shared_date: ''
  });

  // Scraping state
  const [isScraping, setIsScraping] = useState(false);

  // Aligned Sector options
  const alignedSectorOptions = [
    'Technology',
    'Software Engineer',
    'Product Designer',
    'Healthcare',
    'Finance',
    'Manufacturing',
    'Retail',
    'Construction',
    'Professional Services',
    'Education',
    'Other'
  ];

  useEffect(() => {
    fetchJobPostings();
    fetchStaffMembers();
  }, []);

  useEffect(() => {
    filterJobPostings();
  }, [jobPostings, searchTerm, dateRange, filters, sortBy, allJobApplications]);

  // Autocomplete effect
  useEffect(() => {
    if (searchTerm.length > 0 && searchTerm.length < 3) {
      // Only show autocomplete for short search terms (1-2 chars)
      const suggestions = jobPostings
        .filter(job => {
          const searchLower = searchTerm.toLowerCase();
          return (
            job.company_name?.toLowerCase().includes(searchLower) ||
            job.job_title?.toLowerCase().includes(searchLower) ||
            job.ownership?.toLowerCase().includes(searchLower)
          );
        })
        .slice(0, 5)
        .map(job => ({
          id: job.id,
          text: `${job.job_title} - ${job.company_name}`,
          job: job
        }));
      setSearchSuggestions(suggestions);
      setShowAutocomplete(suggestions.length > 0);
    } else if (searchTerm.length >= 3) {
      // For longer searches, hide autocomplete and show results directly
      setSearchSuggestions([]);
      setShowAutocomplete(false);
    } else {
      setSearchSuggestions([]);
      setShowAutocomplete(false);
    }
  }, [searchTerm, jobPostings]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAutocomplete && !event.target.closest('.all-leads__search-box')) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAutocomplete]);

  const fetchJobPostings = async () => {
    setLoading(true);
    try {
      const data = await jobPostingAPI.getAllJobPostings();

      // Sort by most recent
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.created_at || a.updated_at);
        const dateB = new Date(b.created_at || b.updated_at);
        return dateB - dateA;
      });

      setJobPostings(sorted);
      setFilteredJobPostings(sorted);

      // Fetch applications for all jobs
      await fetchAllJobApplications(sorted);
    } catch (error) {
      console.error('Error fetching job postings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllJobApplications = async (jobs) => {
    try {
      const applicationsMap = {};

      // Fetch applications for each job
      await Promise.all(
        jobs.map(async (job) => {
          try {
            const apps = await applicationAPI.getApplicationsByJobPosting(job.id);
            applicationsMap[job.id] = apps;
          } catch (error) {
            console.error(`Error fetching applications for job ${job.id}:`, error);
            applicationsMap[job.id] = [];
          }
        })
      );

      setAllJobApplications(applicationsMap);
    } catch (error) {
      console.error('Error fetching all applications:', error);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const users = await userAPI.getAllUsers();
      // Include all active users for ownership dropdown
      setStaffMembers(users.filter(u => u.is_active !== false));
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const filterJobPostings = () => {
    let filtered = [...jobPostings];

    // Apply search filter - enhanced to include aligned sectors
    if (searchTerm) {
      filtered = filtered.filter(job => {
        const searchLower = searchTerm.toLowerCase();

        // Search in basic fields
        const matchesBasic =
          job.company_name?.toLowerCase().includes(searchLower) ||
          job.job_title?.toLowerCase().includes(searchLower) ||
          job.ownership?.toLowerCase().includes(searchLower);

        // Search in aligned sectors
        let matchesSectors = false;
        try {
          let sectors = [];
          if (job.aligned_sector) {
            if (typeof job.aligned_sector === 'string') {
              sectors = JSON.parse(job.aligned_sector);
            } else if (Array.isArray(job.aligned_sector)) {
              sectors = job.aligned_sector;
            }
          }
          matchesSectors = sectors.some(sector =>
            sector.toLowerCase().includes(searchLower)
          );
        } catch (error) {
          // Ignore parse errors
        }

        return matchesBasic || matchesSectors;
      });
    }

    // Apply experience level filter
    if (filters.experienceLevel) {
      filtered = filtered.filter(job => job.experience_level === filters.experienceLevel);
    }

    // Apply owner filter
    if (filters.owner) {
      filtered = filtered.filter(job => job.ownership === filters.owner);
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(job => {
        const jobDate = new Date(job.created_at || job.outreach_date);
        const fromDate = dateRange.from ? new Date(dateRange.from) : null;
        const toDate = dateRange.to ? new Date(dateRange.to) : null;

        if (fromDate && toDate) {
          return jobDate >= fromDate && jobDate <= toDate;
        } else if (fromDate) {
          return jobDate >= fromDate;
        } else if (toDate) {
          return jobDate <= toDate;
        }
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || b.outreach_date) - new Date(a.created_at || a.outreach_date);
        case 'oldest':
          return new Date(a.created_at || a.outreach_date) - new Date(b.created_at || b.outreach_date);
        case 'shared':
          // Shared jobs first, then sort by date
          if (a.is_shared && !b.is_shared) return -1;
          if (!a.is_shared && b.is_shared) return 1;
          return new Date(b.created_at || b.outreach_date) - new Date(a.created_at || a.outreach_date);
        case 'not_shared':
          // Not shared jobs first, then sort by date
          if (!a.is_shared && b.is_shared) return -1;
          if (a.is_shared && !b.is_shared) return 1;
          return new Date(b.created_at || b.outreach_date) - new Date(a.created_at || a.outreach_date);
        default:
          return 0;
      }
    });

    setFilteredJobPostings(filtered);
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffTime = Math.abs(now - past);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  const getStatusColor = (status) => {
    const colors = {
      'Shared': '#f3f4f6',
      'Applied': '#dbeafe',
      'Phone Screen': '#fef3c7',
      'Technical Interview': '#fed7aa',
      'Final Interview': '#fde68a',
      'Offer': '#d9f99d',
      'Accepted': '#bbf7d0',
      'Rejected': '#fecaca',
      'Declined': '#fed7d7',
      'Withdrawn': '#e5e7eb'
    };
    return colors[status] || '#f3f4f6';
  };

  // Constants for forms
  const experienceLevels = [
    'Internship',
    'Entry-Level',
    'Mid-Level',
    'Senior'
  ];

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedJobDetails(null);
    setIsEditMode(false);
    setEditFormData({});
    setViewApplicationsJobId(null);
    setNewJobPostingForm({
      lead_type: 'job',
      company_name: '',
      job_title: '',
      job_posting_url: '',
      experience_level: '',
      outreach_date: new Date().toISOString().split('T')[0],
      source: [],
      stage: 'Job Posted',
      ownership: user?.name || '',
      notes: '',
      aligned_sector: [],
      salary_range: '',
      is_shared: false,
      shared_date: ''
    });
    // Reset application tracking state
    setApplications([]);
    setShowAddBuilderForm(false);
    setShowApplicationsList(false);
    setNewApplicationForm({
      builder_name: '',
      status: 'Shared',
      shared_date: new Date().toISOString().split('T')[0],
      applied_date: '',
      notes: ''
    });
  };

  const handleSaveJobDetails = async () => {
    setLoading(true);
    try {
      await jobPostingAPI.updateJobPosting(selectedJobDetails.id, editFormData);

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'updated_job_posting',
        entity_type: 'job_posting',
        entity_name: `${selectedJobDetails.job_title} - ${selectedJobDetails.company_name}`,
        details: { updated_fields: Object.keys(editFormData) }
      });

      showMessage('success', 'Job posting updated successfully!');
      setIsEditMode(false);
      setEditFormData({});
      fetchJobPostings();
    } catch (error) {
      showMessage('error', 'Failed to update job posting. Please try again.');
      console.error('Error updating job posting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchJobDetails = async () => {
    if (!newJobPostingForm.job_posting_url) {
      showMessage('error', 'Please enter a job posting URL first');
      return;
    }

    setIsScraping(true);
    try {
      const result = await jobPostingAPI.scrapeJobUrl(newJobPostingForm.job_posting_url);

      if (result.success && result.data) {
        // Auto-populate fields from scraped data
        setNewJobPostingForm(prev => ({
          ...prev,
          job_title: result.data.job_title || prev.job_title,
          company_name: result.data.company_name || prev.company_name,
          experience_level: result.data.experience_level || prev.experience_level,
          salary_range: result.data.salary_range || 'Not Available',
          aligned_sector: result.data.aligned_sector || prev.aligned_sector
        }));

        showMessage('success', `Job details fetched from ${result.source}!`);
      } else {
        showMessage('error', 'Could not fetch job details. Please enter manually.');
      }
    } catch (error) {
      showMessage('error', 'Failed to fetch job details. Please enter manually.');
      console.error('Error fetching job details:', error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleAddJobPosting = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await jobPostingAPI.createJobPosting(newJobPostingForm);

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'added_job_posting',
        entity_type: 'job_posting',
        entity_name: `${newJobPostingForm.job_title} - ${newJobPostingForm.company_name}`,
        details: {
          company: newJobPostingForm.company_name,
          job_title: newJobPostingForm.job_title,
          experience_level: newJobPostingForm.experience_level
        }
      });

      showMessage('success', 'Job posting added successfully!');
      closeModal();
      fetchJobPostings();
    } catch (error) {
      showMessage('error', 'Failed to add job posting. Please try again.');
      console.error('Error adding job posting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJobPosting = async (jobId, jobName) => {
    if (!window.confirm(`Are you sure you want to delete "${jobName}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await jobPostingAPI.deleteJobPosting(jobId);

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'deleted_job_posting',
        entity_type: 'job_posting',
        entity_name: jobName,
        details: {}
      });

      showMessage('success', 'Job posting deleted successfully!');
      fetchJobPostings();
    } catch (error) {
      showMessage('error', 'Failed to delete job posting. Please try again.');
      console.error('Error deleting job posting:', error);
    } finally {
      setLoading(false);
    }
  };

  // Bulk actions handlers
  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedJobs([]);
  };

  const toggleJobSelection = (jobId) => {
    setSelectedJobs(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const selectAllJobs = () => {
    if (selectedJobs.length === filteredJobPostings.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(filteredJobPostings.map(job => job.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedJobs.length === 0) {
      showMessage('error', 'No jobs selected');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedJobs.length} job posting${selectedJobs.length > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        selectedJobs.map(jobId => jobPostingAPI.deleteJobPosting(jobId))
      );

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'bulk_deleted_job_postings',
        entity_type: 'job_posting',
        entity_name: `${selectedJobs.length} job postings`,
        details: { count: selectedJobs.length }
      });

      showMessage('success', `${selectedJobs.length} job posting${selectedJobs.length > 1 ? 's' : ''} deleted successfully!`);
      setSelectedJobs([]);
      setBulkMode(false);
      fetchJobPostings();
    } catch (error) {
      showMessage('error', 'Failed to delete job postings. Please try again.');
      console.error('Error bulk deleting job postings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = () => {
    if (selectedJobs.length === 0) {
      showMessage('error', 'No jobs selected');
      return;
    }

    const selectedJobsData = jobPostings.filter(job => selectedJobs.includes(job.id));
    exportJobPostingsToCSV(selectedJobsData);
    showMessage('success', `Exported ${selectedJobs.length} job posting${selectedJobs.length > 1 ? 's' : ''}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Search helper functions
  const addToSearchHistory = (term) => {
    if (!term || term.trim() === '') return;
    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('jobPostingSearchHistory', JSON.stringify(newHistory));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('jobPostingSearchHistory');
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setDateRange({ from: '', to: '' });
    setFilters({ experienceLevel: '', owner: '' });
    setSortBy('newest');
    setShowAutocomplete(false);
  };

  const hasActiveFilters = () => {
    return searchTerm || dateRange.from || dateRange.to || filters.experienceLevel || filters.owner || sortBy !== 'newest';
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    if (value.trim() === '') {
      setShowAutocomplete(false);
    } else {
      // Show autocomplete as user types
      setShowAutocomplete(true);
    }
  };

  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      addToSearchHistory(searchTerm);
      setShowAutocomplete(false);
    }
  };

  const selectSuggestion = (suggestion) => {
    // Use just the company name for better search results
    const searchValue = suggestion.job.company_name || suggestion.job.job_title || suggestion.text;
    setSearchTerm(searchValue);
    addToSearchHistory(searchValue);
    setShowAutocomplete(false);
  };

  // Application tracking effect - fetch when modal opens
  useEffect(() => {
    if (activeModal === 'viewDetails' && selectedJobDetails) {
      fetchApplications();
      fetchBuilders();
    }
  }, [activeModal, selectedJobDetails]);

  const fetchApplications = async () => {
    if (!selectedJobDetails?.id) return;
    try {
      const apps = await applicationAPI.getApplicationsByJobPosting(selectedJobDetails.id);
      setApplications(apps);
    } catch (error) {
      console.error('Error fetching applications:', error);
    }
  };

  const fetchBuilders = async () => {
    try {
      const allBuilders = await builderAPI.getAllBuilders();
      setBuilders(allBuilders);
    } catch (error) {
      console.error('Error fetching builders:', error);
    }
  };

  const handleAddBuilderToJob = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await applicationAPI.addBuilderToJobPosting({
        job_posting_id: selectedJobDetails.id,
        builder_name: newApplicationForm.builder_name,
        status: newApplicationForm.status,
        shared_date: newApplicationForm.shared_date,
        applied_date: newApplicationForm.applied_date || null,
        notes: newApplicationForm.notes,
        last_updated_by: user.name
      });

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'added_builder_to_job',
        entity_type: 'application',
        entity_name: `${newApplicationForm.builder_name} - ${selectedJobDetails.job_title}`,
        details: { status: newApplicationForm.status }
      });

      showMessage('success', 'Builder added to job posting successfully!');
      setShowAddBuilderForm(false);
      setNewApplicationForm({
        builder_name: '',
        status: 'Shared',
        shared_date: new Date().toISOString().split('T')[0],
        applied_date: '',
        notes: ''
      });
      fetchApplications();
    } catch (error) {
      showMessage('error', 'Failed to add builder. Please try again.');
      console.error('Error adding builder to job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApplicationStatus = async (applicationId, newStatus) => {
    setLoading(true);
    try {
      await applicationAPI.updateApplicationStatus(applicationId, {
        status: newStatus,
        last_updated_by: user.name
      });

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'updated_application_status',
        entity_type: 'application',
        entity_name: `${selectedJobDetails.job_title}`,
        details: { new_status: newStatus }
      });

      showMessage('success', 'Application status updated!');
      fetchApplications();
    } catch (error) {
      showMessage('error', 'Failed to update status. Please try again.');
      console.error('Error updating application status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApplication = async (applicationId, builderName) => {
    if (!window.confirm(`Remove ${builderName} from this job posting?`)) {
      return;
    }

    setLoading(true);
    try {
      await applicationAPI.deleteApplication(applicationId);

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'removed_builder_from_job',
        entity_type: 'application',
        entity_name: `${builderName} - ${selectedJobDetails.job_title}`,
        details: {}
      });

      showMessage('success', 'Builder removed successfully!');
      fetchApplications();
      // Refresh all job applications to update the card count
      if (viewApplicationsJobId) {
        fetchAllJobApplications(jobPostings);
      }
    } catch (error) {
      showMessage('error', 'Failed to remove builder. Please try again.');
      console.error('Error deleting application:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch applications for a specific job (for applications-only modal)
  const fetchApplicationsForJob = async (jobId) => {
    try {
      const apps = await applicationAPI.getApplicationsByJobPosting(jobId);
      setApplications(apps);
    } catch (error) {
      console.error('Error fetching applications:', error);
      setApplications([]);
    }
  };

  return (
    <div className="overview">
      <header className="overview__header">
        <div className="overview__header-content">
          <h1 className="overview__title">Pursuit, Talent & Partnership Tracker</h1>
          <div className="overview__user">
            <span className="overview__user-name">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="overview__button overview__button--logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="overview__nav">
        <button
          className="overview__nav-item"
          onClick={() => navigate('/dashboard')}
        >
          Dashboard
        </button>
        <button
          className="overview__nav-item"
          onClick={() => navigate('/leads')}
        >
          All Leads
        </button>
        <button className="overview__nav-item overview__nav-item--active">
          Job Postings
        </button>
      </nav>

      <main className="overview__main">
        <div className="all-leads">
          <h2 className="all-leads__title">Job Postings</h2>

          {/* Action Buttons */}
          <div className="all-leads__action-buttons">
            <button
              className="action-button action-button--blue"
              onClick={() => setActiveModal('newJobPosting')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Job Posting
            </button>
            <button
              className="action-button action-button--green"
              onClick={() => exportJobPostingsToCSV(filteredJobPostings)}
              disabled={filteredJobPostings.length === 0}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3v12m0 0l-4-4m4 4l4-4M3 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download CSV
            </button>
            <button
              className={`action-button ${bulkMode ? 'action-button--red' : 'action-button--purple'}`}
              onClick={toggleBulkMode}
              style={{
                background: bulkMode ? '#dc2626' : '#7c3aed'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
              {bulkMode ? 'Cancel Bulk Mode' : 'Bulk Actions'}
            </button>
          </div>

          {/* Bulk Actions Panel */}
          {bulkMode && (
            <div style={{
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedJobs.length === filteredJobPostings.length && filteredJobPostings.length > 0}
                    onChange={selectAllJobs}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  Select All ({selectedJobs.length} selected)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleBulkExport}
                  disabled={selectedJobs.length === 0}
                  style={{
                    padding: '8px 16px',
                    background: selectedJobs.length === 0 ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedJobs.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3v12m0 0l-4-4m4 4l4-4M3 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Export Selected
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedJobs.length === 0}
                  style={{
                    padding: '8px 16px',
                    background: selectedJobs.length === 0 ? '#9ca3af' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedJobs.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  Delete Selected
                </button>
              </div>
            </div>
          )}

          {/* Message Display */}
          {message.text && (
            <div className={`quick-actions__message quick-actions__message--${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Enhanced Search Bar */}
          <div className="all-leads__search-container">
            <div className="all-leads__search-box" style={{ position: 'relative' }}>
              <svg className="all-leads__search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                className="all-leads__search-input"
                placeholder="Search job postings, companies, or roles..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit();
                  }
                }}
                onFocus={() => {
                  if (searchTerm.length > 0 || searchHistory.length > 0) {
                    setShowAutocomplete(true);
                  }
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowAutocomplete(false);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              )}

              {/* Autocomplete Dropdown */}
              {showAutocomplete && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '8px',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    zIndex: 1000,
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {searchSuggestions.length > 0 && (
                    <div>
                      <div style={{
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#6b7280',
                        borderBottom: '1px solid #e5e7eb',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Suggestions
                      </div>
                      {searchSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          onClick={() => selectSuggestion(suggestion)}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <div>
                            <div style={{ fontWeight: '500', marginBottom: '4px' }}>{suggestion.text}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {suggestion.job.experience_level}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchHistory.length > 0 && searchTerm.length === 0 && (
                    <div>
                      <div style={{
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: '#6b7280',
                        borderBottom: '1px solid #e5e7eb',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>Recent Searches</span>
                        <button
                          onClick={clearSearchHistory}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            padding: 0
                          }}
                        >
                          Clear
                        </button>
                      </div>
                      {searchHistory.map((term, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setSearchTerm(term);
                            setShowAutocomplete(false);
                          }}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: index < searchHistory.length - 1 ? '1px solid #f3f4f6' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ color: '#9ca3af' }}>
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                          </svg>
                          <span>{term}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '10px 16px',
                background: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                minWidth: '180px'
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="shared">Shared</option>
              <option value="not_shared">Not Shared</option>
            </select>

            {/* Date Filter Button */}
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              style={{
                padding: '10px 16px',
                background: (dateRange.from || dateRange.to) ? '#3b82f6' : 'white',
                color: (dateRange.from || dateRange.to) ? 'white' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
              </svg>
              Date Filter
            </button>

            {/* Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '10px 16px',
                background: (filters.experienceLevel || filters.owner) ? '#10b981' : 'white',
                color: (filters.experienceLevel || filters.owner) ? 'white' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd"/>
              </svg>
              Filters
            </button>

            {/* Total Counter - Inline */}
            <div style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginLeft: 'auto'
            }}>
              Showing {filteredJobPostings.length} jobs
            </div>
          </div>

          {/* Date Filter Panel */}
          {showDateFilter && (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '12px',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-end'
            }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setDateRange({ from: '', to: '' });
                }}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Filters Panel */}
          {showFilters && (
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '12px',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-end'
            }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  Experience Level
                </label>
                <select
                  value={filters.experienceLevel}
                  onChange={(e) => setFilters({ ...filters, experienceLevel: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">All Levels</option>
                  {experienceLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  Owner
                </label>
                <select
                  value={filters.owner}
                  onChange={(e) => setFilters({ ...filters, owner: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">All Owners</option>
                  {staffMembers.map(member => (
                    <option key={member.id} value={member.name}>{member.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setFilters({ experienceLevel: '', owner: '' });
                }}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Search Result Count */}
          {hasActiveFilters() && (
            <div style={{
              padding: '12px 16px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Showing <strong style={{ color: '#111827' }}>{filteredJobPostings.length}</strong> of <strong style={{ color: '#111827' }}>{jobPostings.length}</strong> job postings
              </span>
              <button
                onClick={clearAllFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Job Postings Grid */}
          {loading ? (
            <div className="all-leads__loading">Loading job postings...</div>
          ) : filteredJobPostings.length === 0 ? (
            <div style={{
              marginTop: '3rem',
              padding: '3rem 2rem',
              background: 'white',
              border: '2px dashed #d1d5db',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                style={{ margin: '0 auto 1.5rem', color: '#9ca3af' }}
              >
                <path
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {jobPostings.length === 0 ? (
                <>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '0.5rem'
                  }}>
                    No job postings yet
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '1.5rem',
                    maxWidth: '500px',
                    margin: '0 auto 1.5rem'
                  }}>
                    Start tracking job opportunities by adding your first job posting. Keep all your job listings organized in one place.
                  </p>
                  <button
                    className="action-button action-button--blue"
                    onClick={() => setActiveModal('newJobPosting')}
                    style={{
                      display: 'inline-flex',
                      margin: '0 auto'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Add Your First Job Posting
                  </button>
                </>
              ) : (
                <>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '0.5rem'
                  }}>
                    No matching results
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '1.5rem'
                  }}>
                    {searchTerm && `No job postings match "${searchTerm}". `}
                    Try adjusting your filters or search terms.
                  </p>
                  <button
                    onClick={clearAllFilters}
                    style={{
                      padding: '10px 20px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                    </svg>
                    Clear All Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="job-postings-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.5rem',
              marginTop: '1.5rem'
            }}>
              {filteredJobPostings.map(job => (
                <div
                  key={job.id}
                  className="all-leads__card"
                  style={{
                    marginBottom: 0,
                    border: bulkMode && selectedJobs.includes(job.id) ? '2px solid #3b82f6' : undefined,
                    position: 'relative'
                  }}
                >
                  <div className="all-leads__card-content">
                    {/* Bulk Selection Checkbox */}
                    {bulkMode && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        zIndex: 10
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedJobs.includes(job.id)}
                          onChange={() => toggleJobSelection(job.id)}
                          style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    )}

                    <div className="all-leads__card-header">
                      <h3 className="all-leads__card-name" style={{ marginBottom: '0.5rem' }}>
                        {job.job_title || 'Untitled Position'}
                      </h3>
                    </div>
                    <p className="all-leads__company" style={{ marginBottom: '1rem' }}>{job.company_name}</p>

                    <div className="all-leads__meta" style={{ marginBottom: '1rem' }}>
                      {job.experience_level && (
                        <span className="all-leads__status">
                          Level: <strong>{job.experience_level}</strong>
                        </span>
                      )}
                      <span className="all-leads__contact">
                        Posted: <strong>{getTimeAgo(job.created_at)}</strong>
                      </span>
                      {job.ownership && (
                        <span className="all-leads__status">
                          Owner: <strong>{job.ownership}</strong>
                        </span>
                      )}
                    </div>

                    {job.salary_range && (
                      <div style={{ marginBottom: '1rem' }}>
                        <span className="all-leads__status" style={{ color: '#059669' }}>
                          Salary: <strong>{job.salary_range}</strong>
                        </span>
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {/* Sectors Column */}
                      <div>
                        {(() => {
                          try {
                            let sectors = [];
                            if (job.aligned_sector) {
                              if (typeof job.aligned_sector === 'string') {
                                sectors = JSON.parse(job.aligned_sector);
                              } else if (Array.isArray(job.aligned_sector)) {
                                sectors = job.aligned_sector;
                              }
                            }
                            return (
                              <>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280', marginRight: '0.5rem' }}>
                                  Sectors:
                                </span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                  {sectors.length > 0 ? sectors.map((sector, index) => (
                                    <span key={index} style={{
                                      padding: '0.25rem 0.75rem',
                                      background: '#eff6ff',
                                      color: '#1e40af',
                                      border: '1px solid #bfdbfe',
                                      borderRadius: '6px',
                                      fontSize: '0.875rem'
                                    }}>
                                      {sector}
                                    </span>
                                  )) : (
                                    <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>N/A</span>
                                  )}
                                </div>
                              </>
                            );
                          } catch (error) {
                            return (
                              <>
                                <span style={{ fontSize: '0.875rem', color: '#6b7280', marginRight: '0.5rem' }}>
                                  Sectors:
                                </span>
                                <div style={{ marginTop: '0.5rem' }}>
                                  <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>N/A</span>
                                </div>
                              </>
                            );
                          }
                        })()}
                      </div>

                      {/* Status Column */}
                      <div>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginRight: '0.5rem' }}>
                          Status:
                        </span>
                        <div style={{ marginTop: '0.5rem' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            background: job.is_shared ? '#dcfce7' : '#fed7aa',
                            color: job.is_shared ? '#15803d' : '#c2410c',
                            border: `1px solid ${job.is_shared ? '#86efac' : '#fb923c'}`,
                            display: 'inline-block'
                          }}>
                            {job.is_shared ? `Shared - ${job.shared_date ? new Date(job.shared_date).toLocaleDateString() : 'N/A'}` : 'Not Shared'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="all-leads__card-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <button
                        className="all-leads__view-details"
                        onClick={() => {
                          setSelectedJobDetails(job);
                          setActiveModal('viewDetails');
                        }}
                        style={{ flex: '1 1 auto' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        View Details
                      </button>
                      {(job.job_url || job.job_posting_url) && (
                        <a
                          href={job.job_url || job.job_posting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="all-leads__view-details"
                          style={{ flex: '1 1 auto', textDecoration: 'none' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                          </svg>
                          Open Job
                        </a>
                      )}
                      <button
                        className="all-leads__delete-btn"
                        onClick={() => handleDeleteJobPosting(job.id, `${job.job_title} - ${job.company_name}`)}
                      >
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View Details Modal */}
          {activeModal === 'viewDetails' && selectedJobDetails && (
            <div className="modal-overlay" onClick={() => {
              setActiveModal(null);
              setSelectedJobDetails(null);
              setIsEditMode(false);
            }}>
              <div className="lead-details-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={(e) => {
                  e.stopPropagation();
                  setActiveModal(null);
                  setSelectedJobDetails(null);
                  setIsEditMode(false);
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <div className="lead-details">
                  {/* Header */}
                  <div className="lead-details__header">
                    <div style={{ flex: 1 }}>
                      {isEditMode ? (
                        <input
                          type="text"
                          className="lead-details__input"
                          style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '8px', width: '100%' }}
                          value={editFormData.job_title || ''}
                          onChange={(e) => setEditFormData({...editFormData, job_title: e.target.value})}
                          placeholder="Job Title"
                        />
                      ) : (
                        <h2 className="lead-details__title">{selectedJobDetails.job_title || 'Job Details'}</h2>
                      )}
                      <p className="lead-details__company">{selectedJobDetails.company_name}</p>
                    </div>
                    {!isEditMode ? (
                      <button
                        className="lead-details__edit-btn"
                        onClick={() => {
                          setIsEditMode(true);
                          // Parse aligned_sector if it's a string
                          let parsedSectors = [];
                          try {
                            if (selectedJobDetails.aligned_sector) {
                              if (typeof selectedJobDetails.aligned_sector === 'string') {
                                parsedSectors = JSON.parse(selectedJobDetails.aligned_sector);
                              } else if (Array.isArray(selectedJobDetails.aligned_sector)) {
                                parsedSectors = selectedJobDetails.aligned_sector;
                              }
                            }
                          } catch (e) {
                            parsedSectors = [];
                          }

                          setEditFormData({
                            job_title: selectedJobDetails.job_title || '',
                            company_name: selectedJobDetails.company_name || '',
                            job_url: selectedJobDetails.job_posting_url || selectedJobDetails.job_url || '',
                            experience_level: selectedJobDetails.experience_level || '',
                            salary_range: selectedJobDetails.salary_range || '',
                            aligned_sector: parsedSectors,
                            notes: selectedJobDetails.notes || ''
                          });
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          className="lead-details__save-btn"
                          onClick={handleSaveJobDetails}
                          disabled={loading}
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="lead-details__cancel-btn"
                          onClick={() => {
                            setIsEditMode(false);
                            setEditFormData({});
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 1: Company, Experience Level, Posted */}
                  <div style={{ marginBottom: '16px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div className="lead-details__info-item">
                        <span className="lead-details__label">Company:</span>
                        {isEditMode ? (
                          <input
                            type="text"
                            className="lead-details__input"
                            value={editFormData.company_name || ''}
                            onChange={(e) => setEditFormData({...editFormData, company_name: e.target.value})}
                            placeholder="Company Name"
                          />
                        ) : (
                          <span className="lead-details__value">{selectedJobDetails.company_name || 'N/A'}</span>
                        )}
                      </div>
                      <div className="lead-details__info-item">
                        <span className="lead-details__label">Experience Level:</span>
                        {isEditMode ? (
                          <select
                            className="lead-details__input"
                            value={editFormData.experience_level || ''}
                            onChange={(e) => setEditFormData({...editFormData, experience_level: e.target.value})}
                          >
                            <option value="">Select Level</option>
                            <option value="Entry Level">Entry Level</option>
                            <option value="Mid-Level">Mid-Level</option>
                            <option value="Senior">Senior</option>
                          </select>
                        ) : (
                          <span className="lead-details__value">{selectedJobDetails.experience_level || 'N/A'}</span>
                        )}
                      </div>
                      <div className="lead-details__info-item">
                        <span className="lead-details__label">Posted:</span>
                        <span className="lead-details__value">{getTimeAgo(selectedJobDetails.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Job URL, Salary Range, Aligned Sectors */}
                  <div style={{ marginBottom: '16px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div className="lead-details__info-item">
                        <span className="lead-details__label">Job URL:</span>
                        {isEditMode ? (
                          <input
                            type="url"
                            className="lead-details__input"
                            value={editFormData.job_url || ''}
                            onChange={(e) => setEditFormData({...editFormData, job_url: e.target.value})}
                            placeholder="https://..."
                          />
                        ) : (selectedJobDetails.job_posting_url || selectedJobDetails.job_url) ? (
                          <a href={selectedJobDetails.job_posting_url || selectedJobDetails.job_url} target="_blank" rel="noopener noreferrer" className="lead-details__link">
                            Open Job Posting
                          </a>
                        ) : (
                          <span className="lead-details__value">N/A</span>
                        )}
                      </div>
                      <div className="lead-details__info-item">
                        <span className="lead-details__label">Salary Range:</span>
                        {isEditMode ? (
                          <input
                            type="text"
                            className="lead-details__input"
                            value={editFormData.salary_range || ''}
                            onChange={(e) => setEditFormData({...editFormData, salary_range: e.target.value})}
                            placeholder="e.g., $80,000 - $120,000"
                          />
                        ) : (
                          <span className="lead-details__value">{selectedJobDetails.salary_range || 'Not Available'}</span>
                        )}
                      </div>
                      <div className="lead-details__info-item">
                        <span className="lead-details__label">Aligned Sectors:</span>
                        {isEditMode ? (
                          <select
                            className="lead-details__input"
                            value={Array.isArray(editFormData.aligned_sector) && editFormData.aligned_sector.length > 0 ? editFormData.aligned_sector[0] : ''}
                            onChange={(e) => setEditFormData({...editFormData, aligned_sector: e.target.value ? [e.target.value] : []})}
                          >
                            <option value="">Select Sector</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Software Engineer">Software Engineer</option>
                            <option value="Finance">Finance</option>
                            <option value="Manufacturing">Manufacturing</option>
                            <option value="Retail">Retail</option>
                            <option value="Construction">Construction</option>
                            <option value="Professional Services">Professional Services</option>
                            <option value="Education">Education</option>
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <span className="lead-details__value">
                            {(() => {
                              try {
                                let sectors = [];
                                if (selectedJobDetails.aligned_sector) {
                                  if (typeof selectedJobDetails.aligned_sector === 'string') {
                                    sectors = JSON.parse(selectedJobDetails.aligned_sector);
                                  } else if (Array.isArray(selectedJobDetails.aligned_sector)) {
                                    sectors = selectedJobDetails.aligned_sector;
                                  }
                                }
                                return sectors.length > 0 ? sectors.join(', ') : 'N/A';
                              } catch (error) {
                                return 'N/A';
                              }
                            })()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Owner */}
                  <div style={{ marginBottom: '16px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    <div className="lead-details__info-item">
                      <span className="lead-details__label">Owner:</span>
                      <span className="lead-details__value">{selectedJobDetails.ownership || 'Unassigned'}</span>
                    </div>
                  </div>

                  {/* Share with Builders Section */}
                  <div style={{ marginTop: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <h3 className="lead-details__section-title" style={{ marginBottom: '12px' }}>Share with Builders</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (selectedJobDetails.is_shared) return; // Disable toggle if already shared

                          const newSharedStatus = !selectedJobDetails.is_shared;
                          const newSharedDate = newSharedStatus ? new Date().toISOString().split('T')[0] : null;

                          try {
                            await jobPostingAPI.updateJobPosting(selectedJobDetails.id, {
                              is_shared: newSharedStatus,
                              shared_date: newSharedDate
                            });

                            setSelectedJobDetails({
                              ...selectedJobDetails,
                              is_shared: newSharedStatus,
                              shared_date: newSharedDate
                            });

                            showMessage('success', `Job ${newSharedStatus ? 'shared' : 'unshared'} successfully!`);
                            fetchJobPostings();
                          } catch (error) {
                            showMessage('error', 'Failed to update shared status');
                            console.error('Error updating shared status:', error);
                          }
                        }}
                        disabled={selectedJobDetails.is_shared}
                        style={{
                          padding: '10px 28px',
                          borderRadius: '6px',
                          border: 'none',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                          cursor: selectedJobDetails.is_shared ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          background: selectedJobDetails.is_shared ? '#10b981' : '#ef4444',
                          color: 'white',
                          opacity: selectedJobDetails.is_shared ? 0.7 : 1
                        }}
                      >
                        {selectedJobDetails.is_shared ? 'Yes - Shared' : 'No - Not Shared'}
                      </button>
                      {selectedJobDetails.is_shared && selectedJobDetails.shared_date && (
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          Shared on: {selectedJobDetails.shared_date}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* NOTE: Builder Applications section commented out - Will come back to this later */}
                  {/* Application Tracking Section */}
                  {/* 
                  <div style={{ marginTop: '20px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h3 className="lead-details__section-title" style={{ margin: 0 }}>Builder Applications</h3>
                        <span style={{
                          padding: '4px 12px',
                          background: applications.length > 0 ? '#3b82f6' : '#6b7280',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          display: 'none'
                        }}>
                          Total: {applications.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {applications.length > 0 && (
                          <button
                            onClick={() => setShowApplicationsList(!showApplicationsList)}
                            style={{
                              padding: '8px 16px',
                              background: showApplicationsList ? '#6b7280' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd"/>
                            </svg>
                            {showApplicationsList ? 'Hide Applications' : 'View Applications'}
                          </button>
                        )}
                      </div>
                    </div>
                    */}

                    {/* Applications List */}
                     {/*
                    {showApplicationsList && applications.length > 0 && (
                      <div style={{
                        marginBottom: '16px',
                        padding: '16px',
                        background: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <h4 style={{
                          margin: '0 0 12px 0',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          All Applications ({applications.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {applications.map((app) => (
                            <div key={app.id} style={{
                              padding: '12px',
                              background: '#f9fafb',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  color: '#111827',
                                  marginBottom: '4px'
                                }}>
                                  {app.builder_name}
                                </div>
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#6b7280',
                                  display: 'flex',
                                  gap: '12px',
                                  flexWrap: 'wrap'
                                }}>
                                  {app.builder_email && <span>{app.builder_email}</span>}
                                  {app.cohort && <span>• Cohort: {app.cohort}</span>}
                                  {app.shared_date && (
                                    <span>• Shared: {new Date(app.shared_date).toLocaleDateString()}</span>
                                  )}
                                  {app.applied_date && (
                                    <span>• Applied: {new Date(app.applied_date).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                              <div style={{
                                padding: '4px 12px',
                                background: getStatusColor(app.status),
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                whiteSpace: 'nowrap',
                                marginLeft: '12px'
                              }}>
                                {app.status}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    */}

                    {/* Detailed Applications Management */}
                     {/*
                    {applications.length === 0 ? (
                      <p style={{
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        padding: '20px'
                      }}>
                        No builders have been added to this job posting yet.
                      </p>
                    ) : !showApplicationsList ? (
                      <p style={{
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        padding: '12px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}>
                        Click "View Applications" to see all {applications.length} application{applications.length !== 1 ? 's' : ''} or manage them individually below.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {applications.map((app) => (
                          <div key={app.id} style={{
                            padding: '16px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                                  {app.builder_name}
                                </h4>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                                  {app.builder_email && `${app.builder_email}`}
                                  {app.cohort && ` • Cohort: ${app.cohort}`}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteApplication(app.id, app.builder_name)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}
                              >
                                Remove
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                                  Status
                                </label>
                                <select
                                  value={app.status}
                                  onChange={(e) => handleUpdateApplicationStatus(app.id, e.target.value)}
                                  disabled={loading}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '0.875rem',
                                    background: getStatusColor(app.status)
                                  }}
                                >
                                  <option value="Shared">Shared</option>
                                  <option value="Applied">Applied</option>
                                  <option value="Phone Screen">Phone Screen</option>
                                  <option value="Technical Interview">Technical Interview</option>
                                  <option value="Final Interview">Final Interview</option>
                                  <option value="Offer">Offer</option>
                                  <option value="Accepted">Accepted</option>
                                  <option value="Rejected">Rejected</option>
                                  <option value="Declined">Declined</option>
                                  <option value="Withdrawn">Withdrawn</option>
                                </select>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                                  Shared Date
                                </label>
                                <input
                                  type="text"
                                  value={app.shared_date ? new Date(app.shared_date).toLocaleDateString() : 'N/A'}
                                  disabled
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '0.875rem',
                                    background: '#f9fafb',
                                    color: '#6b7280'
                                  }}
                                />
                              </div>
                            </div>

                            {app.applied_date && (
                              <div style={{ marginBottom: '8px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                                  Applied Date
                                </label>
                                <input
                                  type="text"
                                  value={new Date(app.applied_date).toLocaleDateString()}
                                  disabled
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '0.875rem',
                                    background: '#f9fafb',
                                    color: '#6b7280'
                                  }}
                                />
                              </div>
                            )}

                            {app.notes && (
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                                  Notes
                                </label>
                                <p style={{
                                  margin: 0,
                                  padding: '8px',
                                  background: '#f9fafb',
                                  borderRadius: '4px',
                                  fontSize: '0.875rem',
                                  color: '#374151',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {app.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  */}
                  {/* End of commented Builder Applications section */}
                </div>
              </div>
            </div>
          )}

          {/* View Applications Only Modal */}
          {activeModal === 'viewApplicationsOnly' && viewApplicationsJobId && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <button className="modal-close" onClick={closeModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h2 className="modal-title" style={{ marginBottom: '8px' }}>
                      {jobPostings.find(j => j.id === viewApplicationsJobId)?.job_title || 'Job Posting'}
                    </h2>
                    <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>
                      {jobPostings.find(j => j.id === viewApplicationsJobId)?.company_name || ''}
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                    padding: '12px 16px',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd'
                  }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{ color: '#3b82f6' }}>
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                    </svg>
                    <div>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0369a1' }}>
                        Total Applications: {applications.length}
                      </span>
                    </div>
                  </div>

                  {applications.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 20 20"
                        fill="none"
                        style={{ margin: '0 auto 12px', color: '#9ca3af' }}
                      >
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                        No applications yet for this job posting.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {applications.map((app) => (
                        <div key={app.id} style={{
                          padding: '16px',
                          background: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '16px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: '600',
                              fontSize: '1rem',
                              color: '#111827',
                              marginBottom: '8px'
                            }}>
                              {app.builder_name}
                            </div>
                            <div style={{
                              fontSize: '0.875rem',
                              color: '#6b7280',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              {app.builder_email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                                  </svg>
                                  {app.builder_email}
                                </div>
                              )}
                              {app.cohort && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
                                  </svg>
                                  Cohort: {app.cohort}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                {app.shared_date && (
                                  <span>Shared: {new Date(app.shared_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                )}
                                {app.applied_date && (
                                  <span>• Applied: {new Date(app.applied_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            padding: '6px 14px',
                            background: getStatusColor(app.status),
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            whiteSpace: 'nowrap'
                          }}>
                            {app.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add Job Posting Modal */}
          {activeModal === 'newJobPosting' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <form className="modal-form" onSubmit={handleAddJobPosting}>
                  <h2 className="modal-title">Add Job Posting</h2>

                  {/* Date Field */}
                  <div className="form-section">
                    <label className="form-label">Date *</label>
                    <p className="form-help-text">Select the date for this job posting entry</p>
                    <input
                      type="date"
                      value={newJobPostingForm.outreach_date}
                      onChange={(e) => setNewJobPostingForm({...newJobPostingForm, outreach_date: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Job Posting Fields */}
                  <div className="form-section">
                    <label className="form-label">Job Posting URL *</label>
                    <p className="form-help-text">Paste URL from Greenhouse, LinkedIn, Indeed, or company career pages</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="url"
                        required
                        value={newJobPostingForm.job_posting_url}
                        onChange={(e) => setNewJobPostingForm({...newJobPostingForm, job_posting_url: e.target.value})}
                        className="form-input"
                        placeholder="https://boards.greenhouse.io/..."
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={handleFetchJobDetails}
                        disabled={isScraping || !newJobPostingForm.job_posting_url}
                        style={{
                          padding: '8px 16px',
                          background: isScraping ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isScraping || !newJobPostingForm.job_posting_url ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isScraping ? 'Fetching...' : 'Fetch Details'}
                      </button>
                    </div>
                  </div>

                  {/* Two-column layout for Job Title and Company Name */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-section">
                      <label className="form-label">Job Title *</label>
                      <input
                        type="text"
                        required
                        value={newJobPostingForm.job_title}
                        onChange={(e) => setNewJobPostingForm({...newJobPostingForm, job_title: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Senior Software Engineer"
                      />
                    </div>

                    <div className="form-section">
                      <label className="form-label">Company Name *</label>
                      <input
                        type="text"
                        required
                        value={newJobPostingForm.company_name}
                        onChange={(e) => setNewJobPostingForm({...newJobPostingForm, company_name: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Stripe"
                      />
                    </div>
                  </div>

                  {/* Two-column layout for Experience Level and Salary Range */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-section">
                      <label className="form-label">Experience Level *</label>
                      <select
                        required
                        value={newJobPostingForm.experience_level}
                        onChange={(e) => setNewJobPostingForm({...newJobPostingForm, experience_level: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Select Level</option>
                        {experienceLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-section">
                      <label className="form-label">Salary Range</label>
                      <input
                        type="text"
                        value={newJobPostingForm.salary_range}
                        onChange={(e) => setNewJobPostingForm({...newJobPostingForm, salary_range: e.target.value})}
                        className="form-input"
                        placeholder="e.g., $120,000 - $180,000"
                      />
                    </div>
                  </div>

                  {/* Two-column layout for Ownership and Aligned Sectors */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-section">
                      <label className="form-label">Ownership *</label>
                      <p className="form-help-text">Please select your name below</p>
                      <select
                        required
                        value={newJobPostingForm.ownership}
                        onChange={(e) => setNewJobPostingForm({...newJobPostingForm, ownership: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Please select your name below</option>
                        {staffMembers.map(member => (
                          <option key={member.id} value={member.name}>{member.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-section">
                      <label className="form-label">Aligned Sectors *</label>
                      <p className="form-help-text">Auto-filled from job URL or select manually</p>
                      <select
                        required
                        value={Array.isArray(newJobPostingForm.aligned_sector) ? (newJobPostingForm.aligned_sector[0] || '') : newJobPostingForm.aligned_sector}
                        onChange={(e) => {
                          setNewJobPostingForm({...newJobPostingForm, aligned_sector: [e.target.value]});
                        }}
                        className="form-select"
                      >
                        <option value="">Select a sector...</option>
                        {alignedSectorOptions.map(sector => (
                          <option key={sector} value={sector}>{sector}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Two-column layout for Shared Toggle and empty space */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-section">
                      <label className="form-label">Shared with Builders</label>
                      <p className="form-help-text">Toggle if job has been shared</p>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 0'
                      }}>
                        <button
                          type="button"
                          onClick={() => {
                            const newSharedStatus = !newJobPostingForm.is_shared;
                            setNewJobPostingForm({
                              ...newJobPostingForm,
                              is_shared: newSharedStatus,
                              shared_date: newSharedStatus ? new Date().toISOString().split('T')[0] : ''
                            });
                          }}
                          style={{
                            padding: '8px 24px',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: newJobPostingForm.is_shared ? '#10b981' : '#ef4444',
                            color: 'white'
                          }}
                        >
                          {newJobPostingForm.is_shared ? 'Yes - Shared' : 'No - Not Shared'}
                        </button>
                        {newJobPostingForm.is_shared && newJobPostingForm.shared_date && (
                          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            Shared on: {newJobPostingForm.shared_date}
                          </span>
                        )}
                      </div>
                    </div>
                    <div></div>
                  </div>

                  {/* Notes / Comments */}
                  <div className="form-section">
                    <label className="form-label">Notes / Comments</label>
                    <p className="form-help-text">
                      e.g., "Looks aligned with AI Builders" or "Company is known for hiring apprentices"
                    </p>
                    <textarea
                      value={newJobPostingForm.notes}
                      onChange={(e) => setNewJobPostingForm({...newJobPostingForm, notes: e.target.value})}
                      className="form-textarea"
                      rows="3"
                      placeholder="Add any relevant notes..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="modal-actions">
                    <button type="button" onClick={closeModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary">
                      {loading ? 'Adding...' : 'Add Job Posting'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default JobPostings;
