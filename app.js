(() => {
  /* ===================== utilities ===================== */
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

  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ===================== state ===================== */
  const KEY = 'omni_state_v2';
  const ME_ID = 'me';

  function defaultState() {
    const seeded = seedScores();
    return {
      scores: { ...seeded, [ME_ID]: { legs: 0, push: 0, pull: 0, cardio: 0, classes: 0 } },
      history: [],
      profile: { name: 'You' },
      templates: [],
      session: null,
    };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.scores && s.scores[ME_ID]) {
          s.templates = s.templates || [];
          s.history = s.history || [];
          return s;
        }
      }
    } catch {}
    return defaultState();
  }
  function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }
  let state = loadState();

  /* ===================== identity / scoring ===================== */
  function meName() { return state.profile.name || 'You'; }
  function meInitials() {
    const parts = meName().trim().split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function userScore(userId, catId) {
    if (catId === 'overall') {
      const s = state.scores[userId] || {};
      return Math.round(
        (s.legs || 0) * 0.05 +
        (s.push || 0) * 0.06 +
        (s.pull || 0) * 0.05 +
        (s.cardio || 0) * 5 +
        (s.classes || 0) * 5
      );
    }
    return Math.round((state.scores[userId] || {})[catId] || 0);
  }
  function leaderboard(catId) {
    const me = { id: ME_ID, name: meName(), initials: meInitials() };
    return [...SEED_USERS, me]
      .map((u) => ({ ...u, score: userScore(u.id, catId) }))
      .sort((a, b) => b.score - a.score)
      .map((u, i) => ({ ...u, rank: i + 1 }));
  }
  function myRank(catId) {
    const r = leaderboard(catId).find((u) => u.id === ME_ID);
    return r ? r.rank : '-';
  }

  /* ===================== formatting ===================== */
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
  function fmtClock(secs) {
    secs = Math.max(0, Math.floor(secs || 0));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
  }
  function defaultWorkoutName() {
    const h = new Date().getHours();
    if (h < 11) return 'Morning workout';
    if (h < 17) return 'Afternoon workout';
    return 'Evening workout';
  }

  /* ===================== templates ===================== */
  function findTemplate(id) {
    return state.templates.find((t) => t.id === id) ||
           EXAMPLE_TEMPLATES.find((t) => t.id === id);
  }
  function newUserTemplate() {
    const t = { id: 't_' + uid(), name: 'New workout', exercises: [] };
    state.templates.push(t);
    saveState();
    return t;
  }
  function deleteTemplate(id) {
    state.templates = state.templates.filter((t) => t.id !== id);
    saveState();
  }

  /* ===================== session ops ===================== */
  function makeSessionExercise(exerciseId) {
    const def = findExerciseDef(exerciseId);
    if (!def) return null;
    return {
      id: 'se_' + uid(),
      exerciseId,
      name: def.name,
      category: def.category,
      categoryLabel: def.categoryLabel,
      type: def.type,
      mult: def.mult,
      sets: [],
      minutes: 0,
    };
  }
  function startEmptySession() {
    state.session = {
      name: defaultWorkoutName(),
      startedAt: Date.now(),
      exercises: [],
    };
    saveState();
    go('#/session');
  }
  function startSessionFromTemplate(t) {
    const ses = {
      name: t.name,
      startedAt: Date.now(),
      exercises: [],
    };
    t.exercises.forEach((te) => {
      const sx = makeSessionExercise(te.exerciseId);
      if (sx) ses.exercises.push(sx);
    });
    state.session = ses;
    saveState();
    go('#/session');
  }
  function addExercisesToSession(ids) {
    if (!state.session) return;
    ids.forEach((id) => {
      const sx = makeSessionExercise(id);
      if (sx) state.session.exercises.push(sx);
    });
    saveState();
  }
  function removeSessionExercise(localId) {
    if (!state.session) return;
    state.session.exercises = state.session.exercises.filter((e) => e.id !== localId);
    saveState();
  }
  function addSetTo(localId, w, r) {
    const sx = state.session.exercises.find((e) => e.id === localId);
    if (!sx) return;
    sx.sets.push({ w, r });
    saveState();
  }
  function removeSetAt(localId, idx) {
    const sx = state.session.exercises.find((e) => e.id === localId);
    if (!sx) return;
    sx.sets.splice(idx, 1);
    saveState();
  }
  function bumpMinutes(localId, delta) {
    const sx = state.session.exercises.find((e) => e.id === localId);
    if (!sx) return;
    sx.minutes = Math.max(0, (sx.minutes || 0) + delta);
    saveState();
  }
  function cancelSession() {
    state.session = null;
    saveState();
    go('#/start');
  }
  function finishSession() {
    const sess = state.session;
    if (!sess) return;
    const entries = [];
    const totals = { kg: 0, min: 0 };
    const boards = { legs: 0, push: 0, pull: 0, cardio: 0, classes: 0 };

    for (const sx of sess.exercises) {
      let added = 0;
      let unit = 'kg';
      if (sx.type === 'duration') {
        added = sx.minutes || 0;
        unit = 'min';
      } else if (sx.type === 'bodyweight') {
        added = sx.sets.reduce((a, b) => a + ((b.w > 0 ? b.w : 70) * b.r), 0);
      } else {
        added = sx.sets.reduce((a, b) => a + (b.w * b.r), 0);
      }
      if (added <= 0) continue;
      boards[sx.category] += added;
      if (unit === 'min') totals.min += added;
      else totals.kg += added;
      entries.push({
        exerciseId: sx.exerciseId,
        name: sx.name,
        category: sx.category,
        categoryLabel: sx.categoryLabel,
        sets: sx.sets.slice(),
        minutes: sx.minutes || 0,
        added,
        unit,
      });
    }

    if (entries.length === 0) {
      state.session = null;
      saveState();
      go('#/start');
      return;
    }

    for (const cat of Object.keys(boards)) {
      state.scores[ME_ID][cat] = (state.scores[ME_ID][cat] || 0) + boards[cat];
    }
    state.history.unshift({
      id: 'h_' + uid(),
      ts: Date.now(),
      name: sess.name,
      durationSec: Math.round((Date.now() - sess.startedAt) / 1000),
      exercises: entries,
      totals,
      boards,
    });
    state.session = null;
    saveState();
    go('#/profile?just=workout');
  }

  /* ===================== picker ===================== */
  // Picker state is in-memory: lost on hard reload, which is fine.
  const picker = {
    context: null, // 'session' | 'template:<id>'
    selected: new Set(),
    query: '',
    bodyPart: 'all', // 'all' | category id
  };
  function openPickerForSession() {
    picker.context = 'session';
    picker.selected = new Set();
    picker.query = '';
    picker.bodyPart = 'all';
    go('#/pick');
  }
  function openPickerForTemplate(tid) {
    picker.context = 'template:' + tid;
    picker.selected = new Set();
    picker.query = '';
    picker.bodyPart = 'all';
    go('#/pick');
  }
  function pickerCommit() {
    const ids = Array.from(picker.selected);
    const ctx = picker.context;
    picker.context = null;
    picker.selected = new Set();
    if (ctx === 'session') {
      addExercisesToSession(ids);
      go('#/session');
    } else if (ctx && ctx.startsWith('template:')) {
      const tid = ctx.slice('template:'.length);
      const t = state.templates.find((x) => x.id === tid);
      if (t) {
        ids.forEach((id) => {
          if (!t.exercises.find((e) => e.exerciseId === id)) {
            t.exercises.push({ exerciseId: id, sets: 3 });
          }
        });
        saveState();
      }
      go('#/template/edit?id=' + tid);
    } else {
      go('#/start');
    }
  }
  function pickerCancel() {
    const ctx = picker.context;
    picker.context = null;
    picker.selected = new Set();
    if (ctx === 'session') go('#/session');
    else if (ctx && ctx.startsWith('template:')) go('#/template/edit?id=' + ctx.slice('template:'.length));
    else go('#/start');
  }

  /* ===================== timer ===================== */
  let timerInt = null;
  function startTimer() {
    stopTimer();
    timerInt = setInterval(() => {
      const t = $('#sess-timer');
      if (!t || !state.session) { stopTimer(); return; }
      t.textContent = fmtClock((Date.now() - state.session.startedAt) / 1000);
    }, 1000);
  }
  function stopTimer() {
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
  }

  /* ===================== router ===================== */
  const routes = {
    '#/home':          renderHome,
    '#/board':         renderBoard,
    '#/start':         renderStart,
    '#/template':      renderTemplate,
    '#/template/edit': renderTemplateEdit,
    '#/session':       renderSession,
    '#/pick':          renderPicker,
    '#/profile':       renderProfile,
  };
  function go(hash) { location.hash = hash; }
  function parseHash() {
    const h = location.hash || '#/home';
    const [path, qs] = h.split('?');
    return { path, q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function route() {
    stopTimer();
    const { path, q } = parseHash();
    const fn = routes[path] || routes['#/home'];
    const view = $('#view');
    view.innerHTML = '';
    fn(view, q);
    $$('.tab').forEach((t) => {
      const isStart = t.dataset.route === '#/start';
      const inStartFlow = path === '#/session' || path === '#/template' ||
                          path === '#/template/edit' || path === '#/pick';
      t.classList.toggle('active', t.dataset.route === path || (isStart && inStartFlow));
    });
    window.scrollTo(0, 0);
    updateGreeting();
  }
  window.addEventListener('hashchange', route);

  /* ===================== render: home ===================== */
  function renderHome(view) {
    const wkAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const week = state.history.filter((h) => h.ts >= wkAgo);
    const myVol = week.reduce((a, h) => a + (h.totals && h.totals.kg ? h.totals.kg : 0), 0);
    const myMin = week.reduce((a, h) => a + (h.totals && h.totals.min ? h.totals.min : 0), 0);

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
    view.appendChild(el('section', null,
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

  /* ===================== render: leaderboard ===================== */
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

  /* ===================== render: start ===================== */
  function renderStart(view) {
    if (state.session) { go('#/session'); return; }

    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'Train'),
      el('h1', { class: 'h1' }, 'Start workout'),
      el('p', { class: 'lede' }, 'Quick start, or pick a template you saved.'),
    ));

    // Quick start
    view.appendChild(el('section', { class: 'quick-start' },
      el('button', { class: 'btn-primary big-cta', onclick: startEmptySession }, 'Start empty workout'),
    ));

    // My templates
    view.appendChild(el('h2', { class: 'h2' }, 'My templates'));
    const tplGrid = el('div', { class: 'tpl-grid' });
    state.templates.forEach((t) => tplGrid.appendChild(renderTplCard(t, false)));
    tplGrid.appendChild(el('button', { class: 'tpl-card tpl-new', onclick: () => {
      const t = newUserTemplate();
      go('#/template/edit?id=' + t.id);
    } },
      el('span', { class: 'tpl-new-plus' }, '+'),
      el('span', { class: 'tpl-new-label' }, 'New template'),
    ));
    view.appendChild(tplGrid);

    // Example templates
    view.appendChild(el('h2', { class: 'h2' }, 'Example templates'));
    const exGrid = el('div', { class: 'tpl-grid' });
    EXAMPLE_TEMPLATES.forEach((t) => exGrid.appendChild(renderTplCard(t, true)));
    view.appendChild(exGrid);
  }
  function renderTplCard(t, isExample) {
    const summary = t.exercises.slice(0, 4).map((te) => {
      const ex = findExerciseDef(te.exerciseId);
      return ex ? ex.name : te.exerciseId;
    }).join(', ');
    const more = t.exercises.length > 4 ? '…' : '';
    return el('a', { class: 'tpl-card' + (isExample ? ' example' : ''), href: '#/template?id=' + t.id },
      el('div', { class: 'tpl-card-head' },
        el('span', { class: 'tpl-card-name' }, t.name),
        isExample ? el('span', { class: 'tpl-card-pill' }, 'preset') : null,
      ),
      el('p', { class: 'tpl-card-body' }, t.exercises.length === 0 ? 'Empty — tap to add exercises' : summary + more),
      el('p', { class: 'tpl-card-meta' }, t.exercises.length + ' exercises'),
    );
  }

  /* ===================== render: template detail ===================== */
  function renderTemplate(view, q) {
    const t = findTemplate(q.id);
    if (!t) { go('#/start'); return; }
    const isExample = !!t.isExample;

    view.appendChild(el('section', { class: 'page-head' },
      el('a', { class: 'back', href: '#/start' }, '‹ All templates'),
      el('p', { class: 'eyebrow' }, isExample ? 'Preset template' : 'Your template'),
      el('h1', { class: 'h1' }, t.name),
    ));

    view.appendChild(el('ul', { class: 'tpl-ex-list' }, ...t.exercises.map((te) => {
      const ex = findExerciseDef(te.exerciseId);
      if (!ex) return null;
      const detail = ex.type === 'duration' ? 'Log minutes' : te.sets + ' sets';
      return el('li', { class: 'tpl-ex-row' },
        el('span', { class: 'tpl-ex-count' }, ex.type === 'duration' ? 'MIN' : (te.sets + '×')),
        el('div', { class: 'tpl-ex-body' },
          el('span', { class: 'tpl-ex-name' }, ex.name),
          el('span', { class: 'tpl-ex-cat' }, ex.categoryLabel),
        ),
        el('span', { class: 'tpl-ex-detail' }, detail),
      );
    })));

    if (t.exercises.length === 0) {
      view.appendChild(el('p', { class: 'empty' }, 'This template has no exercises yet.'));
    }

    const actions = el('div', { class: 'tpl-actions' });
    actions.appendChild(el('button', { class: 'btn-primary big-cta', onclick: () => startSessionFromTemplate(t) },
      t.exercises.length === 0 ? 'Start anyway' : 'Start workout',
    ));
    if (!isExample) {
      actions.appendChild(el('a', { class: 'btn-ghost', href: '#/template/edit?id=' + t.id }, 'Edit'));
      actions.appendChild(el('button', { class: 'btn-danger', onclick: () => {
        if (confirm('Delete this template?')) {
          deleteTemplate(t.id);
          go('#/start');
        }
      } }, 'Delete'));
    }
    view.appendChild(actions);
  }

  /* ===================== render: template editor ===================== */
  function renderTemplateEdit(view, q) {
    const t = state.templates.find((x) => x.id === q.id);
    if (!t) { go('#/start'); return; }

    view.appendChild(el('section', { class: 'page-head' },
      el('a', { class: 'back', href: '#/template?id=' + t.id }, '‹ Back'),
      el('p', { class: 'eyebrow' }, 'Edit template'),
      el('div', { class: 'name-input-wrap' },
        el('input', {
          type: 'text',
          class: 'h1-input',
          value: t.name,
          maxlength: '40',
          id: 'tpl-name',
          oninput: (e) => { t.name = e.target.value || 'Untitled'; saveState(); },
        }),
      ),
    ));

    if (t.exercises.length === 0) {
      view.appendChild(el('p', { class: 'empty' }, 'No exercises yet. Add some below.'));
    } else {
      view.appendChild(el('ul', { class: 'tpl-edit-list' }, ...t.exercises.map((te, idx) => {
        const ex = findExerciseDef(te.exerciseId);
        if (!ex) return null;
        return el('li', { class: 'tpl-edit-row' },
          el('div', { class: 'tpl-ex-body' },
            el('span', { class: 'tpl-ex-name' }, ex.name),
            el('span', { class: 'tpl-ex-cat' }, ex.categoryLabel),
          ),
          ex.type === 'duration' ? el('span', { class: 'tpl-ex-detail' }, 'minutes') :
            el('div', { class: 'set-counter' },
              el('button', { class: 'sc-btn', onclick: () => {
                te.sets = Math.max(1, te.sets - 1); saveState(); route();
              } }, '−'),
              el('span', { class: 'sc-val' }, te.sets + ' sets'),
              el('button', { class: 'sc-btn', onclick: () => {
                te.sets = Math.min(10, te.sets + 1); saveState(); route();
              } }, '+'),
            ),
          el('button', { class: 'icon-x', title: 'Remove', onclick: () => {
            t.exercises.splice(idx, 1); saveState(); route();
          } }, '×'),
        );
      })));
    }

    view.appendChild(el('div', { class: 'tpl-actions' },
      el('button', { class: 'btn-primary', onclick: () => openPickerForTemplate(t.id) }, '+ Add exercises'),
      el('a', { class: 'btn-ghost', href: '#/template?id=' + t.id }, 'Done'),
    ));
  }

  /* ===================== render: live session ===================== */
  function renderSession(view) {
    const sess = state.session;
    if (!sess) { go('#/start'); return; }

    // Session header bar
    view.appendChild(el('div', { class: 'sess-bar' },
      el('button', { class: 'btn-ghost', onclick: () => {
        if (confirm('Cancel workout? Your sets will be lost.')) cancelSession();
      } }, 'Cancel'),
      el('button', { class: 'btn-primary', onclick: finishSession }, 'Finish'),
    ));

    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'Live session'),
      el('div', { class: 'name-input-wrap' },
        el('input', {
          type: 'text',
          class: 'h1-input',
          value: sess.name,
          maxlength: '40',
          oninput: (e) => { sess.name = e.target.value || 'Workout'; saveState(); },
        }),
      ),
      el('div', { class: 'sess-meta' },
        el('span', null, fmtDate(sess.startedAt)),
        el('span', { class: 'sess-meta-sep' }, '·'),
        el('span', { class: 'sess-timer-label' }, 'Timer'),
        el('span', { id: 'sess-timer', class: 'sess-timer-val' },
          fmtClock((Date.now() - sess.startedAt) / 1000)),
      ),
    ));

    if (sess.exercises.length === 0) {
      view.appendChild(el('p', { class: 'empty' }, 'No exercises yet. Tap "Add exercises" to start logging.'));
    } else {
      const wrap = el('div', { class: 'sess-exs' });
      sess.exercises.forEach((sx) => wrap.appendChild(renderSessionExercise(sx)));
      view.appendChild(wrap);
    }

    view.appendChild(el('div', { class: 'sess-actions' },
      el('button', { class: 'btn-primary', onclick: openPickerForSession }, '+ Add exercises'),
    ));

    startTimer();
  }

  function renderSessionExercise(sx) {
    const card = el('div', { class: 'sx-card' });
    card.appendChild(el('div', { class: 'sx-head' },
      el('div', { class: 'sx-head-text' },
        el('span', { class: 'sx-cat' }, sx.categoryLabel),
        el('span', { class: 'sx-name' }, sx.name),
      ),
      el('button', { class: 'icon-x', title: 'Remove from workout', onclick: () => {
        if (confirm('Remove ' + sx.name + ' from this workout?')) {
          removeSessionExercise(sx.id);
          route();
        }
      } }, '×'),
    ));

    if (sx.type === 'duration') {
      card.appendChild(el('div', { class: 'sx-duration' },
        el('div', { class: 'big-num small-pad' }, String(sx.minutes || 0), el('span', { class: 'small' }, 'min')),
        el('div', { class: 'dur-controls' },
          el('button', { class: 'dur-btn', onclick: () => { bumpMinutes(sx.id, -5); route(); } }, '−5'),
          el('button', { class: 'dur-btn', onclick: () => { bumpMinutes(sx.id, -1); route(); } }, '−1'),
          el('button', { class: 'dur-btn primary', onclick: () => { bumpMinutes(sx.id, 5); route(); } }, '+5'),
          el('button', { class: 'dur-btn primary', onclick: () => { bumpMinutes(sx.id, 10); route(); } }, '+10'),
        ),
      ));
    } else {
      // Sets table
      const table = el('div', { class: 'sets-table' });
      table.appendChild(el('div', { class: 'sets-hd' },
        el('span', null, 'Set'),
        el('span', null, 'Weight'),
        el('span', null, 'Reps'),
        el('span', null, 'Volume'),
        el('span', null, ''),
      ));
      sx.sets.forEach((s, i) => {
        table.appendChild(el('div', { class: 'set-row' },
          el('span', { class: 'set-i' }, String(i + 1)),
          el('span', null, s.w + ' kg'),
          el('span', null, s.r),
          el('span', { class: 'set-vol' }, (s.w * s.r) + ' kg'),
          el('button', { class: 'icon-x sm', onclick: () => { removeSetAt(sx.id, i); route(); } }, '×'),
        ));
      });
      card.appendChild(table);

      // Add set form
      const last = sx.sets[sx.sets.length - 1];
      const defW = last ? last.w : (sx.type === 'bodyweight' ? 0 : 60);
      const defR = last ? last.r : 8;
      card.appendChild(el('div', { class: 'add-set-form' },
        el('label', { class: 'field compact' },
          el('span', null, 'kg'),
          el('input', { type: 'number', min: '0', step: '2.5', value: String(defW), inputmode: 'decimal',
            id: 'w-' + sx.id }),
        ),
        el('label', { class: 'field compact' },
          el('span', null, 'reps'),
          el('input', { type: 'number', min: '1', step: '1', value: String(defR), inputmode: 'numeric',
            id: 'r-' + sx.id }),
        ),
        el('button', { class: 'btn-primary small', onclick: () => {
          const w = parseFloat(($('#w-' + sx.id) || {}).value || '0') || 0;
          const r = parseInt(($('#r-' + sx.id) || {}).value || '0', 10) || 0;
          if (r <= 0) return;
          addSetTo(sx.id, w, r);
          route();
        } }, 'Add set'),
      ));
    }
    return card;
  }

  /* ===================== render: exercise picker ===================== */
  function renderPicker(view) {
    if (!picker.context) { go('#/start'); return; }
    const all = allExerciseDefs();

    // Sticky header
    view.appendChild(el('div', { class: 'sess-bar' },
      el('button', { class: 'btn-ghost', onclick: pickerCancel }, 'Cancel'),
      el('button', { class: 'btn-primary', id: 'pick-add-btn', onclick: () => {
        if (picker.selected.size === 0) return;
        pickerCommit();
      } }, 'Add (' + picker.selected.size + ')'),
    ));

    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'Pick exercises'),
      el('h1', { class: 'h1' }, picker.context === 'session' ? 'Add to workout' : 'Add to template'),
    ));

    view.appendChild(el('input', {
      type: 'search',
      class: 'pick-search',
      placeholder: 'Search exercises',
      value: picker.query,
      oninput: (e) => { picker.query = e.target.value.toLowerCase(); filterPickerList(); },
    }));

    view.appendChild(el('div', { class: 'pick-filters' },
      bodyChip('all', 'All'),
      ...CATEGORIES.filter((c) => c.id !== 'overall').map((c) => bodyChip(c.id, c.label)),
    ));

    const list = el('ul', { class: 'pick-list', id: 'pick-list' });
    all.forEach((ex) => {
      const isSel = picker.selected.has(ex.id);
      const li = el('li', {
        class: 'pick-row' + (isSel ? ' selected' : ''),
        'data-id': ex.id,
        'data-name': ex.name.toLowerCase(),
        'data-cat': ex.category,
        onclick: () => {
          if (picker.selected.has(ex.id)) picker.selected.delete(ex.id);
          else picker.selected.add(ex.id);
          li.classList.toggle('selected');
          const btn = $('#pick-add-btn');
          if (btn) btn.textContent = 'Add (' + picker.selected.size + ')';
        },
      },
        el('span', { class: 'pick-check' }, ''),
        el('div', { class: 'pick-row-body' },
          el('span', { class: 'pick-name' }, ex.name),
          el('span', { class: 'pick-cat' }, ex.categoryLabel),
        ),
      );
      list.appendChild(li);
    });
    view.appendChild(list);
    filterPickerList();
  }

  function bodyChip(id, label) {
    return el('button', {
      class: 'chip' + (picker.bodyPart === id ? ' active' : ''),
      onclick: () => { picker.bodyPart = id; route(); },
    }, label);
  }

  function filterPickerList() {
    const list = $('#pick-list');
    if (!list) return;
    const q = picker.query;
    const bp = picker.bodyPart;
    $$('li.pick-row', list).forEach((li) => {
      const name = li.getAttribute('data-name') || '';
      const cat = li.getAttribute('data-cat') || '';
      const matchQ = !q || name.includes(q);
      const matchBp = bp === 'all' || cat === bp;
      li.style.display = (matchQ && matchBp) ? '' : 'none';
    });
  }

  /* ===================== render: profile ===================== */
  function renderProfile(view, q) {
    view.appendChild(el('section', { class: 'page-head' },
      el('p', { class: 'eyebrow' }, 'You'),
      el('h1', { class: 'h1' }, meName()),
      el('p', { class: 'lede' }, 'Your ranks across the club and your training log.'),
    ));

    if (q.just) {
      view.appendChild(el('div', { class: 'toast' }, 'Workout saved · scores credited to the relevant boards.'));
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

    view.appendChild(el('h2', { class: 'h2' }, 'Workout history'));
    if (state.history.length === 0) {
      view.appendChild(el('p', { class: 'empty' }, 'No workouts logged yet. Tap Train to start.'));
    } else {
      view.appendChild(el('ul', { class: 'wk-list' }, ...state.history.slice(0, 14).map(renderWorkoutCard)));
    }
  }
  function renderWorkoutCard(h) {
    const meta = [];
    meta.push(fmtClock(h.durationSec));
    if (h.totals && h.totals.kg) meta.push(h.totals.kg.toLocaleString() + ' kg');
    if (h.totals && h.totals.min) meta.push(h.totals.min + ' min');

    return el('li', { class: 'wk' },
      el('div', { class: 'wk-head' },
        el('span', { class: 'wk-name' }, h.name),
        el('span', { class: 'wk-when' }, fmtAgo(h.ts)),
      ),
      el('div', { class: 'wk-meta' }, ...meta.map((m) => el('span', null, m))),
      el('ul', { class: 'wk-exs' }, ...h.exercises.map((e) =>
        el('li', null,
          el('span', { class: 'wk-ex-count' },
            (e.sets && e.sets.length) ? (e.sets.length + '×') : (e.minutes + 'min')),
          el('span', { class: 'wk-ex-name' }, e.name),
          el('span', { class: 'wk-ex-detail' },
            (e.sets && e.sets.length)
              ? e.sets.map((s) => s.w + '×' + s.r).join(' · ')
              : (e.categoryLabel || '')),
        )
      )),
    );
  }

  /* ===================== misc ===================== */
  function updateGreeting() {
    const tgt = $('#me-name');
    if (tgt) tgt.textContent = meName();
  }

  // Resume into the live session if one is in flight
  if (state.session && !location.hash) location.hash = '#/session';
  updateGreeting();
  route();
})();
