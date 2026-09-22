const API = 'https://clipper-backend-z71i.onrender.com';
const KEY = 'clipper-state-v4';

const state = JSON.parse(localStorage.getItem(KEY) || 'null') || {
  accounts: [],
  clips: [],
  batches: [],
  settings: {
    style: 'Relatable',
    position: 'Top',
    font: 'Bold'
  },
  tab: 'home'
};

let busy = false;

function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      `Backend error ${response.status}`
    );
  }

  return data;
}

async function loadData() {
  try {
    const [
      accounts,
      reels,
      batches
    ] = await Promise.all([
      api('/api/accounts'),
      api('/api/reels'),
      api('/api/batches')
    ]);

    state.accounts = accounts || [];
    state.clips = reels || [];
    state.batches = batches || [];

    saveState();
  } catch (error) {
    console.error('Load data failed:', error);
  }
}

function appRoot() {
  return document.getElementById('app');
}

function accountName(accountId) {
  const account = state.accounts.find(
    item => item.id === accountId
  );

  return account
    ? '@' + account.username
    : 'Unknown account';
}

function categoryLabel(category) {
  const labels = {
    meme: '😂 Meme',
    movie_tv: '🎬 Movie / TV',
    music: '🎵 Music'
  };

  return labels[category] || category;
}

function categoryIcon(category) {
  const icons = {
    meme: '😂',
    movie_tv: '🎬',
    music: '🎵'
  };

  return icons[category] || '📹';
}

function showError(message) {
  alert(message);
}

function showSuccess(message) {
  alert(message);
}


/* =========================
   HOME
========================= */

function home(v) {
  const totalClips = state.clips.length;
  const totalAccounts = state.accounts.length;

  const latestBatch =
    state.batches.length
      ? state.batches[0]
      : null;

  v.innerHTML = `
    <div class="page">

      <div class="topbar">
        <div>
          <div class="brand">Clipper</div>
          <div class="muted">
            ${totalClips} clips · ${totalAccounts} sources
          </div>
        </div>

        <button
          class="icon-button"
          id="openSettings"
          title="Settings"
        >
          ⚙
        </button>
      </div>

      <section class="hero-card">
        <div class="eyebrow">
          CREATOR WORKFLOW
        </div>

        <h1>
          Find the next Reel worth remixing.
        </h1>

        <p>
          Pull fresh inspiration, analyze the actual video,
          choose a hook and render it.
        </p>

        <button
          class="primary large"
          id="random10"
          ${busy ? 'disabled' : ''}
        >
          🎲 RANDOM 10
        </button>
      </section>


      <section class="section">

        <div class="section-head">
          <div>
            <h2>Inspiration accounts</h2>
            <p>
              Instagram accounts used for Reel inspiration.
            </p>
          </div>

          <button
            class="secondary"
            id="addAccount"
          >
            + Add
          </button>
        </div>

        <div class="accounts">
          ${
            state.accounts.length
              ? state.accounts.map(account => `
                <div class="account-card">

                  <div class="account-icon">
                    ${categoryIcon(account.category)}
                  </div>

                  <div class="account-info">
                    <strong>
                      @${escapeHtml(account.username)}
                    </strong>

                    <span>
                      ${categoryLabel(account.category)}
                    </span>

                    ${
                      account.lastSync
                        ? `<small>
                            Last sync:
                            ${new Date(account.lastSync).toLocaleString()}
                          </small>`
                        : ''
                    }
                  </div>

                  <button
                    class="secondary small sync-one"
                    data-id="${account.id}"
                  >
                    Sync
                  </button>

                </div>
              `).join('')
              : `
                <div class="empty-card">
                  <div class="empty-icon">📡</div>
                  <strong>No inspiration accounts yet.</strong>
                  <p>
                    Add an Instagram account to start collecting Reels.
                  </p>
                </div>
              `
          }
        </div>

        ${
          state.accounts.length
            ? `
              <button
                class="secondary full"
                id="syncAll"
              >
                🔄 Sync all Instagram accounts
              </button>
            `
            : ''
        }

      </section>


      ${
        latestBatch
          ? `
            <section class="section">

              <div class="section-head">
                <div>
                  <h2>Latest batch</h2>
                  <p>
                    ${latestBatch.reelIds?.length || 0} Reels
                  </p>
                </div>
              </div>

              <div id="latestBatch"></div>

            </section>
          `
          : ''
      }

    </div>

    <nav class="bottom-nav">
      <button
        class="${state.tab === 'home' ? 'active' : ''}"
        data-tab="home"
      >
        <span>⌂</span>
        Home
      </button>

      <button
        class="${state.tab === 'library' ? 'active' : ''}"
        data-tab="library"
      >
        <span>▣</span>
        Library
      </button>

      <button
        class="${state.tab === 'settings' ? 'active' : ''}"
        data-tab="settings"
      >
        <span>⚙</span>
        Settings
      </button>
    </nav>
  `;

  document
    .getElementById('openSettings')
    ?.addEventListener(
      'click',
      () => {
        state.tab = 'settings';
        saveState();
        render();
      }
    );

  document
    .getElementById('random10')
    ?.addEventListener(
      'click',
      runRandom
    );

  document
    .getElementById('addAccount')
    ?.addEventListener(
      'click',
      addAccountModal
    );

  document
    .getElementById('syncAll')
    ?.addEventListener(
      'click',
      syncAll
    );

  document
    .querySelectorAll('.sync-one')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => syncInstagramAccount(
          button.dataset.id
        )
      );
    });

  document
    .querySelectorAll('[data-tab]')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          state.tab =
            button.dataset.tab;

          saveState();
          render();
        }
      );
    });

  if (latestBatch) {
    renderLatestBatch(
      latestBatch.id
    );
  }
}


