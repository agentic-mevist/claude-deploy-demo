(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Tile size in screen px (isometric diamond)
  const TILE_W = 72;
  const TILE_H = 36;

  // World grid
  const GRID_W = 10;
  const GRID_D = 6;

  // Counter slot positions in world coords (x, y). Single row across the hall.
  const COUNTER_SLOTS = [
    { x: 1.5, y: 2.5 },
    { x: 3.0, y: 2.5 },
    { x: 4.5, y: 2.5 },
    { x: 6.0, y: 2.5 },
    { x: 7.5, y: 2.5 },
  ];

  const ENTRANCE = { x: 0.0, y: 5.2 };
  const EXIT = { x: 9.0, y: 5.2 };

  const TYPES = {
    tourist:  { color: '#8acaff', maxPatience: 30, bagsMin: 1, bagsMax: 2, weight: 50, speed: 1.4 },
    business: { color: '#f0d960', maxPatience: 22, bagsMin: 0, bagsMax: 1, weight: 25, speed: 1.7 },
    family:   { color: '#ff9a7a', maxPatience: 26, bagsMin: 3, bagsMax: 4, weight: 18, speed: 1.05 },
    late:     { color: '#ff5a5a', maxPatience: 10, bagsMin: 1, bagsMax: 2, weight: 7,  speed: 1.9 },
  };

  const COUNTER_COSTS = { regular: 200, priority: 400, dropoff: 300 };
  const COUNTER_TITLE = { regular: 'Обычная стойка', priority: 'Priority', dropoff: 'Drop-off' };
  const COUNTER_COLOR = {
    regular: { top: '#5a7fb8', side: '#3d5a8a', side2: '#2f476e' },
    priority: { top: '#d4a548', side: '#a07a2a', side2: '#7d5e1e' },
    dropoff: { top: '#5fb877', side: '#3d8a52', side2: '#2e6a3e' },
  };

  /** @type {any} */
  let game = null;
  const floatTexts = [];
  let lastTime = 0;
  let cameraOffset = { x: 0, y: 0 };

  function newGame() {
    game = {
      running: false,
      gameOver: false,
      money: 250,
      reputation: 100,
      time: 0,
      passengersServed: 0,
      passengersLost: 0,
      counters: [],
      passengers: [],
      spawnTimer: 1.5,
      spawnInterval: 3.5,
      difficulty: 1.0,
      selectedCounter: null,
      building: null,
    };
    // Start with 2 regular counters
    game.counters.push(makeCounter('regular', COUNTER_SLOTS[1]));
    game.counters.push(makeCounter('regular', COUNTER_SLOTS[3]));
    floatTexts.length = 0;
    document.getElementById('counter-panel').classList.add('hidden');
    document.getElementById('build-banner').classList.add('hidden');
  }

  function makeCounter(type, slot) {
    return {
      id: Math.random().toString(36).slice(2),
      type,
      slot,
      level: 1,
      agentLevel: 1,
      busy: false,
      processing: null,
      queue: [],
      pulse: 0,
    };
  }

  // Logical (CSS) canvas size
  let cssW = window.innerWidth;
  let cssH = window.innerHeight;

  // ----- Coordinate helpers -----
  function worldToScreen(x, y) {
    const ox = cssW / 2 + cameraOffset.x;
    const oy = cssH / 2 - 60 + cameraOffset.y;
    return {
      x: ox + (x - y) * (TILE_W / 2),
      y: oy + (x + y) * (TILE_H / 2),
    };
  }

  // ----- Game loop -----
  function mainLoop(t) {
    const dt = Math.min(0.05, ((t - lastTime) / 1000) || 0);
    lastTime = t;
    if (game && game.running && !game.gameOver) {
      update(dt);
    }
    updateFloatTexts(dt);
    render();
    updateHUD();
    requestAnimationFrame(mainLoop);
  }

  function update(dt) {
    game.time += dt;
    game.difficulty = 1 + game.time / 50;
    game.spawnInterval = Math.max(0.55, 3.5 / game.difficulty);

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnPassenger();
      game.spawnTimer = game.spawnInterval * (0.7 + Math.random() * 0.6);
    }

    updatePassengers(dt);
    updateCounters(dt);

    if (game.reputation <= 0) endGame();
  }

  // ----- Passengers -----
  function spawnPassenger() {
    const type = pickType();
    const t = TYPES[type];
    const bags = t.bagsMin + Math.floor(Math.random() * (t.bagsMax - t.bagsMin + 1));
    const p = {
      id: Math.random().toString(36).slice(2),
      type,
      x: ENTRANCE.x - 0.5 + Math.random() * 0.3,
      y: ENTRANCE.y + (Math.random() - 0.5) * 0.3,
      bags,
      patience: t.maxPatience,
      maxPatience: t.maxPatience,
      state: 'walking',
      counter: null,
      targetX: null,
      targetY: null,
      speed: t.speed,
      bouncePhase: Math.random() * Math.PI * 2,
      angry: false,
    };
    assignCounter(p);
    game.passengers.push(p);
  }

  function pickType() {
    const lateBias = Math.min(20, (game.difficulty - 1) * 8);
    const weights = {
      tourist: TYPES.tourist.weight,
      business: TYPES.business.weight,
      family: TYPES.family.weight + lateBias * 0.4,
      late: TYPES.late.weight + lateBias,
    };
    const total = weights.tourist + weights.business + weights.family + weights.late;
    let r = Math.random() * total;
    for (const k of Object.keys(weights)) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return 'tourist';
  }

  function canUseCounter(p, c) {
    if (c.type === 'dropoff' && p.bags > 1) return false;
    return true;
  }

  function assignCounter(p) {
    const candidates = game.counters.filter(c => canUseCounter(p, c));
    if (candidates.length === 0) {
      p.state = 'leaving';
      p.angry = true;
      p.targetX = EXIT.x;
      p.targetY = EXIT.y;
      game.reputation -= 4;
      flashRep();
      return;
    }
    candidates.sort((a, b) => queueLoad(a, p) - queueLoad(b, p));
    const chosen = candidates[0];
    p.counter = chosen;
    chosen.queue.push(p);
    updateQueueTargets(chosen);
  }

  function queueLoad(c, p) {
    const base = c.queue.length * estimateProcessTime(c, 2);
    const cur = c.busy ? Math.max(0, c.processing.duration - c.processing.progress) : 0;
    let pref = 0;
    if (c.type === 'priority' && (p.type === 'business' || p.type === 'late')) pref = -2.5;
    if (c.type === 'dropoff' && p.bags <= 1) pref = -2.0;
    return base + cur + pref;
  }

  function estimateProcessTime(counter, bags) {
    let base = 2.6 + bags * 1.1;
    base *= Math.pow(0.85, counter.level - 1);
    base *= Math.pow(0.88, counter.agentLevel - 1);
    if (counter.type === 'priority') base *= 0.6;
    if (counter.type === 'dropoff') base *= 0.45;
    return Math.max(0.6, base);
  }

  function updateQueueTargets(counter) {
    const baseX = counter.slot.x;
    const baseY = counter.slot.y;
    counter.queue.forEach((p, i) => {
      p.targetX = baseX;
      p.targetY = baseY + 0.95 + i * 0.55;
    });
  }

  function updatePassengers(dt) {
    for (let i = game.passengers.length - 1; i >= 0; i--) {
      const p = game.passengers[i];
      p.bouncePhase += dt * 9;

      if (p.state === 'walking' || p.state === 'queueing' || p.state === 'leaving') {
        moveTowards(p, p.targetX, p.targetY, p.speed * dt);
      }

      if (p.state === 'walking') {
        const d = dist2(p.x, p.y, p.targetX, p.targetY);
        if (d < 0.04) p.state = 'queueing';
      } else if (p.state === 'leaving') {
        const d = dist2(p.x, p.y, p.targetX, p.targetY);
        if (p.x > EXIT.x - 0.3 || d < 0.05) {
          game.passengers.splice(i, 1);
          continue;
        }
      } else if (p.state === 'queueing') {
        p.patience -= dt;
        if (p.patience <= 0) {
          if (p.counter) {
            p.counter.queue = p.counter.queue.filter(q => q !== p);
            updateQueueTargets(p.counter);
          }
          p.state = 'leaving';
          p.angry = true;
          p.targetX = EXIT.x;
          p.targetY = EXIT.y;
          game.reputation -= 6;
          game.passengersLost++;
          flashRep();
          spawnFloatText(p.x, p.y, '−6 ★', '#ff7777');
        }
      }
    }
  }

  function moveTowards(p, tx, ty, step) {
    if (tx == null || ty == null) return;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= step) {
      p.x = tx;
      p.y = ty;
      return;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
  }

  function dist2(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  // ----- Counters -----
  function updateCounters(dt) {
    for (const c of game.counters) {
      c.pulse = Math.max(0, c.pulse - dt);
      if (c.busy) {
        c.processing.progress += dt;
        if (c.processing.progress >= c.processing.duration) {
          const p = c.processing.passenger;
          c.busy = false;
          c.processing = null;
          const patienceRatio = Math.max(0, p.patience / p.maxPatience);
          const baseReward = 12 + p.bags * 5;
          const reward = Math.round(baseReward * (0.6 + patienceRatio * 0.9));
          game.money += reward;
          game.passengersServed++;
          if (patienceRatio > 0.55 && game.reputation < 100) {
            game.reputation = Math.min(100, game.reputation + 0.4);
          }
          p.state = 'leaving';
          p.targetX = EXIT.x;
          p.targetY = EXIT.y;
          spawnFloatText(c.slot.x, c.slot.y - 0.3, `+$${reward}`, '#88e89a');
          c.pulse = 1;
        }
      } else {
        const front = c.queue[0];
        if (front && front.state === 'queueing') {
          const targetX = c.slot.x;
          const targetY = c.slot.y + 0.95;
          if (dist2(front.x, front.y, targetX, targetY) < 0.18) {
            front.state = 'processing';
            front.x = c.slot.x;
            front.y = c.slot.y + 0.4;
            c.queue.shift();
            updateQueueTargets(c);
            const duration = estimateProcessTime(c, front.bags);
            c.busy = true;
            c.processing = { passenger: front, progress: 0, duration };
          }
        }
      }
    }
  }

  // ----- Float texts -----
  function spawnFloatText(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 1.3, maxLife: 1.3 });
  }
  function updateFloatTexts(dt) {
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      floatTexts[i].life -= dt;
      if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
    }
  }

  // ----- Rendering -----
  function render() {
    ctx.fillStyle = '#0e1628';
    ctx.fillRect(0, 0, cssW, cssH);

    drawFloor();
    drawEntranceExit();

    // Depth-sorted scene
    const items = [];
    if (game) {
      for (const c of game.counters) {
        items.push({ depth: c.slot.x + c.slot.y, render: () => drawCounter(c) });
      }
      for (const p of game.passengers) {
        items.push({ depth: p.x + p.y + 0.001, render: () => drawPassenger(p) });
      }
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.render();

    drawFloatTexts();
  }

  function drawFloor() {
    for (let y = 0; y < GRID_D; y++) {
      for (let x = 0; x < GRID_W; x++) {
        diamond(x, y, ((x + y) % 2 === 0) ? '#28395d' : '#1f3050', 'rgba(255,255,255,0.03)');
      }
    }
    // Build mode: highlight empty slots
    if (game && game.building) {
      for (const slot of COUNTER_SLOTS) {
        if (game.counters.some(c => c.slot === slot)) continue;
        const flash = 0.25 + 0.15 * Math.sin(performance.now() / 200);
        diamond(slot.x - 0.5, slot.y - 0.5, `rgba(120,200,255,${flash})`, 'rgba(150,220,255,0.5)');
      }
    }
  }

  function diamond(x, y, fill, stroke) {
    const p = worldToScreen(x, y);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
    ctx.lineTo(p.x, p.y + TILE_H);
    ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawEntranceExit() {
    // Entrance arrow
    const ent = worldToScreen(ENTRANCE.x, ENTRANCE.y);
    ctx.fillStyle = '#3aaa7a';
    ctx.beginPath();
    ctx.arc(ent.x, ent.y + TILE_H / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('→', ent.x, ent.y + TILE_H / 2 + 4);
    ctx.fillStyle = '#a0e0c0';
    ctx.font = 'bold 10px system-ui';
    ctx.fillText('ВХОД', ent.x, ent.y + TILE_H / 2 + 26);

    // Exit
    const ex = worldToScreen(EXIT.x, EXIT.y);
    ctx.fillStyle = '#aa4878';
    ctx.beginPath();
    ctx.arc(ex.x, ex.y + TILE_H / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('✓', ex.x, ex.y + TILE_H / 2 + 4);
    ctx.fillStyle = '#e0a0c0';
    ctx.font = 'bold 10px system-ui';
    ctx.fillText('БАГАЖ', ex.x, ex.y + TILE_H / 2 + 26);
  }

  function drawCounter(c) {
    const p = worldToScreen(c.slot.x, c.slot.y);
    const base = { x: p.x, y: p.y + TILE_H / 2 };
    const w = TILE_W * 0.75;
    const h = TILE_H * 0.75;
    const height = 26;
    const col = COUNTER_COLOR[c.type];

    // Pulse glow on serving
    if (c.pulse > 0) {
      ctx.fillStyle = `rgba(140, 240, 160, ${c.pulse * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(base.x, base.y + height / 2, w * 0.7, h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Front face (right)
    ctx.fillStyle = col.side2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y + h / 2);
    ctx.lineTo(base.x + w / 2, base.y);
    ctx.lineTo(base.x + w / 2, base.y + height);
    ctx.lineTo(base.x, base.y + h / 2 + height);
    ctx.closePath();
    ctx.fill();

    // Left face
    ctx.fillStyle = col.side;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y + h / 2);
    ctx.lineTo(base.x - w / 2, base.y);
    ctx.lineTo(base.x - w / 2, base.y + height);
    ctx.lineTo(base.x, base.y + h / 2 + height);
    ctx.closePath();
    ctx.fill();

    // Top
    ctx.fillStyle = col.top;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - h / 2);
    ctx.lineTo(base.x + w / 2, base.y);
    ctx.lineTo(base.x, base.y + h / 2);
    ctx.lineTo(base.x - w / 2, base.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Monitor screen on top
    ctx.fillStyle = '#1a2840';
    const mx = base.x - 7, my = base.y - h / 2 + 2;
    ctx.fillRect(mx, my, 14, 8);
    ctx.fillStyle = c.busy ? '#88e89a' : '#5a7ab8';
    ctx.fillRect(mx + 1, my + 1, 12, 6);

    // Agent (behind counter)
    drawCharacter(base.x, base.y - 4, '#ffd9b0', '#3a5570', 0.95, c.agentLevel);

    // Type letter badge
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    const letter = c.type === 'regular' ? 'R' : c.type === 'priority' ? 'P' : 'D';
    ctx.fillText(letter, base.x, base.y + height + 12);

    // Level pips
    const pipY = base.y + height + 22;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < c.level ? '#ffd060' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(base.x - 14 + i * 7, pipY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Processing bar
    if (c.busy) {
      const ratio = c.processing.progress / c.processing.duration;
      const bw = 42, bh = 5;
      const bx = base.x - bw / 2;
      const by = base.y - 28;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#88e89a';
      ctx.fillRect(bx, by, bw * ratio, bh);
    }

    // Selection indicator
    if (game.selectedCounter === c) {
      ctx.strokeStyle = '#ffd060';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - h / 2 - 6);
      ctx.lineTo(base.x + w / 2 + 6, base.y);
      ctx.lineTo(base.x, base.y + h / 2 + 6);
      ctx.lineTo(base.x - w / 2 - 6, base.y);
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  function drawPassenger(p) {
    const sp = worldToScreen(p.x, p.y);
    const type = TYPES[p.type];
    const moving = p.state === 'walking' || p.state === 'leaving' || (p.state === 'queueing' && dist2(p.x, p.y, p.targetX, p.targetY) > 0.05);
    const bounce = moving ? Math.sin(p.bouncePhase) * 1.8 : 0;
    const x = sp.x;
    const y = sp.y + TILE_H / 4 + bounce;

    // Tint red if angry
    const headColor = p.angry ? '#ff7070' : type.color;
    const bodyColor = p.angry ? '#7a2a2a' : '#283950';
    drawCharacter(x, y, headColor, bodyColor, 0.88, 0);

    // Bags
    if (p.bags > 0 && p.state !== 'processing') {
      for (let i = 0; i < Math.min(p.bags, 4); i++) {
        const bx = x + 7 + (i % 2) * 3;
        const by = y - 4 + Math.floor(i / 2) * 5;
        ctx.fillStyle = i % 2 === 0 ? '#8a6a3a' : '#6a4a2a';
        ctx.fillRect(bx, by, 5, 6);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(bx + 0.5, by + 0.5, 4, 5);
      }
    }

    // Patience bar above head if queueing or processing
    if (p.state === 'queueing') {
      const ratio = Math.max(0, p.patience / p.maxPatience);
      const bw = 22, bh = 3;
      const bx = x - bw / 2;
      const by = y - 22;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      const hue = ratio * 110;
      ctx.fillStyle = `hsl(${hue}, 75%, 55%)`;
      ctx.fillRect(bx, by, bw * ratio, bh);
    }
  }

  function drawCharacter(x, y, headColor, bodyColor, scale = 1, agentLevel = 0) {
    const s = scale;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9 * s, 7 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = bodyColor;
    roundRect(ctx, x - 4.5 * s, y - 4 * s, 9 * s, 10 * s, 2);
    ctx.fill();
    // Head
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(x, y - 8 * s, 4.2 * s, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#1a2030';
    ctx.beginPath();
    ctx.arc(x - 1.5 * s, y - 8.5 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.arc(x + 1.5 * s, y - 8.5 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
    // Agent stars (level)
    if (agentLevel > 0) {
      ctx.fillStyle = '#ffd060';
      for (let i = 0; i < agentLevel; i++) {
        ctx.beginPath();
        ctx.arc(x - 4 + i * 2.5, y - 14 * s, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawFloatTexts() {
    for (const f of floatTexts) {
      const sp = worldToScreen(f.x, f.y);
      const t = 1 - f.life / f.maxLife;
      ctx.font = 'bold 14px system-ui';
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.textAlign = 'center';
      ctx.fillText(f.text, sp.x, sp.y - t * 36);
      ctx.globalAlpha = 1;
    }
  }

  // ----- HUD -----
  function updateHUD() {
    if (!game) return;
    document.getElementById('money').textContent = Math.floor(game.money);
    document.getElementById('reputation').textContent = Math.max(0, Math.floor(game.reputation));
    document.getElementById('time').textContent = formatTime(game.time);
    document.getElementById('served').textContent = game.passengersServed;

    document.querySelectorAll('.shop-btn').forEach(btn => {
      const type = btn.dataset.build;
      const slotsFull = game.counters.length >= COUNTER_SLOTS.length;
      btn.disabled = game.money < COUNTER_COSTS[type] || slotsFull;
      btn.classList.toggle('armed', game.building === type);
    });

    const cp = document.getElementById('counter-panel');
    if (game.selectedCounter) {
      const c = game.selectedCounter;
      document.getElementById('cp-title').textContent = COUNTER_TITLE[c.type];
      document.getElementById('cp-level').textContent = c.level;
      document.getElementById('cp-agent').textContent = c.agentLevel;
      const speedMult = (1 / Math.pow(0.85, c.level - 1) / Math.pow(0.88, c.agentLevel - 1));
      document.getElementById('cp-speed').textContent = speedMult.toFixed(2) + '×';
      const upCounterCost = 100 * c.level;
      const upAgentCost = 80 * c.agentLevel;
      document.getElementById('up-counter-cost').textContent = c.level >= 5 ? 'MAX' : '$' + upCounterCost;
      document.getElementById('up-agent-cost').textContent = c.agentLevel >= 5 ? 'MAX' : '$' + upAgentCost;
      document.getElementById('upgrade-counter').disabled = game.money < upCounterCost || c.level >= 5;
      document.getElementById('upgrade-agent').disabled = game.money < upAgentCost || c.agentLevel >= 5;
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }

  function flashRep() {
    const el = document.getElementById('hud-rep');
    if (!el || !el.animate) return;
    el.animate(
      [{ background: 'rgba(255,80,80,0.55)' }, { background: 'rgba(10,14,26,0.85)' }],
      { duration: 450 }
    );
  }

  function endGame() {
    game.gameOver = true;
    const best = parseFloat(localStorage.getItem('abt_best_time') || '0');
    if (game.time > best) {
      localStorage.setItem('abt_best_time', game.time.toString());
    }
    const bestTime = Math.max(best, game.time);
    document.getElementById('final-time').textContent = formatTime(game.time);
    document.getElementById('final-served').textContent = game.passengersServed;
    document.getElementById('final-lost').textContent = game.passengersLost;
    document.getElementById('best-time').textContent = formatTime(bestTime);
    document.getElementById('game-over').classList.remove('hidden');
  }

  // ----- Input -----
  canvas.addEventListener('click', e => {
    if (!game || !game.running || game.gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Building mode: try placing on empty slot
    if (game.building) {
      let placed = false;
      for (const slot of COUNTER_SLOTS) {
        if (game.counters.some(c => c.slot === slot)) continue;
        const p = worldToScreen(slot.x, slot.y);
        const d = Math.hypot(sx - p.x, sy - (p.y + TILE_H / 2));
        if (d < 40) {
          const cost = COUNTER_COSTS[game.building];
          if (game.money >= cost) {
            game.money -= cost;
            game.counters.push(makeCounter(game.building, slot));
            spawnFloatText(slot.x, slot.y - 0.3, 'NEW!', '#88e89a');
          }
          placed = true;
          break;
        }
      }
      game.building = null;
      document.getElementById('build-banner').classList.add('hidden');
      if (placed) return;
    }

    // Counter click → select
    let best = null, bestDist = 42;
    for (const c of game.counters) {
      const p = worldToScreen(c.slot.x, c.slot.y);
      const d = Math.hypot(sx - p.x, sy - (p.y + TILE_H / 2));
      if (d < bestDist) { best = c; bestDist = d; }
    }
    if (best) {
      game.selectedCounter = best;
      document.getElementById('counter-panel').classList.remove('hidden');
    } else {
      game.selectedCounter = null;
      document.getElementById('counter-panel').classList.add('hidden');
    }
  });

  // Shop buttons
  document.querySelectorAll('.shop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!game || !game.running) return;
      const type = btn.dataset.build;
      if (game.money < COUNTER_COSTS[type]) return;
      if (game.counters.length >= COUNTER_SLOTS.length) return;
      game.building = game.building === type ? null : type;
      document.getElementById('build-banner').classList.toggle('hidden', !game.building);
    });
  });

  document.getElementById('build-cancel').addEventListener('click', () => {
    if (!game) return;
    game.building = null;
    document.getElementById('build-banner').classList.add('hidden');
  });

  // Counter panel
  document.getElementById('upgrade-counter').addEventListener('click', () => {
    if (!game || !game.selectedCounter) return;
    const c = game.selectedCounter;
    const cost = 100 * c.level;
    if (c.level >= 5 || game.money < cost) return;
    game.money -= cost;
    c.level++;
    c.pulse = 1;
    spawnFloatText(c.slot.x, c.slot.y - 0.3, 'Lvl up!', '#ffd060');
  });
  document.getElementById('upgrade-agent').addEventListener('click', () => {
    if (!game || !game.selectedCounter) return;
    const c = game.selectedCounter;
    const cost = 80 * c.agentLevel;
    if (c.agentLevel >= 5 || game.money < cost) return;
    game.money -= cost;
    c.agentLevel++;
    c.pulse = 1;
    spawnFloatText(c.slot.x, c.slot.y - 0.3, 'Agent +1', '#9fbfff');
  });
  document.getElementById('close-panel').addEventListener('click', () => {
    if (!game) return;
    game.selectedCounter = null;
    document.getElementById('counter-panel').classList.add('hidden');
  });

  // Start / restart
  document.getElementById('start').addEventListener('click', () => {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    newGame();
    game.running = true;
  });
  document.getElementById('restart').addEventListener('click', () => {
    document.getElementById('game-over').classList.add('hidden');
    newGame();
    game.running = true;
  });

  // Resize: keep drawing in CSS pixel space, scale up buffer for DPR
  function resize() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Initialize placeholder so start screen has something rendered behind it
  newGame();

  requestAnimationFrame(mainLoop);
})();
