import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const gameOverScreen = document.querySelector("#game-over");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const healthEl = document.querySelector("#health");
const p2HealthEl = document.querySelector("#p2-health");
const coinsEl = document.querySelector("#coins");
const waveEl = document.querySelector("#wave");
const monstersEl = document.querySelector("#monsters");
const bossPill = document.querySelector("#boss-pill");
const endKicker = document.querySelector("#end-kicker");
const endTitle = document.querySelector("#end-title");
const endCopy = document.querySelector("#end-copy");
const toolButtons = [...document.querySelectorAll(".tool")];
const shopButtons = [...document.querySelectorAll(".shop-item")];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93c5fd);
scene.fog = new THREE.Fog(0xb7d2e8, 22, 86);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 160);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();

const player = {
  position: new THREE.Vector3(0, 1.7, 8),
  yaw: 0,
  pitch: -0.12,
  velocityY: 0,
  grounded: true,
  health: 100,
  coins: 0,
  tool: "wood",
  cooldown: 0,
};

const secondPlayer = {
  position: new THREE.Vector3(4, 0, 6.5),
  yaw: 0,
  health: 100,
  cooldown: 0,
  mesh: null,
};

const state = {
  started: false,
  wave: 1,
  spawnTimer: 0,
  monstersToSpawn: 6,
  bossActive: false,
  gameEnded: false,
  nextAutoBuyIndex: 0,
};

const keys = new Set();
const blocks = [];
const enemies = [];
const bullets = [];
const defenses = [];
const groundTiles = [];

const blockTypes = {
  wood: { color: 0x9a5a28, hp: 45, roughness: 0.9 },
  glass: { color: 0x7dd3fc, hp: 25, roughness: 0.12, transparent: true, opacity: 0.48 },
  obsidian: { color: 0x241638, hp: 140, roughness: 0.55 },
};

const shopItems = [
  { type: "turret", cost: 30 },
  { type: "soldier", cost: 55 },
  { type: "jet", cost: 120 },
];

function makeNoiseTexture(baseColor, fleckColor, size = 128, flecks = 900) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = baseColor;
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < flecks; i += 1) {
    const alpha = 0.08 + Math.random() * 0.2;
    context.fillStyle = `${fleckColor}${Math.floor(alpha * 255)
      .toString(16)
      .padStart(2, "0")}`;
    context.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeWoodTexture() {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 128;
  textureCanvas.height = 128;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = "#8a5528";
  context.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 5) {
    context.strokeStyle = y % 2 ? "rgba(52, 29, 13, 0.38)" : "rgba(232, 177, 94, 0.18)";
    context.beginPath();
    context.moveTo(0, y + Math.sin(y) * 3);
    context.bezierCurveTo(32, y + 5, 74, y - 4, 128, y + Math.cos(y) * 3);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const textures = {
  grass: makeNoiseTexture("#3f7f3c", "#173b1f", 128, 1100),
  concrete: makeNoiseTexture("#66785a", "#263323", 96, 650),
  clothRed: makeNoiseTexture("#8f1f1f", "#2b0d0d", 96, 400),
  clothBlue: makeNoiseTexture("#1d4ed8", "#0b1d4f", 96, 420),
  clothGreen: makeNoiseTexture("#166534", "#052e16", 96, 420),
  skin: makeNoiseTexture("#b77850", "#5b2f1f", 96, 260),
  metal: makeNoiseTexture("#66717f", "#1f2937", 96, 320),
  wood: makeWoodTexture(),
};

textures.grass.repeat.set(18, 18);
textures.concrete.repeat.set(3, 3);
textures.wood.repeat.set(2, 2);

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x5f8d4f, map: textures.grass, roughness: 0.92 }),
  grid: new THREE.MeshStandardMaterial({ color: 0x748367, map: textures.concrete, roughness: 0.82 }),
  monster: new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.72 }),
  monsterBelly: new THREE.MeshStandardMaterial({ color: 0x3b0f0f, roughness: 0.9 }),
  monsterClaw: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.28 }),
  monsterEye: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
  humanEye: new THREE.MeshBasicMaterial({ color: 0x111827 }),
  boot: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.82 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xc08457, map: textures.skin, roughness: 0.7 }),
  attackerClothes: new THREE.MeshStandardMaterial({ color: 0x991b1b, map: textures.clothRed, roughness: 0.78 }),
  attackerPants: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 }),
  teammate: new THREE.MeshStandardMaterial({ color: 0x2563eb, map: textures.clothBlue, roughness: 0.7 }),
  turret: new THREE.MeshStandardMaterial({ color: 0x64748b, map: textures.metal, metalness: 0.45, roughness: 0.32 }),
  soldier: new THREE.MeshStandardMaterial({ color: 0x14532d, map: textures.clothGreen, roughness: 0.78 }),
  jet: new THREE.MeshStandardMaterial({ color: 0x475569, map: textures.metal, metalness: 0.55, roughness: 0.25 }),
  boss: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.48 }),
  bossCore: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d }),
  sword: new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.18 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.32 }),
  bullet: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
};