/* =========================
   ACCOUNT MODAL
========================= */

function addAccountModal() {
  const modal = document.createElement('div');

  modal.className = 'modal-backdrop';

  modal.innerHTML = `
    <div class="modal">

      <div class="modal-head">
        <h2>Add inspiration account</h2>

        <button
          class="close-modal"
        >
          ×
        </button>
      </div>

      <label>
        Instagram username
      </label>

      <input
        id="accountUsername"
        placeholder="@username"
        autocomplete="off"
      />

      <label>
        Account type
      </label>

      <select id="accountCategory">
        <option value="movie_tv">
          🎬 Movie / TV
        </option>

        <option value="music">
          🎵 Music
        </option>

        <option value="meme">
          😂 Meme
        </option>
      </select>

      <div class="modal-actions">

        <button
          class="secondary close-modal"
        >
          Cancel
        </button>

        <button
          class="primary"
          id="saveAccount"
        >
          Add account
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelectorAll('.close-modal')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => modal.remove()
      );
    });

  modal
    .querySelector('#saveAccount')
    .addEventListener(
      'click',
      async () => {

        const username =
          modal
            .querySelector('#accountUsername')
            .value
            .trim();

        const category =
          modal
            .querySelector('#accountCategory')
            .value;

        if (!username) {
          alert(
            'Please enter an Instagram username.'
          );
          return;
        }

        const button =
          modal.querySelector(
            '#saveAccount'
          );

        button.disabled = true;
        button.textContent = 'Adding...';

        try {
          const account =
            await api(
              '/api/accounts',
              {
                method: 'POST',
                body: JSON.stringify({
                  username,
                  category
                })
              }
            );

          state.accounts =
            state.accounts.filter(
              item =>
                item.id !== account.id
            );

          state.accounts.push(account);

          saveState();

          modal.remove();

          render();

        } catch (error) {
          button.disabled = false;
          button.textContent = 'Add account';

          showError(
            error.message
          );
        }
      }
    );
}


/* =========================
   SYNC
========================= */

async function syncInstagramAccount(
  accountId
) {
  if (busy) return;

  const account =
    state.accounts.find(
      item =>
        item.id === accountId
    );

  if (!account) return;

  busy = true;
  render();

  try {
    await api(
      `/api/accounts/${accountId}/sync`,
      {
        method: 'POST'
      }
    );

    await loadData();

    showSuccess(
      `Instagram sync complete for @${account.username}.`
    );

  } catch (error) {
    showError(
      `Sync failed:\n\n${error.message}`
    );

  } finally {
    busy = false;
    render();
  }
}

async function syncAll() {
  if (busy) return;

  if (!state.accounts.length) {
    showError(
      'Add an Instagram account first.'
    );
    return;
  }

  busy = true;
  render();

  let success = 0;
  let failed = 0;

  try {
    for (
      const account of state.accounts
    ) {
      try {
        await api(
          `/api/accounts/${account.id}/sync`,
          {
            method: 'POST'
          }
        );

        success++;

      } catch (error) {
        console.error(
          `Sync failed for ${account.username}`,
          error
        );

        failed++;
      }
    }

    await loadData();

    alert(
      `Sync complete.\n\nSuccessful: ${success}\nFailed: ${failed}`
    );

  } finally {
    busy = false;
    render();
  }
}


/* =========================
   RANDOM BATCH
========================= */

async function runRandom() {
  if (busy) return;

  if (!state.clips.length) {
    showError(
      'There are no Reels yet. Add an Instagram account and sync it first.'
    );
    return;
  }

  busy = true;
  render();

  try {
    const result =
      await api(
        '/api/batch/random',
        {
          method: 'POST',
          body: JSON.stringify({
            count: 10
          })
        }
      );

    if (
      result.batch
    ) {
      state.batches.unshift(
        result.batch
      );
    }

    await loadData();

    state.tab = 'home';

  } catch (error) {
    showError(
      `Could not create batch:\n\n${error.message}`
    );

  } finally {
    busy = false;
    saveState();
    render();
  }
}


/* =========================
   BATCH
========================= */

async function renderLatestBatch(
  batchId
) {
  const container =
    document.getElementById(
      'latestBatch'
    );

  if (!container) return;

  container.innerHTML = `
    <div class="loading-card">
      Loading Reels...
    </div>
  `;

  try {
    const data =
      await api(
        `/api/batches/${batchId}`
      );

    container.innerHTML =
      data.reels
        .map(reel =>
          reelCard(reel)
        )
        .join('');

    attachReelEvents(
      container
    );

  } catch (error) {
    container.innerHTML = `
      <div class="error-card">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}


