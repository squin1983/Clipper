const API = 'https://clipper-backend-z71i.onrender.com';

const STORAGE_KEY = 'clipper-state-v5';

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

const app = document.getElementById('app');


/* =========================================================
   LOCAL STATE
========================================================= */

function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return structuredClone(DEFAULT_STATE);
    }

    const parsed = JSON.parse(saved);

    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      accounts: Array.isArray(parsed.accounts)
        ? parsed.accounts
        : [],
      reels: Array.isArray(parsed.reels)
        ? parsed.reels
        : [],
      batches: Array.isArray(parsed.batches)
        ? parsed.batches
        : [],
      settings: {
        ...DEFAULT_STATE.settings,
        ...(parsed.settings || {})
      }
    };

  } catch (error) {
    console.error('Local state error:', error);
    return structuredClone(DEFAULT_STATE);
  }
}


function saveLocalState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error(
      'Could not save local state:',
      error
    );
  }
}


/* =========================================================
   API
========================================================= */

async function api(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `${API}${endpoint}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}


/* =========================================================
   INITIAL LOAD
========================================================= */

async function loadData() {
  showLoading();

  try {

    const [
      accountsResponse,
      reelsResponse,
      batchesResponse
    ] = await Promise.all([

      api('/api/accounts'),

      api('/api/reels?limit=500'),

      api('/api/batches')

    ]);


    /*
     * Backend returns:
     *
     * { accounts: [...] }
     * { reels: [...] }
     * { batches: [...] }
     *
     * We explicitly extract the arrays.
     */

    state.accounts =
      Array.isArray(
        accountsResponse.accounts
      )
        ? accountsResponse.accounts
        : [];


    state.reels =
      Array.isArray(
        reelsResponse.reels
      )
        ? reelsResponse.reels
        : [];


    state.batches =
      Array.isArray(
        batchesResponse.batches
      )
        ? batchesResponse.batches
        : [];


    /*
     * If there is no selected account,
     * automatically select the first one.
     */

    if (
      !state.settings.selectedAccountId &&
      state.accounts.length
    ) {

      state.settings.selectedAccountId =
        state.accounts[0].id;

    }


    /*
     * If selected account no longer exists,
     * select the first available account.
     */

    if (
      state.settings.selectedAccountId &&
      !state.accounts.some(
        account =>
          String(account.id) ===
          String(
            state.settings.selectedAccountId
          )
      )
    ) {

      state.settings.selectedAccountId =
        state.accounts.length
          ? state.accounts[0].id
          : null;

    }


    saveLocalState();

    render();

  } catch (error) {

    console.error(
      'Load data failed:',
      error
    );

    showError(
      `Nepodarilo sa načítať Clipper: ${error.message}`
    );
  }
}


/* =========================================================
   BASIC HELPERS
========================================================= */

function escapeHtml(value) {

  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


function getSelectedAccount() {

  return state.accounts.find(
    account =>
      String(account.id) ===
      String(
        state.settings.selectedAccountId
      )
  ) || null;

}


function getAccountReels(accountId) {

  return state.reels.filter(
    reel =>
      String(reel.accountId) ===
      String(accountId)
  );

}


function formatDate(value) {

  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleDateString(
    'sk-SK',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  );

}


function getReelDate(reel) {

  const values = [
    reel.publishedAt,
    reel.takenAt,
    reel.timestamp,
    reel.createdAt,
    reel.date
  ];

  for (const value of values) {

    if (!value) {
      continue;
    }

    const date =
      new Date(value);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date.getTime();
    }

  }

  return null;
}


function sortOldestFirst(reels) {

  return [...reels].sort(
    (a, b) => {

      const dateA =
        getReelDate(a);

      const dateB =
        getReelDate(b);

      if (
        dateA === null &&
        dateB === null
      ) {
        return 0;
      }

      if (dateA === null) {
        return 1;
      }

      if (dateB === null) {
        return -1;
      }

      return dateA - dateB;

    }
  );

}


/* =========================================================
   RENDER ROOT
========================================================= */

function render() {

  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="clipper-app">

      ${renderHeader()}

      <main class="clipper-main">

        ${
          state.tab === 'home'
            ? renderHome()
            : ''
        }

        ${
          state.tab === 'library'
            ? renderLibrary()
            : ''
        }

        ${
          state.tab === 'settings'
            ? renderSettings()
            : ''
        }

      </main>

      ${renderBottomNav()}

    </div>
  `;

  attachEvents();

}


