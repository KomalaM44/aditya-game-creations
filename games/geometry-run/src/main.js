import "./styles.css";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startScreen = document.querySelector("#start-screen");
const endScreen = document.querySelector("#end-screen");
const startButton = document.querySelector("#start-button");
const againButton = document.querySelector("#again-button");
const statsEl = document.querySelector("#stats");
const progressEl = document.querySelector("#progress");
const endCopy = document.querySelector("#end-copy");
const levelButtons = [...document.querySelectorAll(".level")];
const skinButtons = [...document.querySelectorAll(".skin")];

const levels = {
  easy: { label: "Easy", speed: 5.2, gap: 300, obstacleScale: 0.8, length: 3600 },
  medium: { label: "Medium", speed: 6.0, gap: 260, obstacleScale: 0.95, length: 4200 },
  hard: { label: "Hard", speed: 6.8, gap: 230, obstacleScale: 1.05, length: 4700 },
  expert: { label: "Expert", speed: 7.4, gap: 205, obstacleScale: 1.15, length: 5200 },
  legend: { label: "Legend", speed: 8.0, gap: 185, obstacleScale: 1.25, length: 5800 },
  mythic: { label: "Mythic", speed: 8.6, gap: 170, obstacleScale: 1.35, length: 6400 },
  demon: { label: "Demon", speed: 9.2, gap: 155, obstacleScale: 1.45, length: 7000 },
  ultraDemon: { label: "Ultra Demon", speed: 10.0, gap: 138, obstacleScale: 1.6, length: 7800 },
};

const skins = {
  classic: { body: "#facc15", side: "#ca8a04", eye: "#111827", mouth: "#111827" },
  neon: { body: "#22d3ee", side: "#2563eb", eye: "#05101f", mouth: "#05101f" },
  fire: { body: "#fb923c", side: "#dc2626", eye: "#111827", mouth: "#111827" },
  mint: { body: "#34d399", side: "#047857", eye: "#052e16", mouth: "#052e16" },
  shadow: { body: "#64748b", side: "#1e293b", eye: "#f8fafc", mouth: "#f8fafc" },
};

const state = {
  running: false,
  selectedLevel: "easy",
  selectedSkin: "classic",
  attempt: 1,
  scroll: 0,
  lastTime: 0,
  groundY: 0,
  ceilingY: 0,
  course: [],
  portals: [],
  particles: [],
  portalHits: new Set(),
};

const player = {
  x: 160,
  y: 0,
  size: 46,
  vy: 0,
  gravitySign: 1,
  mode: "cube",
  rotation: 0,
  jetTimer: 0,
  alive: true,
  jumpsUsed: 0,
};

const input = {
  pressed: false,
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.groundY = Math.round(window.innerHeight * 0.72);
  state.ceilingY = Math.round(window.innerHeight * 0.22);
  if (!state.running) resetPlayer();
}

function resetPlayer() {
  player.size = Math.max(34, Math.min(48, window.innerWidth * 0.052));
  player.x = Math.max(90, window.innerWidth * 0.18);
  player.gravitySign = 1;
  player.mode = "cube";
  player.jetTimer = 0;
  player.vy = 0;
  player.y = state.groundY - player.size;
  player.rotation = 0;
  player.alive = true;
  player.jumpsUsed = 0;
}

