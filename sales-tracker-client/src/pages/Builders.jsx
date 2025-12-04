import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { builderAPI, activityAPI, outreachAPI } from '../services/api';
import { exportBuildersToCSV } from '../utils/csvExport';
import '../styles/Overview.css';
import '../styles/Builders.css';
import '../styles/QuickActions.css';
import '../styles/AllLeads.css'; // For update history styles

const Builders = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [builders, setBuilders] = useState([]);
  const [filteredBuilders, setFilteredBuilders] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [leads, setLeads] = useState([]); // Store all leads for matching
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal state
  const [activeModal, setActiveModal] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedBuilder, setSelectedBuilder] = useState(null);
  const [editingUpdateIndex, setEditingUpdateIndex] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  
  // Form state
  const [newBuilderForm, setNewBuilderForm] = useState({
    name: '',
    cohort: '',
    email: '',
    linkedin_url: '',
    portfolio_url: '',
    years_experience: '',
    education: '',
    university: '',
    major: '',
    education_completed: false,
    date_of_birth: '',
    aligned_sector: [],
    sector_alignment_notes: '',
    role: '',
    skills: '',
    created_date: new Date().toISOString().split('T')[0],
    notes: '',
    next_steps: '',
    job_search_status: 'building_resume',
    offer_company_name: '',
    initial_salary: '',
    current_salary: '',
    offer_date: '',
    start_date: '',
    offer_notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterBuilders();
  }, [builders, searchTerm, selectedCohort, selectedStatus]);

  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      console.log(`Fetching data at ${timestamp}, forceRefresh: ${forceRefresh}`);
      
      // Force fresh data fetch without caching
      const [buildersData, cohortsData, leadsData] = await Promise.all([
        builderAPI.getAllBuilders(),
        builderAPI.getAllCohorts(),
        outreachAPI.getAllOutreach()
      ]);
      
      console.log('Fetched builders data:', buildersData);
      console.log('Builder statuses:', buildersData.map(b => ({ name: b.name, status: b.job_search_status })));
      
      // Clear existing state first
      setBuilders([]);
      setFilteredBuilders([]);
      
      // Then set new state to force complete re-render
      setTimeout(() => {
        setBuilders(buildersData);
        setFilteredBuilders(buildersData);
        setCohorts(cohortsData);
        setLeads(leadsData);
      }, 0);
    } catch (error) {
      console.error('Error fetching builders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterBuilders = () => {
    let filtered = [...builders];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(builder =>
        builder.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        builder.skills?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        builder.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply cohort filter
    if (selectedCohort !== 'all') {
      filtered = filtered.filter(builder => builder.cohort === selectedCohort);
    }

    // Apply status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(builder => builder.status === selectedStatus);
    }

    setFilteredBuilders(filtered);
  };

  // Constants for forms
  const educationLevels = [
    'High School',
    'Vocational',
    'Associate Degree (AA)',
    'Bachelor\'s Degree',
    'Master\'s Degree',
    'PhD',
    'Bootcamp/Certificate',
    'Other'
  ];

  const sectors = [
    'Finance',
    'Marketing',
    'Government',
    'Health',
    'Technology',
    'Education',
    'Non-Profit',
    'Other'
  ];

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedBuilder(null);
    setEditingUpdateIndex(null);
    setEditFormData({});
    setNewBuilderForm({
      name: '',
      cohort: '',
      email: '',
      linkedin_url: '',
      portfolio_url: '',
      years_experience: '',
      education: '',
      university: '',
      major: '',
      education_completed: false,
      date_of_birth: '',
      aligned_sector: [],
      sector_alignment_notes: '',
      role: '',
      skills: '',
      created_date: new Date().toISOString().split('T')[0],
      notes: '',
      next_steps: '',
      job_search_status: 'building_resume',
      offer_company_name: '',
      initial_salary: '',
      current_salary: '',
      offer_date: '',
      start_date: '',
      offer_notes: ''
    });
  };

  const handleEditBuilder = (builder) => {
    setSelectedBuilder(builder);
    setNewBuilderForm({
      name: builder.name || '',
      cohort: builder.cohort || '',
      email: builder.email || '',
      linkedin_url: builder.linkedin_url || '',
      portfolio_url: builder.portfolio_url || '',
      years_experience: builder.years_experience || '',
      education: builder.education || '',
      university: builder.university || '',
      major: builder.major || '',
      education_completed: builder.education_completed || false,
      date_of_birth: builder.date_of_birth || '',
      aligned_sector: builder.aligned_sector ? (Array.isArray(builder.aligned_sector) ? builder.aligned_sector : JSON.parse(builder.aligned_sector)) : [],
      sector_alignment_notes: builder.sector_alignment_notes || '',
      role: builder.role || '',
      skills: builder.skills || '',
      created_date: new Date().toISOString().split('T')[0],
      notes: builder.notes || '',
      next_steps: builder.next_steps || '',
      job_search_status: builder.job_search_status || 'building_resume',
      offer_company_name: builder.offer_company_name || '',
      initial_salary: builder.initial_salary || '',
      current_salary: builder.current_salary || '',
      offer_date: builder.offer_date || '',
      start_date: builder.start_date || '',
      offer_notes: builder.offer_notes || ''
    });
    setActiveModal('editBuilder');
  };

  const handleCompleteNextStep = async () => {
    if (!selectedBuilder || !selectedBuilder.next_steps) return;
    
    setLoading(true);
    try {
      const updateData = {
        next_steps: null, // Clear next steps when completed
        notes: selectedBuilder.notes 
          ? `${selectedBuilder.notes}\n\n[${new Date().toLocaleDateString()}] ✅ Completed: ${selectedBuilder.next_steps}`
          : `✅ Completed: ${selectedBuilder.next_steps}`
      };
      
      await builderAPI.updateBuilder(selectedBuilder.id, updateData);
      
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'completed_builder_task',
        entity_type: 'builder',
        entity_name: selectedBuilder.name,
        details: {
          completed_task: selectedBuilder.next_steps
        }
      });
      
      showMessage('success', 'Next step marked as completed!');
      fetchData();
      
      // Refresh the selected builder
      const updatedBuilders = await builderAPI.getAllBuilders();
      const updatedBuilder = updatedBuilders.find(b => b.id === selectedBuilder.id);
      if (updatedBuilder) {
        setSelectedBuilder(updatedBuilder);
        setNewBuilderForm({
          ...newBuilderForm,
          next_steps: ''
        });
      }
    } catch (error) {
      showMessage('error', 'Failed to complete next step.');
      console.error('Error completing next step:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBuilder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await builderAPI.createBuilder(newBuilderForm);
      
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'added_builder',
        entity_type: 'builder',
        entity_name: newBuilderForm.name,
        details: {
          cohort: newBuilderForm.cohort,
          role: newBuilderForm.role,
          sectors: newBuilderForm.aligned_sector
        }
      });
      
      showMessage('success', 'New builder added successfully!');
      closeModal();
      fetchData();
    } catch (error) {
      showMessage('error', 'Failed to add builder. Please try again.');
      console.error('Error adding builder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBuilder = async (e) => {
    e.preventDefault();
    if (!selectedBuilder) return;
    
    setLoading(true);
    try {
      // Build a detailed update note based on what changed
      const changes = [];
      const statusLabels = {
        'building_resume': 'Building Resume',
        'ready_to_apply': 'Ready to Apply',
        'actively_applying': 'Actively Applying',
        'interviewing': 'Interviewing',
        'offer_hired': 'Offer/Hired',
        'paused': 'Paused/On Hold'
      };
      
      if (newBuilderForm.name !== selectedBuilder.name) changes.push(`name to "${newBuilderForm.name}"`);
      if (newBuilderForm.cohort !== selectedBuilder.cohort) changes.push(`cohort to "${newBuilderForm.cohort}"`);
      if (newBuilderForm.email !== selectedBuilder.email) changes.push(`email to "${newBuilderForm.email}"`);
      if (newBuilderForm.role !== selectedBuilder.role) changes.push(`role to "${newBuilderForm.role}"`);
      if (newBuilderForm.years_experience !== selectedBuilder.years_experience) changes.push(`experience to ${newBuilderForm.years_experience} years`);
      if (newBuilderForm.education !== selectedBuilder.education) changes.push(`education to "${newBuilderForm.education}"`);
      if (newBuilderForm.linkedin_url !== selectedBuilder.linkedin_url) changes.push('LinkedIn URL');
      if (newBuilderForm.skills !== selectedBuilder.skills) changes.push('skills');
      
      // Track job search status changes
      if (newBuilderForm.job_search_status !== selectedBuilder.job_search_status) {
        const oldStatus = statusLabels[selectedBuilder.job_search_status] || 'Unknown';
        const newStatus = statusLabels[newBuilderForm.job_search_status] || 'Unknown';
        changes.push(`job status from "${oldStatus}" to "${newStatus}"`);
      }
      
      // Track offer details changes
      if (newBuilderForm.offer_company_name !== selectedBuilder.offer_company_name && newBuilderForm.offer_company_name) {
        changes.push(`offer from "${newBuilderForm.offer_company_name}"`);
      }
      if (newBuilderForm.current_salary !== selectedBuilder.current_salary && newBuilderForm.current_salary) {
        changes.push(`salary to $${newBuilderForm.current_salary}`);
      }
      
      const updateNote = changes.length > 0
        ? `[${new Date().toLocaleDateString()}] Updated: ${changes.join(', ')}`
        : `[${new Date().toLocaleDateString()}] Builder profile updated`;
      
      const updatedNotes = selectedBuilder.notes 
        ? `${selectedBuilder.notes}\n\n${updateNote}`
        : updateNote;
      
      // OPTIMISTIC UPDATE: Update UI immediately before API call
      const updatedBuilderData = {
        ...selectedBuilder,
        ...newBuilderForm,
        notes: updatedNotes
      };
      
      // Update the builders list immediately for instant UI feedback
      setBuilders(prevBuilders => 
        prevBuilders.map(b => b.id === selectedBuilder.id ? updatedBuilderData : b)
      );
      setFilteredBuilders(prevFiltered => 
        prevFiltered.map(b => b.id === selectedBuilder.id ? updatedBuilderData : b)
      );
      
      console.log('UI updated optimistically with:', updatedBuilderData.job_search_status);
      
      // Close modal immediately for better UX
      closeModal();
      
      // Show success message
      showMessage('success', 'Builder updated successfully!');
      
      // Update the builder in the background
      const updateResult = await builderAPI.updateBuilder(selectedBuilder.id, {
        ...newBuilderForm,
        notes: updatedNotes
      });
      
      console.log('Builder updated in backend:', updateResult);
      
      // Create activity log
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'updated_builder',
        entity_type: 'builder',
        entity_name: newBuilderForm.name,
        details: {
          cohort: newBuilderForm.cohort,
          role: newBuilderForm.role,
          changes: changes.join(', '),
          job_status: statusLabels[newBuilderForm.job_search_status]
        }
      });
      
      // Fetch fresh data in background to confirm
      console.log('Fetching fresh data to confirm...');
      await fetchData(true);
    } catch (error) {
      // Revert optimistic update on error
      console.error('Update failed, reverting optimistic update:', error);
      await fetchData(true); // Fetch fresh data to revert to server state
      showMessage('error', 'Failed to update builder. Please try again.');
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
          onClick={() => navigate('/overview')}
        >
          Overview
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
      </nav>

      <main className="overview__main">
        <div className="builders">
          <h2 className="builders__title">Builders</h2>

          {/* Action Button */}
          <div className="builders__action-buttons">
            <button
              className="action-button action-button--purple"
              onClick={() => setActiveModal('newBuilder')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Builder
            </button>
            <button
              className="action-button action-button--green"
              onClick={() => exportBuildersToCSV(filteredBuilders)}
              disabled={filteredBuilders.length === 0}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3v12m0 0l-4-4m4 4l4-4M3 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download CSV
            </button>
          </div>

          {/* Message Display */}
          {message.text && (
            <div className={`quick-actions__message quick-actions__message--${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Search Bar */}
          <div className="builders__search-container">
            <div className="builders__search-box">
              <svg className="builders__search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                className="builders__search-input"
                placeholder="Search builders by name or skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              className="builders__filter-button"
              onClick={() => setShowFilters(!showFilters)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2.5 5.83h15M5.83 10h8.34M8.33 14.17h3.34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Filters
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="builders__filters-panel">
              <div className="builders__filter-group">
                <label className="builders__filter-label">Cohort:</label>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="builders__filter-select"
                >
                  <option value="all">All Cohorts</option>
                  {cohorts.map(cohort => (
                    <option key={cohort} value={cohort}>{cohort}</option>
                  ))}
                </select>
              </div>

              <div className="builders__filter-group">
                <label className="builders__filter-label">Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="builders__filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="placed">Placed</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setSelectedCohort('all');
                  setSelectedStatus('all');
                  setSearchTerm('');
                }}
                className="builders__clear-filters"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Builders List */}
          {loading ? (
            <div className="builders__loading">Loading builders...</div>
          ) : filteredBuilders.length === 0 ? (
            <div className="builders__empty">
              <p>No builders found. {searchTerm && 'Try a different search term.'}</p>
            </div>
          ) : (
            <div className="builders__list">
              {filteredBuilders.map(builder => {
                // Get job search status label and color
                const getStatusDisplay = (status) => {
                  const statusMap = {
                    'building_resume': { label: 'Building Resume', color: '#ef4444' },
                    'ready_to_apply': { label: 'Ready to Apply', color: '#f97316' },
                    'actively_applying': { label: 'Actively Applying', color: '#eab308' },
                    'interviewing': { label: 'Interviewing', color: '#84cc16' },
                    'offer_hired': { label: 'Offer/Hired', color: '#a855f7' },
                    'paused': { label: 'Paused', color: '#6b7280' }
                  };
                  // Default to building_resume instead of generic 'Active'
                  return statusMap[status] || statusMap['building_resume'];
                };

                // Get matching companies based on aligned sectors
                const getMatchingCompanies = (builderSectors) => {
                  try {
                    if (!builderSectors || builderSectors.length === 0) return [];
                    
                    const matching = leads.filter(lead => {
                      if (!lead.aligned_sector) return false;
                      try {
                        const leadSectors = typeof lead.aligned_sector === 'string' 
                          ? JSON.parse(lead.aligned_sector)
                          : lead.aligned_sector;
                        return builderSectors.some(sector => leadSectors.includes(sector));
                      } catch (error) {
                        return false;
                      }
                    });
                    
                    // Sort by most recent (updated_at or created_at) and take top 5
                    return matching
                      .sort((a, b) => {
                        const dateA = new Date(a.updated_at || a.created_at || a.outreach_date);
                        const dateB = new Date(b.updated_at || b.created_at || b.outreach_date);
                        return dateB - dateA; // Most recent first
                      })
                      .slice(0, 5)
                      .map(lead => lead.company_name);
                  } catch (error) {
                    console.error('Error matching companies:', error);
                    return [];
                  }
                };

                // Use builder's job_search_status, defaulting to 'building_resume' if not set
                console.log(`Builder ${builder.name} status:`, builder.job_search_status);
                const statusDisplay = getStatusDisplay(builder.job_search_status || 'building_resume');
                const builderSectors = builder.aligned_sector 
                  ? (typeof builder.aligned_sector === 'string' ? JSON.parse(builder.aligned_sector) : builder.aligned_sector)
                  : [];
                
                const matchingCompanies = getMatchingCompanies(builderSectors);

                return (
                  <div key={`${builder.id}-${builder.job_search_status}`} className="builders__card">
                    <div className="builders__card-content">
                      <div className="builders__card-header">
                        <div className="builders__card-title-row">
                          <h3 className="builders__card-name">{builder.name}</h3>
                          <span 
                            className="builders__status-badge" 
                            style={{ backgroundColor: statusDisplay.color, color: '#ffffff' }}
                          >
                            {statusDisplay.label}
                          </span>
                        </div>
                        <button 
                          className="builders__edit-button"
                          onClick={() => handleEditBuilder(builder)}
                        >
                          Update Profile
                        </button>
                      </div>
                      <p className="builders__role">
                        {builder.role ? `Seeking: ${builder.role}` : 'No role specified'}
                      </p>
                      {builderSectors.length > 0 && (
                        <div className="builders__sectors-match">
                          <p className="builders__sectors-label">
                            🎯 Aligned Sectors: {builderSectors.join(', ')}
                          </p>
                          {matchingCompanies.length > 0 ? (
                            <div className="builders__matching-companies">
                              <p className="builders__matches-title">
                                Top {matchingCompanies.length} Recent Match{matchingCompanies.length !== 1 ? 'es' : ''}:
                              </p>
                              <ul className="builders__company-list">
                                {matchingCompanies.map((company, index) => (
                                  <li key={index} className="builders__company-item">
                                    • {company}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="builders__potential-matches">
                              No matching companies yet. Check All Leads for companies in {builderSectors.join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                      {builder.cohort && (
                        <span className="builders__cohort-badge">{builder.cohort}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modal */}
          {activeModal && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <form className="modal-form" onSubmit={activeModal === 'editBuilder' ? handleUpdateBuilder : handleAddBuilder}>
                  <h2 className="modal-title">{activeModal === 'editBuilder' ? 'Edit Builder Profile' : 'Add New Builder'}</h2>

                  {/* Date Field */}
                  <div className="form-section">
                    <label className="form-label">Date *</label>
                    <p className="form-help-text">Select the date for this builder entry (useful for recording past builders)</p>
                    <input
                      type="date"
                      value={newBuilderForm.created_date}
                      onChange={(e) => setNewBuilderForm({...newBuilderForm, created_date: e.target.value})}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-section">
                      <label className="form-label">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={newBuilderForm.name}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, name: e.target.value})}
                        className="form-input"
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div className="form-section">
                      <label className="form-label">Cohort *</label>
                      <input
                        type="text"
                        required
                        value={newBuilderForm.cohort}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, cohort: e.target.value})}
                        className="form-input"
                        placeholder="Cohort 1"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-section">
                      <label className="form-label">Pursuit Email *</label>
                      <input
                        type="email"
                        required
                        value={newBuilderForm.email}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, email: e.target.value})}
                        className="form-input"
                        placeholder="jane@pursuit.org"
                      />
                    </div>
                    <div className="form-section">
                      <label className="form-label">Years of Experience</label>
                      <input
                        type="number"
                        value={newBuilderForm.years_experience}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, years_experience: e.target.value})}
                        className="form-input"
                        placeholder="2"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div className="form-row">
                    <div className="form-section">
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        value={newBuilderForm.date_of_birth}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, date_of_birth: e.target.value})}
                        className="form-input"
                      />
                    </div>
                    <div className="form-section">
                      <label className="form-label">Education Level</label>
                      <select
                        value={newBuilderForm.education}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, education: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Select Education</option>
                        {educationLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* University and Major */}
                  <div className="form-row">
                    <div className="form-section">
                      <label className="form-label">University Name</label>
                      <input
                        type="text"
                        value={newBuilderForm.university}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, university: e.target.value})}
                        className="form-input"
                        placeholder="e.g., City University of New York"
                      />
                    </div>
                    <div className="form-section">
                      <label className="form-label">Major/Field of Study</label>
                      <input
                        type="text"
                        value={newBuilderForm.major}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, major: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Computer Science"
                      />
                    </div>
                  </div>

                  {/* Education Completed */}
                  <div className="form-section">
                    <label className="form-checkbox-container">
                      <input
                        type="checkbox"
                        checked={newBuilderForm.education_completed}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, education_completed: e.target.checked})}
                        className="form-checkbox"
                      />
                      <span className="form-checkbox-label">Education Completed</span>
                    </label>
                  </div>

                  {/* Aligned Sectors - Multi-select */}
                  <div className="form-section">
                    <label className="form-label">Aligned Sectors *</label>
                    <p className="form-help-text">Select all sectors where this builder would be a good fit</p>
                    <div className="sector-checkboxes">
                      {sectors.map(sector => (
                        <label key={sector} className="sector-checkbox-item">
                          <input
                            type="checkbox"
                            checked={newBuilderForm.aligned_sector.includes(sector)}
                            onChange={(e) => {
                              const updatedSectors = e.target.checked
                                ? [...newBuilderForm.aligned_sector, sector]
                                : newBuilderForm.aligned_sector.filter(s => s !== sector);
                              setNewBuilderForm({...newBuilderForm, aligned_sector: updatedSectors});
                            }}
                            className="sector-checkbox"
                          />
                          <span className="sector-checkbox-text">{sector}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Sector Alignment Notes */}
                  <div className="form-section">
                    <label className="form-label">Sector Alignment Notes</label>
                    <p className="form-help-text">Explain why this builder would be a good fit for the selected sectors</p>
                    <textarea
                      value={newBuilderForm.sector_alignment_notes}
                      onChange={(e) => setNewBuilderForm({...newBuilderForm, sector_alignment_notes: e.target.value})}
                      className="form-textarea"
                      rows="3"
                      placeholder="e.g., Has experience with healthcare APIs and regulatory compliance, strong interest in fintech..."
                    />
                  </div>

                  <div className="form-section">
                    <label className="form-label">Builder's Desired Role *</label>
                    <input
                      type="text"
                      required
                      value={newBuilderForm.role}
                      onChange={(e) => setNewBuilderForm({...newBuilderForm, role: e.target.value})}
                      className="form-input"
                      placeholder="Full-Stack Developer"
                    />
                  </div>

                  {/* Job Search Status - Only show when editing */}
                  {activeModal === 'editBuilder' && (
                    <div className="form-section" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e0e0e0' }}>
                      <label className="form-label">Job Search Status *</label>
                      <p className="form-help-text">Select the builder's current stage in their job search journey</p>
                      <div className="job-status-buttons">
                        <button
                          type="button"
                          className={`job-status-btn job-status-btn--red ${newBuilderForm.job_search_status === 'building_resume' ? 'job-status-btn--active' : ''}`}
                          onClick={() => setNewBuilderForm({...newBuilderForm, job_search_status: 'building_resume'})}
                        >
                          Building Resume
                        </button>
                        <button
                          type="button"
                          className={`job-status-btn job-status-btn--orange ${newBuilderForm.job_search_status === 'ready_to_apply' ? 'job-status-btn--active' : ''}`}
                          onClick={() => setNewBuilderForm({...newBuilderForm, job_search_status: 'ready_to_apply'})}
                        >
                          Ready to Apply
                        </button>
                        <button
                          type="button"
                          className={`job-status-btn job-status-btn--yellow ${newBuilderForm.job_search_status === 'actively_applying' ? 'job-status-btn--active' : ''}`}
                          onClick={() => setNewBuilderForm({...newBuilderForm, job_search_status: 'actively_applying'})}
                        >
                          Actively Applying
                        </button>
                        <button
                          type="button"
                          className={`job-status-btn job-status-btn--light-green ${newBuilderForm.job_search_status === 'interviewing' ? 'job-status-btn--active' : ''}`}
                          onClick={() => setNewBuilderForm({...newBuilderForm, job_search_status: 'interviewing'})}
                        >
                          Interviewing
                        </button>
                        <button
                          type="button"
                          className={`job-status-btn job-status-btn--purple ${newBuilderForm.job_search_status === 'offer_hired' ? 'job-status-btn--active' : ''}`}
                          onClick={() => setNewBuilderForm({...newBuilderForm, job_search_status: 'offer_hired'})}
                        >
                          Offer/Hired
                        </button>
                        <button
                          type="button"
                          className={`job-status-btn job-status-btn--gray ${newBuilderForm.job_search_status === 'paused' ? 'job-status-btn--active' : ''}`}
                          onClick={() => setNewBuilderForm({...newBuilderForm, job_search_status: 'paused'})}
                        >
                          Paused/On Hold
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Offer Details - Only show when status is offer_hired */}
                  {activeModal === 'editBuilder' && newBuilderForm.job_search_status === 'offer_hired' && (
                    <div className="form-section" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px solid #10b981', background: '#f0fdf4', padding: '20px', borderRadius: '8px' }}>
                      <h3 style={{ marginTop: 0, color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎉 Offer Details
                      </h3>
                      
                      <div className="form-section">
                        <label className="form-label">Company Name *</label>
                        <input
                          type="text"
                          value={newBuilderForm.offer_company_name}
                          onChange={(e) => setNewBuilderForm({...newBuilderForm, offer_company_name: e.target.value})}
                          className="form-input"
                          placeholder="e.g., Google, Microsoft"
                        />
                      </div>

                      <div className="form-row">
                        <div className="form-section">
                          <label className="form-label">Initial Salary (Pre-Pursuit)</label>
                          <input
                            type="number"
                            value={newBuilderForm.initial_salary}
                            onChange={(e) => setNewBuilderForm({...newBuilderForm, initial_salary: e.target.value})}
                            className="form-input"
                            placeholder="50000"
                            step="1000"
                          />
                        </div>
                        <div className="form-section">
                          <label className="form-label">Current Salary *</label>
                          <input
                            type="number"
                            value={newBuilderForm.current_salary}
                            onChange={(e) => setNewBuilderForm({...newBuilderForm, current_salary: e.target.value})}
                            className="form-input"
                            placeholder="75000"
                            step="1000"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-section">
                          <label className="form-label">Offer Date</label>
                          <input
                            type="date"
                            value={newBuilderForm.offer_date}
                            onChange={(e) => setNewBuilderForm({...newBuilderForm, offer_date: e.target.value})}
                            className="form-input"
                          />
                        </div>
                        <div className="form-section">
                          <label className="form-label">Start Date</label>
                          <input
                            type="date"
                            value={newBuilderForm.start_date}
                            onChange={(e) => setNewBuilderForm({...newBuilderForm, start_date: e.target.value})}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <div className="form-section">
                        <label className="form-label">Additional Notes</label>
                        <textarea
                          value={newBuilderForm.offer_notes}
                          onChange={(e) => setNewBuilderForm({...newBuilderForm, offer_notes: e.target.value})}
                          className="form-textarea"
                          rows="3"
                          placeholder="Benefits, relocation, remote work details, etc."
                        />
                      </div>
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-section">
                      <label className="form-label">LinkedIn Profile</label>
                      <input
                        type="url"
                        value={newBuilderForm.linkedin_url}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, linkedin_url: e.target.value})}
                        className="form-input"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                    <div className="form-section">
                      <label className="form-label">Resume URL</label>
                      <input
                        type="url"
                        value={newBuilderForm.portfolio_url}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, portfolio_url: e.target.value})}
                        className="form-input"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="form-section">
                    <label className="form-label">Skills & Technologies</label>
                    <textarea
                      value={newBuilderForm.skills}
                      onChange={(e) => setNewBuilderForm({...newBuilderForm, skills: e.target.value})}
                      className="form-textarea"
                      rows="3"
                      placeholder="React, Node.js, PostgreSQL, AWS, etc."
                    />
                  </div>

                  {/* Next Steps - Only show when editing */}
                  {activeModal === 'editBuilder' && (
                    <div className="form-section" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e0e0e0' }}>
                      <label className="form-label">Next Steps</label>
                      <p className="form-help-text">Add action items or follow-up tasks for this builder</p>
                      <input
                        type="text"
                        value={newBuilderForm.next_steps}
                        onChange={(e) => setNewBuilderForm({...newBuilderForm, next_steps: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Schedule interview prep session, Review portfolio projects, Send resume to X company"
                      />
                    </div>
                  )}

                  {/* Current Next Steps Display - Only show when editing and has existing next steps */}
                  {activeModal === 'editBuilder' && selectedBuilder && selectedBuilder.next_steps && (
                    <div className="form-section" style={{ marginTop: '16px' }}>
                      <div className="lead-details__next-steps">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 className="lead-details__section-title" style={{ margin: 0 }}>📌 Current Next Steps</h3>
                          <button 
                            type="button"
                            className="lead-details__complete-btn"
                            onClick={handleCompleteNextStep}
                            disabled={loading}
                          >
                            ✓ Mark as Completed
                          </button>
                        </div>
                        <p className="lead-details__next-steps-text">
                          {selectedBuilder.next_steps}
                        </p>
                        {(() => {
                          // Calculate days since next step was created (using updated_at as a proxy)
                          const lastUpdate = new Date(selectedBuilder.updated_at || selectedBuilder.created_at);
                          const today = new Date();
                          const diffTime = Math.abs(today - lastUpdate);
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          
                          return (
                            <div className="lead-details__next-steps-days">
                              📅 Created {diffDays} day{diffDays !== 1 ? 's' : ''} ago
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Update History - Only show when editing */}
                  {activeModal === 'editBuilder' && selectedBuilder && (
                    <div className="form-section" style={{ marginTop: '32px', paddingTop: '32px', borderTop: '2px solid #e0e0e0' }}>
                      <h3 className="lead-details__section-title">📝 Update History</h3>
                      <div className="lead-details__timeline">
                        {(() => {
                          const notes = selectedBuilder.notes || '';
                          const updates = [];
                          
                          // Split notes by date pattern [MM/DD/YYYY]
                          const datePattern = /\[(\d{1,2}\/\d{1,2}\/\d{4})\]/g;
                          const parts = notes.split(datePattern);
                          
                          // Parse into update objects
                          for (let i = 1; i < parts.length; i += 2) {
                            if (parts[i] && parts[i + 1]) {
                              updates.push({
                                date: parts[i],
                                content: parts[i + 1].trim()
                              });
                            }
                          }
                          
                          // If no timestamped updates, show the raw notes
                          if (updates.length === 0 && notes.trim()) {
                            updates.push({
                              date: new Date(selectedBuilder.created_at).toLocaleDateString(),
                              content: notes
                            });
                          }
                          
                          // If still no updates, show initial creation
                          if (updates.length === 0) {
                            updates.push({
                              date: new Date(selectedBuilder.created_at || Date.now()).toLocaleDateString(),
                              content: 'Builder profile created'
                            });
                          }
                          
                          // Reverse to show most recent first
                          const reversedUpdates = [...updates].reverse();
                          
                          return reversedUpdates.map((update, index) => {
                            const originalIndex = updates.length - 1 - index;
                            const isEditing = editingUpdateIndex === index;
                            
                            return (
                              <div key={index} className="lead-details__update-card">
                                {isEditing ? (
                                  <>
                                    <input
                                      type="text"
                                      className="lead-details__update-date-input"
                                      value={editFormData[`update_${index}_date`] || update.date}
                                      onChange={(e) => setEditFormData({
                                        ...editFormData,
                                        [`update_${index}_date`]: e.target.value
                                      })}
                                      placeholder="MM/DD/YYYY"
                                    />
                                    <textarea
                                      className="lead-details__update-content-input"
                                      value={editFormData[`update_${index}_content`] || update.content}
                                      onChange={(e) => setEditFormData({
                                        ...editFormData,
                                        [`update_${index}_content`]: e.target.value
                                      })}
                                      rows="3"
                                    />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                      <button
                                        type="button"
                                        className="lead-details__update-save-btn"
                                        onClick={async () => {
                                          // Rebuild notes with updated values
                                          const updatedUpdates = updates.map((u, i) => ({
                                            date: i === originalIndex ? (editFormData[`update_${index}_date`] || u.date) : u.date,
                                            content: i === originalIndex ? (editFormData[`update_${index}_content`] || u.content) : u.content
                                          }));
                                          
                                          const newNotes = updatedUpdates
                                            .map(u => `[${u.date}] ${u.content}`)
                                            .join('\n\n');
                                          
                                          setLoading(true);
                                          try {
                                            await builderAPI.updateBuilder(selectedBuilder.id, { notes: newNotes });
                                            showMessage('success', 'Update history edited successfully!');
                                            setEditingUpdateIndex(null);
                                            fetchData();
                                            
                                            // Refresh selected builder
                                            const updatedBuilders = await builderAPI.getAllBuilders();
                                            const updatedBuilder = updatedBuilders.find(b => b.id === selectedBuilder.id);
                                            if (updatedBuilder) {
                                              setSelectedBuilder(updatedBuilder);
                                            }
                                          } catch (error) {
                                            showMessage('error', 'Failed to update history.');
                                          } finally {
                                            setLoading(false);
                                          }
                                        }}
                                      >
                                        💾 Save
                                      </button>
                                      <button
                                        type="button"
                                        className="lead-details__update-cancel-btn"
                                        onClick={() => {
                                          setEditingUpdateIndex(null);
                                          setEditFormData({});
                                        }}
                                      >
                                        ✖️ Cancel
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div className="lead-details__update-date">{update.date}</div>
                                      <button
                                        type="button"
                                        className="lead-details__update-edit-btn"
                                        onClick={() => {
                                          setEditingUpdateIndex(index);
                                          setEditFormData({
                                            [`update_${index}_date`]: update.date,
                                            [`update_${index}_content`]: update.content
                                          });
                                        }}
                                      >
                                        ✏️ Edit
                                      </button>
                                    </div>
                                    <div className="lead-details__update-content">{update.content}</div>
                                  </>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="modal-actions">
                    <button type="button" onClick={closeModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary">
                      {loading ? (activeModal === 'editBuilder' ? 'Updating...' : 'Adding...') : (activeModal === 'editBuilder' ? 'Update Builder' : 'Add Builder')}
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

export default Builders;