/* =========================================================
   HEADER
========================================================= */

function renderHeader() {

  const account =
    getSelectedAccount();

  return `
    <header class="clipper-header">

      <div>

        <div class="clipper-logo">
          CLIPPER
        </div>

        <div class="clipper-subtitle">
          Reel remix studio
        </div>

      </div>

      ${
        account
          ? `
            <button
              class="account-pill"
              data-action="select-account"
            >
              <span class="account-dot"></span>
              @${escapeHtml(account.username)}
            </button>
          `
          : ''
      }

    </header>
  `;

}


/* =========================================================
   HOME
========================================================= */

function renderHome() {

  const account =
    getSelectedAccount();


  if (!account) {

    return `
      <section class="empty-state">

        <div class="empty-icon">
          ✦
        </div>

        <h2>Pridaj Instagram účet</h2>

        <p>
          Clipper potrebuje aspoň jeden účet,
          z ktorého bude načítavať Reels.
        </p>

        <button
          class="primary-button"
          data-action="add-account"
        >
          + Add Instagram
        </button>

      </section>
    `;

  }


  const reels =
    getAccountReels(
      account.id
    );


  const unused =
    reels.filter(
      reel => !reel.used
    );


  const oldest =
    sortOldestFirst(
      unused
    ).slice(0, 10);


  return `

    <section class="hero-section">

      <div class="eyebrow">
        ${escapeHtml(
          categoryLabel(
            account.category
          )
        )}
      </div>

      <h1>
        ${escapeHtml(account.name || account.username)}
      </h1>

      <p class="hero-description">
        Vyber starý nepoužitý Reel,
        nech ho analyzovať AI a vytvor finálnu verziu.
      </p>

      <div class="hero-actions">

        <button
          class="primary-button large"
          data-action="sync"
          data-account-id="${account.id}"
        >
          ↻ Sync Instagram
        </button>

        <button
          class="secondary-button large"
          data-action="random"
          data-account-id="${account.id}"
        >
          🎲 Oldest 10
        </button>

      </div>

    </section>


    <section class="stats-grid">

      <div class="stat-card">
        <strong>${reels.length}</strong>
        <span>Total Reels</span>
      </div>

      <div class="stat-card">
        <strong>${unused.length}</strong>
        <span>Unused</span>
      </div>

      <div class="stat-card">
        <strong>${
          reels.filter(
            reel => reel.analyzed
          ).length
        }</strong>
        <span>Analyzed</span>
      </div>

    </section>


    <section class="section">

      <div class="section-heading">

        <div>
          <div class="eyebrow">
            YOUR QUEUE
          </div>

          <h2>
            Oldest unused Reels
          </h2>
        </div>

        <button
          class="text-button"
          data-action="library"
        >
          View all
        </button>

      </div>


      ${
        oldest.length
          ? `
            <div class="reel-grid">
              ${oldest
                .map(
                  reelCard
                )
                .join('')}
            </div>
          `
          : `
            <div class="empty-card">
              <strong>
                Žiadne nepoužité Reels
              </strong>

              <p>
                Spusť Sync Instagram a načítaj ďalšie.
              </p>
            </div>
          `
      }

    </section>

  `;

}


/* =========================================================
   CATEGORY
========================================================= */

function categoryLabel(
  category
) {

  const labels = {
    movie_tv: 'MOVIE / TV',
    music: 'MUSIC',
    meme: 'MEME'
  };

  return (
    labels[category] ||
    String(category || 'CONTENT')
      .toUpperCase()
  );

}


/* =========================================================
   REEL CARD
========================================================= */

