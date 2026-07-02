import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const gameOverScreen = document.querySelector("#game-over");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const hud = document.querySelector("#hud");
const hotbar = document.querySelector("#hotbar");
const crosshair = document.querySelector("#crosshair");
const messageEl = document.querySelector("#message");
const healthEl = document.querySelector("#health");
const armorEl = document.querySelector("#armor");
const roomEl = document.querySelector("#room");
const enemiesEl = document.querySelector("#enemies");
const weaponEl = document.querySelector("#weapon");
const endKicker = document.querySelector("#end-kicker");
const endTitle = document.querySelector("#end-title");
const endCopy = document.querySelector("#end-copy");
const slotButtons = [...document.querySelectorAll(".slot")];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10233b);
scene.fog = new THREE.FogExp2(0x17324d, 0.01);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const keys = new Set();
const interactables = [];
const enemies = [];
const projectiles = [];
const enemyProjectiles = [];
const roomMeshes = [];
const chestMeshes = [];

const player = {
  position: new THREE.Vector3(0, 1.7, 10),
  yaw: 0,
  pitch: -0.08,
  velocityY: 0,
  grounded: true,
  health: 120,
  armorReduction: 0.38,
  weapon: "rayGun",
  cooldown: 0,
  unlocked: new Set(["rayGun", "alienShotgun", "laserCannon"]),
  damageBonus: 1,
  robotFriend: false,
};

const state = {
  started: false,
  room: 1,
  roomsCleared: 0,
  messageTimer: 0,
  gameEnded: false,
  robotCooldown: 0,
};

const weaponStats = {
  rayGun: { label: "Ray Gun", damage: 22, cooldown: 0.28, speed: 46, color: 0x63f7ff, pellets: 1, spread: 0.005 },
  alienShotgun: { label: "Alien Shotgun", damage: 14, cooldown: 0.82, speed: 38, color: 0xa78bfa, pellets: 7, spread: 0.095 },
  laserCannon: { label: "Laser Cannon", damage: 58, cooldown: 1.15, speed: 58, color: 0x22c55e, pellets: 1, spread: 0.002 },
  laserSword: { label: "Laser Sword", damage: 72, cooldown: 0.48, range: 4.5, color: 0x38bdf8, melee: true },
  ultraWeapon: { label: "Ultra Weapon", damage: 999, cooldown: 0.62, speed: 72, color: 0xfacc15, pellets: 1, spread: 0 },
};

const enemyTypes = {
  alien: { label: "Alien", hp: 70, speed: 2.0, damage: 6, weapon: "rayGun", color: 0x22c55e, cooldown: 1.2 },
  scout: { label: "Alien Scout", hp: 55, speed: 3.1, damage: 10, weapon: "laserSword", color: 0x14b8a6, cooldown: 0.8 },
  chief: { label: "Alien Chief", hp: 150, speed: 1.55, damage: 14, weapon: "laserCannon", color: 0x7c3aed, cooldown: 1.9 },
  commander: { label: "Alien Commander", hp: 190, speed: 1.8, damage: 10, weapon: "alienShotgun", color: 0xbe123c, cooldown: 1.35 },
};

const materials = {};
let weaponModel;
let robotModel;
let roomExit;

function makeTexture(base, fleck, size = 128, flecks = 800) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < flecks; i += 1) {
    ctx.globalAlpha = 0.08 + Math.random() * 0.22;
    ctx.fillStyle = fleck;
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
  const metal = makeTexture("#46576f", "#cbd5e1", 128, 900);
  metal.repeat.set(8, 8);
  const floor = makeTexture("#263548", "#94a3b8", 128, 950);
  floor.repeat.set(10, 10);
  materials.wall = new THREE.MeshStandardMaterial({ color: 0x8290a5, map: metal, metalness: 0.45, roughness: 0.34, emissive: 0x111827, emissiveIntensity: 0.22 });
  materials.floor = new THREE.MeshStandardMaterial({ color: 0x53657d, map: floor, metalness: 0.22, roughness: 0.48, emissive: 0x0f172a, emissiveIntensity: 0.18 });
  materials.dark = new THREE.MeshStandardMaterial({ color: 0x263244, metalness: 0.35, roughness: 0.38 });
  materials.glass = new THREE.MeshPhysicalMaterial({ color: 0xa5f3fc, transmission: 0.12, thickness: 0.4, transparent: true, opacity: 0.58, roughness: 0.05 });
  materials.blueChest = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x052b52, metalness: 0.48, roughness: 0.22 });
  materials.redChest = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x450a0a, metalness: 0.55, roughness: 0.18 });
  materials.armor = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.72, roughness: 0.2 });
  materials.alienSkin = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.52 });
  materials.robot = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.72, roughness: 0.25 });
  materials.eye = new THREE.MeshBasicMaterial({ color: 0xa7f3d0 });
  materials.exit = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.32 });
}

