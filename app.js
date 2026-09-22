const API = 'https://clipper-backend-z71i.onrender.com';
const KEY = 'clipper-state-v4';

const state = JSON.parse(
  localStorage.getItem(KEY) || 'null'
) || {
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


/* =========================
   STORAGE
========================= */

function save() {
  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  );
}


/* =========================
   HELPERS
========================= */

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m])
  );
}


async function api(path, options = {}) {
  const response = await fetch(
    API + path,
    {
      ...options,
      headers: {
        'Content-Type':
          'application/json',
        ...(options.headers || {})
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}


function toast(message) {
  const d =
    document.createElement('div');

  d.className = 'toast';
  d.textContent = message;

  document.body.appendChild(d);

  setTimeout(
    () => d.remove(),
    3000
  );
}


/* =========================
   APP
========================= */

function app() {
  document.querySelector('#app')
    .innerHTML = `
      <main class="shell">

        <div class="top">

          <div class="brand">
            Clipper
          </div>

          <div
            class="pill"
            id="counter"
          >
            Connecting…
          </div>

        </div>

        <div id="view"></div>

      </main>

      <nav class="nav">

        <div class="navin">

          <button data-tab="home">
            ⚡<br>Remix
          </button>

          <button data-tab="library">
            ▣<br>Library
          </button>

          <button data-tab="settings">
            ⚙<br>Settings
          </button>

        </div>

      </nav>
    `;

  document
    .querySelectorAll('[data-tab]')
    .forEach(button => {

      button.onclick = () => {

        state.tab =
          button.dataset.tab;

        save();
        render();
        loadData();

      };

    });

  render();
  loadData();
}


/* =========================
   LOAD DATA
========================= */

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

    state.accounts =
      accounts;

    state.clips =
      reels.map(reel => {

        const existing =
          state.clips.find(
            c => c.id === reel.id
          );

        return {

          id: reel.id,

          name:
            reel.caption
              ? reel.caption.slice(
                  0,
                  70
                )
              : 'Instagram Reel',

          source:
            '@' + reel.username,

          sourceId:
            reel.sourceId,

          videoUrl:
            reel.videoUrl,

          permalink:
            reel.permalink,

          preview:
            reel.previewUrl || '',

          caption:
            reel.caption || '',

          used:
            reel.used,

          reserved:
            reel.reserved,

          ready:
            existing?.ready || false,

          status:
            existing?.status ||
            (
              reel.used
                ? 'used'
                : reel.reserved
                  ? 'reserved'
                  : 'unused'
            ),

          hook:
            existing?.hook || '',

          hookOptions:
            existing?.hookOptions || [],

          summary:
            existing?.summary || '',

          outputUrl:
            existing?.outputUrl || null,

          error:
            existing?.error || null,

          batch:
            existing?.batch || null,

          jobId:
            existing?.jobId || null

        };

      });


    /* =========================
       RESTORE JOB DATA
    ========================= */

    batches.forEach(item => {

      const batch =
        item.batch;

      const jobs =
        item.jobs || [];

      const batchReels =
        item.reels || [];


      jobs.forEach(job => {

        const reel =
          batchReels.find(
            r =>
              r.id === job.reelId
          );

        const clip =
          state.clips.find(
            c =>
              c.id === job.reelId
          );

        if (!clip) return;


        clip.batch =
          batch.id;

        clip.jobId =
          job.id;

        clip.hook =
          job.hook ||
          clip.hook ||
          '';

        clip.caption =
          job.caption ||
          reel?.caption ||
          clip.caption ||
          '';

        clip.status =
          job.status;

        clip.ready =
          job.status === 'ready';

        clip.outputUrl =
          job.outputUrl ||
          clip.outputUrl ||
          null;

        clip.error =
          job.error ||
          null;

      });

    });


    save();


    const counter =
      document.querySelector(
        '#counter'
      );

    if (counter) {

      counter.textContent =
        `${state.clips.length} clips · ${state.accounts.length} sources`;

    }


    render();


  } catch (error) {

    console.error(error);

    const counter =
      document.querySelector(
        '#counter'
      );

    if (counter) {
      counter.textContent =
        'Backend offline';
    }

    toast(
      `Backend: ${error.message}`
    );

  }

}


/* =========================
   MAIN RENDER
========================= */

function render() {

  document
    .querySelectorAll(
      '.nav button'
    )
    .forEach(button => {

      button.classList.toggle(
        'active',
        button.dataset.tab ===
          state.tab
      );

    });


  const view =
    document.querySelector(
      '#view'
    );

  if (!view) return;


  if (
    state.tab === 'home'
  ) {
    home(view);
  }


  if (
    state.tab === 'library'
  ) {
    library(view);
  }


  if (
    state.tab === 'settings'
  ) {
    settings(view);
  }

}


/* =========================
   HOME
========================= */

function home(v) {

  const unused =
    state.clips.filter(
      c =>
        !c.used &&
        !c.reserved
    ).length;


  const ready =
    state.clips.filter(
      c => c.ready
    ).length;


  v.innerHTML = `

    <section class="hero">

      <div class="eyebrow">
        Creator clipping engine
      </div>

      <h1>
        10 clips.<br>
        One tap.
      </h1>

      <p>
        Pull inspiration Reels through the secure
        backend, create a remix batch and generate
        content-aware hooks.
      </p>

      <button
        class="primary"
        id="random"
      >
        RANDOM 10
      </button>


      <div
        class="row"
        style="margin-top:10px"
      >

        <button
          class="secondary"
          style="flex:1"
          id="add"
        >
          ＋ Inspiration account
        </button>


        <button
          class="secondary"
          style="flex:1"
          id="sync"
        >
          ↻ Sync Instagram
        </button>

      </div>

    </section>


    <div class="grid">

      <div class="card">

        <div class="muted">
          Unused
        </div>

        <div class="stat">
          ${unused}
        </div>

      </div>


      <div class="card">

        <div class="muted">
          Ready
        </div>

        <div class="stat">
          ${ready}
        </div>

      </div>

    </div>


    <section class="section">

      <h2>
        Inspiration pool
      </h2>

      ${
        state.accounts.length

          ? state.accounts
              .map(account => `

                <div class="account">

                  <div class="avatar">

                    ${esc(
                      account.username
                        .slice(0, 1)
                        .toUpperCase()
                    )}

                  </div>


                  <div>

                    <div class="name">
                      @${esc(
                        account.username
                      )}
                    </div>

                    <div class="handle">
                      ${esc(
                        account.category || ''
                      )}
                    </div>

                  </div>


                  <div class="spacer"></div>


                  <span class="tag">
                    ${
                      account.active
                        ? 'ON'
                        : 'OFF'
                    }
                  </span>

                </div>

              `)
              .join('')

          : `

            <div class="empty">
              Add an Instagram inspiration account to begin.
            </div>

          `
      }

    </section>


    <section class="section">

      <h2>
        Latest batch
      </h2>

      <div id="batch">
        ${renderBatch()}
      </div>

    </section>

  `;


  document.querySelector(
    '#add'
  ).onclick =
    accountSheet;


  document.querySelector(
    '#sync'
  ).onclick =
    syncAll;


  document.querySelector(
    '#random'
  ).onclick =
    runRandom;

}


/* =========================
   BATCH
========================= */

function renderBatch() {

  const clips =
    state.clips
      .filter(
        c => c.batch
      )
      .slice(-10)
      .reverse();


  if (!clips.length) {

    return `
      <div class="empty">
        No batch yet. Sync an account first,
        then tap RANDOM 10.
      </div>
    `;

  }


  return clips.map(c => `

    <div class="clip">

      ${
        c.preview

          ? `
            <img
              class="thumb"
              src="${esc(c.preview)}"
              loading="lazy"
            >
          `

          : `
            <div class="thumb"></div>
          `
      }


      <div>

        <span class="tag">
          ${statusLabel(c.status)}
        </span>


        <h3>
          ${esc(c.name)}
        </h3>


        <div class="muted">
          ${esc(c.source || '')}
        </div>


        ${
          c.summary

            ? `
              <div
                style="
                  margin-top:10px;
                  padding:11px;
                  border-radius:12px;
                  background:rgba(255,255,255,.05);
                  font-size:13px;
                  line-height:1.45;
                "
              >

                <div
                  class="muted"
                  style="
                    font-size:11px;
                    text-transform:uppercase;
                    letter-spacing:.08em;
                    margin-bottom:4px;
                  "
                >
                  AI analysis
                </div>

                ${esc(c.summary)}

              </div>
            `

            : ''
        }


        ${
          Array.isArray(
            c.hookOptions
          ) &&
          c.hookOptions.length

            ? `

              <div
                style="
                  margin-top:11px;
                "
              >

                <div
                  class="muted"
                  style="
                    font-size:11px;
                    text-transform:uppercase;
                    letter-spacing:.08em;
                    margin-bottom:7px;
                  "
                >
                  Choose your hook
                </div>


                ${c.hookOptions
                  .map(
                    (hook, index) => `

                      <button
                        class="secondary"
                        data-hook-id="${esc(c.id)}"
                        data-hook-index="${index}"
                        style="
                          display:block;
                          width:100%;
                          text-align:left;
                          margin-top:6px;
                          ${
                            c.hook === hook
                              ? 'border:1px solid rgba(255,255,255,.6);'
                              : ''
                          }
                        "
                      >

                        ${index + 1}.
                        ${esc(hook)}

                      </button>

                    `
                  )
                  .join('')}

              </div>

            `

            : ''
        }


        ${
          c.hook

            ? `
              <div
                class="hook"
                style="
                  margin-top:10px;
                "
              >
                ${esc(c.hook)}
              </div>
            `

            : ''
        }


        ${
          c.caption

            ? `
              <div
                class="muted"
                style="
                  margin-top:8px;
                  white-space:pre-line;
                "
              >
                ${esc(c.caption)}
              </div>
            `

            : ''
        }


        ${
          c.videoUrl

            ? `
              <a
                class="secondary"
                style="
                  display:inline-block;
                  margin-top:8px;
                  text-decoration:none;
                "
                href="${esc(c.videoUrl)}"
                target="_blank"
                rel="noopener"
              >
                Open source Reel
              </a>
            `

            : ''
        }


        <div
          class="row"
          style="margin-top:8px"
        >

          <button
            class="secondary"
            data-remix="${esc(c.id)}"
          >
            ${
              c.status === 'analyzing'
                ? 'Analyzing…'
                : 'AI Analyze & Remix'
            }
          </button>


          ${
            c.caption

              ? `
                <button
                  class="secondary"
                  data-copy="${esc(c.id)}"
                >
                  Copy caption
                </button>
              `

              : ''
          }


          ${
            c.jobId &&
            c.hook &&
            c.status !== 'ready' &&
            c.status !== 'rendering'

              ? `
                <button
                  class="primary"
                  data-render="${esc(c.jobId)}"
                >
                  Render
                </button>
              `

              : ''
          }

        </div>


        ${
          c.status === 'analyzing'

            ? `
              <div
                class="muted"
                style="
                  margin-top:8px;
                  font-size:12px;
                "
              >
                AI is watching the Reel and creating
                hooks based on the actual content…
              </div>
            `

            : ''
        }


        ${
          c.outputUrl

            ? `
              <a
                class="secondary"
                style="
                  display:inline-block;
                  margin-top:8px;
                  text-decoration:none;
                "
                href="${API}${esc(c.outputUrl)}"
                target="_blank"
                rel="noopener"
              >
                ↗ Open rendered video
              </a>
            `

            : ''
        }


        ${
          c.error

            ? `
              <div
                style="
                  margin-top:8px;
                  color:#ff7777;
                  font-size:12px;
                "
              >
                ${esc(c.error)}
              </div>
            `

            : ''
        }

      </div>

    </div>

  `).join('');

}


/* =========================
   STATUS
========================= */

function statusLabel(status) {

  const labels = {

    selected:
      'QUEUED',

    queued:
      'QUEUED',

    analyzing:
      'ANALYZING',

    rendering:
      'RENDERING',

    ready:
      'READY',

    error:
      'ERROR',

    used:
      'USED',

    reserved:
      'RESERVED',

    unused:
      'UNUSED'

  };


  return (
    labels[status] ||
    String(
      status ||
      'RAW'
    ).toUpperCase()
  );

}


/* =========================
   LIBRARY
========================= */

function library(v) {

  v.innerHTML = `

    <section class="hero">

      <div class="eyebrow">
        Library
      </div>

      <h1>
        ${state.clips.length} clips
      </h1>

      <p>
        Your synced Instagram Reels live here.
        Used clips are not selected again.
      </p>

    </section>


    <section class="section">

      ${
        state.clips.length

          ? state.clips
              .slice()
              .reverse()
              .map(c => `

                <div class="clip">

                  ${
                    c.preview

                      ? `
                        <img
                          class="thumb"
                          src="${esc(c.preview)}"
                          loading="lazy"
                        >
                      `

                      : `
                        <div class="thumb"></div>
                      `
                  }


                  <div>

                    <span class="tag">
                      ${statusLabel(c.status)}
                    </span>


                    <h3>
                      ${esc(c.name)}
                    </h3>


                    <div class="muted">
                      ${esc(c.source || '')}
                    </div>


                    ${
                      c.summary

                        ? `
                          <div
                            style="
                              margin-top:9px;
                              font-size:13px;
                              line-height:1.45;
                            "
                          >
                            ${esc(c.summary)}
                          </div>
                        `

                        : ''
                    }


                    ${
                      c.hook

                        ? `
                          <div
                            class="hook"
                            style="margin-top:9px"
                          >
                            ${esc(c.hook)}
                          </div>
                        `

                        : ''
                    }


                    ${
                      c.caption

                        ? `
                          <div
                            class="muted"
                            style="
                              margin-top:7px;
                              white-space:pre-line;
                            "
                          >
                            ${esc(c.caption)}
                          </div>
                        `

                        : ''
                    }


                    ${
                      c.videoUrl

                        ? `
                          <a
                            class="secondary"
                            style="
                              display:inline-block;
                              margin-top:8px;
                              text-decoration:none;
                            "
                            href="${esc(c.videoUrl)}"
                            target="_blank"
                            rel="noopener"
                          >
                            Open Reel
                          </a>
                        `

                        : ''
                    }

                  </div>

                </div>

              `)
              .join('')

          : `

            <div class="empty">
              Sync an Instagram account to build your library.
            </div>

          `
      }

    </section>

  `;

}


/* =========================
   SETTINGS
========================= */

function settings(v) {

  v.innerHTML = `

    <section class="hero">

      <div class="eyebrow">
        Settings
      </div>

      <h1>
        Make it yours.
      </h1>

      <p>
        These settings control the AI remix engine.
      </p>

    </section>


    <section class="card">

      <label class="muted">
        Hook style
      </label>


      <select
        class="input"
        id="style"
        style="margin-top:7px"
      >

        ${[
          'Relatable',
          'Chaotic',
          'Savage',
          'Dry',
          'Curiosity',
          'Identity'
        ]
          .map(x => `

            <option
              value="${esc(x)}"
              ${
                state.settings.style === x
                  ? 'selected'
                  : ''
              }
            >
              ${esc(x)}
            </option>

          `)
          .join('')}

      </select>


      <label
        class="muted"
        style="
          display:block;
          margin-top:15px;
        "
      >
        Text position
      </label>


      <select
        class="input"
        id="position"
        style="margin-top:7px"
      >

        ${[
          'Top',
          'Center',
          'Bottom'
        ]
          .map(x => `

            <option
              value="${esc(x)}"
              ${
                state.settings.position === x
                  ? 'selected'
                  : ''
              }
            >
              ${esc(x)}
            </option>

          `)
          .join('')}

      </select>


      <label
        class="muted"
        style="
          display:block;
          margin-top:15px;
        "
      >
        Font
      </label>


      <select
        class="input"
        id="font"
        style="margin-top:7px"
      >

        ${[
          'Bold',
          'Clean',
          'Meme'
        ]
          .map(x => `

            <option
              value="${esc(x)}"
              ${
                state.settings.font === x
                  ? 'selected'
                  : ''
              }
            >
              ${esc(x)}
            </option>

          `)
          .join('')}

      </select>


      <div
        class="muted"
        style="
          font-size:12px;
          margin-top:18px;
        "
      >
        Apify is connected through the secure Clipper
        backend. Your Apify token is never stored
        in this browser.
      </div>


      <button
        class="secondary"
        style="
          width:100%;
          margin-top:18px;
        "
        id="testBackend"
      >
        Test backend connection
      </button>


      <button
        class="secondary danger"
        style="
          width:100%;
          margin-top:10px;
        "
        id="clear"
      >
        Reset all local data
      </button>

    </section>

  `;


  [
    'style',
    'position',
    'font'
  ].forEach(id => {

    const element =
      document.querySelector(
        '#' + id
      );

    if (element) {

      element.onchange =
        e => {

          state.settings[id] =
            e.target.value;

          save();

        };

    }

  });


  document.querySelector(
    '#testBackend'
  ).onclick =
    async () => {

      toast(
        'Testing backend…'
      );

      try {

        const result =
          await api(
            '/api/health'
          );

        toast(
          `Backend OK — version ${result.version}`
        );

      } catch (error) {

        toast(
          `Backend error: ${error.message}`
        );

      }

    };


  document.querySelector(
    '#clear'
  ).onclick =
    () => {

      if (
        confirm(
          'Reset all local Clipper data?'
        )
      ) {

        localStorage.removeItem(
          KEY
        );

        location.reload();

      }

    };

}


/* =========================
   ACCOUNT SHEET
========================= */

function accountSheet() {

  document.body.insertAdjacentHTML(
    'beforeend',
    `

      <div
        class="sheet"
        id="sheet"
      >

        <div class="modal">

          <h2>
            Add Instagram inspiration
          </h2>


          <p class="muted">
            Enter a public Instagram username.
            Clipper will load its Reels through
            the secure backend.
          </p>


          <input
            class="input"
            id="handle"
            placeholder="@account"
            autocomplete="off"
          >


          <select
            class="input"
            id="category"
            style="margin-top:9px"
          >

            <option value="meme">
              Meme
            </option>

            <option value="movie_tv">
              Movie / TV
            </option>

            <option value="music">
              Music
            </option>

          </select>


          <div
            class="row"
            style="margin-top:12px"
          >

            <button
              class="secondary"
              id="cancel"
              style="flex:1"
            >
              Cancel
            </button>


            <button
              class="primary"
              id="saveAccount"
              style="flex:1"
            >
              Add & Sync
            </button>

          </div>

        </div>

      </div>

    `
  );


  document.querySelector(
    '#cancel'
  ).onclick =
    closeSheet;


  document.querySelector(
    '#saveAccount'
  ).onclick =
    async () => {

      const username =
        document
          .querySelector(
            '#handle'
          )
          .value
          .trim()
          .replace(
            /^@/,
            ''
          );


      const category =
        document
          .querySelector(
            '#category'
          )
          .value;


      if (!username) {

        toast(
          'Enter a username'
        );

        return;

      }


      try {

        toast(
          'Adding account…'
        );


        const account =
          await api(
            '/api/accounts',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  username,
                  category
                })
            }
          );


        closeSheet();


        toast(
          `@${account.username} added`
        );


        await syncInstagramAccount(
          account
        );


      } catch (error) {

        toast(
          `Add failed: ${error.message}`
        );

      }

    };

}


