import * as THREE from "/vendor/three/three.module.js";
import { GLTFLoader } from "/vendor/three-examples/loaders/GLTFLoader.js";
import { OrbitControls } from "/vendor/three-examples/controls/OrbitControls.js";

const actionMeta = {
  search: { label: "Search", hint: "Inspect the wrecked caravan", glyph: "SC", color: 0xb89155 },
  track: { label: "Track", hint: "Follow the clawed trail", glyph: "TR", color: 0x829a66 },
  call: { label: "Call Out", hint: "Risk a voice in the dark", glyph: "VO", color: 0xd2a24c },
  attack: { label: "Attack", hint: "Strike the road stalker", glyph: "ATK", color: 0xa9473e },
  defend: { label: "Defend", hint: "Brace against the next hit", glyph: "DEF", color: 0x627b96 },
  skill: { label: "Class Skill", hint: "Use the party's signature move", glyph: "SKL", color: 0x7f5aa6 },
  potion: { label: "Potion", hint: "Recover HP", glyph: "HP", color: 0x7f9a5a },
  inspect: { label: "Inspect", hint: "Study the enemy", glyph: "EYE", color: 0xc89b52 },
};

const palette = {
  tableWood: 0x3b2618,
  tableEdge: 0x21150f,
  boardFelt: 0x2a3d35,
  boardInset: 0x352819,
  parchment: 0x9f8a61,
  brass: 0xbf8844,
  dirt: 0x806647,
  dirtDark: 0x4f3b2d,
  grass: 0x263d2c,
  grassLight: 0x4b6538,
  stone: 0x6c675c,
  leather: 0x5a3525,
  wagon: 0x805137,
};

const modelManifest = {
  orcEnemy: {
    url: "/assets/vendor/orc-enemy.glb",
    label: "Orc enemy miniature",
    source: "Poly Pizza / Quaternius",
  },
  cart: {
    url: "/assets/vendor/cart.glb",
    label: "Broken cart prop",
    source: "Poly Pizza / Quaternius",
  },
  crate: {
    url: "/assets/vendor/crate.glb",
    label: "Supply crate prop",
    source: "Poly Pizza / Quaternius",
  },
  rocks: {
    url: "/assets/vendor/rocks.glb",
    label: "Stone scatter prop",
    source: "Poly Pizza / Quaternius",
  },
};

const initialDpr = Math.min(window.devicePixelRatio || 1, 2);
const renderPerf = {
  initialDpr,
  currentDpr: initialDpr,
  frameAvg: 1 / 60,
  quality: "High",
  nextReviewAt: 0,
};
const scratch = {
  enemyGlowPosition: new THREE.Vector3(),
  enemyGlowOffset: new THREE.Vector3(0.2, 0.95, 0.1),
  fallbackEnemyPosition: new THREE.Vector3(2.9, 0.25, -0.6),
  pulsePosition: new THREE.Vector3(),
  rainMatrix: new THREE.Matrix4(),
  rainPosition: new THREE.Vector3(),
  rainQuaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, -0.18)),
  rainScale: new THREE.Vector3(1, 1, 1),
  labelPosition: new THREE.Vector3(),
  viewBox: new THREE.Box3(),
  viewCenter: new THREE.Vector3(),
  viewSize: new THREE.Vector3(),
  viewPosition: new THREE.Vector3(),
};

const localState = {
  current: null,
  lastNarrationKey: "",
  lastAction: "",
  lastPhase: "idle",
  availableActions: [],
  interactables: new Map(),
  hovered: null,
  pulses: [],
  floaters: [],
  player: loadPlayerSeat(),
  seated: true,
  orbitMode: true,
};

const canvas = document.querySelector("#tableCanvas");
const tableLabels = document.querySelector("#tableLabels");
const connectionStatus = document.querySelector("#connectionStatus");
const phaseBadge = document.querySelector("#phaseBadge");
const characterForm = document.querySelector("#characterForm");
const characterCard = document.querySelector("#characterCard");
const narrationLog = document.querySelector("#narrationLog");
const diceTray = document.querySelector("#diceTray");
const rollText = document.querySelector("#rollText");
const sceneTitle = document.querySelector("#sceneTitle");
const startSceneButton = document.querySelector("#startSceneButton");
const movePrompt = document.querySelector("#movePrompt");
const moveGrid = document.querySelector("#moveGrid");
const objectiveText = document.querySelector("#objectiveText");
const playerNameInput = document.querySelector("#playerName");
const leaveSeatButton = document.querySelector("#leaveSeat");
const sceneVitals = document.querySelector("#sceneVitals");
const clueRack = document.querySelector("#clueRack");
const choiceTable = document.querySelector("#choiceTable");
const hoverTooltip = document.querySelector("#hoverTooltip");
const collapseSetup = document.querySelector("#collapseSetup");
const orbitToggle = document.querySelector("#orbitToggle");
const viewPresetButtons = document.querySelectorAll("[data-view-preset]");
const focusToggle = document.querySelector("#focusToggle");
const voiceToggle = document.querySelector("#voiceToggle");
const voiceProfileButton = document.querySelector("#voiceProfile");
const voiceReplay = document.querySelector("#voiceReplay");
const musicToggle = document.querySelector("#musicToggle");
const renderStatus = document.querySelector("#renderStatus");
const directorCard = document.querySelector("#directorCard");
const directorEyebrow = document.querySelector("#directorEyebrow");
const directorTitle = document.querySelector("#directorTitle");
const directorBody = document.querySelector("#directorBody");

const audioState = {
  enabled: false,
  speaking: false,
  audioContext: null,
  audioElement: null,
  audioUrl: "",
  currentNarration: null,
  voices: [],
  voiceProfileIndex: 0,
  lastTtsProvider: "",
  musicEnabled: false,
  musicVolume: 0.18,
  music: null,
  musicElement: null,
  musicUrl: "",
  noteIndex: 0,
};

const voiceProfiles = [
  {
    label: "Gravel",
    match: /david|george|mark|daniel|guy|male|english/i,
    rate: 0.84,
    pitch: 0.58,
    volume: 1,
  },
  {
    label: "Oracle",
    match: /zira|susan|hazel|samantha|female|english/i,
    rate: 0.9,
    pitch: 0.78,
    volume: 0.98,
  },
  {
    label: "Battle",
    match: /david|mark|george|daniel|male|english/i,
    rate: 1.02,
    pitch: 0.64,
    volume: 1,
  },
];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(renderPerf.currentDpr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1010);
scene.fog = new THREE.FogExp2(0x0e1010, 0.028);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 18.5, 15.8);
camera.lookAt(0, 0.05, 0.1);
const cameraState = {
  targetPosition: camera.position.clone(),
  targetLookAt: new THREE.Vector3(0, 0.05, 0.1),
  currentLookAt: new THREE.Vector3(0, 0.05, 0.1),
};
const orbitControls = new OrbitControls(camera, canvas);
orbitControls.enabled = localState.orbitMode;
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.enablePan = true;
orbitControls.screenSpacePanning = false;
orbitControls.minDistance = 7.5;
orbitControls.maxDistance = 28;
orbitControls.minPolarAngle = 0.18;
orbitControls.maxPolarAngle = Math.PI * 0.48;
orbitControls.target.copy(cameraState.currentLookAt);
orbitControls.update();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastFrameTime = performance.now();
const gltfLoader = new GLTFLoader();
const assetState = {
  mixers: [],
  cache: new Map(),
  loaded: new Set(),
};
const fxState = {
  rain: null,
  rainOffsets: [],
  nextLightningAt: 4,
  lightningAge: 1,
  lightningLife: 0,
};

const groups = {
  board: new THREE.Group(),
  scene: new THREE.Group(),
  actions: new THREE.Group(),
  effects: new THREE.Group(),
  weather: new THREE.Group(),
  tokens: new THREE.Group(),
};

scene.add(groups.board, groups.scene, groups.actions, groups.effects, groups.weather, groups.tokens);

const tableObjects = createTabletopScene();
const minis = createMinis();
const dice = createDice();
scene.add(dice.group);
loadModelAssets();
const projectedLabels = createProjectedLabels();

startSceneButton.addEventListener("click", () => post("/api/quest/start"));
collapseSetup.addEventListener("click", () => document.body.classList.toggle("setup-collapsed"));
orbitToggle.addEventListener("click", () => setOrbitMode(!localState.orbitMode));
viewPresetButtons.forEach((button) => {
  button.addEventListener("click", () => setOrbitPreset(button.dataset.viewPreset || "fit"));
});
focusToggle.addEventListener("click", toggleFocusMode);
voiceToggle.addEventListener("click", toggleNarratorVoice);
voiceProfileButton.addEventListener("click", cycleVoiceProfile);
voiceReplay.addEventListener("click", () => speakCurrentNarration(true));
musicToggle.addEventListener("click", toggleMusic);
leaveSeatButton.addEventListener("click", toggleSeat);
playerNameInput.value = localState.player.name;
playerNameInput.addEventListener("change", () => {
  localState.player.name = playerNameInput.value.trim() || "Player";
  localState.seated = true;
  savePlayerSeat(localState.player);
  registerPlayer();
});
playerNameInput.addEventListener("blur", () => {
  localState.player.name = playerNameInput.value.trim() || "Player";
  playerNameInput.value = localState.player.name;
  localState.seated = true;
  savePlayerSeat(localState.player);
  registerPlayer();
});

characterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(characterForm);
  localState.lastNarrationKey = "";
  narrationLog.innerHTML = "";
  post("/api/character", {
    name: String(formData.get("name") || "The Party"),
    classKey: String(formData.get("classKey") || "warden"),
  });
});

canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerleave", () => setHover(null));
canvas.addEventListener("click", handleTableClick);
window.addEventListener("resize", resize);

loadSpeechVoices();
updateNarratorControls();
setOrbitMode(true);
setOrbitPreset("fit");
connectSocket();
loadState();
registerPlayer();
window.setInterval(registerPlayer, 20000);
window.addEventListener("pagehide", () => {
  if (localState.seated) leaveSeat(true);
});
resize();
animate();

async function loadState() {
  const response = await fetch("/api/state");
  render(await response.json());
}

function loadPlayerSeat() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem("realmbound.player") || "null");
  } catch {
    stored = null;
  }
  return {
    id: stored?.id || crypto.randomUUID(),
    name: stored?.name || `Player ${Math.floor(Math.random() * 90) + 10}`,
  };
}

function savePlayerSeat(player) {
  localStorage.setItem("realmbound.player", JSON.stringify(player));
}

async function registerPlayer() {
  if (!localState.seated) return;
  savePlayerSeat(localState.player);
  const response = await fetch("/api/players/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: localState.player.id, name: localState.player.name }),
  }).catch(() => undefined);

  if (!response?.ok) return;
  const payload = await response.json();
  if (payload.state) render(payload.state);
}

async function toggleSeat() {
  if (localState.seated) {
    await leaveSeat(false);
    return;
  }

  localState.seated = true;
  leaveSeatButton.textContent = "Stand";
  leaveSeatButton.classList.remove("is-spectating");
  await registerPlayer();
  if (localState.current) render(localState.current);
}

async function leaveSeat(useBeacon = false) {
  const payload = JSON.stringify({ playerId: localState.player.id });
  localState.seated = false;
  leaveSeatButton.textContent = "Sit";
  leaveSeatButton.classList.add("is-spectating");

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/players/leave", new Blob([payload], { type: "application/json" }));
    return;
  }

  const response = await fetch("/api/players/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  }).catch(() => undefined);

  if (!response?.ok) {
    if (localState.current) render(localState.current);
    return;
  }

  render(await response.json());
}

async function post(url, body = {}) {
  if (url === "/api/choice" && !localState.seated) {
    movePrompt.textContent = "Sit at the table before voting on the party move.";
    playCue("miss");
    return;
  }

  setBusy(true);
  if (typeof body.action === "string") {
    localState.lastAction = body.action;
    queueActionPulse(body.action);
    triggerActionAnimation(body.action);
    playActionCue(body.action);
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        playerId: localState.player.id,
        playerName: localState.player.name,
      }),
    });
    const nextState = await response.json();
    render(nextState);
    if (nextState.lastQuest?.rollSummary) {
      rollDice();
    }
  } finally {
    setBusy(false);
  }
}