function reelCard(
  reel
) {

  const account =
    state.accounts.find(
      item =>
        String(item.id) ===
        String(reel.accountId)
    );


  const analysis =
    reel.analysis || null;


  const hooks =
    analysis &&
    Array.isArray(
      analysis.hooks
    )
      ? analysis.hooks
      : [];


  const selectedHook =
    reel.selectedHook ||
    hooks[0] ||
    '';


  return `

    <article
      class="reel-card"
      data-reel-id="${reel.id}"
    >

      <div class="reel-preview">

        ${
          reel.thumbnailUrl
            ? `
              <img
                src="${escapeHtml(
                  reel.thumbnailUrl
                )}"
                alt=""
                loading="lazy"
              >
            `
            : `
              <div class="thumbnail-placeholder">
                REEL
              </div>
            `
        }

        ${
          reel.used
            ? `
              <div class="status-badge used">
                USED
              </div>
            `
            : ''
        }

      </div>


      <div class="reel-body">

        <div class="reel-meta">

          <span>
            ${formatDate(
              reel.publishedAt
            )}
          </span>

          ${
            account
              ? `
                <span>
                  @${escapeHtml(
                    account.username
                  )}
                </span>
              `
              : ''
          }

        </div>


        ${
          reel.caption
            ? `
              <p class="source-caption">
                ${escapeHtml(
                  reel.caption
                ).slice(0, 180)}
              </p>
            `
            : ''
        }


        <div class="reel-actions">

          <button
            class="secondary-button"
            data-action="analyze"
            data-reel-id="${reel.id}"
          >
            ${
              reel.analyzed
                ? '↻ Re-analyze'
                : '🤖 Analyze Reel'
            }
          </button>

        </div>


        ${
          analysis
            ? renderAnalysis(
                reel,
                hooks,
                selectedHook
              )
            : ''
        }

      </div>

    </article>

  `;

}


/* =========================================================
   AI ANALYSIS
========================================================= */

function renderAnalysis(
  reel,
  hooks,
  selectedHook
) {

  return `

    <div class="ai-panel">

      <div class="ai-heading">
        <span>✦</span>
        AI ANALYSIS
      </div>


      ${
        reel.analysis.summary
          ? `
            <div class="ai-summary">
              <strong>Summary</strong>
              <p>
                ${escapeHtml(
                  reel.analysis.summary
                )}
              </p>
            </div>
          `
          : ''
      }


      ${
        hooks.length
          ? `
            <div class="hooks-section">

              <strong>
                Choose your hook
              </strong>

              <div class="hook-list">

                ${hooks
                  .map(
                    (hook, index) => {

                      if (!hook) {
                        return '';
                      }

                      const selected =
                        hook ===
                        selectedHook;

                      return `

                        <button
                          class="hook-option ${
                            selected
                              ? 'selected'
                              : ''
                          }"
                          data-action="select-hook"
                          data-reel-id="${reel.id}"
                          data-hook="${escapeHtml(
                            hook
                          )}"
                        >

                          <span class="hook-number">
                            ${index + 1}
                          </span>

                          <span>
                            ${escapeHtml(
                              hook
                            )}
                          </span>

                          ${
                            selected
                              ? `
                                <span class="hook-check">
                                  ✓
                                </span>
                              `
                              : ''
                          }

                        </button>

                      `;

                    }
                  )
                  .join('')}

              </div>

            </div>
          `
          : ''
      }


      ${
        reel.aiCaption
          ? `
            <div class="caption-section">

              <div class="caption-heading">
                <strong>
                  Caption
                </strong>

                <button
                  class="small-button"
                  data-action="copy-caption"
                  data-caption="${escapeHtml(
                    reel.aiCaption
                  )}"
                >
                  Copy
                </button>
              </div>

              <div class="caption-box">
                ${escapeHtml(
                  reel.aiCaption
                )}
              </div>

            </div>
          `
          : ''
      }


      <button
        class="render-button"
        data-action="render"
        data-reel-id="${reel.id}"
      >
        🎬 Render Reel
      </button>


      ${
        reel.rendered
          ? `
            <div class="rendered-status">
              ✓ Rendered
            </div>
          `
          : ''
      }

    </div>

  `;

}


/* =========================================================
   LIBRARY
========================================================= */

