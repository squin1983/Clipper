const API = 'https://clipper-backend-z71i.onrender.com';

const STORAGE_KEY = 'clipper-state-v15';

const DEFAULT_STATE = {
  accounts: [],
  reels: [],
  batches: [],
  settings: {
    selectedAccountId: null
  },
  tab: 'home'
};

let state = loadLocalState();

function loadLocalState() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    return {
      ...DEFAULT_STATE,
      ...saved,
      settings: {
        ...DEFAULT_STATE.settings,
        ...(saved?.settings || {})
      }
    };
  } catch (_) {
    return {
      ...DEFAULT_STATE,
      settings: {
        ...DEFAULT_STATE.settings
      }
    };
  }
}

function saveLocalState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function showToast(message, type = 'success') {
  let toast = document.getElementById(
    'clipper-toast'
  );

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'clipper-toast';

    Object.assign(toast.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: '99999',
      maxWidth: '420px',
      padding: '14px 18px',
      borderRadius: '12px',
      background:
        type === 'error'
          ? '#b42318'
          : '#111827',
      color: '#fff',
      fontSize: '14px',
      lineHeight: '1.45',
      boxShadow:
        '0 10px 30px rgba(0,0,0,.2)'
    });

    document.body.appendChild(toast);
  }

  toast.textContent = message;

  clearTimeout(
    window.__clipperToastTimer
  );

  window.__clipperToastTimer =
    setTimeout(() => {
      toast.remove();
    }, 5000);
}

function showError(message) {
  showToast(message, 'error');
}

async function api(
  endpoint,
  options = {},
  timeoutMs = 60000
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `${API}${endpoint}`,
      {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type':
            'application/json',
          ...(options.headers || {})
        }
      }
    );

    const text = await response.text();

    let data = null;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch (_) {
      data = {
        error: text || 'Invalid server response.'
      };
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          `Request failed (${response.status}).`
      );
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Request timed out. The backend took too long to respond.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadData() {
  try {
    const [
      accounts,
      reels,
      batches
    ] = await Promise.all([
      api('/api/accounts', {}, 30000),
      api('/api/reels?limit=1000', {}, 30000),
      api('/api/batches', {}, 30000)
    ]);

    state.accounts =
      Array.isArray(accounts)
        ? accounts
        : [];

    state.reels =
      Array.isArray(reels)
        ? reels
        : [];

    state.batches =
      Array.isArray(batches)
        ? batches
        : [];

    if (
      state.settings.selectedAccountId &&
      !state.accounts.some(
        (account) =>
          account.id ===
          state.settings.selectedAccountId
      )
    ) {
      state.settings.selectedAccountId =
        state.accounts[0]?.id || null;
    }

    if (
      !state.settings.selectedAccountId &&
      state.accounts.length
    ) {
      state.settings.selectedAccountId =
        state.accounts[0].id;
    }

    saveLocalState();
    render();
  } catch (error) {
    console.error(error);

    showError(
      `Could not load Clipper: ${error.message}`
    );
  }
}

function getSelectedAccount() {
  return state.accounts.find(
    (account) =>
      account.id ===
      state.settings.selectedAccountId
  );
}

function getSelectedReel() {
  return state.reels.find(
    (reel) =>
      reel.id ===
      state.settings.selectedReelId
  );
}

function getUnusedReels() {
  return state.reels.filter(
    (reel) => !reel.used
  );
}

function mergeReels(newReels) {
  const map = new Map(
    state.reels.map((reel) => [
      reel.id,
      reel
    ])
  );

  for (const reel of newReels || []) {
    const existing =
      map.get(reel.id);

    map.set(
      reel.id,
      existing
        ? {
            ...existing,
            ...reel
          }
        : reel
    );
  }

  state.reels = Array.from(
    map.values()
  ).sort((a, b) => {
    const dateA = a.publishedAt
      ? new Date(
          a.publishedAt
        ).getTime()
      : 0;

    const dateB = b.publishedAt
      ? new Date(
          b.publishedAt
        ).getTime()
      : 0;

    return dateA - dateB;
  });
}

