import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const winScreen = document.querySelector("#win-screen");
const startButton = document.querySelector("#start-button");
const againButton = document.querySelector("#again-button");
const coinsEl = document.querySelector("#coins");
const checkpointEl = document.querySelector("#checkpoint");
const speedStatusEl = document.querySelector("#speed-status");
const jumpStatusEl = document.querySelector("#jump-status");
const speedButton = document.querySelector("#speed-coil");
const jumpButton = document.querySelector("#jump-coil");
const winCopy = document.querySelector("#win-copy");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8bd7ff);
scene.fog = new THREE.Fog(0x8bd7ff, 28, 130);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const clock = new THREE.Clock();
const keys = new Set();

const state = {
  started: false,
  coins: 0,
  checkpoint: 0,
  speedCoil: false,
  jumpCoil: false,
  messageTimer: 0,
  cameraYaw: 0,
  cameraPitch: 0.62,
};

const player = {
  position: new THREE.Vector3(0, 2.2, 0),
  velocity: new THREE.Vector3(),
  yaw: 0,
  grounded: false,
  jumpsUsed: 0,
  mesh: null,
};

const platforms = [];
const hazards = [];
const checkpoints = [];
const coins = [];
let finishPad;
let spawnPoint = new THREE.Vector3(0, 2.2, 0);

const materials = {
  platform: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.55, metalness: 0.05 }),
  platformAlt: new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.58 }),
  start: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.56 }),
  finish: new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x6b4e00, roughness: 0.35 }),
  checkpoint: new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x064e3b, roughness: 0.42 }),
  spike: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.42 }),
  laser: new THREE.MeshBasicMaterial({ color: 0xff1f70 }),
  coin: new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x8a5a00, roughness: 0.35, metalness: 0.35 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xffd28a, roughness: 0.62 }),
  shirt: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.66 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 }),
  coilSpeed: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  coilJump: new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
};

function setupWorld() {
  scene.clear();
  platforms.length = 0;
  hazards.length = 0;
  checkpoints.length = 0;
  coins.length = 0;

  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-12, 28, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  scene.add(sun);

  const skyFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.9 }),
  );
  skyFloor.position.y = -8;
  skyFloor.rotation.x = -Math.PI / 2;
  skyFloor.receiveShadow = true;
  scene.add(skyFloor);

  buildCourse();
  createPlayer();
}

function addPlatform(x, y, z, w, d, material = materials.platform) {
  const platform = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), material);
  platform.position.set(x, y, z);
  platform.castShadow = true;
  platform.receiveShadow = true;
  platform.userData.kind = "platform";
  platform.userData.size = new THREE.Vector3(w, 0.45, d);
  platforms.push(platform);
  scene.add(platform);
  return platform;
}

function buildCourse() {
  const route = [
    [0, 0, 0, 7, 7, "start"],
    [0, 0.8, -9, 5.5, 5],
    [4.5, 1.6, -18, 4.8, 4.8],
    [-3.5, 2.4, -27, 5.2, 4.8, "checkpoint"],
    [-8, 3.2, -38, 4.6, 4.6],
    [0, 4.0, -49, 5.4, 4.6],
    [8, 4.7, -60, 4.8, 4.8, "checkpoint"],
    [4, 5.6, -72, 4.8, 4.8],
    [-4, 6.5, -84, 5.2, 4.8],
    [0, 7.4, -96, 6.6, 5.8, "checkpoint"],
    [0, 8.6, -111, 5.4, 4.8],
    [7, 9.4, -124, 5.0, 5.0],
    [0, 10.4, -138, 7.0, 6.0, "finish"],
  ];

  route.forEach(([x, y, z, w, d, kind], index) => {
    const material = kind === "start" ? materials.start : kind === "finish" ? materials.finish : index % 2 ? materials.platformAlt : materials.platform;
    const platform = addPlatform(x, y, z, w, d, material);
    if (kind === "checkpoint") addCheckpoint(platform, checkpoints.length + 1);
    if (kind === "finish") finishPad = platform;
    if (index > 0 && kind !== "finish") addCoin(x, y + 1.05, z);
  });

  addSpikes(4.5, 2.1, -18, 4);
  addLaser(-3.5, 3.45, -27, 5.4, 0);
  addSpikes(-8, 3.75, -38, 3);
  addLaser(0, 5.0, -49, 5.8, Math.PI / 2);
  addSpikes(8, 5.25, -60, 4);
  addLaser(4, 6.55, -72, 4.8, 0);
  addSpikes(-4, 7.05, -84, 4);
  addLaser(0, 8.45, -96, 6.2, Math.PI / 2);
  addSpikes(7, 9.95, -124, 4);
}

