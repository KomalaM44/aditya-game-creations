import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const gameOverScreen = document.querySelector("#game-over");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const healthEl = document.querySelector("#health");
const woodEl = document.querySelector("#wood");
const monsterEl = document.querySelector("#monster");
const turretsEl = document.querySelector("#turrets");
const messageEl = document.querySelector("#message");
const cakeButton = document.querySelector("#cake-button");
const cocoaButton = document.querySelector("#cocoa-button");
const toolButtons = [...document.querySelectorAll(".tool")];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101a24);
scene.fog = new THREE.FogExp2(0x1b2933, 0.025);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const keys = new Set();

const player = {
  position: new THREE.Vector3(0, 1.75, 9),
  yaw: 0,
  pitch: -0.08,
  velocityY: 0,
  health: 100,
  wood: 20,
  tool: "axe",
  started: false,
  gameEnded: false,
  warmth: 0,
};

const state = {
  monsterHealth: 100,
  messageTimer: 0,
  axeSwing: 0,
  monsterAttackTimer: 0,
  cocoaSteam: 0,
  roundTime: 0,
};

const trees = [];
const blocks = [];
const turrets = [];
const bullets = [];
const rainDrops = [];
const placeables = [];
let monster;
let axe;
let warmLight;
let watchtower;
let towerBeam;

const towerFloorY = 7.08;
const towerEyeY = 8.75;
const towerRoofY = 10.35;

const materials = {};

function makeTexture(base, lines, size = 128) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  lines(ctx, size);
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function initMaterials() {
  const bark = makeTexture("#5b3218", (ctx, size) => {
    for (let x = 0; x < size; x += 7) {
      ctx.strokeStyle = x % 2 ? "rgba(25, 12, 5, 0.55)" : "rgba(160, 100, 48, 0.3)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 8, 32, x - 5, 72, x + 5, size);
      ctx.stroke();
    }
  });
  const wood = makeTexture("#936132", (ctx, size) => {
    for (let y = 0; y < size; y += 8) {
      ctx.strokeStyle = y % 2 ? "rgba(55, 30, 10, 0.45)" : "rgba(236, 185, 105, 0.25)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(32, y + 7, 80, y - 5, size, y + 4);
      ctx.stroke();
    }
  });
  const grass = makeTexture("#2c5b31", (ctx, size) => {
    for (let i = 0; i < 1500; i += 1) {
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(103, 156, 83, 0.35)" : "rgba(14, 43, 22, 0.35)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  });
  const carpet = makeTexture("#7f1d1d", (ctx, size) => {
    for (let i = 0; i < 360; i += 1) {
      ctx.fillStyle = i % 3 ? "rgba(252, 211, 77, 0.25)" : "rgba(69, 10, 10, 0.28)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  });
  grass.repeat.set(20, 20);
  wood.repeat.set(2, 2);
  bark.repeat.set(1, 3);
  materials.ground = new THREE.MeshStandardMaterial({ color: 0x315f36, map: grass, roughness: 0.96 });
  materials.bark = new THREE.MeshStandardMaterial({ color: 0x6b3f21, map: bark, roughness: 0.86 });
  materials.leaves = new THREE.MeshStandardMaterial({ color: 0x164f2a, roughness: 0.88 });
  materials.wood = new THREE.MeshStandardMaterial({ color: 0xa26a36, map: wood, roughness: 0.78 });
  materials.darkWood = new THREE.MeshStandardMaterial({ color: 0x4a2a16, map: wood, roughness: 0.82 });
  materials.carpet = new THREE.MeshStandardMaterial({ color: 0x991b1b, map: carpet, roughness: 0.9 });
  materials.metal = new THREE.MeshStandardMaterial({ color: 0x7c8794, metalness: 0.55, roughness: 0.28 });
  materials.monster = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.65 });
  materials.monsterGlow = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  materials.cake = new THREE.MeshStandardMaterial({ color: 0xf9d6a2, roughness: 0.62 });
  materials.chocolate = new THREE.MeshStandardMaterial({ color: 0x4c1d0f, roughness: 0.42 });
  materials.tv = new THREE.MeshStandardMaterial({ color: 0x050816, metalness: 0.2, roughness: 0.38 });
  materials.screen = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
}

function setupWorld() {
  scene.clear();
  trees.length = 0;
  blocks.length = 0;
  turrets.length = 0;
  bullets.length = 0;
  rainDrops.length = 0;
  placeables.length = 0;

  const hemi = new THREE.HemisphereLight(0xbfdcff, 0x172612, 0.65);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xabc8ff, 1.15);
  moon.position.set(-18, 28, 16);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -48;
  moon.shadow.camera.right = 48;
  moon.shadow.camera.top = 48;
  moon.shadow.camera.bottom = -48;
  scene.add(moon);

  warmLight = new THREE.PointLight(0xffc266, 5.2, 28, 1.65);
  warmLight.position.set(0, 8.25, 1.6);
  warmLight.castShadow = true;
  scene.add(warmLight);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.kind = "ground";
  scene.add(ground);

  const pad = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.18, 7.5), materials.darkWood);
  pad.position.set(0, 0.09, 0);
  pad.castShadow = true;
  pad.receiveShadow = true;
  pad.userData.kind = "ground";
  scene.add(pad);

  watchtower = addStartingWatchtower();
  addBed(new THREE.Vector3(-2.1, 7.34, 1.35));
  addCarpet(new THREE.Vector3(0, 7.22, 0.8));
  addCarpet(new THREE.Vector3(1.95, 7.23, 0.85), 1.2, 1.9, 0.12);
  addCarpet(new THREE.Vector3(-1.95, 7.23, -0.75), 1.25, 1.8, -0.18);
  addCarpet(new THREE.Vector3(0, 7.24, -1.75), 2.0, 0.95, 0);
  addLamp(new THREE.Vector3(2.65, 7.25, 1.45));
  addTv(new THREE.Vector3(2.2, 8.1, -1.85));
  addCakeTable();
  addHotChocolateCup(new THREE.Vector3(-1.05, 7.75, -1.65));
  createForest();
  createRain();
  createMonster();
  addTowerTurret();
  addTowerBeam();
  createAxe();
}