function connectSocket() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${location.host}/ws`);

  socket.addEventListener("open", () => {
    connectionStatus.textContent = "Live";
    connectionStatus.classList.add("live");
  });

  socket.addEventListener("close", () => {
    connectionStatus.textContent = "Reconnecting";
    connectionStatus.classList.remove("live");
    setTimeout(connectSocket, 1500);
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "state") render(payload.state);
  });
}

function render(nextState) {
  localState.current = nextState;
  localState.availableActions = resolveAvailableActions(nextState);
  renderPartySummary(nextState.activeCharacter);
  renderDMLog(nextState);
  renderBoardState(nextState);
  renderSceneVitals(nextState);
  renderClueRack(nextState);
  renderChoiceTable(nextState);
  renderDirector(nextState);
  renderActionTray(nextState);
}

function createTabletopScene() {
  const tableMaterial = new THREE.MeshStandardMaterial({ color: palette.tableWood, roughness: 0.72, metalness: 0.04 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: palette.tableEdge, roughness: 0.78 });
  const brassMaterial = new THREE.MeshStandardMaterial({ color: palette.brass, roughness: 0.42, metalness: 0.35 });
  const feltMaterial = new THREE.MeshStandardMaterial({ color: palette.boardFelt, roughness: 0.92 });

  const table = new THREE.Mesh(new THREE.BoxGeometry(26, 0.82, 18.2), tableMaterial);
  table.position.y = -0.45;
  table.receiveShadow = true;
  table.castShadow = true;
  groups.board.add(table);
  addTableGrain();

  [
    { size: [18.9, 0.32, 0.34], position: [0, 0.24, -6.28] },
    { size: [18.9, 0.32, 0.34], position: [0, 0.24, 6.28] },
    { size: [0.34, 0.32, 12.2], position: [-9.34, 0.24, 0] },
    { size: [0.34, 0.32, 12.2], position: [9.34, 0.24, 0] },
  ].forEach(({ size, position }) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(...size), railMaterial);
    rail.position.set(...position);
    rail.castShadow = true;
    rail.receiveShadow = true;
    groups.board.add(rail);
  });

  [-1, 1].forEach((x) => {
    [-1, 1].forEach((z) => {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.72), brassMaterial);
      cap.position.set(x * 9.34, 0.52, z * 6.28);
      cap.castShadow = true;
      groups.board.add(cap);
    });
  });

  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(18.6, 0.28, 11.9),
    new THREE.MeshStandardMaterial({ color: palette.leather, roughness: 0.8 })
  );
  tray.position.y = 0.05;
  tray.castShadow = true;
  tray.receiveShadow = true;
  groups.board.add(tray);

  const felt = new THREE.Mesh(new THREE.BoxGeometry(17.7, 0.16, 10.95), feltMaterial);
  felt.position.y = 0.24;
  felt.receiveShadow = true;
  felt.castShadow = true;
  groups.board.add(felt);

  const inset = new THREE.Mesh(
    new THREE.BoxGeometry(16.75, 0.08, 10.05),
    new THREE.MeshStandardMaterial({ color: palette.parchment, roughness: 0.88 })
  );
  inset.position.y = 0.36;
  inset.receiveShadow = true;
  inset.castShadow = true;
  groups.board.add(inset);

  const grid = new THREE.GridHelper(15.8, 10, 0x4b3b28, 0x6d5a3b);
  grid.position.y = 0.43;
  grid.material.opacity = 0.13;
  grid.material.transparent = true;
  groups.board.add(grid);

  const road = createRoad();
  groups.scene.add(road);
  createRoadDetails();

  const wagon = createWagon();
  wagon.position.set(-3.2, 0.67, -0.4);
  wagon.rotation.y = -0.42;
  groups.scene.add(wagon);
  const wagonShadow = createContactShadow(2.2, 1.25, 0.38);
  wagonShadow.position.set(-3.2, 0.452, -0.4);
  wagonShadow.rotation.z = -0.45;
  groups.scene.add(wagonShadow);

  [
    [-7.4, -4.8, 0.88], [-6.2, -2.2, 0.72], [-7.7, 1.1, 1.08], [-5.9, 4.2, 0.82],
    [6.5, -4.2, 0.94], [7.8, -1.7, 0.76], [5.9, 1.8, 1.12], [7.2, 4.6, 0.86],
    [-4.8, -5.2, 0.58], [4.9, 5.1, 0.62],
  ].forEach(([x, z, scale]) => {
    const tree = createTree(scale);
    tree.position.set(x, 0.48, z);
    groups.scene.add(tree);
  });

  for (let index = 0; index < 38; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const clump = createGrassClump(0.6 + ((index * 17) % 9) / 20);
    clump.position.set(side * (2.35 + ((index * 11) % 18) / 10), 0.47, -5.1 + ((index * 23) % 104) / 10);
    clump.rotation.y = index * 0.41;
    groups.scene.add(clump);
  }

  const lantern = createLantern();
  lantern.position.set(-2.1, 0.53, -1.45);
  groups.scene.add(lantern);

  const warmKey = new THREE.PointLight(0xd79645, 3.2, 10.5, 1.7);
  warmKey.position.set(-2.3, 2.6, -1.4);
  warmKey.castShadow = true;
  warmKey.shadow.mapSize.set(1024, 1024);
  scene.add(warmKey);

  const enemyGlow = new THREE.PointLight(0x9a2f36, 0.7, 4.8, 2);
  enemyGlow.position.set(2.6, 1.1, -0.4);
  scene.add(enemyGlow);

  const moon = new THREE.DirectionalLight(0x9cb5c9, 1.05);
  moon.position.set(5.2, 13.5, 6.4);
  moon.castShadow = true;
  moon.shadow.camera.left = -10;
  moon.shadow.camera.right = 10;
  moon.shadow.camera.top = 8;
  moon.shadow.camera.bottom = -8;
  moon.shadow.mapSize.set(2048, 2048);
  scene.add(moon);

  scene.add(new THREE.HemisphereLight(0x8398a5, 0x2a1a11, 1.05));
  const stormFlash = new THREE.PointLight(0xcfe8ff, 0, 28, 1.25);
  stormFlash.position.set(-4.5, 9.5, -5.2);
  scene.add(stormFlash);
  createRainLayer();

  return { table, felt, road, wagon, enemyGlow, stormFlash };
}

function createRainLayer() {
  const rainGeometry = new THREE.BoxGeometry(0.018, 0.72, 0.018);
  const rainMaterial = new THREE.MeshBasicMaterial({
    color: 0x9bb3bd,
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
  });
  const rain = new THREE.InstancedMesh(rainGeometry, rainMaterial, 96);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Euler(0.18, 0, -0.18);
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const scale = new THREE.Vector3(1, 1, 1);

  for (let index = 0; index < rain.count; index += 1) {
    const position = new THREE.Vector3(
      -8.1 + ((index * 37) % 162) / 10,
      2.2 + ((index * 17) % 48) / 10,
      -5.4 + ((index * 29) % 108) / 10
    );
    matrix.compose(position, quaternion, scale);
    rain.setMatrixAt(index, matrix);
    fxState.rainOffsets.push({ x: position.x, y: position.y, z: position.z, speed: 1.8 + ((index * 13) % 18) / 10 });
  }

  rain.instanceMatrix.needsUpdate = true;
  groups.weather.add(rain);
  fxState.rain = rain;
}

function addTableGrain() {
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x1c120d, transparent: true, opacity: 0.42 });
  for (let index = -5; index <= 5; index += 1) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 17.3), seamMaterial);
    seam.position.set(index * 2.28, -0.025, 0);
    groups.board.add(seam);
  }

  const grainMaterial = new THREE.MeshBasicMaterial({ color: 0x6a4328, transparent: true, opacity: 0.18 });
  for (let index = 0; index < 42; index += 1) {
    const length = 2.4 + ((index * 19) % 42) / 10;
    const grain = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, length), grainMaterial);
    grain.position.set(-11.6 + ((index * 29) % 232) / 10, -0.015, -8.1 + ((index * 13) % 162) / 10);
    grain.rotation.y = 0.06 + ((index % 5) - 2) * 0.025;
    groups.board.add(grain);
  }
}

function createContactShadow(radiusX, radiusZ, opacity = 0.32) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 36),
    new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(radiusX, radiusZ, 1);
  shadow.position.y = 0.445;
  return shadow;
}

function createRoad() {
  const roadPoints = [
    [-1.45, -5.55], [1.22, -5.35], [1.55, -3.85], [1.2, -2.2], [1.65, -0.85],
    [1.28, 0.75], [1.54, 2.15], [1.12, 3.9], [1.34, 5.6], [-1.44, 5.48],
    [-1.12, 3.85], [-1.58, 2.1], [-1.24, 0.65], [-1.72, -0.8], [-1.28, -2.45], [-1.62, -4.2],
  ];
  const road = createFlatShape(roadPoints, 0.47, new THREE.MeshStandardMaterial({
    color: palette.dirt,
    roughness: 0.98,
    metalness: 0,
  }));
  road.rotation.y = -0.1;
  road.receiveShadow = true;
  return road;
}

function createRoadDetails() {
  const ditchMaterial = new THREE.MeshStandardMaterial({ color: palette.grass, roughness: 0.98 });
  const leftDitch = createFlatShape([[-4.35, -5.4], [-1.7, -5.5], [-1.55, 5.3], [-4.7, 5.55], [-5.1, 1.9], [-4.8, -2.7]], 0.455, ditchMaterial);
  const rightDitch = createFlatShape([[1.65, -5.45], [4.6, -5.25], [5.05, -1.6], [4.75, 3.8], [4.35, 5.45], [1.45, 5.25]], 0.455, ditchMaterial);
  leftDitch.rotation.y = rightDitch.rotation.y = -0.1;
  groups.scene.add(leftDitch, rightDitch);

  [
    [-0.72, -4.7, 0.08, 1.6], [0.62, -4.4, 0.08, 1.5], [-0.58, -1.8, 0.07, 1.2],
    [0.78, -1.1, 0.07, 1.1], [-0.68, 1.35, 0.08, 1.45], [0.54, 2.35, 0.07, 1.28],
  ].forEach(([x, z, width, length]) => {
    const rut = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.025, length),
      new THREE.MeshStandardMaterial({ color: palette.dirtDark, roughness: 1 })
    );
    rut.position.set(x, 0.498, z);
    rut.rotation.y = -0.18;
    rut.receiveShadow = true;
    groups.scene.add(rut);
  });

  [
    [1.7, -0.85, 0.45], [2.04, -0.65, 0.35], [2.36, -0.42, 0.5],
    [-0.1, 1.55, -0.25], [0.22, 1.82, -0.18], [0.48, 2.08, -0.3],
  ].forEach(([x, z, rot]) => {
    const claw = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.018, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x2b1c16, roughness: 1 })
    );
    claw.position.set(x, 0.525, z);
    claw.rotation.y = rot;
    groups.scene.add(claw);
  });

  [
    [1.95, -0.08, 0.26, 0x3b1212], [-2.1, -1.72, 0.2, 0x1c1812], [0.88, 3.18, 0.18, 0x2b1a12],
  ].forEach(([x, z, radius, color]) => {
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 22),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.52 })
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(x, 0.532, z);
    groups.scene.add(stain);
  });

  [
    [-3.9, -3.6, 0.28], [-2.7, 2.2, 0.22], [3.7, -2.9, 0.35], [4.3, 2.9, 0.26],
    [-0.9, -5.0, 0.18], [1.2, 4.6, 0.2], [2.8, 0.9, 0.16],
  ].forEach(([x, z, scale], index) => {
    const rock = createRock(scale);
    rock.position.set(x, 0.55, z);
    rock.rotation.set(index * 0.2, index * 0.7, index * 0.13);
    groups.scene.add(rock);
  });

  const token = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.055, 24),
    new THREE.MeshStandardMaterial({ color: 0x151311, roughness: 0.36, metalness: 0.5 })
  );
  token.position.set(-0.55, 0.55, -0.95);
  token.rotation.x = Math.PI / 2;
  token.castShadow = true;
  groups.scene.add(token);

  [
    [-4.4, 0.6, 1.3, 0.16], [-3.7, 1.1, 0.9, -0.6], [-2.4, -1.55, 1.1, 0.4],
    [-4.7, -0.95, 0.76, 1.1], [-2.8, -2.3, 0.82, -0.9],
  ].forEach(([x, z, length, rot]) => {
    const plank = createPlank(length);
    plank.position.set(x, 0.61, z);
    plank.rotation.y = rot;
    groups.scene.add(plank);
  });

  [
    [-3.7, -1.1, 0.38, 0.18], [-2.85, 0.92, 0.32, -0.3], [-4.15, -0.35, 0.28, 0.5],
  ].forEach(([x, z, scale, rot]) => {
    const sack = createSack(scale);
    sack.position.set(x, 0.58, z);
    sack.rotation.y = rot;
    groups.scene.add(sack);
  });

  [
    [-0.45, -2.6, 0.28], [0.2, -2.95, 0.18], [0.82, -2.38, 0.24], [0.45, 3.35, 0.2],
  ].forEach(([x, z, radius], index) => {
    const puddle = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.92, 0.018, 28),
      new THREE.MeshStandardMaterial({ color: 0x1d2a2b, roughness: 0.18, metalness: 0.15 })
    );
    puddle.position.set(x, 0.505, z);
    puddle.rotation.y = index * 0.45;
    groups.scene.add(puddle);
  });
}

function createFlatShape(points, y, material) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.035, bevelThickness: 0.02 }),
    material
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function createRock(scale) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: palette.stone, roughness: 0.92 })
  );
  rock.scale.set(scale * 1.1, scale * 0.55, scale * 0.8);
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

function createPlank(length) {
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.12, length),
    new THREE.MeshStandardMaterial({ color: palette.wagon, roughness: 0.86 })
  );
  plank.castShadow = true;
  plank.receiveShadow = true;
  return plank;
}

function createSack(scale) {
  const sack = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x6b5438, roughness: 0.95 })
  );
  sack.scale.set(scale * 0.9, scale * 0.48, scale * 0.62);
  sack.castShadow = true;
  sack.receiveShadow = true;
  return sack;
}

function createGrassClump(scale) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: palette.grassLight, roughness: 0.95 });
  for (let index = 0; index < 4; index += 1) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.42 + index * 0.04, 5), material);
    blade.position.set((index - 1.5) * 0.08 * scale, 0.15, (index % 2) * 0.08 * scale);
    blade.rotation.z = (index - 1.5) * 0.18;
    blade.scale.setScalar(scale);
    blade.castShadow = true;
    group.add(blade);
  }
  return group;
}

function createLantern() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x161412, roughness: 0.5, metalness: 0.65 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffc15e, roughness: 0.18, emissive: 0xd17f2e, emissiveIntensity: 0.75 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.1, 10), metal);
  post.position.y = 0.55;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.28), glass);
  lamp.position.y = 1.15;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 18), metal);
  hook.position.y = 1.42;
  hook.rotation.x = Math.PI / 2;
  group.add(post, lamp, hook);
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return group;
}

function createWagon() {
  const wagon = new THREE.Group();
  const woodMaterial = new THREE.MeshStandardMaterial({ color: palette.wagon, roughness: 0.86 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2318, roughness: 0.9 });
  const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x161311, roughness: 0.5, metalness: 0.5 });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.55, 1.35),
    woodMaterial
  );
  body.rotation.z = -0.08;
  body.castShadow = true;
  wagon.add(body);

  [-0.65, 0, 0.65].forEach((z) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.1, 0.18), darkWood);
    plank.position.set(0, 0.34, z);
    plank.rotation.z = -0.08;
    plank.castShadow = true;
    wagon.add(plank);
  });

  [-1, 1].forEach((x, sideIndex) => {
    [-0.78, 0.78].forEach((z, wheelIndex) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 20), ironMaterial);
      wheel.position.set(x, -0.25 + (sideIndex === 0 && wheelIndex === 0 ? -0.12 : 0), z);
      wheel.rotation.z = Math.PI / 2;
      wheel.rotation.y = sideIndex === 0 && wheelIndex === 0 ? 0.72 : 0;
      wheel.castShadow = true;
      wagon.add(wheel);
    });
  });

  const snappedAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), darkWood);
  snappedAxle.position.set(0.24, -0.28, 0);
  snappedAxle.rotation.z = Math.PI / 2;
  snappedAxle.rotation.y = 0.16;
  snappedAxle.castShadow = true;
  wagon.add(snappedAxle);

  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.44, 0.5), darkWood);
  crate.position.set(-0.62, 0.56, 0.16);
  crate.rotation.set(0.12, 0.35, 0.08);
  crate.castShadow = true;
  wagon.add(crate);

  return wagon;
}

function createTree(scale) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.15, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x392516, roughness: 0.92 })
  );
  trunk.position.y = 0.35 * scale;
  trunk.scale.setScalar(scale);
  trunk.castShadow = true;
  tree.add(trunk);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x18342d, roughness: 0.96 });
  [0, 0.34].forEach((offset, index) => {
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.58 - index * 0.12, 1.25, 8), leafMaterial);
    leaves.position.y = (0.95 + offset) * scale;
    leaves.scale.setScalar(scale);
    leaves.castShadow = true;
    tree.add(leaves);
  });

  return tree;
}

function createMinis() {
  const party = createHeroMini(0x5878b9);
  party.group.position.set(0.4, 0.52, 3.7);
  groups.tokens.add(party.group);

  const enemy = createRoadStalkerMini();
  enemy.group.position.set(2.9, 0.52, -0.6);
  groups.tokens.add(enemy.group);

  return { party, enemy };
}

function createHeroMini(color) {
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.46, metalness: 0.18 });
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.44, metalness: 0.05 });
  const leatherMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2a1f, roughness: 0.72 });
  const steelMaterial = new THREE.MeshStandardMaterial({ color: 0xa8a39a, roughness: 0.28, metalness: 0.55 });
  const clothMaterial = new THREE.MeshStandardMaterial({ color: 0x28384a, roughness: 0.86 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.16, 42), baseMaterial);
  base.position.y = 0.08;
  group.add(base);

  const boots = [
    createLimb(new THREE.Vector3(-0.15, 0.34, 0), new THREE.Vector3(0.1, 0.45, 0.12), leatherMaterial, 0.08),
    createLimb(new THREE.Vector3(0.17, 0.34, 0.05), new THREE.Vector3(0.1, 0.45, 0.12), leatherMaterial, -0.05),
  ];
  boots.forEach((part) => group.add(part));

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.28), bodyMaterial);
  body.position.y = 0.8;
  body.rotation.z = -0.05;
  group.add(body);

  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.85, 5, 1, true), clothMaterial);
  cloak.position.set(-0.03, 0.72, 0.19);
  cloak.rotation.y = Math.PI / 5;
  cloak.scale.set(0.9, 1, 0.42);
  group.add(cloak);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), new THREE.MeshStandardMaterial({ color: 0xc59a72, roughness: 0.62 }));
  head.position.y = 1.29;
  group.add(head);

  const helm = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.24, 8), steelMaterial);
  helm.position.y = 1.46;
  group.add(helm);

  const leftArm = createLimb(new THREE.Vector3(-0.36, 0.89, 0.01), new THREE.Vector3(0.08, 0.48, 0.08), bodyMaterial, 0.52);
  const rightArm = createLimb(new THREE.Vector3(0.36, 0.9, 0.01), new THREE.Vector3(0.08, 0.52, 0.08), bodyMaterial, -0.45);
  group.add(leftArm, rightArm);

  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.075, 6), steelMaterial);
  shield.position.set(-0.52, 0.82, -0.05);
  shield.rotation.set(Math.PI / 2, 0.22, 0.18);
  group.add(shield);

  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.82, 0.025), steelMaterial);
  blade.position.y = 0.34;
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.04), new THREE.MeshStandardMaterial({ color: palette.brass, roughness: 0.38, metalness: 0.4 }));
  sword.add(blade, hilt);
  sword.position.set(0.55, 0.88, 0.02);
  sword.rotation.z = -0.68;
  group.add(sword);

  const ring = new THREE.Mesh(
    new THREE.BoxGeometry(1.38, 0.028, 0.96),
    new THREE.MeshBasicMaterial({ color: 0x81a5d6, transparent: true, opacity: 0.28, depthWrite: false })
  );
  ring.rotation.y = 0.18;
  ring.position.y = 0.018;
  group.add(ring);

  const shadow = createContactShadow(0.72, 0.58, 0.32);
  shadow.position.y = 0.01;
  group.add(shadow);

  const statusBar = createMiniStatusBar(0.95);
  statusBar.group.position.set(0, 1.72, -0.58);

  const label = "Party miniature: armored hero with shield and blade";
  group.traverse((mesh) => {
    if (!mesh.isMesh || mesh === shadow) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = "party";
    mesh.userData.label = label;
  });
  group.userData.kind = "party";
  group.userData.label = label;
  return { group, base, body, ring, shadow, statusBar, pickables: [base, body] };
}

function createRoadStalkerMini() {
  const group = new THREE.Group();
  const hideMaterial = new THREE.MeshStandardMaterial({ color: 0x7c2f2f, roughness: 0.7, metalness: 0.03 });
  const darkHide = new THREE.MeshStandardMaterial({ color: 0x2a1112, roughness: 0.82 });
  const clawMaterial = new THREE.MeshStandardMaterial({ color: 0xd0b36b, roughness: 0.42, metalness: 0.12 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.16, 42), new THREE.MeshStandardMaterial({ color: 0x211010, roughness: 0.5, metalness: 0.18 }));
  base.position.y = 0.08;
  group.add(base);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.43, 22, 16), hideMaterial);
  body.position.set(0, 0.72, 0);
  body.scale.set(1.35, 0.68, 0.78);
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), darkHide);
  chest.position.set(-0.42, 0.77, 0.02);
  chest.scale.set(0.95, 0.68, 0.72);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 7), hideMaterial);
  head.position.set(-0.83, 0.84, 0.02);
  head.rotation.z = Math.PI / 2;
  group.add(head);

  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 5), clawMaterial);
  jaw.position.set(-1.12, 0.79, 0.02);
  jaw.rotation.z = Math.PI / 2;
  group.add(jaw);

  [-1, 1].forEach((side) => {
    for (let index = 0; index < 3; index += 1) {
      const x = -0.35 + index * 0.38;
      const upper = createLimb(new THREE.Vector3(x, 0.55, side * 0.38), new THREE.Vector3(0.065, 0.55, 0.065), darkHide, side * (0.8 - index * 0.16));
      upper.rotation.x = side * 0.72;
      upper.rotation.z = 1.05 - index * 0.12;
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), clawMaterial);
      claw.position.set(x + 0.16, 0.28, side * (0.78 + index * 0.08));
      claw.rotation.x = side * Math.PI / 2;
      group.add(upper, claw);
    }
  });

  for (let index = 0; index < 5; index += 1) {
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.32, 5), clawMaterial);
    spine.position.set(-0.42 + index * 0.22, 1.04 + Math.sin(index) * 0.04, 0);
    spine.rotation.x = Math.PI;
    group.add(spine);
  }

  const tail = createLimb(new THREE.Vector3(0.76, 0.72, -0.02), new THREE.Vector3(0.08, 0.86, 0.08), darkHide, -0.9);
  tail.rotation.z = 1.2;
  group.add(tail);

  const ring = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.03, 1.18),
    new THREE.MeshBasicMaterial({ color: 0xc74949, transparent: true, opacity: 0.24, depthWrite: false })
  );
  ring.rotation.y = -0.22;
  ring.position.y = 0.018;
  group.add(ring);

  const shadow = createContactShadow(0.98, 0.72, 0.38);
  shadow.position.y = 0.01;
  group.add(shadow);

  const statusBar = createMiniStatusBar(1.1);
  statusBar.group.position.set(0, 1.86, -0.7);

  const label = "Road Stalker: many-limbed ambusher miniature";
  group.traverse((mesh) => {
    if (!mesh.isMesh || mesh === shadow) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = "enemy";
    mesh.userData.label = label;
  });
  group.userData.kind = "enemy";
  group.userData.label = label;
  return { group, base, body, ring, shadow, statusBar, pickables: [base, body] };
}

function createMiniStatusBar(width) {
  const group = new THREE.Group();
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.045, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x0b0c0b, transparent: true, opacity: 0.72 })
  );
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.055, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x8fb36b })
  );
  fill.position.y = 0.004;
  group.add(backing, fill);
  group.visible = false;
  return { group, fill, width };
}

function createLimb(position, scale, material, tilt) {
  const limb = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 6, 10), material);
  limb.position.copy(position);
  limb.scale.copy(scale);
  limb.rotation.z = tilt;
  return limb;
}

function createDice() {
  const group = new THREE.Group();
  const die = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.82, 0.82),
    createDiceMaterials(20)
  );
  die.castShadow = true;
  die.receiveShadow = true;
  group.add(die);
  const shadow = createContactShadow(0.6, 0.48, 0.24);
  shadow.position.y = -0.38;
  group.add(shadow);
  group.position.set(-6.3, 0.92, 4.9);
  scene.add(group);
  return { group, die, rollingUntil: 0, value: 20 };
}

function createDiceMaterials(value) {
  const faces = [
    value,
    Math.max(1, value - 1),
    Math.max(1, value - 2),
    Math.max(1, value - 3),
    Math.max(1, value - 4),
    Math.max(1, value - 5),
  ];

  return faces.map((face, index) => new THREE.MeshStandardMaterial({
    map: createDiceFaceTexture(face, index === 0),
    roughness: 0.34,
    metalness: 0.08,
    emissive: index === 0 ? 0x4d171a : 0x24090b,
    emissiveIntensity: index === 0 ? 0.18 : 0.06,
  }));
}

function createDiceFaceTexture(value, isPrimary) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, isPrimary ? "#d45c51" : "#9c3a37");
  gradient.addColorStop(1, isPrimary ? "#631d24" : "#401018");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = "rgba(255, 226, 173, 0.55)";
  context.lineWidth = 12;
  roundRect(context, 18, 18, 220, 220, 30);
  context.stroke();
  context.fillStyle = "#fff3d2";
  context.shadowColor = "rgba(0, 0, 0, 0.72)";
  context.shadowBlur = 12;
  context.font = value >= 10 ? "950 112px Inter, system-ui, sans-serif" : "950 138px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(value), 128, 134, 190);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function setDiceValue(value) {
  const nextValue = Number.isFinite(Number(value)) ? Math.max(1, Math.min(20, Number(value))) : 20;
  dice.value = nextValue;
  const oldMaterials = Array.isArray(dice.die.material) ? dice.die.material : [dice.die.material];
  oldMaterials.forEach((material) => {
    material.map?.dispose();
    material.dispose();
  });
  dice.die.material = createDiceMaterials(nextValue);
  dice.die.rotation.set(-0.48, 0.62, 0.18);
}

function loadModelAssets() {
  void attachModelToMini("orcEnemy", minis.enemy, {
    scale: 0.52,
    position: [0, 0.08, 0.02],
    rotation: [0, Math.PI / 2, 0],
    animationNames: ["CharacterArmature|Idle", "Idle"],
  });

  void replaceSceneGroupWithModel("cart", tableObjects.wagon, {
    scale: 2.55,
    position: [0, -0.44, 0.06],
    rotation: [0, Math.PI / 2, 0],
  });

  [
    [-3.85, 0.56, 0.35, 2.8, -0.3],
    [-2.65, 0.56, -1.55, 2.45, 0.42],
    [-4.25, 0.56, -1.0, 2.15, 0.8],
  ].forEach(([x, y, z, scale, rotationY]) => {
    void addSceneModel("crate", {
      scale,
      position: [x, y, z],
      rotation: [0, rotationY, 0],
      kind: "prop",
    });
  });

  [
    [3.65, 0.51, -2.7, 2.25, 0.15],
    [-3.8, 0.51, 2.45, 2.05, -0.5],
    [1.18, 0.51, 4.2, 1.8, 0.9],
  ].forEach(([x, y, z, scale, rotationY]) => {
    void addSceneModel("rocks", {
      scale,
      position: [x, y, z],
      rotation: [0, rotationY, 0],
      kind: "prop",
    });
  });
}

async function attachModelToMini(key, mini, options) {
  try {
    const { root, animations } = await createModelInstance(key);
    prepareImportedModel(root, modelManifest[key], { kind: mini.group.userData.kind, label: mini.group.userData.label });
    hideProceduralMiniVisuals(mini);
    placeImportedModel(root, options);
    mini.group.add(root);
    root.traverse((child) => {
      if (child.isMesh) mini.pickables.push(child);
    });
    mini.animation = playImportedAnimation(root, animations, options.animationNames);
    assetState.loaded.add(key);
  } catch (error) {
    console.warn(`Unable to load ${key}`, error);
  }
}

async function replaceSceneGroupWithModel(key, targetGroup, options) {
  try {
    const { root } = await createModelInstance(key);
    prepareImportedModel(root, modelManifest[key], { kind: "prop", label: modelManifest[key].label });
    targetGroup.children.forEach((child) => {
      child.visible = false;
    });
    placeImportedModel(root, options);
    targetGroup.add(root);
    assetState.loaded.add(key);
  } catch (error) {
    console.warn(`Unable to load ${key}`, error);
  }
}

async function addSceneModel(key, options) {
  try {
    const { root } = await createModelInstance(key);
    prepareImportedModel(root, modelManifest[key], { kind: options.kind || "prop", label: modelManifest[key].label });
    placeImportedModel(root, options);
    groups.scene.add(root);
    assetState.loaded.add(`${key}-${assetState.loaded.size}`);
  } catch (error) {
    console.warn(`Unable to load ${key}`, error);
  }
}

function loadGltfAsset(key) {
  const asset = modelManifest[key];
  if (!assetState.cache.has(key)) {
    assetState.cache.set(key, new Promise((resolve, reject) => {
      gltfLoader.load(asset.url, resolve, undefined, reject);
    }));
  }
  return assetState.cache.get(key);
}

async function createModelInstance(key) {
  const gltf = await loadGltfAsset(key);
  return {
    root: gltf.scene.clone(true),
    animations: gltf.animations,
  };
}

function prepareImportedModel(root, asset, metadata) {
  root.name = asset.label;
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.userData.kind = metadata.kind;
    child.userData.label = metadata.label;
  });
}

function placeImportedModel(root, options) {
  const [x, y, z] = options.position || [0, 0, 0];
  const [rotationX, rotationY, rotationZ] = options.rotation || [0, 0, 0];
  root.position.set(x, y, z);
  root.rotation.set(rotationX, rotationY, rotationZ);
  root.scale.setScalar(options.scale || 1);
}

function hideProceduralMiniVisuals(mini) {
  mini.group.children.forEach((child) => {
    if (child === mini.base || child === mini.ring || child === mini.shadow || child === mini.statusBar.group) return;
    child.visible = false;
  });
}

function playImportedAnimation(root, animations, preferredNames = []) {
  if (!animations.length) return undefined;
  const preferred = animations.find((clip) => preferredNames.includes(clip.name));
  const clip = preferred || animations.find((candidate) => /idle/i.test(candidate.name)) || animations[0];
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  animations.forEach((candidate) => {
    actions.set(candidate.name, mixer.clipAction(candidate));
  });
  const active = actions.get(clip.name);
  if (active) active.play();
  assetState.mixers.push(mixer);
  return { mixer, actions, activeName: clip.name, idleName: clip.name };
}

function triggerActionAnimation(action) {
  if (action === "attack" || action === "skill") {
    playMiniClip(minis.enemy, ["CharacterArmature|HitRecieve", "HitRecieve"], 0.9);
    return;
  }

  if (action === "inspect") {
    playMiniClip(minis.enemy, ["CharacterArmature|Yes", "Yes"], 1);
    return;
  }

  if (action === "defend" || action === "call") {
    playMiniClip(minis.enemy, ["CharacterArmature|Bite_Front", "Bite_Front"], 0.85);
  }
}

function playMiniClip(mini, preferredNames, duration) {
  const animation = mini.animation;
  if (!animation) return;

  const nextName = preferredNames.find((name) => animation.actions.has(name));
  const next = nextName ? animation.actions.get(nextName) : undefined;
  const idle = animation.actions.get(animation.idleName);
  if (!next || !idle || next === idle) return;

  animation.actions.forEach((action) => action.fadeOut(0.08));
  next.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.08).play();
  animation.activeName = nextName;

  window.setTimeout(() => {
    next.fadeOut(0.18);
    idle.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.18).play();
    animation.activeName = animation.idleName;
  }, duration * 1000);
}

function createActionMarker(action) {
  const meta = actionMeta[action];
  const group = new THREE.Group();

  const shadow = createContactShadow(0.56, 0.48, 0.26);
  shadow.position.y = 0.01;
  group.add(shadow);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.08, 0.62),
    new THREE.MeshStandardMaterial({
      color: 0x16120f,
      roughness: 0.5,
      metalness: 0.18,
    })
  );
  base.position.y = 0.055;
  base.rotation.y = 0.12;
  base.castShadow = true;
  base.receiveShadow = true;
  base.userData.action = action;
  base.userData.label = meta.label;
  group.add(base);

  const inlay = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.026, 0.4),
    new THREE.MeshStandardMaterial({
      color: meta.color,
      roughness: 0.44,
      metalness: 0.12,
      emissive: meta.color,
      emissiveIntensity: 0.18,
    })
  );
  inlay.position.y = 0.118;
  inlay.rotation.y = 0.12;
  inlay.userData.action = action;
  inlay.userData.label = meta.label;
  inlay.userData.glow = true;
  group.add(inlay);

  const brass = new THREE.MeshStandardMaterial({ color: palette.brass, roughness: 0.38, metalness: 0.46 });
  [
    [-0.33, -0.23], [0.33, -0.23], [-0.33, 0.23], [0.33, 0.23],
  ].forEach(([x, z]) => {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.03, 10), brass);
    rivet.position.set(x, 0.14, z);
    rivet.rotation.y = 0.12;
    rivet.castShadow = true;
    group.add(rivet);
  });

  const glyph = createTileGlyph(meta.glyph, meta.color);
  glyph.position.y = 0.142;
  glyph.rotation.y = 0.12;
  glyph.userData.action = action;
  glyph.userData.label = meta.label;
  group.add(glyph);

  group.userData.action = action;
  group.userData.label = meta.label;
  group.userData.restY = 0.532;
  return group;
}

function createTileGlyph(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  const colorHex = `#${color.toString(16).padStart(6, "0")}`;
  const gradient = context.createLinearGradient(0, 0, 256, 192);
  gradient.addColorStop(0, "rgba(255, 240, 194, 0.2)");
  gradient.addColorStop(1, "rgba(3, 3, 3, 0.2)");
  context.fillStyle = gradient;
  roundRect(context, 34, 30, 188, 132, 12);
  context.fill();

  context.strokeStyle = "rgba(255, 243, 210, 0.72)";
  context.lineWidth = 5;
  roundRect(context, 46, 42, 164, 108, 10);
  context.stroke();

  context.fillStyle = colorHex;
  context.globalAlpha = 0.36;
  context.fillRect(58, 132, 140, 8);
  context.globalAlpha = 1;

  context.fillStyle = "#fff3d2";
  context.shadowColor = colorHex;
  context.shadowBlur = 16;
  context.font = text.length > 2 ? "900 46px Inter, system-ui, sans-serif" : "950 58px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 128, 92, 148);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const glyph = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.44),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  glyph.rotation.x = -Math.PI / 2;
  glyph.renderOrder = 18;
  return glyph;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function renderBoardState(nextState) {
  const phase = nextState.activeSession?.phase || "idle";
  const enemy = nextState.activeSession?.enemy || nextState.lastQuest?.enemy;
  const character = nextState.activeCharacter;

  phaseBadge.textContent = phaseLabel(phase);
  setPhaseClass(phase);
  sceneTitle.textContent = sceneLabel(nextState);
  startSceneButton.disabled = !character || phase === "scene" || phase === "combat";
  startSceneButton.textContent = sceneButtonLabel(nextState);
  objectiveText.textContent = objectiveFor(nextState);

  minis.party.body.material.color.set(characterColor(character?.classKey));
  minis.party.ring.material.color.set(characterHealthColor(character));
  minis.party.group.position.lerp(targetPartyPosition(phase), 0.55);
  minis.enemy.group.visible = Boolean(enemy);
  minis.enemy.group.position.lerp(enemy ? targetEnemyPosition(phase) : scratch.fallbackEnemyPosition, 0.55);
  minis.enemy.body.material.color.set(enemy && enemy.hp < enemy.maxHp / 2 ? 0x7c272a : 0xb84a45);
  minis.enemy.ring.material.opacity = enemy && enemy.hp < enemy.maxHp / 2 ? 0.92 : 0.66;
  updateMiniStatusBar(minis.party.statusBar, character?.hp, character?.maxHp);
  updateMiniStatusBar(minis.enemy.statusBar, enemy?.hp, enemy?.maxHp);
  tableObjects.enemyGlow.visible = Boolean(enemy) && phase === "combat";
  tableObjects.enemyGlow.intensity = enemy && enemy.hp < enemy.maxHp / 2 ? 1.3 : 0.72;
  tableObjects.enemyGlow.position.lerp(scratch.enemyGlowPosition.copy(minis.enemy.group.position).add(scratch.enemyGlowOffset), 0.4);

  tableObjects.wagon.rotation.z = phase === "combat" ? -0.06 : 0;
  updateCameraShot(phase);
  if (phase !== localState.lastPhase) {
    queueScenePulse(phase);
    localState.lastPhase = phase;
  }

  rebuildActionMarkers();
}

