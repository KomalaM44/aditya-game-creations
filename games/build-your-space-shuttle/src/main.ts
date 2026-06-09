import * as THREE from 'three';
import './styles.css';

type PartType = 'block' | 'fuel' | 'booster' | 'engine' | 'nose' | 'window';
type PlanetName = 'Earth' | 'Moon' | 'Mars' | 'Jupiter Base' | 'Titan';

type ShuttlePart = {
  id: number;
  type: PartType;
  mesh: THREE.Mesh;
  grid: THREE.Vector3;
};

type Planet = {
  name: PlanetName;
  color: number;
  atmosphere: number;
  gravity: number;
  reward: number;
};

const planets: Planet[] = [
  { name: 'Earth', color: 0x3d8f4e, atmosphere: 0x81d9ff, gravity: 1, reward: 0 },
  { name: 'Moon', color: 0xa8a8a8, atmosphere: 0xbfc6d4, gravity: 0.16, reward: 140 },
  { name: 'Mars', color: 0xb55336, atmosphere: 0xffb38a, gravity: 0.38, reward: 210 },
  { name: 'Jupiter Base', color: 0xd9a267, atmosphere: 0xf3d4aa, gravity: 2.1, reward: 360 },
  { name: 'Titan', color: 0xc7a945, atmosphere: 0xffd66b, gravity: 0.14, reward: 420 }
];

const partPrices: Record<PartType, number> = {
  block: 10,
  fuel: 35,
  booster: 45,
  engine: 55,
  nose: 25,
  window: 15
};

const partLabels: Record<PartType, string> = {
  block: 'Hull Block',
  fuel: 'Fuel Tank',
  booster: 'Booster',
  engine: 'Engine',
  nose: 'Nose Cone',
  window: 'Window'
};

const partIcons: Record<PartType, string> = {
  block: '■',
  fuel: '●',
  booster: '↟',
  engine: '▾',
  nose: '▲',
  window: '◉'
};

const paintColors = ['#f8fafc', '#ef4444', '#2563eb', '#22c55e', '#f59e0b', '#a855f7', '#111827'];
const worldRadius = 54;
const buildLimit = 48;

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main class="game-shell">
    <canvas id="scene" aria-label="3D space shuttle game"></canvas>
    <a class="home-link" href="../../index.html">Home</a>
    <section class="hud top-left">
      <div class="brand">Build Your Space Shuttle</div>
      <div class="stats">
        <span id="money">$320</span>
        <span id="wood">Wood 0</span>
        <span id="fuel">Fuel 0%</span>
        <span id="oxygen">O2 Ready</span>
      </div>
    </section>
    <section class="hud top-right">
      <button id="helpButton" class="icon-button help-button" title="How to play">?</button>
      <button id="buildMode" class="icon-button active" title="Build mode">▦</button>
      <button id="flyMode" class="icon-button" title="Astronaut mode">⌁</button>
      <button id="vipButton" class="tool-button" title="Invite a VIP passenger">VIP +$90</button>
      <button id="launchButton" class="launch-button" title="Launch shuttle">Launch</button>
    </section>
    <section class="panel build-panel">
      <div class="segmented" id="parts"></div>
      <div class="paint-row" id="paint"></div>
      <div class="actions">
        <button id="undoButton" class="tool-button" title="Remove last part">Undo</button>
        <button id="clearButton" class="tool-button" title="Clear shuttle">Clear</button>
      </div>
    </section>
    <section class="panel planet-panel">
      <label for="planetSelect">Destination</label>
      <select id="planetSelect"></select>
      <div id="missionText" class="mission-text">Build a shuttle, add fuel and an engine, then launch.</div>
    </section>
    <section class="crosshair" aria-hidden="true"></section>
    <section id="helpOverlay" class="help-overlay" aria-hidden="true">
      <div class="help-dialog" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
        <div class="help-header">
          <h2 id="helpTitle">How To Play</h2>
          <button id="closeHelpButton" class="icon-button" title="Close help">x</button>
        </div>
        <div class="help-grid">
          <div><strong>Build</strong><span>Pick a part, choose a paint color, then click the launch pad to stack blocks.</span></div>
          <div><strong>Move</strong><span>Press W A S D to walk, Space to jump, and arrow keys or mouse to look around.</span></div>
          <div><strong>Launch</strong><span>Add enough fuel, engines, boosters, and stable parts for the planet gravity.</span></div>
          <div><strong>Explore</strong><span>Press Backspace or click to swing your axe. Aim at close trees or aliens.</span></div>
          <div><strong>VIP</strong><span>Add a window, invite a VIP, and land safely to earn bonus money.</span></div>
          <div><strong>Oxygen</strong><span>On other planets you spawn with an oxygen tank. Return happens if it runs out.</span></div>
        </div>
      </div>
    </section>
    <section id="toast" class="toast"></section>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.FogExp2(0x111827, 0.015);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);
