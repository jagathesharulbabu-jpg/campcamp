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

      renderApp();
    } catch (e) {
      console.error('API Fetch error:', e);
      showToast('Network error loading data', 'error');
    }
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
      const payload = {
        client: entryData.clientId,
        url: entryData.link,
        inserted_at: entryData.insertedAt || new Date().toISOString()
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

    result.sort((a, b) => a.name.localeCompare(b.name));
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
  const sheetSec = document.getElementById('sheetEmbedView');

  if (campSec) campSec.classList.toggle('hidden', viewName !== 'campaigns');
  if (doSec) doSec.classList.toggle('hidden', viewName !== 'digitalocean');
  if (azureSec) azureSec.classList.toggle('hidden', viewName !== 'azure');
  if (sheetSec) sheetSec.classList.add('hidden');

  // Breadcrumb updates
  const label = document.getElementById('activeViewLabel');
  if (label) {
    if (viewName === 'campaigns') label.textContent = 'All Country Campaigns & Leads';
    else if (viewName === 'digitalocean') label.textContent = 'DigitalOcean Infrastructure & Domains';
    else if (viewName === 'azure') label.textContent = 'Microsoft Azure Cloud & Domains';
  }

  // Render view data
  if (viewName === 'digitalocean') renderCloudSection('DIGITALOCEAN');
  if (viewName === 'azure') renderCloudSection('AZURE');
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

  runningContainer.innerHTML = running.map(c => `
    <div class="country-chip chip-active" data-country-id="${c.id}">
      <span>${c.flag_emoji || '🌍'}</span>
      <span>${escapeHtml(c.name)}</span>
      <button class="chip-quick-toggle" data-toggle-country="${c.id}">Pause</button>
    </div>
  `).join('') || '<span class="status-chips-empty">No active campaigns.</span>';

  pausedContainer.innerHTML = paused.map(c => `
    <div class="country-chip chip-paused" data-country-id="${c.id}">
      <span>${c.flag_emoji || '🌍'}</span>
      <span>${escapeHtml(c.name)}</span>
      <button class="chip-quick-toggle" data-toggle-country="${c.id}">Resume</button>
    </div>
  `).join('') || '<span class="status-chips-empty">No paused campaigns.</span>';
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

  container.innerHTML = filtered.map((country, idx) => {
    const isActive = (country.status || '').toUpperCase() === 'ACTIVE';
    const clients = country.clients || [];
    const primaryClient = clients[0] || {};
    const primaryClientId = country.primary_client_id || primaryClient.id || '';

    // Active Mobile Number
    const mobileNumber = country.active_mobile_number || primaryClient.mobile_number || '';

    // Calculate Latest Link Update Time
    let latestUpdateTimeStr = country.latest_update_relative || '';
    if (!latestUpdateTimeStr || latestUpdateTimeStr === 'No links yet') {
      let newestDate = null;
      clients.forEach(c => {
        (c.links || []).forEach(l => {
          const d = new Date(l.inserted_at || l.created_at);
          if (!isNaN(d.getTime()) && (!newestDate || d > newestDate)) {
            newestDate = d;
          }
        });
      });
      if (newestDate) {
        const diffMins = Math.max(0, Math.floor((Date.now() - newestDate.getTime()) / 60000));
        const timeStr = newestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffMins < 1) latestUpdateTimeStr = `Just now (${timeStr})`;
        else if (diffMins < 60) latestUpdateTimeStr = `${diffMins}m ago (${timeStr})`;
        else latestUpdateTimeStr = `${Math.floor(diffMins / 60)}h ago (${timeStr})`;
      } else {
        latestUpdateTimeStr = 'No links yet';
      }
    }

    return `
      <article class="country-card ${idx % 2 === 0 ? 'card-alt-blue' : 'card-alt-emerald'} ${isActive ? '' : 'is-paused'}" id="country-card-${country.id}">
        <header class="country-card-header">
          <div class="country-identity">
            <span class="country-big-flag">${country.flag_emoji || '🌍'}</span>
            <div class="country-meta">
              <h3>
                <span>${escapeHtml(country.name)}</span>
                <span class="country-status-pill ${isActive ? 'status-active' : 'status-paused'}">
                  ${isActive ? '• ACTIVE' : '• PAUSED'}
                </span>
              </h3>
              <div class="country-stats-inline">
                <span><strong>${clients.length}</strong> Clients</span>
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
                  <span class="client-name">🏢 ${escapeHtml(client.name)}</span>
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
                        <span class="latest-link-time">
                          🕒 ${formatDateDisplay(latestLink.inserted_at || latestLink.created_at)}
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
                              <span class="text-[11px] text-slate-400 font-mono">
                                ${formatDateDisplay(link.inserted_at || link.created_at)}
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
  }).join('');
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

          <!-- Domains Used Section -->
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

          <!-- Server IPs Row -->
          ${account.server_ips ? `
            <div class="cloud-ips-row">
              <span class="font-bold text-slate-600">🖥️ Server IPs:</span>
              <button type="button" class="ip-tag hover:border-blue-400 flex items-center gap-1" data-copy-text="${escapeHtml(account.server_ips)}" title="Click to copy IPs">
                <span>${escapeHtml(account.server_ips)}</span>
                <span class="text-[10px] opacity-60">📋</span>
              </button>
            </div>
          ` : ''}

          <!-- Notes -->
          ${account.notes ? `
            <div class="cloud-card-notes">
              ${escapeHtml(account.notes)}
            </div>
          ` : ''}
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
}

// 7. Event Handlers & Initialization
document.addEventListener('DOMContentLoaded', () => {
  state.fetchAll();

  // Sidebar Navigation View Tabs
  document.getElementById('tabCampaignsBtn')?.addEventListener('click', () => switchView('campaigns'));
  document.getElementById('tabDigitalOceanBtn')?.addEventListener('click', () => switchView('digitalocean'));
  document.getElementById('tabAzureBtn')?.addEventListener('click', () => switchView('azure'));

  // Quick Add Cloud Account button in sidebar
  document.getElementById('sidebarAddCloudAccountBtn')?.addEventListener('click', () => {
    openCloudModal('DIGITALOCEAN');
  });

  // Live Geo Calls Sync Button Handler
  document.getElementById('refreshGeoCallsBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshGeoCallsBtn');
    try {
      const res = await fetch('/api/v1/geo-calls/');
      if (res.ok) {
        const data = await res.json();
        const totalEl = document.getElementById('totalCallsTodayCount');
        if (totalEl) totalEl.textContent = data.total_calls_today;
        
        const grid = document.getElementById('geoCardsGrid');
        if (grid && data.geos) {
          grid.innerHTML = data.geos.map(geo => `
            <div class="geo-call-card geo-card-${geo.accent}" data-geo-code="${geo.code}">
              <div class="geo-card-top">
                <div class="geo-badge-flag">
                  <span class="geo-flag-emoji">${geo.flag}</span>
                  <div class="geo-code-info">
                    <span class="geo-code-text">${geo.code}</span>
                    <span class="geo-name-text">${geo.name}</span>
                  </div>
                </div>
                <span class="geo-active-dot" title="Active campaign country"></span>
              </div>
              <div class="geo-card-count-row">
                <span class="geo-calls-count">${geo.calls_count}</span>
                <span class="geo-calls-unit">Calls</span>
              </div>
              <div class="geo-card-time-row">
                <span class="geo-time-icon">🕒</span>
                <span class="geo-last-call-text">Last call: <strong class="geo-time-highlight">${geo.last_call_time}</strong></span>
              </div>
            </div>
          `).join('');
        }
        showToast('Live Geo Calls synchronized successfully', 'success');
      }
    } catch (e) {
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

  // Open / Close Mobile Sidebar
  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuToggleBtn')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });
  document.getElementById('sidebarCloseBtn')?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
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

    // Open Add Country Modal
    if (e.target.closest('#topAddCountryBtn') || e.target.closest('#emptyStateAddBtn')) {
      document.getElementById('countryForm')?.reset();
      document.getElementById('countryIdInput').value = '';
      Modal.open('countryModal');
      return;
    }

    // Open Add Link Entry Modal
    const addEntryBtn = e.target.closest('[data-add-entry]');
    if (addEntryBtn) {
      document.getElementById('entryClientIdInput').value = addEntryBtn.dataset.clientId;
      document.getElementById('entryTimeInput').value = new Date().toISOString().slice(0, 16);
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
  });

  // Change Cloud Status Select Listener
  document.addEventListener('change', (e) => {
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
    const domainsUsed = document.getElementById('cloudDomainsInput').value.trim();
    const serverIps = document.getElementById('cloudIpsInput').value.trim();
    const notes = document.getElementById('cloudNotesInput').value.trim();

    const data = {
      provider,
      account_name: accountName,
      account_email: email,
      account_id: accountIdStr,
      status: statusVal,
      purchased_at: purchasedAt,
      expires_at: expiresAt,
      domains_used: domainsUsed,
      server_ips: serverIps,
      notes
    };
    if (accountId) data.id = accountId;

    const success = await state.saveCloudAccount(data);
    if (success) Modal.close('cloudAccountModal');
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
    document.getElementById('entryTimeInput').value = new Date().toISOString().slice(0, 16);
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

  function openSheetView(title, gid) {
    if (sheetView && sheetIframe) {
      sheetView.classList.remove('hidden');
      document.getElementById('viewCampaignsSection')?.classList.add('hidden');
      document.getElementById('viewDigitalOceanSection')?.classList.add('hidden');
      document.getElementById('viewAzureSection')?.classList.add('hidden');
      if (sheetTitle) sheetTitle.textContent = title;
      // Example public sheet view URL
      sheetIframe.src = `https://docs.google.com/spreadsheets/d/e/2PACX-1vSg_placeholder/pubhtml?widget=true&headers=false`;
    }
  }

  document.getElementById('viewSheet1Btn')?.addEventListener('click', () => {
    openSheetView('Google Sheet 1 (Leads Data)', '0');
  });
  document.getElementById('viewSheet2Btn')?.addEventListener('click', () => {
    openSheetView('Google Sheet 2 (Campaigns Data)', '1');
  });
  document.getElementById('returnToDashboardBtn')?.addEventListener('click', () => {
    switchView(state.activeView || 'campaigns');
  });
});

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
    document.getElementById('cloudIpsInput').value = account.server_ips || '';
    document.getElementById('cloudNotesInput').value = account.notes || '';
  } else {
    if (idInput) idInput.value = '';
    const isDO = provider.toUpperCase() === 'DIGITALOCEAN';
    if (title) title.textContent = `Add ${isDO ? 'DigitalOcean' : 'Azure'} Account`;
    if (icon) icon.textContent = isDO ? '🌊' : '🔷';
    if (providerSelect) providerSelect.value = provider.toUpperCase();
    document.getElementById('cloudStatusSelect').value = 'RUNNING';
  }

  Modal.open('cloudAccountModal');
}