function buildCourse() {
  const config = levels[state.selectedLevel];
  const course = [];
  const portals = [];
  let x = 760;
  let i = 0;
  while (x < config.length) {
    const pattern = i % 9;
    if (pattern === 0) {
      course.push({ type: "spike", x, w: 42 * config.obstacleScale, h: 54 * config.obstacleScale });
    } else if (pattern === 1) {
      course.push({ type: "block", x, w: 58 * config.obstacleScale, h: 70 * config.obstacleScale });
    } else if (pattern === 2) {
      course.push({ type: "spike", x, w: 42 * config.obstacleScale, h: 56 * config.obstacleScale });
      course.push({ type: "spike", x: x + 56, w: 42 * config.obstacleScale, h: 56 * config.obstacleScale });
    } else if (pattern === 3) {
      portals.push({ type: "flip", x, y: state.groundY - 120, r: 34 });
      course.push({ type: "ceilingBlock", x: x + 250, w: 64 * config.obstacleScale, h: 70 * config.obstacleScale });
    } else if (pattern === 4) {
      course.push({ type: "spike", x, w: 46 * config.obstacleScale, h: 64 * config.obstacleScale, ceiling: true });
    } else if (pattern === 5) {
      portals.push({ type: "jet", x, y: state.ceilingY + 160, r: 35 });
      course.push({ type: "block", x: x + 260, w: 72 * config.obstacleScale, h: 96 * config.obstacleScale });
      course.push({ type: "ceilingBlock", x: x + 470, w: 80 * config.obstacleScale, h: 86 * config.obstacleScale });
    } else if (pattern === 6) {
      portals.push({ type: "cube", x, y: state.groundY - 126, r: 34 });
      course.push({ type: "spike", x: x + 210, w: 44 * config.obstacleScale, h: 58 * config.obstacleScale });
    } else if (pattern === 7) {
      course.push({ type: "block", x, w: 50 * config.obstacleScale, h: 58 * config.obstacleScale });
      course.push({ type: "spike", x: x + 96, w: 42 * config.obstacleScale, h: 54 * config.obstacleScale });
    } else {
      portals.push({ type: "flip", x, y: state.groundY - 118, r: 34 });
    }
    x += config.gap + (i % 3) * 42;
    i += 1;
  }
  portals.push({ type: "cube", x: config.length - 380, y: state.groundY - 125, r: 34 });
  state.course = course;
  state.portals = portals;
}

function startGame(resetAttempt = true) {
  startScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
  if (resetAttempt) state.attempt = 1;
  state.scroll = 0;
  state.portalHits.clear();
  state.particles.length = 0;
  buildCourse();
  resetPlayer();
  state.running = true;
  state.lastTime = performance.now();
  updateHud();
}

function respawn() {
  state.attempt += 1;
  state.scroll = 0;
  state.portalHits.clear();
  state.particles.length = 0;
  buildCourse();
  resetPlayer();
  updateHud();
}

function win() {
  state.running = false;
  endCopy.textContent = `You cleared ${levels[state.selectedLevel].label} on attempt ${state.attempt}.`;
  endScreen.classList.remove("hidden");
}

function jump() {
  if (!state.running) return;
  if (player.mode === "jet") {
    player.vy += -player.gravitySign * 0.62;
    addParticles(player.x - 10, player.y + player.size / 2, 3, "#f97316");
    return;
  }
  const floor = getPlayerFloor();
  const onSurface = player.gravitySign === 1 ? player.y + player.size >= floor - 0.5 : player.y <= floor + 0.5;
  if (onSurface || player.jumpsUsed < 2) {
    player.vy = -player.gravitySign * 14.6;
    player.jumpsUsed = onSurface ? 1 : player.jumpsUsed + 1;
    addParticles(player.x + player.size / 2, floor, 8, "#38bdf8");
  }
}

function getPlayerFloor() {
  return player.gravitySign === 1 ? state.groundY : state.ceilingY;
}

function setLevel(level) {
  state.selectedLevel = level;
  levelButtons.forEach((button) => button.classList.toggle("active", button.dataset.level === level));
  startGame(true);
}

function setSkin(skin) {
  state.selectedSkin = skin;
  skinButtons.forEach((button) => button.classList.toggle("active", button.dataset.skin === skin));
}

