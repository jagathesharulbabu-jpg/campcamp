/**
 * PopupLeads Hub - Django API Driven Client Logic
 * Handles Country Campaigns, Leads, Google Sheets Viewers,
 * and Cloud Infrastructure Accounts (DigitalOcean & Azure).
 */

// 1. CSRF Token Helper for Django
function getCsrfToken() {
  const input = document.getElementById('csrfToken');
  if (input && input.value) return input.value;
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

// 2. Global Application State
const state = {
  countries: [],
  cloudAccounts: [],
  currentStatusFilter: 'all',
  searchQuery: '',
  sortBy: 'name-asc',
  activeView: 'campaigns', // 'campaigns' | 'digitalocean' | 'azure'
  cloudFilters: {
    DIGITALOCEAN: 'ALL',
    AZURE: 'ALL'
  },
  collapsedCountryIds: new Set(),
  trackedGeos: JSON.parse(localStorage.getItem('tracked_geos') || 'null'),
  removedGeos: new Set(JSON.parse(localStorage.getItem('removed_geos') || '[]')),
  geoList: [],
  isLoadingCalls: false,
  allGeosData: {},
  availableGeos: [],
  lastTabs: null,
  allTabs: null,
  tabMode: 'auto',
  todayTab: '25-nov-26',
  activeTabName: '25-nov-26',
  recentTabs: [],
  sheet1TabOverride: '',
  sheet2TabOverride: '',
  availableColumns: [],
  columnCallCounts: {},
  clientMappings: {},
  isLocked: true,
  showOfflineCountries: false,

  // Revocalls Incoming Webhook Live State
  revocallsCalls: [],
  revocallsStats: {
    total_today: 0,
    answered_today: 0,
    missed_today: 0,
    total_duration_today_formatted: '0s',
    total_all_time: 0
  },
  revocallsWebhookUrl: '',
  revocallsFilter: 'ALL',
  revocallsSearch: '',

  async fetchAll() {
    try {
      const [countriesRes, cloudRes] = await Promise.all([
        fetch('/api/v1/countries/'),
        fetch('/api/v1/cloud-accounts/')
      ]);

      if (countriesRes.ok) {
        this.countries = await countriesRes.json();
      }
      if (cloudRes.ok) {
        this.cloudAccounts = await cloudRes.json();
      }

      // 1. Instantly render the full dashboard with all countries, cards, and chips!
      renderApp();

      // 2. Load Google Sheets live call numbers asynchronously in background (does not block UI)
      this.fetchGeoCalls(false);
      this.fetchSheetSettings();
      // 3. Load Revocalls real-time incoming calls and badge count
      this.fetchRevocallsCalls(false);
    } catch (e) {
      console.error('API Fetch error:', e);
      showToast('Network error loading data', 'error');
    }
  },

  async fetchRevocallsCalls(forceRender = false) {
    try {
      let url = `/api/v1/revocalls/calls/?status=${encodeURIComponent(this.revocallsFilter)}`;
      if (this.revocallsSearch.trim()) {
        url += `&search=${encodeURIComponent(this.revocallsSearch.trim())}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        this.revocallsCalls = data.calls || [];
        if (data.stats) this.revocallsStats = data.stats;
        if (data.webhook_url) this.revocallsWebhookUrl = data.webhook_url;

        // Update sidebar badge
        const badge = document.getElementById('sidebarRevocallsBadge');
        if (badge) {
          badge.textContent = `${this.revocallsStats.total_today || 0} Calls`;
        }

        if (this.activeView === 'revocalls' || forceRender) {
          renderRevocallsSection();
        }
        return data;
      }
    } catch (e) {
      console.error('Revocalls fetch error:', e);
    }
    return null;
  },

  async fetchGeoCalls(force = false) {
    try {
      const res = await fetch(`/api/v1/geo-calls/${force ? '?force=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        this.isLoadingCalls = false;
        this.geoList = data.geos || [];
        this.allGeosData = data.all_geos_data || {};
        this.availableGeos = data.available_geos || [];
        if (data.last_tabs) this.lastTabs = data.last_tabs;
        if (data.active_tab_name) this.activeTabName = data.active_tab_name;
        if (data.today_tab) this.todayTab = data.today_tab;
        if (data.recent_tabs) this.recentTabs = data.recent_tabs;
        if (data.tab_mode) this.tabMode = data.tab_mode;
        if (data.available_columns) this.availableColumns = data.available_columns;
        if (data.column_call_counts) this.columnCallCounts = data.column_call_counts;
        if (data.client_mappings) this.clientMappings = data.client_mappings;
        if (data.is_locked !== undefined) this.isLocked = data.is_locked;

        updatePulseTabDisplay();
        renderGeoCards();
        animateCallsOneByOne();
        renderAvailableGeosPicker();
        if (this.activeView === 'settings') renderSettingsView();
        return data;
      }
    } catch (e) {
      console.error('Geo calls fetch error:', e);
    }
    return null;
  },

  async fetchSheetSettings() {
    try {
      const res = await fetch('/api/v1/sheet-settings/');
      if (res.ok) {
        const data = await res.json();
        if (data.tab_mode) this.tabMode = data.tab_mode;
        if (data.active_tab_name) this.activeTabName = data.active_tab_name;
        if (data.today_tab) this.todayTab = data.today_tab;
        if (data.recent_tabs) this.recentTabs = data.recent_tabs;
        if (data.sheet1_tab_override !== undefined) this.sheet1TabOverride = data.sheet1_tab_override;
        if (data.sheet2_tab_override !== undefined) this.sheet2TabOverride = data.sheet2_tab_override;
        if (data.available_columns) this.availableColumns = data.available_columns;
        if (data.column_call_counts) this.columnCallCounts = data.column_call_counts;
        if (data.client_mappings) this.clientMappings = data.client_mappings;
        if (data.is_locked !== undefined) this.isLocked = data.is_locked;

        updatePulseTabDisplay();
        if (this.activeView === 'settings') renderSettingsView();
        return data;
      }
    } catch (e) {
      console.error('Error fetching sheet settings:', e);
    }
    return null;
  },

  async saveSheetSettings(payload) {
    try {
      const res = await fetch('/api/v1/sheet-settings/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Settings saved successfully!', 'success');
        await this.fetchAll();
        return true;
      }
    } catch (e) {
      showToast('Error saving sheet settings', 'error');
    }
    return false;
  },

  async autoMapSheetColumns() {
    try {
      const res = await fetch('/api/v1/sheet-settings/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'auto_map' })
      });
      if (res.ok) {
        const data = await res.json();
        this.countryMappings = data.country_mappings || {};
        showToast('Auto-mapped sheet columns to countries by prefix!', 'success');
        await this.fetchGeoCalls(true);
        await this.fetchSheetSettings();
        return true;
      }
    } catch (e) {
      showToast('Error auto-mapping columns', 'error');
    }
    return false;
  },

  async fetchCloudAccounts() {
    try {
      const res = await fetch('/api/v1/cloud-accounts/');
      if (res.ok) {
        this.cloudAccounts = await res.json();
        renderCloudSection('DIGITALOCEAN');
        renderCloudSection('AZURE');
      }
    } catch (e) {
      console.error('Cloud API fetch error:', e);
    }
  },

  async toggleCountryStatus(countryId) {
    try {
      const res = await fetch(`/api/v1/countries/${countryId}/toggle_status/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`${data.name} is now ${data.status}`, 'info');
        await this.fetchAll();
      }
    } catch (e) {
      showToast('Error toggling campaign status', 'error');
    }
  },

  async deleteCountry(countryId) {
    try {
      const res = await fetch(`/api/v1/countries/${countryId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': getCsrfToken() }
      });
      if (res.ok) {
        showToast('Country campaign deleted', 'error');
        await this.fetchAll();
      }
    } catch (e) {
      showToast('Error deleting country', 'error');
    }
  },

  async saveCountry(countryData) {
    try {
      const url = countryData.id ? `/api/v1/countries/${countryData.id}/` : '/api/v1/countries/';
      const method = countryData.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: countryData.name,
          flag_emoji: countryData.flag,
          status: countryData.status
        })
      });

      if (res.ok) {
        const country = await res.json();
        if (countryData.clientName) {
          await fetch('/api/v1/clients/', {
            method: 'POST',
            headers: {
              'X-CSRFToken': getCsrfToken(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              country: country.id,
              name: countryData.clientName,
              contact: countryData.clientContact,
              notes: countryData.clientNotes
            })
          });
        }
        showToast('Country campaign saved successfully', 'success');
        await this.fetchAll();
        return true;
      }
    } catch (e) {
      showToast('Error saving country', 'error');
    }
    return false;
  },

  async saveLinkEntry(entryData) {
    try {
      let insertedIso = new Date().toISOString();
      if (entryData.insertedAt) {
        const parsed = new Date(entryData.insertedAt);
        if (!isNaN(parsed.getTime())) {
          insertedIso = parsed.toISOString();
        }
      }

      const payload = {
        client: entryData.clientId,
        url: entryData.link,
        inserted_at: insertedIso
      };
      if (entryData.mobile) payload.mobile_numbers = entryData.mobile;

      const res = await fetch('/api/v1/links/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Popup link entry saved successfully', 'success');
        await this.fetchAll();
        return true;
      }
    } catch (e) {
      showToast('Error saving popup link', 'error');
    }
    return false;
  },

  async updateClientMobile(clientId, mobileNumber) {
    try {
      const res = await fetch(`/api/v1/clients/${clientId}/`, {
        method: 'PATCH',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mobile_number: mobileNumber })
      });
      if (res.ok) {
        showToast(`Mobile number updated to ${mobileNumber}`, 'success');
        await this.fetchAll();
        return true;
      }
    } catch (e) {
      showToast('Error updating mobile number', 'error');
    }
    return false;
  },

  async deleteLinkEntry(linkId) {
    try {
      const res = await fetch(`/api/v1/links/${linkId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': getCsrfToken() }
      });
      if (res.ok) {
        showToast('Popup link deleted', 'error');
        await this.fetchAll();
      }
    } catch (e) {
      showToast('Error deleting link', 'error');
    }
  },

  async saveCloudAccount(accountData) {
    try {
      const url = accountData.id ? `/api/v1/cloud-accounts/${accountData.id}/` : '/api/v1/cloud-accounts/';
      const method = accountData.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method: method,
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(accountData)
      });

      if (res.ok) {
        showToast(`${accountData.provider} account saved successfully`, 'success');
        await this.fetchCloudAccounts();
        return true;
      } else {
        const err = await res.json();
        showToast(`Failed to save: ${JSON.stringify(err)}`, 'error');
      }
    } catch (e) {
      showToast('Network error saving cloud account', 'error');
    }
    return false;
  },

  async deleteCloudAccount(accountId) {
    try {
      const res = await fetch(`/api/v1/cloud-accounts/${accountId}/`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': getCsrfToken() }
      });
      if (res.ok) {
        showToast('Cloud account deleted', 'info');
        await this.fetchCloudAccounts();
      }
    } catch (e) {
      showToast('Error deleting cloud account', 'error');
    }
  },

  async changeCloudStatus(accountId, newStatus) {
    try {
      const res = await fetch(`/api/v1/cloud-accounts/${accountId}/change_status/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Account status updated to ${newStatus}`, 'success');
        await this.fetchCloudAccounts();
      }
    } catch (e) {
      showToast('Error changing account status', 'error');
    }
  },

  getFilteredCountries() {
    let result = [...this.countries];
    if (this.currentStatusFilter === 'active') {
      result = result.filter(c => (c.status || '').toUpperCase() === 'ACTIVE');
    } else if (this.currentStatusFilter === 'paused') {
      result = result.filter(c => (c.status || '').toUpperCase() === 'PAUSED');
    }

    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(country => {
        if (country.name.toLowerCase().includes(q)) return true;
        return (country.clients || []).some(client => {
          if (client.name.toLowerCase().includes(q)) return true;
          if (client.contact && client.contact.toLowerCase().includes(q)) return true;
          return (client.links || []).some(link => {
            if (link.url && link.url.toLowerCase().includes(q)) return true;
            if (link.mobile_numbers && link.mobile_numbers.toLowerCase().includes(q)) return true;
            return false;
          });
        });
      });
    }

    // Sort by Status FIRST: ACTIVE (0) at top, then PAUSED (1) below
    result.sort((a, b) => {
      const aActive = (a.status || '').toUpperCase() === 'ACTIVE' ? 0 : 1;
      const bActive = (b.status || '').toUpperCase() === 'ACTIVE' ? 0 : 1;

      // Active countries are always placed on top of paused countries
      if (aActive !== bActive) {
        return aActive - bActive;
      }

      // Within the same status group, respect selected sort
      if (this.sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (this.sortBy === 'clients-desc') {
        return (b.clients?.length || 0) - (a.clients?.length || 0);
      }
      if (this.sortBy === 'links-desc') {
        const aLinks = (a.clients || []).reduce((acc, c) => acc + (c.links?.length || 0), 0);
        const bLinks = (b.clients || []).reduce((acc, c) => acc + (c.links?.length || 0), 0);
        return bLinks - aLinks;
      }
      return a.name.localeCompare(b.name);
    });
    return result;
  },

  getFilteredCloudAccounts(provider) {
    let accounts = this.cloudAccounts.filter(a => (a.provider || '').toUpperCase() === provider.toUpperCase());
    const filter = this.cloudFilters[provider] || 'ALL';
    if (filter !== 'ALL') {
      accounts = accounts.filter(a => (a.status || '').toUpperCase() === filter.toUpperCase());
    }
    return accounts;
  }
};

// 3. Utilities
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'Not set';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Formats full Date + Time when link was uploaded/changed (e.g. Nov 24, 2026, 14:35)
 */
function formatDateTimeDisplay(dateStr) {
  if (!dateStr) return 'Not set';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dateFormatted}, ${timeFormatted}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Returns YYYY-MM-DDTHH:mm string in browser's local timezone for datetime-local inputs
 */
function getLocalDateTimeInputValue(date = new Date()) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats time when a country was turned active/paused
 */
function formatActiveSince(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const diffMins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (diffMins < 1) return `Just now (${timeStr})`;
    if (diffMins < 60) return `${diffMins}m ago (${timeStr})`;
    if (isToday) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `Today ${timeStr} (${hours}h ${mins}m ago)`;
    }
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const hours = Math.floor(diffMins / 60);
    return `${dateFormatted}, ${timeStr} (${hours}h ago)`;
  } catch (e) {
    return 'Recently';
  }
}

function copyToClipboard(text, label = 'Copied') {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied to clipboard: ${text}`, 'success');
  }).catch(() => {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(`Copied: ${text}`, 'success');
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<div class="toast-left"><span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span></div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 4. Modal Controller
const Modal = {
  backdrop: document.getElementById('modalBackdrop'),
  open(id) {
    this.backdrop?.classList.add('is-open');
    document.getElementById(id)?.classList.add('is-open');
  },
  close(id) {
    if (id) document.getElementById(id)?.classList.remove('is-open');
    else document.querySelectorAll('.modal.is-open').forEach(m => m.classList.remove('is-open'));
    this.backdrop?.classList.remove('is-open');
  },
  confirm({ title, message, targetName, onConfirm }) {
    const tEl = document.getElementById('confirmModalTitle');
    const mEl = document.getElementById('confirmModalMessage');
    const trEl = document.getElementById('confirmModalTargetName');
    if (tEl) tEl.textContent = title || 'Confirm Action';
    if (mEl) mEl.textContent = message || '';
    if (trEl) trEl.textContent = targetName || '';
    const btn = document.getElementById('confirmModalActionBtn');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        Modal.close('confirmModal');
        if (onConfirm) onConfirm();
      });
    }
    Modal.open('confirmModal');
  }
};