function updateMiniStatusBar(statusBar, current, max) {
  if (!statusBar || !Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
    if (statusBar) statusBar.group.visible = false;
    return;
  }

  const percent = Math.max(0, Math.min(1, current / max));
  statusBar.group.visible = true;
  statusBar.fill.scale.x = percent;
  statusBar.fill.position.x = -(statusBar.width * (1 - percent)) / 2;
  statusBar.fill.material.color.set(percent < 0.3 ? 0xd15b4f : percent < 0.6 ? 0xd5a14f : 0x8fb36b);
}

function updateCameraShot(phase) {
  if (localState.orbitMode) return;
  const isNarrow = canvas.clientWidth < 720;
  const shot = cameraShotFor(phase, isNarrow);
  cameraState.targetPosition.copy(shot.position);
  cameraState.targetLookAt.copy(shot.lookAt);
}

function cameraShotFor(phase, isNarrow) {
  const narrowOffset = isNarrow ? -2.6 : 0;

  if (phase === "combat") {
    return {
      position: new THREE.Vector3(isNarrow ? 0.2 : 0.8, isNarrow ? 15.2 : 16.6, isNarrow ? 10.8 : 13.2),
      lookAt: new THREE.Vector3(0.9, 0.2, 0.75 + narrowOffset),
    };
  }

  if (phase === "scene") {
    return {
      position: new THREE.Vector3(isNarrow ? -0.2 : -0.6, isNarrow ? 16.3 : 17.2, isNarrow ? 11.4 : 14.2),
      lookAt: new THREE.Vector3(-0.8, 0.15, -0.25 + narrowOffset),
    };
  }

  if (phase === "completed" || phase === "failed") {
    return {
      position: new THREE.Vector3(0, isNarrow ? 17.5 : 18.2, isNarrow ? 12.2 : 14.8),
      lookAt: new THREE.Vector3(-0.4, 0.1, 0.2 + narrowOffset),
    };
  }

  return {
    position: new THREE.Vector3(0, isNarrow ? 17 : 18.5, isNarrow ? 12.4 : 15.8),
    lookAt: new THREE.Vector3(0, 0.05, 0.1 + narrowOffset),
  };
}