function makeBlockMaterial(type) {
  const config = blockTypes[type];
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    map: type === "wood" ? textures.wood : undefined,
    roughness: config.roughness,
    metalness: type === "obsidian" ? 0.15 : 0,
    transparent: Boolean(config.transparent),
    opacity: config.opacity ?? 1,
  });
  return material;
}

function setupWorld() {
  scene.clear();
  scene.background = new THREE.Color(0xb7d2e8);
  scene.fog = new THREE.Fog(0xb7d2e8, 22, 86);
  blocks.length = 0;
  enemies.length = 0;
  bullets.length = 0;
  defenses.length = 0;
  groundTiles.length = 0;

  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x24351f, 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d4, 2.75);
  sun.position.set(24, 32, 16);
  sun.castShadow = true;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00015;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x9cc9ff, 0.55);
  fill.position.set(-20, 12, -18);
  scene.add(fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.kind = "ground";
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(50, 50, 0xa8b58e, 0x536243);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  for (let x = -5; x <= 5; x += 1) {
    for (let z = -5; z <= 5; z += 1) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.04, 0.98), materials.grid);
      tile.position.set(x, 0.02, z);
      tile.userData.kind = "ground";
      groundTiles.push(tile);
      scene.add(tile);
    }
  }

  addEnvironmentProps();
  addBaseCore();
  addWeaponModels();
  addSecondPlayerModel();
}

function addBaseCore() {
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.12, 1.8, 24),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, emissive: 0x043c33, roughness: 0.42, metalness: 0.08 }),
  );
  core.position.set(0, 0.9, 0);
  core.castShadow = true;
  core.receiveShadow = true;
  core.userData.kind = "core";
  scene.add(core);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.055, 8, 32), materials.turret);
  rim.position.set(0, 1.72, 0);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  scene.add(rim);
}

function addEnvironmentProps() {
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x5f665d, map: textures.metal, roughness: 0.9 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5b371e, map: textures.wood, roughness: 0.88 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x234d20, map: textures.grass, roughness: 0.82 });

  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.25;
    const radius = 18 + Math.random() * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;
    if (i % 3 === 0) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 8), trunkMaterial);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.1, 9), leafMaterial);
      trunk.position.y = 0.9;
      leaves.position.y = 2.55;
      tree.add(trunk, leaves);
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI;
      tree.traverse((part) => {
        if (part.isMesh) {
          part.castShadow = true;
          part.receiveShadow = true;
        }
      });
      scene.add(tree);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.45, 0), rockMaterial);
      rock.position.set(x, 0.18, z);
      rock.scale.y = 0.45 + Math.random() * 0.6;
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      scene.add(rock);
    }
  }
}

function addWeaponModels() {
  camera.children
    .filter((child) => child.userData.weapon)
    .forEach((child) => camera.remove(child));

  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), materials.sword);
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.12), materials.gun);
  blade.position.y = 0.48;
  hilt.position.y = 0.02;
  sword.add(blade, hilt);
  sword.position.set(-0.45, -0.38, -0.85);
  sword.rotation.set(-0.25, 0.25, 0.1);
  sword.userData.weapon = "sword";
  camera.add(sword);

  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.8), materials.gun);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.62), materials.sword);
  barrel.position.z = -0.64;
  gun.add(body, barrel);
  gun.position.set(0.42, -0.36, -0.78);
  gun.rotation.set(0.02, -0.18, 0);
  gun.userData.weapon = "gun";
  camera.add(gun);
  scene.add(camera);
}