// 5. View Switcher
function switchView(viewName) {
  state.activeView = viewName;

  // Sidebar navigation active states
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // View sections
  const campSec = document.getElementById('viewCampaignsSection');
  const doSec = document.getElementById('viewDigitalOceanSection');
  const azureSec = document.getElementById('viewAzureSection');
  const revoSec = document.getElementById('viewRevocallsSection');
  const settingsSec = document.getElementById('viewSettingsSection');
  const sheetSec = document.getElementById('sheetEmbedView');

  if (campSec) campSec.classList.toggle('hidden', viewName !== 'campaigns');
  if (doSec) doSec.classList.toggle('hidden', viewName !== 'digitalocean');
  if (azureSec) azureSec.classList.toggle('hidden', viewName !== 'azure');
  if (revoSec) revoSec.classList.toggle('hidden', viewName !== 'revocalls');
  if (settingsSec) settingsSec.classList.toggle('hidden', viewName !== 'settings');
  if (sheetSec) sheetSec.classList.add('hidden');

  // Breadcrumb updates
  const label = document.getElementById('activeViewLabel');
  if (label) {
    if (viewName === 'campaigns') label.textContent = 'All Country Campaigns & Leads';
    else if (viewName === 'digitalocean') label.textContent = 'DigitalOcean Infrastructure & Domains';
    else if (viewName === 'azure') label.textContent = 'Microsoft Azure Cloud & Domains';
    else if (viewName === 'revocalls') label.textContent = 'Revocalls Real-Time Inbound Calls & Webhook Stream';
    else if (viewName === 'settings') label.textContent = 'Sheet Sync & Country Field Mapping Settings';
  }

  // Render view data
  if (viewName === 'digitalocean') renderCloudSection('DIGITALOCEAN');
  if (viewName === 'azure') renderCloudSection('AZURE');
  if (viewName === 'revocalls') {
    state.fetchRevocallsCalls(true);
  }
  if (viewName === 'settings') renderSettingsView();
}

// 6. Render Functions

function renderLiveStatusRows() {
  const runningContainer = document.getElementById('runningCountriesChips');
  const pausedContainer = document.getElementById('pausedCountriesChips');
  if (!runningContainer || !pausedContainer) return;

  const running = state.countries.filter(c => (c.status || '').toUpperCase() === 'ACTIVE');
  const paused = state.countries.filter(c => (c.status || '').toUpperCase() === 'PAUSED');

  const runCount = document.getElementById('runningCountriesCount');
  const pauseCount = document.getElementById('pausedCountriesCount');
  if (runCount) runCount.textContent = `${running.length} ACTIVE`;
  if (pauseCount) pauseCount.textContent = `${paused.length} PAUSED`;

  const getChipDisplayName = (c) => {
    const clients = c.clients || [];
    const clientName = clients.length > 0 ? (clients[0].name || '').trim() : '';
    if (clientName && !c.name.toLowerCase().includes(clientName.toLowerCase())) {
      return `${c.name} — ${clientName}`;
    }
    return c.name;
  };

  runningContainer.innerHTML = running.map(c => `
    <div class="country-chip chip-active" data-country-id="${c.id}">
      <span class="chip-flag">${c.flag_emoji || '🌍'}</span>
      <div class="chip-info">
        <span class="chip-name">${escapeHtml(getChipDisplayName(c))}</span>
        <span class="chip-time-active">Turned ON: <strong>${formatActiveSince(c.updated_at || c.created_at)}</strong></span>
      </div>
      <button class="chip-quick-toggle" data-toggle-country="${c.id}">Pause</button>
    </div>
  `).join('') || '<span class="status-chips-empty">No active campaigns.</span>';

  pausedContainer.innerHTML = paused.map(c => `
    <div class="country-chip chip-paused" data-country-id="${c.id}">
      <span class="chip-flag">${c.flag_emoji || '🌍'}</span>
      <div class="chip-info">
        <span class="chip-name">${escapeHtml(getChipDisplayName(c))}</span>
        <span class="chip-time-paused">Paused: <strong>${formatActiveSince(c.updated_at || c.created_at)}</strong></span>
      </div>
      <button class="chip-quick-toggle" data-toggle-country="${c.id}">Resume</button>
    </div>
  `).join('') || '<span class="status-chips-empty">No paused campaigns.</span>';
}