function addCheckpoint(platform, number) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12), materials.checkpoint);
  pole.position.set(platform.position.x - 1.75, platform.position.y + 1.25, platform.position.z);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.08), materials.checkpoint);
  flag.position.set(platform.position.x - 1.18, platform.position.y + 2.05, platform.position.z);
  const group = new THREE.Group();
  group.add(pole, flag);
  group.userData = { number, platform };
  checkpoints.push(group);
  scene.add(group);
}

function addCoin(x, y, z) {
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 28), materials.coin);
  coin.position.set(x, y, z);
  coin.rotation.x = Math.PI / 2;
  coin.userData.collected = false;
  coins.push(coin);
  scene.add(coin);
}

function addSpikes(x, y, z, count) {
  for (let i = 0; i < count; i += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 4), materials.spike);
    spike.position.set(x - (count - 1) * 0.55 + i * 1.1, y, z);
    spike.rotation.y = Math.PI / 4;
    spike.castShadow = true;
    spike.userData.kind = "spike";
    spike.userData.radius = 0.62;
    hazards.push(spike);
    scene.add(spike);
  }
}

function addLaser(x, y, z, length, rotationY) {
  const laser = new THREE.Mesh(new THREE.BoxGeometry(length, 0.16, 0.16), materials.laser);
  laser.position.set(x, y, z);
  laser.rotation.y = rotationY;
  laser.userData.kind = "laser";
  laser.userData.size = new THREE.Vector3(length, 0.32, 0.55);
  hazards.push(laser);
  scene.add(laser);

  const glow = new THREE.PointLight(0xff1f70, 1.3, 7, 2);
  glow.position.copy(laser.position);
  scene.add(glow);
}

function createPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), materials.shirt);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), materials.skin);
  head.position.y = 1.9;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.65, 0.42), materials.pants);
  legs.position.y = 0.45;
  group.add(body, head, legs);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  player.mesh = group;
  scene.add(group);
}

function startGame() {
  startScreen.classList.add("hidden");
  winScreen.classList.add("hidden");
  state.started = true;
  state.coins = 0;
  state.checkpoint = 0;
  state.speedCoil = false;
  state.jumpCoil = false;
  spawnPoint = new THREE.Vector3(0, 2.2, 0);
  coins.forEach((coin) => {
    coin.visible = true;
    coin.userData.collected = false;
  });
  respawn();
  updateHud();
}

function respawn() {
  player.position.copy(spawnPoint);
  player.velocity.set(0, 0, 0);
  player.grounded = false;
  player.jumpsUsed = 0;
}

function updatePlayer(delta) {
  const speed = state.speedCoil ? 10.5 : 7.0;
  const previousY = player.position.y;
  const cameraForward = new THREE.Vector3(
    -Math.sin(state.cameraYaw),
    0,
    -Math.cos(state.cameraYaw),
  );
  const cameraRight = new THREE.Vector3(-cameraForward.z, 0, cameraForward.x);
  const move = new THREE.Vector3();
  if (isKeyDown("KeyW", "w")) move.add(cameraForward);
  if (isKeyDown("KeyS", "s")) move.sub(cameraForward);
  if (isKeyDown("KeyA", "a")) move.sub(cameraRight);
  if (isKeyDown("KeyD", "d")) move.add(cameraRight);
  if (move.lengthSq() > 0) {
    move.normalize();
    player.position.x += move.x * speed * delta;
    player.position.z += move.z * speed * delta;
    player.yaw = Math.atan2(move.x, move.z);
  }

  player.velocity.y -= 22 * delta;
  player.position.y += player.velocity.y * delta;
  player.grounded = false;
  resolvePlatforms(previousY);

  if (player.position.y < -10) respawn();
  if (player.mesh) {
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.yaw;
  }
}

function jump() {
  if (!state.started || player.jumpsUsed >= 2) return;
  player.velocity.y = state.jumpCoil ? 13.2 : 9.4;
  player.grounded = false;
  player.jumpsUsed += 1;
}

function isKeyDown(...names) {
  return names.some((name) => keys.has(name));
}

function resolvePlatforms(previousY) {
  const px = player.position.x;
  const pz = player.position.z;
  platforms.forEach((platform) => {
    const size = platform.userData.size;
    const top = platform.position.y + size.y / 2;
    const insideX = Math.abs(px - platform.position.x) <= size.x / 2 + 0.35;
    const insideZ = Math.abs(pz - platform.position.z) <= size.z / 2 + 0.35;
    if (insideX && insideZ && player.velocity.y <= 0 && previousY >= top && player.position.y <= top) {
      player.position.y = top;
      player.velocity.y = 0;
      player.grounded = true;
      player.jumpsUsed = 0;
    }
  });
}

