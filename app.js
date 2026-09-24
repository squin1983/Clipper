const API = 'https://clipper-backend-z71i.onrender.com';

const STORAGE_KEY = 'clipper-state-v16';

const DEFAULT_STATE = {
  accounts: [],
  reels: [],
  batches: [],
  settings: {
    selectedAccountId: null,
    selectedReelId: null
  },
  tab: 'home',
  reelView: 'oldest'
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

async function restoreReelToBackend(reel) {
  if (!reel?.id) {
    throw new Error('Reel ID is missing.');
  }

  const account = state.accounts.find(
    (item) => item.id === reel.accountId
  );

  if (!account) {
    throw new Error('Instagram account for this Reel is missing.');
  }

  const result = await api(
    '/api/reels/restore',
    {
      method: 'POST',
      body: JSON.stringify({
        account,
        reel
      })
    },
    30000
  );

  if (result?.reel) {
    mergeReels([result.reel]);
  }

  return result?.reel || reel;
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
        error:
          text ||
          'Invalid server response.'
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
    if (
      error.name ===
      'AbortError'
    ) {
      throw new Error(
        'Request timed out. The backend took too long to respond.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   DATA
========================================================= */

async function loadData() {
  try {
    const [
      accounts,
      reels,
      batches
    ] = await Promise.all([
      api(
        '/api/accounts',
        {},
        30000
      ),

      api(
        '/api/reels?limit=5000',
        {},
        30000
      ),

      api(
        '/api/batches',
        {},
        30000
      )
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
        state.accounts[0]?.id ||
        null;
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

function getAccountReels() {
  const account =
    getSelectedAccount();

  if (!account) {
    return [];
  }

  return state.reels.filter(
    (reel) =>
      reel.accountId ===
      account.id
  );
}

function getUnusedReels() {
  return getAccountReels().filter(
    (reel) =>
      !reel.used &&
      !reel.rendered
  );
}

function sortOldestFirst(reels) {
  return [...reels].sort(
    (a, b) => {
      const dateA =
        a.publishedAt
          ? new Date(
              a.publishedAt
            ).getTime()
          : 0;

      const dateB =
        b.publishedAt
          ? new Date(
              b.publishedAt
            ).getTime()
          : 0;

      return dateA - dateB;
    }
  );
}

function sortNewestFirst(reels) {
  return [...reels].sort(
    (a, b) => {
      const dateA =
        a.publishedAt
          ? new Date(
              a.publishedAt
            ).getTime()
          : 0;

      const dateB =
        b.publishedAt
          ? new Date(
              b.publishedAt
            ).getTime()
          : 0;

      return dateB - dateA;
    }
  );
}

function mergeReels(newReels) {
  const map = new Map(
    state.reels.map(
      (reel) => [
        reel.id,
        reel
      ]
    )
  );

  for (
    const reel of newReels || []
  ) {
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

  state.reels =
    Array.from(
      map.values()
    );
}

/* =========================================================
   MAIN RENDER
========================================================= */

function render() {
  const root =
    document.getElementById(
      'app'
    );

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
          V1.6
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

/* =========================================================
   HOME
========================================================= */

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

          <h2>
            @${escapeHtml(
              account.username
            )}
          </h2>

          <p>
            ${
              getAccountReels().length
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
            onclick="showOldestReels()"
            id="oldest-button"
          >
            Load Oldest Reels
          </button>

          <button
            onclick="showNewestReels()"
          >
            Show Newest
          </button>

        </div>

      </div>

    </section>

    ${
      selectedReel
        ? renderReelEditor(
            selectedReel
          )
        : renderReelList(
            unused
          )
    }
  `;
}

/* =========================================================
   REEL LIST
========================================================= */

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

  let ordered;

  if (
    state.reelView ===
    'newest'
  ) {
    ordered =
      sortNewestFirst(
        reels
      );
  } else {
    ordered =
      sortOldestFirst(
        reels
      );
  }

  const visible =
    ordered.slice(
      0,
      20
    );

  return `
    <section class="card">

      <div class="section-header">

        <div>

          <h2>
            ${
              state.reelView ===
              'newest'
                ? 'Newest Reels'
                : 'Oldest Reels'
            }
          </h2>

          <p>
            Select a Reel to analyze it with AI.
          </p>

        </div>

        <div class="status">
          ${
            reels.length
          } unused
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
                      reel.caption
                        ? escapeHtml(
                            reel.caption.slice(
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
              Showing 20 of
              ${reels.length}
              unused Reels.
            </p>
          `
          : ''
      }

    </section>
  `;
}

function showOldestReels() {
  state.reelView =
    'oldest';

  delete state.settings.selectedReelId;

  saveLocalState();

  render();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function showNewestReels() {
  state.reelView =
    'newest';

  delete state.settings.selectedReelId;

  saveLocalState();

  render();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function selectReel(reelId) {
  state.settings.selectedReelId =
    reelId;

  saveLocalState();

  render();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/* =========================================================
   AI ANALYSIS
========================================================= */

function normalizeAnalysis(
  analysis
) {
  if (!analysis) {
    return {};
  }

  const normalized = {
    ...analysis
  };

  /*
   * Backend V1.7 returns:
   *
   * hook
   * hookAlternatives
   *
   * Frontend uses:
   *
   * hooks
   */

  const hooks = [];

  if (
    analysis.hook &&
    String(
      analysis.hook
    ).trim()
  ) {
    hooks.push(
      String(
        analysis.hook
      ).trim()
    );
  }

  if (
    Array.isArray(
      analysis.hookAlternatives
    )
  ) {
    for (
      const hook of
      analysis.hookAlternatives
    ) {
      if (
        hook &&
        String(
          hook
        ).trim()
      ) {
        hooks.push(
          String(
            hook
          ).trim()
        );
      }
    }
  }

  /*
   * Also support an older backend
   * that might already return hooks.
   */

  if (
    !hooks.length &&
    Array.isArray(
      analysis.hooks
    )
  ) {
    normalized.hooks =
      analysis.hooks.filter(
        Boolean
      );
  } else {
    normalized.hooks =
      hooks;
  }

  return normalized;
}

function renderAnalysisFields(
  analysis
) {
  const fields = [];

  if (
    analysis.onScreenText
  ) {
    fields.push(`
      <div class="analysis-box">

        <strong>
          On-screen Text
        </strong>

        <p>
          ${escapeHtml(
            analysis.onScreenText
          )}
        </p>

      </div>
    `);
  }

  if (
    analysis.caption
  ) {
    fields.push(`
      <div class="analysis-box">

        <strong>
          Caption
        </strong>

        <p>
          ${escapeHtml(
            analysis.caption
          )}
        </p>

      </div>
    `);
  }

  if (
    Array.isArray(
      analysis.hashtags
    ) &&
    analysis.hashtags.length
  ) {
    fields.push(`
      <div class="analysis-box">

        <strong>
          Hashtags
        </strong>

        <p class="hashtags">
          ${analysis.hashtags
            .map(
              (tag) =>
                escapeHtml(
                  tag
                )
            )
            .join(' ')}
        </p>

      </div>
    `);
  }

  if (
    analysis.tone
  ) {
    fields.push(`
      <div class="analysis-box">

        <strong>
          Tone
        </strong>

        <p>
          ${escapeHtml(
            analysis.tone
          )}
        </p>

      </div>
    `);
  }

  if (
    Array.isArray(
      analysis.topics
    ) &&
    analysis.topics.length
  ) {
    fields.push(`
      <div class="analysis-box">

        <strong>
          Topics
        </strong>

        <p>
          ${analysis.topics
            .map(
              (topic) =>
                escapeHtml(
                  topic
                )
            )
            .join(', ')}
        </p>

      </div>
    `);
  }

  if (!fields.length) {
    return '';
  }

  return `
    <div class="analysis-details">
      ${fields.join('')}
    </div>
  `;
}

/* =========================================================
   REEL EDITOR
========================================================= */

function renderReelEditor(reel) {
  const analysis =
    normalizeAnalysis(
      reel.analysis
    );

  const hooks =
    Array.isArray(
      analysis.hooks
    )
      ? analysis.hooks.filter(
          Boolean
        )
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
            reel.analysis
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
        reel.caption
          ? `
            <div class="original-caption">

              <h3>
                Original Caption
              </h3>

              <p>
                ${escapeHtml(
                  reel.caption
                )}
              </p>

            </div>
          `
          : ''
      }

      <div class="analysis-section">

        <div class="analysis-header">

          <h3>
            AI Analysis
          </h3>

          <button
            class="primary"
            id="analyze-button"
            onclick="analyzeReel('${reel.id}')"
          >
            🤖 ${
              reel.analysis
                ? 'Analyze Again'
                : 'Analyze with AI'
            }
          </button>

        </div>

        ${
          analysis.summary
            ? `
              <div class="summary-box">

                <strong>
                  Summary
                </strong>

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

        ${renderAnalysisFields(
          analysis
        )}

        ${
          hooks.length
            ? `
              <div class="hooks-section">

                <h3>
                  Choose a Hook
                </h3>

                <p class="muted">
                  Select the hook you want Clipper
                  to place on the Reel.
                </p>

                <div class="hooks-list">

                  ${hooks
                    .map(
                      (
                        hook,
                        index
                      ) => `
                        <button
                          class="hook-option ${
                            selectedHook ===
                            hook
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

                ${
                  reel.render?.status ===
                  'processing'
                    ? `
                      <div class="muted">
                        Rendering…
                      </div>
                    `
                    : ''
                }

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

async function selectHook(
  reelId,
  index
) {
  const reel =
    state.reels.find(
      (item) =>
        item.id ===
        reelId
    );

  if (!reel) {
    return;
  }

  const analysis =
    normalizeAnalysis(
      reel.analysis
    );

  const hooks =
    analysis.hooks || [];

  if (!hooks[index]) {
    return;
  }

  reel.selectedHook =
    hooks[index];

  await restoreReelToBackend(reel);

  /*
   * Save hook to backend too.
   */

  try {
    await api(
      `/api/reels/${encodeURIComponent(
        reelId
      )}/hook`,
      {
        method: 'POST',
        body: JSON.stringify({
          hook:
            reel.selectedHook
        })
      },
      30000
    );
  } catch (error) {
    console.error(
      'Hook save failed:',
      error
    );

    showError(
      `Could not save hook: ${error.message}`
    );

    return;
  }

  saveLocalState();

  render();
}

/* =========================================================
   ANALYZE
========================================================= */

async function analyzeReel(
  reelId
) {
  const button =
    document.getElementById(
      'analyze-button'
    );

  if (button) {
    button.disabled =
      true;

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
        180000
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
      button.disabled =
        false;

      button.textContent =
        '🤖 Analyze with AI';
    }
  }
}

/* =========================================================
   RENDER
========================================================= */

async function renderReel(
  reelId
) {
  const reel =
    state.reels.find(
      (item) =>
        item.id ===
        reelId
    );

  if (!reel) {
    return;
  }

  const analysis =
    normalizeAnalysis(
      reel.analysis
    );

  const hook =
    reel.selectedHook ||
    analysis.hooks?.[0] ||
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
    button.disabled =
      true;

    button.textContent =
      '🎬 Starting render…';
  }

  try {
    await restoreReelToBackend(reel);

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
        60000
      );

    if (
      !result?.job?.id
    ) {
      throw new Error(
        'Backend did not return a render job.'
      );
    }

    const jobId =
      result.job.id;

    showToast(
      'Render started. Clipper is processing the Reel…'
    );

    if (button) {
      button.textContent =
        '🎬 Rendering…';
    }

    const completedJob =
      await waitForRenderJob(
        jobId
      );

    if (
      completedJob.status !==
      'completed'
    ) {
      throw new Error(
        completedJob.error ||
          'Render failed.'
      );
    }

    reel.used =
      true;

    reel.rendered =
      true;

    reel.renderedAt =
      new Date().toISOString();

    reel.render = {
      ...(reel.render || {}),
      jobId,
      status:
        'completed',
      outputUrl:
        `/api/jobs/${encodeURIComponent(
          jobId
        )}/file`
    };

    saveLocalState();

    const downloadUrl =
      `${API}/api/jobs/${encodeURIComponent(
        jobId
      )}/file`;

    render();

    setTimeout(() => {
      showRenderSuccess(
        downloadUrl
      );
    }, 50);

  } catch (error) {
    console.error(error);

    showError(
      `Render failed: ${error.message}`
    );

    if (button) {
      button.disabled =
        false;

      button.textContent =
        '🎬 Render Reel';
    }
  }
}

/* =========================================================
   RENDER JOB POLLING
========================================================= */

async function waitForRenderJob(
  jobId
) {
  const MAX_WAIT =
    10 * 60 * 1000;

  const POLL_INTERVAL =
    3000;

  const started =
    Date.now();

  while (
    Date.now() -
      started <
    MAX_WAIT
  ) {
    const result =
      await api(
        `/api/jobs/${encodeURIComponent(
          jobId
        )}`,
        {},
        30000
      );

    const job =
      result?.job;

    if (!job) {
      throw new Error(
        'Render job was not found.'
      );
    }

    if (
      job.status ===
      'completed'
    ) {
      return job;
    }

    if (
      job.status ===
      'failed'
    ) {
      throw new Error(
        job.error ||
          'Render failed.'
      );
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          POLL_INTERVAL
        )
    );
  }

  throw new Error(
    'Render is taking too long. Check the job again later.'
  );
}

/* =========================================================
   RENDER SUCCESS
========================================================= */

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
    document.createElement(
      'div'
    );

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
      href="${escapeHtml(
        downloadUrl
      )}"
      target="_blank"
      rel="noopener"
    >
      ⬇ Download Reel
    </a>
  `;

  document
    .querySelector(
      '.clipper-content'
    )
    ?.prepend(
      section
    );

  showToast(
    'Render complete.'
  );
}

/* =========================================================
   SYNC INSTAGRAM
========================================================= */

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
    button.disabled =
      true;

    button.textContent =
      '↻ Syncing Instagram…';
  }

  showToast(
    'Instagram sync started. This can take several minutes.'
  );

  try {
    const result =
      await api(
        `/api/accounts/${encodeURIComponent(
          account.id
        )}/sync`,
        {
          method: 'POST'
        },
        1200000
      );

    const reels =
      await api(
        '/api/reels?limit=5000',
        {},
        30000
      );

    mergeReels(
      reels
    );

    saveLocalState();

    showToast(
      `Sync complete: ${
        result.added || 0
      } new Reels added. Total loaded: ${
        getAccountReels().length
      }.`
    );

    render();

  } catch (error) {
    console.error(error);

    showError(
      `Instagram sync failed: ${error.message}`
    );

    if (button) {
      button.disabled =
        false;

      button.textContent =
        '↻ Sync Instagram';
    }
  }
}

/* =========================================================
   ACCOUNT MODAL
========================================================= */

function openAddAccountModal() {
  const existing =
    document.getElementById(
      'account-modal'
    );

  if (existing) {
    existing.remove();
  }

  const modal =
    document.createElement(
      'div'
    );

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

      <label style="display:block;margin-top:14px;">
        Content Style
      </label>

      <select
        id="account-style"
        style="width:100%;margin-top:6px;"
      >
        <option value="movie_tv">Movie / TV</option>
        <option value="music">Music</option>
      </select>

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
      .replace(
        /^@/,
        ''
      );

  if (!username) {
    showError(
      'Enter an Instagram username.'
    );

    return;
  }

  if (button) {
    button.disabled =
      true;

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
            username,
            styleProfile:
              document.getElementById('account-style')?.value ||
              'movie_tv'
          })
        },
        30000
      );

    if (!account?.id) {
      throw new Error(
        'The backend did not return an account.'
      );
    }

    /*
     * Avoid duplicates in local state.
     */

    const existing =
      state.accounts.find(
        (item) =>
          item.id ===
          account.id
      );

    if (!existing) {
      state.accounts.push(
        account
      );
    }

    state.settings.selectedAccountId =
      account.id;

    delete state.settings.selectedReelId;

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
      button.disabled =
        false;

      button.textContent =
        'Add Account';
    }
  }
}

/* =========================================================
   DELETE ACCOUNT
========================================================= */

async function deleteAccount(
  accountId
) {
  const account =
    state.accounts.find(
      (item) =>
        item.id ===
        accountId
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
          item.id !==
          accountId
      );

    state.reels =
      state.reels.filter(
        (reel) =>
          reel.accountId !==
          accountId
      );

    if (
      state.settings
        .selectedAccountId ===
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

/* =========================================================
   ACCOUNTS
========================================================= */

function renderAccounts() {
  return `
    <section class="card">

      <div class="section-header">

        <div>

          <h2>
            Instagram Accounts
          </h2>

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
                  (
                    account
                  ) => `
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
                          } Reels · ${
                            account.styleProfile === 'music'
                              ? 'Music'
                              : 'Movie / TV'
                          }
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

  state.reelView =
    'oldest';

  saveLocalState();

  setTab('home');
}

/* =========================================================
   BATCHES
========================================================= */

function renderBatches() {
  return `
    <section class="card">

      <h2>
        Batches
      </h2>

      <p class="muted">
        Reel batches generated by Clipper.
      </p>

      ${
        state.batches.length
          ? `
            <div class="batch-list">

              ${state.batches
                .map(
                  (
                    batch
                  ) => `
                    <div class="batch-row">

                      <strong>
                        Batch
                        ${escapeHtml(
                          String(
                            batch.id ||
                              ''
                          ).slice(
                            0,
                            8
                          )
                        )}
                      </strong>

                      <span>
                        ${
                          batch.reelIds
                            ?.length ||
                          0
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

/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {
  return `
    <section class="card">

      <h2>
        Settings
      </h2>

      <div class="settings-grid">

        <div class="setting-row">

          <strong>
            Backend
          </strong>

          <span>
            ${escapeHtml(
              API
            )}
          </span>

        </div>

        <div class="setting-row">

          <strong>
            Frontend
          </strong>

          <span>
            Clipper V1.6
          </span>

        </div>

        <div class="setting-row">

          <strong>
            AI
          </strong>

          <span>
            OpenRouter
          </span>

        </div>

        <div class="setting-row">

          <strong>
            Reel discovery
          </strong>

          <span>
            Oldest / Newest
          </span>

        </div>

        <div class="setting-row">

          <strong>
            Storage
          </strong>

          <span>
            Browser + backend
          </span>

        </div>

      </div>

    </section>
  `;
}

/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

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

window.showOldestReels =
  showOldestReels;

window.showNewestReels =
  showNewestReels;

/* =========================================================
   START
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {
    loadData();
  }
);