function rebuildActionMarkers() {
  groups.actions.clear();
  localState.interactables.clear();
}

function renderPartySummary(character) {
  if (!character) {
    characterCard.innerHTML = `<strong>No hero seated</strong><p>Create the party lead to place a miniature on the board.</p>`;
    return;
  }

  const hpPercent = Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100));
  const inventory = character.inventory.length
    ? character.inventory.map((item) => `<span>${escapeHtml(item.name)} <b>${item.quantity}</b></span>`).join("")
    : "<span>Empty pack</span>";
  characterCard.innerHTML = `
    <div class="hero-title"><strong>${escapeHtml(character.name)}</strong><span>${classLabel(character.classKey)}</span></div>
    <div class="meter"><i style="width:${hpPercent}%"></i></div>
    <div class="stat-line"><span>HP <b>${Math.max(0, character.hp)}/${character.maxHp}</b></span><span>Gold <b>${character.gold}</b></span><span>XP <b>${character.xp}</b></span></div>
    <div class="inventory-strip">${inventory}</div>
  `;
}

function renderSceneVitals(nextState) {
  const character = nextState.activeCharacter;
  const enemy = nextState.activeSession?.enemy || nextState.lastQuest?.enemy;
  const session = nextState.activeSession;
  const characterHp = character ? `${Math.max(0, character.hp)}/${character.maxHp}` : "--";
  const enemyHp = enemy ? `${Math.max(0, enemy.hp)}/${enemy.maxHp}` : "--";
  const intent = session?.enemyIntent?.label || "No intent";

  sceneVitals.innerHTML = `
    <span><b>Party</b>${escapeHtml(characterHp)}</span>
    <span><b>Momentum</b>${session?.momentum || 0}</span>
    <span><b>Round</b>${session?.round || 0}</span>
    <span><b>Intent</b>${escapeHtml(intent)}</span>
    <span><b>Enemy HP</b>${escapeHtml(enemyHp)}</span>
  `;
}