function addStartingWatchtower() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.32, 6.2), materials.wood);
  floor.position.set(0, towerFloorY, 0);
  floor.castShadow = true;
  floor.receiveShadow = true;
  group.add(floor);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.28, 6.8), materials.darkWood);
  roof.position.set(0, towerRoofY, 0);
  roof.castShadow = true;
  group.add(roof);

  const postGeometry = new THREE.BoxGeometry(0.38, 10.1, 0.38);
  [
    [-3.0, 5.05, -3.0],
    [3.0, 5.05, -3.0],
    [-3.0, 5.05, 3.0],
    [3.0, 5.05, 3.0],
  ].forEach(([x, y, z]) => {
    const post = new THREE.Mesh(postGeometry, materials.darkWood);
    post.position.set(x, y, z);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);
  });

  const railGeometry = new THREE.BoxGeometry(6.1, 0.34, 0.28);
  [-3.0, 3.0].forEach((z) => {
    const rail = new THREE.Mesh(railGeometry, materials.wood);
    rail.position.set(0, 8.15, z);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  });

  const sideRailGeometry = new THREE.BoxGeometry(0.28, 0.34, 6.1);
  [-3.0, 3.0].forEach((x) => {
    const rail = new THREE.Mesh(sideRailGeometry, materials.wood);
    rail.position.set(x, 8.15, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  });

  const wallMaterial = materials.wood;
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.1, 2.2, 0.24), wallMaterial);
  backWall.position.set(0, 8.55, -3.02);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.2, 0.24), wallMaterial);
  frontLeftWall.position.set(-1.98, 8.55, 3.02);
  frontLeftWall.castShadow = true;
  frontLeftWall.receiveShadow = true;
  group.add(frontLeftWall);

  const frontRightWall = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.2, 0.24), wallMaterial);
  frontRightWall.position.set(1.98, 8.55, 3.02);
  frontRightWall.castShadow = true;
  frontRightWall.receiveShadow = true;
  group.add(frontRightWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 6.1), wallMaterial);
  leftWall.position.set(-3.02, 8.55, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 2.15), wallMaterial);
  rightBackWall.position.set(3.02, 8.55, -1.98);
  rightBackWall.castShadow = true;
  rightBackWall.receiveShadow = true;
  group.add(rightBackWall);

  const rightFrontWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.2, 2.15), wallMaterial);
  rightFrontWall.position.set(3.02, 8.55, 1.98);
  rightFrontWall.castShadow = true;
  rightFrontWall.receiveShadow = true;
  group.add(rightFrontWall);

  const windowTrimMaterial = materials.darkWood;
  [
    [0, 9.2, 3.16, 1.25, 0.14, 0.16],
    [3.16, 9.2, 0, 0.16, 0.14, 1.25],
  ].forEach(([x, y, z, sx, sy, sz]) => {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), windowTrimMaterial);
    trim.position.set(x, y, z);
    trim.castShadow = true;
    group.add(trim);
  });

  for (let i = 0; i < 14; i += 1) {
    const stair = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.72), materials.wood);
    stair.position.set(-3.9, 0.35 + i * 0.5, 4.55 - i * 0.52);
    stair.rotation.y = -0.18;
    stair.castShadow = true;
    stair.receiveShadow = true;
    group.add(stair);
  }

  const ceilingGlow = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa726, emissiveIntensity: 1.8, roughness: 0.35 }),
  );
  ceilingGlow.position.set(0, 10.16, 0.25);
  group.add(ceilingGlow);

  const windowGlow = new THREE.PointLight(0xffc76b, 3.6, 22, 1.7);
  windowGlow.position.set(0, 8.5, 3.25);
  group.add(windowGlow);

  const backGlow = new THREE.PointLight(0xffb347, 2.1, 16, 1.85);
  backGlow.position.set(-2.0, 8.35, -2.35);
  group.add(backGlow);
  scene.add(group);
  return group;
}

