(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function el(tag, attrs, ...children) {
    attrs = attrs || {};
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number'
        ? document.createTextNode(String(c))
        : c);
    });
    return n;
  }

  const KEY = 'omni_state_v1';
  const ME_ID = 'me';

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.scores && s.scores[ME_ID]) return s;
      }
    } catch {}
    const seeded = seedScores();
    return {
      scores: { ...seeded, [ME_ID]: { legs: 0, push: 0, pull: 0, cardio: 0, classes: 0 } },
      history: [],
      profile: { name: 'You' },
      session: null,
    };
  }
  function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }
  let state = loadState();

  function meName() { return state.profile.name || 'You'; }
  function meInitials() {
    const parts = meName().trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function userScore(uid, catId) {
    if (catId === 'overall') {
      const s = state.scores[uid] || {};
      return Math.round(
        (s.legs || 0) * 0.05 +
        (s.push || 0) * 0.06 +
        (s.pull || 0) * 0.05 +
        (s.cardio || 0) * 5 +
        (s.classes || 0) * 5
      );
    }
    return Math.round((state.scores[uid] || {})[catId] || 0);
  }

  function leaderboard(catId) {
    const me = { id: ME_ID, name: meName(), initials: meInitials() };
    const all = [...SEED_USERS, me];
    return all
      .map((u) => ({ ...u, score: userScore(u.id, catId) }))
      .sort((a, b) => b.score - a.score)
      .map((u, i) => ({ ...u, rank: i + 1 }));
  }

  function myRank(catId) {
    const r = leaderboard(catId).find((u) => u.id === ME_ID);
    return r ? r.rank : '-';
  }

  function fmtScore(score, cat) {
    if (cat.id === 'overall') return score.toLocaleString() + ' pts';
    if (cat.unit === 'min') return score + ' min';
    return score.toLocaleString() + ' kg';
  }

  function fmtAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }

  /* ============ Router ============ */
  const routes = {
    '#/home':    renderHome,
    '#/board':   renderBoard,
    '#/start':   renderStart,
    '#/profile': renderProfile,
    '#/session': renderSession,
  };

  function go(hash) { location.hash = hash; }

  function parseHash() {
    const h = location.hash || '#/home';
    const [path, qs] = h.split('?');
    return { path, q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  function route() {
    const { path, q } = parseHash();
    const fn = routes[path] || routes['#/home'];
    const view = $('#view');
    view.innerHTML = '';
    fn(view, q);
    $$('.tab').forEach((t) => {
      const isStart = t.dataset.route === '#/start';
      const isSessionRoute = path === '#/session';
      const matches = t.dataset.route === path || (isStart && isSessionRoute);
      t.classList.toggle('active', matches);
    });
    window.scrollTo(0, 0);
    updateGreeting();
  }
  window.addEventListener('hashchange', route);

  /* ============ Render: Home ============ */
  function renderHome(view) {
    const wkAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const week = state.history.filter((h) => h.ts >= wkAgo);
    const myVol = week.reduce((a, h) => a + (h.unit === 'kg' ? h.added : 0), 0);
    const myMin = week.reduce((a, h) => a + (h.unit === 'min' ? h.added : 0), 0);

    view.appendChild(el('section', { class: 'hero' },
      el('p', { class: 'eyebrow' }, 'OMNI · Wellness Club · Bali Seseh'),
      el('h1', { class: 'h1' }, 'Hi, ' + meName().split(/\s+/)[0] + '.'),
      el('p', { class: 'lede' }, 'Track your training. Climb the boards. Bragging rights live in the sauna.'),
      el('a', { class: 'btn-primary', href: '#/start' }, 'Start a workout'),
    ));

    view.appendChild(el('section', { class: 'stats-row' },
      stat('Week volume', myVol.toLocaleString() + ' kg'),
      stat('Week minutes', myMin + ' min'),
      stat('Overall rank', '#' + myRank('overall')),
    ));

    const cats = CATEGORIES.filter((c) => c.id !== 'overall');
    view.appendChild(el('section', { class: 'movers-section' },
      el('h2', { class: 'h2' }, 'Top of the boards'),
      el('div', { class: 'mover-grid' }, ...cats.map((cat) => {
        const lb = leaderboard(cat.id).slice(0, 3);
        return el('a', { class: 'mover-card', href: '#/board?cat=' + cat.id },
          el('div', { class: 'mover-head' },
            el('span', { class: 'mover-label' }, cat.label),
            el('span', { class: 'mover-arrow' }, '›'),
          ),
          el('ul', { class: 'mover-list' }, ...lb.map((u, i) =>
            el('li', null,
              el('span', { class: 'mover-rank' }, '#' + (i + 1)),
              el('span', { class: 'mover-name' }, u.name),
              el('span', { class: 'mover-score' }, fmtScore(u.score, cat)),
            )
          ))
        );
      }))
    ));
  }

  function stat(label, value) {
    return el('div', { class: 'stat' },
      el('span', { class: 'stat-label' }, label),
      el('strong', { class: 'stat-value' }, value),
    );
  }

  /* ============ Render: Leaderboard ============ */
  function renderBoard(view, q) {
    const activeId = q.cat || 'overall';
    const cat = CATEGORIES.find((c) => c.id === activeId) || CATEGORIES[0];

    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'Leaderboard · ' + cat.label),
      el('h1', { class: 'h1' }, 'Who is moving'),
      el('p', { class: 'lede' }, 'Active members, rolling totals. Switch boards to see who owns each tool.'),
    ));

    view.appendChild(el('div', { class: 'segctl' }, ...CATEGORIES.map((c) =>
      el('a', {
        class: 'seg' + (c.id === activeId ? ' active' : ''),
        href: '#/board?cat=' + c.id,
      }, c.label)
    )));

    const lb = leaderboard(activeId);
    view.appendChild(el('ol', { class: 'lb' }, ...lb.slice(0, 25).map((u) => {
      const isMe = u.id === ME_ID;
      const podiumClass = u.rank <= 3 ? ' podium' : '';
      return el('li', { class: 'lb-row' + (isMe ? ' me' : '') + podiumClass },
        el('span', { class: 'lb-rank' }, '#' + u.rank),
        el('span', { class: 'lb-avatar' }, u.initials),
        el('span', { class: 'lb-name' }, u.name + (isMe ? ' · you' : '')),
        el('span', { class: 'lb-score' }, fmtScore(u.score, cat)),
      );
    })));
  }

  /* ============ Render: Start (pick category / exercise) ============ */
  function renderStart(view, q) {
    if (state.session) { go('#/session'); return; }

    if (!q.cat) {
      view.appendChild(el('section', { class: 'page-head' },
        el('p', { class: 'eyebrow' }, 'Train'),
        el('h1', { class: 'h1' }, 'Pick a discipline'),
        el('p', { class: 'lede' }, 'Each finished session credits points to that board.'),
      ));
      const cats = CATEGORIES.filter((c) => c.id !== 'overall');
      view.appendChild(el('div', { class: 'pick-grid' }, ...cats.map((c) =>
        el('a', { class: 'pick', href: '#/start?cat=' + c.id },
          el('span', { class: 'pick-label' }, c.label),
          el('span', { class: 'pick-desc' }, CATEGORY_BLURB[c.id] || ''),
        )
      )));
      return;
    }

    const cat = CATEGORIES.find((c) => c.id === q.cat);
    const list = EXERCISES[q.cat] || [];
    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'Train · ' + cat.label),
      el('h1', { class: 'h1' }, 'Pick an exercise'),
      el('a', { class: 'back', href: '#/start' }, '‹ All disciplines'),
    ));
    view.appendChild(el('div', { class: 'pick-grid' }, ...list.map((e) =>
      el('button', { class: 'pick', onclick: () => startSession(q.cat, e.id) },
        el('span', { class: 'pick-label' }, e.name),
        el('span', { class: 'pick-desc' }, e.type === 'duration' ? 'Log minutes' : 'Log sets × reps'),
      )
    )));
  }

  function startSession(catId, exId) {
    state.session = {
      category: catId,
      exerciseId: exId,
      sets: [],
      minutes: 0,
      startedAt: Date.now(),
    };
    saveState();
    go('#/session');
  }

  function cancelSession() {
    state.session = null;
    saveState();
    go('#/start');
  }

  /* ============ Render: Session ============ */
  function renderSession(view) {
    const s = state.session;
    if (!s) { go('#/start'); return; }
    const cat = CATEGORIES.find((c) => c.id === s.category);
    const ex = (EXERCISES[s.category] || []).find((e) => e.id === s.exerciseId);
    if (!ex) { state.session = null; saveState(); go('#/start'); return; }

    const isDuration = ex.type === 'duration';

    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'Live session · ' + cat.label),
      el('h1', { class: 'h1' }, ex.name),
      el('p', { class: 'lede' },
        isDuration
          ? 'Tap the minutes you trained. Multiplier turns them into board points.'
          : 'Log each set as you finish. Volume (kg × reps) feeds the ' + cat.label + ' board.'),
    ));

    if (isDuration) {
      view.appendChild(el('div', { class: 'duration-pad' },
        el('div', { class: 'big-num' }, String(s.minutes), el('span', { class: 'small' }, 'min')),
        el('div', { class: 'dur-controls' },
          el('button', { class: 'dur-btn', onclick: () => addMin(-5) }, '−5'),
          el('button', { class: 'dur-btn', onclick: () => addMin(-1) }, '−1'),
          el('button', { class: 'dur-btn primary', onclick: () => addMin(5) }, '+5'),
          el('button', { class: 'dur-btn primary', onclick: () => addMin(10) }, '+10'),
        ),
        el('p', { class: 'hint' }, 'Score multiplier · ×' + (ex.mult || 5) + ' pts per minute'),
      ));
    } else {
      const list = el('ul', { class: 'sets' });
      s.sets.forEach((set, i) => {
        list.appendChild(el('li', { class: 'set' },
          el('span', { class: 'set-i' }, 'Set ' + (i + 1)),
          el('span', { class: 'set-wr' }, set.w + ' kg × ' + set.r + ' reps'),
          el('span', { class: 'set-vol' }, (set.w * set.r) + ' kg'),
          el('button', { class: 'set-del', title: 'Remove', onclick: () => {
            s.sets.splice(i, 1); saveState(); route();
          } }, '×'),
        ));
      });
      view.appendChild(list);

      const lastSet = s.sets[s.sets.length - 1];
      const defW = lastSet ? lastSet.w : (ex.type === 'bodyweight' ? 0 : 60);
      const defR = lastSet ? lastSet.r : 8;
      view.appendChild(el('div', { class: 'set-form' },
        el('label', { class: 'field' },
          el('span', null, 'Weight (kg)'),
          el('input', { type: 'number', min: '0', step: '2.5', value: String(defW), id: 'inp-w', inputmode: 'decimal' }),
        ),
        el('label', { class: 'field' },
          el('span', null, 'Reps'),
          el('input', { type: 'number', min: '1', step: '1', value: String(defR), id: 'inp-r', inputmode: 'numeric' }),
        ),
        el('button', { class: 'btn-primary', onclick: addSet }, 'Add set'),
      ));
    }

    view.appendChild(el('div', { class: 'session-actions' },
      el('button', { class: 'btn-ghost', onclick: cancelSession }, 'Cancel'),
      el('button', { class: 'btn-primary', onclick: finishSession }, 'Finish workout'),
    ));
  }

  function addMin(delta) {
    state.session.minutes = Math.max(0, state.session.minutes + delta);
    saveState();
    route();
  }

  function addSet() {
    const w = parseFloat($('#inp-w').value || '0') || 0;
    const r = parseInt($('#inp-r').value || '0', 10) || 0;
    if (r <= 0) return;
    state.session.sets.push({ w, r });
    saveState();
    route();
  }

  function finishSession() {
    const s = state.session;
    if (!s) return;
    const ex = (EXERCISES[s.category] || []).find((e) => e.id === s.exerciseId);
    if (!ex) { state.session = null; saveState(); go('#/start'); return; }

    let added = 0;
    let unit = 'kg';
    if (ex.type === 'duration') {
      added = s.minutes;
      unit = 'min';
    } else if (ex.type === 'bodyweight') {
      const bw = 70; // assumed bodyweight if none entered
      added = s.sets.reduce((a, b) => a + (b.w > 0 ? b.w : bw) * b.r, 0);
    } else {
      added = s.sets.reduce((a, b) => a + b.w * b.r, 0);
    }

    if (added <= 0) { state.session = null; saveState(); go('#/start'); return; }

    state.scores[ME_ID][s.category] = (state.scores[ME_ID][s.category] || 0) + added;
    state.history.unshift({
      ts: Date.now(),
      category: s.category,
      categoryLabel: CATEGORIES.find((c) => c.id === s.category).label,
      exerciseName: ex.name,
      sets: s.sets.slice(),
      minutes: s.minutes,
      added,
      unit,
    });
    state.session = null;
    saveState();
    go('#/profile?just=' + s.category);
  }

  /* ============ Render: Profile ============ */
  function renderProfile(view, q) {
    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'You'),
      el('h1', { class: 'h1' }, meName()),
      el('p', { class: 'lede' }, 'Your ranks across the club and recent sessions.'),
    ));

    if (q.just) {
      const c = CATEGORIES.find((x) => x.id === q.just);
      if (c) {
        view.appendChild(el('div', { class: 'toast' },
          'Workout saved · credited to the ' + c.label + ' board.'));
      }
    }

    view.appendChild(el('div', { class: 'rank-grid' }, ...CATEGORIES.map((c) => {
      const r = myRank(c.id);
      const score = userScore(ME_ID, c.id);
      return el('div', { class: 'rank-tile' },
        el('span', { class: 'rt-label' }, c.label),
        el('span', { class: 'rt-rank' }, '#' + r),
        el('span', { class: 'rt-score' }, fmtScore(score, c)),
      );
    })));

    view.appendChild(el('div', { class: 'name-edit' },
      el('label', { class: 'field' },
        el('span', null, 'Display name (shown on the boards)'),
        el('input', { type: 'text', value: meName(), id: 'name-in', maxlength: '24' }),
      ),
      el('button', { class: 'btn-ghost', onclick: () => {
        const v = ($('#name-in').value || '').trim() || 'You';
        state.profile.name = v;
        saveState();
        route();
      } }, 'Save'),
    ));

    view.appendChild(el('h2', { class: 'h2' }, 'Recent sessions'));
    if (state.history.length === 0) {
      view.appendChild(el('p', { class: 'empty' }, 'No sessions logged yet. Tap Train to start.'));
    } else {
      view.appendChild(el('ul', { class: 'history' }, ...state.history.slice(0, 14).map((h) => {
        const detail = h.sets && h.sets.length
          ? h.sets.map((s) => s.w + '×' + s.r).join(', ')
          : (h.minutes || 0) + ' min';
        const unitLabel = h.unit === 'min' ? ' min' : ' kg';
        return el('li', { class: 'hist' },
          el('span', { class: 'hist-when' }, fmtAgo(h.ts)),
          el('span', { class: 'hist-name' }, h.exerciseName),
          el('span', { class: 'hist-detail' }, h.categoryLabel + ' · ' + detail),
          el('span', { class: 'hist-add' }, '+' + h.added.toLocaleString() + unitLabel),
        );
      })));
    }
  }

  function updateGreeting() {
    const tgt = $('#me-name');
    if (tgt) tgt.textContent = meName();
  }

  // Resume session route if mid-workout on first load
  if (state.session && !location.hash) location.hash = '#/session';
  updateGreeting();
  route();
})();