function addSecondPlayerModel() {
  secondPlayer.mesh = createTeammateMesh();
  secondPlayer.mesh.position.copy(secondPlayer.position);
  scene.add(secondPlayer.mesh);
}

function startGame() {
  setupWorld();
  Object.assign(player, {
    position: new THREE.Vector3(0, 1.7, 8),
    yaw: 0,
    pitch: -0.12,
    velocityY: 0,
    grounded: true,
    health: 100,
    coins: 0,
    tool: "wood",
    cooldown: 0,
  });
  Object.assign(secondPlayer, {
    position: new THREE.Vector3(4, 0, 6.5),
    yaw: 0,
    health: 100,
    cooldown: 0,
    mesh: secondPlayer.mesh,
  });
  secondPlayer.mesh?.position.copy(secondPlayer.position);
  secondPlayer.mesh?.rotation.set(0, secondPlayer.yaw, 0);
  Object.assign(state, {
    started: true,
    wave: 1,
    spawnTimer: 1,
    monstersToSpawn: 6,
    bossActive: false,
    gameEnded: false,
    nextAutoBuyIndex: 0,
  });
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  setTool("wood");
  updateHud();
}

function setTool(tool) {
  player.tool = tool;
  toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
  camera.children.forEach((child) => {
    if (child.userData.weapon) child.visible = child.userData.weapon === tool;
  });
}

function requestPointerLockSafe() {
  try {
    const lock = canvas.requestPointerLock?.();
    lock?.catch?.(() => {});
  } catch {
    // Pointer lock can be unavailable in automated or embedded browsers.
  }
}

function placeBlock() {
  const targets = [...groundTiles];
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(targets, false);
  const hit = hits[0];
  if (!hit || hit.object.userData.kind !== "ground") return;

  const pos = hit.object.position.clone();
  pos.y = 0.55;
  pos.x = Math.round(pos.x);
  pos.z = Math.round(pos.z);

  if (Math.abs(pos.x) > 6 || Math.abs(pos.z) > 6 || pos.distanceTo(player.position) < 1.4) return;
  if (blocks.some((block) => block.mesh.position.distanceTo(pos) < 0.2)) return;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), makeBlockMaterial(player.tool));
  mesh.position.copy(pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.kind = "block";
  scene.add(mesh);
  blocks.push({ mesh, hp: blockTypes[player.tool].hp, type: player.tool });
}

function useSword() {
  if (player.cooldown > 0) return;
  player.cooldown = 0.32;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(enemies.map((enemy) => enemy.mesh), true);
  const hit = hits.find((entry) => entry.distance < 3.8);
  if (hit) damageEnemy(findEnemy(hit.object), 48);
}

function shootGun() {
  if (player.cooldown > 0) return;
  player.cooldown = 0.14;
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  fireProjectile(player.position, direction, 40, 34, 1.7);
}

function shootSecondPlayer() {
  if (secondPlayer.cooldown > 0 || secondPlayer.health <= 0) return;
  secondPlayer.cooldown = 0.24;
  const direction = new THREE.Vector3(-Math.sin(secondPlayer.yaw), 0, -Math.cos(secondPlayer.yaw));
  fireProjectile(secondPlayer.position.clone().add(new THREE.Vector3(0, 1.05, 0)), direction, 34, 31, 1.6);
}

function fireProjectile(origin, direction, damage, speed, life) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), materials.bullet);
  mesh.position.copy(origin).add(direction.clone().normalize().multiplyScalar(0.7));
  scene.add(mesh);
  bullets.push({ mesh, direction: direction.clone().normalize(), life, damage, speed });
}