function createForest() {
  for (let i = 0; i < 58; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 12 + Math.random() * 44;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    addTree(x, z, 0.85 + Math.random() * 0.55);
  }
}

function addTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData = { kind: "tree", hp: 3, alive: true };

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.42 * scale, 4.5 * scale, 14), materials.bark);
  trunk.position.y = 2.25 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.userData.tree = group;
  group.add(trunk);

  for (let i = 0; i < 3; i += 1) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry((1.75 - i * 0.28) * scale, 2.4 * scale, 18), materials.leaves);
    crown.position.y = (4.1 + i * 1.05) * scale;
    crown.castShadow = true;
    crown.userData.tree = group;
    group.add(crown);
  }
  trees.push(group);
  scene.add(group);
}

function createRain() {
  const rainMaterial = new THREE.MeshBasicMaterial({ color: 0x9bd2ff, transparent: true, opacity: 0.48 });
  const rainGeo = new THREE.BoxGeometry(0.025, 0.85, 0.025);
  for (let i = 0; i < 420; i += 1) {
    const drop = new THREE.Mesh(rainGeo, rainMaterial);
    drop.position.set((Math.random() - 0.5) * 76, 4 + Math.random() * 28, (Math.random() - 0.5) * 76);
    drop.rotation.z = -0.12;
    drop.userData.speed = 16 + Math.random() * 18;
    rainDrops.push(drop);
    scene.add(drop);
  }
}

function createMonster() {
  monster = new THREE.Group();
  monster.position.set(0, 0, -23);
  monster.userData.kind = "monster";
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.45, 3.2, 8, 18), materials.monster);
  body.position.y = 3.2;
  body.castShadow = true;
  monster.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), materials.monster);
  head.position.y = 6.0;
  head.castShadow = true;
  monster.add(head);
  [-0.45, 0.45].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), materials.monsterGlow);
    eye.position.set(x, 6.15, 1.1);
    monster.add(eye);
  });
  [-1.25, 1.25].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 2.7, 6, 10), materials.monster);
    arm.position.set(x, 3.8, 0.05);
    arm.rotation.z = x > 0 ? -0.42 : 0.42;
    arm.castShadow = true;
    monster.add(arm);
  });
  scene.add(monster);
}

