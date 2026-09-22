const API = 'https://clipper-backend-z71i.onrender.com';
const KEY = 'clipper-state-v2';

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

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function toast(message) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = message;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

function app() {
  document.querySelector('#app').innerHTML = `
    <main class="shell">
      <div class="top">
        <div class="brand">Clipper</div>
        <div class="pill">
          ${state.clips.length} clips · ${state.accounts.length} sources
        </div>
      </div>
      <div id="view"></div>
    </main>

    <nav class="nav">
      <div class="navin">
        <button data-tab="home">⚡<br>Remix</button>
        <button data-tab="library">▣<br>Library</button>
        <button data-tab="settings">⚙<br>Settings</button>
      </div>
    </nav>
  `;

  render();

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.onclick = () => {
      state.tab = button.dataset.tab;
      save();
      render();
    };
  });
}

function render() {
  document.querySelectorAll('.nav button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.tab);
  });

  const view = document.querySelector('#view');

  if (state.tab === 'home') home(view);
  if (state.tab === 'library') library(view);
  if (state.tab === 'settings') settings(view);
}

async function home(v) {
  const unused = state.clips.filter(c => !c.used).length;

  v.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Meme clipping engine</div>
      <h1>10 clips.<br>One tap.</h1>

      <p>
        Pick a batch, generate fresh hooks, remix the text
        and keep track of what you've already used.
      </p>

      <button class="primary" id="random">
        RANDOM 10
      </button>

      <div class="row" style="margin-top:10px">
        <button class="secondary" style="flex:1" id="add">
          ＋ Inspiration account
        </button>

        <button class="secondary" style="flex:1" id="sync">
          ↻ Sync Instagram
        </button>
      </div>

      <div id="prog"></div>
    </section>

    <div class="grid">
      <div class="card">
        <div class="muted">Unused</div>
        <div class="stat">${unused}</div>
      </div>

      <div class="card">
        <div class="muted">Ready</div>
        <div class="stat">
          ${state.clips.filter(c => c.ready).length}
        </div>
      </div>
    </div>

    <section class="section">
      <h2>Inspiration pool</h2>

      ${
        state.accounts.length
          ? state.accounts.map(a => `
            <div class="account">
              <div class="avatar">
                ${esc(a.username.slice(0, 1).toUpperCase())}
              </div>

              <div>
                <div class="name">
                  @${esc(a.username)}
                </div>

                <div class="handle">
                  ${esc(a.category || '')}
                </div>
              </div>

              <div class="spacer"></div>

              <span class="tag">
                ${a.active ? 'ON' : 'OFF'}
              </span>
            </div>
          `).join('')
          : `
            <div class="empty">
              Add Instagram inspiration accounts to start.
            </div>
          `
      }
    </section>

    <section class="section">
      <h2>Latest batch</h2>
      <div id="batch">
        ${renderBatch()}
      </div>
    </section>
  `;

  document.querySelector('#add').onclick = accountSheet;
  document.querySelector('#sync').onclick = syncAll;
  document.querySelector('#random').onclick = runRandom;
}

function renderBatch() {
  const arr = state.clips
    .filter(c => c.batch)
    .slice(-10)
    .reverse();

  if (!arr.length) {
    return `
      <div class="empty">
        No batch yet. Tap RANDOM 10.
      </div>
    `;
  }

  return arr.map(c => `
    <div class="clip">

      ${
        c.preview
          ? `<img class="thumb" src="${esc(c.preview)}">`
          : `<div class="thumb"></div>`
      }

      <div>

        <span class="tag">
          ${c.status === 'ready' ? 'READY' : 'QUEUED'}
        </span>

        <h3>
          ${esc(c.name || 'Instagram Reel')}
        </h3>

        <div class="muted">
          ${esc(c.source || '')}
        </div>

        ${
          c.videoUrl
            ? `
              <a
                class="secondary"
                style="display:inline-block;margin-top:6px;text-decoration:none"
                href="${esc(c.videoUrl)}"
                target="_blank"
                rel="noopener"
              >
                Open Reel video
              </a>
            `
            : ''
        }

        <div class="hook">
          ${esc(c.hook || 'Tap Remix to generate a hook.')}
        </div>

        <div class="row" style="margin-top:8px">
          <button class="secondary" data-remix="${esc(c.id)}">
            Remix
          </button>

          ${
            c.caption
              ? `
                <button class="secondary" data-copy="${esc(c.id)}">
                  Copy caption
                </button>
              `
              : ''
          }

          ${
            c.jobId
              ? `
                <button class="primary" data-render="${esc(c.jobId)}">
                  Render
                </button>
              `
              : ''
          }
        </div>

        ${
          c.outputUrl
            ? `
              <a
                class="video-link"
                href="${API}${esc(c.outputUrl)}"
                target="_blank"
                rel="noopener"
              >
                ↗ Open rendered video
              </a>
            `
            : ''
        }

      </div>
    </div>
  `).join('');
}

function library(v) {
  v.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Library</div>

      <h1>${state.clips.length} clips</h1>

      <p>
        Used clips stay remembered so your random batches
        don't keep recycling the same content.
      </p>

      <button class="primary" id="import">
        Import from Photos
      </button>
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
                      ? `<img class="thumb" src="${esc(c.preview)}">`
                      : `<div class="thumb"></div>`
                  }

                  <div>
                    <span class="tag">
                      ${c.used ? 'USED' : 'UNUSED'}
                    </span>

                    <span class="tag">
                      ${c.ready ? 'READY' : 'RAW'}
                    </span>

                    <h3>
                      ${esc(c.name)}
                    </h3>

                    <div class="muted">
                      ${esc(c.source || 'Imported')}
                    </div>

                    ${
                      c.hook
                        ? `<div class="hook">${esc(c.hook)}</div>`
                        : ''
                    }
                  </div>

                </div>
              `)
              .join('')
          : `
            <div class="empty">
              Import videos to build your clipping library.
            </div>
          `
      }
    </section>
  `;

  document.querySelector('#import').onclick = importInput;
}

function settings(v) {
  v.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Settings</div>

      <h1>Make it yours.</h1>

      <p>
        These defaults control the remix engine.
      </p>
    </section>

    <section class="card">

      <label class="muted">
        Hook style
      </label>

      <select class="input" id="style" style="margin-top:7px">
        ${[
          'Relatable',
          'Chaotic',
          'Savage',
          'Dry',
          'Curiosity',
          'Identity'
        ].map(x => `
          <option ${state.settings.style === x ? 'selected' : ''}>
            ${x}
          </option>
        `).join('')}
      </select>

      <label
        class="muted"
        style="display:block;margin-top:15px"
      >
        Text position
      </label>

      <select
        class="input"
        id="position"
        style="margin-top:7px"
      >
        ${['Top', 'Center', 'Bottom'].map(x => `
          <option ${state.settings.position === x ? 'selected' : ''}>
            ${x}
          </option>
        `).join('')}
      </select>

      <label
        class="muted"
        style="display:block;margin-top:15px"
      >
        Font
      </label>

      <select
        class="input"
        id="font"
        style="margin-top:7px"
      >
        ${['Bold', 'Clean', 'Meme'].map(x => `
          <option ${state.settings.font === x ? 'selected' : ''}>
            ${x}
          </option>
        `).join('')}
      </select>

      <div
        class="muted"
        style="font-size:12px;margin-top:18px"
      >
        Apify is now connected through the secure backend.
        Your Apify token is no longer stored in this browser.
      </div>

      <button
        class="secondary danger"
        style="width:100%;margin-top:18px"
        id="clear"
      >
        Reset all local data
      </button>

    </section>
  `;

  ['style', 'position', 'font'].forEach(id => {
    document.querySelector('#' + id).onchange = e => {
      state.settings[id] = e.target.value;
      save();
    };
  });

  document.querySelector('#clear').onclick = () => {
    if (confirm('Delete all Clipper data?')) {
      localStorage.removeItem(KEY);
      location.reload();
    }
  };
}