function render() {
  const root =
    document.getElementById('app');

  if (!root) {
    return;
  }

  root.innerHTML = `
    <div class="clipper-app">

      <header class="clipper-header">
        <div>
          <h1>Clipper</h1>
          <div class="clipper-subtitle">
            Instagram Reel Remix Studio
          </div>
        </div>

        <div class="clipper-version">
          V1.5
        </div>
      </header>

      <nav class="clipper-nav">
        <button
          class="${
            state.tab === 'home'
              ? 'active'
              : ''
          }"
          onclick="setTab('home')"
        >
          Home
        </button>

        <button
          class="${
            state.tab === 'accounts'
              ? 'active'
              : ''
          }"
          onclick="setTab('accounts')"
        >
          Accounts
        </button>

        <button
          class="${
            state.tab === 'batches'
              ? 'active'
              : ''
          }"
          onclick="setTab('batches')"
        >
          Batches
        </button>

        <button
          class="${
            state.tab === 'settings'
              ? 'active'
              : ''
          }"
          onclick="setTab('settings')"
        >
          Settings
        </button>
      </nav>

      <main class="clipper-content">
        ${
          state.tab === 'home'
            ? renderHome()
            : state.tab === 'accounts'
            ? renderAccounts()
            : state.tab === 'batches'
            ? renderBatches()
            : renderSettings()
        }
      </main>

    </div>
  `;
}

function setTab(tab) {
  state.tab = tab;
  saveLocalState();
  render();
}

function renderHome() {
  const account =
    getSelectedAccount();

  const unused =
    getUnusedReels();

  const selectedReel =
    getSelectedReel();

  if (!account) {
    return `
      <section class="card empty-state">
        <h2>Add an Instagram account</h2>

        <p>
          Clipper needs at least one Instagram
          account to discover Reels.
        </p>

        <button
          class="primary"
          onclick="openAddAccountModal()"
        >
          + Add Instagram Account
        </button>
      </section>
    `;
  }

  return `
    <section class="card">

      <div class="section-header">
        <div>
          <h2>@${escapeHtml(
            account.username
          )}</h2>

          <p>
            ${
              state.reels.length
            } Reels loaded · ${
    unused.length
  } unused
          </p>
        </div>

        <div class="button-row">

          <button
            onclick="syncAccount()"
            id="sync-button"
          >
            ↻ Sync Instagram
          </button>

          <button
            onclick="loadOldestBatch()"
            id="oldest-button"
          >
            Load Oldest Reels
          </button>

        </div>
      </div>

    </section>

    ${
      selectedReel
        ? renderReelEditor(selectedReel)
        : renderReelList(unused)
    }
  `;
}

function renderReelList(reels) {
  if (!reels.length) {
    return `
      <section class="card empty-state">
        <h2>No unused Reels</h2>

        <p>
          Sync Instagram to discover more Reels.
        </p>
      </section>
    `;
  }

  const visible =
    reels.slice(0, 20);

  return `
    <section class="card">

      <div class="section-header">
        <div>
          <h2>Unused Reels</h2>
          <p>
            Select a Reel to analyze it with AI.
          </p>
        </div>
      </div>

      <div class="reel-grid">

        ${visible
          .map(
            (reel) => `
              <article
                class="reel-card"
                onclick="selectReel('${reel.id}')"
              >

                ${
                  reel.thumbnailUrl
                    ? `
                      <img
                        src="${escapeHtml(
                          reel.thumbnailUrl
                        )}"
                        alt="Instagram Reel"
                        loading="lazy"
                      >
                    `
                    : `
                      <div class="reel-placeholder">
                        Reel
                      </div>
                    `
                }

                <div class="reel-card-body">

                  <strong>
                    ${
                      reel.title
                        ? escapeHtml(
                            reel.title.slice(
                              0,
                              100
                            )
                          )
                        : 'Instagram Reel'
                    }
                  </strong>

                  <span>
                    ${formatDate(
                      reel.publishedAt
                    )}
                  </span>

                </div>

              </article>
            `
          )
          .join('')}

      </div>

      ${
        reels.length > 20
          ? `
            <p class="muted">
              Showing the first 20 of
              ${reels.length} unused Reels.
            </p>
          `
          : ''
      }

    </section>
  `;
}