function addTowerTurret() {
  const group = makeTurretModel();
  group.position.set(0, towerRoofY + 0.34, 2.45);
  group.userData = { kind: "turret", cooldown: 0.15, towerGuard: true };
  turrets.push(group);
  scene.add(group);
}

function addTowerBeam() {
  towerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff3a3, transparent: true, opacity: 0.72 }),
  );
  towerBeam.visible = false;
  scene.add(towerBeam);
}

function createAxe() {
  axe = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.35, 10), materials.darkWood);
  handle.rotation.z = 0.22;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.08), materials.metal);
  blade.position.set(0.08, 0.62, 0);
  blade.rotation.z = -0.15;
  axe.add(handle, blade);
  camera.add(axe);
  scene.add(camera);
}

function addBed(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.userData.kind = "placeable";
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 1.7), materials.darkWood);
  frame.position.y = 0.2;
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.28, 1.45), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.74 }));
  mattress.position.y = 0.53;
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 1.48), new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.82 }));
  blanket.position.set(0.45, 0.75, 0);
  group.add(frame, mattress, blanket);
  addPlaceable(group);
}

function addCarpet(pos, width = 3.7, depth = 2.45, rotation = 0) {
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(width, 0.055, depth), materials.carpet);
  carpet.position.copy(pos);
  carpet.rotation.y = rotation;
  carpet.userData.kind = "placeable";
  addPlaceable(carpet);
}

function addLamp(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.userData.kind = "placeable";
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.45, 12), materials.metal);
  pole.position.y = 0.72;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.45, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0x5b2d00, roughness: 0.5, side: THREE.DoubleSide }));
  shade.position.y = 1.55;
  const light = new THREE.PointLight(0xffb347, 3.2, 16, 1.75);
  light.position.y = 1.45;
  group.add(pole, shade, light);
  addPlaceable(group);
}

function addTv(pos = new THREE.Vector3(2.35, 1.1, -2.1)) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.rotation.y = -0.35;
  group.userData.kind = "placeable";
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.9, 0.08), materials.tv);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.68, 0.09), materials.screen);
  glow.position.z = 0.052;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.16), materials.metal);
  stand.position.y = -0.62;
  group.add(screen, glow, stand);
  addPlaceable(group);
}

function addCakeTable() {
  const group = new THREE.Group();
  group.position.set(-2.65, 7.35, -1.65);
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.16, 0.85), materials.darkWood);
  table.position.y = 0.8;
  group.add(table);
  for (let i = 0; i < 5; i += 1) {
    const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.14, 16), materials.cake);
    cake.position.set(-0.42 + i * 0.21, 0.95, Math.sin(i) * 0.2);
    group.add(cake);
  }
  addPlaceable(group);
}

function addHotChocolateCup(pos = new THREE.Vector3(-1.1, 0.75, -1.9)) {
  const group = new THREE.Group();
  group.position.copy(pos);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.32, 18), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.44 }));
  const cocoa = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.025, 18), materials.chocolate);
  cocoa.position.y = 0.18;
  group.add(cup, cocoa);
  addPlaceable(group);
}

function addPlaceable(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.kind = "placeable";
    }
  });
  placeables.push(object);
  scene.add(object);
}

function setMessage(text) {
  messageEl.textContent = text;
  state.messageTimer = 4;
}

function selectTool(tool) {
  player.tool = tool;
  toolButtons.forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
}

function startGame() {
  startScreen.classList.add("hidden");
  resetGame();
  player.started = true;
  canvas.requestPointerLock?.();
}

function resetGame() {
  player.position.set(0, towerEyeY, 2.2);
  player.yaw = 0;
  player.pitch = -0.08;
  player.velocityY = 0;
  player.health = 100;
  player.wood = 20;
  player.gameEnded = false;
  player.warmth = 0;
  state.monsterHealth = 40;
  state.axeSwing = 0;
  state.monsterAttackTimer = 0;
  state.cocoaSteam = 0;
  state.roundTime = 0;
  selectTool("axe");
  setupWorld();
  gameOverScreen.classList.add("hidden");
  updateHud();
  setMessage("You spawned high inside your cozy watchtower with an axe, infinity cakes, carpets, warm light, hot chocolate, and TV.");
}