function spawnEnemy(isBoss = false) {
  const angle = Math.random() * Math.PI * 2;
  const radius = isBoss ? 29 : 23 + Math.random() * 8;
  const mesh = isBoss ? createBossMesh() : createMonsterMesh();
  mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  mesh.castShadow = true;
  scene.add(mesh);
  enemies.push({
    mesh,
    hp: isBoss ? 950 : 42 + state.wave * 6,
    speed: isBoss ? 1.05 : 1.45 + state.wave * 0.06,
    damage: isBoss ? 22 : 8,
    attackTimer: 0,
    boss: isBoss,
    walkTime: Math.random() * Math.PI * 2,
  });
}

function createMonsterMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.82, 6, 12), materials.attackerClothes);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), materials.skin);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), materials.monsterBelly);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 8), materials.skin);
  const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), materials.humanEye);
  const eyeB = eyeA.clone();
  const armGeometry = new THREE.CapsuleGeometry(0.055, 0.62, 4, 8);
  const legGeometry = new THREE.CapsuleGeometry(0.07, 0.64, 4, 8);
  const handGeometry = new THREE.SphereGeometry(0.065, 8, 8);
  const bootGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.24);
  const limbs = [];

  body.position.y = 0.95;
  head.position.set(0, 1.62, -0.02);
  hair.position.set(0, 1.72, 0.01);
  hair.scale.set(1, 0.52, 0.85);
  eyeA.position.set(-0.075, 1.64, -0.22);
  eyeB.position.set(0.075, 1.64, -0.22);
  nose.position.set(0, 1.6, -0.255);
  nose.rotation.x = -Math.PI / 2;
  group.add(body, head, hair, nose, eyeA, eyeB);

  [
    [-0.37, 0.97, -0.02, -0.28, armGeometry, materials.skin],
    [0.37, 0.97, -0.02, 0.28, armGeometry, materials.skin],
    [-0.14, 0.35, 0.02, 0.08, legGeometry, materials.attackerPants],
    [0.14, 0.35, 0.02, -0.08, legGeometry, materials.attackerPants],
  ].forEach(([x, y, z, swing, geometry, material], index) => {
    const limb = new THREE.Mesh(geometry, material);
    limb.position.set(x, y, z);
    limb.rotation.z = swing;
    group.add(limb);
    if (index < 2) {
      const hand = new THREE.Mesh(handGeometry, materials.skin);
      hand.position.set(x + Math.sign(x) * 0.05, 0.58, -0.02);
      group.add(hand);
    } else {
      const boot = new THREE.Mesh(bootGeometry, materials.boot);
      boot.position.set(x, 0.03, -0.08);
      group.add(boot);
    }
    limbs.push(limb);
    limb.userData.stepOffset = index % 2 ? Math.PI : 0;
  });

  group.userData.limbs = limbs;
  group.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  return group;
}

function createBossMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.82, 2.25, 8, 18), materials.boss);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), materials.skin);
  const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), materials.humanEye);
  const eyeB = eyeA.clone();
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), materials.skin);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 24), materials.bossCore);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.48, 5), materials.bossCore);
  const armGeometry = new THREE.CapsuleGeometry(0.18, 1.8, 6, 12);
  const leftArm = new THREE.Mesh(armGeometry, materials.boss);
  const rightArm = new THREE.Mesh(armGeometry, materials.boss);
  body.position.y = 1.4;
  head.position.y = 2.9;
  eyeA.position.set(-0.16, 2.95, -0.42);
  eyeB.position.set(0.16, 2.95, -0.42);
  nose.position.set(0, 2.86, -0.52);
  nose.rotation.x = -Math.PI / 2;
  core.position.set(0, 1.55, -0.95);
  crown.position.y = 3.42;
  leftArm.position.set(-1.15, 1.25, 0);
  rightArm.position.set(1.15, 1.25, 0);
  leftArm.rotation.z = 0.35;
  rightArm.rotation.z = -0.35;
  group.add(body, head, eyeA, eyeB, nose, core, crown, leftArm, rightArm);
  group.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  return group;
}

function findEnemy(object) {
  let current = object;
  while (current.parent && !enemies.some((enemy) => enemy.mesh === current)) current = current.parent;
  return enemies.find((enemy) => enemy.mesh === current);
}

