/**
 * PopupLeads Hub - Core Application Logic
 * Pure Vanilla JavaScript ES6+ with localStorage persistence
 */

// ==========================================================================
// 1. Initial State & Sample Data
// ==========================================================================

const STORAGE_KEY = 'popupleads_dashboard_data_v3';

const INITIAL_SAMPLE_DATA = {
  countries: [
    {
      id: 'c-de-pulkit',
      name: 'DE — Pulkit',
      flag: '🌍',
      status: 'active',
      clients: [
        {
          id: 'cl-de-pulkit',
          name: 'Pulkit',
          contact: 'pulkit@leads.de',
          notes: 'High volume leads',
          entries: []
        }
      ]
    },
    {
      id: 'c-de-anshu',
      name: 'DE — Anshu',
      flag: '🌍',
      status: 'active',
      clients: [
        {
          id: 'cl-de-anshu',
          name: 'Anshu',
          contact: 'anshu@leads.de',
          notes: 'E-commerce popup leads',
          entries: []
        }
      ]
    },
    {
      id: 'c-at-pulkit',
      name: 'AT — Pulkit',
      flag: '🌍',
      status: 'active',
      clients: [
        {
          id: 'cl-at-pulkit',
          name: 'Pulkit',
          contact: 'pulkit@leads.at',
          notes: 'Austria popup leads',
          entries: []
        }
      ]
    },
    {
      id: 'c-ch-pulkit',
      name: 'CH — Pulkit',
      flag: '🌍',
      status: 'active',
      clients: [
        {
          id: 'cl-ch-pulkit',
          name: 'Pulkit',
          contact: 'pulkit@leads.ch',
          notes: 'Swiss wealth leads',
          entries: []
        }
      ]
    },
    {
      id: 'c-it-pulkit',
      name: 'IT — Pulkit',
      flag: '🌍',
      status: 'active',
      clients: [
        {
          id: 'cl-it-pulkit',
          name: 'Pulkit',
          contact: 'pulkit@leads.it',
          notes: 'Italy popup campaigns',
          entries: []
        }
      ]
    },
    {
      id: 'c-uk-mj',
      name: 'UK — MJ',
      flag: '🌍',
      status: 'paused',
      clients: [
        {
          id: 'cl-uk-mj',
          name: 'MJ',
          contact: 'mj@leads.uk',
          notes: 'Fleet inquiries',
          entries: []
        }
      ]
    },
    {
      id: 'c-uk-smith',
      name: 'UK — Smith',
      flag: '🌍',
      status: 'paused',
      clients: [
        {
          id: 'cl-uk-smith',
          name: 'Smith',
          contact: 'smith@leads.uk',
          notes: 'Mortgage leads',
          entries: []
        }
      ]
    },
    {
      id: 'c-uk-maxy',
      name: 'UK — Maxy',
      flag: '🌍',
      status: 'active',
      clients: [
        {
          id: 'cl-uk-maxy',
          name: 'Maxy',
          contact: 'maxy@leads.uk',
          notes: 'Auto loans capture',
          entries: [
            {
              id: 'e-uk-maxy-1',
              link: 'https://leads.uk/quotes-v1',
              insertedAt: '2026-09-03T15:23:00',
              mobile: '0330-223-2128'
            }
          ]
        }
      ]
    },
    {
      id: 'c-usa-mj',
      name: 'USA — MJ',
      flag: '🌍',
      status: 'paused',
      clients: [
        {
          id: 'cl-usa-mj',
          name: 'MJ',
          contact: 'mj@leads.us',
          notes: 'Solar services lead capture',
          entries: []
        }
      ]
    },
    {
      id: 'c-usa-maxy',
      name: 'USA — Maxy',
      flag: '🌍',
      status: 'paused',
      clients: [
        {
          id: 'cl-usa-maxy',
          name: 'Maxy',
          contact: 'maxy@leads.us',
          notes: 'Business loan inquiries',
          entries: [
            {
              id: 'e-usa-maxy-1',
              link: 'https://leads.us/biz-loans',
              insertedAt: '2026-09-03T09:00:00',
              mobile: '+1 (555) 876-5432'
            }
          ]
        }
      ]
    }
  ]
};

// ==========================================================================
// 2. Application State & Storage Management
// ==========================================================================

class AppState {
  constructor() {
    this.data = this.loadData();
    this.currentStatusFilter = 'all'; // 'all' | 'active' | 'paused'
    this.searchQuery = '';
    this.sortBy = 'name-asc'; // 'name-asc' | 'name-desc' | 'clients-desc' | 'links-desc'
    this.collapsedCountryIds = new Set();
    this.activeCountryFocusId = null;
  }

  loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.countries)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to parse localStorage data, loading initial sample data.', err);
    }
    this.saveData(INITIAL_SAMPLE_DATA);
    return JSON.parse(JSON.stringify(INITIAL_SAMPLE_DATA));
  }

  saveData(dataToSave = this.data) {
    this.data = dataToSave;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
      showToast('Error saving data to local storage', 'error');
    }
  }

  resetToSampleData() {
    this.data = JSON.parse(JSON.stringify(INITIAL_SAMPLE_DATA));
    this.saveData();
    renderApp();
    showToast('Reset data to initial sample campaigns', 'info');
  }

  // --- CRUD: Country ---
  addCountry(name, flag, status = 'active') {
    const newCountry = {
      id: 'c-' + generateId(),
      name: name.trim(),
      flag: flag.trim() || '🌐',
      status: status === 'paused' ? 'paused' : 'active',
      clients: []
    };
    this.data.countries.push(newCountry);
    this.saveData();
    return newCountry;
  }

  updateCountry(countryId, name, flag, status) {
    const country = this.getCountryById(countryId);
    if (!country) return null;
    country.name = name.trim();
    country.flag = flag.trim() || '🌐';
    if (status) country.status = status;
    this.saveData();
    return country;
  }

  toggleCountryStatus(countryId) {
    const country = this.getCountryById(countryId);
    if (!country) return null;
    country.status = country.status === 'active' ? 'paused' : 'active';
    this.saveData();
    return country;
  }

  deleteCountry(countryId) {
    const index = this.data.countries.findIndex(c => c.id === countryId);
    if (index !== -1) {
      const deleted = this.data.countries.splice(index, 1)[0];
      this.saveData();
      return deleted;
    }
    return null;
  }

  getCountryById(countryId) {
    return this.data.countries.find(c => c.id === countryId);
  }

  // --- CRUD: Client ---
  addClient(countryId, name, contact = '', notes = '') {
    const country = this.getCountryById(countryId);
    if (!country) return null;
    const newClient = {
      id: 'cl-' + generateId(),
      name: name.trim(),
      contact: contact.trim(),
      notes: notes.trim(),
      entries: []
    };
    country.clients.push(newClient);
    this.saveData();
    return newClient;
  }

  updateClient(countryId, clientId, name, contact, notes) {
    const country = this.getCountryById(countryId);
    if (!country) return null;
    const client = country.clients.find(cl => cl.id === clientId);
    if (!client) return null;
    client.name = name.trim();
    client.contact = contact.trim();
    client.notes = notes.trim();
    this.saveData();
    return client;
  }

  deleteClient(countryId, clientId) {
    const country = this.getCountryById(countryId);
    if (!country) return null;
    const index = country.clients.findIndex(cl => cl.id === clientId);
    if (index !== -1) {
      const deleted = country.clients.splice(index, 1)[0];
      this.saveData();
      return deleted;
    }
    return null;
  }

  getClientById(countryId, clientId) {
    const country = this.getCountryById(countryId);
    if (!country) return null;
    return country.clients.find(cl => cl.id === clientId);
  }

  // --- CRUD: Link Entry ---
  addEntry(countryId, clientId, link, insertedAt, mobile) {
    const client = this.getClientById(countryId, clientId);
    if (!client) return null;
    const newEntry = {
      id: 'e-' + generateId(),
      link: link.trim(),
      insertedAt: insertedAt || new Date().toISOString(),
      mobile: mobile.trim()
    };
    client.entries.unshift(newEntry); // new entries on top
    this.saveData();
    return newEntry;
  }

  updateEntry(countryId, clientId, entryId, link, insertedAt, mobile) {
    const client = this.getClientById(countryId, clientId);
    if (!client) return null;
    const entry = client.entries.find(e => e.id === entryId);
    if (!entry) return null;
    entry.link = link.trim();
    entry.insertedAt = insertedAt;
    entry.mobile = mobile.trim();
    this.saveData();
    return entry;
  }

  deleteEntry(countryId, clientId, entryId) {
    const client = this.getClientById(countryId, clientId);
    if (!client) return null;
    const index = client.entries.findIndex(e => e.id === entryId);
    if (index !== -1) {
      const deleted = client.entries.splice(index, 1)[0];
      this.saveData();
      return deleted;
    }
    return null;
  }

  // --- Calculated Metrics ---
  getMetrics() {
    let totalCountries = this.data.countries.length;
    let activeCountries = 0;
    let pausedCountries = 0;
    let totalClients = 0;
    let totalLinks = 0;

    this.data.countries.forEach(country => {
      if (country.status === 'active') activeCountries++;
      else pausedCountries++;

      if (Array.isArray(country.clients)) {
        totalClients += country.clients.length;
        country.clients.forEach(client => {
          if (Array.isArray(client.entries)) {
            totalLinks += client.entries.length;
          }
        });
      }
    });

    return {
      totalCountries,
      activeCountries,
      pausedCountries,
      totalClients,
      totalLinks
    };
  }

  // --- Filtered & Sorted Countries ---
  getFilteredCountries() {
    let result = [...this.data.countries];

    // Status filter
    if (this.currentStatusFilter === 'active') {
      result = result.filter(c => c.status === 'active');
    } else if (this.currentStatusFilter === 'paused') {
      result = result.filter(c => c.status === 'paused');
    }

    // Search query filter (matches country name, client name, mobile number, or popup link)
    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(country => {
        if (country.name.toLowerCase().includes(q)) return true;
        return country.clients.some(client => {
          if (client.name.toLowerCase().includes(q)) return true;
          if (client.contact && client.contact.toLowerCase().includes(q)) return true;
          if (client.notes && client.notes.toLowerCase().includes(q)) return true;
          return client.entries.some(entry => {
            if (entry.link && entry.link.toLowerCase().includes(q)) return true;
            if (entry.mobile && entry.mobile.toLowerCase().includes(q)) return true;
            return false;
          });
        });
      });
    }

    // Sort
    result.sort((a, b) => {
      if (this.sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (this.sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      } else if (this.sortBy === 'clients-desc') {
        const countA = a.clients ? a.clients.length : 0;
        const countB = b.clients ? b.clients.length : 0;
        return countB - countA;
      } else if (this.sortBy === 'links-desc') {
        const linksA = (a.clients || []).reduce((acc, cl) => acc + (cl.entries ? cl.entries.length : 0), 0);
        const linksB = (b.clients || []).reduce((acc, cl) => acc + (cl.entries ? cl.entries.length : 0), 0);
        return linksB - linksA;
      }
      return 0;
    });

    return result;
  }
}

const state = new AppState();

// ==========================================================================
// 3. Helper Utilities
// ==========================================================================

function generateId() {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoString) {
  if (!isoString) return { dateStr: 'N/A', relativeStr: '' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { dateStr: isoString, relativeStr: '' };

    const dateStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relativeStr = '';
    if (diffSec < 60) relativeStr = 'Just now';
    else if (diffMin < 60) relativeStr = `${diffMin}m ago`;
    else if (diffHours < 24) relativeStr = `${diffHours}h ago`;
    else if (diffDays < 30) relativeStr = `${diffDays}d ago`;
    else relativeStr = `${Math.floor(diffDays / 30)}mo ago`;

    return { dateStr, relativeStr };
  } catch (e) {
    return { dateStr: isoString, relativeStr: '' };
  }
}

function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success');
    }).catch(() => {
      fallbackCopyText(text, successMsg);
    });
  } else {
    fallbackCopyText(text, successMsg);
  }
}