/* =========================
   REEL CARD
========================= */

function reelCard(reel) {
  const analysis =
    reel.aiAnalysis || null;

  const selectedHook =
    reel.selectedHook ||
    '';

  return `
    <article
      class="reel-card"
      data-reel-id="${reel.id}"
    >

      <div class="reel-media">

        ${
          reel.previewUrl
            ? `
              <img
                src="${escapeHtml(reel.previewUrl)}"
                alt=""
                loading="lazy"
              >
            `
            : `
              <div class="media-placeholder">
                📹
              </div>
            `
        }

        ${
          reel.permalink
            ? `
              <a
                href="${escapeHtml(reel.permalink)}"
                target="_blank"
                rel="noopener"
                class="instagram-link"
              >
                Instagram ↗
              </a>
            `
            : ''
        }

      </div>


      <div class="reel-body">

        <div class="reel-meta">
          <span>
            ${escapeHtml(
              accountName(reel.accountId)
            )}
          </span>

          ${
            reel.used
              ? `<span class="used-badge">USED</span>`
              : ''
          }
        </div>


        ${
          reel.caption
            ? `
              <div class="source-caption">
                ${escapeHtml(
                  reel.caption
                )}
              </div>
            `
            : ''
        }


        ${
          analysis
            ? `
              <div class="ai-result">

                <div class="ai-title">
                  🤖 AI Analysis
                </div>

                ${
                  analysis.summary
                    ? `
                      <div class="ai-summary">
                        <strong>What happens:</strong>
                        ${escapeHtml(
                          analysis.summary
                        )}
                      </div>
                    `
                    : ''
                }

                ${
                  analysis.hooks?.length
                    ? `
                      <div class="hooks-title">
                        Choose a hook
                      </div>

                      <div class="hooks-list">

                        ${analysis.hooks
                          .map(
                            (hook, index) => `
                              <button
                                class="hook-option ${
                                  selectedHook === hook
                                    ? 'selected'
                                    : ''
                                }"
                                data-hook="${escapeHtml(hook)}"
                              >
                                <span>
                                  ${index + 1}.
                                </span>

                                <strong>
                                  ${escapeHtml(hook)}
                                </strong>
                              </button>
                            `
                          )
                          .join('')}

                      </div>
                    `
                    : ''
                }


                ${
                  analysis.caption
                    ? `
                      <div class="ai-caption">
                        <div class="hooks-title">
                          Caption
                        </div>

                        <div class="caption-box">
                          ${escapeHtml(
                            analysis.caption
                          )}
                        </div>

                        <button
                          class="secondary small copy-ai-caption"
                        >
                          Copy caption
                        </button>
                      </div>
                    `
                    : ''
                }

              </div>
            `
            : ''
        }


        <div class="reel-actions">

          <button
            class="primary analyze-reel"
            data-id="${reel.id}"
            ${busy ? 'disabled' : ''}
          >
            🤖 ${
              analysis
                ? 'Analyze again'
                : 'Analyze Reel'
            }
          </button>

          ${
            selectedHook
              ? `
                <button
                  class="secondary render-reel"
                  data-id="${reel.id}"
                >
                  🎬 Render
                </button>
              `
              : ''
          }

        </div>


        ${
          reel.renderedUrl
            ? `
              <a
                href="${escapeHtml(
                  reel.renderedUrl
                )}"
                target="_blank"
                rel="noopener"
                class="rendered-link"
              >
                ▶ Open rendered Reel
              </a>
            `
            : ''
        }

      </div>

    </article>
  `;
}