function damageEnemy(enemy, damage) {
  if (!enemy) return;
  enemy.hp -= damage;
  enemy.mesh.scale.setScalar(1 + Math.min(0.18, damage / 180));
  setTimeout(() => {
    if (enemy.mesh) enemy.mesh.scale.setScalar(1);
  }, 80);
  if (enemy.hp <= 0) {
    scene.remove(enemy.mesh);
    enemies.splice(enemies.indexOf(enemy), 1);
    player.coins += enemy.boss ? 150 : 12 + state.wave * 3;
    autoBuyDefenses();
    if (enemy.boss) winGame();
  }
}

function buyShopItem(type) {
  const item = shopItems.find((entry) => entry.type === type);
  if (!item || !state.started || state.gameEnded || player.coins < item.cost) return;
  player.coins -= item.cost;
  if (type === "turret") addTurret();
  if (type === "soldier") addSoldier();
  if (type === "jet") addFighterJet();
  updateHud();
}

function autoBuyDefenses() {
  if (!state.started || state.gameEnded) return;
  let bought = true;
  while (bought) {
    bought = false;
    const item = shopItems[state.nextAutoBuyIndex];
    if (player.coins >= item.cost) {
      buyShopItem(item.type);
      state.nextAutoBuyIndex = (state.nextAutoBuyIndex + 1) % shopItems.length;
      bought = true;
    }
  }
}

function addTurret() {
  const position = nextDefensePosition(2.8 + defenses.length * 0.15);
  const mesh = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.32, 16), materials.turret);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.42), materials.turret);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.72), materials.sword);
  base.position.y = 0.16;
  head.position.y = 0.5;
  barrel.position.set(0, 0.52, -0.52);
  mesh.add(base, head, barrel);
  mesh.position.copy(position);
  scene.add(mesh);
  defenses.push({ type: "turret", mesh, cooldown: 0, range: 13, damage: 15 });
}

function addSoldier() {
  const position = nextDefensePosition(3.9 + defenses.length * 0.12);
  const mesh = createSoldierMesh();
  mesh.position.copy(position);
  scene.add(mesh);
  defenses.push({ type: "soldier", mesh, cooldown: 0, range: 11, damage: 11, walkTime: 0 });
}

function addFighterJet() {
  const mesh = createJetMesh();
  mesh.position.set(0, 7.5, -9);
  scene.add(mesh);
  defenses.push({ type: "jet", mesh, cooldown: 0, range: 38, damage: 24, angle: 0 });
}

function nextDefensePosition(radius) {
  const angle = defenses.length * 1.85 + 0.6;
  return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
}

function createSoldierMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.72, 6, 10), materials.soldier);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), materials.skin);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8), materials.turret);
  const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), materials.humanEye);
  const eyeB = eyeA.clone();
  const bootA = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.2), materials.boot);
  const bootB = bootA.clone();
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.72), materials.gun);
  body.position.y = 0.82;
  head.position.y = 1.42;
  helmet.position.y = 1.52;
  helmet.scale.y = 0.55;
  eyeA.position.set(-0.06, 1.44, -0.18);
  eyeB.position.set(0.06, 1.44, -0.18);
  bootA.position.set(-0.11, 0.04, -0.07);
  bootB.position.set(0.11, 0.04, -0.07);
  gun.position.set(0.28, 0.98, -0.36);
  group.add(body, head, helmet, eyeA, eyeB, bootA, bootB, gun);
  group.traverse((part) => {
    if (part.isMesh) part.castShadow = true;
  });
  return group;
}

function createTeammateMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.82, 6, 12), materials.teammate);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), materials.skin);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), materials.turret);
  const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), materials.humanEye);
  const eyeB = eyeA.clone();
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), materials.skin);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.78), materials.gun);
  const armA = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.55, 4, 8), materials.skin);
  const armB = armA.clone();
  const legA = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), materials.attackerPants);
  const legB = legA.clone();
  const bootA = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.22), materials.boot);
  const bootB = bootA.clone();
  body.position.y = 0.88;
  head.position.y = 1.54;
  helmet.position.y = 1.64;
  helmet.scale.y = 0.55;
  eyeA.position.set(-0.065, 1.56, -0.19);
  eyeB.position.set(0.065, 1.56, -0.19);
  nose.position.set(0, 1.52, -0.23);
  nose.rotation.x = -Math.PI / 2;
  gun.position.set(0.26, 1.02, -0.4);
  armA.position.set(-0.34, 0.93, 0);
  armB.position.set(0.34, 0.93, 0);
  legA.position.set(-0.13, 0.34, 0);
  legB.position.set(0.13, 0.34, 0);
  bootA.position.set(-0.13, 0.03, -0.08);
  bootB.position.set(0.13, 0.03, -0.08);
  group.add(body, head, helmet, eyeA, eyeB, nose, gun, armA, armB, legA, legB, bootA, bootB);
  group.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  return group;
}

function createJetMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.3, 12), materials.jet);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.46), materials.jet);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.34), materials.sword);
  body.rotation.x = -Math.PI / 2;
  wing.position.z = 0.12;
  tail.position.z = 0.85;
  group.add(body, wing, tail);
  return group;
}