function clearScene() {
  scene.clear();
  interactables.length = 0;
  enemies.length = 0;
  projectiles.length = 0;
  enemyProjectiles.length = 0;
  roomMeshes.length = 0;
  chestMeshes.length = 0;
  roomExit = null;
}

function addLights() {
  const ambient = new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.25);
  scene.add(ambient);
  const main = new THREE.DirectionalLight(0xffffff, 2.4);
  main.position.set(-12, 18, 9);
  main.castShadow = true;
  main.shadow.mapSize.set(2048, 2048);
  main.shadow.camera.left = -34;
  main.shadow.camera.right = 34;
  main.shadow.camera.top = 34;
  main.shadow.camera.bottom = -34;
  scene.add(main);
  const fill = new THREE.DirectionalLight(0x93c5fd, 1.15);
  fill.position.set(14, 10, -12);
  scene.add(fill);
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

function makeTextSprite(text, color = "#e0f2fe") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(4, 9, 20, 0.82)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 38px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(4.4, 1.1, 1);
  return sprite;
}

function setupRoom(roomNumber = 1) {
  clearScene();
  addLights();
  state.room = roomNumber;
  state.gameEnded = false;
  player.position.set(0, 1.7, 10);
  player.yaw = 0;
  player.pitch = -0.08;
  player.velocityY = 0;
  player.grounded = true;

  const width = 28 + roomNumber * 2;
  const depth = 30 + roomNumber * 3;
  const height = 9;
  const roomGlow = new THREE.PointLight(0xdbeafe, 3.8, Math.max(width, depth) * 1.2, 1.15);
  roomGlow.position.set(0, 5.8, 0);
  scene.add(roomGlow);
  const floor = addBox(new THREE.Vector3(width, 0.4, depth), new THREE.Vector3(0, -0.2, 0), materials.floor, { kind: "ground" });
  const ceiling = addBox(new THREE.Vector3(width, 0.4, depth), new THREE.Vector3(0, height, 0), materials.wall);
  const back = addBox(new THREE.Vector3(width, height, 0.55), new THREE.Vector3(0, height / 2, -depth / 2), materials.wall);
  const front = addBox(new THREE.Vector3(width, height, 0.55), new THREE.Vector3(0, height / 2, depth / 2), materials.wall);
  const left = addBox(new THREE.Vector3(0.55, height, depth), new THREE.Vector3(-width / 2, height / 2, 0), materials.wall);
  const right = addBox(new THREE.Vector3(0.55, height, depth), new THREE.Vector3(width / 2, height / 2, 0), materials.wall);
  roomMeshes.push(floor, ceiling, back, front, left, right);

  for (let i = 0; i < 7; i += 1) {
    const x = -width / 2 + 4 + i * ((width - 8) / 6);
    const light = new THREE.PointLight(i % 2 ? 0xa5f3fc : 0xc4b5fd, 4.8, 22, 1.45);
    light.position.set(x, 7.6, -depth / 2 + 2.4);
    scene.add(light);
    const panel = addBox(new THREE.Vector3(3.2, 0.08, 0.9), new THREE.Vector3(x, 8.78, -depth / 2 + 2.4), materials.glass);
    panel.rotation.x = Math.PI / 2;
  }

  [-1, 1].forEach((side) => {
    for (let i = 0; i < 4; i += 1) {
      const z = -depth / 2 + 6 + i * ((depth - 12) / 3);
      const wallLight = new THREE.PointLight(0x93c5fd, 2.1, 16, 1.7);
      wallLight.position.set(side * (width / 2 - 0.8), 3.4, z);
      scene.add(wallLight);
      const strip = addBox(new THREE.Vector3(0.08, 1.9, 0.28), new THREE.Vector3(side * (width / 2 - 0.32), 3.4, z), materials.glass);
      strip.rotation.y = Math.PI / 2;
    }
  });

  for (let i = 0; i < roomNumber + 2; i += 1) {
    const crate = addBox(
      new THREE.Vector3(2.2, 1.2 + Math.random() * 1.4, 2.2),
      new THREE.Vector3((Math.random() - 0.5) * (width - 8), 0.6, (Math.random() - 0.5) * (depth - 12)),
      materials.dark,
    );
    roomMeshes.push(crate);
  }

  createChest("blue", new THREE.Vector3(-width / 2 + 4, 0.55, 4));
  createChest("blue", new THREE.Vector3(width / 2 - 4, 0.55, -4));
  if (roomNumber === 2 || roomNumber === 4) createChest("red", new THREE.Vector3(0, 0.65, -depth / 2 + 5));

  roomExit = addBox(new THREE.Vector3(4.4, 5.4, 0.18), new THREE.Vector3(0, 2.7, -depth / 2 + 0.34), materials.exit, {
    interact: "exit",
    label: "Exit portal opens when the room is clear.",
  });
  roomExit.visible = false;
  interactables.push(roomExit);

  const title = makeTextSprite(`ROOM ${roomNumber}`, "#22d3ee");
  title.position.set(0, 4.4, depth / 2 - 1.2);
  scene.add(title);

  spawnEnemies(roomNumber, width, depth);
  createWeaponModel();
  if (player.robotFriend) createRobotFriend();
  showMessage("Clear the room. Blue chests give laser sword, robot friend, or UFO junk. Red chest can upgrade you or give the ultra weapon.");
  updateHud();
}

