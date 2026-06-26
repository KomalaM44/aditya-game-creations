import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const modeScreen = document.querySelector("#mode-screen");
const gameOverScreen = document.querySelector("#game-over");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const hud = document.querySelector("#hud");
const inventoryEl = document.querySelector("#inventory");
const toolbar = document.querySelector("#toolbar");
const adminPanel = document.querySelector("#admin-panel");
const randomItemButton = document.querySelector("#random-item-button");
const messageEl = document.querySelector("#message");
const modeEl = document.querySelector("#mode");
const classNameEl = document.querySelector("#class-name");
const healthEl = document.querySelector("#health");
const fuelEl = document.querySelector("#fuel");
const scrapEl = document.querySelector("#scrap");
const sackEl = document.querySelector("#sack");
const toolButtons = [...document.querySelectorAll(".tool")];
const endKicker = document.querySelector("#end-kicker");
const endTitle = document.querySelector("#end-title");
const endCopy = document.querySelector("#end-copy");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbde7ff);
scene.fog = new THREE.Fog(0xbde7ff, 28, 120);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const keys = new Set();

const player = {
  position: new THREE.Vector3(0, 1.72, 8),
  yaw: 0,
  pitch: -0.12,
  velocityY: 0,
  grounded: true,
  health: 100,
  className: "Starter",
  weapon: "spear",
  tool: "axe",
  axe: "old",
  sackLimit: 10,
  hammer: false,
  cooldown: 0,
};

const state = {
  phase: "start",
  mode: "lobby",
  selectedPortal: 0,
  fuel: 0,
  scrap: 0,
  dayTime: 0,
  messageTimer: 0,
  adminOpen: false,
  heldStructure: null,
  gameEnded: false,
  fireStarted: false,
  selectedInventoryItem: null,
};

const inventory = {
  wood: 0,
  coal: 0,
  fuelCanister: 0,
  oilBarrel: 0,
  bolt: 0,
  metalSheet: 0,
  oldRadio: 0,
  oldFan: 0,
  brokenMicrowave: 0,
  metalChair: 0,
  woodenChair: 0,
  brokenDishwasher: 0,
  cultistExperiment: 0,
  spear: 0,
  revolver: 0,
  ammo: 0,
  goodAxe: 0,
  ironArmor: 0,
  rifle: 0,
  medkit: 0,
  strongAxe: 0,
  tacticalShotgun: 0,
  crossbow: 0,
  laserDefenseTablet: 0,
  adminAxe: 0,
  hammer: 0,
};

const itemInfo = {
  wood: { label: "Wood", color: 0x9a5a28, fuel: 4, scrap: 0 },
  coal: { label: "Coal", color: 0x111827, fuel: 12, scrap: 0 },
  fuelCanister: { label: "Fuel Canister", color: 0xef4444, fuel: 28, scrap: 0 },
  oilBarrel: { label: "Oil Barrel", color: 0x334155, fuel: 55, scrap: 0 },
  bolt: { label: "Bolt", color: 0x94a3b8, scrap: 1 },
  metalSheet: { label: "Sheet of Metal", color: 0x64748b, scrap: 1 },
  oldRadio: { label: "Old Radio", color: 0x172554, scrap: 2 },
  oldFan: { label: "Old Fan", color: 0x0f766e, scrap: 2 },
  brokenMicrowave: { label: "Broken Microwave", color: 0x475569, scrap: 5 },
  metalChair: { label: "Metal Chair", color: 0x7c8794, scrap: 5 },
  woodenChair: { label: "Wooden Chair", color: 0x854d0e, wood: 20 },
  brokenDishwasher: { label: "Broken Dishwasher", color: 0x94a3b8, scrap: 20 },
  cultistExperiment: { label: "Cultist Experiment", color: 0x7f1d1d, scrap: 100 },
  spear: { label: "Spear", color: 0xd6d3d1, weapon: true },
  revolver: { label: "Revolver", color: 0x1f2937, weapon: true },
  ammo: { label: "Ammo", color: 0xfacc15 },
  goodAxe: { label: "Good Axe", color: 0x22c55e, axe: "good" },
  ironArmor: { label: "Iron Armor", color: 0x94a3b8, armor: true },
  rifle: { label: "Rifle", color: 0x78350f, weapon: true },
  medkit: { label: "Medkit", color: 0xffffff, heal: 45 },
  strongAxe: { label: "Strong Axe", color: 0xf59e0b, axe: "strong" },
  tacticalShotgun: { label: "Tactical Shotgun", color: 0x111827, weapon: true },
  crossbow: { label: "Crossbow", color: 0x92400e, weapon: true },
  laserDefenseTablet: { label: "Laser Defense Tablet", color: 0x38bdf8, structure: "laser", count: 10 },
  adminAxe: { label: "Admin Axe", color: 0xa855f7, axe: "admin" },
  hammer: { label: "Hammer", color: 0x78716c, hammer: true },
};

const weaponStats = {
  spear: { damage: 28, range: 4.2, cooldown: 0.55, ammo: false },
  revolver: { damage: 32, range: 36, cooldown: 0.42, ammo: true },
  rifle: { damage: 48, range: 52, cooldown: 0.24, ammo: true },
  tacticalShotgun: { damage: 82, range: 16, cooldown: 0.85, ammo: true },
  crossbow: { damage: 55, range: 34, cooldown: 0.72, ammo: false },
};