camera.position.set(7, 6, 11);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const keys = new Set<string>();

const state = {
  money: 320,
  wood: 0,
  oxygen: 100,
  selectedPart: 'block' as PartType,
  selectedPaint: '#f8fafc',
  buildMode: true,
  launched: false,
  currentPlanet: planets[0],
  vipOnBoard: false,
  flightTime: 0,
  astronautHealth: 100,
  lookYaw: 0,
  lookPitch: -0.08,
  verticalVelocity: 0,
  onGround: true,
  axeCooldown: 0,
  axeSwing: 0
};

const shuttleParts: ShuttlePart[] = [];
let partId = 1;
let preview: THREE.Mesh | null = null;
let astronaut: THREE.Group;
let firstPersonRig: THREE.Group;
const aliens: THREE.Group[] = [];
const trees: THREE.Group[] = [];
const surfaceDetails: THREE.Object3D[] = [];
const particles: THREE.Mesh[] = [];

const world = new THREE.Group();
const shuttle = new THREE.Group();
const stars = new THREE.Group();
scene.add(world, shuttle, stars, camera);

const groundMaterial = new THREE.MeshStandardMaterial({ color: planets[0].color, roughness: 0.85 });
const ground = new THREE.Mesh(new THREE.CylinderGeometry(worldRadius, worldRadius + 3, 1.5, 128), groundMaterial);
ground.position.y = -0.8;
ground.receiveShadow = true;
world.add(ground);

const grid = new THREE.GridHelper(worldRadius * 2, worldRadius * 2, 0xd1d5db, 0x374151);
grid.position.y = 0.02;
world.add(grid);

const pad = new THREE.Mesh(
  new THREE.CylinderGeometry(4.7, 5.2, 0.35, 64),
  new THREE.MeshStandardMaterial({ color: 0x2f3a46, metalness: 0.25, roughness: 0.35 })
);
pad.position.y = 0.18;
pad.receiveShadow = true;
world.add(pad);

const engineGlow = new THREE.PointLight(0xff8a1f, 0, 7, 2);
engineGlow.position.set(0, 0.35, 0);
shuttle.add(engineGlow);

const enginePlume = new THREE.Mesh(
  new THREE.ConeGeometry(0.55, 1.8, 28),
  new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0, depthWrite: false })
);
enginePlume.position.y = -0.45;
enginePlume.rotation.x = Math.PI;
shuttle.add(enginePlume);

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(9, 16, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);
const skyLight = new THREE.HemisphereLight(0xc7ddff, 0x1f2f18, 1.35);
scene.add(skyLight);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(worldRadius + 11, 64, 32),
  new THREE.MeshBasicMaterial({ color: planets[0].atmosphere, transparent: true, opacity: 0.08, side: THREE.BackSide })
);
world.add(atmosphere);

function makeStars() {
  for (let i = 0; i < 420; i++) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(Math.random() * 0.035 + 0.01, 8, 8),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.2 ? 0xffffff : 0xa7c7ff })
    );
    const radius = 90 + Math.random() * 120;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    star.position.setFromSphericalCoords(radius, phi, theta);
    stars.add(star);
  }
}