function fallbackCopyText(text, successMsg) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'success');
  } catch (err) {
    showToast('Failed to copy text', 'error');
  }
  document.body.removeChild(textArea);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `
    <div class="toast-left">
      <span class="toast-icon">${icon}</span>
      <span>${escapeHtml(message)}</span>
    </div>
    <button class="toast-close" aria-label="Dismiss toast">×</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Convert ISO date or current time to datetime-local input string format (YYYY-MM-DDTHH:MM)
function toLocalDatetimeInput(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ==========================================================================
// 4. Modal System Controller
// ==========================================================================

const Modal = {
  backdrop: document.getElementById('modalBackdrop'),

  open(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    this.backdrop.classList.add('is-open');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Autofocus first visible text input
    setTimeout(() => {
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  },

  close(modalId) {
    if (modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('is-open');
    } else {
      document.querySelectorAll('.modal.is-open').forEach(m => m.classList.remove('is-open'));
    }
    this.backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  },

  // Confirm Modal Handler
  confirm({ title, message, targetName, confirmText = 'Delete Permanently', onConfirm }) {
    document.getElementById('confirmModalTitle').textContent = title || 'Confirm Action';
    document.getElementById('confirmModalMessage').textContent = message || 'Are you sure you want to proceed?';
    document.getElementById('confirmModalTargetName').textContent = targetName || '';
    
    const actionBtn = document.getElementById('confirmModalActionBtn');
    actionBtn.textContent = confirmText;

    // Clone button to remove previous event listeners cleanly
    const newActionBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

    newActionBtn.addEventListener('click', () => {
      Modal.close('confirmModal');
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    });

    Modal.open('confirmModal');
  }
};

// ==========================================================================
// 5. DOM Rendering Engines
// ==========================================================================

// --- Render KPI Metrics ---
function renderKPIs() {
  const metrics = state.getMetrics();
  document.getElementById('kpiActiveCount').textContent = metrics.activeCountries;
  document.getElementById('kpiPausedCount').textContent = metrics.pausedCountries;
  document.getElementById('kpiTotalClients').textContent = metrics.totalClients;
  document.getElementById('kpiTotalLinks').textContent = metrics.totalLinks;

  // Filter counters
  document.getElementById('countFilterAll').textContent = metrics.totalCountries;
  document.getElementById('countFilterActive').textContent = metrics.activeCountries;
  document.getElementById('countFilterPaused').textContent = metrics.pausedCountries;
  document.getElementById('sidebarCountryCount').textContent = metrics.totalCountries;
}

// --- TOP DASHBOARD SECTION: Render Running & Paused Country Chips ---
function renderLiveStatusRows() {
  const runningContainer = document.getElementById('runningCountriesChips');
  const pausedContainer = document.getElementById('pausedCountriesChips');
  const runningCountEl = document.getElementById('runningCountriesCount');
  const pausedCountEl = document.getElementById('pausedCountriesCount');

  const runningCountries = state.data.countries.filter(c => c.status === 'active');
  const pausedCountries = state.data.countries.filter(c => c.status === 'paused');

  runningCountEl.textContent = `${runningCountries.length} ACTIVE`;
  pausedCountEl.textContent = `${pausedCountries.length} PAUSED`;

  // Render Running Chips
  if (runningCountries.length === 0) {
    runningContainer.innerHTML = `<span class="status-chips-empty">No active country campaigns currently running.</span>`;
  } else {
    runningContainer.innerHTML = runningCountries.map(country => {
      const displayName = country.name;
      const flagDisplay = country.flag || '🌍';

      return `
        <div class="country-chip chip-active" data-country-id="${country.id}" title="Active campaign: ${escapeHtml(displayName)}">
          <span class="chip-flag">${flagDisplay}</span>
          <span class="chip-name">${escapeHtml(displayName)}</span>
          <button class="chip-quick-toggle" data-toggle-country="${country.id}" title="Pause ${escapeHtml(displayName)} campaign">Pause</button>
        </div>
      `;
    }).join('');
  }

  // Render Paused Chips
  if (pausedCountries.length === 0) {
    pausedContainer.innerHTML = `<span class="status-chips-empty">No paused country campaigns.</span>`;
  } else {
    pausedContainer.innerHTML = pausedCountries.map(country => {
      const displayName = country.name;
      const flagDisplay = country.flag || '🌍';

      return `
        <div class="country-chip chip-paused" data-country-id="${country.id}" title="Paused campaign: ${escapeHtml(displayName)}">
          <span class="chip-flag">${flagDisplay}</span>
          <span class="chip-name">${escapeHtml(displayName)}</span>
          <button class="chip-quick-toggle" data-toggle-country="${country.id}" title="Resume ${escapeHtml(displayName)} campaign">Resume</button>
        </div>
      `;
    }).join('');
  }
}

// --- Render Left Sidebar Tree Nav ---
function renderSidebar() {
  const container = document.getElementById('sidebarCountryList');
  const filterQuery = (document.getElementById('sidebarSearchInput').value || '').trim().toLowerCase();

  let countries = [...state.data.countries];
  if (filterQuery) {
    countries = countries.filter(c => {
      if (c.name.toLowerCase().includes(filterQuery)) return true;
      return (c.clients || []).some(cl => cl.name.toLowerCase().includes(filterQuery));
    });
  }

  if (countries.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        No matching countries found
      </div>
    `;
    return;
  }

  container.innerHTML = countries.map((country, index) => {
    const isActive = country.status === 'active';
    const isFocus = state.activeCountryFocusId === country.id;
    const colorThemeClass = (index % 2 === 0) ? 'sidebar-alt-blue' : 'sidebar-alt-emerald';
    const flagDisplay = country.flag || '🌍';

    return `
      <div class="sidebar-country-card ${colorThemeClass} ${isActive ? 'is-active-status' : 'is-paused-status'} ${isFocus ? 'is-active-filter' : ''}" id="sidebar-country-${country.id}">
        <div class="sidebar-country-head">
          <div class="sidebar-country-left" data-focus-country="${country.id}" title="View ${escapeHtml(country.name)}">
            <span class="sidebar-flag">${flagDisplay}</span>
            <div class="sidebar-country-text-wrap">
              <div class="sidebar-country-name-line">
                <span class="sidebar-country-name" title="${escapeHtml(country.name)}">${escapeHtml(country.name)}</span>
              </div>
            </div>
          </div>
          
          <div class="sidebar-country-actions">
            <!-- Active/Paused mini toggle -->
            <label class="status-toggle-mini" title="Toggle Active/Paused for ${escapeHtml(country.name)}">
              <input type="checkbox" data-sidebar-toggle="${country.id}" ${isActive ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>

            <!-- Edit country & client -->
            <button type="button" class="btn-sidebar-icon" data-edit-country="${country.id}" title="Edit ${escapeHtml(country.name)} & Client details">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- Render Main Content Country Cards ---
function renderMainCountryCards() {
  const container = document.getElementById('countryCardsContainer');
  const emptyState = document.getElementById('emptyStateView');
  const filteredCountries = state.getFilteredCountries();

  if (filteredCountries.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');

    if (state.searchQuery) {
      document.getElementById('emptyStateTitle').textContent = 'No matching campaigns found';
      document.getElementById('emptyStateMessage').textContent = `No countries, clients, links, or phone numbers matched "${state.searchQuery}". Try a different keyword.`;
    } else if (state.currentStatusFilter !== 'all') {
      document.getElementById('emptyStateTitle').textContent = `No ${state.currentStatusFilter} campaigns`;
      document.getElementById('emptyStateMessage').textContent = `There are currently no country campaigns in "${state.currentStatusFilter}" status.`;
    } else {
      document.getElementById('emptyStateTitle').textContent = 'No Country Campaigns Yet';
      document.getElementById('emptyStateMessage').textContent = 'Get started by creating your first country popup campaign using the button below.';
    }
    return;
  }

  emptyState.classList.add('hidden');

  container.innerHTML = filteredCountries.map((country, index) => {
    const isActive = country.status === 'active';
    const isCollapsed = state.collapsedCountryIds.has(country.id);
    const clients = country.clients || [];
    const totalLinks = clients.reduce((sum, cl) => sum + (cl.entries ? cl.entries.length : 0), 0);
    const flagDisplay = country.flag || '🌍';
    const colorThemeClass = (index % 2 === 0) ? 'card-alt-blue' : 'card-alt-emerald';

    // Find the latest insertedAt across all client entries in this country
    const allEntries = clients.flatMap(c => c.entries || []);
    let latestTimeFormatted = '';
    let latestRelativeTime = '';
    if (allEntries.length > 0) {
      const sorted = [...allEntries].sort((a, b) => new Date(b.insertedAt) - new Date(a.insertedAt));
      const latest = sorted[0];
      const { dateStr, relativeStr } = formatDate(latest.insertedAt);
      latestTimeFormatted = dateStr;
      latestRelativeTime = relativeStr;
    }

    return `
      <article class="country-card ${colorThemeClass} ${isActive ? '' : 'is-paused'}" id="country-card-${country.id}">
        
        <!-- Country Header -->
        <header class="country-card-header">
          <div class="country-identity">
            <span class="country-big-flag">${flagDisplay}</span>
            <div class="country-meta">
              <h3>
                <span>${escapeHtml(country.name)}</span>
                <span class="country-status-pill ${isActive ? 'status-active' : 'status-paused'}">
                  ${isActive ? '• ACTIVE' : '• PAUSED'}
                </span>
              </h3>
              <div class="country-stats-inline">
                <span><strong>${clients.length}</strong> ${clients.length === 1 ? 'Client' : 'Clients'}</span>
                <span>•</span>
                <span><strong>${totalLinks}</strong> Popup ${totalLinks === 1 ? 'Link' : 'Links'}</span>
              </div>
            </div>
          </div>

          <!-- Prominent Inserted Time in Header (Big Size) -->
          <div class="country-header-time-block">
            <div class="header-time-icon">🕒</div>
            <div class="header-time-info">
              <span class="header-time-label">INSERTED TIME</span>
              <span class="header-time-main">${latestTimeFormatted || 'No Time Recorded'}</span>
              ${latestRelativeTime ? `<span class="header-time-sub">${escapeHtml(latestRelativeTime)}</span>` : ''}
            </div>
          </div>

          <div class="country-header-actions">
            <!-- Active/Paused Toggle Switch -->
            <div class="status-toggle-card">
              <span style="color: ${isActive ? 'var(--emerald)' : 'var(--amber)'}">${isActive ? 'Running' : 'Paused'}</span>
              <label class="switch" title="Toggle Active / Paused">
                <input type="checkbox" data-card-toggle="${country.id}" ${isActive ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>

            <!-- Edit Country & Client Button -->
            <button class="btn-icon" data-edit-country="${country.id}" title="Edit Country & Client details">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>

            <!-- Delete Country Button -->
            <button class="btn-icon danger" data-delete-country="${country.id}" title="Delete ${escapeHtml(country.name)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>

            <!-- Collapse / Expand Toggle Button -->
            <button class="btn-icon" data-toggle-collapse="${country.id}" title="${isCollapsed ? 'Expand' : 'Collapse'} card">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${isCollapsed 
                  ? '<polyline points="6 9 12 15 18 9"></polyline>' 
                  : '<polyline points="18 15 12 9 6 15"></polyline>'}
              </svg>
            </button>
          </div>
        </header>

        <!-- Country Body (Clients & Link Entries) -->
        <div class="country-card-body ${isCollapsed ? 'collapsed' : ''}">
          ${clients.length === 0 ? `
            <div class="no-clients-box">
              <p>No client details configured for <strong>${escapeHtml(country.name)}</strong>.</p>
              <button class="btn btn-outline btn-sm" data-edit-country="${country.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Add Client Details</span>
              </button>
            </div>
          ` : clients.map(client => renderClientBlock(country, client)).join('')}
        </div>

      </article>
    `;
  }).join('');
}

// --- Render Individual Client Block inside Country Card ---
function renderClientBlock(country, client) {
  const entries = client.entries || [];

  return `
    <section class="client-block" id="client-${client.id}">
      
      <!-- Client Header Bar -->
      <div class="client-block-header">
        <div class="client-title-info">
          <div class="client-badge-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <span class="client-name">${escapeHtml(client.name)}</span>
          ${client.contact ? `<span class="client-contact-tag" title="Client Contact">📞 ${escapeHtml(client.contact)}</span>` : ''}
          ${client.notes ? `<span class="client-notes-tag" title="Campaign Notes">"${escapeHtml(client.notes)}"</span>` : ''}
        </div>

        <div class="client-header-actions">
          <!-- Add Link Entry -->
          <button class="btn btn-primary btn-sm" data-add-entry="${country.id}" data-client-id="${client.id}" title="Add new popup link + mobile combination">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>+ Add Entry</span>
          </button>

          <!-- Edit Client & Country -->
          <button class="btn-icon btn-sm" data-edit-country="${country.id}" title="Edit Country & Client details">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>

          <!-- Delete Client -->
          <button class="btn-icon btn-sm danger" data-delete-client="${country.id}" data-client-id="${client.id}" title="Delete client">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Client Entries Table -->
      <div class="entries-table-wrapper">
        <table class="entries-table">
          <thead>
            <tr>
              <th style="width: 48%;">Popup Link</th>
              <th style="width: 38%;">Associated Mobile(s)</th>
              <th style="width: 14%; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${entries.length === 0 ? `
              <tr>
                <td colspan="3" class="no-entries-row">
                  No popup link entries for this client yet. Click <strong>+ Add Entry</strong> above to add one.
                </td>
              </tr>
            ` : entries.map(entry => renderEntryRow(country, client, entry)).join('')}
          </tbody>
        </table>
      </div>

    </section>
  `;
}

// --- Render Entry Row in Table (Time removed from bottom as it is in the header) ---
function renderEntryRow(country, client, entry) {
  const mobiles = (entry.mobile || '').split(',').map(m => m.trim()).filter(Boolean);

  return `
    <tr id="entry-${entry.id}">
      <!-- Link Cell -->
      <td>
        <div class="link-cell">
          <a href="${escapeHtml(entry.link)}" target="_blank" rel="noopener noreferrer" class="link-anchor" title="${escapeHtml(entry.link)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>${escapeHtml(entry.link)}</span>
          </a>
          <button class="btn-copy-mini" data-copy-link="${escapeHtml(entry.link)}" title="Copy popup URL">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </td>

      <!-- Mobile Numbers Cell -->
      <td>
        <div class="mobiles-cell">
          ${mobiles.length === 0 ? '<span style="color: var(--text-subtle);">None</span>' : mobiles.map(num => {
            const cleanDigits = num.replace(/[^\d+]/g, '');
            return `
              <div class="mobile-chip">
                <a href="tel:${cleanDigits}" class="mobile-tel-link" title="Call ${escapeHtml(num)}">📱 ${escapeHtml(num)}</a>
                <a href="https://wa.me/${cleanDigits.replace('+', '')}" target="_blank" rel="noopener" class="whatsapp-link" title="Message on WhatsApp">
                  💬
                </a>
              </div>
            `;
          }).join('')}
        </div>
      </td>

      <!-- Actions -->
      <td>
        <div class="row-actions">
          <button class="btn-icon btn-sm" data-edit-entry="${country.id}" data-client-id="${client.id}" data-entry-id="${entry.id}" title="Edit Link Entry">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon btn-sm danger" data-delete-entry="${country.id}" data-client-id="${client.id}" data-entry-id="${entry.id}" title="Delete Entry">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Master Render trigger
function renderApp() {
  renderKPIs();
  renderLiveStatusRows();
  renderSidebar();
  renderMainCountryCards();
}

// ==========================================================================
// 6. Modal Form Handlers (Add / Edit)
// ==========================================================================

// --- 1. Country & Client Modal ---
function openAddCountryModal() {
  document.getElementById('countryForm').reset();
  document.getElementById('countryIdInput').value = '';
  document.getElementById('countryClientIdInput').value = '';
  document.getElementById('countryModalTitle').textContent = 'Add New Country & Client';
  document.getElementById('countryFlagInput').value = '🌐';
  document.getElementById('countryStatusSelect').value = 'active';
  document.getElementById('countryClientNameInput').value = '';
  document.getElementById('countryClientContactInput').value = '';
  document.getElementById('countryClientNotesInput').value = '';
  Modal.open('countryModal');
}

function openEditCountryModal(countryId) {
  const country = state.getCountryById(countryId);
  if (!country) return;

  document.getElementById('countryIdInput').value = country.id;
  document.getElementById('countryNameInput').value = country.name;
  document.getElementById('countryFlagInput').value = country.flag;
  document.getElementById('countryStatusSelect').value = country.status;
  document.getElementById('countryModalTitle').textContent = `Edit Country & Client: ${country.name}`;

  // Populate client fields from primary client (if exists)
  const client = (country.clients && country.clients[0]) ? country.clients[0] : null;
  if (client) {
    document.getElementById('countryClientIdInput').value = client.id;
    document.getElementById('countryClientNameInput').value = client.name || '';
    document.getElementById('countryClientContactInput').value = client.contact || '';
    document.getElementById('countryClientNotesInput').value = client.notes || '';
  } else {
    document.getElementById('countryClientIdInput').value = '';
    document.getElementById('countryClientNameInput').value = '';
    document.getElementById('countryClientContactInput').value = '';
    document.getElementById('countryClientNotesInput').value = '';
  }

  Modal.open('countryModal');
}

function handleCountryFormSubmit(e) {
  e.preventDefault();
  const countryId = document.getElementById('countryIdInput').value;
  const clientId = document.getElementById('countryClientIdInput').value;
  const name = document.getElementById('countryNameInput').value.trim();
  const flag = document.getElementById('countryFlagInput').value.trim() || '🌐';
  const status = document.getElementById('countryStatusSelect').value;
  const clientName = document.getElementById('countryClientNameInput').value.trim();
  const clientContact = document.getElementById('countryClientContactInput').value.trim();
  const clientNotes = document.getElementById('countryClientNotesInput').value.trim();

  if (!name) {
    showToast('Please enter a country name', 'error');
    return;
  }
  if (!clientName) {
    showToast('Please enter a client/business name', 'error');
    return;
  }

  if (countryId) {
    // Update existing Country
    state.updateCountry(countryId, name, flag, status);
    
    // Update or add Client
    if (clientId) {
      state.updateClient(countryId, clientId, clientName, clientContact, clientNotes);
    } else {
      state.addClient(countryId, clientName, clientContact, clientNotes);
    }
    showToast(`Updated "${name}" country & client details`, 'success');
  } else {
    // Create new Country + Client in one unified step
    const newCountry = state.addCountry(name, flag, status);
    state.addClient(newCountry.id, clientName, clientContact, clientNotes);
    showToast(`Created country "${name}" with client "${clientName}"`, 'success');
  }

  Modal.close('countryModal');
  renderApp();
}

// --- 2. Client Modal ---
function openAddClientModal(countryId) {
  const country = state.getCountryById(countryId);
  if (!country) return;
  document.getElementById('clientForm').reset();
  document.getElementById('clientCountryIdInput').value = country.id;
  document.getElementById('clientIdInput').value = '';
  document.getElementById('clientModalTitle').textContent = 'Add Client';
  document.getElementById('clientTargetCountryName').textContent = `${country.name} ${country.flag}`;
  Modal.open('clientModal');
}

function openEditClientModal(countryId, clientId) {
  const country = state.getCountryById(countryId);
  if (!country) return;
  const client = state.getClientById(countryId, clientId);
  if (!client) return;

  document.getElementById('clientCountryIdInput').value = country.id;
  document.getElementById('clientIdInput').value = client.id;
  document.getElementById('clientNameInput').value = client.name;
  document.getElementById('clientContactInput').value = client.contact || '';
  document.getElementById('clientNotesInput').value = client.notes || '';
  document.getElementById('clientModalTitle').textContent = `Edit Client: ${client.name}`;
  document.getElementById('clientTargetCountryName').textContent = `${country.name} ${country.flag}`;
  Modal.open('clientModal');
}

function handleClientFormSubmit(e) {
  e.preventDefault();
  const countryId = document.getElementById('clientCountryIdInput').value;
  const clientId = document.getElementById('clientIdInput').value;
  const name = document.getElementById('clientNameInput').value.trim();
  const contact = document.getElementById('clientContactInput').value.trim();
  const notes = document.getElementById('clientNotesInput').value.trim();

  if (!name) {
    showToast('Please enter a client name', 'error');
    return;
  }

  if (clientId) {
    state.updateClient(countryId, clientId, name, contact, notes);
    showToast(`Updated client "${name}"`, 'success');
  } else {
    state.addClient(countryId, name, contact, notes);
    showToast(`Added client "${name}"`, 'success');
  }

  Modal.close('clientModal');
  renderApp();
}

// --- 3. Entry Modal ---
function openAddEntryModal(countryId, clientId) {
  const country = state.getCountryById(countryId);
  if (!country) return;
  const client = state.getClientById(countryId, clientId);
  if (!client) return;

  document.getElementById('entryForm').reset();
  document.getElementById('entryCountryIdInput').value = country.id;
  document.getElementById('entryClientIdInput').value = client.id;
  document.getElementById('entryIdInput').value = '';
  document.getElementById('entryModalTitle').textContent = 'Add Lead Popup Link Entry';
  document.getElementById('entryTargetClientName').textContent = client.name;
  document.getElementById('entryTargetCountryName').textContent = `${country.name} ${country.flag}`;
  document.getElementById('entryTimeInput').value = toLocalDatetimeInput();

  Modal.open('entryModal');
}

function openEditEntryModal(countryId, clientId, entryId) {
  const country = state.getCountryById(countryId);
  if (!country) return;
  const client = state.getClientById(countryId, clientId);
  if (!client) return;
  const entry = client.entries.find(e => e.id === entryId);
  if (!entry) return;

  document.getElementById('entryCountryIdInput').value = country.id;
  document.getElementById('entryClientIdInput').value = client.id;
  document.getElementById('entryIdInput').value = entry.id;
  document.getElementById('entryModalTitle').textContent = 'Edit Lead Popup Link Entry';
  document.getElementById('entryTargetClientName').textContent = client.name;
  document.getElementById('entryTargetCountryName').textContent = `${country.name} ${country.flag}`;
  document.getElementById('entryLinkInput').value = entry.link;
  document.getElementById('entryTimeInput').value = toLocalDatetimeInput(entry.insertedAt);
  document.getElementById('entryMobileInput').value = entry.mobile;

  Modal.open('entryModal');
}

function handleEntryFormSubmit(e) {
  e.preventDefault();
  const countryId = document.getElementById('entryCountryIdInput').value;
  const clientId = document.getElementById('entryClientIdInput').value;
  const entryId = document.getElementById('entryIdInput').value;
  const link = document.getElementById('entryLinkInput').value.trim();
  const insertedAt = document.getElementById('entryTimeInput').value;
  const mobile = document.getElementById('entryMobileInput').value.trim();

  if (!link) {
    showToast('Please enter a valid popup URL', 'error');
    return;
  }
  if (!insertedAt) {
    showToast('Please select the time inserted', 'error');
    return;
  }
  if (!mobile) {
    showToast('Please enter at least one mobile number', 'error');
    return;
  }

  // Convert local datetime string to ISO string
  const isoTime = new Date(insertedAt).toISOString();

  if (entryId) {
    state.updateEntry(countryId, clientId, entryId, link, isoTime, mobile);
    showToast('Popup link entry updated', 'success');
  } else {
    state.addEntry(countryId, clientId, link, isoTime, mobile);
    showToast('New popup link entry created', 'success');
  }

  Modal.close('entryModal');
  renderApp();
}

// ==========================================================================
// 7. CSV / JSON Export Utilities
// ==========================================================================

function exportDataAsCSV() {
  const headers = ['Country Name', 'Country Status', 'Client Name', 'Client Contact', 'Popup Link', 'Time Inserted (ISO)', 'Mobile Number(s)'];
  const rows = [];

  state.data.countries.forEach(country => {
    if (!country.clients || country.clients.length === 0) {
      rows.push([
        `"${country.name}"`,
        `"${country.status}"`,
        '""', '""', '""', '""', '""'
      ]);
      return;
    }

    country.clients.forEach(client => {
      if (!client.entries || client.entries.length === 0) {
        rows.push([
          `"${country.name}"`,
          `"${country.status}"`,
          `"${client.name}"`,
          `"${client.contact || ''}"`,
          '""', '""', '""'
        ]);
        return;
      }

      client.entries.forEach(entry => {
        rows.push([
          `"${country.name}"`,
          `"${country.status}"`,
          `"${client.name}"`,
          `"${client.contact || ''}"`,
          `"${entry.link}"`,
          `"${entry.insertedAt}"`,
          `"${entry.mobile}"`
        ]);
      });
    });
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `popupleads_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported campaigns to CSV successfully', 'success');
}

function exportDataAsJSON() {
  const jsonStr = JSON.stringify(state.data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `popupleads_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Exported backup as JSON', 'success');
}

// ==========================================================================
// 8. Event Listeners & Interactions Setup
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

  // Initial render
  renderApp();

  // --- Search Listeners ---
  const globalSearchInput = document.getElementById('globalSearchInput');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderApp();
    });
  }

  // Keyboard shortcut '/' to focus global search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      globalSearchInput.focus();
    }
  });

  const sidebarSearchInput = document.getElementById('sidebarSearchInput');
  const sidebarClearSearchBtn = document.getElementById('sidebarClearSearchBtn');

  if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      sidebarClearSearchBtn.style.display = val ? 'block' : 'none';
      renderSidebar();
    });
  }

  if (sidebarClearSearchBtn) {
    sidebarClearSearchBtn.addEventListener('click', () => {
      sidebarSearchInput.value = '';
      sidebarClearSearchBtn.style.display = 'none';
      renderSidebar();
      sidebarSearchInput.focus();
    });
  }

  // --- Status Filter Pills ---
  const statusFilterGroup = document.getElementById('statusFilterGroup');
  if (statusFilterGroup) {
    statusFilterGroup.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      statusFilterGroup.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.currentStatusFilter = pill.dataset.filter;
      renderApp();
    });
  }

  // --- Sort Select ---
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderMainCountryCards();
    });
  }

  // --- Toggle All Collapse Button ---
  const toggleAllCollapseBtn = document.getElementById('toggleAllCollapseBtn');
  const collapseBtnText = document.getElementById('collapseBtnText');
  let isAllCollapsed = false;

  if (toggleAllCollapseBtn) {
    toggleAllCollapseBtn.addEventListener('click', () => {
      isAllCollapsed = !isAllCollapsed;
      if (isAllCollapsed) {
        state.data.countries.forEach(c => state.collapsedCountryIds.add(c.id));
        collapseBtnText.textContent = 'Expand All';
      } else {
        state.collapsedCountryIds.clear();
        collapseBtnText.textContent = 'Collapse All';
      }
      renderMainCountryCards();
    });
  }

  // --- Mobile Sidebar Open/Close ---
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const sidebar = document.getElementById('sidebar');

  if (menuToggleBtn && sidebar) {
    menuToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('is-mobile-open');
    });
  }

  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener('click', () => {
      sidebar.classList.remove('is-mobile-open');
    });
  }

  // ==========================================================================
  // Google Sheets Viewer Functions & Config
  // ==========================================================================
  // Google Sheets Viewer Functions & Date-Based Tab Config
  // ==========================================================================
  const GOOGLE_SHEETS_CONFIG = {
    1: {
      id: '14BY_Fnfw4f9hmcOGaPqIA6mC0pOkGRTivrimwC4uhmQ',
      title: 'Google Sheet 1 (Leads Data)',
      externalUrl: 'https://docs.google.com/spreadsheets/d/14BY_Fnfw4f9hmcOGaPqIA6mC0pOkGRTivrimwC4uhmQ/edit'
    },
    2: {
      id: '1xMdCTsAcT2vhr4cP32u2oElzDPN2e7UmoeROroLk3Lc',
      title: 'Google Sheet 2 (Campaigns Data)',
      externalUrl: 'https://docs.google.com/spreadsheets/d/1xMdCTsAcT2vhr4cP32u2oElzDPN2e7UmoeROroLk3Lc/edit'
    }
  };

  let currentActiveSheetNum = 1;
  let currentActiveDateType = 'today'; // 'today' or 'yesterday'

  function getTodayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function getYesterdayDateKey() {
    const y = new Date(Date.now() - 86400000);
    return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  }

  function updateDateLabels() {
    const todayEl = document.getElementById('todayDateLabel');
    const yesterdayEl = document.getElementById('yesterdayDateLabel');
    const now = new Date();
    const yest = new Date(Date.now() - 86400000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (todayEl) todayEl.textContent = `${months[now.getMonth()]} ${now.getDate()}`;
    if (yesterdayEl) yesterdayEl.textContent = `${months[yest.getMonth()]} ${yest.getDate()}`;
  }

  function extractGidFromInput(inputStr) {
    if (!inputStr) return '';
    const str = inputStr.trim();
    const match = str.match(/gid=([0-9]+)/i);
    if (match) return match[1];
    if (/^[0-9]+$/.test(str)) return str;
    return '';
  }

  function getSheetPreviewUrl(sheetNum, dateType = 'today') {
    const config = GOOGLE_SHEETS_CONFIG[sheetNum] || GOOGLE_SHEETS_CONFIG[1];
    const dateKey = (dateType === 'today') ? getTodayDateKey() : getYesterdayDateKey();
    const dateSpecificGid = localStorage.getItem(`popupleads_sheet_date_${sheetNum}_${dateKey}`);
    const generalGid = localStorage.getItem(`popupleads_sheet_gid_${sheetNum}`);
    const activeGid = dateSpecificGid || generalGid || '';

    if (activeGid) {
      return `https://docs.google.com/spreadsheets/d/${config.id}/preview#gid=${activeGid}`;
    }
    return `https://docs.google.com/spreadsheets/d/${config.id}/preview`;
  }

  function openSheetView(sheetNum = 1, dateType = 'today') {
    currentActiveSheetNum = sheetNum;
    currentActiveDateType = dateType;
    updateDateLabels();

    const sheetConfig = GOOGLE_SHEETS_CONFIG[sheetNum] || GOOGLE_SHEETS_CONFIG[1];
    const dashboardMain = document.getElementById('dashboardMainContent');
    const sheetView = document.getElementById('sheetEmbedView');
    const iframe = document.getElementById('googleSheetIframe');
    const titleEl = document.getElementById('currentSheetTitle');
    const externalLink = document.getElementById('openExternalSheetBtn');
    const sheetGidInput = document.getElementById('sheetGidInput');
    const viewSheet1Btn = document.getElementById('viewSheet1Btn');
    const viewSheet2Btn = document.getElementById('viewSheet2Btn');
    const sheetTodayBtn = document.getElementById('sheetTodayBtn');
    const sheetYesterdayBtn = document.getElementById('sheetYesterdayBtn');

    if (!dashboardMain || !sheetView || !iframe) return;

    dashboardMain.classList.add('hidden');
    sheetView.classList.remove('hidden');

    if (viewSheet1Btn && viewSheet2Btn) {
      if (sheetNum === 1) {
        viewSheet1Btn.classList.add('active');
        viewSheet2Btn.classList.remove('active');
      } else {
        viewSheet2Btn.classList.add('active');
        viewSheet1Btn.classList.remove('active');
      }
    }

    if (sheetTodayBtn && sheetYesterdayBtn) {
      if (dateType === 'today') {
        sheetTodayBtn.classList.add('active');
        sheetYesterdayBtn.classList.remove('active');
      } else {
        sheetYesterdayBtn.classList.add('active');
        sheetTodayBtn.classList.remove('active');
      }
    }

    const dateKey = (dateType === 'today') ? getTodayDateKey() : getYesterdayDateKey();
    const dateSpecificGid = localStorage.getItem(`popupleads_sheet_date_${sheetNum}_${dateKey}`);
    const generalGid = localStorage.getItem(`popupleads_sheet_gid_${sheetNum}`) || '';
    const activeGid = dateSpecificGid || generalGid;

    if (sheetGidInput) {
      sheetGidInput.value = activeGid;
      sheetGidInput.placeholder = dateType === 'today' ? "Paste Today's tab link or GID" : "Paste Yesterday's tab link or GID";
    }

    if (titleEl) {
      titleEl.textContent = `${sheetConfig.title} — ${dateType === 'today' ? 'Today' : 'Yesterday'}`;
    }
    const previewUrl = getSheetPreviewUrl(sheetNum, dateType);
    iframe.src = previewUrl;
    if (externalLink) {
      externalLink.href = activeGid ? `${sheetConfig.externalUrl}?gid=${activeGid}#gid=${activeGid}` : sheetConfig.externalUrl;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Viewing ${sheetConfig.title} (${dateType === 'today' ? 'Today' : 'Yesterday'})`, 'info');
  }

  function closeSheetView() {
    const dashboardMain = document.getElementById('dashboardMainContent');
    const sheetView = document.getElementById('sheetEmbedView');
    const iframe = document.getElementById('googleSheetIframe');
    const viewSheet1Btn = document.getElementById('viewSheet1Btn');
    const viewSheet2Btn = document.getElementById('viewSheet2Btn');

    if (sheetView) sheetView.classList.add('hidden');
    if (dashboardMain) dashboardMain.classList.remove('hidden');
    if (iframe) iframe.src = '';

    if (viewSheet1Btn) viewSheet1Btn.classList.remove('active');
    if (viewSheet2Btn) viewSheet2Btn.classList.remove('active');
  }

  // Save Latest GID Handler for Date
  const saveSheetGidBtn = document.getElementById('saveSheetGidBtn');
  const sheetGidInput = document.getElementById('sheetGidInput');
  const sheetTodayBtn = document.getElementById('sheetTodayBtn');
  const sheetYesterdayBtn = document.getElementById('sheetYesterdayBtn');

  function handleSaveGid() {
    if (!sheetGidInput) return;
    const val = sheetGidInput.value.trim();
    const extractedGid = extractGidFromInput(val);
    const dateKey = (currentActiveDateType === 'today') ? getTodayDateKey() : getYesterdayDateKey();

    if (extractedGid) {
      localStorage.setItem(`popupleads_sheet_date_${currentActiveSheetNum}_${dateKey}`, extractedGid);
      localStorage.setItem(`popupleads_sheet_gid_${currentActiveSheetNum}`, extractedGid);
      sheetGidInput.value = extractedGid;
      showToast(`Saved GID #${extractedGid} for ${currentActiveDateType === 'today' ? 'Today' : 'Yesterday'} (Sheet ${currentActiveSheetNum})!`, 'success');
      openSheetView(currentActiveSheetNum, currentActiveDateType);
    } else if (!val) {
      localStorage.removeItem(`popupleads_sheet_date_${currentActiveSheetNum}_${dateKey}`);
      showToast(`Cleared tab for ${currentActiveDateType === 'today' ? 'Today' : 'Yesterday'}.`, 'info');
      openSheetView(currentActiveSheetNum, currentActiveDateType);
    } else {
      showToast(`Please enter a valid GID number (e.g. 1948201) or paste the tab URL.`, 'error');
    }
  }

  if (saveSheetGidBtn) saveSheetGidBtn.addEventListener('click', handleSaveGid);
  if (sheetGidInput) {
    sheetGidInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveGid();
      }
    });
  }

  if (sheetTodayBtn) sheetTodayBtn.addEventListener('click', () => openSheetView(currentActiveSheetNum, 'today'));
  if (sheetYesterdayBtn) sheetYesterdayBtn.addEventListener('click', () => openSheetView(currentActiveSheetNum, 'yesterday'));

  // Google Sheets View Triggers
  const viewSheet1Btn = document.getElementById('viewSheet1Btn');
  const viewSheet2Btn = document.getElementById('viewSheet2Btn');
  const returnToDashboardBtn = document.getElementById('returnToDashboardBtn');

  if (viewSheet1Btn) viewSheet1Btn.addEventListener('click', () => openSheetView(1, 'today'));
  if (viewSheet2Btn) viewSheet2Btn.addEventListener('click', () => openSheetView(2, 'today'));
  if (returnToDashboardBtn) returnToDashboardBtn.addEventListener('click', closeSheetView);

  // --- Add Country Buttons ---
  document.getElementById('sidebarAddCountryBtn').addEventListener('click', () => {
    closeSheetView();
    openAddCountryModal();
  });
  document.getElementById('topAddCountryBtn').addEventListener('click', () => {
    closeSheetView();
    openAddCountryModal();
  });
  document.getElementById('emptyStateAddBtn').addEventListener('click', openAddCountryModal);

  // --- Export & Reset Buttons ---
  document.getElementById('exportCsvBtn').addEventListener('click', exportDataAsCSV);
  document.getElementById('sidebarExportJsonBtn').addEventListener('click', exportDataAsJSON);
  document.getElementById('sidebarResetDataBtn').addEventListener('click', () => {
    Modal.confirm({
      title: 'Reset to Sample Data?',
      message: 'This will replace current stored country campaigns with standard initial sample data.',
      targetName: 'All local campaign edits will be reset',
      confirmText: 'Reset Data',
      onConfirm: () => {
        state.resetToSampleData();
      }
    });
  });

  // --- Form Submits ---
  document.getElementById('countryForm').addEventListener('submit', handleCountryFormSubmit);
  document.getElementById('entryForm').addEventListener('submit', handleEntryFormSubmit);

  // --- Quick Flag Picker Chips in Modal ---
  const flagQuickPickers = document.getElementById('flagQuickPickers');
  if (flagQuickPickers) {
    flagQuickPickers.addEventListener('click', (e) => {
      const chip = e.target.closest('.flag-chip');
      if (chip && chip.dataset.flag) {
        document.getElementById('countryFlagInput').value = chip.dataset.flag;
      }
    });
  }

  // --- "Set Current Time" Helper in Entry Modal ---
  document.getElementById('setCurrentTimeBtn').addEventListener('click', () => {
    document.getElementById('entryTimeInput').value = toLocalDatetimeInput();
  });

  // --- Modal Close Triggers ---
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      Modal.close(btn.dataset.closeModal);
    });
  });

  document.getElementById('modalBackdrop').addEventListener('click', () => {
    Modal.close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Modal.close();
    }
  });

  // ==========================================================================
  // 9. Delegated Action Listeners (Cards, Rows, Chips, Sidebar)
  // ==========================================================================

  document.addEventListener('click', (e) => {
    // 1. Copy link button
    const copyBtn = e.target.closest('[data-copy-link]');
    if (copyBtn) {
      const link = copyBtn.dataset.copyLink;
      copyToClipboard(link, 'Popup link copied to clipboard!');
      return;
    }

    // 2. Chip quick toggle (Active <-> Paused)
    const chipToggle = e.target.closest('[data-toggle-country]');
    if (chipToggle) {
      e.stopPropagation();
      const countryId = chipToggle.dataset.toggleCountry;
      const updated = state.toggleCountryStatus(countryId);
      if (updated) {
        showToast(`${updated.name} campaign is now ${updated.status}`, 'info');
        renderApp();
      }
      return;
    }

    // 3. Chip click -> scroll to card
    const chip = e.target.closest('.country-chip');
    if (chip && chip.dataset.countryId) {
      const card = document.getElementById(`country-card-${chip.dataset.countryId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = 'none', 1600);
      }
      return;
    }

    // 4. Toggle Card Collapse
    const collapseBtn = e.target.closest('[data-toggle-collapse]');
    if (collapseBtn) {
      const countryId = collapseBtn.dataset.toggleCollapse;
      if (state.collapsedCountryIds.has(countryId)) {
        state.collapsedCountryIds.delete(countryId);
      } else {
        state.collapsedCountryIds.add(countryId);
      }
      renderMainCountryCards();
      return;
    }

    // 5. Edit Country & Client trigger
    const editCountryBtn = e.target.closest('[data-edit-country]');
    if (editCountryBtn) {
      openEditCountryModal(editCountryBtn.dataset.editCountry);
      return;
    }

    // 6. Delete Country trigger
    const deleteCountryBtn = e.target.closest('[data-delete-country]');
    if (deleteCountryBtn) {
      const countryId = deleteCountryBtn.dataset.deleteCountry;
      const country = state.getCountryById(countryId);
      if (!country) return;

      Modal.confirm({
        title: 'Delete Country Campaign?',
        message: `Are you sure you want to permanently delete "${country.name}" along with all of its clients and popup links?`,
        targetName: `${country.flag} ${country.name} (${country.clients ? country.clients.length : 0} clients)`,
        confirmText: 'Delete Country',
        onConfirm: () => {
          state.deleteCountry(countryId);
          showToast(`Deleted country "${country.name}"`, 'error');
          renderApp();
        }
      });
      return;
    }

    // 7. Edit Client trigger -> opens unified Country & Client modal
    const editClientBtn = e.target.closest('[data-edit-client]');
    if (editClientBtn) {
      openEditCountryModal(editClientBtn.dataset.editClient);
      return;
    }

    // 9. Delete Client trigger
    const deleteClientBtn = e.target.closest('[data-delete-client]');
    if (deleteClientBtn) {
      const countryId = deleteClientBtn.dataset.deleteClient;
      const clientId = deleteClientBtn.dataset.clientId;
      const client = state.getClientById(countryId, clientId);
      if (!client) return;

      Modal.confirm({
        title: 'Delete Client Account?',
        message: `Are you sure you want to delete client "${client.name}" and all associated lead link entries?`,
        targetName: `Client: ${client.name} (${(client.entries || []).length} popup links)`,
        confirmText: 'Delete Client',
        onConfirm: () => {
          state.deleteClient(countryId, clientId);
          showToast(`Deleted client "${client.name}"`, 'error');
          renderApp();
        }
      });
      return;
    }

    // 10. Add Link Entry trigger
    const addEntryBtn = e.target.closest('[data-add-entry]');
    if (addEntryBtn) {
      openAddEntryModal(addEntryBtn.dataset.addEntry, addEntryBtn.dataset.clientId);
      return;
    }

    // 11. Edit Link Entry trigger
    const editEntryBtn = e.target.closest('[data-edit-entry]');
    if (editEntryBtn) {
      openEditEntryModal(editEntryBtn.dataset.editEntry, editEntryBtn.dataset.clientId, editEntryBtn.dataset.entryId);
      return;
    }

    // 12. Delete Link Entry trigger
    const deleteEntryBtn = e.target.closest('[data-delete-entry]');
    if (deleteEntryBtn) {
      const countryId = deleteEntryBtn.dataset.deleteEntry;
      const clientId = deleteEntryBtn.dataset.clientId;
      const entryId = deleteEntryBtn.dataset.entryId;
      const client = state.getClientById(countryId, clientId);
      const entry = (client?.entries || []).find(e => e.id === entryId);

      Modal.confirm({
        title: 'Delete Lead Link Entry?',
        message: 'Are you sure you want to delete this popup link entry?',
        targetName: `Link: ${entry ? entry.link : 'Selected entry'}`,
        confirmText: 'Delete Entry',
        onConfirm: () => {
          state.deleteEntry(countryId, clientId, entryId);
          showToast('Deleted link entry', 'error');
          renderApp();
        }
      });
      return;
    }

    // 13. Sidebar country focus click -> scroll to card
    const sidebarFocusHead = e.target.closest('[data-focus-country]');
    if (sidebarFocusHead && !e.target.closest('.sidebar-country-actions') && !e.target.closest('[data-sidebar-toggle]')) {
      const countryId = sidebarFocusHead.dataset.focusCountry;
      state.activeCountryFocusId = countryId;
      const card = document.getElementById(`country-card-${countryId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = 'none', 1600);
      }
      renderSidebar();
      return;
    }

    // 14. Sidebar client focus click
    const sidebarClientItem = e.target.closest('[data-focus-client]');
    if (sidebarClientItem) {
      const clientId = sidebarClientItem.dataset.focusClient;
      const clientEl = document.getElementById(`client-${clientId}`);
      if (clientEl) {
        clientEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clientEl.style.outline = '2px solid var(--indigo)';
        setTimeout(() => clientEl.style.outline = 'none', 1600);
      }
      return;
    }
  });

  // --- Change Listener for Status Toggles (Sidebar & Card) ---
  document.addEventListener('change', (e) => {
    // Sidebar toggle change
    const sidebarToggle = e.target.closest('[data-sidebar-toggle]');
    if (sidebarToggle) {
      const countryId = sidebarToggle.dataset.sidebarToggle;
      const updated = state.toggleCountryStatus(countryId);
      if (updated) {
        showToast(`${updated.name} is now ${updated.status}`, 'info');
        renderApp();
      }
      return;
    }

    // Card toggle change
    const cardToggle = e.target.closest('[data-card-toggle]');
    if (cardToggle) {
      const countryId = cardToggle.dataset.cardToggle;
      const updated = state.toggleCountryStatus(countryId);
      if (updated) {
        showToast(`${updated.name} is now ${updated.status}`, 'info');
        renderApp();
      }
      return;
    }
  });

});