const chestLoot = {
  wooden: ["spear", "revolver", "ammo", "goodAxe"],
  iron: ["ironArmor", "rifle", "medkit", "ammo"],
  gold: ["strongAxe", "tacticalShotgun", "crossbow", "ammo"],
  ruby: ["laserDefenseTablet", "adminAxe", "hammer", "ammo"],
};

const animalStats = {
  bunny: { hp: 25, speed: 1.2, damage: 0, color: 0xf8fafc, size: 0.48 },
  wolf: { hp: 70, speed: 2.3, damage: 8, color: 0x64748b, size: 0.75 },
  alphaWolf: { hp: 130, speed: 2.6, damage: 14, color: 0x1f2937, size: 0.95 },
  bear: { hp: 220, speed: 1.7, damage: 22, color: 0x5b341b, size: 1.25 },
};

const materials = {};
const interactables = [];
const trees = [];
const drops = [];
const animals = [];
const structures = [];
const colliders = [];
const lobbyPortals = [];
let campfire;
let grinder;
let adminButton;
let playerMesh;

function makeTexture(base, speck, size = 128, count = 850) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = speck;
    ctx.globalAlpha = 0.12 + Math.random() * 0.26;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function initMaterials() {
  const grass = makeTexture("#315f36", "#7fb069", 128, 1400);
  grass.repeat.set(22, 22);
  const dirt = makeTexture("#7c4a25", "#3d2210", 96, 700);
  dirt.repeat.set(4, 4);
  const lobby = makeTexture("#59606a", "#cbd5e1", 96, 420);
  lobby.repeat.set(5, 5);
  materials.ground = new THREE.MeshStandardMaterial({ color: 0x386b3a, map: grass, roughness: 0.95 });
  materials.dirt = new THREE.MeshStandardMaterial({ color: 0x7c4a25, map: dirt, roughness: 0.9 });
  materials.lobby = new THREE.MeshStandardMaterial({ color: 0x64748b, map: lobby, roughness: 0.78 });
  materials.bark = new THREE.MeshStandardMaterial({ color: 0x6b3f21, roughness: 0.84 });
  materials.leaves = new THREE.MeshStandardMaterial({ color: 0x17642c, roughness: 0.9 });
  materials.yellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x8a5a00, roughness: 0.35 });
  materials.shop = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 });
  materials.sign = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  materials.white = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  materials.wood = new THREE.MeshStandardMaterial({ color: 0x9a5a28, roughness: 0.78 });
  materials.metal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.35, roughness: 0.3 });
  materials.fire = new THREE.MeshBasicMaterial({ color: 0xff7a18 });
  materials.coal = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  materials.red = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 });
  materials.gold = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.25, roughness: 0.32 });
  materials.ruby = new THREE.MeshStandardMaterial({ color: 0xbe123c, emissive: 0x3f0715, roughness: 0.38 });
  materials.laser = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
}

function clearWorld() {
  scene.clear();
  interactables.length = 0;
  trees.length = 0;
  drops.length = 0;
  animals.length = 0;
  structures.length = 0;
  colliders.length = 0;
  lobbyPortals.length = 0;
  campfire = null;
  grinder = null;
  adminButton = null;
}

function addLights(forest = false) {
  const hemi = new THREE.HemisphereLight(forest ? 0xc7f9ff : 0xe0f2fe, forest ? 0x173b1f : 0x334155, forest ? 0.88 : 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1c7, forest ? 2.6 : 2.1);
  sun.position.set(-24, 36, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  scene.add(sun);
}

function makeTextSprite(text, options = {}) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = options.bg ?? "rgba(5, 15, 10, 0.82)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = options.stroke ?? "#facc15";
  ctx.lineWidth = 8;
  ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
  ctx.fillStyle = options.color ?? "#ffffff";
  ctx.font = "900 42px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > 430 && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  lines.slice(0, 2).forEach((entry, index) => ctx.fillText(entry, 256, 64 + index * 44 - (lines.length > 1 ? 22 : 0)));
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(options.width ?? 5, options.height ?? 1.55, 1);
  return sprite;
}

function addBox(size, position, material, userData = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { ...userData };
  scene.add(mesh);
  return mesh;
}