function closeSheet() {

  document
    .querySelector(
      '#sheet'
    )
    ?.remove();

}


/* =========================
   INSTAGRAM SYNC
========================= */

async function syncInstagramAccount(
  account
) {

  try {

    toast(
      `Syncing @${account.username}…`
    );


    const result =
      await api(
        `/api/accounts/${account.id}/sync`,
        {
          method: 'POST',
          body: JSON.stringify({})
        }
      );


    toast(
      `Sync complete — ${result.added} new Reels`
    );


    await loadData();


  } catch (error) {

    toast(
      `Sync failed: ${error.message}`
    );

  }

}


async function syncAll() {

  if (!state.accounts.length) {

    toast(
      'Add an Instagram account first'
    );

    return;

  }


  toast(
    'Syncing Instagram accounts…'
  );


  for (
    const account
    of state.accounts
  ) {

    await syncInstagramAccount(
      account
    );

  }

}


/* =========================
   RANDOM 10
========================= */

async function runRandom() {

  try {

    toast(
      'Selecting 10 random Reels…'
    );


    const result =
      await api(
        '/api/batch/random',
        {
          method: 'POST',

          body:
            JSON.stringify({})
        }
      );


    toast(
      '10 Reels selected'
    );


    await loadData();


    window.scrollTo({
      top:
        document.body.scrollHeight,

      behavior:
        'smooth'
    });


  } catch (error) {

    toast(
      error.message
    );

  }

}