function createChest(type, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 1.25), type === "red" ? materials.redChest : materials.blueChest);
  body.castShadow = true;
  body.receiveShadow = true;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 1.38), type === "red" ? materials.redChest : materials.blueChest);
  lid.position.y = 0.68;
  lid.castShadow = true;
  const glow = new THREE.PointLight(type === "red" ? 0xef4444 : 0x38bdf8, type === "red" ? 2.4 : 1.8, 8);
  glow.position.y = 1.2;
  group.add(body, lid, glow);
  group.userData = { interact: "chest", chestType: type, label: `${type} chest` };
  scene.add(group);
  interactables.push(group);
  chestMeshes.push(group);
}

function spawnEnemies(roomNumber, width, depth) {
  const list = roomNumber === 1 ? ["alien", "scout", "alien"] : roomNumber === 2 ? ["alien", "scout", "chief", "alien"] : roomNumber === 3 ? ["alien", "scout", "chief", "commander"] : ["chief", "commander", "commander", "scout", "alien"];
  list.forEach((type, index) => {
    const x = -width / 2 + 5 + (index % 4) * ((width - 10) / 3);
    const z = -depth / 2 + 7 + Math.floor(index / 4) * 5 + Math.random() * 2;
    createEnemy(type, new THREE.Vector3(x, 0, z));
  });
}

function createEnemy(type, position) {
  const stats = enemyTypes[type];
  const group = new THREE.Group();
  group.position.copy(position);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.65, 0.7), new THREE.MeshStandardMaterial({ color: stats.color, metalness: 0.28, roughness: 0.38 }));
  body.position.y = 1.2;
  body.castShadow = true;
  const armor = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.15, 0.86), materials.armor);
  armor.position.y = 1.24;
  armor.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 16), materials.alienSkin);
  head.position.y = 2.32;
  head.scale.set(1.2, 0.86, 1);
  head.castShadow = true;
  const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), materials.eye);
  eyeA.position.set(-0.18, 2.38, -0.41);
  const eyeB = eyeA.clone();
  eyeB.position.x = 0.18;
  const weapon = new THREE.Mesh(new THREE.BoxGeometry(stats.weapon === "laserSword" ? 0.16 : 0.95, 0.18, stats.weapon === "laserSword" ? 1.6 : 0.28), new THREE.MeshBasicMaterial({ color: weaponStats[stats.weapon]?.color ?? 0x67e8f9 }));
  weapon.position.set(0.65, 1.55, -0.42);
  weapon.rotation.y = -0.18;
  group.add(body, armor, head, eyeA, eyeB, weapon);
  group.userData = {
    type,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    weapon: stats.weapon,
    cooldown: 0.7 + Math.random(),
    label: stats.label,
  };
  scene.add(group);
  enemies.push(group);
}