function setupLobby() {
  clearWorld();
  scene.background = new THREE.Color(0x9fd4ff);
  scene.fog = new THREE.Fog(0x9fd4ff, 28, 105);
  addLights(false);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 80), materials.lobby);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.kind = "ground";
  scene.add(ground);

  player.position.set(0, 1.72, 14);
  player.velocityY = 0;
  player.grounded = true;
  player.yaw = Math.PI;
  player.pitch = -0.08;
  state.phase = "lobby";
  state.mode = "Lobby";
  state.fuel = 0;
  state.scrap = 0;
  state.adminOpen = false;
  adminPanel.classList.add("hidden");

  const shop = new THREE.Group();
  const building = addBox(new THREE.Vector3(16, 7, 7), new THREE.Vector3(-16, 3.5, -10), materials.shop, {
    interact: "shop",
    label: "Classes shop: all starter weapons are free.",
  });
  shop.add(building);
  const roof = addBox(new THREE.Vector3(17.5, 1.1, 8.5), new THREE.Vector3(-16, 7.4, -10), materials.gold);
  shop.add(roof);
  const sign = makeTextSprite("CLASSES FREE", { width: 7.4, height: 2 });
  sign.position.set(-16, 8.9, -5.6);
  shop.add(sign);
  scene.add(shop);

  [
    { name: "Spear Starter", weapon: "spear", x: -21.5, color: 0xd6d3d1 },
    { name: "Revolver Starter", weapon: "revolver", x: -16, color: 0x1f2937 },
    { name: "Crossbow Starter", weapon: "crossbow", x: -10.5, color: 0x92400e },
  ].forEach((entry) => {
    const pedestal = addBox(new THREE.Vector3(3.3, 0.7, 3.3), new THREE.Vector3(entry.x, 0.35, -4.2), materials.white, {
      interact: "class",
      className: entry.name,
      weapon: entry.weapon,
      label: `${entry.name}: click for a free starter weapon.`,
    });
    interactables.push(pedestal);
    const weapon = addBox(new THREE.Vector3(0.35, 2.1, 0.35), new THREE.Vector3(entry.x, 1.85, -4.2), new THREE.MeshStandardMaterial({ color: entry.color, roughness: 0.38 }), {
      interact: "class",
      className: entry.name,
      weapon: entry.weapon,
    });
    weapon.rotation.z = entry.weapon === "crossbow" ? Math.PI / 2 : 0.25;
    interactables.push(weapon);
    const label = makeTextSprite(entry.name.replace(" ", "\n"), { width: 3.6, height: 1.2 });
    label.position.set(entry.x, 3.8, -4.2);
    scene.add(label);
  });

  [-6, 4, 14].forEach((x, index) => {
    const portal = addBox(new THREE.Vector3(5.5, 0.16, 5.5), new THREE.Vector3(x, 0.08, -12), materials.yellow, {
      interact: "portal",
      portalIndex: index + 1,
      label: `Yellow area ${index + 1}: choose normal mode or hardmode.`,
    });
    portal.userData.radius = 3.3;
    lobbyPortals.push(portal);
    interactables.push(portal);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 7, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.16 }));
    beam.position.set(x, 3.5, -12);
    scene.add(beam);
    const label = makeTextSprite(`AREA ${index + 1}`, { width: 3.8, height: 1.15, bg: "rgba(113, 63, 18, 0.82)" });
    label.position.set(x, 5.1, -12);
    scene.add(label);
  });

  const adminBase = addBox(new THREE.Vector3(5, 1.2, 3), new THREE.Vector3(17, 0.6, 4), materials.ruby, {
    interact: "admin",
    label: "Admin Panel: click to open the random item button.",
  });
  const adminLabel = makeTextSprite("ADMIN PANEL", { width: 5, height: 1.2, stroke: "#f472b6" });
  adminLabel.position.set(17, 2.6, 4);
  scene.add(adminLabel);
  adminButton = adminBase;
  interactables.push(adminButton);

  addPlayerDummy();
  showMessage("Pick a free class, then step into one of the three yellow areas.");
  updateHud();
}

function addPlayerDummy() {
  if (playerMesh) {
    scene.remove(playerMesh);
  }
  playerMesh = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1, 0.38), new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 }));
  body.position.y = 1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), new THREE.MeshStandardMaterial({ color: 0xf4bd8a, roughness: 0.62 }));
  head.position.y = 1.78;
  playerMesh.add(body, head);
  playerMesh.visible = false;
  scene.add(playerMesh);
}

function setupForest(mode) {
  clearWorld();
  scene.background = new THREE.Color(mode === "hard" ? 0x263445 : 0x9ed7ff);
  scene.fog = new THREE.Fog(mode === "hard" ? 0x263445 : 0xbde7ff, 24, mode === "hard" ? 82 : 120);
  addLights(true);

  state.phase = "forest";
  state.mode = mode === "hard" ? "Hardmode" : "Normal";
  state.fuel = 0;
  state.fireStarted = false;
  state.dayTime = 0;
  state.gameEnded = false;
  player.position.set(0, 1.72, 9);
  player.velocityY = 0;
  player.grounded = true;
  player.yaw = Math.PI;
  player.pitch = -0.12;
  player.health = 100;
  resetInventory();
  inventory.spear = player.weapon === "spear" ? 1 : 0;
  inventory.revolver = player.weapon === "revolver" ? 1 : 0;
  inventory.crossbow = player.weapon === "crossbow" ? 1 : 0;
  inventory.wood = 0;
  player.axe = "old";
  player.sackLimit = 10;
  player.hammer = false;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.kind = "ground";
  scene.add(ground);

  const dirt = new THREE.Mesh(new THREE.CircleGeometry(10, 48), materials.dirt);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.y = 0.02;
  scene.add(dirt);

  createCampfire();
  createGrinder();
  createAdminPanelObject();
  createStartingStructures();
  createForest();
  createChests();
  createLootField();
  createAnimals(mode);
  addPlayerDummy();
  showMessage("Forest spawned. The campfire has no fuel. Chop trees, collect fuel, and build up the camp.");
  updateHud();
}

function resetInventory() {
  Object.keys(inventory).forEach((key) => {
    inventory[key] = 0;
  });
}

function createCampfire() {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 8, 36), materials.coal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  group.add(ring);
  for (let i = 0; i < 5; i += 1) {
    const log = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.22), materials.wood);
    log.position.y = 0.22 + i * 0.03;
    log.rotation.y = (Math.PI / 5) * i;
    log.castShadow = true;
    group.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 18), materials.fire);
  flame.position.y = 0.9;
  flame.scale.setScalar(0.08);
  flame.userData.flame = true;
  group.add(flame);
  const light = new THREE.PointLight(0xff7a18, 4.8, 22, 1.6);
  light.position.y = 1.6;
  group.add(light);
  group.userData = { interact: "campfire", label: "Campfire: add wood, coal, fuel canister, or oil barrel." };
  scene.add(group);
  campfire = group;
  interactables.push(group);
}