/* =========================
   AI ANALYSIS
========================= */

async function analyzeClip(id) {

  const clip =
    state.clips.find(
      c => c.id === id
    );


  if (!clip) return;


  if (
    clip.status ===
    'analyzing'
  ) {
    return;
  }


  if (!clip.videoUrl) {

    toast(
      'This Reel has no video URL'
    );

    return;

  }


  try {

    clip.status =
      'analyzing';

    clip.error =
      null;

    save();
    render();


    toast(
      'AI is watching the Reel…'
    );


    const result =
      await api(
        `/api/reels/${encodeURIComponent(id)}/analyze`,
        {
          method: 'POST',

          body:
            JSON.stringify({
              style:
                state.settings.style
            })
        }
      );


    clip.summary =
      result.summary || '';


    clip.hookOptions =
      Array.isArray(
        result.hooks
      )
        ? result.hooks
        : [];


    clip.hook =
      clip.hookOptions[0] ||
      '';


    clip.caption =
      result.caption ||
      '';


    clip.status =
      'selected';


    clip.error =
      null;


    save();
    render();


    toast(
      `${clip.hookOptions.length} AI hooks generated`
    );


  } catch (error) {

    console.error(
      'AI analysis failed:',
      error
    );


    clip.status =
      'error';


    clip.error =
      error.message;


    save();
    render();


    toast(
      `AI analysis failed: ${error.message}`
    );

  }

}