function updateHud() {
  healthEl.textContent = Math.max(0, Math.round(player.health));
  woodEl.textContent = player.wood;
  monsterEl.textContent = Math.max(0, Math.round(state.monsterHealth));
  turretsEl.textContent = "∞";
}

function useCurrentTool() {
  if (!player.started || player.gameEnded) return;
  if (player.tool === "axe") {
    swingAxe();
    return;
  }
  if (player.tool === "wood") placeWoodBlock();
  if (player.tool === "turret") placeTurret();
}

function getLookTarget(distance = 8) {
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(distance));
}

function swingAxe() {
  state.axeSwing = 1;
  raycaster.setFromCamera(pointer, camera);
  const targets = [];
  trees.forEach((tree) => {
    if (tree.userData.alive) targets.push(...tree.children);
  });
  targets.push(monster);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit || hit.distance > 10) {
    setMessage("The axe swings through the rain.");
    return;
  }
  const tree = hit.object.userData.tree;
  if (tree?.userData.alive) {
    tree.userData.hp -= 1;
    tree.rotation.z = (Math.random() - 0.5) * 0.16;
    if (tree.userData.hp <= 0) {
      tree.userData.alive = false;
      player.wood += 5;
      tree.rotation.z = 0.85 * Math.sign(tree.position.x || 1);
      tree.position.y = -0.15;
      setMessage("Tree chopped down. You received 5 pieces of wood.");
    } else {
      setMessage("Chop! Keep swinging to cut the tree down.");
    }
  } else if (hit.object === monster || hit.object.parent === monster) {
    state.monsterHealth -= 35;
    setMessage("The monster growls at your axe hit.");
    checkWin();
  }
  updateHud();
}

function placeWoodBlock() {
  if (player.wood <= 0) {
    setMessage("You need more wood. Chop trees for 5 pieces each.");
    return;
  }
  const pos = getLookTarget(5.2);
  pos.x = Math.round(pos.x);
  pos.z = Math.round(pos.z);
  pos.y = Math.max(0.55, Math.round(pos.y - 0.2) + 0.55);
  if (Math.abs(pos.x) > 5 || Math.abs(pos.z) > 5 || pos.y > 12.5) {
    setMessage("Stack watchtower blocks on the wooden base pad.");
    return;
  }
  const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials.wood);
  block.position.copy(pos);
  block.castShadow = true;
  block.receiveShadow = true;
  block.userData.kind = "block";
  block.userData.hp = 80;
  blocks.push(block);
  scene.add(block);
  player.wood -= 1;
  updateHud();
}

function placeTurret() {
  const pos = getLookTarget(5.6);
  pos.y = 0.48;
  pos.x = THREE.MathUtils.clamp(pos.x, -8, 8);
  pos.z = THREE.MathUtils.clamp(pos.z, -8, 8);
  const group = makeTurretModel();
  group.position.copy(pos);
  group.userData = { kind: "turret", cooldown: 0 };
  turrets.push(group);
  scene.add(group);
  setMessage("Turret placed. You have unlimited turrets.");
  updateHud();
}

function makeTurretModel() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 0.32, 24), materials.metal);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.58), materials.metal);
  head.position.y = 0.48;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 12), materials.metal);
  barrel.position.set(0, 0.5, 0.55);
  barrel.rotation.x = Math.PI / 2;
  group.add(base, head, barrel);
  group.userData = { kind: "turret", cooldown: 0 };
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

function eatCake() {
  player.health = Math.min(100, player.health + 18);
  setMessage("Infinity cake eaten. Health restored.");
  updateHud();
}

function drinkCocoa() {
  player.warmth = 12;
  state.cocoaSteam = 4;
  addHotChocolateCup();
  setMessage("Hot chocolate warms you up and slows the rain damage.");
}