function makeAstronaut() {
  const suitMaterial = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.56, metalness: 0.05 });
  const fabricMaterial = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.74 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.25, roughness: 0.26 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.46 });
  const tankMaterial = new THREE.MeshStandardMaterial({ color: 0x93c5fd, metalness: 0.45, roughness: 0.22 });
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 10, 20), suitMaterial);
  body.position.y = 0.78;
  body.castShadow = true;

  const chestPack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.16), fabricMaterial);
  chestPack.position.set(0, 0.95, 0.3);
  chestPack.castShadow = true;

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.12, 24), trimMaterial);
  belt.position.y = 0.54;
  belt.scale.z = 0.78;
  belt.castShadow = true;

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 20), suitMaterial);
  helmet.position.y = 1.36;
  helmet.castShadow = true;
  const helmetRing = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 10, 28), trimMaterial);
  helmetRing.position.y = 1.13;
  helmetRing.rotation.x = Math.PI / 2;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 12), darkMaterial);
  visor.scale.set(1.08, 0.48, 0.34);
  visor.position.set(0, 1.38, 0.3);

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.78, 20), tankMaterial);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0.96, -0.34);
  tank.castShadow = true;

  const hose = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 8, 32, Math.PI), darkMaterial);
  hose.position.set(0, 1.05, -0.12);
  hose.rotation.set(Math.PI * 0.6, 0, 0);

  const armGeometry = new THREE.CapsuleGeometry(0.085, 0.5, 8, 12);
  const legGeometry = new THREE.CapsuleGeometry(0.1, 0.46, 8, 12);
  const leftArm = new THREE.Mesh(armGeometry, suitMaterial);
  const rightArm = new THREE.Mesh(armGeometry, suitMaterial);
  leftArm.position.set(-0.42, 0.82, 0.02);
  rightArm.position.set(0.42, 0.82, 0.02);
  leftArm.rotation.z = 0.26;
  rightArm.rotation.z = -0.26;
  leftArm.castShadow = true;
  rightArm.castShadow = true;
  const leftLeg = new THREE.Mesh(legGeometry, suitMaterial);
  const rightLeg = new THREE.Mesh(legGeometry, suitMaterial);
  leftLeg.position.set(-0.14, 0.22, 0);
  rightLeg.position.set(0.14, 0.22, 0);
  leftLeg.castShadow = true;
  rightLeg.castShadow = true;
  const bootA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.34), darkMaterial);
  const bootB = bootA.clone();
  bootA.position.set(-0.14, 0.02, 0.07);
  bootB.position.set(0.14, 0.02, 0.07);
  bootA.castShadow = true;
  bootB.castShadow = true;

  const axe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
  axe.position.set(0.45, 0.7, 0.08);
  axe.rotation.z = -0.35;
  group.add(body, chestPack, belt, helmet, helmetRing, visor, tank, hose, leftArm, rightArm, leftLeg, rightLeg, bootA, bootB, axe);
  group.position.set(-5.5, 0.1, 4.5);
  return group;
}

function makeFirstPersonRig() {
  const rig = new THREE.Group();
  const suitMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  const gloveMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.25, roughness: 0.28 });
  const axeMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 });

  const visorRim = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.035, 12, 72), darkMaterial);
  visorRim.position.set(0, -0.02, -0.75);
  visorRim.scale.set(1.32, 0.74, 0.18);

  const leftSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.55, 8, 12), suitMaterial);
  const rightSleeve = leftSleeve.clone();
  leftSleeve.position.set(-0.45, -0.45, -0.75);
  rightSleeve.position.set(0.45, -0.45, -0.75);
  leftSleeve.rotation.set(0.8, -0.22, -0.35);
  rightSleeve.rotation.set(0.8, 0.22, 0.35);

  const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), gloveMaterial);
  const rightGlove = leftGlove.clone();
  leftGlove.position.set(-0.34, -0.62, -0.92);
  rightGlove.position.set(0.34, -0.62, -0.92);

  const axeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.06), axeMaterial);
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), darkMaterial);
  axeHandle.position.set(-0.42, -0.5, -0.9);
  axeHandle.rotation.z = -0.4;
  axeHead.position.set(-0.52, -0.33, -0.94);
  axeHead.rotation.z = -0.4;

  rig.add(visorRim, leftSleeve, rightSleeve, leftGlove, rightGlove, axeHandle, axeHead);
  rig.visible = false;
  return rig;
}

function createPartMesh(type: PartType, color: string) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: type === 'engine' ? 0.45 : 0.12 });
  let geometry: THREE.BufferGeometry;
  if (type === 'fuel') geometry = new THREE.CylinderGeometry(0.42, 0.42, 1, 28);
  else if (type === 'booster') geometry = new THREE.CylinderGeometry(0.32, 0.4, 1, 24);
  else if (type === 'engine') geometry = new THREE.ConeGeometry(0.44, 0.78, 28);
  else if (type === 'nose') geometry = new THREE.ConeGeometry(0.56, 1, 32);
  else if (type === 'window') geometry = new THREE.SphereGeometry(0.36, 24, 16);
  else geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (type === 'engine') mesh.rotation.x = Math.PI;
  if (type === 'window') mesh.scale.set(1, 0.58, 0.32);
  return mesh;
}

function makeTree(x: number, z: number) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 1.15, 10),
    new THREE.MeshStandardMaterial({ color: 0x7c4a23, roughness: 0.8 })
  );
  trunk.position.y = 0.65;
  trunk.castShadow = true;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(0.72, 1.55, 12),
    new THREE.MeshStandardMaterial({ color: 0x1f7a3a, roughness: 0.85 })
  );
  leaves.position.y = 1.55;
  leaves.castShadow = true;
  group.add(trunk, leaves);
  group.position.set(x, 0, z);
  group.userData.health = 3;
  trees.push(group);
  world.add(group);
}

function makeRock(x: number, z: number, scale: number) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(scale, 0),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.92, metalness: 0.03 })
  );
  rock.position.set(x, scale * 0.34, z);
  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  rock.scale.y = THREE.MathUtils.randFloat(0.45, 0.9);
  rock.castShadow = true;
  rock.receiveShadow = true;
  surfaceDetails.push(rock);
  world.add(rock);
}