/* =========================
   SELECT HOOK
========================= */

function selectHook(
  id,
  index
) {

  const clip =
    state.clips.find(
      c => c.id === id
    );


  if (!clip) return;


  if (
    !Array.isArray(
      clip.hookOptions
    )
  ) {
    return;
  }


  const hook =
    clip.hookOptions[index];


  if (!hook) return;


  clip.hook =
    hook;


  save();
  render();


  toast(
    'Hook selected'
  );

}


/* =========================
   RENDER JOB
========================= */

async function renderJob(
  jobId
) {

  const clip =
    state.clips.find(
      c =>
        c.jobId === jobId
    );


  if (!clip) {

    toast(
      'Clip not found'
    );

    return;

  }


  if (!clip.hook) {

    toast(
      'Choose a hook first'
    );

    return;

  }


  try {

    clip.status =
      'rendering';

    clip.error =
      null;

    save();
    render();


    toast(
      'Rendering video…'
    );


    const result =
      await api(
        `/api/jobs/${jobId}/render`,
        {
          method: 'POST',

          body:
            JSON.stringify({

              hook:
                clip.hook,

              caption:
                clip.caption || ''

            })
        }
      );


    clip.hook =
      result.hook ||
      clip.hook;


    clip.caption =
      result.caption ||
      clip.caption;


    clip.status =
      result.status;


    clip.ready =
      result.status ===
      'ready';


    clip.outputUrl =
      result.outputUrl ||
      null;


    clip.error =
      result.error ||
      null;


    save();
    render();


    if (
      result.status ===
      'ready'
    ) {

      toast(
        'Video ready 🎉'
      );

    }


  } catch (error) {

    clip.status =
      'error';


    clip.error =
      error.message;


    save();
    render();


    toast(
      `Render failed: ${error.message}`
    );

  }

}