function createStartingStructures() {
  createWoodShelter(new THREE.Vector3(-4.4, 0, -4.6));
  createBarricade(new THREE.Vector3(3.7, 0, -5.2), -0.28);
  createWatchPost(new THREE.Vector3(-7.2, 0, 2.4));
  createStorageCrate(new THREE.Vector3(2.7, 0, 4.3));
}

function createWoodShelter(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.24, 3.2), materials.wood);
  floor.position.y = 0.12;
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.2, 0.22), materials.wood);
  backWall.position.set(0, 1.2, -1.5);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 3.2), materials.wood);
  leftWall.position.set(-1.9, 1.2, 0);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 3.2), materials.wood);
  rightWall.position.set(1.9, 1.2, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.2, 4), materials.bark);
  roof.position.y = 2.8;
  roof.rotation.y = Math.PI / 4;
  [floor, backWall, leftWall, rightWall, roof].forEach((part) => {
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
  });
  group.userData = { interact: "structure", movable: true, cooldown: 0, label: "Wood shelter: find the hammer to move this structure." };
  scene.add(group);
  structures.push(group);
  interactables.push(group);
}

function createBarricade(position, rotation = 0) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotation;
  for (let i = 0; i < 4; i += 1) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.4, 10), materials.bark);
    log.position.set(0, 0.45 + i * 0.32, 0);
    log.rotation.z = Math.PI / 2;
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);
  }
  [-1.35, 1.35].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.8, 10), materials.bark);
    post.position.set(x, 0.85, 0);
    post.castShadow = true;
    group.add(post);
  });
  group.userData = { interact: "structure", movable: true, cooldown: 0, label: "Log barricade: hammer can move it around the camp." };
  scene.add(group);
  structures.push(group);
  interactables.push(group);
}

function createWatchPost(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  [-0.8, 0.8].forEach((x) => {
    [-0.8, 0.8].forEach((z) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 3.4, 8), materials.bark);
      post.position.set(x, 1.7, z);
      post.castShadow = true;
      group.add(post);
    });
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 2.2), materials.wood);
  deck.position.y = 3.05;
  deck.castShadow = true;
  deck.receiveShadow = true;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.055, 8, 4), materials.bark);
  rail.position.y = 3.42;
  rail.rotation.y = Math.PI / 4;
  group.add(deck, rail);
  group.userData = { interact: "structure", movable: true, cooldown: 0, label: "Watch post: a movable structure for scouting the forest." };
  scene.add(group);
  structures.push(group);
  interactables.push(group);
}

function createStorageCrate(position) {
  const crate = addBox(new THREE.Vector3(1.8, 1.2, 1.4), new THREE.Vector3(position.x, 0.6, position.z), materials.wood, {
    interact: "structure",
    movable: true,
    cooldown: 0,
    label: "Storage crate: hammer can move this structure.",
  });
  structures.push(crate);
  interactables.push(crate);
}

function createGrinder() {
  const base = addBox(new THREE.Vector3(3.2, 1.8, 2.6), new THREE.Vector3(4.7, 0.9, 0.4), materials.metal, {
    interact: "grinder",
    label: "Grinder: put scrap items inside to turn them into scrap.",
  });
  const mouth = addBox(new THREE.Vector3(2.2, 0.32, 1.7), new THREE.Vector3(4.7, 2, 0.4), materials.coal);
  mouth.userData = base.userData;
  grinder = base;
  interactables.push(base, mouth);
  const label = makeTextSprite("GRINDER", { width: 3.2, height: 1 });
  label.position.set(4.7, 3.2, 0.4);
  scene.add(label);
}

function createAdminPanelObject() {
  const panel = addBox(new THREE.Vector3(3.2, 1.6, 0.6), new THREE.Vector3(-4.7, 1.1, 0.4), materials.ruby, {
    interact: "admin",
    label: "Admin Panel: opens a button that spawns random items.",
  });
  adminButton = panel;
  interactables.push(panel);
  const label = makeTextSprite("ADMIN PANEL", { width: 3.8, height: 1, stroke: "#f472b6" });
  label.position.set(-4.7, 2.8, 0.4);
  scene.add(label);
}

function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.38 * scale, 3.8 * scale, 12), materials.bark);
  trunk.position.y = 1.6 * scale;
  trunk.castShadow = true;
  group.add(trunk);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.35 * scale, 3.6 * scale, 14), materials.leaves);
  leaves.position.y = 4.15 * scale;
  leaves.castShadow = true;
  group.add(leaves);
  const lowerLeaves = new THREE.Mesh(new THREE.ConeGeometry(1.65 * scale, 2.8 * scale, 14), materials.leaves);
  lowerLeaves.position.y = 3.25 * scale;
  lowerLeaves.castShadow = true;
  group.add(lowerLeaves);
  group.userData = { interact: "tree", hp: 3, label: "Tree: old axe takes 3 hits. Strong and admin axes one-shot it." };
  scene.add(group);
  trees.push(group);
  interactables.push(group);
}

function createForest() {
  for (let i = 0; i < 72; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 18 + Math.random() * 52;
    createTree(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.85 + Math.random() * 0.55);
  }
}

function createChest(type, x, z) {
  const material = type === "wooden" ? materials.wood : type === "iron" ? materials.metal : type === "gold" ? materials.gold : materials.ruby;
  const chest = addBox(new THREE.Vector3(1.8, 1.1, 1.25), new THREE.Vector3(x, 0.55, z), material, {
    interact: "chest",
    chestType: type,
    label: `${type[0].toUpperCase()}${type.slice(1)} chest: click to open random loot.`,
  });
  interactables.push(chest);
}