function makeCrater(x: number, z: number, radius: number) {
  const crater = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.045, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.95 })
  );
  crater.position.set(x, 0.055, z);
  crater.rotation.x = Math.PI / 2;
  crater.scale.y = THREE.MathUtils.randFloat(0.72, 1.25);
  surfaceDetails.push(crater);
  world.add(crater);
}

function makeAlien(x: number, z: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x7ddf64, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.7, 8, 16), material);
  body.position.y = 0.76;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), material);
  head.position.y = 1.34;
  head.castShadow = true;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
  const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
  const eyeB = eyeA.clone();
  eyeA.position.set(-0.12, 1.39, 0.28);
  eyeB.position.set(0.12, 1.39, 0.28);
  group.add(body, head, eyeA, eyeB);
  group.position.set(x, 0, z);
  group.userData.health = 3;
  aliens.push(group);
  world.add(group);
}

function populatePlanet() {
  for (const tree of [...trees]) world.remove(tree);
  for (const alien of [...aliens]) world.remove(alien);
  for (const detail of [...surfaceDetails]) world.remove(detail);
  trees.length = 0;
  aliens.length = 0;
  surfaceDetails.length = 0;
  for (let i = 0; i < 42; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * (worldRadius - 9);
    if (Math.abs(Math.cos(angle) * radius) < 6 && Math.abs(Math.sin(angle) * radius) < 6) continue;
    if (state.currentPlanet.name === 'Earth' && Math.random() > 0.35) {
      makeRock(Math.cos(angle) * radius, Math.sin(angle) * radius, THREE.MathUtils.randFloat(0.12, 0.45));
    } else {
      makeCrater(Math.cos(angle) * radius, Math.sin(angle) * radius, THREE.MathUtils.randFloat(0.55, 1.6));
    }
  }
  if (state.currentPlanet.name === 'Earth') {
    for (let i = 0; i < 34; i++) {
      const angle = (i / 34) * Math.PI * 2;
      const radius = 13 + Math.random() * 35;
      makeTree(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  } else {
    for (let i = 0; i < 8; i++) {
      makeAlien(THREE.MathUtils.randFloatSpread(buildLimit * 1.5), THREE.MathUtils.randFloatSpread(buildLimit * 1.5));
    }
  }
}

function renderPartButtons() {
  const partWrap = document.querySelector<HTMLDivElement>('#parts')!;
  partWrap.innerHTML = '';
  (Object.keys(partPrices) as PartType[]).forEach((type) => {
    const button = document.createElement('button');
    button.className = `part-button ${state.selectedPart === type ? 'active' : ''}`;
    button.title = `${partLabels[type]} $${partPrices[type]}`;
    button.innerHTML = `<span>${partIcons[type]}</span><small>$${partPrices[type]}</small>`;
    button.addEventListener('click', () => {
      state.selectedPart = type;
      renderPartButtons();
      makePreview();
    });
    partWrap.appendChild(button);
  });
}

function renderPaintButtons() {
  const paintWrap = document.querySelector<HTMLDivElement>('#paint')!;
  paintWrap.innerHTML = '';
  paintColors.forEach((color) => {
    const button = document.createElement('button');
    button.className = `swatch ${state.selectedPaint === color ? 'active' : ''}`;
    button.title = `Paint ${color}`;
    button.style.background = color;
    button.addEventListener('click', () => {
      state.selectedPaint = color;
      renderPaintButtons();
      makePreview();
    });
    paintWrap.appendChild(button);
  });
}

function renderPlanetOptions() {
  const select = document.querySelector<HTMLSelectElement>('#planetSelect')!;
  select.innerHTML = planets
    .filter((planet) => planet.name !== 'Earth')
    .map((planet) => `<option value="${planet.name}">${planet.name} +$${planet.reward}</option>`)
    .join('');
}

function updateHud() {
  document.querySelector('#money')!.textContent = `$${state.money}`;
  document.querySelector('#wood')!.textContent = `Wood ${state.wood}`;
  const fuelPercent = Math.min(100, shuttleParts.filter((part) => part.type === 'fuel').length * 28);
  document.querySelector('#fuel')!.textContent = `Fuel ${fuelPercent}%`;
  document.querySelector('#oxygen')!.textContent = state.currentPlanet.name === 'Earth' ? 'O2 Ready' : `O2 ${Math.ceil(state.oxygen)}%`;
  const stats = getShuttleStats();
  const mission = document.querySelector('#missionText')!;
  mission.textContent = state.launched
    ? `In flight to ${state.currentPlanet.name}. Thrust ${stats.thrust.toFixed(1)}, mass ${stats.mass.toFixed(1)}.`
    : `Build a stable shuttle. Thrust ${stats.thrust.toFixed(1)}, mass ${stats.mass.toFixed(1)}.`;
}

function showToast(text: string) {
  const toast = document.querySelector<HTMLDivElement>('#toast')!;
  toast.textContent = text;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

function makePreview() {
  if (preview) shuttle.remove(preview);
  preview = createPartMesh(state.selectedPart, state.selectedPaint);
  (preview.material as THREE.MeshStandardMaterial).transparent = true;
  (preview.material as THREE.MeshStandardMaterial).opacity = 0.46;
  shuttle.add(preview);
}

function snapPosition(point: THREE.Vector3) {
  const x = THREE.MathUtils.clamp(Math.round(point.x), -buildLimit, buildLimit);
  const z = THREE.MathUtils.clamp(Math.round(point.z), -buildLimit, buildLimit);
  const existing = shuttleParts.filter((part) => part.grid.x === x && part.grid.z === z);
  const y = existing.length;
  return new THREE.Vector3(x, y + 0.7, z);
}

function placePart() {
  if (!preview || state.launched || !state.buildMode) return;
  const cost = partPrices[state.selectedPart];
  if (state.money < cost) {
    showToast('Need more money. Invite VIPs or complete missions.');
    return;
  }
  const mesh = createPartMesh(state.selectedPart, state.selectedPaint);
  mesh.position.copy(preview.position);
  const part: ShuttlePart = { id: partId++, type: state.selectedPart, mesh, grid: preview.position.clone() };
  shuttleParts.push(part);
  shuttle.add(mesh);
  state.money -= cost;
  updateHud();
}

function removeLastPart() {
  const part = shuttleParts.pop();
  if (!part) return;
  shuttle.remove(part.mesh);
  state.money += Math.floor(partPrices[part.type] * 0.5);
  updateHud();
}

function clearShuttle() {
  while (shuttleParts.length) {
    const part = shuttleParts.pop()!;
    shuttle.remove(part.mesh);
  }
  state.money = Math.max(state.money, 160);
  updateHud();
}

function hasPart(type: PartType) {
  return shuttleParts.some((part) => part.type === type);
}

function getShuttleStats() {
  const mass = shuttleParts.reduce((total, part) => total + (part.type === 'fuel' ? 1.8 : part.type === 'engine' ? 1.4 : 1), 0);
  const fuel = shuttleParts.filter((part) => part.type === 'fuel').length;
  const engines = shuttleParts.filter((part) => part.type === 'engine').length;
  const boosters = shuttleParts.filter((part) => part.type === 'booster').length;
  const thrust = engines * 4.1 + boosters * 2.2;
  const stability = shuttleParts.filter((part) => part.type === 'nose' || part.type === 'window').length + Math.min(3, boosters);
  return { mass, fuel, engines, boosters, thrust, stability };
}

function spawnParticle(position: THREE.Vector3, color: number, size: number, velocity: THREE.Vector3, life: number) {
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(size, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })
  );
  particle.position.copy(position);
  particle.userData.velocity = velocity;
  particle.userData.life = life;
  particle.userData.maxLife = life;
  particles.push(particle);
  scene.add(particle);
}

function spawnExhaust() {
  const base = shuttle.localToWorld(new THREE.Vector3(0, -0.85, 0));
  for (let i = 0; i < 4; i++) {
    spawnParticle(
      base.clone().add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.45), 0, THREE.MathUtils.randFloatSpread(0.45))),
      Math.random() > 0.45 ? 0xfff1a8 : 0xff7a1a,
      THREE.MathUtils.randFloat(0.06, 0.16),
      new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.6), THREE.MathUtils.randFloat(-2.5, -0.7), THREE.MathUtils.randFloatSpread(0.6)),
      THREE.MathUtils.randFloat(0.35, 0.75)
    );
  }
}