function renderClueRack(nextState) {
  const clues = nextState.activeSession?.clues || [];

  if (!clues.length) {
    clueRack.innerHTML = `<span>No clues banked</span>`;
    return;
  }

  clueRack.innerHTML = clues.map((clue) => {
    const [name, effect] = clue.split(": ");
    return `<span><b>${escapeHtml(name || clue)}</b>${escapeHtml(effect || "")}</span>`;
  }).join("");
}

function renderChoiceTable(nextState) {
  const players = nextState.players || [];
  const choices = nextState.choices || { needed: 1, votes: [], tally: [] };
  const myVote = choices.votes.find((vote) => vote.playerId === localState.player.id);
  const needed = choices.needed || 1;
  const voteTotal = choices.votes.length;
  const progress = Math.min(100, Math.round((voteTotal / needed) * 100));
  const seated = players.length
    ? players.map((player) => {
      const vote = choices.votes.find((choice) => choice.playerId === player.id);
      return `<span class="${player.id === localState.player.id ? "is-you" : ""}"><b>${escapeHtml(player.name)}</b>${vote ? escapeHtml(vote.label) : "Thinking"}</span>`;
    }).join("")
    : `<span><b>${escapeHtml(localState.player.name)}</b>${localState.seated ? "Joining" : "Spectating"}</span>`;
  const tally = choices.tally.length
    ? choices.tally.map((item) => `<i>${escapeHtml(item.label)} <b>${item.count}</b></i>`).join("")
    : "<i>No vote open</i>";
  const lastResolved = choices.lastResolved
    ? `<div class="last-choice"><b>Last move</b><span>${escapeHtml(choices.lastResolved.label)}</span></div>`
    : "";
  const tableStatus = localState.seated ? `${needed} to resolve${myVote ? ` - your vote: ${escapeHtml(myVote.label)}` : ""}` : "Spectating - sit to vote";

  choiceTable.innerHTML = `
    <div class="choice-head"><strong>${players.length || (localState.seated ? 1 : 0)} seated</strong><span>${tableStatus}</span></div>
    <div class="vote-meter" aria-label="Vote progress"><i style="width: ${progress}%"></i></div>
    ${lastResolved}
    <div class="seat-strip">${seated}</div>
    <div class="vote-strip">${tally}</div>
  `;
}

function renderDirector(nextState) {
  const phase = nextState.activeSession?.phase || "idle";
  const enemy = nextState.activeSession?.enemy || nextState.lastQuest?.enemy;
  const quest = nextState.lastQuest || reconstructedQuest(nextState);
  const roll = quest?.rollSummary || "";
  const eventCount = nextState.activeSession?.log?.length || 0;
  const phaseText = phaseLabel(phase);
  const rollText = roll ? roll.replace(/\s+/g, " ") : nextState.activeSession?.enemyIntent?.telegraph || "No roll on this beat";

  directorEyebrow.textContent = `${phaseText} - Beat ${Math.max(1, eventCount)}`;
  directorTitle.textContent = directorTitleFor(nextState, enemy);
  directorBody.textContent = rollText;
  directorCard.dataset.phase = phase;
}

function directorTitleFor(nextState, enemy) {
  const phase = nextState.activeSession?.phase || "idle";
  if (!nextState.activeCharacter) return "Seat the party at the table.";
  if (phase === "scene") return "Pick how the party approaches the wreck.";
  if (phase === "combat" && enemy) {
    const intent = nextState.activeSession?.enemyIntent;
    return intent ? `${intent.label}: counter with ${intent.counter}` : `${enemy.name}: ${Math.max(0, enemy.hp)}/${enemy.maxHp} HP`;
  }
  if (phase === "completed") return "The road is clear.";
  if (phase === "failed") return "The party is down.";
  return "Start the Hollow Road.";
}

function renderDMLog(nextState) {
  const quest = nextState.lastQuest || reconstructedQuest(nextState);

  if (!quest) {
    if (!localState.lastNarrationKey) {
      addNarration("The table is waiting", "Seat the party, then start the scene. Click glowing pieces directly on the 3D table.");
      localState.lastNarrationKey = "waiting";
    }
    diceTray.textContent = "20";
    setDiceTier("");
    rollText.textContent = "No roll yet";
    audioState.currentNarration = {
      title: "The table is waiting",
      body: "Seat the party, then start the scene. Click glowing pieces directly on the 3D table.",
      roll: "",
    };
    updateNarratorControls();
    return;
  }

  const key = `${quest.title}:${quest.narration}:${quest.rollSummary || ""}`;
  if (localState.lastNarrationKey === key) return;

  localState.lastNarrationKey = key;
  addNarration(quest.title, quest.narration, quest.rollSummary);
  spawnNarrationFloaters(quest.narration);
  audioState.currentNarration = {
    title: quest.title,
    body: quest.narration,
    roll: quest.rollSummary || "",
  };
  speakCurrentNarration(false);
  const roll = quest.rollSummary?.match(/d20\s+(\d+)/i)?.[1];
  const tier = quest.rollSummary?.match(/\(([^)]+)\)/)?.[1] || "";
  diceTray.textContent = roll || "20";
  setDiceValue(roll || 20);
  setDiceTier(tier);
  rollText.textContent = quest.rollSummary || "No roll on this move";
  updateNarratorControls();
}

function setDiceTier(tier) {
  diceTray.classList.remove("tier-disaster", "tier-miss", "tier-success", "tier-strong", "tier-heroic");
  if (tier) {
    diceTray.classList.add(`tier-${tier}`);
  }
}

function addNarration(title, body, roll) {
  narrationLog.insertAdjacentHTML("afterbegin", `
    <article>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body).replace(/\n/g, "<br />")}</p>
      ${roll ? `<small>${escapeHtml(roll)}</small>` : ""}
    </article>
  `);
}

function spawnNarrationFloaters(body) {
  const lines = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  lines.forEach((line) => {
    const enemyDamage = line.match(/takes\s+(\d+)\s+damage/i);
    if (enemyDamage) {
      createFloatingText(`-${enemyDamage[1]}`, minis.enemy.group.position.clone().add(new THREE.Vector3(0, 1.7, 0)), 0xd15b4f);
      localState.pulses.push(createTablePulse(minis.enemy.group.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xd15b4f, 1.1));
      playCue("damage");
      return;
    }

    const partyDamage = line.match(/hits back for\s+(\d+)\s+damage/i);
    if (partyDamage) {
      createFloatingText(`-${partyDamage[1]}`, minis.party.group.position.clone().add(new THREE.Vector3(0, 1.55, 0)), 0xd15b4f);
      localState.pulses.push(createTablePulse(minis.party.group.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xd15b4f, 1.05));
      playCue("damage");
      return;
    }

    const healing = line.match(/(?:recovers|restores)\s+(\d+)\s+HP/i);
    if (healing) {
      createFloatingText(`+${healing[1]}`, minis.party.group.position.clone().add(new THREE.Vector3(0, 1.55, 0)), 0x8fb36b);
      localState.pulses.push(createTablePulse(minis.party.group.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0x8fb36b, 1.05));
      playCue("heal");
      return;
    }

    if (/reward:/i.test(line)) {
      createFloatingText("Reward", new THREE.Vector3(-0.9, 1.7, 0.15), 0xd5a14f);
      playCue("reward");
      return;
    }

    if (/collapses/i.test(line)) {
      createFloatingText("Down", minis.party.group.position.clone().add(new THREE.Vector3(0, 1.65, 0)), 0xd15b4f);
      playCue("damage");
    }
  });
}