function renderLibrary() {

  const account =
    getSelectedAccount();


  let reels =
    account
      ? getAccountReels(
          account.id
        )
      : [...state.reels];


  reels =
    sortOldestFirst(
      reels
    );


  return `

    <section class="page-section">

      <div class="page-title">

        <div class="eyebrow">
          LIBRARY
        </div>

        <h1>
          Your Reels
        </h1>

        <p>
          Najstaršie Reels sú hore.
        </p>

      </div>


      <div class="library-toolbar">

        <button
          class="secondary-button"
          data-action="sync"
          data-account-id="${
            account
              ? account.id
              : ''
          }"
        >
          ↻ Sync
        </button>

        <button
          class="secondary-button"
          data-action="filter-unused"
        >
          Unused only
        </button>

      </div>


      ${
        reels.length
          ? `
            <div class="reel-grid">
              ${reels
                .map(
                  reelCard
                )
                .join('')}
            </div>
          `
          : `
            <div class="empty-card">
              Library is empty.
            </div>
          `
      }

    </section>

  `;

}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {

  const account =
    getSelectedAccount();


  return `

    <section class="page-section">

      <div class="page-title">

        <div class="eyebrow">
          SETTINGS
        </div>

        <h1>
          Clipper
        </h1>

        <p>
          Private Reel remix studio.
        </p>

      </div>


      <div class="settings-card">

        <div class="settings-heading">
          Instagram Accounts
        </div>


        <div class="account-list">

          ${
            state.accounts.length
              ? state.accounts
                  .map(
                    renderAccountRow
                  )
                  .join('')
              : `
                <div class="empty-inline">
                  No accounts yet.
                </div>
              `
          }

        </div>


        <button
          class="primary-button"
          data-action="add-account"
        >
          + Add Instagram account
        </button>

      </div>


      <div class="settings-card">

        <div class="settings-heading">
          Backend
        </div>

        <p class="settings-url">
          ${escapeHtml(API)}
        </p>

        <button
          class="secondary-button"
          data-action="test-backend"
        >
          Test connection
        </button>

      </div>


      <div class="settings-card">

        <div class="settings-heading">
          Clipper version
        </div>

        <div class="version-number">
          iPhone-ready V5
        </div>

      </div>

    </section>

  `;

}


/* =========================================================
   ACCOUNT ROW
========================================================= */

function renderAccountRow(
  account
) {

  const selected =
    String(
      account.id
    ) ===
    String(
      state.settings.selectedAccountId
    );


  return `

    <div
      class="account-row ${
        selected
          ? 'selected'
          : ''
      }"
    >

      <button
        class="account-select"
        data-action="choose-account"
        data-account-id="${account.id}"
      >

        <span class="account-avatar">
          ${
            categoryEmoji(
              account.category
            )
          }
        </span>

        <span class="account-info">

          <strong>
            ${escapeHtml(
              account.name ||
              account.username
            )}
          </strong>

          <small>
            @${escapeHtml(
              account.username
            )}
            ·
            ${escapeHtml(
              categoryLabel(
                account.category
              )
            )}
          </small>

        </span>

        ${
          selected
            ? `
              <span class="selected-mark">
                ✓
              </span>
            `
            : ''
        }

      </button>


      <button
        class="delete-account"
        data-action="delete-account"
        data-account-id="${account.id}"
      >
        ×
      </button>

    </div>

  `;

}


function categoryEmoji(
  category
) {

  if (category === 'movie_tv') {
    return '🎬';
  }

  if (category === 'music') {
    return '🎵';
  }

  return '😂';

}


/* =========================================================
   BOTTOM NAV
========================================================= */

function renderBottomNav() {

  return `

    <nav class="bottom-nav">

      <button
        class="nav-item ${
          state.tab === 'home'
            ? 'active'
            : ''
        }"
        data-action="home"
      >
        <span>⌂</span>
        <small>Home</small>
      </button>


      <button
        class="nav-item ${
          state.tab === 'library'
            ? 'active'
            : ''
        }"
        data-action="library"
      >
        <span>▦</span>
        <small>Library</small>
      </button>


      <button
        class="nav-item ${
          state.tab === 'settings'
            ? 'active'
            : ''
        }"
        data-action="settings"
      >
        <span>⚙</span>
        <small>Settings</small>
      </button>

    </nav>

  `;

}