function createChests() {
  createChest("wooden", -9, -7);
  createChest("wooden", 12, 8);
  createChest("iron", -18, 14);
  createChest("gold", 22, -12);
  createChest("ruby", -28, -19);
}

function createLootField() {
  const pool = ["coal", "bolt", "metalSheet", "oldRadio", "oldFan", "brokenMicrowave", "metalChair", "woodenChair", "brokenDishwasher", "fuelCanister", "oilBarrel", "cultistExperiment"];
  for (let i = 0; i < 20; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 48;
    const type = pool[Math.floor(Math.random() * pool.length)];
    spawnItem(type, new THREE.Vector3(Math.cos(angle) * radius, 0.45, Math.sin(angle) * radius));
  }
}

function spawnItem(type, position) {
  const info = itemInfo[type] ?? itemInfo.wood;
  const geo = type === "oilBarrel" ? new THREE.CylinderGeometry(0.42, 0.42, 0.9, 16) : new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const mat = new THREE.MeshStandardMaterial({ color: info.color, metalness: type.includes("metal") ? 0.35 : 0.05, roughness: 0.42 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.userData = { interact: "item", itemType: type, label: `${info.label}: click with sack space to collect.` };
  scene.add(mesh);
  drops.push(mesh);
  interactables.push(mesh);
  return mesh;
}

function createPlacedItem(type, position) {
  const info = itemInfo[type] ?? itemInfo.wood;
  let mesh;
  if (type === "wood") {
    mesh = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.25, 10), materials.bark);
      log.position.set((i - 1) * 0.18, 0.18 + i * 0.1, 0);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i * 0.7;
      log.castShadow = true;
      mesh.add(log);
    }
  } else if (type === "coal") {
    mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), materials.coal);
  } else if (type === "oilBarrel" || type === "fuelCanister") {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, type === "oilBarrel" ? 1.05 : 0.72, 18), new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.42, metalness: 0.18 }));
    mesh.rotation.x = Math.PI / 2;
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.72), new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.5, metalness: info.scrap ? 0.3 : 0.05 }));
  }
  mesh.position.copy(position);
  mesh.position.y = type === "wood" ? 0.05 : 0.38;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    interact: "placedItem",
    itemType: type,
    label: `${info.label}: placed from your sack. Click to pick it back up.`,
  };
  scene.add(mesh);
  structures.push(mesh);
  interactables.push(mesh);
  return mesh;
}

function createAnimal(type, x, z) {
  const stats = animalStats[type];
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(stats.size * 1.65, stats.size * 0.78, stats.size * 0.72), new THREE.MeshStandardMaterial({ color: stats.color, roughness: 0.82 }));
  body.position.y = stats.size * 0.6;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(stats.size * 0.55, stats.size * 0.52, stats.size * 0.58), new THREE.MeshStandardMaterial({ color: stats.color, roughness: 0.82 }));
  head.position.set(0, stats.size * 0.72, -stats.size * 0.72);
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(stats.size * 0.28, stats.size * 0.18, stats.size * 0.22), materials.coal);
  nose.position.set(0, stats.size * 0.68, -stats.size * 1.08);
  const legGeometry = new THREE.BoxGeometry(stats.size * 0.18, stats.size * 0.55, stats.size * 0.18);
  [-0.46, 0.46].forEach((x) => {
    [-0.24, 0.24].forEach((z) => {
      const leg = new THREE.Mesh(legGeometry, new THREE.MeshStandardMaterial({ color: stats.color, roughness: 0.85 }));
      leg.position.set(x * stats.size, stats.size * 0.25, z * stats.size);
      leg.castShadow = true;
      group.add(leg);
    });
  });
  group.add(body, head, nose);
  group.userData = {
    interact: "animal",
    animalType: type,
    hp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    attackTimer: 0,
    label: `${type.replace(/([A-Z])/g, " $1")}: click with weapon to attack.`,
  };
  scene.add(group);
  animals.push(group);
  interactables.push(group);
}

function createAnimals(mode) {
  const hard = mode === "hard";
  const count = hard ? 9 : 5;
  const types = hard ? ["wolf", "wolf", "alphaWolf", "bear", "bunny"] : ["bunny", "bunny", "wolf", "wolf", "alphaWolf"];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 32 + Math.random() * 34;
    createAnimal(types[Math.floor(Math.random() * types.length)], Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
}

function createLaserDefense(position) {
  const tower = new THREE.Group();
  tower.position.copy(position);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.4, 16), materials.metal);
  base.position.y = 0.7;
  base.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.38, 0.5), materials.laser);
  head.position.y = 1.65;
  head.castShadow = true;
  tower.add(base, head);
  tower.userData = { interact: "structure", movable: true, cooldown: 0, label: "Laser defense: hammer can move it anywhere." };
  scene.add(tower);
  structures.push(tower);
  interactables.push(tower);
}

function openChest(chest) {
  const loot = chestLoot[chest.userData.chestType];
  const item = loot[Math.floor(Math.random() * loot.length)];
  addItemToInventory(item);
  scene.remove(chest);
  removeFrom(interactables, chest);
  showMessage(`${chest.userData.chestType} chest gave ${itemInfo[item].label}.`);
}