function renderCountryCard(country, idx) {
  const isActive = (country.status || '').toUpperCase() === 'ACTIVE';
  const clients = country.clients || [];
  const primaryClient = clients[0] || {};
  const primaryClientId = country.primary_client_id || primaryClient.id || '';

  // Active Mobile Number
  const mobileNumber = country.active_mobile_number || primaryClient.mobile_number || '';

  // Calculate Latest Link Update Time in user's local timezone (e.g. 13:21)
  let newestDate = null;
  clients.forEach(c => {
    (c.links || []).forEach(l => {
      const d = new Date(l.inserted_at || l.created_at);
      if (!isNaN(d.getTime()) && (!newestDate || d > newestDate)) {
        newestDate = d;
      }
    });
  });

  let latestUpdateTimeStr = 'No links yet';
  if (newestDate) {
    const diffMins = Math.max(0, Math.floor((Date.now() - newestDate.getTime()) / 60000));
    const timeStr = newestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (diffMins < 1) latestUpdateTimeStr = `Just now (${timeStr})`;
    else if (diffMins < 60) latestUpdateTimeStr = `${diffMins}m ago (${timeStr})`;
    else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      latestUpdateTimeStr = `${hours}h ${mins}m ago (${timeStr})`;
    } else {
      latestUpdateTimeStr = newestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` (${timeStr})`;
    }
  } else if (country.latest_update_relative) {
    latestUpdateTimeStr = country.latest_update_relative;
  }

  return `
    <article class="country-card ${idx % 2 === 0 ? 'card-alt-blue' : 'card-alt-emerald'} ${isActive ? '' : 'is-paused'}" id="country-card-${country.id}">
      <header class="country-card-header">
        <div class="country-identity">
          <span class="country-big-flag">${country.flag_emoji || '🌍'}</span>
          <div class="country-meta">
            <h3>
              <span>${escapeHtml(country.name)}</span>
              ${primaryClient.name && !country.name.toLowerCase().includes(primaryClient.name.toLowerCase()) ? `
                <span class="text-blue-600 font-semibold text-base">— ${escapeHtml(primaryClient.name)}</span>
              ` : ''}
              <span class="country-status-pill ${isActive ? 'status-active' : 'status-paused'}">
                ${isActive ? '• ACTIVE' : '• PAUSED'}
              </span>
              <button type="button" class="btn-edit-country-chip" data-edit-country="${country.id}" title="Edit Country Name & Settings">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Edit</span>
              </button>
            </h3>
            <div class="country-stats-inline">
              <span><strong>${clients.length}</strong> Clients</span>
              ${country.mapped_field ? `
                <span class="field-mapped-tag" title="Mapped Google Sheet column">
                  📊 Field: <strong>${escapeHtml(country.mapped_field)}</strong> (${country.calls_count || 0} calls)
                </span>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Live Time of Latest Link Updated & Editable Mobile Number -->
        <div class="country-header-live-info">
          <div class="header-live-time" title="Latest link updated at">
            <span>🕒</span>
            <span class="text-slate-400 font-normal">Updated:</span>
            <strong>${escapeHtml(latestUpdateTimeStr)}</strong>
          </div>

          <div class="header-live-mobile" title="Active contact mobile number for calls in ${escapeHtml(country.name)}">
            <span>📞</span>
            <span class="mobile-number-val" id="card-mobile-val-${country.id}">
              ${escapeHtml(mobileNumber || 'No mobile set')}
            </span>
            <button type="button" class="btn-edit-mobile" data-edit-mobile="${primaryClientId}" data-country-id="${country.id}" data-country-name="${escapeHtml(country.name)}" data-current-mobile="${escapeHtml(mobileNumber)}" title="Edit mobile number">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
          </div>
        </div>

        <div class="country-header-actions">
          <button class="btn-icon text-blue-600 hover:bg-blue-50" data-edit-country="${country.id}" title="Edit Country Campaign & Details">
            ✏️
          </button>
          <button class="btn-icon" data-toggle-country="${country.id}" title="Toggle Active / Paused">
            ${isActive ? '⏸️' : '▶️'}
          </button>
          <button class="btn-icon danger" data-delete-country="${country.id}" title="Delete Country">
            🗑️
          </button>
        </div>
      </header>

      <div class="country-card-body">
        ${clients.map(client => {
          const allLinks = (client.links || []).slice().sort((a, b) => {
            const da = new Date(a.inserted_at || a.created_at);
            const db = new Date(b.inserted_at || b.created_at);
            return db - da; // newest first
          });

          const latestLink = allLinks[0] || null;
          const previousLinks = allLinks.slice(1);

          return `
            <div class="client-block">
              <div class="client-block-header">
                
                <button class="btn btn-primary btn-sm" data-add-entry="${country.id}" data-client-id="${client.id}">
                  + Add Link Entry
                </button>
              </div>

              <div class="links-display-container">
                ${latestLink ? `
                  <!-- Latest Active Link Featured Card -->
                  <div class="latest-link-card">
                    <div class="latest-link-left">
                      <span class="latest-link-badge">
                        <span>🚀</span>
                        <span>Latest</span>
                      </span>
                      <a href="${escapeHtml(latestLink.url)}" target="_blank" rel="noopener noreferrer" class="latest-link-url" title="${escapeHtml(latestLink.url)}">
                        ${escapeHtml(latestLink.url)}
                      </a>
                    </div>
                    <div class="latest-link-right">
                      <span class="latest-link-time" title="Uploaded at ${formatDateTimeDisplay(latestLink.inserted_at || latestLink.created_at)}">
                        🕒 ${formatDateTimeDisplay(latestLink.inserted_at || latestLink.created_at)}
                      </span>
                      <button type="button" class="btn-icon-subtle" data-copy-text="${escapeHtml(latestLink.url)}" title="Copy Link URL">
                        📋
                      </button>
                      <button class="btn-icon-subtle danger" data-delete-link="${latestLink.id}" title="Delete Link">
                        ✕
                      </button>
                    </div>
                  </div>

                  ${previousLinks.length > 0 ? `
                    <!-- Collapsible Button for Previous Links -->
                    <button type="button" class="btn-toggle-links" data-toggle-links-client="${client.id}" data-total-links="${previousLinks.length}">
                      <span>▼ Previous Links (${previousLinks.length} earlier)</span>
                    </button>

                    <!-- Previous Links History Panel (Hidden by default) -->
                    <div class="previous-links-panel hidden" id="previous-links-panel-${client.id}">
                      ${previousLinks.map(link => `
                        <div class="previous-link-row">
                          <div class="flex items-center gap-2 min-w-0 flex-1">
                            <span class="text-xs text-slate-400">🔗</span>
                            <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-url-text truncate text-xs" title="${escapeHtml(link.url)}">
                              ${escapeHtml(link.url)}
                            </a>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <span class="text-[11px] text-slate-500 font-mono font-medium" title="Uploaded at ${formatDateTimeDisplay(link.inserted_at || link.created_at)}">
                              🕒 ${formatDateTimeDisplay(link.inserted_at || link.created_at)}
                            </span>
                            <button type="button" class="btn-icon-subtle" data-copy-text="${escapeHtml(link.url)}" title="Copy Link URL">
                              📋
                            </button>
                            <button class="btn-icon-subtle danger" data-delete-link="${link.id}" title="Delete Link">
                              ✕
                            </button>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                ` : `
                  <div class="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No popup lead links yet. Click "+ Add Link Entry" above.
                  </div>
                `}
              </div>
            </div>
          `;
        }).join('') || `
          <div class="p-3 text-center text-xs text-slate-400">
            No clients assigned yet.
          </div>
        `}
      </div>
    </article>
  `;
}

function renderMainCards() {
  const container = document.getElementById('countryCardsContainer');
  if (!container) return;
  const filtered = state.getFilteredCountries();

  const emptyView = document.getElementById('emptyStateView');
  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyView?.classList.remove('hidden');
    return;
  }
  emptyView?.classList.add('hidden');

  // Split active and paused countries
  const activeCountries = filtered.filter(c => (c.status || '').toUpperCase() === 'ACTIVE');
  const pausedCountries = filtered.filter(c => (c.status || '').toUpperCase() === 'PAUSED');

  // If user searched, auto-expand offline countries to show matches
  if (state.searchQuery.trim() !== '' && pausedCountries.length > 0) {
    state.showOfflineCountries = true;
  }

  // If user filtered specifically by Active
  if (state.currentStatusFilter === 'active') {
    container.innerHTML = activeCountries.length > 0
      ? activeCountries.map((c, i) => renderCountryCard(c, i)).join('')
      : '<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">No active country campaigns currently running.</div>';
    return;
  }

  // If user filtered specifically by Paused
  if (state.currentStatusFilter === 'paused') {
    container.innerHTML = pausedCountries.length > 0
      ? pausedCountries.map((c, i) => renderCountryCard(c, i)).join('')
      : '<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">No offline or paused country campaigns.</div>';
    return;
  }

  // Default view ('all'): Active countries at the top, Offline/Paused countries in a dropdown at the bottom
  const activeCardsHtml = activeCountries.length > 0 
    ? activeCountries.map((c, i) => renderCountryCard(c, i)).join('')
    : '<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl font-medium">✨ All country campaigns are currently offline/paused, or none are active. Click the Offline Countries dropdown below to view them.</div>';

  let offlineHtml = '';
  if (pausedCountries.length > 0) {
    offlineHtml = `
      <div class="offline-countries-section">
        <button type="button" class="btn-offline-dropdown ${state.showOfflineCountries ? 'is-open' : ''}" id="toggleOfflineCountriesBtn" title="Click to view/hide offline countries">
          <div class="flex items-center gap-2.5">
            <span class="offline-caret">${state.showOfflineCountries ? '▲' : '▼'}</span>
            <span class="offline-title">⏸️ Offline / Paused Countries</span>
            <span class="offline-pill-count">${pausedCountries.length} Offline</span>
          </div>
          <span class="offline-hint">${state.showOfflineCountries ? 'Click to hide offline countries' : 'Click to view offline countries'}</span>
        </button>
        <div class="offline-countries-list ${state.showOfflineCountries ? '' : 'hidden'}" id="offlineCountriesList">
          ${pausedCountries.map((c, i) => renderCountryCard(c, i + activeCountries.length)).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = activeCardsHtml + offlineHtml;
}

/**
 * Render Cloud Infrastructure Section (DigitalOcean or Azure)
 */
function renderCloudSection(provider) {
  const isDO = provider.toUpperCase() === 'DIGITALOCEAN';
  const containerId = isDO ? 'doCardsContainer' : 'azureCardsContainer';
  const container = document.getElementById(containerId);
  if (!container) return;

  const allProviderAccounts = state.cloudAccounts.filter(
    a => (a.provider || '').toUpperCase() === provider.toUpperCase()
  );

  // Compute stats
  const running = allProviderAccounts.filter(a => (a.status || '').toUpperCase() === 'RUNNING');
  const available = allProviderAccounts.filter(a => (a.status || '').toUpperCase() === 'AVAILABLE');
  const expired = allProviderAccounts.filter(a => (a.status || '').toUpperCase() === 'EXPIRED');

  // Update KPI counters
  if (isDO) {
    const rEl = document.getElementById('doRunningCount');
    const aEl = document.getElementById('doAvailableCount');
    const eEl = document.getElementById('doExpiredCount');
    const tEl = document.getElementById('doTotalCount');
    const bEl = document.getElementById('sidebarDoBadge');
    if (rEl) rEl.textContent = running.length;
    if (aEl) aEl.textContent = available.length;
    if (eEl) eEl.textContent = expired.length;
    if (tEl) tEl.textContent = allProviderAccounts.length;
    if (bEl) bEl.textContent = `${running.length} Running`;
  } else {
    const rEl = document.getElementById('azureRunningCount');
    const aEl = document.getElementById('azureAvailableCount');
    const eEl = document.getElementById('azureExpiredCount');
    const tEl = document.getElementById('azureTotalCount');
    const bEl = document.getElementById('sidebarAzureBadge');
    if (rEl) rEl.textContent = running.length;
    if (aEl) aEl.textContent = available.length;
    if (eEl) eEl.textContent = expired.length;
    if (tEl) tEl.textContent = allProviderAccounts.length;
    if (bEl) bEl.textContent = `${running.length} Running`;
  }

  // Filter accounts for display based on active status filter
  const accountsToDisplay = state.getFilteredCloudAccounts(provider);

  if (accountsToDisplay.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center bg-white rounded-xl border border-slate-200">
        <span class="text-3xl block mb-2">${isDO ? '🌊' : '🔷'}</span>
        <h4 class="font-bold text-slate-800">No ${isDO ? 'DigitalOcean' : 'Azure'} Accounts Found</h4>
        <p class="text-xs text-slate-500 mt-1">There are no accounts matching the selected filter.</p>
        <button class="btn btn-primary btn-sm mt-4" data-quick-add-cloud="${provider}">
          + Add First Account
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = accountsToDisplay.map(account => {
    const statusUpper = (account.status || 'RUNNING').toUpperCase();
    const isRunning = statusUpper === 'RUNNING';
    const isAvailable = statusUpper === 'AVAILABLE';
    const isExpired = statusUpper === 'EXPIRED' || account.is_expired;

    let statusBadgeClass = 'badge-status-running';
    let statusText = '🟢 Running';
    let cardStateClass = 'is-running';

    if (isAvailable) {
      statusBadgeClass = 'badge-status-available';
      statusText = '🔵 Available';
      cardStateClass = 'is-available';
    } else if (isExpired) {
      statusBadgeClass = 'badge-status-expired';
      statusText = '🔴 Expired';
      cardStateClass = 'is-expired';
    }

    const domains = account.domains_list || [];
    const purchasedStr = formatDateDisplay(account.purchased_at);
    const expiresStr = formatDateDisplay(account.expires_at);
    const isAzure = provider.toUpperCase() === 'AZURE';

    return `
      <div class="cloud-account-card ${cardStateClass}" data-account-id="${account.id}">
        <!-- Header -->
        <div class="cloud-card-header">
          <div class="cloud-card-title-group">
            <h3 class="cloud-card-name" title="${escapeHtml(account.account_name)}">
              ${escapeHtml(account.account_name)}
            </h3>
            <div class="cloud-card-email">
              <span>📧 ${escapeHtml(account.account_email || 'No email specified')}</span>
              ${account.account_id ? `<span class="text-slate-400">• ID: ${escapeHtml(account.account_id)}</span>` : ''}
            </div>
          </div>
          <span class="badge-status ${statusBadgeClass}">
            ${isRunning ? '<span class="badge-pulse-dot"></span>' : ''}
            <span>${statusText}</span>
          </span>
        </div>

        <!-- Body -->
        <div class="cloud-card-body">
          <!-- Purchase & Expiry Meta Row -->
          <div class="cloud-card-meta-row">
            <div class="cloud-meta-item">
              <span class="cloud-meta-label">📅 Purchased Date</span>
              <span class="cloud-meta-val">${purchasedStr}</span>
            </div>
            <div class="cloud-meta-item">
              <span class="cloud-meta-label">⏳ Expiry Date</span>
              <span class="cloud-meta-val ${isExpired ? 'text-red-600 font-bold' : ''}">
                ${expiresStr} ${isExpired ? '(Expired)' : ''}
              </span>
            </div>
          </div>

          <!-- Credentials: Username & Password Row (Both DO & Azure) -->
          <div class="cloud-card-meta-row cloud-creds-box">
            <div class="cloud-meta-item">
              <span class="cloud-meta-label">👤 Username</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="font-mono text-xs font-bold text-slate-800">${escapeHtml(account.login_username || 'admin_ops')}</span>
                <button type="button" class="btn-copy-mini" data-copy-text="${escapeHtml(account.login_username || 'admin_ops')}" title="Copy username">📋</button>
              </div>
            </div>
            <div class="cloud-meta-item">
              <span class="cloud-meta-label">🔑 Password</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="font-mono text-xs font-bold text-slate-800 pwd-text" data-actual-pwd="${escapeHtml(account.login_password || '')}">••••••••</span>
                <button type="button" class="btn-copy-mini btn-toggle-pwd" title="Show / Hide password">👁️</button>
                <button type="button" class="btn-copy-mini" data-copy-text="${escapeHtml(account.login_password || '')}" title="Copy password">📋</button>
              </div>
            </div>
          </div>

          ${isAzure ? `
            <!-- Azure Endpoint Name Block -->
            <div class="cloud-endpoint-block">
              <div class="cloud-endpoint-header">
                <span class="cloud-endpoint-title">🔗 Endpoint Name</span>
                <span class="text-[10px] text-slate-400">Click to copy</span>
              </div>
              <div class="cloud-endpoint-box">
                <button type="button" class="endpoint-pill-btn" data-copy-text="${escapeHtml(account.endpoint_name || '')}" title="Click to copy endpoint URL">
                  <span class="font-mono text-xs text-blue-700 font-semibold truncate">${escapeHtml(account.endpoint_name || 'No endpoint configured')}</span>
                  <span class="text-[11px] opacity-70 ml-2">📋</span>
                </button>
              </div>
            </div>

            <!-- Azure Billing & Card Meta Row -->
            <div class="cloud-azure-meta-row">
              <div class="cloud-meta-item">
                <span class="cloud-meta-label">💳 Credit Card Used</span>
                <span class="cloud-meta-val font-semibold text-slate-800">${escapeHtml(account.credit_card_used || 'Not specified')}</span>
              </div>
              <div class="cloud-meta-item">
                <span class="cloud-meta-label">💵 Bill Amount</span>
                <span class="cloud-meta-val font-bold text-emerald-600">${escapeHtml(account.bill_amount || '$0.00')}</span>
              </div>
            </div>
          ` : `
            <!-- Domains Used Section (DigitalOcean) -->
            <div class="cloud-domains-block">
              <div class="cloud-domains-header">
                <span class="cloud-domains-title">
                  <span>🌐 Domains Used</span>
                  <span class="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                    ${domains.length}
                  </span>
                </span>
                <span class="text-[10px] text-slate-400">Click to copy</span>
              </div>

              <div class="cloud-domains-list">
                ${domains.map(dom => `
                  <button type="button" class="domain-pill-chip ${isRunning ? 'is-active-domain' : ''}" data-copy-text="${escapeHtml(dom)}" title="Click to copy domain">
                    <span>${escapeHtml(dom)}</span>
                    <span class="text-[10px] opacity-60">📋</span>
                  </button>
                `).join('') || `
                  <span class="text-xs text-slate-400 italic">
                    No domains assigned (Account is available for mapping)
                  </span>
                `}
              </div>
            </div>
          `}
        </div>

        <!-- Footer Actions -->
        <div class="cloud-card-footer">
          <div class="flex items-center gap-2">
            <label class="text-[11px] font-bold text-slate-500">Status:</label>
            <select class="cloud-status-select-sm" data-change-status="${account.id}">
              <option value="RUNNING" ${statusUpper === 'RUNNING' ? 'selected' : ''}>🟢 Running</option>
              <option value="AVAILABLE" ${statusUpper === 'AVAILABLE' ? 'selected' : ''}>🔵 Available</option>
              <option value="EXPIRED" ${statusUpper === 'EXPIRED' ? 'selected' : ''}>🔴 Expired</option>
              <option value="SUSPENDED" ${statusUpper === 'SUSPENDED' ? 'selected' : ''}>⚠️ Suspended</option>
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            <button class="btn-icon-subtle text-blue-600 hover:bg-blue-50" data-edit-cloud="${account.id}" title="Edit Account Details">
              ✏️
            </button>
            <button class="btn-icon-subtle danger" data-delete-cloud="${account.id}" title="Delete Account">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderApp() {
  renderLiveStatusRows();
  renderMainCards();
  renderCloudSection('DIGITALOCEAN');
  renderCloudSection('AZURE');
  renderGeoCards();
  updateGeoCardStatuses();
}

/**
 * Helper to compute live elapsed time for a geo card
 */
function getGeoCardLastCallString(geo) {
  const calls = Number(geo.calls_count || 0);
  if (calls <= 0) return "No calls yet";
  const cid = String(geo.id);
  if (!state.lastCallTimestamps[cid]) {
    state.lastCallTimestamps[cid] = Date.now();
    try { localStorage.setItem('last_call_timestamps', JSON.stringify(state.lastCallTimestamps)); } catch (e) {}
  }
  const recorded = state.lastCallTimestamps[cid] || Date.now();
  const diffMins = Math.max(0, Math.floor((Date.now() - recorded) / 60000));
  const timeStr = new Date(recorded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (diffMins < 1) return `Just now (${timeStr})`;
  if (diffMins < 60) return `${diffMins}m ago (${timeStr})`;
  return `Today ${timeStr} (${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago)`;
}

/**
 * Renders the Live Geo Calls horizontal cards.
 * Displays all active and configured country campaigns.
 * Allows adding and removing countries dynamically.
 */
function renderGeoCards() {
  const grid = document.getElementById('geoCardsGrid');
  if (!grid) return;

  // Build full list of campaigns from geoList or fallback from countries
  const fullList = (state.geoList && state.geoList.length > 0)
    ? state.geoList
    : (state.countries || []).map(c => {
        const client = (c.clients || [])[0] || {};
        const clientName = (client.name || '').trim();
        const displayLabel = clientName && !c.name.toLowerCase().includes(clientName.toLowerCase())
          ? `${c.name} - ${clientName}`
          : c.name;
        const code = (c.flag_emoji && c.flag_emoji.length <= 4 ? c.flag_emoji : c.name.slice(0, 2)).toUpperCase();
        const calls = state.columnCallCounts[state.clientMappings[String(c.id)]] || c.calls_count || 0;
        const isActive = (c.status || '').toUpperCase() === 'ACTIVE';
        const lastCallTime = getGeoCardLastCallString({ id: c.id, calls_count: calls });

        return {
          id: c.id,
          code: code,
          name: displayLabel,
          country_name: c.name,
          client_name: clientName,
          flag: c.flag_emoji || '🌍',
          calls_count: calls,
          is_active: isActive,
          accent: isActive ? 'emerald' : 'blue',
          last_call_time: lastCallTime
        };
      });

  const removedSet = state.removedGeos || new Set();
  const visibleGeos = fullList.filter(g => {
    const idStr = String(g.id || '');
    const codeStr = String(g.code || '').toUpperCase();
    if (idStr && removedSet.has(idStr)) return false;
    if (!idStr && codeStr && removedSet.has(codeStr)) return false;
    return true;
  });

  let totalCalls = 0;
  visibleGeos.forEach(g => {
    totalCalls += (parseInt(g.calls_count, 10) || 0);
  });

  const totalEl = document.getElementById('totalCallsTodayCount');
  if (totalEl) totalEl.textContent = totalCalls;

  if (visibleGeos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: #94a3b8; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; font-size: 0.85rem;">
        No country cards currently selected. Click <strong>+ Add Country</strong> above to track real-time calls.
      </div>
    `;
    return;
  }

  grid.innerHTML = visibleGeos.map(g => {
    const isActive = g.is_active;
    const countDisplay = state.isLoadingCalls
      ? '<span class="loading-pulse-dots font-mono text-slate-400">...</span>'
      : (g.calls_count !== undefined ? g.calls_count : 0);
    const lastCallStr = getGeoCardLastCallString(g);

    return `
      <div class="geo-call-card geo-card-${g.accent || 'blue'} ${isActive ? 'geo-is-active' : 'geo-is-paused'}" data-geo-id="${g.id}" data-geo-code="${g.code}">
        <div class="geo-card-top">
          <div class="geo-badge-flag">
            <span class="geo-flag-emoji">${escapeHtml(g.code || g.flag || '🌍')}</span>
            <div class="geo-code-info">
              <span class="geo-code-text">${escapeHtml(g.client_name || g.name || g.code)}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="geo-status-indicator" title="${escapeHtml(g.code)} - ${escapeHtml(g.client_name || g.name || '')} is ${isActive ? 'Active (Running)' : 'Paused (Stopped)'}">
              <span class="geo-status-dot ${isActive ? 'dot-active' : 'dot-paused'}"></span>
              <span class="geo-status-pill-sm ${isActive ? 'pill-active' : 'pill-paused'}">
                ${isActive ? 'Active' : 'Paused'}
              </span>
            </div>
            <button type="button" class="geo-card-remove-btn" data-remove-geo="${g.id}" data-remove-code="${g.code}" title="Remove ${escapeHtml(g.code)} - ${escapeHtml(g.client_name || g.name || '')} from live pulse" aria-label="Remove country card">✕</button>
          </div>
        </div>

        <div class="geo-card-count-row">
          <span class="geo-calls-count" id="pulse-calls-val-${g.id}">${countDisplay}</span>
          <span class="geo-calls-unit">Calls</span>
        </div>

        <div class="geo-card-time-row">
          <span class="geo-time-icon">🕒</span>
          <span class="geo-last-call-text">Last call: <strong class="geo-time-highlight">${escapeHtml(lastCallStr)}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Animate loaded call counts progressively one by one
 */
function animateCallsOneByOne() {
  const cards = document.querySelectorAll('.geo-call-card');
  cards.forEach((card, idx) => {
    setTimeout(() => {
      card.classList.add('card-loaded-pulse');
      const valEl = card.querySelector('.geo-calls-count');
      if (valEl) {
        valEl.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        valEl.style.transform = 'scale(1.15)';
        setTimeout(() => { valEl.style.transform = 'scale(1)'; }, 180);
      }
    }, idx * 60);
  });
}

/**
 * Render quick picker chips inside Add Geo Modal
 */
function renderAvailableGeosPicker() {
  const container = document.getElementById('availableGeosQuickPicker');
  if (!container) return;

  const fullList = (state.geoList && state.geoList.length > 0)
    ? state.geoList
    : (state.countries || []).map(c => {
        const client = (c.clients || [])[0] || {};
        const clientName = (client.name || '').trim();
        const displayLabel = clientName && !c.name.toLowerCase().includes(clientName.toLowerCase())
          ? `${c.name} - ${clientName}`
          : c.name;
        const code = (c.flag_emoji && c.flag_emoji.length <= 4 ? c.flag_emoji : c.name.slice(0, 2)).toUpperCase();
        return {
          id: c.id,
          code: code,
          name: displayLabel,
          flag: c.flag_emoji || '🌍'
        };
      });

  const removedSet = state.removedGeos || new Set();

  if (fullList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">
        No country campaigns found from connected sheets.
      </div>
    `;
    return;
  }

  container.innerHTML = fullList.map(g => {
    const isHidden = removedSet.has(String(g.id)) || (!g.id && removedSet.has(String(g.code)));
    return `
      <div class="geo-pick-card ${isHidden ? 'is-available' : 'is-already-active'}" 
           data-pick-geo-id="${g.id}" 
           data-pick-code="${g.code}" 
           data-pick-name="${escapeHtml(g.name)}" 
           role="button"
           tabindex="0"
           title="${isHidden ? 'Click to add to Live Pulse' : 'Currently visible in Live Pulse'}">
        <span class="geo-pick-flag">${escapeHtml(g.code || g.flag || '🌍')}</span>
        <span class="geo-pick-name truncate">${escapeHtml(g.name)}</span>
        ${isHidden 
          ? '<span class="geo-pick-action-btn">+ Add</span>' 
          : '<span class="geo-pick-status-active">✓ Active</span>'}
      </div>
    `;
  }).join('');
}

/**
 * Updates top Live Geo Call header tab badge
 */
function updatePulseTabDisplay() {
  const labelEl = document.getElementById('pulseTabLabel');
  if (!labelEl) return;
  const tabName = state.activeTabName || state.sheet1TabOverride || '26-nov-26';
  labelEl.textContent = `Tab: ${tabName}`;
  labelEl.title = `Active Sheet Tab: ${tabName} (Click to set or switch tab)`;
}

/**
 * Render Settings View: 1-to-1 Client Campaign ↔ Sheet Column Mapping
 */
function renderSettingsView() {
  const tbody = document.getElementById('simpleMappingTableBody');
  if (!tbody) return;

  const activeTab = state.activeTabName || state.sheet1TabOverride || '26-nov-26';

  // 1. Active Tab Badge & List
  const badge = document.getElementById('settingsActiveTabModeBadge');
  if (badge) badge.textContent = activeTab;

  const listEl = document.getElementById('settingsActiveTabsList');
  if (listEl) {
    listEl.innerHTML = `
      <span>• Active in Sheet 1 & Sheet 2: <strong class="text-blue-700 font-bold">${escapeHtml(activeTab)}</strong> 
        <a href="https://docs.google.com/spreadsheets/d/1xMdCTsAcT2vhr4cP32u2oElzDPN2e7UmoeROroLk3Lc/" target="_blank" class="text-blue-600 hover:underline ml-1">Sheet 1 ↗</a>
        <a href="https://docs.google.com/spreadsheets/d/14BY_Fnfw4f9hmcOGaPqIA6mC0pOkGRTivrimwC4uhmQ/" target="_blank" class="text-blue-600 hover:underline ml-1">Sheet 2 ↗</a>
      </span>
    `;
  }

  // 2. Populate recent tabs dropdown
  const s1Select = document.getElementById('settingSheet1TabSelect');
  if (s1Select && state.recentTabs && state.recentTabs.length > 0) {
    s1Select.innerHTML = '<option value="">-- Recent Tab Names --</option>' +
      state.recentTabs.map(t => `<option value="${escapeHtml(t)}" ${activeTab === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
  }
  const s1Input = document.getElementById('settingSheet1TabInput');
  if (s1Input && !s1Input.matches(':focus')) s1Input.value = activeTab;

  // 5. Lock indicator & Toggle button
  const lockBadge = document.getElementById('mappingLockBadge');
  if (lockBadge) {
    lockBadge.className = 'lock-indicator-badge ' + (state.isLocked ? 'locked' : 'unlocked');
    lockBadge.textContent = state.isLocked ? '🔒 Locked' : '🔓 Unlocked — Edit Mode';
  }
  const lockIcon = document.getElementById('lockStatusIcon');
  const lockText = document.getElementById('lockStatusText');
  if (lockIcon) lockIcon.textContent = state.isLocked ? '🔓' : '🔒';
  if (lockText) lockText.textContent = state.isLocked ? 'Unlock to Edit' : 'Lock Mapping';

  // 6. Available Columns list
  const availableCols = state.availableColumns && state.availableColumns.length > 0 
    ? state.availableColumns 
    : [
        'DE pulkit', 'de anshu', 'de salm',
        'AT pulkit', 'IT pulkit', 'CH pulkit',
        'uk mj', 'us mj', 'us maxy',
        'BE ARUN', 'ms ARUN'
      ];

  // 7. Render Simple 1-to-1 Mapping Table
  const rowsHtml = (state.countries || []).map(country => {
    const clients = country.clients || [];
    const clientName = clients.length > 0 ? clients[0].name : '';
    const mappedField = state.clientMappings[String(country.id)] || '';
    const calls = state.columnCallCounts[mappedField] || 0;
    const isActive = (country.status || '').toUpperCase() === 'ACTIVE';

    return `
      <tr class="hover:bg-slate-50 transition-colors" data-country-row="${country.id}">
        <td class="py-2.5 px-4 font-semibold text-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-base">${country.flag_emoji || '🌍'}</span>
            <div>
              <div class="font-bold text-slate-800 text-xs">${escapeHtml(country.name)}</div>
              ${clientName ? `<div class="text-[11px] text-slate-400 font-normal">Client: <strong class="text-slate-600">${escapeHtml(clientName)}</strong></div>` : ''}
            </div>
          </div>
        </td>
        <td class="py-2.5 px-3">
          <span class="country-status-pill ${isActive ? 'status-active' : 'status-paused'}">
            ${isActive ? '• ACTIVE' : '• PAUSED'}
          </span>
        </td>
        <td class="py-2.5 px-3">
          <select class="form-control text-xs py-1 px-2.5 mapping-field-select font-mono ${state.isLocked ? 'bg-slate-50 text-slate-600 cursor-not-allowed opacity-80' : 'bg-white border-blue-300'}" 
                  data-country-id="${country.id}" 
                  ${state.isLocked ? 'disabled' : ''}>
            <option value="">-- Select Sheet Field --</option>
            ${availableCols.map(col => {
              const colCalls = state.columnCallCounts[col] || 0;
              const isSelected = (mappedField.trim().toLowerCase() === col.trim().toLowerCase());
              return `<option value="${escapeHtml(col)}" ${isSelected ? 'selected' : ''}>${escapeHtml(col)} (${colCalls} calls)</option>`;
            }).join('')}
          </select>
        </td>
        <td class="py-2.5 px-4 text-right">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-mono ${calls > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}" id="country-calls-cell-${country.id}">
            📞 ${calls}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml || '<tr><td colspan="4" class="p-4 text-center text-xs text-slate-400">No country campaigns created yet. Click "+ New Country" above.</td></tr>';
}

/**
 * Updates top Live Geo Call cards indicator dots & pills
 * Active countries -> Green dot & Active pill
 * Paused countries -> Red dot & Paused pill
 */
function updateGeoCardStatuses() {
  const geoCards = document.querySelectorAll('.geo-call-card');
  if (!geoCards.length || !state.countries.length) return;

  geoCards.forEach(card => {
    const code = (card.dataset.geoCode || '').toUpperCase();

    const matching = state.countries.filter(c => {
      const name = (c.name || '').toUpperCase();
      if (code === 'DE') return name.includes('DE') || name.includes('GERMANY');
      if (code === 'AT') return name.includes('AT') || name.includes('AUSTRIA');
      if (code === 'GB' || code === 'UK') return name.includes('GB') || name.includes('UK') || name.includes('UNITED KINGDOM');
      if (code === 'US' || code === 'USA') return name.includes('US') || name.includes('USA') || name.includes('UNITED STATES');
      if (code === 'AE' || code === 'UAE') return name.includes('AE') || name.includes('UAE') || name.includes('EMIRATES');
      return name.includes(code);
    });

    const hasActive = matching.some(c => (c.status || '').toUpperCase() === 'ACTIVE');

    const dot = card.querySelector('.geo-status-dot, .geo-active-dot');
    const pill = card.querySelector('.geo-status-pill-sm');
    const indicator = card.querySelector('.geo-status-indicator');

    if (dot) {
      dot.className = `geo-status-dot ${hasActive ? 'dot-active' : 'dot-paused'}`;
    }
    if (pill) {
      pill.className = `geo-status-pill-sm ${hasActive ? 'pill-active' : 'pill-paused'}`;
      pill.textContent = hasActive ? 'Active' : 'Paused';
    }
    if (indicator) {
      indicator.title = `${code} is ${hasActive ? 'Active (Running)' : 'Paused (Stopped)'}`;
    }

    if (hasActive) {
      card.classList.remove('geo-is-paused');
      card.classList.add('geo-is-active');
    } else {
      card.classList.remove('geo-is-active');
      card.classList.add('geo-is-paused');
    }
  });
}

// Function to populate and open Edit Country Modal
function openEditCountryModal(countryId) {
  const country = state.countries.find(c => c.id == countryId);
  if (!country) return;

  const form = document.getElementById('countryForm');
  if (form) form.reset();

  const idInput = document.getElementById('countryIdInput');
  const clientIdInput = document.getElementById('countryClientIdInput');
  const nameInput = document.getElementById('countryNameInput');
  const flagInput = document.getElementById('countryFlagInput');
  const statusSelect = document.getElementById('countryStatusSelect');
  const clientNameInput = document.getElementById('countryClientNameInput');
  const clientContactInput = document.getElementById('countryClientContactInput');
  const clientNotesInput = document.getElementById('countryClientNotesInput');
  const modalTitle = document.getElementById('countryModalTitle');
  const submitBtn = document.getElementById('saveCountrySubmitBtn');

  if (idInput) idInput.value = country.id;
  if (nameInput) nameInput.value = country.name;
  if (flagInput) flagInput.value = country.flag_emoji || '🌍';
  if (statusSelect) statusSelect.value = country.status || 'ACTIVE';
  if (modalTitle) modalTitle.textContent = `Edit Country Campaign: ${country.name}`;
  if (submitBtn) submitBtn.textContent = 'Save Changes';

  const clients = country.clients || [];
  const primaryClient = clients[0] || {};
  if (clientIdInput) clientIdInput.value = primaryClient.id || '';
  if (clientNameInput) clientNameInput.value = primaryClient.name || '';
  if (clientContactInput) clientContactInput.value = primaryClient.contact || '';
  if (clientNotesInput) clientNotesInput.value = primaryClient.notes || '';

  Modal.open('countryModal');
}

/**
 * Render Revocalls Real-Time Webhook Calls View
 */
function renderRevocallsSection() {
  // 1. Update metric stat cards
  const statToday = document.getElementById('revocallsStatToday');
  const statAnswered = document.getElementById('revocallsStatAnswered');
  const statMissed = document.getElementById('revocallsStatMissed');
  const statDuration = document.getElementById('revocallsStatDuration');
  const filterCountAll = document.getElementById('revoFilterCountAll');
  const webhookDisplay = document.getElementById('revocallsWebhookUrlDisplay');

  if (statToday) statToday.textContent = state.revocallsStats.total_today || 0;
  if (statAnswered) statAnswered.textContent = state.revocallsStats.answered_today || 0;
  if (statMissed) statMissed.textContent = state.revocallsStats.missed_today || 0;
  if (statDuration) statDuration.textContent = state.revocallsStats.total_duration_today_formatted || '0s';
  if (filterCountAll) filterCountAll.textContent = state.revocallsStats.total_all_time || (state.revocallsCalls ? state.revocallsCalls.length : 0);
  if (webhookDisplay && state.revocallsWebhookUrl) {
    webhookDisplay.textContent = state.revocallsWebhookUrl;
  }

  // 2. Render Table Rows
  const tbody = document.getElementById('revocallsTableBody');
  if (!tbody) return;

  if (!state.revocallsCalls || state.revocallsCalls.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400">
          <div class="text-3xl mb-2">📭</div>
          <div class="font-bold text-slate-600 mb-1">No incoming calls recorded yet</div>
          <div class="text-xs text-slate-400 max-w-md mx-auto">
            Calls received via the Revocalls Outgoing Webhook will stream here automatically. Click <strong>"⚡ Send Test Call"</strong> above to test the webhook receiver now.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = state.revocallsCalls.map(c => {
    // Flag by country code
    let flagEmoji = '📞';
    const cc = (c.country_code || '').toUpperCase();
    if (cc === 'DE') flagEmoji = '🇩🇪';
    else if (cc === 'US') flagEmoji = '🇺🇸';
    else if (cc === 'UK' || cc === 'GB') flagEmoji = '🇬🇧';
    else if (cc === 'IT') flagEmoji = '🇮🇹';
    else if (cc === 'AT') flagEmoji = '🇦🇹';
    else if (cc === 'CH') flagEmoji = '🇨🇭';
    else if (cc === 'BE') flagEmoji = '🇧🇪';
    else if (cc === 'FR') flagEmoji = '🇫🇷';
    else if (cc === 'ES') flagEmoji = '🇪🇸';
    else if (cc === 'IN') flagEmoji = '🇮🇳';

    // Status badge
    let badgeHtml = '';
    const st = (c.call_status || '').toUpperCase();
    if (st === 'ANSWERED' || st === 'COMPLETED') {
      badgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">✅ Answered</span>`;
    } else if (st === 'RINGING' || st === 'IN-PROGRESS') {
      badgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 animate-pulse">🔔 Ringing</span>`;
    } else if (st === 'MISSED' || st === 'NO_ANSWER') {
      badgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">⚠️ Missed</span>`;
    } else if (st === 'BUSY') {
      badgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800">🚫 Busy</span>`;
    } else {
      badgeHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">${escapeHtml(c.call_status)}</span>`;
    }

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4 whitespace-nowrap">
          <div class="font-bold text-slate-800">${escapeHtml(c.call_time_ago)}</div>
          <div class="text-[11px] text-slate-400 font-mono">${escapeHtml(c.call_time_formatted)}</div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <div class="flex items-center gap-1.5">
            <span class="text-sm">${flagEmoji}</span>
            <span class="font-mono font-bold text-blue-700">${escapeHtml(c.caller_number)}</span>
            <button type="button" class="text-slate-400 hover:text-blue-600 transition-colors p-0.5" onclick="copyToClipboard('${escapeHtml(c.caller_number)}', 'Phone number copied!')" title="Copy phone number">
              📋
            </button>
          </div>
          ${c.country_code ? `<span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">${escapeHtml(c.country_code)}</span>` : ''}
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <div class="flex items-center gap-1.5">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              📞 ${escapeHtml(c.destination_number || '—')}
            </span>
            ${c.destination_number ? `
            <button type="button" class="text-slate-400 hover:text-indigo-600 transition-colors p-0.5" onclick="copyToClipboard('${escapeHtml(c.destination_number)}', 'Dialed number copied!')" title="Copy dialed number">
              📋
            </button>` : ''}
          </div>
        </td>
        <td class="py-3 px-4">
          <span class="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[11px]">
            ${escapeHtml(c.campaign_name || 'Inbound')}
          </span>
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          ${badgeHtml}
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap font-mono font-bold text-slate-700">
          ${escapeHtml(c.duration_formatted)}
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <button type="button" class="btn btn-outline text-[11px] py-1 px-2.5" onclick="inspectRevocallsPayload(${c.id})" title="Inspect complete webhook payload">
            🔍 Inspect
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

window.inspectRevocallsPayload = function(callId) {
  const call = (state.revocallsCalls || []).find(c => c.id === callId);
  if (!call) return;
  const jsonPre = document.getElementById('revocallsInspectJson');
  if (jsonPre) {
    jsonPre.textContent = JSON.stringify(call.raw_data || call, null, 2);
  }
  Modal.open('revocallsInspectModal');
};

// 7. Event Handlers & Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Prune any cards previously removed by user from server-rendered HTML immediately on DOM ready
  if (state.removedGeos && state.removedGeos.size > 0) {
    document.querySelectorAll('.geo-call-card').forEach(card => {
      const geoId = card.dataset.geoId;
      const geoCode = (card.dataset.geoCode || '').toUpperCase();
      if ((geoId && state.removedGeos.has(String(geoId))) || (!geoId && geoCode && state.removedGeos.has(geoCode))) {
        card.remove();
      }
    });
  }

  state.fetchAll();

  // Automatic Live Sync from Google Sheets: polls every 25 seconds so any new entry done in sheet automatically reflects in dashboard!
  setInterval(() => {
    state.fetchGeoCalls(true);
  }, 25000);

  // Automatic Real-Time Revocalls Webhook Live Poll (Every 10 seconds)
  setInterval(() => {
    state.fetchRevocallsCalls(state.activeView === 'revocalls');
  }, 10000);

  // Sidebar Navigation View Tabs
  document.getElementById('tabCampaignsBtn')?.addEventListener('click', () => switchView('campaigns'));
  document.getElementById('tabDigitalOceanBtn')?.addEventListener('click', () => switchView('digitalocean'));
  document.getElementById('tabAzureBtn')?.addEventListener('click', () => switchView('azure'));
  document.getElementById('tabRevocallsBtn')?.addEventListener('click', () => switchView('revocalls'));
  document.getElementById('tabSettingsBtn')?.addEventListener('click', () => switchView('settings'));

  // Revocalls Copy Webhook Button
  document.getElementById('revocallsCopyWebhookBtn')?.addEventListener('click', () => {
    const url = state.revocallsWebhookUrl || `${window.location.origin}/api/v1/revocalls/webhook/`;
    copyToClipboard(url, 'Revocalls Webhook URL copied to clipboard!');
  });

  // Revocalls Refresh Button
  document.getElementById('revocallsRefreshBtn')?.addEventListener('click', async () => {
    showToast('Refreshing Revocalls stream...', 'info');
    await state.fetchRevocallsCalls(true);
    showToast('Revocalls call stream refreshed', 'success');
  });

  // Revocalls Simulate Test Webhook Call Button
  document.getElementById('revocallsSimulateTestBtn')?.addEventListener('click', async () => {
    try {
      showToast('Simulating incoming test call...', 'info');
      const res = await fetch('/api/v1/revocalls/test-webhook/', {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'SUCCESS') {
        showToast(`Test Call Received: ${data.caller_number} (${data.campaign_name}) [${data.duration_formatted}]`, 'success');
        await state.fetchRevocallsCalls(true);
      } else {
        showToast(data.message || 'Error triggering test webhook', 'error');
      }
    } catch (e) {
      showToast('Error sending test webhook call', 'error');
    }
  });

  // Revocalls Search Filter
  let revoSearchTimeout = null;
  document.getElementById('revocallsSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(revoSearchTimeout);
    revoSearchTimeout = setTimeout(() => {
      state.revocallsSearch = e.target.value.trim();
      state.fetchRevocallsCalls(true);
    }, 300);
  });

  // Revocalls Status Filter Pills
  document.querySelectorAll('[data-revo-status]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-revo-status]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.revocallsFilter = e.currentTarget.dataset.revoStatus || 'ALL';
      state.fetchRevocallsCalls(true);
    });
  });

  // Quick Tab Modal Openers
  const openTabModal = () => {
    const activeTab = state.activeTabName || state.sheet1TabOverride || '26-nov-26';
    const s1Input = document.getElementById('quickSheet1TabInput');
    if (s1Input) s1Input.value = activeTab;

    const selectEl = document.getElementById('quickRecentTabsSelect');
    if (selectEl && state.recentTabs && state.recentTabs.length > 0) {
      selectEl.innerHTML = '<option value="">Recent Tabs...</option>' +
        state.recentTabs.map(t => `<option value="${escapeHtml(t)}" ${activeTab === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
    }

    Modal.open('sheetTabModal');
  };

  document.getElementById('pulseTabIndicator')?.addEventListener('click', openTabModal);
  document.getElementById('openTabModalBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openTabModal();
  });

  // Quick Tab Recent Dropdown Selection
  document.getElementById('quickRecentTabsSelect')?.addEventListener('change', (e) => {
    if (e.target.value) {
      const input = document.getElementById('quickSheet1TabInput');
      if (input) input.value = e.target.value;
    }
  });

  // Quick Tab Form Submit
  document.getElementById('quickTabForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tabName = (document.getElementById('quickSheet1TabInput')?.value || '').trim();
    if (!tabName) return;

    Modal.close('sheetTabModal');
    state.activeTabName = tabName;
    state.sheet1TabOverride = tabName;
    state.sheet2TabOverride = tabName;
    state.tabMode = 'manual';
    updatePulseTabDisplay();

    await state.saveSheetSettings({
      active_tab: tabName,
      sheet1_tab_override: tabName,
      sheet2_tab_override: tabName,
      tab_mode: 'manual'
    });
    showToast(`Connected to sheet tab: ${tabName}`, 'success');
    await state.fetchGeoCalls(true);
  });

  // Settings Panel Tab Select Dropdown Change -> fills text inputs
  document.getElementById('settingSheet1TabSelect')?.addEventListener('change', (e) => {
    if (e.target.value) {
      const input = document.getElementById('settingSheet1TabInput');
      if (input) input.value = e.target.value;
    }
  });

  // Settings Panel: Toggle Lock Mapping Button
  document.getElementById('toggleLockMappingBtn')?.addEventListener('click', async () => {
    state.isLocked = !state.isLocked;
    await state.saveSheetSettings({ is_locked: state.isLocked, client_mappings: state.clientMappings });
    renderSettingsView();
    showToast(state.isLocked ? '🔒 Client mapping locked. Ready to sync calls.' : '🔓 Client mapping unlocked for editing.', 'info');
  });

  // Settings Panel: Reload Columns Button
  document.getElementById('reloadSheetColumnsBtn')?.addEventListener('click', async () => {
    await state.fetchGeoCalls(true);
    await state.fetchSheetSettings();
    showToast('Refreshed Google Sheet columns & live calls', 'info');
  });

  // Settings Panel: Save All Settings Button
  document.getElementById('saveAllSettingsBtn')?.addEventListener('click', async () => {
    const tabName = document.getElementById('settingSheet1TabInput')?.value.trim() || state.activeTabName || '26-nov-26';

    state.activeTabName = tabName;
    state.sheet1TabOverride = tabName;
    state.sheet2TabOverride = tabName;
    state.tabMode = 'manual';
    state.isLocked = true;
    updatePulseTabDisplay();

    await state.saveSheetSettings({
      active_tab: tabName,
      sheet1_tab_override: tabName,
      sheet2_tab_override: tabName,
      tab_mode: 'manual',
      client_mappings: state.clientMappings,
      is_locked: true
    });
    renderSettingsView();
    showToast(`Connected & locked tab: ${tabName}`, 'success');
    await state.fetchGeoCalls(true);
  });

  // Quick Add Cloud Account button in sidebar
  document.getElementById('sidebarAddCloudAccountBtn')?.addEventListener('click', () => {
    openCloudModal('DIGITALOCEAN');
  });

  // Live Geo Calls Sync Button Handler (Forces fresh sync from Google Sheets last tabs)
  document.getElementById('refreshGeoCallsBtn')?.addEventListener('click', async () => {
    const data = await state.fetchGeoCalls(true);
    if (data) {
      const tabInfo = data.last_tabs ? ` (Tab: ${data.last_tabs.sheet1?.name || 'Latest'})` : '';
      showToast(data.sheet_connected ? `Synchronized calls from last tab of Google Sheets${tabInfo}` : 'Synced calls from database & ready for Sheet sync', 'success');
    } else {
      showToast('Error syncing geo calls', 'error');
    }
  });

  // Open Add DO Button
  document.getElementById('openAddDoBtn')?.addEventListener('click', () => {
    openCloudModal('DIGITALOCEAN');
  });

  // Open Add Azure Button
  document.getElementById('openAddAzureBtn')?.addEventListener('click', () => {
    openCloudModal('AZURE');
  });

  // Status Filter Group for Campaigns
  document.getElementById('statusFilterGroup')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (pill && pill.dataset.filter) {
      document.querySelectorAll('#statusFilterGroup .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.currentStatusFilter = pill.dataset.filter;
      renderMainCards();
    }
  });

  // DO Status Filter Group
  document.getElementById('doStatusFilterGroup')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (pill && pill.dataset.cloudFilter) {
      document.querySelectorAll('#doStatusFilterGroup .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.cloudFilters.DIGITALOCEAN = pill.dataset.cloudFilter;
      renderCloudSection('DIGITALOCEAN');
    }
  });

  // Azure Status Filter Group
  document.getElementById('azureStatusFilterGroup')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.filter-pill');
    if (pill && pill.dataset.cloudFilter) {
      document.querySelectorAll('#azureStatusFilterGroup .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.cloudFilters.AZURE = pill.dataset.cloudFilter;
      renderCloudSection('AZURE');
    }
  });

  // Global Search Input
  document.getElementById('globalSearchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderMainCards();
  });

  // Keyboard shortcut '/' for Search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      document.getElementById('globalSearchInput')?.focus();
    }
  });

  // Open / Close Mobile Sidebar with Backdrop & Body Lock
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function openMobileSidebar() {
    sidebar?.classList.add('open');
    sidebar?.classList.add('is-mobile-open');
    sidebarBackdrop?.classList.add('is-open');
    document.body.classList.add('sidebar-mobile-locked');
  }

  function closeMobileSidebar() {
    sidebar?.classList.remove('open');
    sidebar?.classList.remove('is-mobile-open');
    sidebarBackdrop?.classList.remove('is-open');
    document.body.classList.remove('sidebar-mobile-locked');
  }

  document.getElementById('menuToggleBtn')?.addEventListener('click', () => {
    const isOpen = sidebar?.classList.contains('open') || sidebar?.classList.contains('is-mobile-open');
    if (isOpen) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });

  document.getElementById('sidebarCloseBtn')?.addEventListener('click', closeMobileSidebar);
  sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

  // Auto-close sidebar on mobile when navigating
  document.querySelectorAll('.sidebar-nav-btn, #sidebarAddCloudAccountBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        closeMobileSidebar();
      }
    });
  });

  // Delegated Click Handlers (Toggle country, copy, edit, delete, etc.)
  document.addEventListener('click', (e) => {
    // Copy domain or IP
    const copyBtn = e.target.closest('[data-copy-text]');
    if (copyBtn) {
      copyToClipboard(copyBtn.dataset.copyText);
      return;
    }

    // Toggle Country Status
    const toggleBtn = e.target.closest('[data-toggle-country]');
    if (toggleBtn) {
      state.toggleCountryStatus(toggleBtn.dataset.toggleCountry);
      return;
    }

    // Delete Country
    const delCountry = e.target.closest('[data-delete-country]');
    if (delCountry) {
      const cId = delCountry.dataset.deleteCountry;
      const country = state.countries.find(c => c.id == cId);
      Modal.confirm({
        title: 'Delete Country Campaign?',
        message: 'This will permanently remove the country campaign and its associated clients.',
        targetName: country ? country.name : 'Selected Country',
        onConfirm: () => state.deleteCountry(cId)
      });
      return;
    }

    // Delete Link
    const delLink = e.target.closest('[data-delete-link]');
    if (delLink) {
      Modal.confirm({
        title: 'Delete Popup Link?',
        message: 'Are you sure you want to delete this link entry?',
        onConfirm: () => state.deleteLinkEntry(delLink.dataset.deleteLink)
      });
      return;
    }

    // Quick Add Cloud Account
    const quickAddCloud = e.target.closest('[data-quick-add-cloud]');
    if (quickAddCloud) {
      openCloudModal(quickAddCloud.dataset.quickAddCloud);
      return;
    }

    // Toggle Password Visibility in Cloud Account Card
    const togglePwdBtn = e.target.closest('.btn-toggle-pwd');
    if (togglePwdBtn) {
      const container = togglePwdBtn.closest('.cloud-meta-item');
      const pwdSpan = container?.querySelector('.pwd-text');
      if (pwdSpan) {
        const actual = pwdSpan.dataset.actualPwd || '';
        if (pwdSpan.textContent === '••••••••') {
          pwdSpan.textContent = actual || '••••••••';
          togglePwdBtn.textContent = '🙈';
        } else {
          pwdSpan.textContent = '••••••••';
          togglePwdBtn.textContent = '👁️';
        }
      }
      return;
    }

    // Edit Cloud Account
    const editCloudBtn = e.target.closest('[data-edit-cloud]');
    if (editCloudBtn) {
      const accountId = editCloudBtn.dataset.editCloud;
      const account = state.cloudAccounts.find(a => a.id == accountId);
      if (account) {
        openCloudModal(account.provider, account);
      }
      return;
    }

    // Delete Cloud Account
    const delCloudBtn = e.target.closest('[data-delete-cloud]');
    if (delCloudBtn) {
      const accountId = delCloudBtn.dataset.deleteCloud;
      const account = state.cloudAccounts.find(a => a.id == accountId);
      Modal.confirm({
        title: 'Delete Cloud Infrastructure Account?',
        message: 'Are you sure you want to remove this account record?',
        targetName: account ? `${account.account_name} (${account.provider})` : 'Cloud Account',
        onConfirm: () => state.deleteCloudAccount(accountId)
      });
      return;
    }

    // Edit Country Campaign
    const editCountryBtn = e.target.closest('[data-edit-country]');
    if (editCountryBtn) {
      openEditCountryModal(editCountryBtn.dataset.editCountry);
      return;
    }

    // Open Add Country to Live Pulse Modal (+ Add Country in tracker header)
    if (e.target.closest('#openAddGeoBtn')) {
      renderAvailableGeosPicker();
      Modal.open('addGeoModal');
      return;
    }

    // Pick Geo Chip from Available Sheet Geos
    const pickChip = e.target.closest('[data-pick-code], [data-pick-geo-id]');
    if (pickChip) {
      const geoId = pickChip.dataset.pickGeoId;
      const code = (pickChip.dataset.pickCode || '').toUpperCase();
      const name = pickChip.dataset.pickName || code;

      const isAlreadyActive = pickChip.classList.contains('is-already-active');
      if (isAlreadyActive) {
        showToast(`${name} is already active in Live Pulse`, 'info');
        return;
      }

      if (geoId) state.removedGeos.delete(String(geoId));
      if (code) state.removedGeos.delete(String(code));
      try { localStorage.setItem('removed_geos', JSON.stringify(Array.from(state.removedGeos))); } catch (err) {}
      renderGeoCards();
      renderAvailableGeosPicker();
      Modal.close('addGeoModal');
      showToast(`Added ${name} to Live Pulse Tracker`, 'success');
      return;
    }

    // Remove Country from Live Pulse Grid
    const removeGeoBtn = e.target.closest('[data-remove-geo], .geo-card-remove-btn');
    if (removeGeoBtn) {
      e.preventDefault();
      e.stopPropagation();
      const card = removeGeoBtn.closest('.geo-call-card');
      const targetId = removeGeoBtn.dataset.removeGeo || card?.dataset.geoId;
      const targetCode = (removeGeoBtn.dataset.removeCode || card?.dataset.geoCode || '').toUpperCase();

      if (targetId) state.removedGeos.add(String(targetId));
      else if (targetCode) state.removedGeos.add(String(targetCode));

      try {
        localStorage.setItem('removed_geos', JSON.stringify(Array.from(state.removedGeos)));
      } catch (err) {}

      // Instant visual feedback with smooth collapse animation
      if (card) {
        card.style.transition = 'all 0.18s ease-out';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.85)';
        setTimeout(() => {
          card.remove();
          // Update total calls count in header pill
          const remaining = document.querySelectorAll('.geo-call-card');
          let remainingTotal = 0;
          remaining.forEach(c => {
            const cnt = c.querySelector('.geo-calls-count');
            if (cnt) remainingTotal += (parseInt(cnt.textContent, 10) || 0);
          });
          const totEl = document.getElementById('totalCallsTodayCount');
          if (totEl) totEl.textContent = remainingTotal;
        }, 180);
      }

      renderGeoCards();
      renderAvailableGeosPicker();
      showToast('Removed country from Live Pulse Tracker', 'info');
      return;
    }

    // Open Add Country Modal
    if (e.target.closest('#topAddCountryBtn') || e.target.closest('#emptyStateAddBtn')) {
      document.getElementById('countryForm')?.reset();
      document.getElementById('countryIdInput').value = '';
      const cIdInput = document.getElementById('countryClientIdInput');
      if (cIdInput) cIdInput.value = '';
      const mTitle = document.getElementById('countryModalTitle');
      if (mTitle) mTitle.textContent = 'Add New Country';
      const sBtn = document.getElementById('saveCountrySubmitBtn');
      if (sBtn) sBtn.textContent = 'Save Country & Client';
      Modal.open('countryModal');
      return;
    }

    // Open Add Link Entry Modal
    const addEntryBtn = e.target.closest('[data-add-entry]');
    if (addEntryBtn) {
      document.getElementById('entryClientIdInput').value = addEntryBtn.dataset.clientId;
      document.getElementById('entryTimeInput').value = getLocalDateTimeInputValue();
      Modal.open('entryModal');
      return;
    }

    // Edit Country Mobile Number Modal

    const editMobBtn = e.target.closest('[data-edit-mobile]');
    if (editMobBtn) {
      const clientId = editMobBtn.dataset.editMobile;
      const countryId = editMobBtn.dataset.countryId;
      const countryName = editMobBtn.dataset.countryName || 'Country';
      const currentMobile = editMobBtn.dataset.currentMobile || '';

      const cInput = document.getElementById('editMobileClientId');
      const coInput = document.getElementById('editMobileCountryId');
      const banner = document.getElementById('editMobileTargetName');
      const mInput = document.getElementById('editMobileNumberInput');

      if (cInput) cInput.value = clientId;
      if (coInput) coInput.value = countryId;
      if (banner) banner.textContent = countryName;
      if (mInput) mInput.value = currentMobile;

      Modal.open('editMobileModal');
      return;
    }

    // Toggle Previous Links History Collapsible
    const toggleLinksBtn = e.target.closest('[data-toggle-links-client]');
    if (toggleLinksBtn) {
      const clientId = toggleLinksBtn.dataset.toggleLinksClient;
      const panel = document.getElementById(`previous-links-panel-${clientId}`);
      if (panel) {
        panel.classList.toggle('hidden');
        const isHidden = panel.classList.contains('hidden');
        const count = toggleLinksBtn.dataset.totalLinks || '';
        toggleLinksBtn.innerHTML = isHidden 
          ? `<span>▼ Previous Links (${count} earlier)</span>`
          : `<span>▲ Hide Earlier Links</span>`;
      }
      return;
    }

    // Toggle Offline / Paused Countries Collapsible Dropdown
    const toggleOfflineBtn = e.target.closest('#toggleOfflineCountriesBtn');
    if (toggleOfflineBtn) {
      state.showOfflineCountries = !state.showOfflineCountries;
      renderMainCards();
      return;
    }

    // Unmap Column from Country in Settings
    const unmapBtn = e.target.closest('[data-unmap-geo]');
    if (unmapBtn) {
      const geo = unmapBtn.dataset.unmapGeo;
      const colName = unmapBtn.dataset.colName;
      if (state.countryMappings[geo]) {
        state.countryMappings[geo] = state.countryMappings[geo].filter(c => c !== colName);
        renderSettingsView();
      }
      return;
    }
  });

  // Change Cloud Status Select Listener & Country Mapping Field Select
  document.addEventListener('change', (e) => {
    // Change Mapped Sheet Field for Country Campaign in Settings
    const fieldSelect = e.target.closest('.mapping-field-select');
    if (fieldSelect) {
      const countryId = fieldSelect.dataset.countryId;
      const newField = fieldSelect.value;
      state.clientMappings[String(countryId)] = newField;
      const calls = state.columnCallCounts[newField] || 0;
      const callsCell = document.getElementById(`country-calls-cell-${countryId}`);
      if (callsCell) {
        callsCell.className = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-mono ${calls > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`;
        callsCell.textContent = `📞 ${calls}`;
      }
      return;
    }

    const select = e.target.closest('[data-change-status]');
    if (select) {
      const accountId = select.dataset.changeStatus;
      const newStatus = select.value;
      state.changeCloudStatus(accountId, newStatus);
    }
  });

  // Country Form Submit
  document.getElementById('countryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const success = await state.saveCountry({
      id: document.getElementById('countryIdInput').value,
      clientId: document.getElementById('countryClientIdInput')?.value || '',
      name: document.getElementById('countryNameInput').value.trim(),
      flag: document.getElementById('countryFlagInput').value.trim() || '🌍',
      status: document.getElementById('countryStatusSelect').value,
      clientName: document.getElementById('countryClientNameInput').value.trim(),
      clientContact: document.getElementById('countryClientContactInput').value.trim(),
      clientNotes: document.getElementById('countryClientNotesInput').value.trim()
    });
    if (success) Modal.close('countryModal');
  });

  // Link Entry Form Submit (Mobile field removed per user request)
  document.getElementById('entryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const success = await state.saveLinkEntry({
      clientId: document.getElementById('entryClientIdInput').value,
      link: document.getElementById('entryLinkInput').value.trim(),
      insertedAt: document.getElementById('entryTimeInput').value
    });
    if (success) Modal.close('entryModal');
  });

  // Edit Mobile Form Submit
  document.getElementById('editMobileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientId = document.getElementById('editMobileClientId').value;
    const newMobile = document.getElementById('editMobileNumberInput').value.trim();
    if (!clientId) {
      showToast('Client account not found for this country', 'error');
      return;
    }
    const success = await state.updateClientMobile(clientId, newMobile);
    if (success) Modal.close('editMobileModal');
  });

  // Cloud Account Form Submit
  document.getElementById('cloudAccountForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountId = document.getElementById('cloudAccountIdInput').value;
    const provider = document.getElementById('cloudProviderSelect').value;
    const accountName = document.getElementById('cloudAccountNameInput').value.trim();
    const email = document.getElementById('cloudEmailInput').value.trim();
    const accountIdStr = document.getElementById('cloudAccountIdStrInput').value.trim();
    const statusVal = document.getElementById('cloudStatusSelect').value;
    const purchasedAt = document.getElementById('cloudPurchasedAtInput').value || null;
    const expiresAt = document.getElementById('cloudExpiresAtInput').value || null;
    const domainsUsed = document.getElementById('cloudDomainsInput')?.value.trim() || '';
    const endpointName = document.getElementById('cloudEndpointNameInput')?.value.trim() || '';
    const billAmount = document.getElementById('cloudBillAmountInput')?.value.trim() || '';
    const creditCardUsed = document.getElementById('cloudCreditCardInput')?.value.trim() || '';
    const loginUsername = document.getElementById('cloudUsernameInput')?.value.trim() || '';
    const loginPassword = document.getElementById('cloudPasswordInput')?.value.trim() || '';

    const data = {
      provider,
      account_name: accountName,
      account_email: email,
      account_id: accountIdStr,
      status: statusVal,
      purchased_at: purchasedAt,
      expires_at: expiresAt,
      domains_used: domainsUsed,
      endpoint_name: endpointName,
      bill_amount: billAmount,
      credit_card_used: creditCardUsed,
      login_username: loginUsername,
      login_password: loginPassword
    };
    if (accountId) data.id = accountId;

    const success = await state.saveCloudAccount(data);
    if (success) Modal.close('cloudAccountModal');
  });

  // Switch fields dynamically if user changes Provider inside the modal
  document.getElementById('cloudProviderSelect')?.addEventListener('change', (e) => {
    toggleCloudModalFields(e.target.value);
  });

  // Add Country to Live Pulse Form Submit
  document.getElementById('addGeoForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const codeInput = document.getElementById('customGeoCodeInput');
    const nameInput = document.getElementById('customGeoNameInput');
    const code = (codeInput?.value || '').trim().toUpperCase();
    const name = (nameInput?.value || '').trim();

    if (!code) return;

    if (!state.trackedGeos.includes(code)) {
      state.trackedGeos.push(code);
      localStorage.setItem('tracked_geos', JSON.stringify(state.trackedGeos));
    }

    if (!state.allGeosData[code]) {
      state.allGeosData[code] = {
        code: code,
        name: name || code,
        flag: '🌍',
        accent: 'blue',
        calls_count: 0,
        last_call_time: "No calls yet",
        is_active: false
      };
    } else if (name && (!state.allGeosData[code].name || state.allGeosData[code].name === code)) {
      state.allGeosData[code].name = name;
    }

    renderGeoCards();
    renderAvailableGeosPicker();
    Modal.close('addGeoModal');
    showToast(`Added ${code} to Live Pulse Tracker`, 'success');
  });

  // Quick flag chip selection
  document.getElementById('flagQuickPickers')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.flag-chip');
    if (chip && chip.dataset.flag) {
      document.getElementById('countryFlagInput').value = chip.dataset.flag;
    }
  });

  // Set Current Time
  document.getElementById('setCurrentTimeBtn')?.addEventListener('click', () => {
    document.getElementById('entryTimeInput').value = getLocalDateTimeInputValue();
  });

  // Sort Select Dropdown Listener
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderMainCards();
  });

  // Modal Closes
  document.querySelectorAll('[data-close-modal]').forEach(b => {
    b.addEventListener('click', () => Modal.close());
  });
  document.getElementById('modalBackdrop')?.addEventListener('click', () => Modal.close());

  // Google Sheets Viewer Toggles
  const sheetView = document.getElementById('sheetEmbedView');
  const sheetIframe = document.getElementById('googleSheetIframe');
  const sheetTitle = document.getElementById('currentSheetTitle');

  // Google Sheets Connected View URLs
  const GOOGLE_SHEET_BASE = {
    1: {
      id: '1xMdCTsAcT2vhr4cP32u2oElzDPN2e7UmoeROroLk3Lc',
      defaultGid: '644969503',
      title: 'Google Sheet 1 (Leads Data)'
    },
    2: {
      id: '14BY_Fnfw4f9hmcOGaPqIA6mC0pOkGRTivrimwC4uhmQ',
      defaultGid: '0',
      title: 'Google Sheet 2 (Campaigns Data)'
    }
  };

  let activeEmbedSheetNum = 1;

  function openSheetView(sheetNumber, customGid = null) {
    activeEmbedSheetNum = sheetNumber;
    const base = GOOGLE_SHEET_BASE[sheetNumber] || GOOGLE_SHEET_BASE[1];
    
    // Auto-detect last tab GID or use custom GID
    let gid = customGid;
    let tabName = '';
    if (!gid) {
      if (state.lastTabs) {
        const tabInfo = sheetNumber === 1 ? state.lastTabs.sheet1 : state.lastTabs.sheet2;
        if (tabInfo && tabInfo.gid) {
          gid = tabInfo.gid;
          tabName = tabInfo.name || '';
        }
      }
      if (!gid) gid = base.defaultGid;
    }

    if (sheetView && sheetIframe) {
      sheetView.classList.remove('hidden');
      document.getElementById('viewCampaignsSection')?.classList.add('hidden');
      document.getElementById('viewDigitalOceanSection')?.classList.add('hidden');
      document.getElementById('viewAzureSection')?.classList.add('hidden');
      
      const fullTitle = tabName ? `${base.title} [Last Tab: ${tabName}]` : base.title;
      if (sheetTitle) sheetTitle.textContent = fullTitle;
      
      sheetIframe.src = `https://docs.google.com/spreadsheets/d/${base.id}/preview?gid=${gid}`;
      const extBtn = document.getElementById('openExternalSheetBtn');
      if (extBtn) extBtn.href = `https://docs.google.com/spreadsheets/d/${base.id}/edit?gid=${gid}#gid=${gid}`;
      
      const gidInput = document.getElementById('sheetGidInput');
      if (gidInput) gidInput.value = gid;
    }
  }

  // Manual Tab GID setter button
  document.getElementById('saveSheetGidBtn')?.addEventListener('click', () => {
    const rawVal = document.getElementById('sheetGidInput')?.value.trim();
    if (!rawVal) return;
    let extractedGid = rawVal;
    const gidMatch = rawVal.match(/gid=([0-9]+)/);
    if (gidMatch) extractedGid = gidMatch[1];
    openSheetView(activeEmbedSheetNum, extractedGid);
    showToast(`Loaded tab GID: ${extractedGid}`, 'info');
  });

  document.getElementById('viewSheet1Btn')?.addEventListener('click', () => {
    openSheetView(1);
  });
  document.getElementById('viewSheet2Btn')?.addEventListener('click', () => {
    openSheetView(2);
  });
  document.getElementById('returnToDashboardBtn')?.addEventListener('click', () => {
    switchView(state.activeView || 'campaigns');
  });
});