function updatePlayer(delta) {
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const movement = new THREE.Vector3();
  if (keys.has("KeyW")) movement.add(forward);
  if (keys.has("KeyS")) movement.sub(forward);
  if (keys.has("KeyA")) movement.sub(right);
  if (keys.has("KeyD")) movement.add(right);
  if (movement.lengthSq()) {
    movement.normalize().multiplyScalar(delta * 7);
    const next = player.position.clone().add(movement);
    next.x = THREE.MathUtils.clamp(next.x, -24, 24);
    next.z = THREE.MathUtils.clamp(next.z, -24, 24);
    if (!blocks.some((block) => block.mesh.position.distanceTo(new THREE.Vector3(next.x, block.mesh.position.y, next.z)) < 0.82)) {
      player.position.copy(next);
    }
  }
  if (keys.has("Space") && player.grounded) {
    player.velocityY = 8.4;
    player.grounded = false;
  }
  player.velocityY -= 20 * delta;
  player.position.y += player.velocityY * delta;
  if (player.position.y <= 1.7) {
    player.position.y = 1.7;
    player.velocityY = 0;
    player.grounded = true;
  }
  player.cooldown = Math.max(0, player.cooldown - delta);
  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function updateSecondPlayer(delta) {
  secondPlayer.cooldown = Math.max(0, secondPlayer.cooldown - delta);
  if (secondPlayer.health <= 0 || !secondPlayer.mesh) {
    if (secondPlayer.mesh) secondPlayer.mesh.visible = false;
    return;
  }

  const movement = new THREE.Vector3();
  if (keys.has("ArrowUp")) movement.z -= 1;
  if (keys.has("ArrowDown")) movement.z += 1;
  if (keys.has("ArrowLeft")) movement.x -= 1;
  if (keys.has("ArrowRight")) movement.x += 1;

  if (movement.lengthSq()) {
    movement.normalize();
    secondPlayer.yaw = Math.atan2(-movement.x, -movement.z);
    const next = secondPlayer.position.clone().add(movement.multiplyScalar(delta * 5.6));
    next.x = THREE.MathUtils.clamp(next.x, -24, 24);
    next.z = THREE.MathUtils.clamp(next.z, -24, 24);
    const tooCloseToPlayer = next.distanceTo(new THREE.Vector3(player.position.x, 0, player.position.z)) < 2.8;
    if (
      !tooCloseToPlayer &&
      !blocks.some((block) => block.mesh.position.distanceTo(new THREE.Vector3(next.x, block.mesh.position.y, next.z)) < 0.82)
    ) {
      secondPlayer.position.copy(next);
    }
  }

  secondPlayer.mesh.visible = true;
  secondPlayer.mesh.position.copy(secondPlayer.position);
  secondPlayer.mesh.rotation.y = secondPlayer.yaw;
}

function updateWaves(delta) {
  if (state.bossActive || state.gameEnded) return;
  state.spawnTimer -= delta;
  if (state.monstersToSpawn > 0 && state.spawnTimer <= 0) {
    spawnEnemy(false);
    state.monstersToSpawn -= 1;
    state.spawnTimer = Math.max(0.42, 1.35 - state.wave * 0.12);
  }
  if (state.monstersToSpawn === 0 && enemies.length === 0) {
    state.wave += 1;
    if (state.wave >= 4) {
      state.bossActive = true;
      spawnEnemy(true);
    } else {
      state.monstersToSpawn = 6 + state.wave * 3;
      state.spawnTimer = 2.2;
    }
    updateHud();
  }
}

function updateEnemies(delta) {
  for (const enemy of [...enemies]) {
    const target = chooseEnemyTarget(enemy);
    const direction = target.clone().sub(enemy.mesh.position);
    direction.y = 0;
    const distance = direction.length();
    if (distance > 0.1) {
      direction.normalize();
      enemy.mesh.position.add(direction.multiplyScalar(enemy.speed * delta));
      enemy.mesh.lookAt(target.x, enemy.mesh.position.y, target.z);
      animateEnemy(enemy, delta, true);
    } else {
      animateEnemy(enemy, delta, false);
    }
    enemy.attackTimer -= delta;
    if (distance < (enemy.boss ? 2.1 : 1.15) && enemy.attackTimer <= 0) {
      enemy.attackTimer = enemy.boss ? 1.15 : 0.8;
      attackTarget(enemy, target);
    }
  }
}

function updateDefenses(delta) {
  for (const defense of defenses) {
    if (defense.type === "jet") {
      defense.angle += delta * 0.85;
      defense.mesh.position.set(Math.cos(defense.angle) * 12, 7.2, Math.sin(defense.angle) * 12);
      defense.mesh.rotation.set(0.25, -defense.angle + Math.PI / 2, 0);
    }
    const target = findNearestEnemy(defense.mesh.position, defense.range);
    if (!target) continue;
    defense.mesh.lookAt(target.mesh.position.x, target.mesh.position.y + 1, target.mesh.position.z);
    defense.cooldown -= delta;
    if (defense.cooldown <= 0) {
      defense.cooldown = defense.type === "jet" ? 0.42 : defense.type === "turret" ? 0.55 : 0.78;
      const origin = defense.mesh.position.clone().add(new THREE.Vector3(0, defense.type === "jet" ? -0.6 : 0.9, 0));
      const aim = target.mesh.position.clone().add(new THREE.Vector3(0, target.boss ? 1.6 : 1.0, 0));
      fireProjectile(origin, aim.sub(origin), defense.damage, defense.type === "jet" ? 38 : 25, 1.6);
    }
  }
}

function findNearestEnemy(position, range) {
  return enemies
    .filter((enemy) => enemy.mesh.position.distanceTo(position) <= range)
    .sort((a, b) => a.mesh.position.distanceTo(position) - b.mesh.position.distanceTo(position))[0];
}

function animateEnemy(enemy, delta, moving) {
  enemy.walkTime += delta * (moving ? 8 : 2);
  const bob = Math.sin(enemy.walkTime * 2) * (enemy.boss ? 0.035 : 0.055);
  enemy.mesh.position.y = bob;
  const limbs = enemy.mesh.userData.limbs ?? [];
  limbs.forEach((limb) => {
    limb.rotation.x = Math.sin(enemy.walkTime + limb.userData.stepOffset) * 0.55;
  });
}

function chooseEnemyTarget(enemy) {
  const nearbyBlock = blocks
    .filter((block) => block.mesh.position.distanceTo(enemy.mesh.position) < 4)
    .sort((a, b) => a.mesh.position.distanceTo(enemy.mesh.position) - b.mesh.position.distanceTo(enemy.mesh.position))[0];
  if (nearbyBlock) return nearbyBlock.mesh.position;
  if (player.health <= 0 && secondPlayer.health > 0) return secondPlayer.position;
  if (secondPlayer.health > 0 && secondPlayer.position.distanceTo(enemy.mesh.position) < player.position.distanceTo(enemy.mesh.position)) {
    return secondPlayer.position;
  }
  return player.position;
}

function attackTarget(enemy, target) {
  const block = blocks.find((entry) => entry.mesh.position.distanceTo(target) < 0.2);
  if (block) {
    block.hp -= enemy.damage;
    block.mesh.material.emissive = new THREE.Color(0x7f1d1d);
    setTimeout(() => {
      if (block.mesh?.material) block.mesh.material.emissive = new THREE.Color(0x000000);
    }, 90);
    if (block.hp <= 0) {
      scene.remove(block.mesh);
      blocks.splice(blocks.indexOf(block), 1);
    }
    return;
  }
  if (secondPlayer.health > 0 && target.distanceTo(secondPlayer.position) < 0.2) {
    secondPlayer.health -= enemy.damage;
  } else {
    player.health -= enemy.damage;
  }
  if (player.health <= 0 && secondPlayer.health <= 0) loseGame();
}

function updateBullets(delta) {
  for (const bullet of [...bullets]) {
    bullet.life -= delta;
    bullet.mesh.position.add(bullet.direction.clone().multiplyScalar(delta * bullet.speed));
    const hit = enemies.find((enemy) => enemy.mesh.position.distanceTo(bullet.mesh.position) < (enemy.boss ? 1.8 : 1.05));
    if (hit) {
      damageEnemy(hit, bullet.damage);
      removeBullet(bullet);
    } else if (bullet.life <= 0) {
      removeBullet(bullet);
    }
  }
}

function removeBullet(bullet) {
  scene.remove(bullet.mesh);
  bullets.splice(bullets.indexOf(bullet), 1);
}

function updateHud() {
  healthEl.textContent = Math.max(0, Math.round(player.health));
  p2HealthEl.textContent = Math.max(0, Math.round(secondPlayer.health));
  coinsEl.textContent = Math.floor(player.coins);
  waveEl.textContent = state.bossActive ? "Boss" : state.wave;
  monstersEl.textContent = enemies.length + state.monstersToSpawn;
  bossPill.classList.toggle("hidden", !state.bossActive);
  shopButtons.forEach((button) => {
    const itemIndex = shopItems.findIndex((entry) => entry.type === button.dataset.shop);
    button.disabled = !state.started || state.gameEnded || itemIndex !== state.nextAutoBuyIndex;
  });
}

function winGame() {
  state.gameEnded = true;
  endKicker.textContent = "Boss defeated";
  endTitle.textContent = "You Beat Bob";
  endCopy.textContent = "Your base survived and the arena is clear.";
  gameOverScreen.classList.remove("hidden");
}

function loseGame() {
  state.gameEnded = true;
  endKicker.textContent = "Base breached";
  endTitle.textContent = "Game Over";
  endCopy.textContent = "The monsters broke through your defenses.";
  gameOverScreen.classList.remove("hidden");
}

function animate() {
  const delta = Math.min(0.04, clock.getDelta());
  if (state.started && !state.gameEnded) {
    updatePlayer(delta);
    updateSecondPlayer(delta);
    updateWaves(delta);
    updateEnemies(delta);
    updateDefenses(delta);
    updateBullets(delta);
    updateHud();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  const toolMap = { Digit1: "wood", Digit2: "glass", Digit3: "obsidian", Digit4: "sword", Digit5: "gun" };
  if (toolMap[event.code]) setTool(toolMap[event.code]);
  if (event.code === "Enter") shootSecondPlayer();
});

window.addEventListener("keyup", (event) => keys.delete(event.code));

window.addEventListener("mousemove", (event) => {
  if (!state.started || !document.pointerLockElement) return;
  player.yaw -= event.movementX * 0.0025;
  player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * 0.0022, -1.1, 0.55);
});

window.addEventListener("pointerdown", () => {
  if (!state.started || state.gameEnded) return;
  requestPointerLockSafe();
  if (["wood", "glass", "obsidian"].includes(player.tool)) placeBlock();
  if (player.tool === "sword") useSword();
  if (player.tool === "gun") shootGun();
});

toolButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setTool(button.dataset.tool);
  });
});

shopButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    buyShopItem(button.dataset.shop);
  });
});

startButton.addEventListener("click", () => {
  requestPointerLockSafe();
  startGame();
});

restartButton.addEventListener("click", startGame);

setupWorld();
camera.position.copy(player.position);
camera.rotation.y = player.yaw;
animate();