function selectReel(reelId) {
  state.settings.selectedReelId =
    reelId;

  saveLocalState();
  render();
}

function renderReelEditor(reel) {
  const analysis =
    reel.analysis || {};

  const hooks =
    Array.isArray(
      analysis.hooks
    )
      ? analysis.hooks.filter(Boolean)
      : [];

  const selectedHook =
    reel.selectedHook ||
    hooks[0] ||
    '';

  return `
    <section class="card">

      <div class="section-header">

        <div>
          <button
            class="back-button"
            onclick="clearSelectedReel()"
          >
            ← Back to Reels
          </button>

          <h2>
            Reel Analysis
          </h2>

          <p>
            ${formatDate(
              reel.publishedAt
            )}
          </p>
        </div>

        <div>
          ${
            reel.analyzed
              ? `
                <span class="status success">
                  AI analyzed
                </span>
              `
              : `
                <span class="status">
                  Not analyzed
                </span>
              `
          }
        </div>

      </div>

      ${
        reel.thumbnailUrl
          ? `
            <div class="preview-wrapper">
              <img
                class="reel-preview"
                src="${escapeHtml(
                  reel.thumbnailUrl
                )}"
                alt="Reel preview"
              >
            </div>
          `
          : ''
      }

      ${
        reel.title
          ? `
            <div class="original-caption">
              <h3>Original Caption</h3>
              <p>
                ${escapeHtml(
                  reel.title
                )}
              </p>
            </div>
          `
          : ''
      }

      <div class="analysis-section">

        <div class="analysis-header">
          <h3>AI Analysis</h3>

          <button
            class="primary"
            id="analyze-button"
            onclick="analyzeReel('${reel.id}')"
          >
            🤖 ${
              reel.analyzed
                ? 'Analyze Again'
                : 'Analyze with AI'
            }
          </button>
        </div>

        ${
          analysis.summary
            ? `
              <div class="summary-box">
                <strong>Summary</strong>
                <p>
                  ${escapeHtml(
                    analysis.summary
                  )}
                </p>
              </div>
            `
            : `
              <div class="muted">
                AI analysis has not been generated yet.
              </div>
            `
        }

        ${
          hooks.length
            ? `
              <div class="hooks-section">

                <h3>
                  Choose a Hook
                </h3>

                <div class="hooks-list">

                  ${hooks
                    .map(
                      (hook, index) => `
                        <button
                          class="hook-option ${
                            selectedHook === hook
                              ? 'selected'
                              : ''
                          }"
                          onclick="selectHook('${reel.id}', ${index})"
                        >
                          <span>
                            ${index + 1}.
                          </span>

                          <strong>
                            ${escapeHtml(
                              hook
                            )}
                          </strong>
                        </button>
                      `
                    )
                    .join('')}

                </div>

              </div>
            `
            : ''
        }

        ${
          selectedHook
            ? `
              <div class="render-section">

                <h3>
                  Render Reel
                </h3>

                <div class="selected-hook">
                  ${escapeHtml(
                    selectedHook
                  )}
                </div>

                <label>
                  Category
                </label>

                <select
                  id="render-category"
                >
                  <option value="music">
                    Music
                  </option>

                  <option value="meme">
                    Meme
                  </option>

                  <option value="movie_tv">
                    Movie / TV
                  </option>
                </select>

                <button
                  class="primary render-button"
                  onclick="renderReel('${reel.id}')"
                  id="render-button"
                >
                  🎬 Render Reel
                </button>

              </div>
            `
            : ''
        }

      </div>

    </section>
  `;
}