function update(delta) {
  if (!state.running) return;
  const config = levels[state.selectedLevel];
  state.scroll += config.speed * delta * 60;

  if (input.pressed && player.mode === "jet") {
    player.vy += -player.gravitySign * 0.42 * delta * 60;
  }

  const gravity = player.mode === "jet" ? 0.45 : 0.74;
  player.vy += player.gravitySign * gravity * delta * 60;
  player.vy = Math.max(-15, Math.min(15, player.vy));
  player.y += player.vy * delta * 60;
  player.rotation += (player.mode === "jet" ? 0.03 : 0.13) * delta * 60 * player.gravitySign;

  const floor = getPlayerFloor();
  if (player.gravitySign === 1 && player.y + player.size > floor) {
    player.y = floor - player.size;
    player.vy = 0;
    player.jumpsUsed = 0;
  }
  if (player.gravitySign === -1 && player.y < floor) {
    player.y = floor;
    player.vy = 0;
    player.jumpsUsed = 0;
  }

  handlePortals();
  resolveBlockPlatforms();

  if (player.y < state.ceilingY - 12 || player.y + player.size > state.groundY + 12) {
    respawn();
    return;
  }

  if (hitsObstacle()) {
    addParticles(player.x + player.size / 2, player.y + player.size / 2, 22, "#ef4444");
    respawn();
    return;
  }

  updateParticles(delta);
  if (state.scroll >= config.length) win();
  updateHud();
}

function resolveBlockPlatforms() {
  const playerRect = getPlayerRect(2);
  state.course.forEach((obstacle) => {
    if (obstacle.type !== "block" && obstacle.type !== "ceilingBlock") return;
    const rect = getObstacleRect(obstacle);
    if (!rectsOverlap(playerRect, rect)) return;

    const playerBottom = player.y + player.size;
    const playerTop = player.y;
    const previousBottom = playerBottom - player.vy;
    const previousTop = playerTop - player.vy;

    if (obstacle.type === "block" && player.gravitySign === 1 && player.vy >= 0 && previousBottom <= rect.y + 10) {
      player.y = rect.y - player.size;
      player.vy = 0;
      player.jumpsUsed = 0;
      return;
    }

    if (obstacle.type === "ceilingBlock" && player.gravitySign === -1 && player.vy <= 0 && previousTop >= rect.y + rect.h - 10) {
      player.y = rect.y + rect.h;
      player.vy = 0;
      player.jumpsUsed = 0;
    }
  });
}

function handlePortals() {
  const playerRect = getPlayerRect();
  state.portals.forEach((portal, index) => {
    if (state.portalHits.has(index)) return;
    const sx = portal.x - state.scroll;
    const portalRect = { x: sx - portal.r, y: portal.y - portal.r, w: portal.r * 2, h: portal.r * 2 };
    if (!rectsOverlap(playerRect, portalRect)) return;
    state.portalHits.add(index);
    if (portal.type === "flip") {
      player.gravitySign *= -1;
      player.vy = player.gravitySign * 2;
      addParticles(sx, portal.y, 18, "#a855f7");
    }
    if (portal.type === "jet") {
      player.mode = "jet";
      player.vy = -player.gravitySign * 3;
      addParticles(sx, portal.y, 18, "#f97316");
    }
    if (portal.type === "cube") {
      player.mode = "cube";
      player.gravitySign = 1;
      player.vy = 0;
      addParticles(sx, portal.y, 18, "#22c55e");
    }
  });
}

function hitsObstacle() {
  const playerRect = getPlayerRect(5);
  return state.course.some((obstacle) => {
    if (obstacle.type === "block" || obstacle.type === "ceilingBlock") {
      const rect = getObstacleRect(obstacle);
      const standingOnTop =
        obstacle.type === "block" &&
        player.gravitySign === 1 &&
        Math.abs(player.y + player.size - rect.y) < 2 &&
        player.x + player.size > rect.x + 5 &&
        player.x < rect.x + rect.w - 5;
      const standingUnderCeiling =
        obstacle.type === "ceilingBlock" &&
        player.gravitySign === -1 &&
        Math.abs(player.y - (rect.y + rect.h)) < 2 &&
        player.x + player.size > rect.x + 5 &&
        player.x < rect.x + rect.w - 5;
      if (standingOnTop || standingUnderCeiling) return false;
    }
    const rect = getObstacleRect(obstacle);
    return rectsOverlap(playerRect, rect);
  });
}