function createWeaponModel() {
  if (weaponModel) scene.remove(weaponModel);
  weaponModel = new THREE.Group();
  const stat = weaponStats[player.weapon];
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, player.weapon === "laserCannon" ? 1.4 : 0.95), new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7, roughness: 0.22 }));
  body.position.set(0.55, -0.45, -0.85);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, player.weapon === "laserCannon" ? 1.3 : 0.8, 18), new THREE.MeshBasicMaterial({ color: stat.color }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.55, -0.43, -1.38);
  weaponModel.add(body, barrel);
  camera.add(weaponModel);
  scene.add(camera);
}

function createRobotFriend() {
  if (robotModel) scene.remove(robotModel);
  robotModel = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1, 0.55), materials.robot);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.52), materials.robot);
  head.position.y = 1.65;
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: 0x67e8f9 }));
  eye.position.set(0, 1.68, -0.28);
  robotModel.add(body, head, eye);
  robotModel.position.copy(player.position).add(new THREE.Vector3(1.5, -1.7, 1.5));
  scene.add(robotModel);
}

function openChest(chest) {
  const type = chest.userData.chestType;
  if (type === "blue") {
    const loot = ["laserSword", "robotFriend", "ufoJunk"][Math.floor(Math.random() * 3)];
    if (loot === "laserSword") {
      player.unlocked.add("laserSword");
      player.weapon = "laserSword";
      showMessage("Blue chest gave Laser Sword.");
    } else if (loot === "robotFriend") {
      player.robotFriend = true;
      createRobotFriend();
      showMessage("Blue chest gave Robot Friend. It helps in battles.");
    } else {
      showMessage("Blue chest gave UFO Junk. It does nothing.");
    }
  } else {
    if (Math.random() < 0.5) {
      player.damageBonus += 0.35;
      player.health = Math.min(170, player.health + 35);
      showMessage("Red chest upgraded you: more damage and health.");
    } else {
      player.unlocked.add("ultraWeapon");
      player.weapon = "ultraWeapon";
      showMessage("Red chest gave the Ultra Weapon. It one-shots anything.");
    }
  }
  scene.remove(chest);
  removeFrom(interactables, chest);
  removeFrom(chestMeshes, chest);
  createWeaponModel();
  updateHud();
}

function shoot() {
  if (!state.started || state.gameEnded || player.cooldown > 0) return;
  const stat = weaponStats[player.weapon];
  if (stat.melee) {
    player.cooldown = stat.cooldown;
    const target = enemies.find((enemy) => enemy.position.distanceTo(player.position) < stat.range);
    if (target) damageEnemy(target, stat.damage * player.damageBonus);
    showMuzzleFlash(stat.color);
    return;
  }
  player.cooldown = stat.cooldown;
  for (let i = 0; i < stat.pellets; i += 1) {
    const direction = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
    direction.x += (Math.random() - 0.5) * stat.spread;
    direction.y += (Math.random() - 0.5) * stat.spread;
    direction.z += (Math.random() - 0.5) * stat.spread;
    direction.normalize();
    createProjectile(player.position.clone().add(direction.clone().multiplyScalar(1.2)), direction, stat, true);
  }
  showMuzzleFlash(stat.color);
}

function createProjectile(position, direction, stat, friendly) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(friendly ? 0.1 : 0.12, 12, 8), new THREE.MeshBasicMaterial({ color: stat.color }));
  mesh.position.copy(position);
  mesh.userData = {
    velocity: direction.multiplyScalar(stat.speed),
    damage: stat.damage * (friendly ? player.damageBonus : 1),
    life: 2.2,
    friendly,
  };
  scene.add(mesh);
  (friendly ? projectiles : enemyProjectiles).push(mesh);
}

function showMuzzleFlash(color) {
  const flash = new THREE.PointLight(color, 3.5, 7);
  flash.position.copy(player.position);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 65);
}