function addItemToInventory(type) {
  const info = itemInfo[type];
  const amount = info?.count ?? 1;
  inventory[type] = (inventory[type] ?? 0) + amount;
  if (info?.weapon) {
    player.weapon = type;
    player.tool = "weapon";
  }
  if (info?.axe) {
    player.axe = info.axe;
  }
  if (info?.armor) {
    player.health = Math.min(150, player.health + 25);
  }
  if (info?.heal) {
    player.health = Math.min(150, player.health + info.heal);
  }
  if (info?.hammer) {
    player.hammer = true;
  }
  updateHud();
}

function usedSackSlots() {
  return Object.entries(inventory).reduce((total, [key, value]) => {
    if (!value) return total;
    if (itemInfo[key]?.weapon || itemInfo[key]?.axe || itemInfo[key]?.armor || itemInfo[key]?.hammer || key === "ammo") return total;
    return total + value;
  }, 0);
}

function collectItem(mesh) {
  const type = mesh.userData.itemType;
  if (usedSackSlots() >= player.sackLimit && type !== "ammo") {
    showMessage("Old sack is full. Use the campfire or grinder first.");
    return;
  }
  addItemToInventory(type);
  scene.remove(mesh);
  removeFrom(drops, mesh);
  removeFrom(interactables, mesh);
  showMessage(`Collected ${itemInfo[type].label}.`);
}

function selectInventoryItem(type) {
  if (!inventory[type]) return;
  state.selectedInventoryItem = state.selectedInventoryItem === type ? null : type;
  showMessage(state.selectedInventoryItem ? `${itemInfo[type].label} selected. Look at the ground and press P to place it.` : "Inventory item deselected.");
  updateHud();
}

function placeSelectedInventoryItem() {
  const type = state.selectedInventoryItem;
  if (!type || !inventory[type]) {
    showMessage("Click an item in the inventory first, then press P to place it.");
    return;
  }
  if (itemInfo[type]?.weapon || itemInfo[type]?.axe || itemInfo[type]?.armor || itemInfo[type]?.hammer || type === "ammo" || type === "medkit") {
    showMessage(`${itemInfo[type].label} stays equipped instead of being placed.`);
    return;
  }
  const point = raycastGround() ?? player.position.clone().add(new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).multiplyScalar(3.2)).setY(0);
  if (point.distanceTo(player.position) > 8) {
    showMessage("That spot is too far away.");
    return;
  }
  createPlacedItem(type, point);
  inventory[type] -= 1;
  if (inventory[type] <= 0) state.selectedInventoryItem = null;
  showMessage(`Placed ${itemInfo[type].label}. Click it with the sack to pick it back up.`);
  updateHud();
}

function addFuel() {
  const order = ["oilBarrel", "fuelCanister", "coal", "wood"];
  const type = order.find((entry) => inventory[entry] > 0);
  if (!type) {
    showMessage("No fuel in the sack. Collect wood, coal, fuel canisters, or oil barrels.");
    return;
  }
  inventory[type] -= 1;
  state.fuel += itemInfo[type].fuel;
  state.fireStarted = true;
  showMessage(`Added ${itemInfo[type].label} to the campfire.`);
  updateHud();
}

function grindScrap() {
  const entries = Object.keys(inventory).filter((key) => inventory[key] > 0 && (itemInfo[key]?.scrap || itemInfo[key]?.wood));
  if (!entries.length) {
    showMessage("No scrap-sized items to grind.");
    return;
  }
  let scrapGained = 0;
  let woodGained = 0;
  entries.forEach((key) => {
    const amount = inventory[key];
    scrapGained += (itemInfo[key].scrap ?? 0) * amount;
    woodGained += (itemInfo[key].wood ?? 0) * amount;
    inventory[key] = 0;
  });
  state.scrap += scrapGained;
  inventory.wood += woodGained;
  showMessage(`Grinder made ${scrapGained} scrap${woodGained ? ` and ${woodGained} wood` : ""}.`);
  updateHud();
}

function chopTree(tree) {
  const damage = player.axe === "old" ? 1 : 3;
  tree.userData.hp -= damage;
  showMessage(player.axe === "old" ? `Tree hit ${3 - tree.userData.hp}/3.` : `${itemInfo[`${player.axe}Axe`]?.label ?? "Axe"} chopped the tree.`);
  if (tree.userData.hp <= 0) {
    const count = player.axe === "admin" ? 5 : 3;
    for (let i = 0; i < count; i += 1) {
      spawnItem("wood", tree.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.45, (Math.random() - 0.5) * 1.8)));
    }
    scene.remove(tree);
    removeFrom(trees, tree);
    removeFrom(interactables, tree);
  }
}

function attackAnimal(animal) {
  if (player.cooldown > 0) return;
  const weapon = player.tool === "axe" ? (player.axe === "admin" ? "adminAxe" : "spear") : player.weapon;
  const stat = weaponStats[weapon] ?? (weapon === "adminAxe" ? { damage: 999, range: 8, cooldown: 0.22 } : weaponStats.spear);
  const distance = animal.position.distanceTo(player.position);
  if (distance > stat.range) {
    showMessage("Too far away.");
    return;
  }
  if (stat.ammo) {
    if (inventory.ammo <= 0) {
      showMessage("No ammo.");
      return;
    }
    inventory.ammo -= 1;
  }
  player.cooldown = stat.cooldown;
  animal.userData.hp -= stat.damage;
  showMessage(`Hit ${animal.userData.animalType.replace(/([A-Z])/g, " $1")} for ${stat.damage}.`);
  if (animal.userData.hp <= 0) {
    if (animal.userData.animalType === "bear") spawnItem("coal", animal.position.clone().setY(0.45));
    if (animal.userData.animalType !== "bunny") spawnItem("bolt", animal.position.clone().add(new THREE.Vector3(0.6, 0.45, 0)));
    scene.remove(animal);
    removeFrom(animals, animal);
    removeFrom(interactables, animal);
  }
  updateHud();
}