function getPlayerRect(padding = 0) {
  return {
    x: player.x + padding,
    y: player.y + padding,
    w: player.size - padding * 2,
    h: player.size - padding * 2,
  };
}

function getObstacleRect(obstacle) {
  const x = obstacle.x - state.scroll;
  if (obstacle.type === "block") {
    return { x, y: state.groundY - obstacle.h, w: obstacle.w, h: obstacle.h };
  }
  if (obstacle.type === "ceilingBlock") {
    return { x, y: state.ceilingY, w: obstacle.w, h: obstacle.h };
  }
  if (obstacle.ceiling) {
    return { x, y: state.ceilingY, w: obstacle.w, h: obstacle.h };
  }
  return { x, y: state.groundY - obstacle.h, w: obstacle.w, h: obstacle.h };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function addParticles(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 9,
      vy: (Math.random() - 0.5) * 9,
      life: 0.45 + Math.random() * 0.45,
      color,
    });
  }
}

function updateParticles(delta) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * delta * 60;
    p.y += p.vy * delta * 60;
    p.vy += 0.18 * delta * 60;
    p.life -= delta;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function draw() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const hue = (state.scroll * 0.02) % 360;
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, `hsl(${220 + Math.sin(state.scroll * 0.004) * 20}, 64%, 10%)`);
  bg.addColorStop(0.55, `hsl(${260 + Math.cos(state.scroll * 0.003) * 22}, 66%, 15%)`);
  bg.addColorStop(1, "#070914");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawBackgroundRectangles(width, height, hue);
  drawTrack(width);
  drawPortals();
  drawObstacles();
  drawParticles();
  drawPlayer();
}