function clearSelectedReel() {
  delete state.settings.selectedReelId;

  saveLocalState();
  render();
}

function selectHook(reelId, index) {
  const reel =
    state.reels.find(
      (item) => item.id === reelId
    );

  if (!reel) {
    return;
  }

  const hooks =
    reel.analysis?.hooks || [];

  if (!hooks[index]) {
    return;
  }

  reel.selectedHook =
    hooks[index];

  saveLocalState();
  render();
}

async function analyzeReel(reelId) {
  const button =
    document.getElementById(
      'analyze-button'
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      '🤖 Analyzing…';
  }

  try {
    const result =
      await api(
        `/api/reels/${encodeURIComponent(
          reelId
        )}/analyze`,
        {
          method: 'POST'
        },
        120000
      );

    if (
      result?.reel
    ) {
      mergeReels([
        result.reel
      ]);
    }

    saveLocalState();

    showToast(
      'AI analysis complete.'
    );

    render();
  } catch (error) {
    console.error(error);

    showError(
      `AI analysis failed: ${error.message}`
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        '🤖 Analyze with AI';
    }
  }
}

async function renderReel(reelId) {
  const reel =
    state.reels.find(
      (item) => item.id === reelId
    );

  if (!reel) {
    return;
  }

  const hook =
    reel.selectedHook ||
    reel.analysis?.hooks?.find(Boolean) ||
    '';

  if (!hook) {
    showError(
      'Select a hook before rendering.'
    );

    return;
  }

  const category =
    document.getElementById(
      'render-category'
    )?.value ||
    'music';

  const button =
    document.getElementById(
      'render-button'
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      '🎬 Rendering…';
  }

  try {
    const result =
      await api(
        `/api/jobs/${encodeURIComponent(
          reelId
        )}/render`,
        {
          method: 'POST',
          body: JSON.stringify({
            hook,
            category
          })
        },
        300000
      );

    if (
      result?.job?.status !==
      'completed'
    ) {
      throw new Error(
        'Render did not complete successfully.'
      );
    }

    reel.used = true;
    reel.rendered = true;
    reel.renderedAt =
      new Date().toISOString();

    saveLocalState();

    const downloadUrl =
      `${API}/api/jobs/${encodeURIComponent(
        result.job.id
      )}/file`;

    showRenderSuccess(
      downloadUrl
    );
  } catch (error) {
    console.error(error);

    showError(
      `Render failed: ${error.message}`
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        '🎬 Render Reel';
    }
  }
}

function showRenderSuccess(
  downloadUrl
) {
  const existing =
    document.getElementById(
      'render-success'
    );

  if (existing) {
    existing.remove();
  }

  const section =
    document.createElement('div');

  section.id =
    'render-success';

  section.className =
    'render-success';

  section.innerHTML = `
    <div>
      <h3>
        Render complete
      </h3>

      <p>
        Your Reel is ready.
      </p>
    </div>

    <a
      class="primary download-button"
      href="${downloadUrl}"
      target="_blank"
      rel="noopener"
    >
      ⬇ Download Reel
    </a>
  `;

  document
    .querySelector('.clipper-content')
    ?.prepend(section);

  showToast(
    'Render complete.'
  );
}

async function syncAccount() {
  const account =
    getSelectedAccount();

  if (!account) {
    showError(
      'Select an Instagram account first.'
    );

    return;
  }

  const button =
    document.getElementById(
      'sync-button'
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      '↻ Syncing…';
  }

  try {
    const result =
      await api(
        `/api/accounts/${encodeURIComponent(
          account.id
        )}/sync`,
        {
          method: 'POST'
        },
        300000
      );

    const reels =
      await api(
        '/api/reels?limit=1000',
        {},
        30000
      );

    mergeReels(reels);

    saveLocalState();

    showToast(
      `Sync complete: ${result.added || 0} new Reels added.`
    );

    render();
  } catch (error) {
    console.error(error);

    showError(
      `Instagram sync failed: ${error.message}`
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        '↻ Sync Instagram';
    }
  }
}