/* =========================
   REEL EVENTS
========================= */

function attachReelEvents(
  container
) {
  container
    .querySelectorAll('.analyze-reel')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          analyzeReel(
            button.dataset.id
          )
      );
    });


  container
    .querySelectorAll('.hook-option')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const card =
            button.closest(
              '.reel-card'
            );

          const reelId =
            card.dataset.reelId;

          selectHook(
            reelId,
            button.dataset.hook
          );
        }
      );
    });


  container
    .querySelectorAll('.copy-ai-caption')
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const card =
            button.closest(
              '.reel-card'
            );

          const reel =
            state.clips.find(
              item =>
                item.id ===
                card.dataset.reelId
            );

          const caption =
            reel?.aiAnalysis?.caption;

          if (!caption) return;

          try {
            await navigator.clipboard.writeText(
              caption
            );

            button.textContent =
              'Copied ✓';

            setTimeout(
              () => {
                button.textContent =
                  'Copy caption';
              },
              1200
            );

          } catch {
            alert(
              caption
            );
          }
        }
      );
    });


  container
    .querySelectorAll('.render-reel')
    .forEach(button => {

      button.addEventListener(
        'click',
        () =>
          renderReel(
            button.dataset.id
          )
      );
    });
}


/* =========================
   AI ANALYSIS
========================= */

async function analyzeReel(
  reelId
) {
  if (busy) return;

  const reel =
    state.clips.find(
      item =>
        item.id === reelId
    );

  if (!reel) {
    showError(
      'Reel not found.'
    );
    return;
  }

  busy = true;

  const card =
    document.querySelector(
      `.reel-card[data-reel-id="${reelId}"]`
    );

  if (card) {
    const button =
      card.querySelector(
        '.analyze-reel'
      );

    if (button) {
      button.disabled = true;
      button.textContent =
        '🤖 Analyzing video...';
    }
  }

  try {
    const result =
      await api(
        `/api/reels/${reelId}/analyze`,
        {
          method: 'POST'
        }
      );

    reel.aiAnalysis =
      result.analysis;

    reel.selectedHook =
      result.analysis?.hooks?.[0] || '';

    saveState();

    await refreshLatestBatch();

  } catch (error) {
    showError(
      `AI analysis failed:\n\n${error.message}`
    );

    await refreshLatestBatch();

  } finally {
    busy = false;
  }
}


/* =========================
   SELECT HOOK
========================= */

function selectHook(
  reelId,
  hook
) {
  const reel =
    state.clips.find(
      item =>
        item.id === reelId
    );

  if (!reel) return;

  reel.selectedHook =
    hook;

  saveState();

  const card =
    document.querySelector(
      `.reel-card[data-reel-id="${reelId}"]`
    );

  if (!card) return;

  card
    .querySelectorAll('.hook-option')
    .forEach(button => {

      button.classList.toggle(
        'selected',
        button.dataset.hook === hook
      );
    });


  const existingRender =
    card.querySelector(
      '.render-reel'
    );

  if (!existingRender) {

    const actions =
      card.querySelector(
        '.reel-actions'
      );

    if (actions) {

      const button =
        document.createElement(
          'button'
        );

      button.className =
        'secondary render-reel';

      button.dataset.id =
        reelId;

      button.textContent =
        '🎬 Render';

      button.addEventListener(
        'click',
        () =>
          renderReel(
            reelId
          )
      );

      actions.appendChild(
        button
      );
    }
  }
}


/* =========================
   RENDER REEL
========================= */