/* =========================================================
   EVENTS
========================================================= */

function attachEvents() {

  document
    .querySelectorAll(
      '[data-action]'
    )
    .forEach(
      element => {

        element.addEventListener(
          'click',
          () =>
            handleAction(
              element.dataset.action,
              element
            )
        );

      }
    );

}


/* =========================================================
   ACTIONS
========================================================= */

async function handleAction(
  action,
  element
) {

  try {

    switch (action) {

      case 'home':

        state.tab = 'home';

        saveLocalState();

        render();

        break;


      case 'library':

        state.tab = 'library';

        saveLocalState();

        render();

        break;


      case 'settings':

        state.tab = 'settings';

        saveLocalState();

        render();

        break;


      case 'select-account':

        openAccountSelector();

        break;


      case 'choose-account':

        chooseAccount(
          element.dataset.accountId
        );

        break;


      case 'add-account':

        openAddAccountModal();

        break;


      case 'delete-account':

        await deleteAccount(
          element.dataset.accountId
        );

        break;


      case 'sync':

        await syncAccount(
          element.dataset.accountId
        );

        break;


      case 'random':

        await loadOldestBatch(
          element.dataset.accountId
        );

        break;


      case 'analyze':

        await analyzeReel(
          element.dataset.reelId
        );

        break;


      case 'select-hook':

        selectHook(
          element.dataset.reelId,
          element.dataset.hook
        );

        break;


      case 'copy-caption':

        await copyText(
          element.dataset.caption
        );

        break;


      case 'render':

        await renderReel(
          element.dataset.reelId
        );

        break;


      case 'test-backend':

        await testBackend();

        break;


      case 'filter-unused':

        filterUnused();

        break;

    }

  } catch (error) {

    console.error(
      'Action failed:',
      error
    );

    showToast(
      error.message ||
      'Something went wrong.'
    );

  }

}


/* =========================================================
   ACCOUNT
========================================================= */

function chooseAccount(
  accountId
) {

  state.settings.selectedAccountId =
    accountId;

  state.tab = 'home';

  saveLocalState();

  render();

}


function openAccountSelector() {

  if (!state.accounts.length) {
    openAddAccountModal();
    return;
  }


  const buttons =
    state.accounts
      .map(
        account => `

          <button
            class="modal-account"
            data-modal-account="${account.id}"
          >

            <span>
              ${categoryEmoji(
                account.category
              )}
            </span>

            <span>

              <strong>
                ${escapeHtml(
                  account.name ||
                  account.username
                )}
              </strong>

              <small>
                @${escapeHtml(
                  account.username
                )}
              </small>

            </span>

          </button>

        `
      )
      .join('');


  showModal(`
    <div class="modal-content">

      <div class="modal-title">
        Choose account
      </div>

      <div class="modal-account-list">
        ${buttons}
      </div>

      <button
        class="text-button"
        data-modal-action="close"
      >
        Cancel
      </button>

    </div>
  `);


  document
    .querySelectorAll(
      '[data-modal-account]'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            chooseAccount(
              button.dataset.modalAccount
            );

            closeModal();

          }
        );

      }
    );

}


function openAddAccountModal() {

  showModal(`

    <div class="modal-content">

      <div class="modal-title">
        Add Instagram account
      </div>

      <p class="modal-description">
        Pridaj účet, z ktorého bude Clipper načítavať Reels.
      </p>


      <label>
        Instagram username
      </label>

      <input
        id="account-username"
        class="modal-input"
        type="text"
        placeholder="@username"
        autocomplete="off"
      />


      <label>
        Name
      </label>

      <input
        id="account-name"
        class="modal-input"
        type="text"
        placeholder="Movie TV"
      />


      <label>
        Category
      </label>

      <select
        id="account-category"
        class="modal-input"
      >
        <option value="movie_tv">
          Movie / TV
        </option>

        <option value="music">
          Music
        </option>

        <option value="meme">
          Meme
        </option>
      </select>


      <div class="modal-actions">

        <button
          class="secondary-button"
          data-modal-action="close"
        >
          Cancel
        </button>

        <button
          class="primary-button"
          data-modal-action="create-account"
        >
          Add account
        </button>

      </div>

    </div>

  `);


  document
    .querySelector(
      '[data-modal-action="create-account"]'
    )
    .addEventListener(
      'click',
      createAccount
    );

}