function updatePlayer(delta) {
  const speed = keys.has("shift") ? 9.5 : 6.2;
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw) * -1);
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, Math.sin(player.yaw));
  const move = new THREE.Vector3();
  if (isKeyDown("KeyW", "w", "ArrowUp")) move.add(forward);
  if (isKeyDown("KeyS", "s", "ArrowDown")) move.sub(forward);
  if (isKeyDown("KeyA", "a", "ArrowLeft")) move.sub(right);
  if (isKeyDown("KeyD", "d", "ArrowRight")) move.add(right);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed * delta);
    player.position.add(move);
  }
  const groundHeight = getStandingHeight(player.position);
  if (isKeyDown("Space", " ") && player.position.y <= groundHeight + 0.01) {
    player.velocityY = 7.5;
  }
  player.velocityY -= 18 * delta;
  player.position.y += player.velocityY * delta;
  if (player.position.y < groundHeight) {
    player.position.y = groundHeight;
    player.velocityY = 0;
  }
  player.position.x = THREE.MathUtils.clamp(player.position.x, -48, 48);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -48, 48);
  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  if (axe) {
    const swing = Math.sin((1 - state.axeSwing) * Math.PI);
    axe.position.set(0.55 + swing * 0.06, -0.54 - swing * 0.13, -0.86);
    axe.rotation.set(-0.75 - swing * 1.3, 0.24, -0.36 - swing * 0.55);
  }
}

function isKeyDown(...names) {
  return names.some((name) => keys.has(name));
}

function getStandingHeight(position) {
  if (Math.abs(position.x) <= 3.25 && Math.abs(position.z) <= 3.25) {
    return towerEyeY;
  }
  return 1.75;
}

function updateRain(delta) {
  rainDrops.forEach((drop) => {
    drop.position.y -= drop.userData.speed * delta;
    drop.position.x -= 2.1 * delta;
    if (drop.position.y < 0) {
      drop.position.y = 18 + Math.random() * 16;
      drop.position.x = player.position.x + (Math.random() - 0.5) * 70;
      drop.position.z = player.position.z + (Math.random() - 0.5) * 70;
    }
  });
  if (player.warmth > 0) player.warmth -= delta;
  else player.health -= delta * 0.6;
}

function updateMonster(delta) {
  state.roundTime += delta;

  const target = new THREE.Vector3(0, 0, 0);
  monster.position.lerp(target, delta * 0.011);
  monster.rotation.y = Math.atan2(monster.position.x, monster.position.z);
  monster.position.y = Math.sin(clock.elapsedTime * 2.5) * 0.05;
  const distance = monster.position.distanceTo(target);
  if (distance < 8.2) {
    state.monsterAttackTimer -= delta;
    if (state.monsterAttackTimer <= 0) {
      state.monsterAttackTimer = 2.0;
      const block = blocks.find((candidate) => candidate.position.distanceTo(monster.position) < 9);
      if (block) {
        block.userData.hp -= 28;
        block.material.emissive = new THREE.Color(0x3a1208);
        if (block.userData.hp <= 0) {
          blocks.splice(blocks.indexOf(block), 1);
          scene.remove(block);
        }
      } else {
        player.health -= 8;
        setMessage("The monster hit your base. Build the watchtower higher and use turrets.");
      }
    }
  }
}

function updateTowerBeam(delta) {
  if (!towerBeam || !monster || state.monsterHealth <= 0) return;
  if (state.roundTime <= 5) {
    towerBeam.visible = false;
    return;
  }

  const start = new THREE.Vector3(0, towerRoofY + 0.95, 2.45);
  const end = monster.position.clone().add(new THREE.Vector3(0, 4.2, 0));
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  towerBeam.visible = true;
  towerBeam.position.copy(midpoint);
  towerBeam.scale.set(1, direction.length(), 1);
  towerBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  towerBeam.material.opacity = 0.54 + Math.sin(clock.elapsedTime * 18) * 0.18;

  state.monsterHealth -= delta * 10;
  checkWin();
}