async function renderReel(
  reelId
) {
  if (busy) return;

  const reel =
    state.clips.find(
      item =>
        item.id === reelId
    );

  if (!reel) return;

  const hook =
    reel.selectedHook ||
    reel.aiAnalysis?.hooks?.[0] ||
    '';

  if (!hook) {
    showError(
      'Select a hook first.'
    );
    return;
  }

  busy = true;

  try {
    const jobId =
      crypto.randomUUID();

    const result =
      await api(
        `/api/jobs/${jobId}/render`,
        {
          method: 'POST',
          body: JSON.stringify({
            reelId,
            hook
          })
        }
      );

    if (
      result.job
    ) {
      reel.jobId =
        result.job.id;

      reel.renderedUrl =
        API +
        result.job.outputUrl;

      reel.renderStatus =
        result.job.status;
    }

    reel.used =
      true;

    saveState();

    await loadData();

    const loadedReel =
      state.clips.find(
        item =>
          item.id === reelId
      );

    if (loadedReel) {
      loadedReel.aiAnalysis =
        reel.aiAnalysis;

      loadedReel.selectedHook =
        reel.selectedHook;

      loadedReel.renderedUrl =
        reel.renderedUrl;

      loadedReel.renderStatus =
        reel.renderStatus;

      saveState();
    }

    alert(
      'Reel rendered successfully.'
    );

    await refreshLatestBatch();

  } catch (error) {
    showError(
      `Render failed:\n\n${error.message}`
    );

  } finally {
    busy = false;
  }
}


/* =========================
   REFRESH BATCH
========================= */

async function refreshLatestBatch() {
  const batch =
    state.batches[0];

  if (!batch) {
    render();
    return;
  }

  const container =
    document.getElementById(
      'latestBatch'
    );

  if (!container) {
    render();
    return;
  }

  try {
    const data =
      await api(
        `/api/batches/${batch.id}`
      );

    data.reels.forEach(
      updatedReel => {

        const existing =
          state.clips.find(
            item =>
              item.id ===
              updatedReel.id
          );

        if (existing) {
          Object.assign(
            existing,
            updatedReel
          );
        }
      }
    );

    saveState();

    container.innerHTML =
      data.reels
        .map(
          reel =>
            reelCard(reel)
        )
        .join('');

    attachReelEvents(
      container
    );

  } catch (error) {
    console.error(
      'Refresh batch failed:',
      error
    );
  }
}


/* =========================
   LIBRARY
========================= */

function library(v) {
  const rendered =
    state.clips.filter(
      reel =>
        reel.renderedUrl
    );

  v.innerHTML = `
    <div class="page">

      <div class="topbar">
        <div>
          <div class="brand">Library</div>
          <div class="muted">
            ${rendered.length} rendered clips
          </div>
        </div>
      </div>


      ${
        rendered.length
          ? `
            <div class="library-grid">

              ${rendered
                .map(
                  reel => `
                    <article class="library-card">

                      ${
                        reel.previewUrl
                          ? `
                            <img
                              src="${escapeHtml(
                                reel.previewUrl
                              )}"
                              alt=""
                            >
                          `
                          : ''
                      }

                      <div class="library-content">

                        <div class="reel-meta">
                          ${escapeHtml(
                            accountName(
                              reel.accountId
                            )
                          )}
                        </div>

                        ${
                          reel.selectedHook
                            ? `
                              <strong>
                                ${escapeHtml(
                                  reel.selectedHook
                                )}
                              </strong>
                            `
                            : ''
                        }

                        <a
                          class="primary small"
                          href="${escapeHtml(
                            reel.renderedUrl
                          )}"
                          target="_blank"
                          rel="noopener"
                        >
                          ▶ Open video
                        </a>

                      </div>

                    </article>
                  `
                )
                .join('')}

            </div>
          `
          : `
            <div class="empty-card">

              <div class="empty-icon">
                🎬
              </div>

              <strong>
                Nothing rendered yet.
              </strong>

              <p>
                Analyze a Reel, choose a hook and render it.
              </p>

            </div>
          `
      }

    </div>

    ${bottomNav()}
  `;
}


/* =========================
   SETTINGS
========================= */

