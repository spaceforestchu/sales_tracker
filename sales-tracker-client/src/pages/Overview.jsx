import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { outreachAPI, jobPostingAPI, builderAPI } from '../services/api';
import '../styles/Overview.css';

const Overview = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    leadsThisWeek: 0,
    activeBuilders: 34,
    hotLeads: 0,
    placements: 12,
    placementGoal: 34
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Fetch all data
      const outreachData = await outreachAPI.getAllOutreach();
      const jobPostingsData = await jobPostingAPI.getAllJobPostings();
      const buildersData = await builderAPI.getAllBuilders();

      // Calculate total leads (outreach + job postings)
      const totalLeads = outreachData.length + jobPostingsData.length;

      // Calculate leads this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const leadsThisWeek = [...outreachData, ...jobPostingsData].filter(item => {
        const createdDate = new Date(item.created_at);
        return createdDate >= oneWeekAgo;
      }).length;

      // Calculate hot leads (interested status in outreach)
      const hotLeads = outreachData.filter(item => 
        ['interested', 'meeting_scheduled', 'opportunity_created'].includes(item.status)
      ).length;

      // Calculate active builders (status = 'active')
      const activeBuilders = buildersData.filter(builder => 
        builder.status === 'active'
      ).length;

      // Calculate placements (builders with status = 'placed')
      const placements = buildersData.filter(builder => 
        builder.status === 'placed'
      ).length;

      // Calculate placement goal (total active builders)
      const placementGoal = buildersData.length;

      setMetrics({
        totalLeads,
        leadsThisWeek,
        activeBuilders,
        hotLeads,
        placements,
        placementGoal
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="overview">
      <header className="overview__header">
        <div className="overview__header-content">
          <h1 className="overview__title">Pursuit Outreach Tracker</h1>
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
        <div className="overview__content">
          <div className="overview__section-header">
            <h2 className="overview__section-title">Dashboard Overview</h2>
            <p className="overview__section-subtitle">Key metrics and performance indicators</p>
          </div>

          {loading ? (
            <div className="overview__loading">Loading metrics...</div>
          ) : (
            <div className="overview__metrics">
              {/* Total Leads */}
              <div className="overview__metric-card">
                <div className="overview__metric-header">
                  <span className="overview__metric-label">Total Leads</span>
                  <div className="overview__metric-icon overview__metric-icon--blue">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                </div>
                <div className="overview__metric-value">{metrics.totalLeads}</div>
                <div className="overview__metric-footer">
                  <span className="overview__metric-change overview__metric-change--positive">
                    ↑ {metrics.leadsThisWeek} this week
                  </span>
                </div>
              </div>

              {/* Active Builders */}
              <div className="overview__metric-card">
                <div className="overview__metric-header">
                  <span className="overview__metric-label">Active Builders</span>
                  <div className="overview__metric-icon overview__metric-icon--purple">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>
                <div className="overview__metric-value">{metrics.activeBuilders}</div>
                <div className="overview__metric-footer">
                  <span className="overview__metric-info">In pipeline</span>
                </div>
              </div>

              {/* Hot Leads */}
              <div className="overview__metric-card">
                <div className="overview__metric-header">
                  <span className="overview__metric-label">Hot Leads</span>
                  <div className="overview__metric-icon overview__metric-icon--red">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                </div>
                <div className="overview__metric-value">{metrics.hotLeads}</div>
                <div className="overview__metric-footer">
                  <span className="overview__metric-info">Needs follow-up</span>
                </div>
              </div>

              {/* Placements */}
              <div className="overview__metric-card">
                <div className="overview__metric-header">
                  <span className="overview__metric-label">Placements</span>
                  <div className="overview__metric-icon overview__metric-icon--green">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                </div>
                <div className="overview__metric-value">{metrics.placements}</div>
                <div className="overview__metric-footer">
                  <span className="overview__metric-info">Goal: {metrics.placementGoal}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Overview;