/* =========================
   COPY CAPTION
========================= */

function copyCaption(id) {

  const clip =
    state.clips.find(
      c => c.id === id
    );


  if (!clip?.caption) {

    toast(
      'No caption available'
    );

    return;

  }


  if (
    navigator.clipboard &&
    navigator.clipboard.writeText
  ) {

    navigator.clipboard
      .writeText(
        clip.caption
      )
      .then(
        () =>
          toast(
            'Caption copied'
          )
      )
      .catch(
        () =>
          toast(
            'Could not copy caption'
          )
      );

  } else {

    toast(
      'Clipboard is not available'
    );

  }

}


/* =========================
   GLOBAL CLICK HANDLER
========================= */

document.addEventListener(
  'click',
  event => {


    /* =========================
       HOOK SELECTION
    ========================= */

    const hookButton =
      event.target.closest(
        '[data-hook-id]'
      );


    if (hookButton) {

      selectHook(
        hookButton.dataset.hookId,
        Number(
          hookButton.dataset.hookIndex
        )
      );

      return;

    }


    /* =========================
       AI REMIX / ANALYZE
    ========================= */

    const remixButton =
      event.target.closest(
        '[data-remix]'
      );


    if (remixButton) {

      analyzeClip(
        remixButton.dataset.remix
      );

      return;

    }


    /* =========================
       COPY
    ========================= */

    const copyButton =
      event.target.closest(
        '[data-copy]'
      );


    if (copyButton) {

      copyCaption(
        copyButton.dataset.copy
      );

      return;

    }


    /* =========================
       RENDER
    ========================= */

    const renderButton =
      event.target.closest(
        '[data-render]'
      );


    if (renderButton) {

      renderJob(
        renderButton.dataset.render
      );

      return;

    }

  }
);


/* =========================
   START
========================= */

app();
