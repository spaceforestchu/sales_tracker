import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { outreachAPI, builderAPI, userAPI, activityAPI } from '../services/api';
import '../styles/Overview.css';
import '../styles/QuickActions.css';

const QuickActions = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeAction, setActiveAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Staff list for ownership
  const [staffMembers, setStaffMembers] = useState([]);

  // Form states
  const [newLeadForm, setNewLeadForm] = useState({
    lead_type: 'contact',
    company_name: '',
    contact_name: '',
    contact_title: '',
    contact_email: '',
    linkedin_url: '',
    outreach_date: new Date().toISOString().split('T')[0],
    lead_temperature: 'cold',
    source: 'personal',
    stage: 'Initial Outreach',
    ownership: user?.name || '',
    notes: '',
    aligned_sector: [], // New field for matching builders
    // Job posting specific fields
    job_title: '',
    job_posting_url: '',
    experience_level: ''
  });

  const [updateLeadForm, setUpdateLeadForm] = useState({
    search: '',
    selectedLead: null,
    stage: '',
    lead_temperature: '',
    notes: '',
    next_steps: '',
    update_date: new Date().toISOString().split('T')[0]
  });

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
    created_date: new Date().toISOString().split('T')[0]
  });

  // Search results for leads
  const [leadSearchResults, setLeadSearchResults] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [showMyLeadsOnly, setShowMyLeadsOnly] = useState(false);

  useEffect(() => {
    fetchStaffMembers();
    fetchAllLeads();
  }, []);

  const fetchStaffMembers = async () => {
    try {
      const users = await userAPI.getAllUsers();
      // Include all active users for ownership dropdown
      setStaffMembers(users.filter(u => u.is_active !== false));
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchAllLeads = async () => {
    try {
      const leads = await outreachAPI.getAllOutreach();
      setAllLeads(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  // Handle lead search
  useEffect(() => {
    if (updateLeadForm.search.length > 1) {
      let filtered = allLeads.filter(lead =>
        lead.company_name?.toLowerCase().includes(updateLeadForm.search.toLowerCase()) ||
        lead.contact_name?.toLowerCase().includes(updateLeadForm.search.toLowerCase()) ||
        lead.contact_email?.toLowerCase().includes(updateLeadForm.search.toLowerCase())
      );
      
      // Filter by ownership if "My Leads" is active
      if (showMyLeadsOnly) {
        filtered = filtered.filter(lead => lead.ownership === user?.name);
      }
      
      setLeadSearchResults(filtered.slice(0, 5));
    } else {
      setLeadSearchResults([]);
    }
  }, [updateLeadForm.search, allLeads, showMyLeadsOnly, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const closeModal = () => {
    setActiveAction(null);
    // Reset forms
    setNewLeadForm({
      lead_type: 'contact',
      company_name: '',
      contact_name: '',
      contact_title: '',
      contact_email: '',
      linkedin_url: '',
      outreach_date: new Date().toISOString().split('T')[0],
      lead_temperature: 'cold',
      source: 'personal',
      stage: 'Initial Outreach',
      ownership: user?.name || '',
      notes: '',
      aligned_sector: [],
      job_title: '',
      job_posting_url: '',
      experience_level: ''
    });
    setUpdateLeadForm({
      search: '',
      selectedLead: null,
      stage: '',
      lead_temperature: '',
      notes: '',
      next_steps: '',
      update_date: new Date().toISOString().split('T')[0]
    });
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
      created_date: new Date().toISOString().split('T')[0]
    });
    setShowMyLeadsOnly(false); // Reset the filter
  };

  // Add New Lead
  const handleAddNewLead = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await outreachAPI.createOutreach(newLeadForm);
      
      // Log activity
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'added_lead',
        entity_type: 'lead',
        entity_name: `${newLeadForm.contact_name} - ${newLeadForm.company_name}`,
        details: {
          company: newLeadForm.company_name,
          temperature: newLeadForm.lead_temperature,
          source: newLeadForm.source
        }
      });
      
      showMessage('success', 'New lead added successfully!');
      closeModal();
      fetchAllLeads(); // Refresh leads
    } catch (error) {
      showMessage('error', 'Failed to add lead. Please try again.');
      console.error('Error adding lead:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update Lead Status
  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!updateLeadForm.selectedLead) {
      showMessage('error', 'Please select a lead to update.');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        stage: updateLeadForm.stage,
        lead_temperature: updateLeadForm.lead_temperature,
        next_steps: updateLeadForm.next_steps,
        notes: updateLeadForm.selectedLead.notes 
          ? `${updateLeadForm.selectedLead.notes}\n\n[${new Date().toLocaleDateString()}] ${updateLeadForm.notes}`
          : updateLeadForm.notes
      };

      await outreachAPI.updateOutreach(updateLeadForm.selectedLead.id, updateData);
      
      // Log activity
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'updated_lead',
        entity_type: 'lead',
        entity_name: `${updateLeadForm.selectedLead.contact_name} - ${updateLeadForm.selectedLead.company_name}`,
        details: {
          old_stage: updateLeadForm.selectedLead.stage,
          new_stage: updateLeadForm.stage,
          temperature: updateLeadForm.lead_temperature,
          company: updateLeadForm.selectedLead.company_name
        }
      });
      
      showMessage('success', 'Lead status updated successfully!');
      closeModal();
      fetchAllLeads(); // Refresh leads
    } catch (error) {
      showMessage('error', 'Failed to update lead. Please try again.');
      console.error('Error updating lead:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add Builder
  const handleAddBuilder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await builderAPI.createBuilder(newBuilderForm);
      
      // Log activity
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'added_builder',
        entity_type: 'builder',
        entity_name: newBuilderForm.name,
        details: {
          cohort: newBuilderForm.cohort,
          role: newBuilderForm.role,
          aligned_sector: newBuilderForm.aligned_sector
        }
      });
      
      showMessage('success', 'New builder added successfully!');
      closeModal();
    } catch (error) {
      showMessage('error', 'Failed to add builder. Please try again.');
      console.error('Error adding builder:', error);
    } finally {
      setLoading(false);
    }
  };

  const stages = [
    'Initial Outreach',
    'Email Campaign',
    'Follow-up',
    'Sales Pitch Meeting',
    'Follow-up Resources Sent',
    'Interested',
    'Not Interested'
  ];

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
    'Retail',
    'Other'
  ];

  const jobPostingSources = [
    'LinkedIn',
    'Indeed',
    'Company Site',
    'Referral'
  ];

  const experienceLevels = [
    'Entry-Level',
    'Mid-Level',
    'Senior'
  ];

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
        <button
          className="overview__nav-item"
          onClick={() => navigate('/builders')}
        >
          Builders
        </button>
        <button
          className="overview__nav-item"
          onClick={() => navigate('/activity')}
        >
          Activity Feed
        </button>
        <button className="overview__nav-item overview__nav-item--active">
          Quick Actions
        </button>
      </nav>

      <main className="overview__main">
        <div className="quick-actions">
          <h2 className="quick-actions__title">Quick Actions</h2>
          <p className="quick-actions__subtitle">Add new data and update existing records</p>

          {/* Message Display */}
          {message.text && (
            <div className={`quick-actions__message quick-actions__message--${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Action Cards */}
          <div className="quick-actions__cards">
            {/* Add New Lead Card */}
            <button
              className="quick-actions__card quick-actions__card--blue"
              onClick={() => setActiveAction('newLead')}
            >
              <div className="quick-actions__card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="quick-actions__card-title">Add New Lead</h3>
              <p className="quick-actions__card-description">Create a new contact or job posting lead</p>
            </button>

            {/* Update Lead Status Card */}
            <button
              className="quick-actions__card quick-actions__card--gray"
              onClick={() => setActiveAction('updateLead')}
            >
              <div className="quick-actions__card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="quick-actions__card-title">Update Lead Status</h3>
              <p className="quick-actions__card-description">Log conversations and update pipeline</p>
            </button>

            {/* Add Builder Card */}
            <button
              className="quick-actions__card quick-actions__card--purple"
              onClick={() => setActiveAction('newBuilder')}
            >
              <div className="quick-actions__card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M20 8v6M23 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="quick-actions__card-title">Add Builder</h3>
              <p className="quick-actions__card-description">Create a new Builder profile</p>
            </button>
          </div>
        </div>
      </main>

      {/* Modal Overlay */}
      {activeAction && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>

            {/* Add New Lead Modal */}
            {activeAction === 'newLead' && (
              <form className="modal-form" onSubmit={handleAddNewLead}>
                <h2 className="modal-title">Add New Lead</h2>

                {/* Date Field */}
                <div className="form-section">
                  <label className="form-label">Date *</label>
                  <p className="form-help-text">Select the date for this lead entry (useful for recording past leads)</p>
                  <input
                    type="date"
                    value={newLeadForm.outreach_date}
                    onChange={(e) => setNewLeadForm({...newLeadForm, outreach_date: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>

                {/* Lead Type */}
                <div className="form-section">
                  <label className="form-label">Lead Type</label>
                  <div className="button-group">
                    <button
                      type="button"
                      className={`button-option button-option--contact ${newLeadForm.lead_type === 'contact' ? 'button-option--active' : ''}`}
                      onClick={() => setNewLeadForm({...newLeadForm, lead_type: 'contact'})}
                    >
                      <div className="button-option__title">Contact Outreach</div>
                      <div className="button-option__subtitle">Individual contact at a company</div>
                    </button>
                    <button
                      type="button"
                      className={`button-option button-option--job ${newLeadForm.lead_type === 'job' ? 'button-option--active' : ''}`}
                      onClick={() => setNewLeadForm({...newLeadForm, lead_type: 'job'})}
                    >
                      <div className="button-option__title">Job Posting</div>
                      <div className="button-option__subtitle">Specific job opportunity</div>
                    </button>
                  </div>
                </div>

                {/* Conditional Fields Based on Lead Type */}
                {newLeadForm.lead_type === 'contact' ? (
                  <>
                    {/* Contact Outreach Fields */}
                    <div className="form-section">
                      <label className="form-label">Contact Name *</label>
                      <input
                        type="text"
                        required
                        value={newLeadForm.contact_name}
                        onChange={(e) => setNewLeadForm({...newLeadForm, contact_name: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Sarah Chen"
                      />
                    </div>

                    <div className="form-section">
                      <label className="form-label">Company *</label>
                      <input
                        type="text"
                        required
                        value={newLeadForm.company_name}
                        onChange={(e) => setNewLeadForm({...newLeadForm, company_name: e.target.value})}
                        className="form-input"
                        placeholder="e.g., TechCorp Inc."
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-section">
                        <label className="form-label">Role/Title</label>
                        <input
                          type="text"
                          value={newLeadForm.contact_title}
                          onChange={(e) => setNewLeadForm({...newLeadForm, contact_title: e.target.value})}
                          className="form-input"
                          placeholder="e.g., VP of Engineering"
                        />
                      </div>
                      <div className="form-section">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          value={newLeadForm.contact_email}
                          onChange={(e) => setNewLeadForm({...newLeadForm, contact_email: e.target.value})}
                          className="form-input"
                          placeholder="email@company.com"
                        />
                      </div>
                    </div>

                    <div className="form-section">
                      <label className="form-label">LinkedIn URL</label>
                      <input
                        type="url"
                        value={newLeadForm.linkedin_url}
                        onChange={(e) => setNewLeadForm({...newLeadForm, linkedin_url: e.target.value})}
                        className="form-input"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>

                    <div className="form-section">
                      <label className="form-label">Lead Temperature *</label>
                      <div className="button-group button-group--three">
                        <button
                          type="button"
                          className={`button-temp ${newLeadForm.lead_temperature === 'cold' ? 'button-temp--active button-temp--cold' : ''}`}
                          onClick={() => setNewLeadForm({...newLeadForm, lead_temperature: 'cold'})}
                        >
                          Cold
                        </button>
                        <button
                          type="button"
                          className={`button-temp ${newLeadForm.lead_temperature === 'warm' ? 'button-temp--active button-temp--warm' : ''}`}
                          onClick={() => setNewLeadForm({...newLeadForm, lead_temperature: 'warm'})}
                        >
                          Warm
                        </button>
                        <button
                          type="button"
                          className={`button-temp ${newLeadForm.lead_temperature === 'hot' ? 'button-temp--active button-temp--hot' : ''}`}
                          onClick={() => setNewLeadForm({...newLeadForm, lead_temperature: 'hot'})}
                        >
                          Hot
                        </button>
                      </div>
                    </div>

                    <div className="form-section">
                      <label className="form-label">Source *</label>
                      <div className="button-group button-group--three">
                        <button
                          type="button"
                          className={`button-source button-source--personal ${newLeadForm.source === 'personal' ? 'button-source--active' : ''}`}
                          onClick={() => setNewLeadForm({...newLeadForm, source: 'personal'})}
                        >
                          Personal Network
                        </button>
                        <button
                          type="button"
                          className={`button-source button-source--professional ${newLeadForm.source === 'professional' ? 'button-source--active' : ''}`}
                          onClick={() => setNewLeadForm({...newLeadForm, source: 'professional'})}
                        >
                          Professional Network
                        </button>
                        <button
                          type="button"
                          className={`button-source button-source--online ${newLeadForm.source === 'online' ? 'button-source--active' : ''}`}
                          onClick={() => setNewLeadForm({...newLeadForm, source: 'online'})}
                        >
                          Online/Research
                        </button>
                      </div>
                    </div>

                    <div className="form-section">
                      <label className="form-label">Initial Status</label>
                      <p className="form-help-text">Select the starting point for this lead based on your relationship</p>
                      <select
                        value={newLeadForm.stage}
                        onChange={(e) => setNewLeadForm({...newLeadForm, stage: e.target.value})}
                        className="form-select"
                      >
                        {stages.map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Job Posting Fields */}
                    <div className="form-section">
                      <label className="form-label">Job Title *</label>
                      <input
                        type="text"
                        required
                        value={newLeadForm.job_title}
                        onChange={(e) => setNewLeadForm({...newLeadForm, job_title: e.target.value, contact_name: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Full Stack Developer"
                      />
                    </div>

                    <div className="form-section">
                      <label className="form-label">Company Name *</label>
                      <input
                        type="text"
                        required
                        value={newLeadForm.company_name}
                        onChange={(e) => setNewLeadForm({...newLeadForm, company_name: e.target.value})}
                        className="form-input"
                        placeholder="e.g., TechCorp Inc."
                      />
                    </div>

                    <div className="form-section">
                      <label className="form-label">Job Posting URL *</label>
                      <input
                        type="url"
                        required
                        value={newLeadForm.job_posting_url}
                        onChange={(e) => setNewLeadForm({...newLeadForm, job_posting_url: e.target.value, linkedin_url: e.target.value})}
                        className="form-input"
                        placeholder="https://..."
                      />
                    </div>

                    <div className="form-section">
                      <label className="form-label">Experience Level *</label>
                      <select
                        required
                        value={newLeadForm.experience_level}
                        onChange={(e) => setNewLeadForm({...newLeadForm, experience_level: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Select Level</option>
                        {experienceLevels.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-section">
                      <label className="form-label">Source *</label>
                      <select
                        required
                        value={newLeadForm.source}
                        onChange={(e) => setNewLeadForm({...newLeadForm, source: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Select Source</option>
                        {jobPostingSources.map(source => (
                          <option key={source} value={source.toLowerCase()}>{source}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Aligned Sectors - For Both Types */}
                <div className="form-section">
                  <label className="form-label">Aligned Sectors *</label>
                  <p className="form-help-text">Select all sectors where this lead would be a good fit</p>
                  <div className="sector-checkboxes">
                    {sectors.map(sector => (
                      <label key={sector} className="sector-checkbox-item">
                        <input
                          type="checkbox"
                          checked={newLeadForm.aligned_sector.includes(sector)}
                          onChange={(e) => {
                            const updatedSectors = e.target.checked
                              ? [...newLeadForm.aligned_sector, sector]
                              : newLeadForm.aligned_sector.filter(s => s !== sector);
                            setNewLeadForm({...newLeadForm, aligned_sector: updatedSectors});
                          }}
                          className="sector-checkbox"
                        />
                        <span className="sector-checkbox-text">{sector}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Ownership - For Both Types */}
                <div className="form-section">
                  <label className="form-label">Ownership *</label>
                  <p className="form-help-text">Please select your name below</p>
                  <select
                    required
                    value={newLeadForm.ownership}
                    onChange={(e) => setNewLeadForm({...newLeadForm, ownership: e.target.value})}
                    className="form-select"
                  >
                    <option value="">Please select your name below</option>
                    {staffMembers.map(member => (
                      <option key={member.id} value={member.name}>{member.name}</option>
                    ))}
                  </select>
                </div>

                {/* Notes / Comments - For Both Types */}
                <div className="form-section">
                  <label className="form-label">Notes / Comments</label>
                  <p className="form-help-text">
                    {newLeadForm.lead_type === 'contact' 
                      ? 'Add any relevant notes about your relationship, the role, or the stage'
                      : 'e.g., "Looks aligned with AI Builders" or "Company is known for hiring apprentices"'
                    }
                  </p>
                  <textarea
                    value={newLeadForm.notes}
                    onChange={(e) => setNewLeadForm({...newLeadForm, notes: e.target.value})}
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
                    {loading ? 'Adding...' : 'Add Lead'}
                  </button>
                </div>
              </form>
            )}

            {/* Update Lead Status Modal */}
            {activeAction === 'updateLead' && (
              <form className="modal-form" onSubmit={handleUpdateLead}>
                <h2 className="modal-title">Update Lead Status</h2>

                {/* Date Field */}
                <div className="form-section">
                  <label className="form-label">Update Date *</label>
                  <p className="form-help-text">Select the date for this update (useful for recording past interactions)</p>
                  <input
                    type="date"
                    value={updateLeadForm.update_date}
                    onChange={(e) => setUpdateLeadForm({...updateLeadForm, update_date: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>

                {/* Search */}
                <div className="form-section">
                  <label className="form-label">Select Contact/Lead</label>
                  <div className="search-container">
                    <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <input
                      type="text"
                      value={updateLeadForm.search}
                      onChange={(e) => setUpdateLeadForm({...updateLeadForm, search: e.target.value, selectedLead: null})}
                      className="form-input form-input--search"
                      placeholder="Search by name, company, or email..."
                    />
                  </div>
                  
                  {/* My Leads Toggle */}
                  <div className="my-leads-toggle">
                    <button
                      type="button"
                      className={`toggle-button ${showMyLeadsOnly ? 'toggle-button--active' : ''}`}
                      onClick={() => setShowMyLeadsOnly(!showMyLeadsOnly)}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '6px' }}>
                        <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 9.5c-2.67 0-8 1.34-8 4v1.5h16v-1.5c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                      </svg>
                      My Leads Only
                    </button>
                  </div>
                </div>

                {/* Recent Contacts or Search Results */}
                {!updateLeadForm.selectedLead && (
                  <div className="form-section">
                    <div className="contacts-label">
                      {updateLeadForm.search ? 'SEARCH RESULTS' : (showMyLeadsOnly ? 'MY RECENT LEADS' : 'RECENT CONTACTS')}
                    </div>
                    <div className="contacts-list">
                      {(() => {
                        let leadsToShow = updateLeadForm.search ? leadSearchResults : allLeads.slice(0, 5);
                        
                        // Filter by ownership if "My Leads" is active and no search
                        if (showMyLeadsOnly && !updateLeadForm.search) {
                          leadsToShow = allLeads.filter(lead => lead.ownership === user?.name).slice(0, 5);
                        }
                        
                        return leadsToShow.map(lead => (
                          <button
                            key={lead.id}
                            type="button"
                            className="contact-item"
                            onClick={() => {
                              setUpdateLeadForm({
                                ...updateLeadForm,
                                selectedLead: lead,
                                stage: lead.stage || 'Initial Outreach',
                                lead_temperature: lead.lead_temperature || 'warm',
                                search: lead.contact_name
                              });
                            }}
                          >
                            <div className="contact-item__name">{lead.contact_name}</div>
                            <div className="contact-item__company">{lead.company_name} - {lead.stage}</div>
                          </button>
                        ));
                      })()}
                      {(() => {
                        let leadsToShow = updateLeadForm.search ? leadSearchResults : allLeads;
                        if (showMyLeadsOnly && !updateLeadForm.search) {
                          leadsToShow = allLeads.filter(lead => lead.ownership === user?.name);
                        }
                        return leadsToShow.length === 0 && (
                          <div className="contacts-empty">
                            {showMyLeadsOnly ? 'No leads found that you own' : 'No contacts found'}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Selected Lead Form */}
                {updateLeadForm.selectedLead && (
                  <>
                    {/* New Status */}
                    <div className="form-section">
                      <label className="form-label">New Status *</label>
                      <select
                        required
                        value={updateLeadForm.stage}
                        onChange={(e) => setUpdateLeadForm({...updateLeadForm, stage: e.target.value})}
                        className="form-select"
                      >
                        {stages.map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>

                    {/* Update Lead Temperature */}
                    <div className="form-section">
                      <label className="form-label">Update Lead Temperature</label>
                      <div className="button-group button-group--three">
                        <button
                          type="button"
                          className={`button-temp ${updateLeadForm.lead_temperature === 'cold' ? 'button-temp--active button-temp--cold' : ''}`}
                          onClick={() => setUpdateLeadForm({...updateLeadForm, lead_temperature: 'cold'})}
                        >
                          Cold
                        </button>
                        <button
                          type="button"
                          className={`button-temp ${updateLeadForm.lead_temperature === 'warm' ? 'button-temp--active button-temp--warm' : ''}`}
                          onClick={() => setUpdateLeadForm({...updateLeadForm, lead_temperature: 'warm'})}
                        >
                          Warm
                        </button>
                        <button
                          type="button"
                          className={`button-temp ${updateLeadForm.lead_temperature === 'hot' ? 'button-temp--active button-temp--hot' : ''}`}
                          onClick={() => setUpdateLeadForm({...updateLeadForm, lead_temperature: 'hot'})}
                        >
                          Hot
                        </button>
                      </div>
                    </div>

                    {/* Activity Notes */}
                    <div className="form-section">
                      <label className="form-label">Activity Notes *</label>
                      <textarea
                        required
                        value={updateLeadForm.notes}
                        onChange={(e) => setUpdateLeadForm({...updateLeadForm, notes: e.target.value})}
                        className="form-textarea"
                        rows="4"
                        placeholder="What happened? Record details about the conversation, meeting, or outreach..."
                      />
                    </div>

                    {/* Next Steps */}
                    <div className="form-section">
                      <label className="form-label">Next Steps</label>
                      <input
                        type="text"
                        value={updateLeadForm.next_steps}
                        onChange={(e) => setUpdateLeadForm({...updateLeadForm, next_steps: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Follow up next week, Send resources, Schedule demo"
                      />
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="modal-actions">
                  <button type="button" onClick={closeModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading || !updateLeadForm.selectedLead} 
                    className="btn-primary"
                  >
                    {loading ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </form>
            )}

            {/* Add Builder Modal */}
            {activeAction === 'newBuilder' && (
              <form className="modal-form" onSubmit={handleAddBuilder}>
                <h2 className="modal-title">Add New Builder</h2>

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
                    placeholder="React, Node.js, PostgreSQL, AWS, etc."
                    rows="3"
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={closeModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Adding...' : 'Add Builder'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickActions;