function spawnDust(center: THREE.Vector3) {
  for (let i = 0; i < 38; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = THREE.MathUtils.randFloat(0.9, 3.2);
    spawnParticle(
      center.clone().add(new THREE.Vector3(Math.cos(angle) * 0.4, 0.08, Math.sin(angle) * 0.4)),
      0xc2b280,
      THREE.MathUtils.randFloat(0.07, 0.2),
      new THREE.Vector3(Math.cos(angle) * speed, THREE.MathUtils.randFloat(0.15, 0.75), Math.sin(angle) * speed),
      THREE.MathUtils.randFloat(0.55, 1.2)
    );
  }
}

function launch() {
  if (state.launched) return;
  if (!hasPart('engine') || !hasPart('fuel') || shuttleParts.length < 4) {
    showToast('Add hull blocks, fuel, and an engine before launch.');
    return;
  }
  const select = document.querySelector<HTMLSelectElement>('#planetSelect')!;
  const destination = planets.find((planet) => planet.name === select.value) ?? planets[2];
  const stats = getShuttleStats();
  const requiredThrust = stats.mass * destination.gravity * 0.62 + 1.8;
  const requiredFuel = destination.gravity > 1 ? 2 : 1;
  if (stats.thrust < requiredThrust) {
    showToast('Not enough thrust for that planet. Add engines or boosters.');
    return;
  }
  if (stats.fuel < requiredFuel) {
    showToast('Not enough fuel for that destination. Add another fuel tank.');
    return;
  }
  if (stats.stability < 2) {
    showToast('Shuttle is unstable. Add a nose cone, window, or boosters.');
    return;
  }
  state.launched = true;
  setMode(true);
  state.flightTime = 0;
  state.currentPlanet = destination;
  state.oxygen = 100;
  document.querySelector('#launchButton')!.textContent = 'Flying';
  showToast(`Launch sequence started for ${destination.name}.`);
}