function renderActionTray(nextState) {
  if (!nextState.activeCharacter) {
    movePrompt.textContent = "Seat the party to place the first miniature.";
    moveGrid.innerHTML = "";
    return;
  }

  if (localState.availableActions.length === 0) {
    movePrompt.textContent = nextState.activeSession?.phase === "completed"
      ? "The board is clear. Replay the scene or build the next quest."
      : "Start the scene to place the first glowing choices.";
    moveGrid.innerHTML = "";
    return;
  }

  movePrompt.textContent = nextState.activeSession?.phase === "combat"
    ? (localState.seated ? "Party vote" : "Spectating combat")
    : (localState.seated ? "Vote on the party approach" : "Spectating the table");

  const recommended = recommendedActionFor(nextState);
  const choices = nextState.choices || { votes: [], tally: [] };
  const needed = choices.needed || 1;
  const myVote = choices.votes.find((vote) => vote.playerId === localState.player.id);
  moveGrid.innerHTML = localState.availableActions.map((action) => {
    const meta = actionMeta[action];
    const tag = action === recommended ? "Counter" : actionTag(action, nextState);
    const payoff = actionPayoff(action, nextState);
    const count = choices.tally.find((item) => item.action === action)?.count || 0;
    const votePercent = Math.min(100, Math.round((count / needed) * 100));
    const classes = [
      action === recommended ? "is-recommended" : "",
      myVote?.action === action ? "is-voted" : "",
    ].filter(Boolean).join(" ");
    const disabled = localState.seated ? "" : " disabled";
    const pressed = myVote?.action === action ? "true" : "false";
    return `<button type="button" data-dock-action="${action}" class="${classes}" style="--vote-pct: ${votePercent}%" aria-pressed="${pressed}"${disabled}><strong>${meta.label}</strong><span>${payoff}</span><em>${tag} - ${count}/${needed}</em><i class="vote-fill" aria-hidden="true"></i></button>`;
  }).join("");

  moveGrid.querySelectorAll("[data-dock-action]").forEach((button) => {
    button.addEventListener("click", () => post("/api/choice", { action: button.dataset.dockAction }));
  });
}

function recommendedActionFor(nextState) {
  const counter = nextState.activeSession?.enemyIntent?.counter?.toLowerCase();
  if (!counter) return "";
  return counter === "attack" ? "attack" : counter;
}

function actionTag(action, nextState) {
  const momentum = nextState.activeSession?.momentum || 0;
  return {
    search: "Clue",
    track: "Advantage",
    call: "Ally",
    attack: "Damage",
    defend: "+Guard",
    skill: momentum >= 2 ? "Spend 2" : "Power",
    potion: "Heal",
    inspect: "+Read",
  }[action] || "Move";
}

function actionPayoff(action, nextState) {
  const intent = nextState.activeSession?.enemyIntent;
  const isCounter = intent?.counter?.toLowerCase() === action || (intent?.counter?.toLowerCase() === "attack" && action === "attack");
  const momentum = nextState.activeSession?.momentum || 0;

  if (isCounter) return `Counters ${intent.label}. Best table read.`;

  return {
    search: "Find a clue and weaken the ambush.",
    track: "Set the opening fight in your favor.",
    call: "Risk noise to find a survivor.",
    attack: "Deal damage. Risk the counterhit.",
    defend: "Reduce pressure and bank Momentum.",
    skill: momentum >= 2 ? "Spend Momentum for a cleaner strike." : "Use class power. Stronger with Momentum.",
    potion: "Recover health, but lose tempo.",
    inspect: "Read the enemy and gain Momentum.",
  }[action] || actionMeta[action]?.hint || "Commit the party move.";
}

function handlePointerMove(event) {
  const hit = pickAction(event);
  setHover(hit);
  canvas.style.cursor = hit ? "pointer" : "default";
  if (hit) {
    const action = tableActionForHit(hit);
    const actionText = action ? ` Click to vote ${actionMeta[action].label}.` : "";
    hoverTooltip.hidden = false;
    hoverTooltip.textContent = hit.userData.action
      ? `${hit.userData.label}: ${actionMeta[hit.userData.action].hint}`
      : `${hit.userData.label}.${actionText}`;
    hoverTooltip.style.left = `${event.clientX + 14}px`;
    hoverTooltip.style.top = `${event.clientY + 14}px`;
  } else {
    hoverTooltip.hidden = true;
  }
}

function handleTableClick(event) {
  const hit = pickAction(event);
  if (hit?.userData?.label) {
    const action = tableActionForHit(hit);
    hit.getWorldPosition(scratch.pulsePosition);
    scratch.pulsePosition.y = 0.55;
    localState.pulses.push(createTablePulse(scratch.pulsePosition, action ? actionMeta[action].color : 0xd5a14f, 0.75));

    if (action) {
      post("/api/choice", { action });
    }
  }
}

function tableActionForHit(hit) {
  if (!localState.seated || !localState.availableActions.length) return "";

  const kind = hit.userData?.kind || hit.parent?.userData?.kind;
  const state = localState.current || {};
  const recommended = recommendedActionFor(state);

  if (kind === "enemy") {
    return [recommended, "attack", "inspect", "skill", "track"].find((action) => localState.availableActions.includes(action)) || "";
  }

  if (kind === "party") {
    const hp = state.activeCharacter?.hp || 0;
    const maxHp = state.activeCharacter?.maxHp || 1;
    const isHurt = hp / maxHp < 0.55;
    const preferred = isHurt ? ["potion", "defend", "skill", "search"] : ["defend", "skill", "search", "call"];
    return preferred.find((action) => localState.availableActions.includes(action)) || "";
  }

  return "";
}

function pickAction(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const tokenPickables = [...minis.party.pickables, ...minis.enemy.pickables].filter(isWorldVisible);
  const hits = raycaster.intersectObjects(tokenPickables, true);
  return hits[0]?.object || null;
}

function isWorldVisible(object) {
  let cursor = object;
  while (cursor) {
    if (!cursor.visible) return false;
    cursor = cursor.parent;
  }
  return true;
}

function setHover(object) {
  if (localState.hovered === object) return;
  if (localState.hovered?.material?.emissiveIntensity !== undefined) {
    localState.hovered.material.emissiveIntensity = 0.16;
  }
  if (localState.hovered?.userData?.kind) {
    setMiniHover(localState.hovered.userData.kind, false);
  }
  localState.hovered = object;
  if (object?.material?.emissiveIntensity !== undefined) {
    object.material.emissiveIntensity = 0.45;
  }
  if (object?.userData?.kind) {
    setMiniHover(object.userData.kind, true);
  }
}

function setMiniHover(kind, isHovered) {
  const target = kind === "enemy" ? minis.enemy : minis.party;
  target.ring.scale.setScalar(isHovered ? 1.12 : 1);
  target.group.scale.setScalar(isHovered ? 1.04 : 1);
}

function queueActionPulse(action) {
  const position = positionForAction(action).clone();
  position.y += 0.025;
  const color = actionMeta[action]?.color || palette.torch;
  localState.pulses.push(createTablePulse(position, color, 1));
}

function queueScenePulse(phase) {
  if (phase !== "combat" && phase !== "completed" && phase !== "failed") return;
  const color = phase === "completed" ? 0x8fb36b : phase === "failed" ? 0xa9473e : 0xd5a14f;
  localState.pulses.push(createTablePulse(new THREE.Vector3(0.6, 0.72, 0.6), color, 1.45));
}

function createTablePulse(position, color, scale) {
  const pulse = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
  const longGeometry = new THREE.BoxGeometry(1.18, 0.018, 0.045);
  const shortGeometry = new THREE.BoxGeometry(0.045, 0.018, 0.82);

  [
    { geometry: longGeometry, position: [0, 0, -0.42] },
    { geometry: longGeometry, position: [0, 0, 0.42] },
    { geometry: shortGeometry, position: [-0.59, 0, 0] },
    { geometry: shortGeometry, position: [0.59, 0, 0] },
  ].forEach(({ geometry, position: framePosition }) => {
    const edge = new THREE.Mesh(geometry, material);
    edge.position.set(...framePosition);
    pulse.add(edge);
  });

  pulse.position.copy(position);
  pulse.rotation.y = -0.1;
  pulse.scale.setScalar(scale);
  pulse.userData.age = 0;
  pulse.userData.life = 0.72;
  pulse.userData.material = material;
  pulse.userData.geometries = [longGeometry, shortGeometry];
  groups.effects.add(pulse);
  return pulse;
}

function createFloatingText(text, position, color) {
  const sprite = createTextSprite(text, color);
  sprite.position.copy(position);
  sprite.userData.age = 0;
  sprite.userData.life = 1.15;
  sprite.userData.velocity = new THREE.Vector3(0, 0.55, 0);
  groups.effects.add(sprite);
  localState.floaters.push(sprite);
}

function createTextSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(5, 6, 6, 0.72)";
  context.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.lineWidth = 5;
  roundRect(context, 34, 24, 188, 78, 20);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff3d2";
  context.font = "950 40px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 128, 64, 168);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.05, 0.52, 1);
  sprite.renderOrder = 30;
  return sprite;
}

function resolveAvailableActions(nextState) {
  const phase = nextState.activeSession?.phase;
  if (!nextState.activeCharacter) return [];
  if (nextState.lastQuest?.availableActions) return nextState.lastQuest.availableActions;
  if (phase === "scene") return ["search", "track", "call"];
  if (phase === "combat") return ["attack", "defend", "skill", "potion", "inspect"];
  return [];
}

function reconstructedQuest(nextState) {
  const session = nextState.activeSession;
  if (!session?.log?.length) return null;
  return {
    title: sceneLabel(nextState),
    narration: session.log.slice(-2).join("\n\n"),
    rollSummary: "",
  };
}

function positionForAction(action) {
  const y = 0.532;
  const positions = {
    search: new THREE.Vector3(-3.4, y, -1.6),
    track: new THREE.Vector3(3.2, y, 1.7),
    call: new THREE.Vector3(-0.2, y, -3.1),
    attack: new THREE.Vector3(1.6, y, 0.4),
    defend: new THREE.Vector3(-0.5, y, 2.1),
    skill: new THREE.Vector3(0.6, y, 1.2),
    potion: new THREE.Vector3(-1.9, y, 3.1),
    inspect: new THREE.Vector3(3.7, y, -1.2),
  };
  return positions[action] || new THREE.Vector3();
}

function targetPartyPosition(phase) {
  if (phase === "combat") return new THREE.Vector3(0.3, 0.52, 2.2);
  if (phase === "completed") return new THREE.Vector3(-1.2, 0.52, -1.1);
  return new THREE.Vector3(0.4, 0.52, 3.7);
}

function targetEnemyPosition(phase) {
  if (phase === "combat") return new THREE.Vector3(2.4, 0.52, -0.4);
  return new THREE.Vector3(3.2, 0.52, -1.3);
}

function characterColor(classKey) {
  return {
    warden: 0x5878b9,
    hexbinder: 0xa96bd8,
    shade: 0x5cb8b2,
    mender: 0x8fb36b,
  }[classKey] || 0x5878b9;
}

function characterHealthColor(character) {
  if (!character) return 0x81a5d6;
  const percent = character.hp / character.maxHp;
  if (percent < 0.3) return 0xd15b4f;
  if (percent < 0.58) return 0xd5a14f;
  return characterColor(character.classKey);
}

function objectiveFor(nextState) {
  const phase = nextState.activeSession?.phase || "idle";
  if (!nextState.activeCharacter) return "Seat the lead hero to place the party miniature.";
  if (phase === "idle") return "Start the scene and reveal the caravan table.";
  if (phase === "scene") return "Choose a clue marker.";
  if (phase === "combat") return "Party turn. Choose a tactic.";
  if (phase === "completed") return "The road is clear. The party found its first clue.";
  if (phase === "failed") return "The party fell. Start again from the roadside.";
  return "Choose the next tabletop move.";
}

function sceneLabel(nextState) {
  const phase = nextState.activeSession?.phase || "idle";
  if (phase === "combat") return "Road Stalker Ambush";
  if (phase === "completed") return "Aftermath At The Caravan";
  if (phase === "failed") return "Defeat On The Road";
  if (phase === "scene") return "The Broken Caravan";
  return "Waiting At The Table";
}

function phaseLabel(phase) {
  return {
    idle: "Setup",
    scene: "Scene",
    combat: "Combat",
    completed: "Cleared",
    failed: "Defeated",
  }[phase] || "Live";
}

function setPhaseClass(phase) {
  ["idle", "scene", "combat", "completed", "failed"].forEach((key) => {
    document.body.classList.toggle(`phase-${key}`, phase === key);
  });
}

function toggleFocusMode() {
  const enabled = !document.body.classList.contains("focus-mode");
  document.body.classList.toggle("focus-mode", enabled);
  focusToggle.setAttribute("aria-pressed", String(enabled));
}