async function loadOldestBatch() {
  const account =
    getSelectedAccount();

  if (!account) {
    showError(
      'Select an Instagram account first.'
    );

    return;
  }

  const button =
    document.getElementById(
      'oldest-button'
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      'Loading…';
  }

  try {
    const result =
      await api(
        `/api/batch/random?accountId=${encodeURIComponent(
          account.id
        )}&limit=10`,
        {},
        30000
      );

    if (
      !result?.reels?.length
    ) {
      showToast(
        'There are no more unused Reels.'
      );

      if (button) {
        button.disabled = false;
        button.textContent =
          'Load Oldest Reels';
      }

      return;
    }

    mergeReels(
      result.reels
    );

    saveLocalState();

    showToast(
      `Loaded ${result.reels.length} oldest Reels.`
    );

    render();
  } catch (error) {
    console.error(error);

    showError(
      `Could not load oldest Reels: ${error.message}`
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        'Load Oldest Reels';
    }
  }
}

function openAddAccountModal() {
  const existing =
    document.getElementById(
      'account-modal'
    );

  if (existing) {
    existing.remove();
  }

  const modal =
    document.createElement('div');

  modal.id =
    'account-modal';

  modal.className =
    'modal-overlay';

  modal.innerHTML = `
    <div class="modal">

      <button
        class="modal-close"
        onclick="closeModal()"
      >
        ×
      </button>

      <h2>
        Add Instagram Account
      </h2>

      <p>
        Enter the Instagram username Clipper
        should use for Reel discovery.
      </p>

      <input
        id="account-username"
        type="text"
        placeholder="@username"
        autocomplete="off"
      >

      <button
        class="primary"
        onclick="createAccount()"
        id="create-account-button"
      >
        Add Account
      </button>

    </div>
  `;

  document.body.appendChild(
    modal
  );

  setTimeout(() => {
    document
      .getElementById(
        'account-username'
      )
      ?.focus();
  }, 50);
}

function closeModal() {
  document
    .getElementById(
      'account-modal'
    )
    ?.remove();
}

async function createAccount() {
  const input =
    document.getElementById(
      'account-username'
    );

  const button =
    document.getElementById(
      'create-account-button'
    );

  const username =
    String(
      input?.value || ''
    )
      .trim()
      .replace(/^@/, '');

  if (!username) {
    showError(
      'Enter an Instagram username.'
    );

    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent =
      'Adding…';
  }

  try {
    const account =
      await api(
        '/api/accounts',
        {
          method: 'POST',
          body: JSON.stringify({
            username
          })
        },
        30000
      );

    if (!account?.id) {
      throw new Error(
        'The backend did not return an account.'
      );
    }

    state.accounts.push(
      account
    );

    state.settings.selectedAccountId =
      account.id;

    saveLocalState();

    closeModal();

    showToast(
      'Instagram account added.'
    );

    render();
  } catch (error) {
    console.error(error);

    showError(
      `Could not add account: ${error.message}`
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        'Add Account';
    }
  }
}

async function deleteAccount(
  accountId
) {
  const account =
    state.accounts.find(
      (item) => item.id === accountId
    );

  if (!account) {
    return;
  }

  const confirmed =
    window.confirm(
      `Delete @${account.username} and its stored Reels?`
    );

  if (!confirmed) {
    return;
  }

  try {
    await api(
      `/api/accounts/${encodeURIComponent(
        accountId
      )}`,
      {
        method: 'DELETE'
      },
      30000
    );

    state.accounts =
      state.accounts.filter(
        (item) =>
          item.id !== accountId
      );

    state.reels =
      state.reels.filter(
        (reel) =>
          reel.accountId !==
          accountId
      );

    if (
      state.settings.selectedAccountId ===
      accountId
    ) {
      state.settings.selectedAccountId =
        state.accounts[0]?.id ||
        null;
    }

    delete state.settings.selectedReelId;

    saveLocalState();

    showToast(
      'Instagram account deleted.'
    );

    render();
  } catch (error) {
    console.error(error);

    showError(
      `Could not delete account: ${error.message}`
    );
  }
}