function damageEnemy(enemy, damage) {
  enemy.userData.hp -= damage;
  const light = new THREE.PointLight(0xff4040, 2, 5);
  light.position.copy(enemy.position).setY(1.7);
  scene.add(light);
  setTimeout(() => scene.remove(light), 90);
  if (enemy.userData.hp <= 0) {
    scene.remove(enemy);
    removeFrom(enemies, enemy);
    showMessage(`${enemy.userData.label} defeated.`);
    if (!enemies.length) {
      roomExit.visible = true;
      showMessage("Room clear. Walk to the glowing exit portal.");
    }
  }
}

function enemyShoot(enemy) {
  const stats = enemyTypes[enemy.userData.type];
  const weapon = weaponStats[stats.weapon] ?? weaponStats.rayGun;
  if (stats.weapon === "laserSword") return;
  const origin = enemy.position.clone().setY(1.7);
  const direction = player.position.clone().sub(origin).normalize();
  const pellets = stats.weapon === "alienShotgun" ? 7 : 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = stats.weapon === "alienShotgun" ? 0.13 : 0.025;
    const shotDir = direction.clone();
    shotDir.x += (Math.random() - 0.5) * spread;
    shotDir.y += (Math.random() - 0.5) * spread;
    shotDir.z += (Math.random() - 0.5) * spread;
    shotDir.normalize();
    createProjectile(origin, shotDir, { ...weapon, damage: stats.damage, speed: weapon.speed * 0.72, color: weapon.color }, false);
  }
}

function updateMovement(dt) {
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.2 : 4.8;
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const move = new THREE.Vector3();
  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.sub(forward);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);
  if (move.lengthSq() > 0) player.position.add(move.normalize().multiplyScalar(speed * dt));
  player.velocityY -= 22 * dt;
  player.position.y += player.velocityY * dt;
  if (player.position.y <= 1.7) {
    player.position.y = 1.7;
    player.velocityY = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
  player.position.x = THREE.MathUtils.clamp(player.position.x, -18, 18);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -22, 18);
  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function updateEnemies(dt) {
  enemies.forEach((enemy) => {
    const data = enemy.userData;
    data.cooldown -= dt;
    const targetPosition = player.position;
    const toPlayer = targetPosition.clone().sub(enemy.position);
    const distance = toPlayer.length();
    enemy.lookAt(player.position.x, enemy.position.y, player.position.z);
    if (data.weapon === "laserSword") {
      if (distance > 2.2) {
        toPlayer.y = 0;
        enemy.position.add(toPlayer.normalize().multiplyScalar(data.speed * dt));
      } else if (data.cooldown <= 0) {
        hurtPlayer(data.damage);
        data.cooldown = enemyTypes[data.type].cooldown;
      }
    } else if (distance > 9) {
      toPlayer.y = 0;
      enemy.position.add(toPlayer.normalize().multiplyScalar(data.speed * 0.45 * dt));
    } else if (data.cooldown <= 0) {
      enemyShoot(enemy);
      data.cooldown = enemyTypes[data.type].cooldown;
    }
  });

  if (player.robotFriend && robotModel) {
    state.robotCooldown -= dt;
    const follow = player.position.clone().add(new THREE.Vector3(1.5, -1.7, 1.7));
    robotModel.position.lerp(follow, 0.08);
    const target = enemies[0];
    if (target && state.robotCooldown <= 0) {
      const direction = target.position.clone().setY(1.5).sub(robotModel.position.clone().setY(1.2)).normalize();
      createProjectile(robotModel.position.clone().setY(1.35), direction, { damage: 18, speed: 42, color: 0x67e8f9 }, true);
      state.robotCooldown = 0.75;
    }
  }
}

function updateProjectiles(dt) {
  [...projectiles].forEach((shot) => {
    shot.userData.life -= dt;
    shot.position.add(shot.userData.velocity.clone().multiplyScalar(dt));
    const target = enemies.find((enemy) => enemy.position.distanceTo(shot.position) < 1.05);
    if (target) {
      damageEnemy(target, shot.userData.damage);
      removeShot(shot, projectiles);
    } else if (shot.userData.life <= 0) {
      removeShot(shot, projectiles);
    }
  });

  [...enemyProjectiles].forEach((shot) => {
    shot.userData.life -= dt;
    shot.position.add(shot.userData.velocity.clone().multiplyScalar(dt));
    if (shot.position.distanceTo(player.position) < 0.9) {
      hurtPlayer(shot.userData.damage);
      removeShot(shot, enemyProjectiles);
    } else if (shot.userData.life <= 0) {
      removeShot(shot, enemyProjectiles);
    }
  });
}