function toggleAdmin() {
  state.adminOpen = !state.adminOpen;
  adminPanel.classList.toggle("hidden", !state.adminOpen);
  showMessage(state.adminOpen ? "Admin panel opened. Use the button to spawn random items." : "Admin panel closed.");
}

function spawnRandomAdminItem() {
  if (state.phase !== "forest") {
    showMessage("Start a forest round first.");
    return;
  }
  const pool = Object.keys(itemInfo);
  const type = pool[Math.floor(Math.random() * pool.length)];
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-3.5);
  spawnItem(type, player.position.clone().add(forward).setY(0.55));
  showMessage(`Admin spawned ${itemInfo[type].label}.`);
}

function useLaserTablet() {
  if (inventory.laserDefenseTablet <= 0) {
    showMessage("No laser defense tablets.");
    return;
  }
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)).multiplyScalar(4);
  createLaserDefense(player.position.clone().add(forward).setY(0));
  inventory.laserDefenseTablet -= 1;
  showMessage("Placed a laser defense.");
  updateHud();
}

function useHammer(target) {
  if (!player.hammer) {
    showMessage("Find the hammer first.");
    return;
  }
  if (target?.userData?.movable) {
    state.heldStructure = target;
    showMessage("Hammer picked up a structure. Click the ground to place it.");
    return;
  }
  if (state.heldStructure) {
    const point = raycastGround();
    if (point) {
      state.heldStructure.position.copy(point);
      state.heldStructure.position.y = 0;
      state.heldStructure = null;
      showMessage("Structure moved.");
    }
  }
}

function interact(target) {
  if (!target) {
    if (player.tool === "hammer" && state.heldStructure) useHammer(null);
    return;
  }
  const data = target.userData;
  if (data.interact === "class") {
    player.className = data.className;
    player.weapon = data.weapon;
    resetInventory();
    inventory[data.weapon] = 1;
    showMessage(`${data.className} selected. All starter weapons are free.`);
  } else if (data.interact === "portal") {
    state.selectedPortal = data.portalIndex;
    modeScreen.classList.remove("hidden");
    showMessage(`Yellow area ${data.portalIndex} selected.`);
  } else if (data.interact === "admin") {
    toggleAdmin();
  } else if (data.interact === "tree") {
    chopTree(target);
  } else if (data.interact === "item") {
    collectItem(target);
  } else if (data.interact === "placedItem") {
    collectItem(target);
  } else if (data.interact === "campfire") {
    addFuel();
  } else if (data.interact === "grinder") {
    grindScrap();
  } else if (data.interact === "chest") {
    openChest(target);
  } else if (data.interact === "animal") {
    attackAnimal(target);
  } else if (data.interact === "structure") {
    if (player.tool === "hammer") useHammer(target);
  }
}

function getLookTarget() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(interactables, true);
  const hit = hits.find((entry) => entry.distance < 7.5);
  if (!hit) return null;
  let object = hit.object;
  while (object.parent && !object.userData.interact) object = object.parent;
  return object.userData.interact ? object : null;
}

function raycastGround() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  const groundHit = hits.find((entry) => entry.object.userData.kind === "ground");
  return groundHit?.point ?? null;
}

function updateMovement(dt) {
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 8.2 : 5.2;
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const move = new THREE.Vector3();
  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.sub(forward);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed * dt);
    player.position.add(move);
  }
  player.velocityY -= 24 * dt;
  player.position.y += player.velocityY * dt;
  if (player.position.y <= 1.72) {
    player.position.y = 1.72;
    player.velocityY = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
  player.position.x = THREE.MathUtils.clamp(player.position.x, -72, 72);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -72, 72);
  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  if (playerMesh) playerMesh.position.copy(player.position).setY(0);
}

function updateLobby() {
  lobbyPortals.forEach((portal) => {
    if (portal.position.distanceTo(new THREE.Vector3(player.position.x, 0, player.position.z)) < portal.userData.radius) {
      if (modeScreen.classList.contains("hidden")) {
        state.selectedPortal = portal.userData.portalIndex;
        modeScreen.classList.remove("hidden");
        showMessage(`Area ${state.selectedPortal}: choose normal mode or hardmode.`);
      }
    }
  });
}