/* =========================================================
   CREATE ACCOUNT
========================================================= */

async function createAccount() {

  const username =
    document
      .getElementById(
        'account-username'
      )
      .value
      .trim();


  const name =
    document
      .getElementById(
        'account-name'
      )
      .value
      .trim();


  const category =
    document
      .getElementById(
        'account-category'
      )
      .value;


  if (!username) {

    showToast(
      'Zadaj Instagram username.'
    );

    return;

  }


  const response =
    await api(
      '/api/accounts',
      {
        method: 'POST',

        body:
          JSON.stringify({
            username,
            name:
              name ||
              username,
            category
          })
      }
    );


  const account =
    response.account;


  if (!account) {

    throw new Error(
      'Backend nevrátil účet.'
    );

  }


  const existingIndex =
    state.accounts.findIndex(
      item =>
        String(item.id) ===
        String(account.id)
    );


  if (existingIndex >= 0) {

    state.accounts[
      existingIndex
    ] = account;

  } else {

    state.accounts.push(
      account
    );

  }


  state.settings.selectedAccountId =
    account.id;


  state.tab = 'home';


  saveLocalState();

  closeModal();

  render();

  showToast(
    'Instagram účet pridaný.'
  );

}


/* =========================================================
   DELETE ACCOUNT
========================================================= */

async function deleteAccount(
  accountId
) {

  const account =
    state.accounts.find(
      item =>
        String(item.id) ===
        String(accountId)
    );


  if (!account) {
    return;
  }


  const confirmed =
    window.confirm(
      `Naozaj chceš odstrániť @${account.username}?`
    );


  if (!confirmed) {
    return;
  }


  await api(
    `/api/accounts/${encodeURIComponent(
      accountId
    )}`,
    {
      method: 'DELETE'
    }
  );


  state.accounts =
    state.accounts.filter(
      item =>
        String(item.id) !==
        String(accountId)
    );


  state.reels =
    state.reels.filter(
      reel =>
        String(reel.accountId) !==
        String(accountId)
    );


  if (
    String(
      state.settings.selectedAccountId
    ) ===
    String(accountId)
  ) {

    state.settings.selectedAccountId =
      state.accounts.length
        ? state.accounts[0].id
        : null;

  }


  saveLocalState();

  render();

}


/* =========================================================
   SYNC
========================================================= */

async function syncAccount(
  accountId
) {

  if (!accountId) {

    const account =
      getSelectedAccount();

    accountId =
      account
        ? account.id
        : null;

  }


  if (!accountId) {

    showToast(
      'Najprv vyber Instagram účet.'
    );

    return;

  }


  const button =
    document.querySelector(
      `[data-action="sync"][data-account-id="${accountId}"]`
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      '↻ Syncing...';

  }


  try {

    const response =
      await api(
        `/api/accounts/${encodeURIComponent(
          accountId
        )}/sync`,
        {
          method: 'POST'
        }
      );


    showToast(
      `Sync hotový: ${response.added || 0} nových Reels.`
    );


    await loadData();

  } finally {

    if (button) {

      button.disabled = false;

    }

  }

}


/* =========================================================
   OLD REELS
========================================================= */

async function loadOldestBatch(
  accountId
) {

  if (!accountId) {

    const account =
      getSelectedAccount();

    accountId =
      account
        ? account.id
        : null;

  }


  if (!accountId) {

    showToast(
      'Najprv vyber účet.'
    );

    return;

  }


  const response =
    await api(
      `/api/batch/random?accountId=${encodeURIComponent(
        accountId
      )}&limit=10`
    );


  const reels =
    Array.isArray(
      response.reels
    )
      ? response.reels
      : [];


  if (!reels.length) {

    showToast(
      'Nemáš žiadne ďalšie nepoužité Reels.'
    );

    return;

  }


  state.reels =
    mergeReels(
      state.reels,
      reels
    );


  state.tab = 'home';

  saveLocalState();

  render();


  setTimeout(
    () => {

      const first =
        document.querySelector(
          `.reel-card[data-reel-id="${reels[0].id}"]`
        );

      if (first) {

        first.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

      }

    },
    100
  );

}