function renderAccounts() {
  return `
    <section class="card">

      <div class="section-header">

        <div>
          <h2>Instagram Accounts</h2>
          <p>
            Manage the profiles Clipper uses
            for Reel discovery.
          </p>
        </div>

        <button
          class="primary"
          onclick="openAddAccountModal()"
        >
          + Add Account
        </button>

      </div>

      ${
        state.accounts.length
          ? `
            <div class="accounts-list">

              ${state.accounts
                .map(
                  (account) => `
                    <div class="account-row">

                      <div>
                        <strong>
                          @${escapeHtml(
                            account.username
                          )}
                        </strong>

                        <span>
                          ${
                            state.reels.filter(
                              (reel) =>
                                reel.accountId ===
                                account.id
                            ).length
                          } Reels
                        </span>
                      </div>

                      <div class="button-row">

                        <button
                          onclick="selectAccount('${account.id}')"
                        >
                          ${
                            state.settings
                              .selectedAccountId ===
                            account.id
                              ? 'Selected'
                              : 'Select'
                          }
                        </button>

                        <button
                          class="danger"
                          onclick="deleteAccount('${account.id}')"
                        >
                          Delete
                        </button>

                      </div>

                    </div>
                  `
                )
                .join('')}

            </div>
          `
          : `
            <div class="empty-state">
              <p>
                No Instagram accounts added yet.
              </p>
            </div>
          `
      }

    </section>
  `;
}

function selectAccount(
  accountId
) {
  state.settings.selectedAccountId =
    accountId;

  delete state.settings.selectedReelId;

  saveLocalState();
  setTab('home');
}

function renderBatches() {
  return `
    <section class="card">

      <h2>Batches</h2>

      <p class="muted">
        Reel batches generated by Clipper.
      </p>

      ${
        state.batches.length
          ? `
            <div class="batch-list">

              ${state.batches
                .map(
                  (batch) => `
                    <div class="batch-row">

                      <strong>
                        Batch
                        ${escapeHtml(
                          batch.id.slice(
                            0,
                            8
                          )
                        )}
                      </strong>

                      <span>
                        ${
                          batch.reelIds
                            ?.length || 0
                        } Reels
                      </span>

                      <span>
                        ${formatDate(
                          batch.createdAt
                        )}
                      </span>

                    </div>
                  `
                )
                .join('')}

            </div>
          `
          : `
            <div class="empty-state">
              <p>
                No batches yet.
              </p>
            </div>
          `
      }

    </section>
  `;
}

function renderSettings() {
  return `
    <section class="card">

      <h2>Settings</h2>

      <div class="settings-grid">

        <div class="setting-row">
          <strong>Backend</strong>
          <span>
            ${escapeHtml(API)}
          </span>
        </div>

        <div class="setting-row">
          <strong>Version</strong>
          <span>
            Clipper V1.5
          </span>
        </div>

        <div class="setting-row">
          <strong>Storage</strong>
          <span>
            Browser + backend
          </span>
        </div>

      </div>

    </section>
  `;
}

window.setTab =
  setTab;

window.openAddAccountModal =
  openAddAccountModal;

window.closeModal =
  closeModal;

window.createAccount =
  createAccount;

window.deleteAccount =
  deleteAccount;

window.selectAccount =
  selectAccount;

window.selectReel =
  selectReel;

window.clearSelectedReel =
  clearSelectedReel;

window.selectHook =
  selectHook;

window.analyzeReel =
  analyzeReel;

window.renderReel =
  renderReel;

window.syncAccount =
  syncAccount;

window.loadOldestBatch =
  loadOldestBatch;

document.addEventListener(
  'DOMContentLoaded',
  () => {
    loadData();
  }
);