function updateForest(dt) {
  state.dayTime += dt;
  if (state.fireStarted) {
    state.fuel -= dt * (state.mode === "Hardmode" ? 0.55 : 0.34);
  }
  if (campfire) {
    const flame = campfire.children.find((child) => child.userData.flame);
    if (flame) {
      const scale = state.fireStarted ? THREE.MathUtils.clamp(state.fuel / 40, 0.08, 1.35) : 0.08;
      flame.scale.setScalar(scale);
      flame.rotation.y += dt * 4;
    }
  }
  if (state.fireStarted && state.fuel <= 0 && !state.gameEnded) {
    endGame("The campfire went out", "Collect fuel faster or grind junk before the night eats the flame.");
  }

  animals.forEach((animal) => {
    const data = animal.userData;
    data.attackTimer -= dt;
    const toPlayer = player.position.clone().sub(animal.position);
    const distance = toPlayer.length();
    const aggroRange = state.mode === "Hardmode" ? 20 : 15;
    if (data.damage > 0 && distance < aggroRange) {
      toPlayer.y = 0;
      if (toPlayer.lengthSq() > 0.001) animal.position.add(toPlayer.normalize().multiplyScalar(data.speed * dt));
      animal.lookAt(player.position.x, animal.position.y, player.position.z);
      if (distance < 1.7 && data.attackTimer <= 0) {
        player.health -= data.damage;
        data.attackTimer = state.mode === "Hardmode" ? 0.75 : 1.15;
        showMessage(`${data.animalType.replace(/([A-Z])/g, " $1")} attacked.`);
      }
    } else if (data.damage === 0) {
      animal.rotation.y += dt * 0.8;
      animal.position.x += Math.sin(state.dayTime + animal.id) * dt * 0.25;
      animal.position.z += Math.cos(state.dayTime + animal.id) * dt * 0.25;
    }
  });

  structures.forEach((structure) => {
    structure.userData.cooldown -= dt;
    if (structure.userData.cooldown > 0) return;
    const target = animals.find((animal) => animal.userData.damage > 0 && animal.position.distanceTo(structure.position) < 18);
    if (!target) return;
    target.userData.hp -= 34;
    structure.userData.cooldown = 0.55;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, structure.position.distanceTo(target.position), 8), materials.laser);
    const midpoint = structure.position.clone().add(target.position).multiplyScalar(0.5);
    beam.position.copy(midpoint).setY(1.3);
    beam.lookAt(target.position.x, 1.3, target.position.z);
    beam.rotateX(Math.PI / 2);
    scene.add(beam);
    setTimeout(() => scene.remove(beam), 90);
    if (target.userData.hp <= 0) {
      scene.remove(target);
      removeFrom(animals, target);
      removeFrom(interactables, target);
    }
  });

  if (player.health <= 0 && !state.gameEnded) {
    endGame("You were knocked out", "Wolves and bears are tougher in hardmode. Loot armor, medkits, and stronger weapons.");
  }
}

function updateHud() {
  modeEl.textContent = state.mode;
  classNameEl.textContent = player.className;
  healthEl.textContent = Math.max(0, Math.round(player.health));
  fuelEl.textContent = Math.max(0, Math.round(state.fuel));
  scrapEl.textContent = Math.round(state.scrap);
  sackEl.textContent = `${usedSackSlots()}/${player.sackLimit}`;
  toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === player.tool));
  const visible = Object.entries(inventory).filter(([, amount]) => amount > 0);
  inventoryEl.innerHTML = visible.length
    ? visible
        .map(
          ([key, amount]) =>
            `<button class="inventory-item ${state.selectedInventoryItem === key ? "selected" : ""}" data-item="${key}"><span>${itemInfo[key]?.label ?? key}</span><strong>${amount}</strong></button>`,
        )
        .join("")
    : "<div><span>Old Sack</span><strong>empty</strong></div>";
}

function showMessage(message) {
  messageEl.textContent = message;
  state.messageTimer = 4;
}

function endGame(title, copy) {
  state.gameEnded = true;
  state.phase = "ended";
  endKicker.textContent = state.mode;
  endTitle.textContent = title;
  endCopy.textContent = copy;
  gameOverScreen.classList.remove("hidden");
  document.exitPointerLock?.();
}

function removeFrom(array, item) {
  const index = array.indexOf(item);
  if (index >= 0) array.splice(index, 1);
}

function lockPointer() {
  const request = canvas.requestPointerLock?.();
  if (request?.catch) request.catch(() => {});
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.04);
  if (state.phase !== "start" && state.phase !== "ended") {
    player.cooldown = Math.max(0, player.cooldown - dt);
    updateMovement(dt);
    if (state.phase === "lobby") updateLobby(dt);
    if (state.phase === "forest") updateForest(dt);
    if (state.messageTimer > 0) state.messageTimer -= dt;
    updateHud();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function startGame() {
  startScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  inventoryEl.classList.remove("hidden");
  toolbar.classList.remove("hidden");
  setupLobby();
  lockPointer();
}

function chooseMode(mode) {
  modeScreen.classList.add("hidden");
  setupForest(mode);
  lockPointer();
}

function restart() {
  gameOverScreen.classList.add("hidden");
  adminPanel.classList.add("hidden");
  state.gameEnded = false;
  setupLobby();
  lockPointer();
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restart);
modeButtons.forEach((button) => button.addEventListener("click", () => chooseMode(button.dataset.mode)));
randomItemButton.addEventListener("click", spawnRandomAdminItem);
inventoryEl.addEventListener("click", (event) => {
  const button = event.target.closest(".inventory-item");
  if (!button) return;
  selectInventoryItem(button.dataset.item);
});
canvas.addEventListener("click", () => {
  if (state.phase === "start" || state.phase === "ended") return;
  lockPointer();
  const target = getLookTarget();
  if (!target && state.selectedInventoryItem) {
    placeSelectedInventoryItem();
    return;
  }
  interact(target);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Digit1") player.tool = "axe";
  if (event.code === "Digit2") player.tool = "sack";
  if (event.code === "Digit3") player.tool = "weapon";
  if (event.code === "Digit4") player.tool = "hammer";
  if (event.code === "Space" && player.grounded) {
    player.velocityY = 8.2;
    player.grounded = false;
  }
  if (event.code === "KeyL") useLaserTablet();
  if (event.code === "KeyP") placeSelectedInventoryItem();
  if (event.code === "KeyE") interact(getLookTarget());
  updateHud();
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= event.movementX * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * 0.002, -1.15, 0.55);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

initMaterials();
setupLobby();
animate();