function drawBackgroundRectangles(width, height, hue) {
  for (let i = 0; i < 30; i += 1) {
    const depth = 0.22 + (i % 6) * 0.08;
    const x = ((i * 190 - state.scroll * depth) % (width + 240)) - 120;
    const y = 90 + ((i * 73) % Math.max(220, height - 180));
    const w = 50 + (i % 5) * 34;
    const h = 18 + (i % 4) * 22;
    ctx.fillStyle = `hsla(${(hue + i * 24) % 360}, 85%, 62%, ${0.08 + depth * 0.12})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `hsla(${(hue + i * 24) % 360}, 85%, 72%, ${0.16 + depth * 0.12})`;
    ctx.strokeRect(x, y, w, h);
  }
}

function drawTrack(width) {
  ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
  ctx.fillRect(0, state.groundY, width, window.innerHeight - state.groundY);
  ctx.fillRect(0, 0, width, state.ceilingY);

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, state.groundY);
  ctx.lineTo(width, state.groundY);
  ctx.moveTo(0, state.ceilingY);
  ctx.lineTo(width, state.ceilingY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  const gridOffset = -state.scroll % 48;
  for (let x = gridOffset; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, state.ceilingY);
    ctx.lineTo(x, state.groundY);
    ctx.stroke();
  }
}

function drawObstacles() {
  state.course.forEach((obstacle) => {
    const x = obstacle.x - state.scroll;
    if (x < -140 || x > window.innerWidth + 140) return;
    if (obstacle.type === "spike") drawSpike(x, obstacle);
    if (obstacle.type === "block" || obstacle.type === "ceilingBlock") drawBlock(x, obstacle);
  });
}

function drawSpike(x, obstacle) {
  const ceiling = Boolean(obstacle.ceiling);
  const baseY = ceiling ? state.ceilingY : state.groundY;
  ctx.fillStyle = "#ef4444";
  ctx.strokeStyle = "#fecaca";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ceiling) {
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + obstacle.w / 2, baseY + obstacle.h);
    ctx.lineTo(x + obstacle.w, baseY);
  } else {
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + obstacle.w / 2, baseY - obstacle.h);
    ctx.lineTo(x + obstacle.w, baseY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawBlock(x, obstacle) {
  const y = obstacle.type === "ceilingBlock" ? state.ceilingY : state.groundY - obstacle.h;
  const gradient = ctx.createLinearGradient(x, y, x + obstacle.w, y + obstacle.h);
  gradient.addColorStop(0, "#2563eb");
  gradient.addColorStop(1, "#7c3aed");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, obstacle.w, obstacle.h);
  ctx.strokeStyle = "#bfdbfe";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, obstacle.w, obstacle.h);
}

function drawPortals() {
  state.portals.forEach((portal) => {
    const x = portal.x - state.scroll;
    if (x < -100 || x > window.innerWidth + 100) return;
    const color = portal.type === "flip" ? "#a855f7" : portal.type === "jet" ? "#f97316" : "#22c55e";
    ctx.save();
    ctx.translate(x, portal.y);
    ctx.rotate(performance.now() * 0.003);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, portal.r * 0.62, portal.r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeRect(-portal.r * 0.32, -portal.r * 0.32, portal.r * 0.64, portal.r * 0.64);
    ctx.restore();
  });
}

function drawPlayer() {
  const skin = skins[state.selectedSkin];
  ctx.save();
  ctx.translate(player.x + player.size / 2, player.y + player.size / 2);
  ctx.rotate(player.rotation);
  ctx.fillStyle = skin.side;
  ctx.fillRect(-player.size / 2 + 6, -player.size / 2 + 6, player.size, player.size);
  ctx.fillStyle = skin.body;
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(-player.size / 2, -player.size / 2, player.size, player.size);

  ctx.fillStyle = skin.eye;
  ctx.fillRect(-player.size * 0.24, -player.size * 0.18, player.size * 0.13, player.size * 0.13);
  ctx.fillRect(player.size * 0.15, -player.size * 0.18, player.size * 0.13, player.size * 0.13);
  ctx.fillRect(-player.size * 0.18, player.size * 0.18, player.size * 0.42, player.size * 0.08);

  if (player.mode === "jet") {
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(-player.size / 2 - 4, 0);
    ctx.lineTo(-player.size / 2 - 34 - Math.random() * 12, -12);
    ctx.lineTo(-player.size / 2 - 34 - Math.random() * 12, 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles() {
  state.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 5, 5);
    ctx.globalAlpha = 1;
  });
}

function updateHud() {
  const config = levels[state.selectedLevel];
  statsEl.textContent = `Attempt ${state.attempt} · ${config.label} · ${player.mode === "jet" ? "Jet" : player.gravitySign === -1 ? "Upside Down" : "Cube"}`;
  progressEl.style.width = `${Math.min(100, (state.scroll / config.length) * 100)}%`;
}

function loop(time) {
  const delta = Math.min((time - state.lastTime) / 1000 || 0, 0.033);
  state.lastTime = time;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    input.pressed = true;
    jump();
  }
});
window.addEventListener("keyup", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") input.pressed = false;
});
canvas.addEventListener("pointerdown", () => {
  input.pressed = true;
  jump();
});
window.addEventListener("pointerup", () => {
  input.pressed = false;
});

levelButtons.forEach((button) => button.addEventListener("click", () => setLevel(button.dataset.level)));
skinButtons.forEach((button) => button.addEventListener("click", () => setSkin(button.dataset.skin)));
startButton.addEventListener("click", () => startGame(true));
againButton.addEventListener("click", () => startGame(true));

resize();
buildCourse();
resetPlayer();
updateHud();
requestAnimationFrame(loop);