function removeShot(shot, list) {
  scene.remove(shot);
  removeFrom(list, shot);
}

function hurtPlayer(damage) {
  const finalDamage = Math.max(1, Math.round(damage * (1 - player.armorReduction)));
  player.health -= finalDamage;
  showMessage(`Alien armor reduced damage to ${finalDamage}.`);
  if (player.health <= 0) endGame("Aliens won", "Your alien armor cracked. Try opening more chests before fighting commanders.");
}

function interact() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(interactables, true);
  const hit = hits.find((entry) => entry.distance < 6);
  if (!hit) return;
  let object = hit.object;
  while (object.parent && !object.userData.interact) object = object.parent;
  if (object.userData.interact === "chest") openChest(object);
  if (object.userData.interact === "exit" && object.visible && !enemies.length) {
    if (state.room >= 4) {
      endGame("You stopped the revenge", "The alien commander rooms are cleared.");
    } else {
      setupRoom(state.room + 1);
    }
  }
}

function selectWeapon(key) {
  if (!player.unlocked.has(key)) {
    showMessage("That weapon is locked. Open blue or red chests.");
    return;
  }
  player.weapon = key;
  createWeaponModel();
  updateHud();
}

function updateHud() {
  healthEl.textContent = Math.max(0, Math.round(player.health));
  armorEl.textContent = `${Math.round(player.armorReduction * 100)}%`;
  roomEl.textContent = state.room;
  enemiesEl.textContent = enemies.length;
  weaponEl.textContent = weaponStats[player.weapon].label;
  slotButtons.forEach((button) => {
    const key = button.dataset.weapon;
    button.classList.toggle("active", key === player.weapon);
    button.classList.toggle("locked", !player.unlocked.has(key));
  });
}

function showMessage(message) {
  messageEl.textContent = message;
  state.messageTimer = 4;
}

function endGame(title, copy) {
  state.gameEnded = true;
  endKicker.textContent = `Room ${state.room}`;
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

function resetGame() {
  player.health = 120;
  player.weapon = "rayGun";
  player.cooldown = 0;
  player.unlocked = new Set(["rayGun", "alienShotgun", "laserCannon"]);
  player.damageBonus = 1;
  player.robotFriend = false;
  state.started = true;
  state.room = 1;
  state.gameEnded = false;
  setupRoom(1);
  hud.classList.remove("hidden");
  hotbar.classList.remove("hidden");
  crosshair.classList.remove("hidden");
  lockPointer();
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.04);
  if (state.started && !state.gameEnded) {
    player.cooldown = Math.max(0, player.cooldown - dt);
    updateMovement(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    if (weaponModel) {
      weaponModel.rotation.z = Math.sin(clock.elapsedTime * 6) * 0.012;
      weaponModel.position.y = Math.sin(clock.elapsedTime * 3) * 0.015;
    }
    updateHud();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

startButton.addEventListener("click", () => {
  startScreen.classList.add("hidden");
  resetGame();
});

restartButton.addEventListener("click", () => {
  gameOverScreen.classList.add("hidden");
  resetGame();
});

slotButtons.forEach((button) => button.addEventListener("click", () => selectWeapon(button.dataset.weapon)));
canvas.addEventListener("click", () => {
  if (!state.started || state.gameEnded) return;
  lockPointer();
  shoot();
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Digit1") selectWeapon("rayGun");
  if (event.code === "Digit2") selectWeapon("alienShotgun");
  if (event.code === "Digit3") selectWeapon("laserCannon");
  if (event.code === "Digit4") selectWeapon("laserSword");
  if (event.code === "Digit5") selectWeapon("ultraWeapon");
  if (event.code === "Space" && player.grounded) {
    player.velocityY = 7.4;
    player.grounded = false;
  }
  if (event.code === "KeyE") interact();
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= event.movementX * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - event.movementY * 0.002, -1.15, 0.52);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

initMaterials();
setupRoom(1);
animate();