/* =========================================================
   MERGE REELS
========================================================= */

function mergeReels(
  existing,
  incoming
) {

  const map =
    new Map();


  existing.forEach(
    reel =>
      map.set(
        String(reel.id),
        reel
      )
  );


  incoming.forEach(
    reel =>
      map.set(
        String(reel.id),
        {
          ...(map.get(
            String(reel.id)
          ) || {}),
          ...reel
        }
      )
  );


  return Array.from(
    map.values()
  );

}


/* =========================================================
   ANALYZE
========================================================= */

async function analyzeReel(
  reelId
) {

  const reel =
    state.reels.find(
      item =>
        String(item.id) ===
        String(reelId)
    );


  if (!reel) {

    throw new Error(
      'Reel not found.'
    );

  }


  const button =
    document.querySelector(
      `[data-action="analyze"][data-reel-id="${reelId}"]`
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      '🤖 Analyzing...';

  }


  try {

    const response =
      await api(
        `/api/reels/${encodeURIComponent(
          reelId
        )}/analyze`,
        {
          method: 'POST'
        }
      );


    const updated =
      response.reel;


    if (updated) {

      state.reels =
        mergeReels(
          state.reels,
          [updated]
        );

    }


    saveLocalState();

    render();


    showToast(
      'AI analýza hotová.'
    );

  } finally {

    if (button) {

      button.disabled = false;

    }

  }

}


/* =========================================================
   SELECT HOOK
========================================================= */

function selectHook(
  reelId,
  hook
) {

  const reel =
    state.reels.find(
      item =>
        String(item.id) ===
        String(reelId)
    );


  if (!reel) {
    return;
  }


  reel.selectedHook =
    hook;


  saveLocalState();

  render();

}


/* =========================================================
   RENDER
========================================================= */

async function renderReel(
  reelId
) {

  const reel =
    state.reels.find(
      item =>
        String(item.id) ===
        String(reelId)
    );


  if (!reel) {

    throw new Error(
      'Reel not found.'
    );

  }


  const hook =
    String(
      reel.selectedHook ||
      (
        reel.analysis &&
        reel.analysis.hooks &&
        reel.analysis.hooks[0]
      ) ||
      ''
    ).trim();


  if (!hook) {

    throw new Error(
      'Najprv vyber hook.'
    );

  }


  const account =
    state.accounts.find(
      item =>
        String(item.id) ===
        String(reel.accountId)
    );


  const button =
    document.querySelector(
      `[data-action="render"][data-reel-id="${reelId}"]`
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      '🎬 Rendering...';

  }


  try {

    const response =
      await api(
        `/api/jobs/${encodeURIComponent(
          reelId
        )}/render`,
        {
          method: 'POST',

          body:
            JSON.stringify({

              hook,

              category:
                account
                  ? account.category
                  : 'meme'

            })
        }
      );


    reel.selectedHook =
      hook;

    reel.rendered = true;


    saveLocalState();

    render();


    if (response.previewUrl) {

      const fullUrl =
        `${API}${response.previewUrl}`;


      showModal(`

        <div class="modal-content render-result">

          <div class="modal-title">
            ✓ Reel ready
          </div>

          <video
            class="render-video"
            src="${escapeHtml(
              fullUrl
            )}"
            controls
            playsinline
          ></video>


          <a
            class="primary-button"
            href="${escapeHtml(
              fullUrl
            )}"
            target="_blank"
            rel="noopener"
          >
            Open rendered Reel
          </a>


          ${
            reel.aiCaption
              ? `
                <button
                  class="secondary-button"
                  data-modal-action="copy-result-caption"
                >
                  Copy caption
                </button>
              `
              : ''
          }


          <button
            class="text-button"
            data-modal-action="close"
          >
            Close
          </button>

        </div>

      `);


      const copyButton =
        document.querySelector(
          '[data-modal-action="copy-result-caption"]'
        );


      if (copyButton) {

        copyButton.addEventListener(
          'click',
          () =>
            copyText(
              reel.aiCaption
            )
        );

      }

    }

  } finally {

    if (button) {

      button.disabled = false;

    }

  }

}