function landOnPlanet() {
  state.launched = false;
  shuttle.position.set(0, 0, 0);
  shuttle.rotation.set(0, 0, 0);
  engineGlow.intensity = 0;
  (enginePlume.material as THREE.MeshBasicMaterial).opacity = 0;
  spawnDust(new THREE.Vector3(0, 0.1, 0));
  state.money += state.currentPlanet.reward + (state.vipOnBoard ? 150 : 0);
  state.vipOnBoard = false;
  groundMaterial.color.setHex(state.currentPlanet.color);
  (atmosphere.material as THREE.MeshBasicMaterial).color.setHex(state.currentPlanet.atmosphere);
  document.querySelector('#launchButton')!.textContent = 'Launch';
  astronaut.position.set(-4, 0.1, 3.5);
  state.verticalVelocity = 0;
  state.onGround = true;
  state.lookYaw = 0;
  state.lookPitch = -0.08;
  populatePlanet();
  updateHud();
  showToast(`Landed on ${state.currentPlanet.name}. Oxygen tank equipped.`);
}

function inviteVip() {
  if (state.vipOnBoard) {
    showToast('VIP is already on board.');
    return;
  }
  if (shuttleParts.length < 3 || !hasPart('window')) {
    showToast('VIP needs at least 3 parts and a window.');
    return;
  }
  state.vipOnBoard = true;
  state.money += 90;
  updateHud();
  showToast('VIP passenger boarded. Mission bonus armed.');
}

function setMode(build: boolean) {
  state.buildMode = build;
  document.body.classList.toggle('astronaut-mode', !build);
  document.querySelector('#buildMode')!.classList.toggle('active', build);
  document.querySelector('#flyMode')!.classList.toggle('active', !build);
  document.querySelector('.crosshair')!.classList.toggle('visible', !build);
  astronaut.visible = build;
  firstPersonRig.visible = !build;
  if (preview) preview.visible = build && !state.launched;
}

function setHelpVisible(visible: boolean) {
  const overlay = document.querySelector<HTMLElement>('#helpOverlay')!;
  overlay.classList.toggle('visible', visible);
  overlay.setAttribute('aria-hidden', String(!visible));
}

function getPlanetGravity() {
  return 9.8 * state.currentPlanet.gravity;
}

function jumpAstronaut() {
  if (state.buildMode || state.launched || !state.onGround) return;
  const lowGravityBoost = THREE.MathUtils.clamp(1 / Math.sqrt(Math.max(state.currentPlanet.gravity, 0.18)), 0.75, 2.1);
  state.verticalVelocity = 4.25 * lowGravityBoost;
  state.onGround = false;
}

function findAxeTarget<T extends THREE.Group>(targets: T[], reach: number) {
  const origin = astronaut.position.clone().add(new THREE.Vector3(0, 0.85, 0));
  const { forward } = getWalkVectors();
  return targets
    .map((target) => {
      const targetPoint = target.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      const toTarget = targetPoint.sub(origin);
      const distance = toTarget.length();
      const aim = distance > 0 ? toTarget.normalize().dot(forward) : 0;
      return { target, distance, aim };
    })
    .filter((hit) => hit.distance <= reach && hit.aim > 0.62)
    .sort((a, b) => b.aim - a.aim || a.distance - b.distance)[0]?.target;
}

