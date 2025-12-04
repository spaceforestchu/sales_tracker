import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { outreachAPI, userAPI, activityAPI } from '../services/api';
import { exportLeadsToCSV } from '../utils/csvExport';
import '../styles/Overview.css';
import '../styles/AllLeads.css';
import '../styles/QuickActions.css';

const AllLeads = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');

  // Modal state
  const [activeModal, setActiveModal] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedLeadDetails, setSelectedLeadDetails] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editingUpdateIndex, setEditingUpdateIndex] = useState(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [statusUpdateForm, setStatusUpdateForm] = useState({
    stage: '',
    stage_detail: '',
    notes: '',
    next_steps: '',
    update_date: new Date().toISOString().split('T')[0]
  });
  
  // Form states
  const [newLeadForm, setNewLeadForm] = useState({
    lead_type: 'contact',
    company_name: '',
    contact_name: '',
    contact_title: '',
    contact_email: '',
    linkedin_url: '',
    outreach_date: new Date().toISOString().split('T')[0],
    source: [],
    stage: 'Initial Outreach',
    stage_detail: '', // For Active Lead, Close Won, Close Loss sub-options
    ownership: user?.name || '',
    current_owner: user?.name || '',
    notes: '',
    aligned_sector: []
  });

  const [updateLeadForm, setUpdateLeadForm] = useState({
    search: '',
    selectedLead: null,
    stage: '',
    stage_detail: '',
    notes: '',
    next_steps: '',
    update_date: new Date().toISOString().split('T')[0]
  });

  const [quickUpdateForm, setQuickUpdateForm] = useState({
    selectedLead: null,
    stage: '',
    stage_detail: '',
    notes: '',
    next_steps: '',
    update_date: new Date().toISOString().split('T')[0]
  });

  const [leadSearchResults, setLeadSearchResults] = useState([]);
  const [showMyLeadsOnly, setShowMyLeadsOnly] = useState(false);

  // Search enhancements
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem('leadSearchHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [dateRange, setDateRange] = useState({
    from: '',
    to: ''
  });
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchStaffMembers();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, activeFilter, stageFilter, ownerFilter, dateRange]);

  // Autocomplete suggestions effect
  useEffect(() => {
    if (searchTerm.length > 0) {
      const suggestions = leads
        .filter(lead => {
          const searchLower = searchTerm.toLowerCase();
          return (
            lead.company_name?.toLowerCase().includes(searchLower) ||
            lead.contact_name?.toLowerCase().includes(searchLower) ||
            lead.contact_title?.toLowerCase().includes(searchLower)
          );
        })
        .slice(0, 5)
        .map(lead => ({
          id: lead.id,
          text: `${lead.contact_name} - ${lead.company_name}`,
          lead: lead
        }));
      setSearchSuggestions(suggestions);
      setShowAutocomplete(suggestions.length > 0);
    } else {
      setSearchSuggestions([]);
      setShowAutocomplete(false);
    }
  }, [searchTerm, leads]);
  
  // Handle lead search for update form
  useEffect(() => {
    if (updateLeadForm.search.length > 1) {
      let filtered = leads.filter(lead =>
        lead.company_name?.toLowerCase().includes(updateLeadForm.search.toLowerCase()) ||
        lead.contact_name?.toLowerCase().includes(updateLeadForm.search.toLowerCase()) ||
        lead.contact_email?.toLowerCase().includes(updateLeadForm.search.toLowerCase())
      );
      
      if (showMyLeadsOnly) {
        filtered = filtered.filter(lead => lead.ownership === user?.name);
      }
      
      setLeadSearchResults(filtered.slice(0, 5));
    } else {
      setLeadSearchResults([]);
    }
  }, [updateLeadForm.search, leads, showMyLeadsOnly, user]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // Fetch outreach data (contact leads only)
      const data = await outreachAPI.getAllOutreach();
      // Sort by most recent interaction (updated_at or outreach_date)
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.outreach_date);
        const dateB = new Date(b.updated_at || b.outreach_date);
        return dateB - dateA;
      });
      setLeads(sorted);
      setFilteredLeads(sorted);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
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

  const filterLeads = () => {
    let filtered = [...leads];

    // Apply search filter - search through names, companies, titles, tags (source), sectors, and dates
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();

      filtered = filtered.filter(lead => {
        // Search in basic fields
        const basicMatch =
          lead.company_name?.toLowerCase().includes(searchLower) ||
          lead.contact_name?.toLowerCase().includes(searchLower) ||
          lead.contact_title?.toLowerCase().includes(searchLower) ||
          lead.ownership?.toLowerCase().includes(searchLower);

        // Search in source tags (JSONB array)
        let sourceMatch = false;
        try {
          let sources = [];
          if (lead.source) {
            if (typeof lead.source === 'string') {
              sources = JSON.parse(lead.source);
            } else if (Array.isArray(lead.source)) {
              sources = lead.source;
            }
          }
          sourceMatch = sources.some(tag => tag.toLowerCase().includes(searchLower));
        } catch (error) {
          // If parsing fails, skip source matching
        }

        // Search in aligned_sector tags (JSONB array)
        let sectorMatch = false;
        try {
          let sectors = [];
          if (lead.aligned_sector) {
            if (typeof lead.aligned_sector === 'string') {
              sectors = JSON.parse(lead.aligned_sector);
            } else if (Array.isArray(lead.aligned_sector)) {
              sectors = lead.aligned_sector;
            }
          }
          sectorMatch = sectors.some(sector => sector.toLowerCase().includes(searchLower));
        } catch (error) {
          // If parsing fails, skip sector matching
        }

        // Search in dates
        const dateMatch =
          lead.outreach_date?.includes(searchTerm) ||
          new Date(lead.outreach_date).toLocaleDateString().includes(searchTerm) ||
          (lead.updated_at && new Date(lead.updated_at).toLocaleDateString().includes(searchTerm));

        return basicMatch || sourceMatch || sectorMatch || dateMatch;
      });
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(lead => {
        const leadDate = new Date(lead.updated_at || lead.outreach_date);
        const fromDate = dateRange.from ? new Date(dateRange.from) : null;
        const toDate = dateRange.to ? new Date(dateRange.to) : null;

        if (fromDate && toDate) {
          return leadDate >= fromDate && leadDate <= toDate;
        } else if (fromDate) {
          return leadDate >= fromDate;
        } else if (toDate) {
          return leadDate <= toDate;
        }
        return true;
      });
    }

    // Apply stage filter
    if (stageFilter !== 'all') {
      filtered = filtered.filter(lead => (lead.stage || 'Initial Outreach') === stageFilter);
    }

    // Apply owner filter
    if (ownerFilter !== 'all') {
      filtered = filtered.filter(lead => (lead.current_owner || lead.ownership) === ownerFilter);
    }

    // Apply filter and sorting
    if (activeFilter === 'my-leads') {
      filtered = filtered.filter(lead => lead.staff_user_id === user?.id);
    } else if (activeFilter === 'newest') {
      // Sort by newest first (already default, but explicit)
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.outreach_date);
        const dateB = new Date(b.updated_at || b.outreach_date);
        return dateB - dateA;
      });
    } else if (activeFilter === 'oldest') {
      // Sort by oldest first
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.outreach_date);
        const dateB = new Date(b.updated_at || b.outreach_date);
        return dateA - dateB;
      });
    }
    // 'all' shows all leads sorted by newest (default sorting from fetchLeads)

    setFilteredLeads(filtered);
  };

  const getLeadTemp = (status) => {
    if (['interested', 'meeting_scheduled', 'opportunity_created'].includes(status)) {
      return 'HOT';
    } else if (['responded'].includes(status)) {
      return 'WARM';
    } else {
      return 'COLD';
    }
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

  // Constants for forms
  const stages = [
    'Initial Outreach',
    'Not Interested',
    'Active Lead',
    'Close Won',
    'Close Loss'
  ];

  // Sub-options for specific stages
  const stageDetails = {
    'Active Lead': [
      'Connected to PBC',
      'Someone responded positively (Setting up a meeting, had multiple meetings)'
    ],
    'Close Won': [
      'Gets Job Offer'
    ],
    'Close Loss': [
      'Nothing Worked'
    ]
  };

  // Source options
  const sourceOptions = [
    'LinkedIn',
    'Indeed or Other Job Boards',
    'Employee Referral',
    'Personal Network',
    'Alumni Network',
    'Professional Network',
    'Events & Conferences (Conference, Workshops, Webinars)',
    'Previous Employer',
    'Recruitment Agency',
    'Other'
  ];

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

  // Get color based on stage
  const getStageColor = (stage) => {
    const stageColors = {
      'Initial Outreach': '#6b7280',        // Gray
      'Not Interested': '#ef4444',          // Red
      'Active Lead': '#3b82f6',             // Blue - Connected to PBC / Someone responded positively
      'Close Won': '#10b981',               // Green - Gets Job Offer
      'Close Loss': '#f59e0b'               // Orange - Nothing Worked
    };
    return stageColors[stage] || '#3b82f6'; // Default to blue
  };


  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const addToSearchHistory = (term) => {
    if (!term || term.trim() === '') return;

    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('leadSearchHistory', JSON.stringify(newHistory));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('leadSearchHistory');
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    if (value.trim() === '') {
      setShowAutocomplete(false);
    }
  };

  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      addToSearchHistory(searchTerm);
      setShowAutocomplete(false);
    }
  };

  const selectSuggestion = (suggestion) => {
    setSearchTerm(suggestion.text);
    addToSearchHistory(suggestion.text);
    setShowAutocomplete(false);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedLeadDetails(null);
    setIsEditMode(false);
    setEditFormData({});
    setEditingUpdateIndex(null);
    setShowStatusUpdate(false);
    setStatusUpdateForm({
      stage: '',
      stage_detail: '',
      notes: '',
      next_steps: '',
      update_date: new Date().toISOString().split('T')[0]
    });
    setQuickUpdateForm({
      selectedLead: null,
      stage: '',
      stage_detail: '',
      notes: '',
      next_steps: '',
      update_date: new Date().toISOString().split('T')[0]
    });
    setNewLeadForm({
      lead_type: 'contact',
      company_name: '',
      contact_name: '',
      contact_title: '',
      contact_email: '',
      linkedin_url: '',
      outreach_date: new Date().toISOString().split('T')[0],
      source: [],
      stage: 'Initial Outreach',
      stage_detail: '',
      ownership: user?.name || '',
      current_owner: user?.name || '',
      notes: '',
      aligned_sector: []
    });
    setUpdateLeadForm({
      search: '',
      selectedLead: null,
      stage: '',
      stage_detail: '',
      notes: '',
      next_steps: '',
      update_date: new Date().toISOString().split('T')[0]
    });
    setShowMyLeadsOnly(false);
  };

  const handleSaveLeadDetails = async () => {
    if (!selectedLeadDetails) return;

    setLoading(true);
    try {
      // Check if current owner is changing
      const previousOwner = selectedLeadDetails.current_owner || selectedLeadDetails.ownership;
      const newOwner = editFormData.current_owner || previousOwner;
      const ownerChanged = previousOwner !== newOwner;

      // Automatically set current owner to logged-in user if not explicitly set
      const dataToUpdate = {
        ...editFormData,
        current_owner: editFormData.current_owner || user.name
      };

      await outreachAPI.updateOutreach(selectedLeadDetails.id, dataToUpdate);

      // Create activity for the update
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'updated_lead',
        entity_type: 'lead',
        entity_name: `${selectedLeadDetails.contact_name} - ${selectedLeadDetails.company_name}`,
        details: {
          updated_fields: Object.keys(editFormData).join(', ')
        }
      });

      // If owner changed, create a separate activity for ownership change
      if (ownerChanged) {
        await activityAPI.createActivity({
          user_name: user.name,
          action_type: 'ownership_changed',
          entity_type: 'lead',
          entity_name: `${selectedLeadDetails.contact_name} - ${selectedLeadDetails.company_name}`,
          details: {
            previous_owner: previousOwner,
            new_owner: dataToUpdate.current_owner
          }
        });
      }

      showMessage('success', 'Lead details updated successfully!');
      setIsEditMode(false);
      setEditFormData({});
      fetchLeads();

      // Refresh the selected lead details
      const updatedLeads = await outreachAPI.getAllOutreach();
      const updatedLead = updatedLeads.find(l => l.id === selectedLeadDetails.id);
      if (updatedLead) {
        setSelectedLeadDetails(updatedLead);
      }
    } catch (error) {
      showMessage('error', 'Failed to update lead details.');
      console.error('Error updating lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteNextStep = async (stepId, stepTask) => {
    if (!selectedLeadDetails) return;

    setLoading(true);
    try {
      // Parse current next_steps array
      let nextStepsArray = [];
      try {
        if (selectedLeadDetails.next_steps) {
          nextStepsArray = typeof selectedLeadDetails.next_steps === 'string'
            ? JSON.parse(selectedLeadDetails.next_steps)
            : selectedLeadDetails.next_steps;
        }
      } catch (e) {
        nextStepsArray = [];
      }

      // Mark the specific step as completed
      const updatedNextSteps = nextStepsArray.map(step =>
        step.id === stepId ? { ...step, completed: true, completed_at: new Date().toISOString() } : step
      );

      const updateData = {
        next_steps: updatedNextSteps,
        notes: selectedLeadDetails.notes
          ? `${selectedLeadDetails.notes}\n\n[${new Date().toLocaleDateString()}] ✅ Completed: ${stepTask}`
          : `[${new Date().toLocaleDateString()}] ✅ Completed: ${stepTask}`
      };

      await outreachAPI.updateOutreach(selectedLeadDetails.id, updateData);

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'completed_next_step',
        entity_type: 'lead',
        entity_name: `${selectedLeadDetails.contact_name} - ${selectedLeadDetails.company_name}`,
        details: {
          completed_task: stepTask
        }
      });

      showMessage('success', 'Next step marked as completed!');
      fetchLeads();

      // Refresh the selected lead details
      const updatedLeads = await outreachAPI.getAllOutreach();
      const updatedLead = updatedLeads.find(l => l.id === selectedLeadDetails.id);
      if (updatedLead) {
        setSelectedLeadDetails(updatedLead);
      }
    } catch (error) {
      showMessage('error', 'Failed to complete next step.');
      console.error('Error completing next step:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedLeadDetails) return;

    setLoading(true);
    try {
      const updateDate = statusUpdateForm.update_date
        ? new Date(statusUpdateForm.update_date).toLocaleDateString()
        : new Date().toLocaleDateString();

      // Create note with stage change information
      const oldStage = selectedLeadDetails.stage || 'Initial Outreach';
      const newStage = statusUpdateForm.stage;
      const stageChanged = oldStage !== newStage;

      let noteContent = '';
      if (stageChanged) {
        noteContent = `📊 Stage: ${oldStage} → ${newStage}\n${statusUpdateForm.notes}`;
      } else {
        noteContent = statusUpdateForm.notes;
      }

      // Handle next_steps: append to array if provided
      let nextStepsArray = [];
      try {
        if (selectedLeadDetails.next_steps) {
          nextStepsArray = typeof selectedLeadDetails.next_steps === 'string'
            ? JSON.parse(selectedLeadDetails.next_steps)
            : selectedLeadDetails.next_steps;
        }
      } catch (e) {
        nextStepsArray = [];
      }

      // If new next step is provided, add it to the array
      if (statusUpdateForm.next_steps && statusUpdateForm.next_steps.trim()) {
        nextStepsArray.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          task: statusUpdateForm.next_steps.trim(),
          created_at: new Date().toISOString(),
          completed: false
        });
      }

      const updateData = {
        stage: statusUpdateForm.stage,
        next_steps: nextStepsArray,
        notes: selectedLeadDetails.notes
          ? `${selectedLeadDetails.notes}\n\n[${updateDate}] ${noteContent}`
          : `[${updateDate}] ${noteContent}`
      };

      await outreachAPI.updateOutreach(selectedLeadDetails.id, updateData);

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'updated_lead',
        entity_type: 'lead',
        entity_name: `${selectedLeadDetails.contact_name} - ${selectedLeadDetails.company_name}`,
        details: {
          old_stage: selectedLeadDetails.stage,
          new_stage: statusUpdateForm.stage,
          company: selectedLeadDetails.company_name
        }
      });

      showMessage('success', 'Lead status updated successfully!');
      setShowStatusUpdate(false);
      setStatusUpdateForm({
        stage: '',
        stage_detail: '',
        notes: '',
        next_steps: '',
        update_date: new Date().toISOString().split('T')[0]
      });
      fetchLeads();

      // Refresh the selected lead details
      const updatedLeads = await outreachAPI.getAllOutreach();
      const updatedLead = updatedLeads.find(l => l.id === selectedLeadDetails.id);
      if (updatedLead) {
        setSelectedLeadDetails(updatedLead);
      }
    } catch (error) {
      showMessage('error', 'Failed to update lead status.');
      console.error('Error updating lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewLead = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await outreachAPI.createOutreach(newLeadForm);
      
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'added_lead',
        entity_type: 'lead',
        entity_name: `${newLeadForm.contact_name} - ${newLeadForm.company_name}`,
        details: {
          company: newLeadForm.company_name,
          source: newLeadForm.source
        }
      });
      
      showMessage('success', 'New lead added successfully!');
      closeModal();
      fetchLeads();
    } catch (error) {
      showMessage('error', 'Failed to add lead. Please try again.');
      console.error('Error adding lead:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteLead = async (leadId, leadName) => {
    if (!window.confirm(`Are you sure you want to delete "${leadName}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await outreachAPI.deleteOutreach(leadId);
      
      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'deleted_lead',
        entity_type: 'lead',
        entity_name: leadName,
        details: {}
      });
      
      showMessage('success', 'Lead deleted successfully!');
      fetchLeads();
    } catch (error) {
      showMessage('error', 'Failed to delete lead. Please try again.');
      console.error('Error deleting lead:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!updateLeadForm.selectedLead) {
      showMessage('error', 'Please select a lead to update.');
      return;
    }

    setLoading(true);
    try {
      // Use the selected update date instead of today's date
      const updateDate = updateLeadForm.update_date
        ? new Date(updateLeadForm.update_date).toLocaleDateString()
        : new Date().toLocaleDateString();

      // Handle next_steps: append to array if provided
      let nextStepsArray = [];
      try {
        if (updateLeadForm.selectedLead.next_steps) {
          nextStepsArray = typeof updateLeadForm.selectedLead.next_steps === 'string'
            ? JSON.parse(updateLeadForm.selectedLead.next_steps)
            : updateLeadForm.selectedLead.next_steps;
        }
      } catch (e) {
        nextStepsArray = [];
      }

      // If new next step is provided, add it to the array
      if (updateLeadForm.next_steps && updateLeadForm.next_steps.trim()) {
        nextStepsArray.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          task: updateLeadForm.next_steps.trim(),
          created_at: new Date().toISOString(),
          completed: false
        });
      }

      const updateData = {
        stage: updateLeadForm.stage,
        next_steps: nextStepsArray,
        notes: updateLeadForm.selectedLead.notes
          ? `${updateLeadForm.selectedLead.notes}\n\n[${updateDate}] ${updateLeadForm.notes}`
          : `[${updateDate}] ${updateLeadForm.notes}`
      };

      await outreachAPI.updateOutreach(updateLeadForm.selectedLead.id, updateData);

      await activityAPI.createActivity({
        user_name: user.name,
        action_type: 'updated_lead',
        entity_type: 'lead',
        entity_name: `${updateLeadForm.selectedLead.contact_name} - ${updateLeadForm.selectedLead.company_name}`,
        details: {
          old_stage: updateLeadForm.selectedLead.stage,
          new_stage: updateLeadForm.stage,
          company: updateLeadForm.selectedLead.company_name
        }
      });
      
      showMessage('success', 'Lead status updated successfully!');
      closeModal();
      fetchLeads();
    } catch (error) {
      showMessage('error', 'Failed to update lead. Please try again.');
      console.error('Error updating lead:', error);
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
          onClick={() => navigate('/dashboard')}
        >
          Dashboard
        </button>
        <button className="overview__nav-item overview__nav-item--active">
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
        <div className="all-leads">
          <h2 className="all-leads__title">All Leads</h2>

          {/* Action Buttons */}
          <div className="all-leads__action-buttons">
            <button
              className="action-button action-button--blue"
              onClick={() => setActiveModal('newLead')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add New Lead
            </button>
            <button
              className="action-button action-button--green"
              onClick={() => exportLeadsToCSV(filteredLeads)}
              disabled={filteredLeads.length === 0}
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

          {/* Search Bar with Enhanced Features */}
          <div className="all-leads__search-container" style={{ position: 'relative' }}>
            <div className="all-leads__search-box" style={{ position: 'relative' }}>
              <svg className="all-leads__search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                className="all-leads__search-input"
                placeholder="Search by name, company, sector, source tags..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit();
                  }
                }}
                onFocus={() => {
                  if (searchTerm.length > 0 && searchSuggestions.length > 0) {
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
                    color: '#6b7280'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                </button>
              )}

              {/* Autocomplete Dropdown */}
              {showAutocomplete && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000
                }}>
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => selectSuggestion(suggestion)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #f3f4f6'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                    >
                      <span style={{ fontSize: '14px', color: '#374151' }}>{suggestion.text}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{suggestion.lead.stage}</span>
                    </button>
                  ))}

                  {/* Search History Section */}
                  {searchTerm.length === 0 && searchHistory.length > 0 && (
                    <>
                      <div style={{
                        padding: '8px 16px',
                        fontSize: '12px',
                        color: '#6b7280',
                        fontWeight: '600',
                        borderTop: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>RECENT SEARCHES</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearSearchHistory();
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                        >
                          Clear
                        </button>
                      </div>
                      {searchHistory.slice(0, 5).map((term, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setSearchTerm(term);
                            setShowAutocomplete(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                        >
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                          </svg>
                          {term}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              className="all-leads__filter-button"
              onClick={() => setShowDateFilter(!showDateFilter)}
              style={{
                backgroundColor: showDateFilter || dateRange.from || dateRange.to ? '#3b82f6' : '#ffffff',
                color: showDateFilter || dateRange.from || dateRange.to ? '#ffffff' : '#374151'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2.5 5.83h15M5.83 10h8.34M8.33 14.17h3.34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Date Filter
            </button>
          </div>

          {/* Date Range Filter Panel */}
          {showDateFilter && (
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '12px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    setDateRange({ from: '', to: '' });
                    setShowDateFilter(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Search Results Count */}
          {(searchTerm || dateRange.from || dateRange.to || stageFilter !== 'all') && (
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#6b7280',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                Showing <strong style={{ color: '#374151' }}>{filteredLeads.filter(lead => lead.lead_type === 'contact' || !lead.lead_type).length}</strong> of <strong style={{ color: '#374151' }}>{leads.filter(lead => lead.lead_type === 'contact' || !lead.lead_type).length}</strong> leads
              </span>
              {(searchTerm || dateRange.from || dateRange.to) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setDateRange({ from: '', to: '' });
                    setStageFilter('all');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="all-leads__tabs">
            <button
              className={`all-leads__tab ${activeFilter === 'all' ? 'all-leads__tab--active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Leads
            </button>
            <button
              className={`all-leads__tab ${activeFilter === 'newest' ? 'all-leads__tab--active' : ''}`}
              onClick={() => setActiveFilter('newest')}
            >
              Newest
            </button>
            <button
              className={`all-leads__tab ${activeFilter === 'oldest' ? 'all-leads__tab--active' : ''}`}
              onClick={() => setActiveFilter('oldest')}
            >
              Oldest
            </button>
            <button
              className={`all-leads__tab ${activeFilter === 'my-leads' ? 'all-leads__tab--active' : ''}`}
              onClick={() => setActiveFilter('my-leads')}
            >
              My Leads
            </button>
            <select
              className="all-leads__stage-filter"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                cursor: 'pointer',
                outline: 'none',
                marginLeft: '12px'
              }}
            >
              <option value="all">All Stages</option>
              {stages.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>

            <select
              className="all-leads__owner-filter"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                cursor: 'pointer',
                outline: 'none',
                marginLeft: '12px'
              }}
            >
              <option value="all">All Owners</option>
              {staffMembers.map(member => (
                <option key={member.id} value={member.name}>{member.name}</option>
              ))}
            </select>

            {/* Total Counter - Inline */}
            <div style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center'
            }}>
              Showing {filteredLeads.filter(lead => lead.lead_type === 'contact' || !lead.lead_type).length} leads
            </div>
          </div>

          {/* Contact Leads List */}
          {loading ? (
            <div className="all-leads__loading">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="all-leads__empty">
              <p>No leads found. {searchTerm && 'Try a different search term.'}</p>
            </div>
          ) : (
            <div className="all-leads__list">
              {filteredLeads
                .filter(lead => lead.lead_type === 'contact' || !lead.lead_type) // Contact outreach leads
                .map(lead => (
                <div key={lead.id} className="all-leads__card">
                  <div className="all-leads__card-content">
                    <div className="all-leads__card-header">
                      <div className="all-leads__card-title-row">
                        <h3 className="all-leads__card-name">
                          {lead.contact_name || 'Unknown Contact'}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span
                            className="all-leads__stage-badge"
                            style={{
                              backgroundColor: getStageColor(lead.stage || 'Initial Outreach'),
                              color: '#ffffff',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            {lead.stage || 'Initial Outreach'}
                          </span>
                          <span className="all-leads__source-badge">
                            {lead.contact_method || 'Professional Network'}
                          </span>
                        </div>
                      </div>
                      <div className="all-leads__card-actions">
                        {(() => {
                          // Parse next_steps for pending badge
                          let nextStepsArray = [];
                          try {
                            if (lead.next_steps) {
                              nextStepsArray = typeof lead.next_steps === 'string'
                                ? JSON.parse(lead.next_steps)
                                : lead.next_steps;
                            }
                          } catch (e) {
                            nextStepsArray = [];
                          }
                          const pendingSteps = nextStepsArray.filter(step => !step.completed);

                          // Get color based on number of pending tasks
                          const getPendingTaskColor = (count) => {
                            if (count === 1) return '#10b981'; // Green
                            if (count === 2) return '#f59e0b'; // Orange
                            return '#ef4444'; // Red - 3+
                          };

                          if (pendingSteps.length > 0) {
                            return (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '6px 12px',
                                backgroundColor: getPendingTaskColor(pendingSteps.length),
                                color: '#ffffff',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                whiteSpace: 'nowrap',
                                marginRight: '8px'
                              }}>
                                PENDING TASK: {pendingSteps.length}
                              </span>
                            );
                          }
                          return null;
                        })()}
                        <button
                          className="all-leads__view-details"
                          onClick={() => {
                            console.log('View Details clicked for:', lead);
                            setSelectedLeadDetails(lead);
                            setActiveModal('viewDetails');
                            console.log('Modal state set to viewDetails');
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          View Details
                        </button>
                        <button
                          className="all-leads__quick-update"
                          onClick={() => {
                            setQuickUpdateForm({
                              selectedLead: lead,
                              stage: lead.stage || 'Initial Outreach',
                              notes: '',
                              next_steps: '',
                              update_date: new Date().toISOString().split('T')[0]
                            });
                            setActiveModal('quickUpdate');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: '#f59e0b',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#d97706'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#f59e0b'}
                        >
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                          </svg>
                          Quick Update
                        </button>
                        <button
                          className="all-leads__delete-btn"
                          onClick={() => handleDeleteLead(lead.id, `${lead.contact_name} - ${lead.company_name}`)}
                        >
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="all-leads__company">{lead.company_name}</p>
                    <div className="all-leads__meta">
                      <span className="all-leads__status">
                        Status: <strong>{lead.stage || lead.status.replace(/_/g, ' ')}</strong>
                      </span>
                      <span className="all-leads__contact">
                        Last Contact: <strong>{getTimeAgo(lead.updated_at || lead.outreach_date)}</strong>
                      </span>
                      {(() => {
                        try {
                          let sectors = [];
                          if (lead.aligned_sector) {
                            if (typeof lead.aligned_sector === 'string') {
                              sectors = JSON.parse(lead.aligned_sector);
                            } else if (Array.isArray(lead.aligned_sector)) {
                              sectors = lead.aligned_sector;
                            }
                          }
                          if (sectors.length > 0) {
                            return (
                              <span className="all-leads__sectors">
                                Sectors: <strong>{sectors.join(', ')}</strong>
                              </span>
                            );
                          }
                          return null;
                        } catch (error) {
                          return null;
                        }
                      })()}
                      <span className="all-leads__owner">
                        Current Owner: <strong>{lead.current_owner || lead.ownership || 'Unassigned'}</strong>
                      </span>
                    </div>

                    {/* Latest Activity Notes with Pending Task Counter */}
                    {(() => {
                      // Extract the latest activity note from the notes field
                      const notes = lead.notes || '';
                      const datePattern = /\[(\d{1,2}\/\d{1,2}\/\d{4})\]/g;
                      const parts = notes.split(datePattern);

                      let latestNote = null;
                      // Parse into update objects and get the most recent
                      for (let i = parts.length - 2; i >= 1; i -= 2) {
                        if (parts[i] && parts[i + 1] && parts[i + 1].trim()) {
                          latestNote = parts[i + 1].trim();
                          break;
                        }
                      }

                      // Parse next_steps array for pending tasks
                      let nextStepsArray = [];
                      try {
                        if (lead.next_steps) {
                          nextStepsArray = typeof lead.next_steps === 'string'
                            ? JSON.parse(lead.next_steps)
                            : lead.next_steps;
                        }
                      } catch (e) {
                        nextStepsArray = [];
                      }
                      const pendingSteps = nextStepsArray.filter(step => !step.completed);

                      // Get color based on number of pending tasks
                      const getPendingTaskColor = (count) => {
                        if (count === 0) return '#6b7280'; // Gray - no tasks
                        if (count === 1) return '#10b981'; // Green - manageable
                        if (count === 2) return '#f59e0b'; // Orange - getting busy
                        return '#ef4444'; // Red - many tasks
                      };

                      // If we have no latest note, don't show anything
                      if (!latestNote) return null;

                      return (
                        <div className="all-leads__next-steps">
                          <span className="all-leads__next-steps-label">Latest Activity:</span>
                          <span className="all-leads__next-steps-text" style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {latestNote}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modals */}
          {activeModal && activeModal !== 'viewDetails' && (
            <div className="modal-overlay" onClick={closeModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={closeModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                {activeModal === 'newLead' && (
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
                          <label className="form-label">Source</label>
                          <p className="form-help-text">Select where this lead came from (optional)</p>
                          <select
                            value={Array.isArray(newLeadForm.source) ? (newLeadForm.source[0] || '') : newLeadForm.source}
                            onChange={(e) => {
                              setNewLeadForm({...newLeadForm, source: [e.target.value]});
                            }}
                            className="form-select"
                          >
                            <option value="">Select a source...</option>
                            {sourceOptions.map(source => (
                              <option key={source} value={source}>{source}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-section">
                          <label className="form-label">Initial Status</label>
                          <p className="form-help-text">Select the starting point for this lead based on your relationship</p>
                          <select
                            value={newLeadForm.stage}
                            onChange={(e) => setNewLeadForm({...newLeadForm, stage: e.target.value, stage_detail: ''})}
                            className="form-select"
                          >
                            {stages.map(stage => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                        </div>

                        {/* Stage Detail Dropdown - Conditional */}
                        {stageDetails[newLeadForm.stage] && (
                          <div className="form-section">
                            <label className="form-label">
                              {newLeadForm.stage === 'Active Lead' ? 'Lead Type *' :
                               newLeadForm.stage === 'Close Won' ? 'Win Reason *' :
                               'Loss Reason *'}
                            </label>
                            <select
                              required
                              value={newLeadForm.stage_detail}
                              onChange={(e) => setNewLeadForm({...newLeadForm, stage_detail: e.target.value})}
                              className="form-select"
                            >
                              <option value="">Select...</option>
                              {stageDetails[newLeadForm.stage].map(detail => (
                                <option key={detail} value={detail}>{detail}</option>
                              ))}
                            </select>
                          </div>
                        )}

                    {/* Aligned Sectors */}
                    <div className="form-section">
                      <label className="form-label">Aligned Sectors</label>
                      <p className="form-help-text">Select a sector (optional)</p>
                      <select
                        value={Array.isArray(newLeadForm.aligned_sector) ? (newLeadForm.aligned_sector[0] || '') : newLeadForm.aligned_sector}
                        onChange={(e) => {
                          setNewLeadForm({...newLeadForm, aligned_sector: [e.target.value]});
                        }}
                        className="form-select"
                      >
                        <option value="">Select a sector...</option>
                        {alignedSectorOptions.map(sector => (
                          <option key={sector} value={sector}>{sector}</option>
                        ))}
                      </select>
                    </div>

                    {/* Creator - For Both Types (Read-only, auto-set to logged-in user) */}
                    <div className="form-section">
                      <label className="form-label">Creator</label>
                      <p className="form-help-text">Automatically set to you (the logged-in user)</p>
                      <input
                        type="text"
                        value={newLeadForm.ownership}
                        readOnly
                        className="form-input"
                        style={{
                          backgroundColor: '#f3f4f6',
                          cursor: 'not-allowed'
                        }}
                      />
                    </div>

                    {/* Current Owner - For Both Types (Editable dropdown) */}
                    <div className="form-section">
                      <label className="form-label">Current Owner *</label>
                      <p className="form-help-text">Who is currently responsible for this lead</p>
                      <select
                        required
                        value={newLeadForm.current_owner}
                        onChange={(e) => setNewLeadForm({...newLeadForm, current_owner: e.target.value})}
                        className="form-select"
                      >
                        <option value="">Please select who is responsible</option>
                        {staffMembers.map(member => (
                          <option key={member.id} value={member.name}>{member.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Notes / Comments */}
                    <div className="form-section">
                      <label className="form-label">Notes / Comments</label>
                      <p className="form-help-text">
                        Add any relevant notes about your relationship, the role, or the stage
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

                {activeModal === 'quickUpdate' && quickUpdateForm.selectedLead && (
                  <form className="modal-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      const updateDate = quickUpdateForm.update_date
                        ? new Date(quickUpdateForm.update_date).toLocaleDateString()
                        : new Date().toLocaleDateString();

                      // Create note with stage change information
                      const oldStage = quickUpdateForm.selectedLead.stage || 'Initial Outreach';
                      const newStage = quickUpdateForm.stage;
                      const stageChanged = oldStage !== newStage;

                      let noteContent = '';
                      if (stageChanged) {
                        noteContent = `📊 Stage: ${oldStage} → ${newStage}\n${quickUpdateForm.notes}`;
                      } else {
                        noteContent = quickUpdateForm.notes;
                      }

                      // Handle next_steps: append to array if provided
                      let nextStepsArray = [];
                      try {
                        if (quickUpdateForm.selectedLead.next_steps) {
                          nextStepsArray = typeof quickUpdateForm.selectedLead.next_steps === 'string'
                            ? JSON.parse(quickUpdateForm.selectedLead.next_steps)
                            : quickUpdateForm.selectedLead.next_steps;
                        }
                      } catch (e) {
                        nextStepsArray = [];
                      }

                      // If new next step is provided, add it to the array
                      if (quickUpdateForm.next_steps && quickUpdateForm.next_steps.trim()) {
                        nextStepsArray.push({
                          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          task: quickUpdateForm.next_steps.trim(),
                          created_at: new Date().toISOString(),
                          completed: false
                        });
                      }

                      const updateData = {
                        stage: quickUpdateForm.stage,
                        next_steps: nextStepsArray,
                        notes: quickUpdateForm.selectedLead.notes
                          ? `${quickUpdateForm.selectedLead.notes}\n\n[${updateDate}] ${noteContent}`
                          : `[${updateDate}] ${noteContent}`
                      };

                      await outreachAPI.updateOutreach(quickUpdateForm.selectedLead.id, updateData);

                      await activityAPI.createActivity({
                        user_name: user.name,
                        action_type: 'updated_lead',
                        entity_type: 'lead',
                        entity_name: `${quickUpdateForm.selectedLead.contact_name} - ${quickUpdateForm.selectedLead.company_name}`,
                        details: {
                          old_stage: quickUpdateForm.selectedLead.stage,
                          new_stage: quickUpdateForm.stage,
                          company: quickUpdateForm.selectedLead.company_name
                        }
                      });

                      showMessage('success', 'Lead updated successfully!');
                      closeModal();
                      fetchLeads();
                    } catch (error) {
                      showMessage('error', 'Failed to update lead. Please try again.');
                      console.error('Error updating lead:', error);
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <h2 className="modal-title">Quick Update: {quickUpdateForm.selectedLead.contact_name}</h2>
                    <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
                      {quickUpdateForm.selectedLead.company_name}
                    </p>

                    {/* Date Field */}
                    <div className="form-section">
                      <label className="form-label">Update Date</label>
                      <input
                        type="date"
                        value={quickUpdateForm.update_date}
                        onChange={(e) => setQuickUpdateForm({...quickUpdateForm, update_date: e.target.value})}
                        className="form-input"
                      />
                    </div>

                    {/* Stage Dropdown */}
                    <div className="form-section">
                      <label className="form-label">Stage *</label>
                      <select
                        required
                        value={quickUpdateForm.stage}
                        onChange={(e) => setQuickUpdateForm({...quickUpdateForm, stage: e.target.value, stage_detail: ''})}
                        className="form-select"
                      >
                        {stages.map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>

                    {/* Stage Detail Dropdown - Conditional */}
                    {stageDetails[quickUpdateForm.stage] && (
                      <div className="form-section">
                        <label className="form-label">
                          {quickUpdateForm.stage === 'Active Lead' ? 'Lead Type *' :
                           quickUpdateForm.stage === 'Close Won' ? 'Win Reason *' :
                           'Loss Reason *'}
                        </label>
                        <select
                          required
                          value={quickUpdateForm.stage_detail}
                          onChange={(e) => setQuickUpdateForm({...quickUpdateForm, stage_detail: e.target.value})}
                          className="form-select"
                        >
                          <option value="">Select...</option>
                          {stageDetails[quickUpdateForm.stage].map(detail => (
                            <option key={detail} value={detail}>{detail}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Activity Notes */}
                    <div className="form-section">
                      <label className="form-label">Activity Notes *</label>
                      <textarea
                        required
                        value={quickUpdateForm.notes}
                        onChange={(e) => setQuickUpdateForm({...quickUpdateForm, notes: e.target.value})}
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
                        value={quickUpdateForm.next_steps}
                        onChange={(e) => setQuickUpdateForm({...quickUpdateForm, next_steps: e.target.value})}
                        className="form-input"
                        placeholder="e.g., Follow up next week, Send resources, Schedule demo"
                      />
                    </div>

                    {/* Actions */}
                    <div className="modal-actions">
                      <button type="button" onClick={closeModal} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? 'Updating...' : 'Update Lead'}
                      </button>
                    </div>
                  </form>
                )}

                {activeModal === 'updateLead' && (
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
                            let leadsToShow = updateLeadForm.search ? leadSearchResults : leads.slice(0, 5);
                            
                            if (showMyLeadsOnly && !updateLeadForm.search) {
                              leadsToShow = leads.filter(lead => lead.ownership === user?.name).slice(0, 5);
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
                            let leadsToShow = updateLeadForm.search ? leadSearchResults : leads;
                            if (showMyLeadsOnly && !updateLeadForm.search) {
                              leadsToShow = leads.filter(lead => lead.ownership === user?.name);
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
              </div>
            </div>
          )}

          {/* View Details Modal - Separate from standard modals */}
          {activeModal === 'viewDetails' && selectedLeadDetails && (() => {
            console.log('Rendering View Details Modal for:', selectedLeadDetails);
            return (
              <div className="modal-overlay" onClick={() => {
                setActiveModal(null);
                setSelectedLeadDetails(null);
              }}>
                <div className="lead-details-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={(e) => {
                  e.stopPropagation();
                  setActiveModal(null);
                  setSelectedLeadDetails(null);
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <div className="lead-details">
                  {/* Header */}
                  <div className="lead-details__header">
                    <div>
                      <h2 className="lead-details__title">{selectedLeadDetails.contact_name || 'Lead Details'}</h2>
                      <p className="lead-details__company">{selectedLeadDetails.company_name}</p>
                    </div>
                    {!isEditMode ? (
                      <button
                        className="lead-details__edit-btn"
                        onClick={() => {
                          setIsEditMode(true);
                          setEditFormData({
                            source: selectedLeadDetails.source || selectedLeadDetails.contact_method || '',
                            contact_email: selectedLeadDetails.contact_email || '',
                            linkedin_url: selectedLeadDetails.linkedin_url || ''
                          });
                        }}
                      >
                        ✏️ Edit
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          className="lead-details__save-btn"
                          onClick={handleSaveLeadDetails}
                          disabled={loading}
                        >
                          {loading ? 'Saving...' : '💾 Save'}
                        </button>
                        <button
                          className="lead-details__cancel-btn"
                          onClick={() => {
                            setIsEditMode(false);
                            setEditFormData({});
                          }}
                        >
                          ✖️ Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Current Info */}
                  <div className="lead-details__current-info">
                    <div
                      className="lead-details__info-item lead-details__info-item--stage"
                      style={{ background: `linear-gradient(135deg, ${getStageColor(selectedLeadDetails.stage || 'Initial Outreach')} 0%, ${getStageColor(selectedLeadDetails.stage || 'Initial Outreach')}dd 100%)` }}
                    >
                      <span className="lead-details__label">Current Stage:</span>
                      <span className="lead-details__value">{selectedLeadDetails.stage || 'Initial Outreach'}</span>
                    </div>
                    <div className="lead-details__info-item">
                      <span className="lead-details__label">Creator:</span>
                      <span className="lead-details__value">{selectedLeadDetails.ownership || 'Unassigned'}</span>
                    </div>
                    <div className="lead-details__info-item">
                      <span className="lead-details__label">Current Owner:</span>
                      {isEditMode ? (
                        <select
                          className="lead-details__input"
                          value={editFormData.current_owner || selectedLeadDetails.current_owner || ''}
                          onChange={(e) => setEditFormData({...editFormData, current_owner: e.target.value})}
                        >
                          <option value="">Select owner...</option>
                          {staffMembers.map(member => (
                            <option key={member.id} value={member.name}>{member.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="lead-details__value">{selectedLeadDetails.current_owner || selectedLeadDetails.ownership || 'Unassigned'}</span>
                      )}
                    </div>
                    <div className="lead-details__info-item">
                      <span className="lead-details__label">Source:</span>
                      {isEditMode ? (
                        <input
                          type="text"
                          className="lead-details__input"
                          value={editFormData.source || ''}
                          onChange={(e) => setEditFormData({...editFormData, source: e.target.value})}
                          placeholder="e.g., LinkedIn, Referral, etc."
                        />
                      ) : (
                        <span className="lead-details__value">{selectedLeadDetails.source || selectedLeadDetails.contact_method || 'N/A'}</span>
                      )}
                    </div>
                    <div className="lead-details__info-item">
                      <span className="lead-details__label">Email:</span>
                      {isEditMode ? (
                        <input
                          type="email"
                          className="lead-details__input"
                          value={editFormData.contact_email || ''}
                          onChange={(e) => setEditFormData({...editFormData, contact_email: e.target.value})}
                          placeholder="email@company.com"
                        />
                      ) : (
                        <span className="lead-details__value">{selectedLeadDetails.contact_email || 'N/A'}</span>
                      )}
                    </div>
                    <div className="lead-details__info-item">
                      <span className="lead-details__label">LinkedIn:</span>
                      {isEditMode ? (
                        <input
                          type="url"
                          className="lead-details__input"
                          value={editFormData.linkedin_url || ''}
                          onChange={(e) => setEditFormData({...editFormData, linkedin_url: e.target.value})}
                          placeholder="https://linkedin.com/in/..."
                        />
                      ) : selectedLeadDetails.linkedin_url ? (
                        <a href={selectedLeadDetails.linkedin_url} target="_blank" rel="noopener noreferrer" className="lead-details__link">
                          View Profile
                        </a>
                      ) : (
                        <span className="lead-details__value">N/A</span>
                      )}
                    </div>
                  </div>

                  {/* Update Status Section */}
                  <div className="lead-details__status-update-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 className="lead-details__section-title" style={{ margin: 0 }}>📊 Update Lead Status</h3>
                      <button
                        className={showStatusUpdate ? 'lead-details__cancel-btn' : 'lead-details__edit-btn'}
                        onClick={() => {
                          setShowStatusUpdate(!showStatusUpdate);
                          if (!showStatusUpdate) {
                            setStatusUpdateForm({
                              stage: selectedLeadDetails.stage || 'Initial Outreach',
                              notes: '',
                              next_steps: '',
                              update_date: new Date().toISOString().split('T')[0]
                            });
                          }
                        }}
                      >
                        {showStatusUpdate ? '✖️ Cancel' : '📝 Update Status'}
                      </button>
                    </div>

                    {showStatusUpdate && (
                      <form className="lead-details__status-form" onSubmit={handleStatusUpdate}>
                        <div className="form-section">
                          <label className="form-label">Update Date</label>
                          <input
                            type="date"
                            className="form-input"
                            value={statusUpdateForm.update_date}
                            onChange={(e) => setStatusUpdateForm({...statusUpdateForm, update_date: e.target.value})}
                          />
                        </div>

                        <div className="form-section">
                          <label className="form-label">New Stage *</label>
                          <select
                            required
                            className="form-select"
                            value={statusUpdateForm.stage}
                            onChange={(e) => setStatusUpdateForm({...statusUpdateForm, stage: e.target.value, stage_detail: ''})}
                          >
                            {stages.map(stage => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                        </div>

                        {/* Stage Detail Dropdown - Conditional */}
                        {stageDetails[statusUpdateForm.stage] && (
                          <div className="form-section">
                            <label className="form-label">
                              {statusUpdateForm.stage === 'Active Lead' ? 'Lead Type *' :
                               statusUpdateForm.stage === 'Close Won' ? 'Win Reason *' :
                               'Loss Reason *'}
                            </label>
                            <select
                              required
                              value={statusUpdateForm.stage_detail}
                              onChange={(e) => setStatusUpdateForm({...statusUpdateForm, stage_detail: e.target.value})}
                              className="form-select"
                            >
                              <option value="">Select...</option>
                              {stageDetails[statusUpdateForm.stage].map(detail => (
                                <option key={detail} value={detail}>{detail}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="form-section">
                          <label className="form-label">Activity Notes *</label>
                          <textarea
                            required
                            className="form-textarea"
                            rows="4"
                            value={statusUpdateForm.notes}
                            onChange={(e) => setStatusUpdateForm({...statusUpdateForm, notes: e.target.value})}
                            placeholder="What happened? Record details about the conversation, meeting, or outreach..."
                          />
                        </div>

                        <div className="form-section">
                          <label className="form-label">Next Steps</label>
                          <input
                            type="text"
                            className="form-input"
                            value={statusUpdateForm.next_steps}
                            onChange={(e) => setStatusUpdateForm({...statusUpdateForm, next_steps: e.target.value})}
                            placeholder="e.g., Follow up next week, Send resources, Schedule demo"
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                          <button
                            type="button"
                            className="lead-details__cancel-btn"
                            onClick={() => setShowStatusUpdate(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="lead-details__save-btn"
                            disabled={loading}
                          >
                            {loading ? 'Updating...' : '💾 Update Lead'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Next Steps */}
                  {(() => {
                    // Parse next_steps array
                    let nextStepsArray = [];
                    try {
                      if (selectedLeadDetails.next_steps) {
                        nextStepsArray = typeof selectedLeadDetails.next_steps === 'string'
                          ? JSON.parse(selectedLeadDetails.next_steps)
                          : selectedLeadDetails.next_steps;
                      }
                    } catch (e) {
                      nextStepsArray = [];
                    }

                    // Filter only pending (uncompleted) next steps
                    const pendingSteps = nextStepsArray.filter(step => !step.completed);

                    if (pendingSteps.length === 0) return null;

                    // Helper function to calculate days since creation
                    const getDaysOld = (createdAt) => {
                      const created = new Date(createdAt);
                      const today = new Date();
                      const diffTime = Math.abs(today - created);
                      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    };

                    // Helper function to get border color based on age
                    const getAgeBorderColor = (daysOld) => {
                      if (daysOld <= 3) return '#10b981'; // Green - Recent
                      if (daysOld <= 7) return '#f59e0b'; // Orange - Getting old
                      return '#ef4444'; // Red - Overdue
                    };

                    return (
                      <div className="lead-details__next-steps">
                        <h3 className="lead-details__section-title" style={{ marginBottom: '16px' }}>📌 Pending Next Steps ({pendingSteps.length})</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {pendingSteps.map((step, index) => {
                            const daysOld = getDaysOld(step.created_at);
                            const borderColor = getAgeBorderColor(daysOld);

                            return (
                              <div
                                key={step.id}
                                style={{
                                  padding: '12px 16px',
                                  backgroundColor: '#f9fafb',
                                  borderRadius: '8px',
                                  borderLeft: `4px solid ${borderColor}`,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <p style={{
                                    margin: '0 0 6px 0',
                                    fontSize: '14px',
                                    color: '#374151',
                                    lineHeight: '1.5',
                                    fontWeight: '500'
                                  }}>
                                    {step.task}
                                  </p>
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}>
                                    <span>📅 Created {daysOld} day{daysOld !== 1 ? 's' : ''} ago</span>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: borderColor,
                                      color: '#ffffff',
                                      fontSize: '10px',
                                      fontWeight: '600',
                                      textTransform: 'uppercase'
                                    }}>
                                      {daysOld <= 3 ? 'Recent' : daysOld <= 7 ? 'Getting Old' : 'Overdue'}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  className="lead-details__complete-btn"
                                  onClick={() => handleCompleteNextStep(step.id, step.task)}
                                  disabled={loading}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '13px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}
                                >
                                  ✓ Mark Complete
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Update History */}
                  <div className="lead-details__history">
                    <h3 className="lead-details__section-title">📝 Update History</h3>
                    <div className="lead-details__timeline">
                      {(() => {
                        const notes = selectedLeadDetails.notes || '';
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
                            date: new Date(selectedLeadDetails.outreach_date).toLocaleDateString(),
                            content: notes
                          });
                        }
                        
                        // If still no updates, show initial outreach
                        if (updates.length === 0) {
                          updates.push({
                            date: new Date(selectedLeadDetails.outreach_date).toLocaleDateString(),
                            content: 'Initial outreach created'
                          });
                        }
                        
                        // Reverse to show most recent first
                        const reversedUpdates = [...updates].reverse();
                        
                        return reversedUpdates.map((update, index) => {
                          // Calculate the original index for editing
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
                                      className="lead-details__update-save-btn"
                                      onClick={async () => {
                                        // Rebuild notes with updated values
                                        const updatedUpdates = updates.map((u, i) => ({
                                          date: i === index ? (editFormData[`update_${index}_date`] || u.date) : u.date,
                                          content: i === index ? (editFormData[`update_${index}_content`] || u.content) : u.content
                                        }));
                                        
                                        const newNotes = updatedUpdates
                                          .map(u => `[${u.date}] ${u.content}`)
                                          .join('\n\n');
                                        
                                        setLoading(true);
                                        try {
                                          await outreachAPI.updateOutreach(selectedLeadDetails.id, { notes: newNotes });
                                          showMessage('success', 'Update history edited successfully!');
                                          setEditingUpdateIndex(null);
                                          fetchLeads();
                                          
                                          const updatedLeads = await outreachAPI.getAllOutreach();
                                          const updatedLead = updatedLeads.find(l => l.id === selectedLeadDetails.id);
                                          if (updatedLead) {
                                            setSelectedLeadDetails(updatedLead);
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
                                  <div className="lead-details__update-content">
                                    {(() => {
                                      // Check if content contains stage change pattern: "📊 Stage: OldStage → NewStage"
                                      const stagePattern = /📊 Stage: (.+?) → (.+?)(\n|$)/;
                                      const match = update.content.match(stagePattern);

                                      if (match) {
                                        const newStage = match[2];
                                        const remainingContent = update.content.replace(stagePattern, '').trim();

                                        return (
                                          <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>📊 Stage:</span>
                                              <span
                                                style={{
                                                  backgroundColor: getStageColor(newStage),
                                                  color: '#ffffff',
                                                  padding: '4px 10px',
                                                  borderRadius: '10px',
                                                  fontSize: '11px',
                                                  fontWeight: '600',
                                                  textTransform: 'uppercase',
                                                  letterSpacing: '0.3px'
                                                }}
                                              >
                                                {newStage}
                                              </span>
                                            </div>
                                            {remainingContent && (
                                              <div style={{ color: '#4b5563', lineHeight: '1.6' }}>
                                                {remainingContent}
                                              </div>
                                            )}
                                          </>
                                        );
                                      }

                                      return update.content;
                                    })()}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Aligned Sectors */}
                  {(() => {
                    try {
                      let sectors = [];
                      if (selectedLeadDetails.aligned_sector) {
                        if (typeof selectedLeadDetails.aligned_sector === 'string') {
                          sectors = JSON.parse(selectedLeadDetails.aligned_sector);
                        } else if (Array.isArray(selectedLeadDetails.aligned_sector)) {
                          sectors = selectedLeadDetails.aligned_sector;
                        }
                      }
                      
                      if (sectors.length === 0) return null;
                      
                      return (
                        <div className="lead-details__sectors">
                          <h3 className="lead-details__section-title">🎯 Aligned Sectors</h3>
                          <div className="lead-details__sector-tags">
                            {sectors.map((sector, index) => (
                              <span key={index} className="lead-details__sector-tag">{sector}</span>
                            ))}
                          </div>
                        </div>
                      );
                    } catch (error) {
                      console.error('Error parsing aligned sectors:', error);
                      return null;
                    }
                  })()}
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
};

export default AllLeads;