function updateTurrets(delta) {
  turrets.forEach((turret) => {
    if (turret.userData.towerGuard && state.roundTime < 5) return;
    turret.lookAt(monster.position.x, 0.55, monster.position.z);
    turret.userData.cooldown -= delta;
    if (turret.userData.cooldown <= 0 && state.monsterHealth > 0) {
      turret.userData.cooldown = turret.userData.towerGuard ? 0.28 : 0.32;
      state.monsterHealth -= turret.userData.towerGuard ? 18 : 8;
      checkWin();
      const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      bullet.position.copy(turret.position).add(new THREE.Vector3(0, 0.75, 0));
      bullet.userData.velocity = monster.position.clone().add(new THREE.Vector3(0, 3.4, 0)).sub(bullet.position).normalize().multiplyScalar(23);
      bullets.push(bullet);
      scene.add(bullet);
    }
  });

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.position.addScaledVector(bullet.userData.velocity, delta);
    if (bullet.position.distanceTo(monster.position.clone().add(new THREE.Vector3(0, 3.4, 0))) < 1.55) {
      state.monsterHealth -= turret.userData.towerGuard ? 16 : 18;
      scene.remove(bullet);
      bullets.splice(i, 1);
      checkWin();
    } else if (bullet.position.length() > 90) {
      scene.remove(bullet);
      bullets.splice(i, 1);
    }
  }
}

function checkWin() {
  if (state.monsterHealth <= 0 && !player.gameEnded) {
    player.gameEnded = true;
    document.querySelector("#end-kicker").textContent = "Monster defeated";
    document.querySelector("#end-title").textContent = "Watchtower Saved";
    document.querySelector("#end-copy").textContent = "Your cozy tower, turrets, cake, and hot chocolate survived the rainy woods.";
    gameOverScreen.classList.remove("hidden");
    document.exitPointerLock?.();
  }
}

function checkLose() {
  if (player.health <= 0 && !player.gameEnded) {
    player.gameEnded = true;
    document.querySelector("#end-kicker").textContent = "The rain won";
    document.querySelector("#end-title").textContent = "Game Over";
    document.querySelector("#end-copy").textContent = "Eat cakes, drink hot chocolate, and keep the monster away next time.";
    gameOverScreen.classList.remove("hidden");
    document.exitPointerLock?.();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  if (player.started && !player.gameEnded) {
    updatePlayer(delta);
    updateRain(delta);
    updateMonster(delta);
    updateTowerBeam(delta);
    updateTurrets(delta);
    updateWatchtower(delta);
    state.axeSwing = Math.max(0, state.axeSwing - delta * 4.2);
    state.cocoaSteam = Math.max(0, state.cocoaSteam - delta);
    if (warmLight) warmLight.intensity = 5.0 + Math.sin(clock.elapsedTime * 3) * 0.28;
    if (state.messageTimer > 0) state.messageTimer -= delta;
    if (state.messageTimer <= 0) messageEl.textContent = "WASD move, mouse look, click to use, 1-3 tools.";
    updateHud();
    checkLose();
  }
  renderer.render(scene, camera);
}

function updateWatchtower(delta) {
  if (!watchtower) return;
  const sway = Math.sin(clock.elapsedTime * 0.85) * 0.006;
  watchtower.rotation.z = THREE.MathUtils.lerp(watchtower.rotation.z, sway, delta * 2);
  watchtower.rotation.x = THREE.MathUtils.lerp(watchtower.rotation.x, Math.cos(clock.elapsedTime * 0.7) * 0.004, delta * 2);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  keys.add(event.key.toLowerCase());
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  const tools = ["axe", "wood", "turret"];
  const number = Number(event.key);
  if (number >= 1 && number <= tools.length) selectTool(tools[number - 1]);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas || player.gameEnded) return;
  player.yaw -= event.movementX * 0.0022;
  player.pitch -= event.movementY * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.25, 0.85);
});

canvas.addEventListener("click", () => {
  if (!player.started) return;
  canvas.requestPointerLock?.();
  useCurrentTool();
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => selectTool(button.dataset.tool));
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
cakeButton.addEventListener("click", eatCake);
cocoaButton.addEventListener("click", drinkCocoa);

initMaterials();
setupWorld();
updateHud();
animate();