function useAxe() {
  if (state.buildMode || state.launched || state.axeCooldown > 0) return;
  state.axeCooldown = 0.45;
  state.axeSwing = 1;

  const tree = state.currentPlanet.name === 'Earth' ? findAxeTarget(trees, 2.25) : undefined;
  if (tree) {
    tree.userData.health -= 1;
    tree.rotation.z += 0.08;
    tree.scale.multiplyScalar(0.94);
    if (tree.userData.health <= 0) {
      world.remove(tree);
      trees.splice(trees.indexOf(tree), 1);
      state.wood += 8;
      state.money += 24;
      showToast('Tree chopped. Wood sold for shuttle parts.');
    }
    updateHud();
    return;
  }

  const alien = findAxeTarget(aliens, 1.9);
  if (alien) {
    alien.userData.health -= 1;
    alien.position.add(getWalkVectors().forward.multiplyScalar(0.28));
    alien.scale.multiplyScalar(0.92);
    if (alien.userData.health <= 0) {
      world.remove(alien);
      aliens.splice(aliens.indexOf(alien), 1);
      state.money += 55;
      showToast('Alien driven away. Research bonus earned.');
      updateHud();
    }
    return;
  }

  showToast('Move closer to a tree or alien to use the axe.');
}

function getWalkVectors() {
  const yawRotation = new THREE.Euler(0, state.lookYaw, 0, 'YXZ');
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(yawRotation);
  const right = new THREE.Vector3(1, 0, 0).applyEuler(yawRotation);
  forward.y = 0;
  right.y = 0;
  forward.normalize();
  right.normalize();
  return { forward, right };
}

function updateAstronaut(delta: number) {
  if (state.buildMode) return;
  state.axeCooldown = Math.max(0, state.axeCooldown - delta);
  state.axeSwing = Math.max(0, state.axeSwing - delta * 3.8);
  const gravity = getPlanetGravity();
  const walkRate = state.onGround ? 4.2 : 2.6;
  const speed = (walkRate / Math.max(0.45, state.currentPlanet.gravity)) * delta;
  const lookSpeed = 1.8 * delta;
  if (keys.has('ArrowLeft')) state.lookYaw += lookSpeed;
  if (keys.has('ArrowRight')) state.lookYaw -= lookSpeed;
  if (keys.has('ArrowUp')) state.lookPitch = THREE.MathUtils.clamp(state.lookPitch + lookSpeed * 0.7, -0.78, 0.55);
  if (keys.has('ArrowDown')) state.lookPitch = THREE.MathUtils.clamp(state.lookPitch - lookSpeed * 0.7, -0.78, 0.55);

  const move = new THREE.Vector3();
  const { forward, right } = getWalkVectors();
  if (keys.has('KeyW')) move.add(forward);
  if (keys.has('KeyS')) move.sub(forward);
  if (keys.has('KeyA')) move.sub(right);
  if (keys.has('KeyD')) move.add(right);
  if (move.lengthSq()) {
    move.normalize().multiplyScalar(speed);
    astronaut.position.add(move);
  }

  state.verticalVelocity -= gravity * delta;
  astronaut.position.y += state.verticalVelocity * delta;
  if (astronaut.position.y <= 0.1) {
    astronaut.position.y = 0.1;
    state.verticalVelocity = 0;
    state.onGround = true;
  } else {
    state.onGround = false;
  }

  astronaut.rotation.y = state.lookYaw;
  astronaut.position.x = THREE.MathUtils.clamp(astronaut.position.x, -buildLimit, buildLimit);
  astronaut.position.z = THREE.MathUtils.clamp(astronaut.position.z, -buildLimit, buildLimit);
  if (state.currentPlanet.name !== 'Earth') {
    state.oxygen = Math.max(0, state.oxygen - delta * 1.8);
    if (state.oxygen <= 0) {
      state.currentPlanet = planets[0];
      groundMaterial.color.setHex(state.currentPlanet.color);
      (atmosphere.material as THREE.MeshBasicMaterial).color.setHex(state.currentPlanet.atmosphere);
      populatePlanet();
      state.oxygen = 100;
      astronaut.position.set(-5.5, 0.1, 4.5);
      state.verticalVelocity = 0;
      state.onGround = true;
      state.lookYaw = 0;
      state.lookPitch = -0.08;
      showToast('Oxygen depleted. Emergency return to Earth.');
    }
  }
}

function updateAliens(delta: number) {
  for (const alien of aliens) {
    const toPlayer = astronaut.position.clone().sub(alien.position);
    if (toPlayer.length() < 12) {
      alien.position.add(toPlayer.normalize().multiplyScalar(delta * 1.1));
      alien.lookAt(astronaut.position.x, alien.position.y, astronaut.position.z);
    }
    alien.position.y = Math.sin(clock.elapsedTime * 3 + alien.position.x) * 0.08;
  }
}

function updateFlight(delta: number) {
  if (!state.launched) return;
  state.flightTime += delta;
  engineGlow.intensity = 4.5 + Math.sin(clock.elapsedTime * 24) * 1.2;
  enginePlume.scale.setScalar(1 + Math.sin(clock.elapsedTime * 18) * 0.08);
  (enginePlume.material as THREE.MeshBasicMaterial).opacity = 0.62;
  spawnExhaust();
  shuttle.position.y += delta * (2.5 + state.flightTime * 2);
  shuttle.rotation.y += delta * 0.7;
  shuttle.rotation.z = Math.sin(state.flightTime * 3.2) * 0.05;
  camera.position.lerp(new THREE.Vector3(8, shuttle.position.y + 5, 12), 0.03);
  if (state.flightTime > 4) landOnPlanet();
}