function updateCamera(delta) {
  const turnSpeed = 1.9;
  if (keys.has("ArrowLeft")) state.cameraYaw += turnSpeed * delta;
  if (keys.has("ArrowRight")) state.cameraYaw -= turnSpeed * delta;
  if (keys.has("ArrowUp")) state.cameraPitch = Math.min(0.95, state.cameraPitch + turnSpeed * 0.55 * delta);
  if (keys.has("ArrowDown")) state.cameraPitch = Math.max(0.28, state.cameraPitch - turnSpeed * 0.55 * delta);

  const distance = 12.2;
  const height = Math.sin(state.cameraPitch) * distance;
  const flatDistance = Math.cos(state.cameraPitch) * distance;
  const offset = new THREE.Vector3(
    Math.sin(state.cameraYaw) * flatDistance,
    height,
    Math.cos(state.cameraYaw) * flatDistance,
  );
  const target = player.position.clone().add(offset);
  camera.position.lerp(target, Math.min(1, delta * 5));
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
}

function updateCoins() {
  coins.forEach((coin) => {
    coin.rotation.z += 0.045;
    coin.position.y += Math.sin(clock.elapsedTime * 3 + coin.position.z) * 0.002;
    if (!coin.userData.collected && coin.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1, 0))) < 1.25) {
      coin.userData.collected = true;
      coin.visible = false;
      state.coins += 1;
      updateHud();
    }
  });
}

function updateCheckpoints() {
  checkpoints.forEach((checkpoint) => {
    const platform = checkpoint.userData.platform;
    const number = checkpoint.userData.number;
    checkpoint.rotation.y += 0.01;
    if (number > state.checkpoint && player.position.distanceTo(platform.position.clone().add(new THREE.Vector3(0, 1.2, 0))) < 2.8) {
      state.checkpoint = number;
      state.coins += number * 2;
      spawnPoint = platform.position.clone().add(new THREE.Vector3(0, 2.2, 0));
      updateHud();
    }
  });
}

function updateHazards() {
  hazards.forEach((hazard) => {
    if (hazard.userData.kind === "laser") {
      hazard.material.color.offsetHSL(0.002, 0, 0);
      const size = hazard.userData.size;
      const dx = Math.abs(player.position.x - hazard.position.x);
      const dz = Math.abs(player.position.z - hazard.position.z);
      const nearY = Math.abs(player.position.y + 0.9 - hazard.position.y) < 0.85;
      const rotated = Math.abs(Math.sin(hazard.rotation.y)) > 0.5;
      const hit = rotated ? dz < size.x / 2 && dx < size.z : dx < size.x / 2 && dz < size.z;
      if (hit && nearY) respawn();
      return;
    }
    if (hazard.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 0.6, 0))) < hazard.userData.radius + 0.55) {
      respawn();
    }
  });
}

function updateFinish() {
  if (finishPad && player.position.distanceTo(finishPad.position.clone().add(new THREE.Vector3(0, 1.2, 0))) < 3.2) {
    state.started = false;
    winCopy.textContent = `You finished with ${state.coins} coins and ${state.checkpoint} checkpoints.`;
    winScreen.classList.remove("hidden");
  }
}

function buySpeedCoil() {
  if (state.speedCoil || state.coins < 8) return;
  state.coins -= 8;
  state.speedCoil = true;
  addCoil("speed");
  updateHud();
}

function buyJumpCoil() {
  if (state.jumpCoil || state.coins < 12) return;
  state.coins -= 12;
  state.jumpCoil = true;
  addCoil("jump");
  updateHud();
}

function addCoil(type) {
  const material = type === "speed" ? materials.coilSpeed : materials.coilJump;
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 28), material);
  coil.position.set(type === "speed" ? -0.55 : 0.55, 1.1, 0.05);
  coil.rotation.x = Math.PI / 2;
  player.mesh.add(coil);
}

function updateHud() {
  coinsEl.textContent = state.coins;
  checkpointEl.textContent = state.checkpoint;
  speedStatusEl.textContent = state.speedCoil ? "On" : "Off";
  jumpStatusEl.textContent = state.jumpCoil ? "On" : "Off";
  speedButton.disabled = state.speedCoil || state.coins < 8;
  jumpButton.disabled = state.jumpCoil || state.coins < 12;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  if (state.started) {
    updatePlayer(delta);
    updateCoins();
    updateCheckpoints();
    updateHazards();
    updateFinish();
  }
  updateCamera(delta);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  keys.add(event.key.toLowerCase());
  if (event.code === "Space") {
    event.preventDefault();
    jump();
  }
  if (event.code.startsWith("Arrow")) event.preventDefault();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  keys.delete(event.key.toLowerCase());
});

startButton.addEventListener("click", startGame);
againButton.addEventListener("click", startGame);
speedButton.addEventListener("click", buySpeedCoil);
jumpButton.addEventListener("click", buyJumpCoil);

setupWorld();
respawn();
updateHud();
camera.position.set(0, 9, 13);
animate();
