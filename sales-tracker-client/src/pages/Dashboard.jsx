import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import axios from 'axios';
import '../styles/Overview.css';
import '../styles/Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State for stats
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalOutreach: 0,
    last7DaysOutreach: 0,
    activeLeads: 0,
    jobPostings: 0
  });

  // State for tables
  const [closedWonJobs, setClosedWonJobs] = useState([]);
  const [outreachData, setOutreachData] = useState([]);

  // State for date filters
  const [closedWonDateRange, setClosedWonDateRange] = useState({ start: '', end: '' });
  const [outreachDateRange, setOutreachDateRange] = useState({ start: '', end: '' });

  // State for stage filter
  const [stageFilter, setStageFilter] = useState('');

  // State for sorting
  const [closedWonSort, setClosedWonSort] = useState({ column: null, direction: 'asc' });
  const [outreachSort, setOutreachSort] = useState({ column: null, direction: 'asc' });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchClosedWonJobs();
  }, [closedWonDateRange]);

  useEffect(() => {
    fetchOutreachData();
  }, [outreachDateRange]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch stats
      const statsResponse = await axios.get(`${API_URL}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setStats(statsResponse.data);

      // Initial fetch of tables
      await Promise.all([
        fetchClosedWonJobs(),
        fetchOutreachData()
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (error.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setLoading(false);
    }
  };

  const fetchClosedWonJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();

      if (closedWonDateRange.start) params.append('startDate', closedWonDateRange.start);
      if (closedWonDateRange.end) params.append('endDate', closedWonDateRange.end);

      const response = await axios.get(`${API_URL}/api/dashboard/closed-won?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setClosedWonJobs(response.data);
    } catch (error) {
      console.error('Error fetching closed won jobs:', error);
    }
  };

  const fetchOutreachData = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();

      if (outreachDateRange.start) params.append('startDate', outreachDateRange.start);
      if (outreachDateRange.end) params.append('endDate', outreachDateRange.end);

      const response = await axios.get(`${API_URL}/api/dashboard/outreach?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setOutreachData(response.data);
    } catch (error) {
      console.error('Error fetching outreach data:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return { date: '', daysAgo: '' };

    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    // Calculate days ago
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let daysAgo = '';
    if (diffDays === 0) {
      daysAgo = 'today';
    } else if (diffDays === 1) {
      daysAgo = '1 day ago';
    } else {
      daysAgo = `${diffDays} days ago`;
    }

    return { date: formatted, daysAgo: `(${daysAgo})` };
  };

  const formatStatus = (status) => {
    const statusMap = {
      'attempted': 'Initial Outreach',
      'active': 'Active Lead',
      'not_interested': 'Not Interested',
      'closed_won': 'Closed Won',
      'closed_lost': 'Closed Lost',
      'connected': 'Connected'
    };
    return statusMap[status?.toLowerCase()] || status;
  };

  const handleSort = (column, tableType) => {
    if (tableType === 'closedWon') {
      const newDirection = closedWonSort.column === column && closedWonSort.direction === 'asc' ? 'desc' : 'asc';
      setClosedWonSort({ column, direction: newDirection });
    } else {
      const newDirection = outreachSort.column === column && outreachSort.direction === 'asc' ? 'desc' : 'asc';
      setOutreachSort({ column, direction: newDirection });
    }
  };

  const sortData = (data, sortConfig) => {
    if (!sortConfig.column) return data;

    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.column];
      let bValue = b[sortConfig.column];

      // Handle null/undefined values
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Convert to lowercase for string comparison
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      // Compare values
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getSortIcon = (column, sortConfig) => {
    if (sortConfig.column !== column) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Apply sorting and filtering to data
  const sortedClosedWonJobs = sortData(closedWonJobs, closedWonSort);
  const filteredOutreachData = stageFilter
    ? outreachData.filter(outreach => outreach.stage === stageFilter)
    : outreachData;
  const sortedOutreachData = sortData(filteredOutreachData, outreachSort);

  if (loading) {
    return (
      <div className="overview">
        <div className="dashboard__loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="overview">
      <header className="overview__header">
        <div className="overview__header-content">
          <h1 className="overview__title">Pursuit, Talent & Partnership Tracker</h1>
          <div className="overview__user">
            <span className="overview__user-name">{user?.name}</span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="overview__button overview__button--logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="overview__nav">
        <button className="overview__nav-item overview__nav-item--active">
          Dashboard
        </button>
        <button
          className="overview__nav-item"
          onClick={() => navigate('/leads')}
        >
          All Leads
        </button>
        <button
          className="overview__nav-item"
          onClick={() => navigate('/job-postings')}
        >
          Job Postings
        </button>
        <button
          className="overview__nav-item"
          onClick={() => navigate('/leaderboard')}
        >
          Leaderboard
        </button>
      </nav>

      <main className="overview__main">

      {/* Stats Cards */}
      <div className="dashboard__stats">
        <div className="stat-card">
          <div className="stat-card__label">Jobs Won</div>
          <div className="stat-card__value">{stats.totalJobs}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Total Outreach</div>
          <div className="stat-card__value">{stats.totalOutreach}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Last 7 Days Outreach</div>
          <div className="stat-card__value">{stats.last7DaysOutreach}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Active Leads</div>
          <div className="stat-card__value">{stats.activeLeads}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__label">Job Postings</div>
          <div className="stat-card__value">{stats.jobPostings}</div>
        </div>
      </div>

      {/* Closed Won Jobs Table */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h3>Closed Won Jobs</h3>
          <div className="dashboard__date-filter">
            <label>From:</label>
            <input
              type="date"
              value={closedWonDateRange.start}
              onChange={(e) => setClosedWonDateRange({ ...closedWonDateRange, start: e.target.value })}
            />
            <label>To:</label>
            <input
              type="date"
              value={closedWonDateRange.end}
              onChange={(e) => setClosedWonDateRange({ ...closedWonDateRange, end: e.target.value })}
            />
            {(closedWonDateRange.start || closedWonDateRange.end) && (
              <button
                className="btn btn--small"
                onClick={() => setClosedWonDateRange({ start: '', end: '' })}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {closedWonJobs.length === 0 ? (
          <div className="dashboard__empty-state">
            <div className="dashboard__empty-icon">🎯</div>
            <h3>Let's Win!</h3>
            <p>Your first win is just around the corner. Keep pushing!</p>
          </div>
        ) : (
          <div className="dashboard__table-wrapper">
            <table className="dashboard__table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('company_name', 'closedWon')} style={{ cursor: 'pointer' }}>
                    Company {getSortIcon('company_name', closedWonSort)}
                  </th>
                  <th onClick={() => handleSort('role', 'closedWon')} style={{ cursor: 'pointer' }}>
                    Role {getSortIcon('role', closedWonSort)}
                  </th>
                  <th onClick={() => handleSort('industries', 'closedWon')} style={{ cursor: 'pointer' }}>
                    Industries {getSortIcon('industries', closedWonSort)}
                  </th>
                  <th onClick={() => handleSort('date', 'closedWon')} style={{ cursor: 'pointer' }}>
                    Date {getSortIcon('date', closedWonSort)}
                  </th>
                  <th onClick={() => handleSort('status', 'closedWon')} style={{ cursor: 'pointer' }}>
                    Status {getSortIcon('status', closedWonSort)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedClosedWonJobs.map((job) => {
                  const { date, daysAgo } = formatDate(job.date);
                  const displayStatus = formatStatus(job.status);
                  return (
                    <tr key={job.id}>
                      <td>{job.company_name}</td>
                      <td>{job.role}</td>
                      <td>{Array.isArray(job.industries) ? job.industries.join(', ') : job.industries}</td>
                      <td>
                        <div>{date}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{daysAgo}</div>
                      </td>
                      <td>
                        <span className={`status-badge status-badge--${displayStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                          {displayStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Outreach Table */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <h3>Outreach</h3>
          <div className="dashboard__date-filter">
            <label>Stage:</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', marginRight: '10px' }}
            >
              <option value="">All Stages</option>
              <option value="Initial Outreach">Initial Outreach</option>
              <option value="Active Lead">Active Lead</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Close Won">Close Won</option>
              <option value="Close Loss">Close Loss</option>
            </select>
            <label>From:</label>
            <input
              type="date"
              value={outreachDateRange.start}
              onChange={(e) => setOutreachDateRange({ ...outreachDateRange, start: e.target.value })}
            />
            <label>To:</label>
            <input
              type="date"
              value={outreachDateRange.end}
              onChange={(e) => setOutreachDateRange({ ...outreachDateRange, end: e.target.value })}
            />
            {(outreachDateRange.start || outreachDateRange.end || stageFilter) && (
              <button
                className="btn btn--small"
                onClick={() => {
                  setOutreachDateRange({ start: '', end: '' });
                  setStageFilter('');
                }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="dashboard__table-wrapper">
          <table className="dashboard__table">
            <thead>
              <tr>
                <th onClick={() => handleSort('staff_member', 'outreach')} style={{ cursor: 'pointer' }}>
                  Staff Member {getSortIcon('staff_member', outreachSort)}
                </th>
                <th onClick={() => handleSort('name', 'outreach')} style={{ cursor: 'pointer' }}>
                  Name {getSortIcon('name', outreachSort)}
                </th>
                <th onClick={() => handleSort('company_name', 'outreach')} style={{ cursor: 'pointer' }}>
                  Company {getSortIcon('company_name', outreachSort)}
                </th>
                <th onClick={() => handleSort('aligned_sector', 'outreach')} style={{ cursor: 'pointer' }}>
                  Role {getSortIcon('aligned_sector', outreachSort)}
                </th>
                <th onClick={() => handleSort('date_of_initial_outreach', 'outreach')} style={{ cursor: 'pointer' }}>
                  Date of Initial Outreach {getSortIcon('date_of_initial_outreach', outreachSort)}
                </th>
                <th onClick={() => handleSort('status', 'outreach')} style={{ cursor: 'pointer' }}>
                  Status {getSortIcon('status', outreachSort)}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedOutreachData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="dashboard__no-data">
                    No outreach records found for the selected date range.
                  </td>
                </tr>
              ) : (
                sortedOutreachData.map((outreach) => {
                  const { date, daysAgo } = formatDate(outreach.date_of_initial_outreach);
                  return (
                    <tr key={outreach.id}>
                      <td>{outreach.staff_member}</td>
                      <td>{outreach.name}</td>
                      <td>{outreach.company_name}</td>
                      <td>{outreach.aligned_sector || outreach.role}</td>
                      <td>
                        <div>{date}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{daysAgo}</div>
                      </td>
                      <td>
                        <span className={`status-badge status-badge--${(outreach.stage || '').toLowerCase().replace(/\s+/g, '-')}`}>
                          {outreach.stage}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      </main>
    </div>
  );
};

export default Dashboard;