function setOrbitMode(enabled) {
  localState.orbitMode = enabled;
  document.body.classList.toggle("orbit-mode", enabled);
  orbitControls.enabled = enabled;
  orbitToggle.textContent = enabled ? "Orbit On" : "Story Cam";
  orbitToggle.setAttribute("aria-pressed", String(enabled));

  if (enabled) {
    orbitControls.target.copy(cameraState.currentLookAt);
    orbitControls.update();
    return;
  }

  updateCameraShot(localState.current?.activeSession?.phase || "idle");
}

function setOrbitPreset(preset) {
  setOrbitMode(true);
  setActiveViewPreset(preset);

  if (preset === "top") {
    scratch.viewCenter.set(0, 0.28, 0);
    scratch.viewPosition.set(0, 24, 0.55);
  } else if (preset === "party") {
    minis.party.group.getWorldPosition(scratch.viewCenter);
    scratch.viewCenter.y = 0.75;
    scratch.viewPosition.copy(scratch.viewCenter).add(new THREE.Vector3(-3.2, 7.4, 6.2));
  } else if (preset === "enemy" && minis.enemy.group.visible) {
    minis.enemy.group.getWorldPosition(scratch.viewCenter);
    scratch.viewCenter.y = 0.75;
    scratch.viewPosition.copy(scratch.viewCenter).add(new THREE.Vector3(3.4, 7.2, 5.4));
  } else {
    fitCameraToTable();
  }

  camera.position.copy(scratch.viewPosition);
  orbitControls.target.copy(scratch.viewCenter);
  orbitControls.update();
  cameraState.currentLookAt.copy(orbitControls.target);
  cameraState.targetLookAt.copy(orbitControls.target);
  cameraState.targetPosition.copy(camera.position);
}

function fitCameraToTable() {
  scratch.viewBox.makeEmpty();
  [groups.board, groups.scene, groups.tokens].forEach((object) => {
    scratch.viewBox.expandByObject(object);
  });

  if (scratch.viewBox.isEmpty()) {
    scratch.viewCenter.set(0, 0.35, 0);
    scratch.viewSize.set(18, 3, 12);
  } else {
    scratch.viewBox.getCenter(scratch.viewCenter);
    scratch.viewBox.getSize(scratch.viewSize);
    scratch.viewCenter.y = 0.35;
  }

  const span = Math.max(scratch.viewSize.x, scratch.viewSize.z, 11);
  scratch.viewPosition.set(scratch.viewCenter.x + 0.5, Math.min(24, span * 1.05), scratch.viewCenter.z + span * 0.78);
}

function setActiveViewPreset(preset) {
  viewPresetButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewPreset === preset);
  });
}

function createProjectedLabels() {
  if (!tableLabels) return [];

  const definitions = [
    {
      key: "party",
      title: () => localState.current?.activeCharacter?.name || "Party",
      detail: () => {
        const character = localState.current?.activeCharacter;
        return character ? `${character.hp}/${character.maxHp} HP` : "Seat hero";
      },
      object: () => minis.party.group,
      visible: () => Boolean(localState.current?.activeCharacter),
      offsetY: 2.15,
    },
    {
      key: "enemy",
      title: () => localState.current?.activeSession?.enemy?.name || localState.current?.lastQuest?.enemy?.name || "Enemy",
      detail: () => {
        const enemy = localState.current?.activeSession?.enemy || localState.current?.lastQuest?.enemy;
        return enemy ? `${enemy.hp}/${enemy.maxHp} HP` : "";
      },
      object: () => minis.enemy.group,
      visible: () => minis.enemy.group.visible,
      offsetY: 2.2,
    },
    {
      key: "dice",
      title: () => "D20",
      detail: () => String(dice.value || diceTray.textContent || "20"),
      object: () => dice.group,
      visible: () => true,
      offsetY: 0.85,
    },
  ];

  return definitions.map((definition) => {
    const element = document.createElement("div");
    element.className = `table-label table-label-${definition.key}`;
    element.innerHTML = "<b></b><span></span>";
    tableLabels.append(element);
    return { ...definition, element };
  });
}

function updateProjectedLabels() {
  if (!tableLabels || !projectedLabels.length) return;

  const canvasRect = canvas.getBoundingClientRect();
  const labelRect = tableLabels.getBoundingClientRect();

  projectedLabels.forEach((label) => {
    const object = label.object();
    const isVisible = object?.visible !== false && label.visible();

    if (!isVisible) {
      label.element.hidden = true;
      return;
    }

    object.getWorldPosition(scratch.labelPosition);
    scratch.labelPosition.y += label.offsetY;
    scratch.labelPosition.project(camera);

    const inFront = scratch.labelPosition.z > -1 && scratch.labelPosition.z < 1;
    if (!inFront) {
      label.element.hidden = true;
      return;
    }

    const x = canvasRect.left - labelRect.left + (scratch.labelPosition.x * 0.5 + 0.5) * canvasRect.width;
    const y = canvasRect.top - labelRect.top + (-scratch.labelPosition.y * 0.5 + 0.5) * canvasRect.height;
    const onScreen = x > -120 && x < labelRect.width + 120 && y > -80 && y < labelRect.height + 80;

    if (!onScreen) {
      label.element.hidden = true;
      return;
    }

    label.element.hidden = false;
    label.element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
    label.element.querySelector("b").textContent = label.title();
    label.element.querySelector("span").textContent = label.detail();
  });
}

function sceneButtonLabel(nextState) {
  const phase = nextState.activeSession?.phase || "idle";
  if (!nextState.activeCharacter) return "Seat Hero First";
  if (phase === "scene") return "Scene Live";
  if (phase === "combat") return "Combat Live";
  if (phase === "completed") return "Replay Scene";
  if (phase === "failed") return "Restart Scene";
  return "Start Scene";
}

function classLabel(classKey) {
  return {
    warden: "Warden",
    hexbinder: "Hexbinder",
    shade: "Shade",
    mender: "Mender",
  }[classKey] || classKey;
}

function rollDice() {
  dice.rollingUntil = performance.now() + 700;
  dice.group.userData.impactUntil = performance.now() + 980;
  localState.pulses.push(createTablePulse(dice.group.position.clone().add(new THREE.Vector3(0, -0.38, 0)), 0xf0c06d, 0.95));
  playCue("roll");
}

function setBusy(isBusy) {
  document.body.classList.toggle("is-busy", isBusy);
}

async function toggleNarratorVoice() {
  audioState.enabled = !audioState.enabled;

  if (audioState.enabled) {
    await unlockAudio();
    loadSpeechVoices();
    playCue("enable");
    speakCurrentNarration(true);
  } else {
    cancelSpeech();
  }

  updateNarratorControls();
}

async function cycleVoiceProfile() {
  audioState.voiceProfileIndex = (audioState.voiceProfileIndex + 1) % voiceProfiles.length;
  await unlockAudio();
  playCue("enable");
  updateNarratorControls();
  if (audioState.enabled && audioState.currentNarration) {
    speakCurrentNarration(true);
  }
}

async function toggleMusic() {
  audioState.musicEnabled = !audioState.musicEnabled;
  await unlockAudio();

  if (audioState.musicEnabled) {
    startMusic();
    playCue("enable");
  } else {
    stopMusic();
  }

  updateNarratorControls();
}

async function unlockAudio() {
  if (!audioState.audioContext) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioContextCtor) {
      audioState.audioContext = new AudioContextCtor();
    }
  }

  if (audioState.audioContext?.state === "suspended") {
    await audioState.audioContext.resume();
  }
}

function loadSpeechVoices() {
  if (!("speechSynthesis" in window)) return;
  audioState.voices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    audioState.voices = window.speechSynthesis.getVoices();
  };
}

async function speakCurrentNarration(force) {
  if (!audioState.enabled || !audioState.currentNarration) {
    updateNarratorControls();
    return;
  }

  if (audioState.speaking && !force) return;

  const { title, body, roll } = audioState.currentNarration;
  const text = [title, body, roll ? `Roll: ${roll}` : ""].filter(Boolean).join(". ");
  cancelSpeech();

  if (await playServerNarration(text)) {
    return;
  }

  if (!("speechSynthesis" in window)) {
    audioState.speaking = false;
    updateNarratorControls();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const profile = voiceProfiles[audioState.voiceProfileIndex] || voiceProfiles[0];
  const voice = chooseNarratorVoice(profile);
  if (voice) utterance.voice = voice;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.volume = profile.volume;
  utterance.onstart = () => {
    audioState.speaking = true;
    updateNarratorControls();
  };
  utterance.onend = () => {
    audioState.speaking = false;
    updateNarratorControls();
  };
  utterance.onerror = () => {
    audioState.speaking = false;
    updateNarratorControls();
  };

  window.speechSynthesis.speak(utterance);
  updateNarratorControls();
}

async function playServerNarration(text) {
  audioState.speaking = true;
  audioState.lastTtsProvider = "";
  updateNarratorControls();

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok || response.status === 204) {
      audioState.speaking = false;
      updateNarratorControls();
      return false;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioState.audioElement = audio;
    audioState.audioUrl = url;
    audioState.lastTtsProvider = response.headers.get("X-TTS-Provider") || "server";

    audio.onended = stopServerNarration;
    audio.onerror = stopServerNarration;
    await audio.play();
    updateNarratorControls();
    return true;
  } catch {
    audioState.speaking = false;
    updateNarratorControls();
    return false;
  }
}

function stopServerNarration() {
  if (audioState.audioElement) {
    audioState.audioElement.pause();
    audioState.audioElement.src = "";
    audioState.audioElement = null;
  }

  if (audioState.audioUrl) {
    URL.revokeObjectURL(audioState.audioUrl);
    audioState.audioUrl = "";
  }

  audioState.speaking = false;
  updateNarratorControls();
}

function chooseNarratorVoice(profile) {
  if (!audioState.voices.length) {
    loadSpeechVoices();
  }

  return audioState.voices.find((voice) => profile.match.test(`${voice.name} ${voice.lang || ""}`))
    || audioState.voices.find((voice) => voice.lang?.startsWith("en"))
    || audioState.voices[0];
}

function cancelSpeech() {
  stopServerNarration();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  audioState.speaking = false;
}

function updateNarratorControls() {
  const profile = voiceProfiles[audioState.voiceProfileIndex] || voiceProfiles[0];
  voiceToggle.textContent = audioState.enabled ? (audioState.speaking ? "Speaking" : "Voice On") : "Voice Off";
  voiceToggle.setAttribute("aria-pressed", String(audioState.enabled));
  voiceProfileButton.textContent = audioState.lastTtsProvider === "edge-tts"
    ? "Neural DM"
    : audioState.lastTtsProvider === "google-translate"
      ? "Free DM"
      : profile.label;
  voiceReplay.disabled = !audioState.enabled || !audioState.currentNarration;
  musicToggle.textContent = audioState.musicEnabled ? "Music On" : "Music Off";
  musicToggle.setAttribute("aria-pressed", String(audioState.musicEnabled));
  document.body.classList.toggle("narrator-on", audioState.enabled);
  document.body.classList.toggle("narrator-speaking", audioState.speaking);
  document.body.classList.toggle("music-on", audioState.musicEnabled);
  document.body.dataset.musicEngine = audioState.musicElement ? "audio-track" : audioState.music ? "web-audio" : "off";
}

function playCue(type) {
  if (!audioState.audioContext || (!audioState.enabled && !audioState.musicEnabled)) return;

  const context = audioState.audioContext;
  if (context.state === "suspended") return;

  const now = context.currentTime;
  const settings = {
    enable: { frequencies: [146.83, 220, 293.66], duration: 0.42, volume: 0.026, type: "triangle", sweep: 1.35 },
    roll: { frequencies: [92, 137], duration: 0.28, volume: 0.035, type: "triangle", sweep: 0.62 },
    attack: { frequencies: [82, 55], duration: 0.22, volume: 0.05, type: "sawtooth", sweep: 0.48 },
    defend: { frequencies: [196, 392], duration: 0.18, volume: 0.032, type: "square", sweep: 1.1 },
    heal: { frequencies: [220, 277.18, 329.63], duration: 0.36, volume: 0.028, type: "sine", sweep: 1.55 },
    inspect: { frequencies: [261.63, 392], duration: 0.24, volume: 0.024, type: "triangle", sweep: 1.25 },
    call: { frequencies: [110, 164.81], duration: 0.5, volume: 0.03, type: "sine", sweep: 1.2 },
    damage: { frequencies: [72], duration: 0.18, volume: 0.05, type: "sawtooth", sweep: 0.5 },
    reward: { frequencies: [293.66, 369.99, 440], duration: 0.46, volume: 0.03, type: "triangle", sweep: 1.18 },
    thunder: { frequencies: [46, 58, 73], duration: 0.95, volume: 0.034, type: "sawtooth", sweep: 0.42 },
  }[type] || { frequencies: [150], duration: 0.12, volume: 0.026, type: "sine", sweep: 0.7 };

  settings.frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const start = now + index * 0.035;
    const end = start + settings.duration;

    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * settings.sweep), end);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(type === "attack" || type === "damage" ? 620 : 1400, start);
    gain.gain.setValueAtTime(settings.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  });
}