/**
 * Toggles modal fields based on provider:
 * - DIGITALOCEAN: Shows Domains Used field
 * - AZURE: Shows Endpoint Name, Bill Amount, and Credit Card Used fields
 */
function toggleCloudModalFields(provider) {
  const isAzure = (provider || '').toUpperCase() === 'AZURE';
  const domainsGroup = document.getElementById('cloudDomainsGroup');
  const azureGroup = document.getElementById('cloudAzureSpecificGroup');
  if (domainsGroup) {
    if (isAzure) domainsGroup.classList.add('hidden');
    else domainsGroup.classList.remove('hidden');
  }
  if (azureGroup) {
    if (isAzure) azureGroup.classList.remove('hidden');
    else azureGroup.classList.add('hidden');
  }
}

/**
 * Open Cloud Account Add/Edit Modal
 */
function openCloudModal(provider = 'DIGITALOCEAN', account = null) {
  const form = document.getElementById('cloudAccountForm');
  if (!form) return;
  form.reset();

  const idInput = document.getElementById('cloudAccountIdInput');
  const providerSelect = document.getElementById('cloudProviderSelect');
  const title = document.getElementById('cloudModalTitle');
  const icon = document.getElementById('cloudModalIcon');

  const activeProvider = (account ? account.provider : provider || 'DIGITALOCEAN').toUpperCase();
  toggleCloudModalFields(activeProvider);

  if (account) {
    if (idInput) idInput.value = account.id;
    if (title) title.textContent = `Edit ${account.provider} Account`;
    if (providerSelect) providerSelect.value = account.provider;
    document.getElementById('cloudAccountNameInput').value = account.account_name || '';
    document.getElementById('cloudEmailInput').value = account.account_email || '';
    document.getElementById('cloudAccountIdStrInput').value = account.account_id || '';
    document.getElementById('cloudStatusSelect').value = account.status || 'RUNNING';
    document.getElementById('cloudPurchasedAtInput').value = account.purchased_at || '';
    document.getElementById('cloudExpiresAtInput').value = account.expires_at || '';
    document.getElementById('cloudDomainsInput').value = account.domains_used || '';

    // Credentials: Username & Password
    if (document.getElementById('cloudUsernameInput')) {
      document.getElementById('cloudUsernameInput').value = account.login_username || '';
    }
    if (document.getElementById('cloudPasswordInput')) {
      document.getElementById('cloudPasswordInput').value = account.login_password || '';
    }

    // Azure Specific Fields
    if (document.getElementById('cloudEndpointNameInput')) {
      document.getElementById('cloudEndpointNameInput').value = account.endpoint_name || '';
    }
    if (document.getElementById('cloudBillAmountInput')) {
      document.getElementById('cloudBillAmountInput').value = account.bill_amount || '';
    }
    if (document.getElementById('cloudCreditCardInput')) {
      document.getElementById('cloudCreditCardInput').value = account.credit_card_used || '';
    }
  } else {
    if (idInput) idInput.value = '';
    const isDO = provider.toUpperCase() === 'DIGITALOCEAN';
    if (title) title.textContent = `Add ${isDO ? 'DigitalOcean' : 'Azure'} Account`;
    if (icon) icon.textContent = isDO ? '🌊' : '🔷';
    if (providerSelect) providerSelect.value = provider.toUpperCase();
    document.getElementById('cloudStatusSelect').value = 'RUNNING';

    // Clear Credentials
    if (document.getElementById('cloudUsernameInput')) document.getElementById('cloudUsernameInput').value = '';
    if (document.getElementById('cloudPasswordInput')) document.getElementById('cloudPasswordInput').value = '';

    // Clear Azure Specific Fields
    if (document.getElementById('cloudEndpointNameInput')) document.getElementById('cloudEndpointNameInput').value = '';
    if (document.getElementById('cloudBillAmountInput')) document.getElementById('cloudBillAmountInput').value = '';
    if (document.getElementById('cloudCreditCardInput')) document.getElementById('cloudCreditCardInput').value = '';
  }

  Modal.open('cloudAccountModal');
}
