const $ = (id) => document.getElementById(id);

let apiUrl = '';
let token = '';
let currentLinkedInUrl = '';

function showStatus(msg, type = 'info') {
  const el = $('status');
  el.textContent = msg;
  el.className = `status ${type}`;
  if (type === 'success') setTimeout(() => (el.className = 'status'), 3000);
}

function showSection(section) {
  $('login-section').style.display = section === 'login' ? '' : 'none';
  $('main-section').style.display = section === 'main' ? '' : 'none';
}

async function loadCampaigns() {
  try {
    const res = await fetch(`${apiUrl}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const campaigns = await res.json();
    const select = $('campaign-select');
    select.innerHTML = '<option value="">— Select campaign —</option>';
    campaigns.forEach((c) => {
      if (c.status === 'ACTIVE' || c.status === 'DRAFT') {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.status})`;
        select.appendChild(opt);
      }
    });
  } catch {
    $('campaign-select').innerHTML = '<option value="">Failed to load</option>';
  }
}

async function detectLinkedIn() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';

    if (url.match(/linkedin\.com\/in\/[^/]+/)) {
      currentLinkedInUrl = url.split('?')[0];
      $('profile-url').textContent = currentLinkedInUrl;
      $('profile-info').style.display = '';
      $('not-linkedin').style.display = 'none';

      // Try to get name from content script
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const h1 = document.querySelector('h1');
            return h1 ? h1.textContent.trim() : '';
          },
        });
        if (result?.result) {
          const parts = result.result.split(' ');
          $('first-name').value = parts[0] ?? '';
          $('last-name').value = parts.slice(1).join(' ') ?? '';
          $('profile-name').textContent = result.result;
        }
      } catch {}
    } else {
      currentLinkedInUrl = '';
      $('profile-info').style.display = 'none';
      $('not-linkedin').style.display = '';
    }
  } catch {}
}

// Init
chrome.storage.local.get(['apiUrl', 'token'], async (data) => {
  if (data.apiUrl && data.token) {
    apiUrl = data.apiUrl;
    token = data.token;
    $('api-url').value = apiUrl;
    showSection('main');
    await Promise.all([loadCampaigns(), detectLinkedIn()]);
  } else {
    showSection('login');
  }
});

// Login
$('login-btn').addEventListener('click', async () => {
  const url = $('api-url').value.trim().replace(/\/$/, '');
  const email = $('login-email').value.trim();
  const password = $('login-password').value;

  if (!url || !email || !password) {
    showStatus('Fill in all fields', 'error');
    return;
  }

  $('login-btn').disabled = true;
  $('login-btn').textContent = 'Signing in...';

  try {
    const res = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();

    apiUrl = url;
    token = data.token;
    await chrome.storage.local.set({ apiUrl, token });

    showSection('main');
    showStatus('Signed in!', 'success');
    await Promise.all([loadCampaigns(), detectLinkedIn()]);
  } catch (err) {
    showStatus(err.message || 'Login failed', 'error');
  } finally {
    $('login-btn').disabled = false;
    $('login-btn').textContent = 'Sign in';
  }
});

// Add to campaign
$('add-btn').addEventListener('click', async () => {
  const firstName = $('first-name').value.trim();
  const lastName = $('last-name').value.trim();
  const campaignId = $('campaign-select').value;

  if (!firstName || !lastName) {
    showStatus('Enter first and last name', 'error');
    return;
  }

  $('add-btn').disabled = true;
  $('add-btn').textContent = 'Adding...';

  try {
    // Create lead
    const leadRes = await fetch(`${apiUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        firstName,
        lastName,
        linkedinUrl: currentLinkedInUrl || undefined,
        source: 'chrome-extension',
      }),
    });

    if (!leadRes.ok) throw new Error('Failed to create lead');
    const lead = await leadRes.json();

    showStatus(`✓ ${firstName} ${lastName} added!`, 'success');

    // Reset fields
    $('first-name').value = '';
    $('last-name').value = '';
  } catch (err) {
    showStatus(err.message || 'Failed to add lead', 'error');
  } finally {
    $('add-btn').disabled = false;
    $('add-btn').textContent = 'Add to Campaign';
  }
});

// Logout
$('logout-btn').addEventListener('click', async () => {
  await chrome.storage.local.clear();
  showSection('login');
  showStatus('Signed out', 'info');
});