function accountSheet() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div class="sheet" id="sheet">

        <div class="modal">

          <h2>Add Instagram inspiration</h2>

          <p class="muted">
            Enter a public Instagram username.
            Reels will be loaded through your Clipper backend.
          </p>

          <input
            class="input"
            id="handle"
            placeholder="@account"
          >

          <select
            class="input"
            id="category"
            style="margin-top:9px"
          >
            <option value="meme">Meme</option>
            <option value="movie_tv">Movie / TV</option>
            <option value="music">Music</option>
          </select>

          <div class="row" style="margin-top:12px">

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

          <p
            class="muted"
            style="font-size:12px;margin-top:12px"
          >
            Source: Clipper backend → Apify.
          </p>

        </div>

      </div>
    `
  );

  document.querySelector('#cancel').onclick = closeSheet;

  document.querySelector('#saveAccount').onclick = async () => {
    const username = document
      .querySelector('#handle')
      .value
      .trim()
      .replace(/^@/, '');

    const category = document.querySelector('#category').value;

    if (!username) {
      toast('Enter a username');
      return;
    }

    try {
      toast('Adding Instagram account…');

      const account = await api('/api/accounts', {
        method: 'POST',
        body: JSON.stringify({
          username,
          category
        })
      });

      const existing = state.accounts.find(
        a => a.id === account.id
      );

      if (existing) {
        Object.assign(existing, account);
      } else {
        state.accounts.push(account);
      }

      save();
      closeSheet();
      render();

      await syncInstagramAccount(account);

    } catch (error) {
      toast(error.message);
    }
  };
}

function closeSheet() {
  document.querySelector('#sheet')?.remove();
}

async function syncInstagramAccount(account) {
  try {
    toast(`Syncing @${account.username}…`);

    const result = await api(
      `/api/accounts/${account.id}/sync`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );

    const local = state.accounts.find(
      a => a.id === account.id
    );

    if (local) {
      Object.assign(local, result.account);
    }

    save();

    toast(
      `Sync complete — ${result.added} new Reels.`
    );

    render();

  } catch (error) {
    toast(`Sync failed: ${error.message}`);
  }
}

async function syncAll() {
  if (!state.accounts.length) {
    toast('Add an Instagram account first');
    return;
  }

  for (const account of state.accounts) {
    try {
      await syncInstagramAccount(account);
    } catch {}
  }
}

async function runRandom() {
  try {
    toast('Selecting 10 random Reels…');

    const result = await api(
      '/api/batch/random',
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );

    const batch = result.batch;

    if (!state.batches.find(b => b.id === batch.id)) {
      state.batches.push(batch);
    }

    result.reels.forEach((reel, index) => {
      const job = result.jobs[index];

      const clip = {
        id: reel.id,
        name: reel.caption
          ? reel.caption.slice(0, 60)
          : `Instagram Reel ${index + 1}`,
        source: '@' + reel.username,
        sourceId: reel.sourceId,
        videoUrl: reel.videoUrl,
        permalink: reel.permalink,
        caption: reel.caption || '',
        preview: '',
        used: false,
        ready: false,
        status: 'queued',
        batch: batch.id,
        jobId: job?.id || null,
        hook: ''
      };

      const existing = state.clips.find(
        c => c.id === clip.id
      );

      if (existing) {
        Object.assign(existing, clip);
      } else {
        state.clips.push(clip);
      }
    });

    save();

    toast('10 Reels selected.');

    render();

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });

  } catch (error) {
    toast(error.message);
  }
}

function makeHook() {
  const style = state.settings.style;

  const hooks = {
    Relatable: [
      'POV: you thought this was going to go differently',
      'That moment when you realize you messed up',
      'Everyone has that one moment they wish they could delete'
    ],

    Chaotic: [
      'This escalated way faster than it needed to',
      'Nobody had this on their 2026 bingo card',
      'The exact second everything went off the rails'
    ],

    Savage: [
      'The confidence was there. The plan was not.',
      'This is where the whole situation fell apart',
      'One decision. Immediate regret.'
    ],

    Dry: [
      'Well, that went exactly as expected.',
      'A completely normal decision with normal consequences.',
      'Nothing to see here. Everything is fine.'
    ],

    Curiosity: [
      'Watch the last few seconds before judging this',
      'The ending changes the entire context',
      'You need to see what happens after this'
    ],

    Identity: [
      'If you have ever been the friend who says "trust me"',
      'Every group has a person like this',
      'POV: you are the one who always makes it worse'
    ]
  };

  const list = hooks[style] || hooks.Relatable;

  return list[Math.floor(Math.random() * list.length)];
}

function makeCaption() {
  return `