function settings(v) {
  v.innerHTML = `
    <div class="page">

      <div class="topbar">
        <div>
          <div class="brand">Settings</div>
          <div class="muted">
            Make it yours.
          </div>
        </div>
      </div>


      <section class="settings-card">

        <h2>Hook style</h2>

        <select id="style">

          <option
            value="Relatable"
            ${
              state.settings.style ===
              'Relatable'
                ? 'selected'
                : ''
            }
          >
            Relatable
          </option>

          <option
            value="Gen Z"
            ${
              state.settings.style ===
              'Gen Z'
                ? 'selected'
                : ''
            }
          >
            Gen Z
          </option>

          <option
            value="Curiosity"
            ${
              state.settings.style ===
              'Curiosity'
                ? 'selected'
                : ''
            }
          >
            Curiosity
          </option>

          <option
            value="Controversial"
            ${
              state.settings.style ===
              'Controversial'
                ? 'selected'
                : ''
            }
          >
            Controversial
          </option>

        </select>


        <h2>Text position</h2>

        <select id="position">

          <option
            value="Top"
            ${
              state.settings.position ===
              'Top'
                ? 'selected'
                : ''
            }
          >
            Top
          </option>

          <option
            value="Center"
            ${
              state.settings.position ===
              'Center'
                ? 'selected'
                : ''
            }
          >
            Center
          </option>

          <option
            value="Bottom"
            ${
              state.settings.position ===
              'Bottom'
                ? 'selected'
                : ''
            }
          >
            Bottom
          </option>

        </select>


        <h2>Font</h2>

        <select id="font">

          <option
            value="Bold"
            ${
              state.settings.font ===
              'Bold'
                ? 'selected'
                : ''
            }
          >
            Bold
          </option>

          <option
            value="Clean"
            ${
              state.settings.font ===
              'Clean'
                ? 'selected'
                : ''
            }
          >
            Clean
          </option>

        </select>


        <div class="connection-note">
          <strong>
            Apify
          </strong>

          is connected through the secure backend.
          Your Apify token is never stored in this browser.
        </div>


        <button
          class="secondary full"
          id="testBackend"
        >
          Test backend connection
        </button>


        <button
          class="secondary danger full"
          id="clear"
        >
          Reset all local data
        </button>

      </section>

    </div>

    ${bottomNav()}
  `;


  document
    .getElementById('style')
    ?.addEventListener(
      'change',
      event => {

        state.settings.style =
          event.target.value;

        saveState();
      }
    );


  document
    .getElementById('position')
    ?.addEventListener(
      'change',
      event => {

        state.settings.position =
          event.target.value;

        saveState();
      }
    );


  document
    .getElementById('font')
    ?.addEventListener(
      'change',
      event => {

        state.settings.font =
          event.target.value;

        saveState();
      }
    );


  document
    .getElementById('testBackend')
    ?.addEventListener(
      'click',
      async () => {

        const button =
          document.getElementById(
            'testBackend'
          );

        button.disabled = true;
        button.textContent =
          'Testing...';

        try {

          const result =
            await api(
              '/api/health'
            );

          alert(
            `Backend OK — version ${result.version}`
          );

        } catch (error) {

          alert(
            `Backend connection failed:\n\n${error.message}`
          );

        } finally {

          button.disabled = false;
          button.textContent =
            'Test backend connection';
        }
      }
    );


  document
    .getElementById('clear')
    ?.addEventListener(
      'click',
      () => {

        const confirmed =
          confirm(
            'Reset local Clipper data?'
          );

        if (!confirmed) return;

        localStorage.removeItem(
          KEY
        );

        location.reload();
      }
    );


  document
    .querySelectorAll('[data-tab]')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          state.tab =
            button.dataset.tab;

          saveState();

          render();
        }
      );
    });
}


/* =========================
   BOTTOM NAV
========================= */

function bottomNav() {
  return `
    <nav class="bottom-nav">

      <button
        class="${
          state.tab === 'home'
            ? 'active'
            : ''
        }"
        data-tab="home"
      >
        <span>⌂</span>
        Home
      </button>

      <button
        class="${
          state.tab === 'library'
            ? 'active'
            : ''
        }"
        data-tab="library"
      >
        <span>▣</span>
        Library
      </button>

      <button
        class="${
          state.tab === 'settings'
            ? 'active'
            : ''
        }"
        data-tab="settings"
      >
        <span>⚙</span>
        Settings
      </button>

    </nav>
  `;
}


/* =========================
   RENDER APP
========================= */

function render() {
  const root =
    appRoot();

  if (!root) return;

  if (state.tab === 'library') {
    library(root);
    return;
  }

  if (state.tab === 'settings') {
    settings(root);
    return;
  }

  home(root);
}


/* =========================
   START
========================= */

(async function init() {

  render();

  await loadData();

  render();

})();