function playActionCue(action) {
  const cue = {
    attack: "attack",
    defend: "defend",
    skill: "attack",
    potion: "heal",
    inspect: "inspect",
    search: "inspect",
    track: "inspect",
    call: "call",
  }[action] || "inspect";
  playCue(cue);
}

function startMusic() {
  startMusicTrack();
  const context = audioState.audioContext;
  if (!context || audioState.music) return;

  const master = context.createGain();
  const droneBus = context.createGain();
  const melodyBus = context.createGain();
  const pulseBus = context.createGain();
  const rainBus = context.createGain();
  const filter = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const now = context.currentTime;

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(audioState.musicVolume, now + 0.9);
  droneBus.gain.value = 0.58;
  melodyBus.gain.value = 0.92;
  pulseBus.gain.value = 0.74;
  rainBus.gain.value = 0.24;
  filter.type = "lowpass";
  filter.frequency.value = 1850;
  compressor.threshold.value = -22;
  compressor.knee.value = 22;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.014;
  compressor.release.value = 0.22;

  droneBus.connect(filter);
  melodyBus.connect(filter);
  pulseBus.connect(filter);
  rainBus.connect(filter);
  filter.connect(compressor);
  compressor.connect(master);
  master.connect(context.destination);

  const drones = [55, 82.41, 110, 146.83].map((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index % 2 === 0 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.055 : 0.026;
    oscillator.connect(gain);
    gain.connect(droneBus);
    oscillator.start(now);
    return oscillator;
  });

  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = noise.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * 0.34;
  }
  const rain = context.createBufferSource();
  const rainFilter = context.createBiquadFilter();
  rain.buffer = noise;
  rain.loop = true;
  rainFilter.type = "highpass";
  rainFilter.frequency.value = 1800;
  rain.connect(rainFilter);
  rainFilter.connect(rainBus);
  rain.start(now);

  const noteTimer = window.setInterval(playMusicNote, 1180);
  const pulseTimer = window.setInterval(playMusicPulse, 920);
  audioState.music = { master, drones, rain, noteTimer, pulseTimer, melodyBus, pulseBus };
  playMusicNote();
  playMusicPulse();
}

function stopMusic() {
  stopMusicTrack();
  const music = audioState.music;
  if (!music) return;

  const context = audioState.audioContext;
  const now = context?.currentTime || 0;
  if (context) {
    music.master.gain.cancelScheduledValues(now);
    music.master.gain.setTargetAtTime(0.0001, now, 0.35);
  }
  window.clearInterval(music.noteTimer);
  window.clearInterval(music.pulseTimer);
  window.setTimeout(() => {
    music.drones.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // The browser may have already collected a stopped node.
      }
    });
    try {
      music.rain.stop();
    } catch {
      // The browser may have already collected a stopped node.
    }
    music.master.disconnect();
  }, 500);
  audioState.music = null;
}

function startMusicTrack() {
  if (audioState.musicElement) {
    void audioState.musicElement.play().catch(() => undefined);
    return;
  }

  const url = createMusicLoopUrl();
  const audio = new Audio(url);
  audio.loop = true;
  audio.volume = 0.46;
  audioState.musicUrl = url;
  audioState.musicElement = audio;
  void audio.play().catch(() => undefined);
}

function stopMusicTrack() {
  if (audioState.musicElement) {
    audioState.musicElement.pause();
    audioState.musicElement.src = "";
    audioState.musicElement = null;
  }

  if (audioState.musicUrl) {
    URL.revokeObjectURL(audioState.musicUrl);
    audioState.musicUrl = "";
  }
}

function createMusicLoopUrl() {
  const sampleRate = 22050;
  const duration = 12;
  const totalSamples = sampleRate * duration;
  const samples = new Int16Array(totalSamples);
  const notes = [196, 220, 246.94, 293.66, 329.63, 293.66, 246.94, 220];

  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / sampleRate;
    const beat = time % 1.5;
    const noteIndex = Math.floor(time / 1.5) % notes.length;
    const noteFrequency = notes[noteIndex];
    const noteEnvelope = Math.max(0, 1 - beat / 1.2);
    const pulse = beat < 0.18 ? Math.sin(2 * Math.PI * (86 - beat * 180) * time) * (1 - beat / 0.18) : 0;
    const drone = Math.sin(2 * Math.PI * 55 * time) * 0.2 + Math.sin(2 * Math.PI * 82.41 * time) * 0.14;
    const melody = Math.sin(2 * Math.PI * noteFrequency * time) * noteEnvelope * 0.26;
    const rain = (Math.random() * 2 - 1) * 0.025;
    const value = Math.max(-1, Math.min(1, drone + melody + pulse * 0.42 + rain));
    samples[index] = Math.round(value * 32767);
  }

  return URL.createObjectURL(new Blob([createWavBuffer(samples, sampleRate)], { type: "audio/wav" }));
}

function createWavBuffer(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(44 + index * 2, samples[index], true);
  }

  return buffer;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function playMusicNote() {
  const context = audioState.audioContext;
  const music = audioState.music;
  if (!context || !music || context.state === "suspended") return;

  const notes = [196, 220, 246.94, 293.66, 329.63, 293.66, 246.94, 220];
  const frequency = notes[audioState.noteIndex % notes.length];
  audioState.noteIndex += 1;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const now = context.currentTime;

  oscillator.type = audioState.noteIndex % 3 === 0 ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, now + 1.25);
  filter.type = "lowpass";
  filter.frequency.value = 1320;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.055, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.08);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(music.melodyBus);
  oscillator.start(now);
  oscillator.stop(now + 1.25);
}

function playMusicPulse() {
  const context = audioState.audioContext;
  const music = audioState.music;
  if (!context || !music || context.state === "suspended") return;

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(92, now);
  oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.18);
  filter.type = "lowpass";
  filter.frequency.value = 180;
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(music.pulseBus);
  oscillator.start(now);
  oscillator.stop(now + 0.26);
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  updateCameraShot(localState.current?.activeSession?.phase || "idle");
}

function animate() {
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastFrameTime) / 1000);
  const elapsed = now / 1000;
  lastFrameTime = now;
  updateRenderPerformance(delta, now);

  groups.actions.children.forEach((marker, index) => {
    marker.position.y = marker.userData.restY || 0.532;
    marker.children.forEach((child) => {
      if (child.userData.glow && child.material?.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity = 0.16 + Math.sin(elapsed * 1.8 + index) * 0.035;
      }
    });
  });

  minis.party.group.rotation.y = Math.sin(elapsed * 1.15) * 0.035;
  if (minis.enemy.group.visible) {
    minis.enemy.group.rotation.y = Math.sin(elapsed * 1.35) * 0.045;
  }
  if (localState.orbitMode) {
    orbitControls.update();
    cameraState.currentLookAt.copy(orbitControls.target);
    cameraState.targetLookAt.copy(orbitControls.target);
    cameraState.targetPosition.copy(camera.position);
  } else {
    camera.position.lerp(cameraState.targetPosition, 1 - Math.pow(0.002, delta));
    cameraState.currentLookAt.lerp(cameraState.targetLookAt, 1 - Math.pow(0.002, delta));
    camera.lookAt(cameraState.currentLookAt);
  }
  updatePulses(delta);
  updateFloaters(delta);
  updateRain(delta);
  updateStorm(delta, elapsed);
  assetState.mixers.forEach((mixer) => mixer.update(delta));
  updateProjectedLabels();

  if (performance.now() < dice.rollingUntil) {
    dice.group.rotation.x += delta * 9;
    dice.group.rotation.y += delta * 12;
  }
  if (performance.now() < (dice.group.userData.impactUntil || 0)) {
    const remaining = (dice.group.userData.impactUntil - performance.now()) / 980;
    const scale = 1 + Math.sin(remaining * Math.PI * 4) * 0.035 * remaining;
    dice.group.scale.setScalar(scale);
  } else if (dice.group.scale.x !== 1) {
    dice.group.scale.setScalar(1);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateFloaters(delta) {
  localState.floaters = localState.floaters.filter((floater) => {
    floater.userData.age += delta;
    floater.position.addScaledVector(floater.userData.velocity, delta);
    const progress = floater.userData.age / floater.userData.life;
    floater.material.opacity = Math.max(0, 1 - progress);
    floater.scale.multiplyScalar(1 + delta * 0.18);

    if (progress < 1) return true;
    floater.removeFromParent();
    floater.material.map?.dispose();
    floater.material.dispose();
    return false;
  });
}

function updateRain(delta) {
  if (!fxState.rain) return;

  fxState.rainOffsets.forEach((drop, index) => {
    drop.y -= drop.speed * delta;
    drop.x -= 0.12 * delta;

    if (drop.y < 1.25) {
      drop.y = 6.8;
      drop.x = -8.1 + ((index * 37) % 162) / 10;
    }

    scratch.rainPosition.set(drop.x, drop.y, drop.z);
    scratch.rainMatrix.compose(scratch.rainPosition, scratch.rainQuaternion, scratch.rainScale);
    fxState.rain.setMatrixAt(index, scratch.rainMatrix);
  });

  fxState.rain.instanceMatrix.needsUpdate = true;
}

function updateRenderPerformance(delta, now) {
  renderPerf.frameAvg = renderPerf.frameAvg * 0.94 + delta * 0.06;
  if (now < renderPerf.nextReviewAt) return;

  renderPerf.nextReviewAt = now + 850;
  const stressed = renderPerf.frameAvg > 1 / 42;
  const relaxed = renderPerf.frameAvg < 1 / 55;
  let nextDpr = renderPerf.currentDpr;

  if (stressed) {
    nextDpr = Math.max(1, renderPerf.currentDpr - 0.25);
  } else if (relaxed) {
    nextDpr = Math.min(renderPerf.initialDpr, renderPerf.currentDpr + 0.1);
  }

  if (Math.abs(nextDpr - renderPerf.currentDpr) >= 0.05) {
    renderPerf.currentDpr = Number(nextDpr.toFixed(2));
    renderer.setPixelRatio(renderPerf.currentDpr);
  }

  const quality = renderPerf.currentDpr >= renderPerf.initialDpr - 0.05
    ? "High"
    : renderPerf.currentDpr > 1.15
      ? "Balanced"
      : "Fast";

  renderPerf.quality = quality;

  if (renderStatus) {
    renderStatus.textContent = `Render ${renderPerf.quality}`;
    renderStatus.title = `${Math.round(1 / renderPerf.frameAvg)} FPS estimate, ${renderPerf.currentDpr.toFixed(2)}x DPR`;
  }
}

function updateStorm(delta, elapsed) {
  if (!tableObjects.stormFlash) return;

  if (elapsed >= fxState.nextLightningAt && fxState.lightningAge >= fxState.lightningLife) {
    fxState.lightningAge = 0;
    fxState.lightningLife = 0.48 + Math.random() * 0.22;
    fxState.nextLightningAt = elapsed + 5.5 + Math.random() * 9;
    window.setTimeout(() => playCue("thunder"), 260);
  }

  if (fxState.lightningAge < fxState.lightningLife) {
    fxState.lightningAge += delta;
    const progress = fxState.lightningAge / fxState.lightningLife;
    const primaryFlash = Math.sin(progress * Math.PI);
    const stutter = progress > 0.38 && progress < 0.58 ? 0.55 : 0;
    tableObjects.stormFlash.intensity = (primaryFlash + stutter) * 3.8;
    return;
  }

  tableObjects.stormFlash.intensity = 0;
}

function updatePulses(delta) {
  localState.pulses = localState.pulses.filter((pulse) => {
    pulse.userData.age += delta;
    const progress = pulse.userData.age / pulse.userData.life;
    pulse.scale.multiplyScalar(1 + delta * 1.9);
    pulse.userData.material.opacity = Math.max(0, 0.8 * (1 - progress));
    if (progress < 1) return true;
    pulse.removeFromParent();
    pulse.userData.geometries.forEach((geometry) => geometry.dispose());
    pulse.userData.material.dispose();
    return false;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