/* =========================================================
   FILTER
========================================================= */

function filterUnused() {

  const account =
    getSelectedAccount();


  if (!account) {
    return;
  }


  const reels =
    sortOldestFirst(
      getAccountReels(
        account.id
      ).filter(
        reel => !reel.used
      )
    );


  app.innerHTML = `

    <div class="clipper-app">

      ${renderHeader()}

      <main class="clipper-main">

        <section class="page-section">

          <div class="page-title">

            <div class="eyebrow">
              UNUSED
            </div>

            <h1>
              Unused Reels
            </h1>

          </div>

          <div class="reel-grid">
            ${
              reels.length
                ? reels
                    .map(
                      reelCard
                    )
                    .join('')
                : `
                  <div class="empty-card">
                    No unused Reels.
                  </div>
                `
            }
          </div>

        </section>

      </main>

      ${renderBottomNav()}

    </div>

  `;


  attachEvents();

}


/* =========================================================
   BACKEND TEST
========================================================= */

async function testBackend() {

  showToast(
    'Testing backend...'
  );


  const response =
    await api(
      '/api/health'
    );


  showToast(
    response.ok
      ? `Backend OK · v${response.version}`
      : 'Backend error'
  );

}


/* =========================================================
   COPY
========================================================= */

async function copyText(
  text
) {

  try {

    await navigator.clipboard.writeText(
      text
    );

    showToast(
      'Copied ✓'
    );

  } catch (error) {

    const textarea =
      document.createElement(
        'textarea'
      );

    textarea.value =
      text;

    textarea.style.position =
      'fixed';

    textarea.style.opacity =
      '0';

    document.body.appendChild(
      textarea
    );

    textarea.select();

    document.execCommand(
      'copy'
    );

    textarea.remove();

    showToast(
      'Copied ✓'
    );

  }

}


/* =========================================================
   MODAL
========================================================= */

function showModal(
  html
) {

  closeModal();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'clipper-modal';


  overlay.className =
    'modal-overlay';


  overlay.innerHTML =
    html;


  document.body.appendChild(
    overlay
  );


  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        overlay
      ) {

        closeModal();

      }

    }
  );


  overlay
    .querySelectorAll(
      '[data-modal-action="close"]'
    )
    .forEach(
      button =>
        button.addEventListener(
          'click',
          closeModal
        )
    );

}


function closeModal() {

  const modal =
    document.getElementById(
      'clipper-modal'
    );


  if (modal) {
    modal.remove();
  }

}


/* =========================================================
   LOADING / ERROR
========================================================= */

function showLoading() {

  app.innerHTML = `

    <div class="loading-screen">

      <div class="loading-logo">
        CLIPPER
      </div>

      <div class="loading-spinner"></div>

      <p>
        Loading...
      </p>

    </div>

  `;

}


function showError(
  message
) {

  app.innerHTML = `

    <div class="error-screen">

      <div class="error-icon">
        !
      </div>

      <h2>
        Clipper error
      </h2>

      <p>
        ${escapeHtml(
          message
        )}
      </p>

      <button
        class="primary-button"
        onclick="location.reload()"
      >
        Try again
      </button>

    </div>

  `;

}


function showToast(
  message
) {

  let toast =
    document.getElementById(
      'clipper-toast'
    );


  if (!toast) {

    toast =
      document.createElement(
        'div'
      );

    toast.id =
      'clipper-toast';

    document.body.appendChild(
      toast
    );

  }


  toast.textContent =
    message;


  toast.classList.add(
    'visible'
  );


  clearTimeout(
    window.__clipperToast
  );


  window.__clipperToast =
    setTimeout(
      () => {

        toast.classList.remove(
          'visible'
        );

      },
      3000
    );

}


/* =========================================================
   START
========================================================= */

loadData();