One of those moments that starts normally
and somehow turns into the only part everyone remembers.

Remixed for Clipper.
`.trim();
}

function remix(id) {
  const clip = state.clips.find(c => c.id === id);

  if (!clip) return;

  clip.hook = makeHook();
  clip.caption = makeCaption();

  save();
  render();

  toast('Remixed');
}

async function renderJob(jobId) {
  const clip = state.clips.find(
    c => c.jobId === jobId
  );

  if (!clip) {
    toast('Clip not found');
    return;
  }

  try {
    toast('Rendering video…');

    const result = await api(
      `/api/jobs/${jobId}/render`,
      {
        method: 'POST',
        body: JSON.stringify({
          hook: clip.hook || makeHook(),
          caption: clip.caption || makeCaption()
        })
      }
    );

    clip.hook = result.hook;
    clip.caption = result.caption;
    clip.status = result.status;
    clip.ready = result.status === 'ready';
    clip.outputUrl = result.outputUrl || null;

    save();
    render();

    if (result.status === 'ready') {
      toast('Video ready 🎉');
    }

  } catch (error) {
    clip.status = 'error';
    save();

    toast(`Render failed: ${error.message}`);
    render();
  }
}

function importInput() {
  const input = document.createElement('input');

  input.type = 'file';
  input.accept = 'video/*';
  input.multiple = true;

  input.onchange = () => {
    handleFiles([...input.files]);
  };

  input.click();
}

async function handleFiles(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file);

    state.clips.push({
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ''),
      source: 'Photos / Files',
      preview: url,
      used: false,
      ready: false,
      status: 'raw',
      remote: false,
      fileName: file.name
    });
  }

  save();

  toast(
    `${files.length} clip${files.length > 1 ? 's' : ''} imported`
  );

  render();
}

function copy(id) {
  const clip = state.clips.find(c => c.id === id);

  if (!clip?.caption) return;

  navigator.clipboard
    ?.writeText(clip.caption)
    .then(() => toast('Caption copied'));
}

document.addEventListener('click', event => {
  const remixButton = event.target.closest('[data-remix]');

  if (remixButton) {
    remix(remixButton.dataset.remix);
  }

  const copyButton = event.target.closest('[data-copy]');

  if (copyButton) {
    copy(copyButton.dataset.copy);
  }

  const renderButton = event.target.closest('[data-render]');

  if (renderButton) {
    renderJob(renderButton.dataset.render);
  }
});

app();