function updateParticles(delta: number) {
  for (const particle of [...particles]) {
    particle.userData.life -= delta;
    particle.position.addScaledVector(particle.userData.velocity, delta);
    particle.userData.velocity.y -= 1.6 * delta;
    const material = particle.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, particle.userData.life / particle.userData.maxLife) * 0.8;
    particle.scale.multiplyScalar(1 + delta * 1.2);
    if (particle.userData.life <= 0) {
      scene.remove(particle);
      particles.splice(particles.indexOf(particle), 1);
    }
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  stars.rotation.y += delta * 0.015;
  if (!state.launched) {
    if (state.buildMode) {
      camera.position.lerp(new THREE.Vector3(7, 6, 11), 0.06);
      camera.lookAt(new THREE.Vector3(0, 2.1, 0));
    } else {
      const moving = keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD');
      const stepBob = moving && state.onGround ? Math.sin(t * 10) * 0.035 : 0;
      const swing = Math.sin((1 - state.axeSwing) * Math.PI) * state.axeSwing;
      camera.position.copy(astronaut.position).add(new THREE.Vector3(0, 1.32 + stepBob, 0));
      camera.rotation.order = 'YXZ';
      camera.rotation.y = state.lookYaw;
      camera.rotation.x = state.lookPitch;
      camera.rotation.z = 0;
      firstPersonRig.rotation.z = -swing * 0.28;
      firstPersonRig.rotation.x = swing * 0.42;
    }
  }
  shuttleParts.forEach((part, index) => {
    if (part.type === 'booster' || part.type === 'engine') {
      part.mesh.scale.setScalar(1 + Math.sin(t * 5 + index) * 0.015);
    }
  });
  updateAstronaut(delta);
  updateAliens(delta);
  updateFlight(delta);
  updateParticles(delta);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function bindEvents() {
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'Escape') setHelpVisible(false);
    if (event.code === 'Space') {
      jumpAstronaut();
    }
    if (event.code === 'Backspace') {
      useAxe();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  canvas.addEventListener('pointermove', (event) => {
    if (!state.buildMode && !state.launched) {
      state.lookYaw -= event.movementX * 0.004;
      state.lookPitch = THREE.MathUtils.clamp(state.lookPitch - event.movementY * 0.003, -0.78, 0.55);
      return;
    }
    if (!preview || !state.buildMode || state.launched) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(pad)[0] ?? raycaster.intersectObject(ground)[0];
    if (hit) preview.position.copy(snapPosition(hit.point));
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (state.buildMode) placePart();
    else useAxe();
  });
  document.querySelector('#launchButton')!.addEventListener('click', launch);
  document.querySelector('#vipButton')!.addEventListener('click', inviteVip);
  document.querySelector('#undoButton')!.addEventListener('click', removeLastPart);
  document.querySelector('#clearButton')!.addEventListener('click', clearShuttle);
  document.querySelector('#buildMode')!.addEventListener('click', () => setMode(true));
  document.querySelector('#flyMode')!.addEventListener('click', () => setMode(false));
  document.querySelector('#helpButton')!.addEventListener('click', () => setHelpVisible(true));
  document.querySelector('#closeHelpButton')!.addEventListener('click', () => setHelpVisible(false));
  document.querySelector('#helpOverlay')!.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) setHelpVisible(false);
  });
}

function seedStarterShuttle() {
  const starter: Array<[PartType, number, number, number, string]> = [
    ['engine', 0, 0.7, 0, '#64748b'],
    ['fuel', 0, 1.7, 0, '#ef4444'],
    ['block', 0, 2.7, 0, '#f8fafc'],
    ['window', 0, 3.7, 0, '#2563eb'],
    ['nose', 0, 4.7, 0, '#f59e0b']
  ];
  for (const [type, x, y, z, color] of starter) {
    const mesh = createPartMesh(type, color);
    mesh.position.set(x, y, z);
    shuttleParts.push({ id: partId++, type, mesh, grid: mesh.position.clone() });
    shuttle.add(mesh);
  }
}

function init() {
  astronaut = makeAstronaut();
  firstPersonRig = makeFirstPersonRig();
  camera.add(firstPersonRig);
  world.add(astronaut);
  makeStars();
  seedStarterShuttle();
  renderPartButtons();
  renderPaintButtons();
  renderPlanetOptions();
  makePreview();
  populatePlanet();
  bindEvents();
  resize();
  updateHud();
  animate();
}

init();
