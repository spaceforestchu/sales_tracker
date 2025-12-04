import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { dashboardAPI } from '../services/api';
import '../styles/Overview.css';
import '../styles/Dashboard.css';

const Leaderboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedDays]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await dashboardAPI.getLeaderboard(selectedDays);
      setLeaderboard(data.leaderboard);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalIcon = (rank) => {
    if (rank === 1) {
      return <span style={{ fontSize: '1.5rem' }}>🥇</span>;
    }
    if (rank === 2) {
      return <span style={{ fontSize: '1.5rem' }}>🥈</span>;
    }
    if (rank === 3) {
      return <span style={{ fontSize: '1.5rem' }}>🥉</span>;
    }
    return <span style={{ fontWeight: 600, color: '#64748b' }}>#{rank}</span>;
  };

  return (
    <div className="overview">
      <header className="overview__header">
        <div className="overview__header-content">
          <h1 className="overview__title">Pursuit Outreach Tracker</h1>
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
        <button
          className="overview__nav-item"
          onClick={() => navigate('/job-postings')}
        >
          Job Postings
        </button>
        <button className="overview__nav-item overview__nav-item--active">
          Leaderboard
        </button>
      </nav>

      <main className="overview__main">
        <div className="dashboard__section">
          <div className="dashboard__section-header">
            <h3>Staff Outreach Leaderboard</h3>
            <div className="dashboard__date-filter">
              <label>Time Period:</label>
              <select
                value={selectedDays}
                onChange={(e) => setSelectedDays(parseInt(e.target.value))}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              >
                <option value="7">Last 7 Days</option>
                <option value="14">Last 14 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="0">All Time</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Loading leaderboard...
            </div>
          ) : (
            <div className="dashboard__table-container">
              <table className="dashboard__table">
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                    <th>Name</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>Outreach Count</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No data available
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((staff) => (
                      <tr
                        key={staff.id}
                        style={{
                          backgroundColor: user?.email === staff.email ? '#eff6ff' : staff.rank <= 3 ? '#fefce8' : 'white'
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          {getMedalIcon(staff.rank)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: user?.email === staff.email ? 600 : 400 }}>
                              {staff.name}
                            </span>
                            {user?.email === staff.email && (
                              <span style={{
                                backgroundColor: '#667eea',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px'
                              }}>
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.1rem' }}>
                          {staff.outreach_count}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Leaderboard;
