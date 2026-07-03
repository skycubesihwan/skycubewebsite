const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const balanceEl = document.getElementById("balance");
const routeCostEl = document.getElementById("routeCost");
const statusText = document.getElementById("statusText");
const phasePill = document.getElementById("phasePill");
const ledger = document.getElementById("floatingLedger");
const gameShell = document.querySelector(".game-shell");
const topbar = document.querySelector(".topbar");

const START_MONEY = 500;
const ENDING_MONEY = 1000;
const WORLD = { width: 1280, height: 660 };
const GROUND_Y = 586;
const ZONE_HEIGHT = 29;
const ZONE_GAP = 3;
const ZONE_STEP = ZONE_HEIGHT + ZONE_GAP;
const AIRSPACE_TOP_Y = 16;
const PAD_AIR_BOTTOM_Y = GROUND_Y - 68;
const CELL_MS = 750;
const BOARD_MS = 900;
const DEBOARD_MS = 1250;
const AUTO_NEXT_MS = 1300;
const AD_RESERVED_CELLS = 4;
const AD_LEVEL_MIN = 4;
const AD_LEVEL_MAX = 7;
const RESERVATION_HORIZON = 80;
const DRONE_MAX_STEPS = 40;

const PORTS = [
  { id: "gadukdo", columnId: "left-port", label: "부산가덕도", shortLabel: "가덕도", kind: "airport" },
  { id: "bifc", columnId: "data-dome", label: "BIFC", shortLabel: "BIFC", kind: "rooftop" },
  { id: "yonggungsa", columnId: "right-port", label: "용궁사", shortLabel: "용궁사", kind: "temple" }
];

const AIRSPACE_LAYER_TYPES = [
  { altitude: 100, type: "public" },
  { altitude: 90, type: "public" },
  { altitude: 80, type: "public" },
  { altitude: 70, type: "public" },
  { altitude: 60, type: "private" },
  { altitude: 50, type: "private" },
  { altitude: 40, type: "private" },
  { altitude: 30, type: "private" }
];

const AIRSPACE_LAYERS = AIRSPACE_LAYER_TYPES.map((layer, index) => ({
  ...layer,
  y: AIRSPACE_TOP_Y + index * ZONE_STEP
}));

const columnPlans = [
  { id: "left-port", name: "부산가덕도", x: 78, w: 116, h: 0, toll: 1, isPad: true },
  { id: "east-tower", name: "부산타워", x: 210, w: 96, h: 142, toll: 1 },
  { id: "plaza", name: "엘시티", x: 320, w: 118, h: 248, toll: 2 },
  { id: "market", name: "롯데 호텔", x: 455, w: 92, h: 172, toll: 1 },
  { id: "data-dome", name: "BIFC", x: 565, w: 130, h: 285, toll: 3 },
  { id: "bank", name: "마린시티", x: 718, w: 105, h: 224, toll: 2 },
  { id: "hotel", name: "센텀시티", x: 840, w: 122, h: 276, toll: 4 },
  { id: "west-office", name: "영화의전당", x: 985, w: 104, h: 150, toll: 1 },
  { id: "right-port", name: "용궁사", x: 1118, w: 116, h: 0, toll: 1, isPad: true }
];

const zonePalette = {
  1: { fill: "#74b7de", stroke: "#2f78a7" },
  2: { fill: "#8bc98f", stroke: "#3e8845" },
  3: { fill: "#d9b34a", stroke: "#9c7419" },
  4: { fill: "#bd776f", stroke: "#97433b" },
  public: { fill: "#75b9ee", stroke: "#2d75ad" },
  reserved: { fill: "#9ca7ad", stroke: "#607078" }
};

let state = createGame();
let lastTime = performance.now();

function fitGameShellToViewport() {
  if (!gameShell || !topbar) return;

  gameShell.style.setProperty("--game-shell-width", `${Math.max(320, window.innerWidth - 28)}px`);
  window.requestAnimationFrame(() => {
    const shellStyle = window.getComputedStyle(gameShell);
    const paddingY = parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom);
    const gap = parseFloat(shellStyle.rowGap || shellStyle.gap) || 0;
    const sideMargin = window.matchMedia("(max-width: 900px)").matches ? 18 : 28;
    const availableWidth = Math.max(320, window.innerWidth - sideMargin);
    const availableHeight = Math.max(320, window.innerHeight - paddingY - topbar.getBoundingClientRect().height - gap - 6);
    const widthByHeight = availableHeight * (WORLD.width / WORLD.height);
    const fittedWidth = Math.max(320, Math.min(availableWidth, widthByHeight));
    gameShell.style.setProperty("--game-shell-width", `${Math.floor(fittedWidth)}px`);
  });
}

function createGame() {
  const game = {
    turn: 1,
    direction: 1,
    money: START_MONEY,
    columns: buildColumns(),
    phase: "choosing",
    currentPortId: "gadukdo",
    destinationPortId: null,
    passengerOffers: [],
    selectedOffer: null,
    route: [],
    taxi: { x: 0, y: 0, rotor: 0 },
    flight: null,
    ad: null,
    drone: null,
    reservations: [],
    pathGlow: 0,
    autoNextAt: null
  };
  startTurn(game, "gadukdo");
  return game;
}

function buildColumns() {
  return columnPlans.map((plan, columnIndex) => {
    const layers = layersForPlan(plan);
    const zones = layers.map((layer, levelIndex) => {
      return {
        id: `${plan.id}-${levelIndex}`,
        columnId: plan.id,
        columnIndex,
        columnName: plan.name,
        levelIndex,
        altitude: layer.altitude,
        type: layer.type,
        toll: randomTollForType(layer.type),
        x: plan.x - 8,
        y: layer.y,
        w: plan.w + 16,
        h: ZONE_HEIGHT,
        selected: false,
        paid: false
      };
    });
    return { ...plan, columnIndex, zones };
  });
}

function layersForPlan(plan) {
  const roofY = plan.isPad ? PAD_AIR_BOTTOM_Y : GROUND_Y - plan.h;
  const layers = [...AIRSPACE_LAYERS];
  let y = AIRSPACE_LAYERS[AIRSPACE_LAYERS.length - 1].y + ZONE_STEP;
  while (y + ZONE_HEIGHT <= roofY - 4) {
    const depth = layers.length - AIRSPACE_LAYERS.length + 1;
    layers.push({ altitude: 10 - depth * 10, type: "private", y });
    y += ZONE_STEP;
  }
  return layers;
}

function startTurn(game, startPortId) {
  const adStartZone = currentAdZone(game);
  game.currentPortId = startPortId;
  game.destinationPortId = null;
  game.direction = 1;
  game.phase = "choosing";
  game.passengerOffers = createPassengerOffers(game, startPortId);
  game.selectedOffer = null;
  game.route = [];
  game.flight = null;
  game.drone = null;
  game.reservations = [];
  game.pathGlow = 0;
  game.autoNextAt = null;
  game.columns.forEach((column) => {
    column.zones.forEach((zone) => {
      zone.selected = false;
      zone.paid = false;
      zone.toll = randomTollForType(zone.type, zone.toll);
    });
  });
  setupAdBalloon(game, adStartZone);
  setupDeliveryDrone(game);
  const start = portById(startPortId, game);
  const startPos = portTaxiPosition(start, game);
  game.taxi.x = startPos.x;
  game.taxi.y = startPos.y;
}

function currentAdZone(game) {
  if (!game.ad) return null;
  return game.ad.currentZone || game.ad.path?.[game.ad.stepIndex] || null;
}

function setupAdBalloon(game, preferredStartZone = null) {
  const continuedPath = buildContinuedAdPath(game, preferredStartZone);
  const path = continuedPath || buildRandomAdPath(game);
  if (!path?.length) {
    game.ad = null;
    return;
  }
  reserveAdSchedule(game, path);

  const first = zoneCenter(path[0]);
  game.ad = {
    path,
    points: path.map(zoneCenter),
    x: first.x,
    y: first.y,
    stepIndex: 0,
    direction: adPathDirection(path),
    currentZone: path[0]
  };
}

function reserveAdSchedule(game, path) {
  for (let time = 0; time < RESERVATION_HORIZON; time += 1) {
    reserveTimeSlot(game, "ad", adZoneAtTime(path, time), time);
  }
}

function adZoneAtTime(path, time) {
  if (!path?.length) return null;
  const movement = pingPongStep(Math.floor(time / 2), path.length);
  return path[movement.index];
}

function reserveTimeSlot(game, source, zone, time) {
  if (!zone || time < 0) return;
  game.reservations.push({ source, zone, zoneId: zone.id, time });
}

function reservationsAt(zone, time, game = state) {
  return game.reservations.filter((reservation) => reservation.zone === zone && reservation.time === time);
}

function hasTimeReservation(zone, time, game = state) {
  return reservationsAt(zone, time, game).length > 0;
}

function setupDeliveryDrone(game) {
  const columns = deliveryColumns(game);
  const options = [];

  columns.forEach((origin) => {
    columns.forEach((destination) => {
      if (origin === destination) return;
      if (Math.abs(destination.columnIndex - origin.columnIndex) < 2) return;
      const path = buildTimedPath(game, bottomZone(origin), bottomZone(destination), {
        maxSteps: DRONE_MAX_STEPS,
        avoidReservations: true,
        avoidVertiports: true
      });
      if (path) options.push({ origin, destination, path });
    });
  });

  const plan = options[Math.floor(Math.random() * options.length)];
  if (!plan) return;

  plan.path.forEach((zone, time) => reserveTimeSlot(game, "drone", zone, time));
  const first = zoneCenter(plan.path[0]);
  game.drone = {
    originId: plan.origin.id,
    destinationId: plan.destination.id,
    path: plan.path,
    points: plan.path.map(zoneCenter),
    x: first.x,
    y: first.y,
    direction: dronePathDirection(plan.path),
    currentZone: plan.path[0],
    stepIndex: 0
  };
}

function deliveryColumns(game = state) {
  return game.columns.filter((column) => !column.isPad && column.id !== "data-dome");
}

function buildTimedPath(game, start, end, options = {}) {
  const maxSteps = options.maxSteps || DRONE_MAX_STEPS;
  const queue = [{ zone: start, time: 0 }];
  const startKey = timedKey(start, 0);
  const previous = new Map([[startKey, null]]);
  const byKey = new Map([[startKey, { zone: start, time: 0 }]]);

  while (queue.length) {
    const current = queue.shift();
    const currentKey = timedKey(current.zone, current.time);
    if (current.zone === end) return rebuildTimedPath(currentKey, previous, byKey);
    if (current.time >= maxSteps) continue;

    timedNeighbors(game, current.zone, end, options).forEach((zone) => {
      const nextTime = current.time + 1;
      if (options.avoidReservations && hasTimeReservation(zone, nextTime, game)) return;
      const key = timedKey(zone, nextTime);
      if (previous.has(key)) return;
      previous.set(key, currentKey);
      byKey.set(key, { zone, time: nextTime });
      queue.push({ zone, time: nextTime });
    });
  }

  return null;
}

function timedNeighbors(game, zone, end, options) {
  const neighbors = [
    zoneAtIndex(game, zone.columnIndex + 1, zone.levelIndex),
    zoneAtIndex(game, zone.columnIndex - 1, zone.levelIndex),
    zoneAtIndex(game, zone.columnIndex, zone.levelIndex + 1),
    zoneAtIndex(game, zone.columnIndex, zone.levelIndex - 1),
    zone
  ].filter(Boolean);

  return neighbors.filter((candidate) => {
    if (candidate === end) return true;
    return !(options.avoidVertiports && isVertiportTerminalZone(candidate, game));
  });
}

function timedKey(zone, time) {
  return `${zone.id}@${time}`;
}

function rebuildTimedPath(endKey, previous, byKey) {
  const path = [];
  for (let key = endKey; key; key = previous.get(key)) {
    path.push(byKey.get(key).zone);
  }
  return path.reverse();
}

function isVertiportTerminalZone(zone, game = state) {
  return PORTS.some((port) => {
    const column = columnForPort(port, game);
    return column && bottomZone(column) === zone;
  });
}

function dronePathDirection(path) {
  if (!path || path.length < 2) return 1;
  const next = path.find((zone) => zone !== path[0]) || path[1];
  return zoneCenter(next).x >= zoneCenter(path[0]).x ? 1 : -1;
}

function buildContinuedAdPath(game, startZone) {
  if (!isAdCruiseZone(startZone)) return null;
  const path = buildAdPath(game, startZone);
  return path.length >= AD_RESERVED_CELLS ? path : null;
}

function buildRandomAdPath(game) {
  const candidates = [];
  game.columns.forEach((column) => {
    if (isSidePortColumnId(column.id)) return;
    column.zones.forEach((zone) => {
      if (!isAdCruiseZone(zone)) return;
      const path = buildAdPath(game, zone);
      if (path.length >= AD_RESERVED_CELLS) candidates.push(path);
    });
  });

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function buildAdPath(game, startZone) {
  if (!isAdCruiseZone(startZone)) return [];
  const directions = Math.random() < 0.5 ? [1, -1] : [-1, 1];

  for (const direction of directions) {
    const path = [startZone];
    for (let step = 1; step < AD_RESERVED_CELLS; step += 1) {
      const zone = zoneAtIndex(game, startZone.columnIndex + direction * step, startZone.levelIndex);
      if (!isAdCruiseZone(zone)) break;
      path.push(zone);
    }
    if (path.length >= AD_RESERVED_CELLS) return path;
  }

  return [];
}

function isAdCruiseZone(zone) {
  return Boolean(zone)
    && !isSidePortColumnId(zone.columnId)
    && !(zone.columnId === "data-dome" && zone.levelIndex === AD_LEVEL_MAX)
    && zone.type === "private"
    && zone.levelIndex >= AD_LEVEL_MIN
    && zone.levelIndex <= AD_LEVEL_MAX;
}

function adPathDirection(path) {
  if (!path || path.length < 2) return 1;
  return zoneCenter(path[1]).x >= zoneCenter(path[0]).x ? 1 : -1;
}

function isSidePortColumnId(columnId) {
  return columnId === "left-port" || columnId === "right-port";
}

function zoneAtIndex(game, columnIndex, levelIndex) {
  const column = game.columns[columnIndex] || null;
  return column?.zones?.[levelIndex] || null;
}

function portById(portId, game = state) {
  const meta = PORTS.find((port) => port.id === portId);
  if (!meta) return null;
  const position = portTaxiPosition(meta, game);
  return { ...meta, ...position };
}

function columnForPort(port, game = state) {
  return game.columns.find((column) => column.id === port.columnId);
}

function portTaxiPosition(port, game = state) {
  const column = columnForPort(port, game);
  const centerX = column.x + column.w / 2;
  if (column.isPad) {
    return { x: centerX, y: GROUND_Y - 52 };
  }
  return { x: centerX, y: GROUND_Y - column.h - 7 };
}

function portPadOrigin(port, game = state) {
  const column = columnForPort(port, game);
  const centerX = column.x + column.w / 2;
  if (column.isPad) {
    return { x: column.x, y: GROUND_Y - 22 };
  }
  return { x: centerX - 58, y: GROUND_Y - column.h - 22 };
}

function createPassengerOffers(game, startPortId) {
  return PORTS
    .filter((port) => port.id !== startPortId)
    .map((destination, index) => {
      const close = startPortId === "bifc" || destination.id === "bifc";
      const fare = close ? randomFare(150, 250) : randomFare(200, 300);
      return {
        id: `offer-${game.turn}-${index}-${destination.id}`,
        destinationId: destination.id,
        destinationLabel: destination.label,
        fare,
        close
      };
    });
}

function randomFare(min, max) {
  const steps = (max - min) / 10;
  return min + Math.floor(Math.random() * (steps + 1)) * 10;
}

function randomTollForType(type, previous = null) {
  const range = type === "public" ? { min: 1, max: 2 } : { min: 2, max: 4 };
  if (typeof previous !== "number") {
    return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
  }

  const candidates = [];
  for (let toll = previous - 1; toll <= previous + 1; toll += 1) {
    if (toll >= range.min && toll <= range.max) candidates.push(toll);
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function moneyText(value) {
  return `${value}원`;
}

function startPad() {
  return portById(state.currentPortId);
}

function endPad() {
  return state.destinationPortId ? portById(state.destinationPortId) : startPad();
}

function startColumn() {
  return columnForPort(startPad());
}

function endColumn() {
  return columnForPort(endPad());
}

function bottomZone(column) {
  return column.zones[column.zones.length - 1];
}

function startZone() {
  return bottomZone(startColumn());
}

function destinationZone() {
  return bottomZone(endColumn());
}

function selectedRoute() {
  return state.route;
}

function activeRoute() {
  return state.phase === "selecting" ? selectedRoute() : state.route;
}

function effectiveToll(zone) {
  return zone.toll;
}

function routeCost(route = selectedRoute()) {
  return route.reduce((sum, zone) => sum + effectiveToll(zone), 0);
}

function routeFare() {
  return state.selectedOffer?.fare || state.flight?.fare || 0;
}

function isCompleteRoute(route = selectedRoute()) {
  if (!route.length || !state.selectedOffer || !state.destinationPortId) return false;
  return route[0] === startZone()
    && route[route.length - 1] === destinationZone()
    && route.every((zone, index) => index === 0 || areAdjacent(route[index - 1], zone));
}

function areAdjacent(a, b) {
  const sameColumn = a.columnIndex === b.columnIndex && Math.abs(a.levelIndex - b.levelIndex) === 1;
  const sameLevel = a.levelIndex === b.levelIndex && Math.abs(b.columnIndex - a.columnIndex) === 1;
  return sameColumn || sameLevel;
}

function canAppendZone(zone) {
  if (!state.selectedOffer) return false;
  if (!state.route.length) return zone === startZone();
  if (state.route.includes(zone)) return true;
  const time = state.route.length;
  return areAdjacent(state.route[state.route.length - 1], zone) && !hasTimeReservation(zone, time);
}

function routeReservationConflict(route = selectedRoute()) {
  return route.find((zone, time) => hasTimeReservation(zone, time)) || null;
}

function nextRouteTime() {
  return state.route.length;
}

function reservationSourceLabel(source) {
  return source === "drone" ? "배달드론" : "AD 벌룬";
}

function updateHud() {
  const route = selectedRoute();
  const cost = routeCost(route);
  const fare = routeFare();
  const start = startPad();
  const destination = endPad();

  balanceEl.textContent = moneyText(state.money);
  routeCostEl.textContent = moneyText(cost);

  if (state.phase === "choosing") {
    phasePill.textContent = `턴 ${state.turn}`;
    statusText.textContent = `${start.label}에서 출발합니다. UAM 좌우의 탑승객 중 한 명을 선택하세요.`;
  }

  if (state.phase === "selecting") {
    phasePill.textContent = `턴 ${state.turn}`;
    if (cost > state.money) {
      statusText.textContent = "현재 통행료가 보유금보다 큽니다. 지나온 칸으로 돌아가 경로를 줄여주세요.";
    } else if (isCompleteRoute(route)) {
      statusText.textContent = `${destination.label}까지 항로가 연결됐습니다. UAM이 곧 출발합니다.`;
    } else if (route.length <= 1) {
      statusText.textContent = `출발칸은 t0로 자동 선택됐습니다. ${destination.label} 도착칸까지 t1, t2 순서로 이어주세요.`;
    } else {
      statusText.textContent = `${destination.label} 도착칸까지 이어가세요. 다음 선택은 t${route.length}이며, 같은 칸도 다른 시간이면 예약할 수 있습니다.`;
    }
  }

  if (state.phase === "boarding") {
    phasePill.textContent = "탑승 중";
    statusText.textContent = "승객이 UAM에 탑승하고 있습니다.";
  }

  if (state.phase === "flying") {
    phasePill.textContent = "비행 중";
    statusText.textContent = "UAM이 각 공중권 칸을 지나는 순간 해당 통행료가 결제됩니다.";
  }

  if (state.phase === "deboarding") {
    phasePill.textContent = "하차 중";
    statusText.textContent = "도착 버티포트에서 승객이 내리고 있습니다.";
  }

  if (state.phase === "complete") {
    phasePill.textContent = "도착 완료";
    statusText.textContent = `${destination.label} 버티포트에 도착하고 운임 ${state.flight?.fare || fare}원을 받았습니다. 다음 탑승객을 준비합니다.`;
  }

  if (state.phase === "ended") {
    phasePill.textContent = "전문가";
    statusText.textContent = "축하합니다! 당신은 이제 에어택시 전문가입니다!";
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * WORLD.width,
    y: ((clientY - rect.top) / rect.height) * WORLD.height
  };
}

function selectPassenger(offerId) {
  if (state.phase !== "choosing" && state.phase !== "selecting") return;
  const offer = state.passengerOffers.find((candidate) => candidate.id === offerId);
  if (!offer) return;
  state.selectedOffer = offer;
  state.destinationPortId = offer.destinationId;
  state.direction = Math.sign(endColumn().columnIndex - startColumn().columnIndex) || 1;
  state.phase = "selecting";
  state.route.forEach((zone) => {
    zone.selected = false;
    zone.paid = false;
  });
  const firstZone = startZone();
  firstZone.selected = true;
  state.route = [firstZone];
  state.pathGlow = 1;
  updateHud();
  draw();
}

function zoneAt(point) {
  for (const column of state.columns) {
    const zone = column.zones.find((candidate) => {
      return point.x >= candidate.x
        && point.x <= candidate.x + candidate.w
        && point.y >= candidate.y
        && point.y <= candidate.y + candidate.h;
    });
    if (zone) return zone;
  }
  return null;
}

function handleRoutePointer(event) {
  if (state.phase !== "selecting") return;
  const zone = zoneAt(canvasPoint(event));
  if (!zone) return;
  advanceRouteToZone(zone);
}

function advanceRouteToZone(zone) {
  const existingIndex = state.route.indexOf(zone);
  if (existingIndex >= 0) {
    if (existingIndex === state.route.length - 1) return;
    const removed = state.route.splice(existingIndex + 1);
    removed.forEach((item) => {
      item.selected = false;
      item.paid = false;
    });
    zone.selected = true;
    state.pathGlow = 1;
    updateHud();
    draw();
    return;
  }

  const time = nextRouteTime();
  const reservation = reservationsAt(zone, time)[0];
  if (reservation) {
    phasePill.textContent = `t${time} 예약`;
    statusText.textContent = `${reservationSourceLabel(reservation.source)}이 t${time}에 이 공중공간을 예약했습니다. 다른 시간에 지나가거나 우회하세요.`;
    state.pathGlow = 1;
    draw();
    return;
  }

  if (!canAppendZone(zone)) {
    phasePill.textContent = "연결 불가";
    statusText.textContent = "대각선 이동은 불가합니다. 현재 칸의 위/아래 또는 좌/우 바로 옆 칸을 선택하세요.";
    state.pathGlow = 1;
    draw();
    return;
  }

  zone.selected = true;
  state.route.push(zone);
  state.pathGlow = 1;
  updateHud();
  draw();
  if (isCompleteRoute()) {
    confirmRoute();
  }
}

function popMoney(text, worldX, worldY, gain = false) {
  const rect = canvas.getBoundingClientRect();
  const node = document.createElement("div");
  node.className = `money-pop${gain ? " gain" : ""}`;
  node.textContent = text;
  node.style.left = `${(worldX / WORLD.width) * rect.width}px`;
  node.style.top = `${(worldY / WORLD.height) * rect.height}px`;
  ledger.appendChild(node);
  window.setTimeout(() => node.remove(), 980);
}

function canLaunchRoute(route = selectedRoute()) {
  return state.phase === "selecting"
    && state.selectedOffer
    && isCompleteRoute(route)
    && !routeReservationConflict(route)
    && routeCost(route) <= state.money;
}

function confirmRoute() {
  const route = selectedRoute();
  if (!canLaunchRoute(route)) {
    updateHud();
    return;
  }
  state.phase = "boarding";
  state.route = [...route];
  state.flight = {
    startedAt: performance.now(),
    nextStepAt: performance.now() + BOARD_MS,
    fare: routeFare(),
    stepIndex: -1,
    paidZones: new Set()
  };
  updateHud();
}

function zoneCenter(zone) {
  return {
    x: zone.x + zone.w * 0.5,
    y: zone.y + zone.h * 0.5
  };
}

function beginNextTurn() {
  state.turn += 1;
  startTurn(state, state.destinationPortId || state.currentPortId);
  updateHud();
  draw();
}

function isFlightPhase(phase = state.phase) {
  return phase === "boarding" || phase === "flying" || phase === "deboarding";
}

function tick(time) {
  const delta = Math.min(48, time - lastTime);
  lastTime = time;
  state.taxi.rotor += delta * 0.018;
  state.pathGlow = Math.max(0, state.pathGlow - delta * 0.0022);

  if (isFlightPhase() && state.flight) {
    while (time >= state.flight.nextStepAt && isFlightPhase()) {
      advanceFlightStep(time);
    }
  }

  if (state.phase === "complete" && state.autoNextAt && time >= state.autoNextAt) {
    beginNextTurn();
  }

  updateAdPosition();
  updateDronePosition();
  draw();
  requestAnimationFrame(tick);
}

function advanceFlightStep(time) {
  if (state.phase === "boarding") {
    state.phase = "flying";
  }

  if (state.phase === "flying") {
    if (state.flight.stepIndex < state.route.length - 1) {
      state.flight.stepIndex += 1;
      const zone = state.route[state.flight.stepIndex];
      const center = zoneCenter(zone);
      state.taxi.x = center.x;
      state.taxi.y = center.y;
      payForZone(zone);
      state.flight.nextStepAt += CELL_MS;
      updateHud();
      return;
    }

    const endPos = portTaxiPosition(endPad());
    state.taxi.x = endPos.x;
    state.taxi.y = endPos.y;
    state.phase = "deboarding";
    state.flight.nextStepAt = time + DEBOARD_MS;
    updateHud();
    return;
  }

  if (state.phase === "deboarding") {
    state.money += state.flight.fare;
    if (state.money > ENDING_MONEY) {
      state.phase = "ended";
      state.autoNextAt = null;
    } else {
      state.phase = "complete";
      state.autoNextAt = time + AUTO_NEXT_MS;
    }
    state.flight.nextStepAt = Infinity;
    popMoney(`+${state.flight.fare}원`, state.taxi.x, state.taxi.y - 54, true);
    updateHud();
  }
}

function payForZone(zone) {
  if (state.flight.paidZones.has(zone.id)) return;
  state.flight.paidZones.add(zone.id);
  zone.paid = true;
  const toll = effectiveToll(zone);
  state.money -= toll;
  const center = zoneCenter(zone);
  popMoney(`-${toll}원`, center.x, center.y - 16);
}

function updateAdPosition() {
  if (!state.ad) return;
  const time = activeSimulationTime();
  const movement = state.phase === "flying" || state.phase === "deboarding" || state.phase === "complete"
    ? pingPongStep(Math.floor(time / 2), state.ad.points.length)
    : { index: state.ad.stepIndex, direction: state.ad.direction };

  const nextIndex = movement.direction >= 0
    ? Math.min(movement.index + 1, state.ad.points.length - 1)
    : Math.max(movement.index - 1, 0);
  const dx = state.ad.points[nextIndex].x - state.ad.points[movement.index].x;
  state.ad.stepIndex = movement.index;
  state.ad.direction = dx === 0 ? state.ad.direction : Math.sign(dx);
  state.ad.currentZone = state.ad.path[movement.index];
  state.ad.x = state.ad.points[movement.index].x;
  state.ad.y = state.ad.points[movement.index].y;
}

function updateDronePosition() {
  if (!state.drone) return;
  const time = activeSimulationTime();
  const index = state.phase === "flying" || state.phase === "deboarding" || state.phase === "complete"
    ? Math.min(time, state.drone.points.length - 1)
    : 0;
  const nextIndex = Math.min(index + 1, state.drone.points.length - 1);
  const dx = state.drone.points[nextIndex].x - state.drone.points[index].x;
  state.drone.stepIndex = index;
  state.drone.direction = dx === 0 ? state.drone.direction : Math.sign(dx);
  state.drone.currentZone = state.drone.path[index];
  state.drone.x = state.drone.points[index].x;
  state.drone.y = state.drone.points[index].y;
}

function activeSimulationTime() {
  if (!state.flight) return 0;
  return Math.max(0, state.flight.stepIndex);
}

function pingPongStep(moveCount, length) {
  if (length <= 1) return { index: 0, direction: 1 };
  const cycle = (length - 1) * 2;
  const phase = moveCount % cycle;
  const index = phase <= length - 1 ? phase : cycle - phase;
  const direction = phase < length - 1 ? 1 : -1;
  return { index, direction };
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawSky();
  drawGround();
  drawRoute();
  drawColumns();
  drawTerminalMarkers();
  drawVertiports();
  if (state.phase === "choosing") drawWaitingPassengers();
  if (state.phase === "selecting" || state.phase === "boarding") drawPassenger();
  drawTaxi(state.taxi.x, state.taxi.y);
  if (state.phase === "deboarding") drawPassenger();
  if (state.phase === "ended") drawEndingScreen();
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, "#c8e6ef");
  sky.addColorStop(0.58, "#eef8fb");
  sky.addColorStop(1, "#dfe9ec");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = "rgba(93, 158, 222, 0.11)";
  ctx.fillRect(0, AIRSPACE_LAYERS[0].y - 6, WORLD.width, AIRSPACE_LAYERS[3].y + ZONE_HEIGHT);
  ctx.fillStyle = "rgba(95, 159, 71, 0.07)";
  ctx.fillRect(0, AIRSPACE_LAYERS[4].y - 2, WORLD.width, 300);
  drawCloud(210, 74, 0.78);
  drawCloud(870, 86, 0.62);
  drawCloud(1070, 126, 0.54);
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 48, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(42, 13, 35, 17, 0, 0, Math.PI * 2);
  ctx.ellipse(-36, 15, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoute() {
  const route = activeRoute();
  if (!route.length) return;
  ctx.save();
  ctx.strokeStyle = `rgba(15, 123, 118, ${0.58 + state.pathGlow * 0.25})`;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  route.forEach((zone, index) => {
    const center = zoneCenter(zone);
    if (index === 0) ctx.moveTo(center.x, center.y);
    else ctx.lineTo(center.x, center.y);
  });
  ctx.stroke();
  route.forEach((zone, index) => drawTimeTag(zone, index));
  ctx.restore();
}

function drawTimeTag(zone, time) {
  const center = zoneCenter(zone);
  const label = `t${time}`;
  const width = time < 10 ? 22 : 28;
  ctx.save();
  ctx.fillStyle = "rgba(12, 58, 61, 0.84)";
  roundRect(center.x - width / 2, center.y + 4, width, 13, 6);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 8px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, center.x, center.y + 14);
  ctx.restore();
}

function drawVertiports() {
  const gadukdo = portPadOrigin(portById("gadukdo"));
  const bifc = portPadOrigin(portById("bifc"));
  const yonggungsa = portPadOrigin(portById("yonggungsa"));
  drawAirportVertiport(gadukdo.x, gadukdo.y);
  drawBifcVertiport(bifc.x, bifc.y);
  drawTempleVertiport(yonggungsa.x, yonggungsa.y);
}

function drawGround() {
  const ground = ctx.createLinearGradient(0, GROUND_Y - 4, 0, WORLD.height);
  ground.addColorStop(0, "#d7e8df");
  ground.addColorStop(0.5, "#c9ded7");
  ground.addColorStop(1, "#b6ccd2");
  ctx.fillStyle = ground;
  ctx.fillRect(0, GROUND_Y - 4, WORLD.width, WORLD.height - GROUND_Y + 4);
  ctx.fillStyle = "rgba(67, 96, 90, 0.32)";
  ctx.fillRect(0, GROUND_Y - 4, WORLD.width, 5);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 18);
  for (let x = 0; x <= WORLD.width; x += 42) {
    ctx.quadraticCurveTo(x + 21, GROUND_Y + 12, x + 42, GROUND_Y + 18);
  }
  ctx.stroke();
}

function drawAirportVertiport(x, y) {
  drawAirportScene(x, y);
  drawVertiportPad(x, y, "#1f6974");
  drawPlaceLabel(x + 58, y + 62, "부산가덕도", "공항");
}

function drawTempleVertiport(x, y) {
  drawTempleScene(x - 4, y + 14);
  drawVertiportPad(x, y, "#6f7b2f");
  drawPlaceLabel(x + 58, y + 88, "용궁사", "");
}

function drawBifcVertiport(x, y) {
  ctx.save();
  const cx = x + 58;
  const cy = y + 22;
  ctx.fillStyle = "rgba(22, 42, 52, 0.22)";
  ctx.beginPath();
  ctx.moveTo(cx - 36, cy + 24);
  ctx.lineTo(cx + 36, cy + 24);
  ctx.lineTo(cx + 24, cy + 42);
  ctx.lineTo(cx - 24, cy + 42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(220, 237, 241, 0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy + 24);
  ctx.lineTo(cx - 16, cy + 42);
  ctx.moveTo(cx + 28, cy + 24);
  ctx.lineTo(cx + 16, cy + 42);
  ctx.stroke();
  ctx.restore();
  drawVertiportPad(x, y, "#245d8c");
}

function drawVertiportPad(x, y, color) {
  ctx.save();
  const cx = x + 58;
  const cy = y + 22;
  ctx.fillStyle = "rgba(35, 53, 61, 0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 24, 54, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  const side = ctx.createLinearGradient(0, cy, 0, cy + 26);
  side.addColorStop(0, "#d6e4e8");
  side.addColorStop(1, "#8aa4ad");
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy + 3);
  ctx.quadraticCurveTo(cx, cy + 22, cx + 52, cy + 3);
  ctx.lineTo(cx + 42, cy + 24);
  ctx.quadraticCurveTo(cx, cy + 39, cx - 42, cy + 24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(55, 80, 90, 0.46)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const deck = ctx.createLinearGradient(cx - 50, cy - 20, cx + 50, cy + 18);
  deck.addColorStop(0, "#ffffff");
  deck.addColorStop(0.42, "#e8f3f6");
  deck.addColorStop(1, "#b7ccd3");
  ctx.fillStyle = deck;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 57, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4c6670";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 32, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy);
  ctx.lineTo(cx + 14, cy);
  ctx.moveTo(cx, cy - 9);
  ctx.lineTo(cx, cy + 9);
  ctx.stroke();
  [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((angle, index) => {
    const lx = cx + Math.cos(angle) * 45;
    const ly = cy + Math.sin(angle) * 16;
    ctx.fillStyle = index % 2 === 0 ? "#f6c65b" : "#9be4f0";
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawAirportScene(x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(59, 82, 90, 0.14)";
  roundRect(x + 3, y + 46, 110, 14, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(x + 15, y + 53);
  ctx.lineTo(x + 102, y + 53);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#e0edf1";
  ctx.strokeStyle = "#597079";
  ctx.lineWidth = 2;
  roundRect(x + 12, y + 25, 34, 20, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#9ec8da";
  ctx.fillRect(x + 18, y + 30, 7, 6);
  ctx.fillRect(x + 29, y + 30, 7, 6);
  ctx.fillStyle = "#607681";
  ctx.fillRect(x + 87, y + 13, 9, 32);
  ctx.fillStyle = "#dceaf0";
  roundRect(x + 81, y + 7, 21, 12, 3);
  ctx.fill();
  ctx.restore();
}

function drawTempleScene(x, y) {
  ctx.save();

  const sea = ctx.createLinearGradient(x - 20, y + 48, x + 136, y + 96);
  sea.addColorStop(0, "rgba(79, 161, 181, 0.44)");
  sea.addColorStop(1, "rgba(34, 112, 142, 0.34)");
  ctx.fillStyle = sea;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 66);
  ctx.quadraticCurveTo(x + 24, y + 52, x + 62, y + 65);
  ctx.quadraticCurveTo(x + 99, y + 77, x + 132, y + 61);
  ctx.lineTo(x + 132, y + 98);
  ctx.lineTo(x - 12, y + 98);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 74);
  for (let wave = x - 6; wave < x + 126; wave += 22) {
    ctx.quadraticCurveTo(wave + 11, y + 68, wave + 22, y + 74);
  }
  ctx.stroke();

  ctx.fillStyle = "#747d70";
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 70);
  ctx.lineTo(x + 26, y + 42);
  ctx.lineTo(x + 51, y + 62);
  ctx.lineTo(x + 78, y + 38);
  ctx.lineTo(x + 118, y + 71);
  ctx.lineTo(x + 118, y + 91);
  ctx.lineTo(x + 1, y + 94);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#98a090";
  ctx.beginPath();
  ctx.arc(x + 26, y + 75, 13, 0, Math.PI * 2);
  ctx.arc(x + 58, y + 77, 17, 0, Math.PI * 2);
  ctx.arc(x + 94, y + 76, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(246, 249, 245, 0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 63);
  ctx.quadraticCurveTo(x + 33, y + 47, x + 61, y + 58);
  ctx.quadraticCurveTo(x + 91, y + 70, x + 115, y + 51);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let rail = 16; rail <= 108; rail += 10) {
    ctx.beginPath();
    ctx.moveTo(x + rail, y + 58);
    ctx.lineTo(x + rail, y + 66);
    ctx.stroke();
  }

  const bodyX = x + 29;
  const bodyY = y + 37;
  ctx.fillStyle = "#d74d3f";
  ctx.strokeStyle = "#6d3f35";
  ctx.lineWidth = 2;
  roundRect(bodyX, bodyY, 60, 29, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f1d6a0";
  ctx.fillRect(bodyX + 7, bodyY + 12, 9, 17);
  ctx.fillRect(bodyX + 25, bodyY + 12, 9, 17);
  ctx.fillRect(bodyX + 44, bodyY + 12, 9, 17);
  ctx.fillStyle = "#46a082";
  ctx.fillRect(bodyX + 2, bodyY + 6, 56, 4);

  ctx.fillStyle = "#253947";
  ctx.beginPath();
  ctx.moveTo(x + 15, y + 39);
  ctx.quadraticCurveTo(x + 58, y + 16, x + 102, y + 39);
  ctx.lineTo(x + 91, y + 50);
  ctx.quadraticCurveTo(x + 58, y + 33, x + 26, y + 50);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#182731";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "#c74b43";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 30, y + 45);
  ctx.lineTo(x + 86, y + 45);
  ctx.stroke();

  ctx.fillStyle = "#6fa464";
  ctx.beginPath();
  ctx.arc(x + 27, y + 31, 11, 0, Math.PI * 2);
  ctx.arc(x + 96, y + 32, 12, 0, Math.PI * 2);
  ctx.arc(x + 111, y + 42, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlaceLabel(x, y, primary, secondary) {
  ctx.save();
  ctx.fillStyle = "#23313a";
  ctx.font = "800 14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(primary, x, y);
  if (secondary) {
    ctx.font = "800 12px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#4b5d66";
    ctx.fillText(secondary, x, y + 16);
  }
  ctx.restore();
}

function drawColumns() {
  state.columns.forEach((column, index) => {
    if (!column.isPad) drawBuilding(column, index);
    drawZones(column);
  });
  drawAdObstacle();
  drawDeliveryDrone();
}

function drawBuilding(column, index) {
  const top = GROUND_Y - column.h;
  const face = ctx.createLinearGradient(column.x, top, column.x + column.w, top + column.h);
  face.addColorStop(0, index % 2 === 0 ? "#31424d" : "#3c4d57");
  face.addColorStop(0.58, index % 2 === 0 ? "#40535f" : "#475a64");
  face.addColorStop(1, "#22313a");
  ctx.fillStyle = index % 2 === 0 ? "#26353f" : "#2e3d47";
  ctx.fillRect(column.x + 11, top + 12, column.w, column.h - 12);
  ctx.fillStyle = face;
  roundRect(column.x, top, column.w, column.h, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(column.x + 8, top + 10, Math.max(6, column.w * 0.08), column.h - 28);
  drawWindows(column.x, top, column.w, column.h, index);
  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.font = "700 14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(column.name, column.x + column.w / 2, top + column.h - 16);
}

function drawWindows(x, y, w, h, seed) {
  const cols = Math.max(3, Math.floor(w / 24));
  const rows = Math.max(4, Math.floor(h / 34));
  const gapX = w / (cols + 1);
  const startY = y + 22;
  ctx.fillStyle = "rgba(220, 236, 222, 0.86)";
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if ((row + col + seed) % 5 === 0) continue;
      const wx = x + gapX * (col + 1) - 5;
      const wy = startY + row * 28;
      if (wy > y + h - 44) continue;
      roundRect(wx, wy, 10, 14, 2);
      ctx.fill();
    }
  }
}

function drawZones(column) {
  column.zones.forEach((zone) => {
    const reservation = displayReservationForZone(zone);
    const reservedNow = Boolean(reservation);
    const colors = reservedNow ? zonePalette.reserved : zone.type === "public" ? zonePalette.public : zonePalette[zone.toll];
    const alpha = reservedNow ? 0.72 : zone.selected ? 0.9 : 0.48;
    const fill = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
    fill.addColorStop(0, reservedNow ? "#d3d8db" : "#ffffff");
    fill.addColorStop(0.12, colors.fill);
    fill.addColorStop(1, colors.fill);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = zone.selected ? 4 : 2;
    roundRect(zone.x, zone.y, zone.w, zone.h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (zone.selected) {
      ctx.save();
      ctx.strokeStyle = zone.paid ? "#ffffff" : "#163f40";
      ctx.lineWidth = 2.4;
      ctx.setLineDash(zone.paid ? [] : [7, 7]);
      roundRect(zone.x + 5, zone.y + 4, zone.w - 10, zone.h - 8, 5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = reservedNow ? "#37444b" : zone.type === "public" ? "#0c2d48" : "#122027";
    ctx.textAlign = "center";
    ctx.font = "900 12px 'Segoe UI', sans-serif";
    ctx.fillText(reservedNow ? reservationShortLabel(reservation) : `${effectiveToll(zone)}원`, zone.x + zone.w / 2, zone.y + 15);
  });
}

function displayReservationForZone(zone) {
  let time = 0;
  if (state.phase === "selecting") time = nextRouteTime();
  if (state.phase === "flying" || state.phase === "deboarding" || state.phase === "complete") time = activeSimulationTime();
  return reservationsAt(zone, time)[0] || null;
}

function reservationShortLabel(reservation) {
  return `${reservation.source === "drone" ? "D" : "AD"} t${reservation.time}`;
}

function drawTerminalMarkers() {
  if (!state.selectedOffer || (state.phase !== "selecting" && state.phase !== "boarding" && state.phase !== "flying")) return;
  drawZoneBadge(startZone(), "t0", "#0f7b76");
  drawZoneBadge(destinationZone(), "도착", "#245d8c");
}

function drawZoneBadge(zone, label, color) {
  const center = zoneCenter(zone);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(zone.x + 3, zone.y + 3, zone.w - 6, zone.h - 6, 5);
  ctx.stroke();

  const badgeWidth = 38;
  const badgeX = clamp(center.x - badgeWidth / 2, 6, WORLD.width - badgeWidth - 6);
  const badgeY = Math.max(4, zone.y - 17);
  ctx.fillStyle = color;
  roundRect(badgeX, badgeY, badgeWidth, 15, 7);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 9px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, center.x, badgeY + 11);
  ctx.restore();
}

function drawAdObstacle() {
  if (!state.ad) return;
  const cx = state.ad.x;
  const cy = state.ad.y;
  const direction = state.ad.direction >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(direction, 1);

  ctx.fillStyle = "rgba(34, 46, 50, 0.18)";
  ctx.beginPath();
  ctx.ellipse(2, 20, 33, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const tail = ctx.createLinearGradient(24, -15, 45, 15);
  tail.addColorStop(0, "#f5bd3f");
  tail.addColorStop(1, "#c9831d");
  ctx.fillStyle = tail;
  ctx.strokeStyle = "#9f6618";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(25, -11);
  ctx.lineTo(46, -18);
  ctx.lineTo(42, -2);
  ctx.lineTo(27, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(26, 8);
  ctx.lineTo(45, 17);
  ctx.lineTo(42, 1);
  ctx.lineTo(27, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e5a42c";
  roundRect(32, -13, 11, 26, 2);
  ctx.fill();
  ctx.stroke();

  const skin = ctx.createLinearGradient(-40, -19, 34, 18);
  skin.addColorStop(0, "#f8c94d");
  skin.addColorStop(0.38, "#e99f27");
  skin.addColorStop(0.78, "#c77c18");
  skin.addColorStop(1, "#a96213");
  ctx.fillStyle = skin;
  ctx.strokeStyle = "#995f18";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-45, 0);
  ctx.bezierCurveTo(-39, -17, -15, -23, 17, -18);
  ctx.bezierCurveTo(38, -15, 45, -6, 42, 0);
  ctx.bezierCurveTo(45, 7, 37, 15, 16, 18);
  ctx.bezierCurveTo(-16, 23, -39, 17, -45, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 233, 148, 0.52)";
  ctx.lineWidth = 1;
  for (let rib = -25; rib <= 25; rib += 13) {
    ctx.beginPath();
    ctx.ellipse(rib, 0, 5, 17, 0, Math.PI * 1.55, Math.PI * 0.45);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 247, 214, 0.96)";
  ctx.strokeStyle = "#9d6b27";
  ctx.lineWidth = 1.2;
  roundRect(-24, -9, 43, 16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4f342a";
  ctx.font = "900 9px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.save();
  ctx.scale(direction, 1);
  ctx.fillText("Sky AD", -2, 2);
  ctx.restore();

  ctx.fillStyle = "#6d432a";
  roundRect(-11, 14, 18, 6, 2);
  ctx.fill();
  ctx.restore();
}

function drawDeliveryDrone() {
  if (!state.drone) return;
  const cx = state.drone.x;
  const cy = state.drone.y;
  const direction = state.drone.direction >= 0 ? 1 : -1;

  ctx.save();
  ctx.translate(cx, cy - 1);
  ctx.scale(direction, 1);
  ctx.fillStyle = "rgba(34, 46, 50, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 24, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#304c5a";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-20, -5);
  ctx.lineTo(20, 5);
  ctx.moveTo(-20, 5);
  ctx.lineTo(20, -5);
  ctx.stroke();

  drawDroneRotor(-24, -8);
  drawDroneRotor(24, -8);
  drawDroneRotor(-24, 8);
  drawDroneRotor(24, 8);

  const body = ctx.createLinearGradient(-12, -9, 13, 10);
  body.addColorStop(0, "#dff4f6");
  body.addColorStop(1, "#5d8798");
  ctx.fillStyle = body;
  ctx.strokeStyle = "#25485a";
  ctx.lineWidth = 1.5;
  roundRect(-13, -8, 26, 16, 5);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(48, 76, 90, 0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, 16);
  ctx.stroke();
  ctx.fillStyle = "#d99f3b";
  ctx.strokeStyle = "#8a5f22";
  roundRect(-7, 15, 14, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDroneRotor(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(28, 61, 78, 0.9)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 4, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(231, 247, 250, 0.88)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEndingScreen() {
  const pulse = 0.5 + Math.sin(state.taxi.rotor * 0.6) * 0.5;
  ctx.save();
  ctx.fillStyle = "rgba(247, 251, 252, 0.86)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const cx = WORLD.width / 2;
  const cy = WORLD.height / 2 - 8;
  const rays = 28;
  for (let i = 0; i < rays; i += 1) {
    const angle = (Math.PI * 2 * i) / rays + pulse * 0.08;
    const inner = 92;
    const outer = 300 + (i % 2) * 34;
    ctx.strokeStyle = i % 2 === 0 ? "rgba(246, 190, 69, 0.42)" : "rgba(20, 124, 145, 0.3)";
    ctx.lineWidth = i % 2 === 0 ? 7 : 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  drawConfetti(cx, cy, pulse);
  drawFanfareHorn(cx - 250, cy + 18, -1);
  drawFanfareHorn(cx + 250, cy + 18, 1);

  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.strokeStyle = "rgba(38, 67, 78, 0.18)";
  ctx.lineWidth = 2;
  roundRect(cx - 330, cy - 90, 660, 180, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0e2e39";
  ctx.font = "900 34px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("축하합니다!", cx, cy - 25);
  ctx.font = "900 28px 'Segoe UI', sans-serif";
  ctx.fillText("당신은 이제 에어택시 전문가입니다!", cx, cy + 18);
  ctx.fillStyle = "#0f7b76";
  ctx.font = "800 16px 'Segoe UI', sans-serif";
  ctx.fillText(`최종 보유금 ${moneyText(state.money)}`, cx, cy + 58);
  ctx.restore();
}

function drawConfetti(cx, cy, pulse) {
  const colors = ["#f0b43f", "#0f7b76", "#bd776f", "#245d8c", "#8bc98f"];
  for (let i = 0; i < 72; i += 1) {
    const angle = (i * 2.399) + pulse * 0.4;
    const radius = 130 + (i * 37) % 230;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.68;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = colors[i % colors.length];
    roundRect(-4, -2, 8, 4, 1);
    ctx.fill();
    ctx.restore();
  }
}

function drawFanfareHorn(x, y, side) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  ctx.fillStyle = "#f0b43f";
  ctx.strokeStyle = "#8a5f22";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(82, -30);
  ctx.lineTo(82, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff2c4";
  ctx.beginPath();
  ctx.ellipse(88, 0, 20, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#9d6b27";
  roundRect(-34, -9, 40, 18, 6);
  ctx.fill();
  ctx.restore();
}

function passengerSpots() {
  const padPos = portTaxiPosition(startPad());
  return state.passengerOffers.map((offer, index) => {
    const side = index === 0 ? -1 : 1;
    const x = clamp(padPos.x + side * 66, 42, WORLD.width - 42);
    const y = padPos.y + 24;
    const bubble = offerBubbleRect(x, y, side);
    return { offer, x, y, side, bubble };
  });
}

function passengerAt(point) {
  if (state.phase !== "choosing") return null;
  return passengerSpots().find((spot) => {
    const personHit = point.x >= spot.x - 24
      && point.x <= spot.x + 24
      && point.y >= spot.y - 48
      && point.y <= spot.y + 16;
    const bubbleHit = point.x >= spot.bubble.x
      && point.x <= spot.bubble.x + spot.bubble.w
      && point.y >= spot.bubble.y
      && point.y <= spot.bubble.y + spot.bubble.h;
    return personHit || bubbleHit;
  });
}

function offerBubbleRect(x, y, side) {
  const w = 64;
  const h = 35;
  const rawX = x + side * 14 - (side < 0 ? w : 0);
  return {
    x: clamp(rawX, 6, WORLD.width - w - 6),
    y: y - 66,
    w,
    h
  };
}

function drawPassenger() {
  const now = performance.now();
  let pad = startPad();
  let side = state.direction === 1 ? -1 : 1;
  let label = "탑승";
  let padPos = portTaxiPosition(pad);
  let fromX = padPos.x + side * 58;
  let toX = padPos.x + side * 12;
  let progress = 0;
  let alpha = 1;

  if (state.phase === "boarding" && state.flight) {
    progress = clamp((now - state.flight.startedAt) / BOARD_MS, 0, 1);
    alpha = 1 - progress * 0.8;
  }

  if (state.phase === "deboarding" && state.flight) {
    pad = endPad();
    padPos = portTaxiPosition(pad);
    side = state.direction === 1 ? 1 : -1;
    label = "하차";
    fromX = padPos.x + side * 12;
    toX = padPos.x + side * 64;
    progress = clamp((now - (state.flight.nextStepAt - DEBOARD_MS)) / DEBOARD_MS, 0, 1);
    alpha = 1 - progress;
  }

  if (alpha <= 0.02) return;

  const walk = Math.sin(now * 0.006);
  const x = fromX + (toX - fromX) * progress + walk * (state.phase === "selecting" ? 3 : 1);
  const y = padPos.y + 24;
  drawStickPassenger(x, y, side, label, alpha);
}

function drawWaitingPassengers() {
  passengerSpots().forEach((spot) => {
    drawStickPassenger(spot.x, spot.y, spot.side, "", 1);
    drawOfferBubble(spot);
  });
}

function drawOfferBubble(spot) {
  const { offer, bubble } = spot;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
  ctx.strokeStyle = "rgba(31, 43, 52, 0.28)";
  ctx.lineWidth = 1.5;
  roundRect(bubble.x, bubble.y, bubble.w, bubble.h, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#26323c";
  ctx.textAlign = "center";
  ctx.font = "800 10px 'Segoe UI', sans-serif";
  ctx.fillText(offer.destinationLabel, bubble.x + bubble.w / 2, bubble.y + 14);
  ctx.fillStyle = offer.close ? "#0d6864" : "#7a4b1c";
  ctx.font = "900 11px 'Segoe UI', sans-serif";
  ctx.fillText(moneyText(offer.fare), bubble.x + bubble.w / 2, bubble.y + 28);
  ctx.restore();
}

function drawStickPassenger(x, y, side, label, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#1f2b34";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y - 33, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 24);
  ctx.lineTo(x, y - 3);
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + side * 15, y - 11);
  ctx.moveTo(x, y - 17);
  ctx.lineTo(x - side * 11, y - 9);
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x + side * 11, y + 11);
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x - side * 8, y + 12);
  ctx.stroke();
  if (label) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
    ctx.strokeStyle = "rgba(31, 43, 52, 0.26)";
    roundRect(x + side * 11 - (side < 0 ? 30 : 0), y - 50, 40, 20, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#26323c";
    ctx.font = "800 10px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + side * 11 - (side < 0 ? 10 : -20), y - 36);
  }
  ctx.restore();
}

function drawTaxi(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.36, 0.36);
  ctx.fillStyle = "rgba(20, 38, 58, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 52, 74, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  const rotor = Math.sin(state.taxi.rotor) * 7;
  drawCuteRotor(-74, -64, rotor);
  drawCuteRotor(74, -64, -rotor);
  ctx.strokeStyle = "#1c385a";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-54, -50);
  ctx.lineTo(-18, -28);
  ctx.moveTo(54, -50);
  ctx.lineTo(18, -28);
  ctx.moveTo(-10, -74);
  ctx.lineTo(10, -74);
  ctx.moveTo(0, -74);
  ctx.lineTo(0, -35);
  ctx.stroke();
  ctx.fillStyle = "#8b5d3f";
  ctx.beginPath();
  ctx.arc(-43, -15, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(43, -15, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6dca8";
  ctx.beginPath();
  ctx.arc(-43, -15, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(43, -15, 13, 0, Math.PI * 2);
  ctx.fill();
  const shell = ctx.createRadialGradient(-18, -18, 18, 0, 8, 76);
  shell.addColorStop(0, "#fffaf0");
  shell.addColorStop(0.68, "#f7efe2");
  shell.addColorStop(1, "#233d5f");
  ctx.fillStyle = shell;
  ctx.strokeStyle = "#172b47";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(0, 10, 76, 68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const mask = ctx.createLinearGradient(-60, -36, 60, 30);
  mask.addColorStop(0, "#203a5d");
  mask.addColorStop(0.55, "#4e6e91");
  mask.addColorStop(1, "#1f3556");
  ctx.fillStyle = mask;
  ctx.beginPath();
  ctx.moveTo(-54, -16);
  ctx.bezierCurveTo(-52, -47, -22, -58, 0, -48);
  ctx.bezierCurveTo(24, -58, 54, -47, 56, -16);
  ctx.bezierCurveTo(58, 20, 32, 30, 11, 13);
  ctx.bezierCurveTo(4, 7, -4, 7, -11, 13);
  ctx.bezierCurveTo(-32, 30, -58, 20, -54, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#081a2f";
  drawEye(-31, 1);
  drawEye(31, 1);
  ctx.fillStyle = "#152842";
  ctx.beginPath();
  ctx.ellipse(0, 22, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#13233a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-4, 28);
  ctx.bezierCurveTo(-4, 42, -22, 42, -24, 32);
  ctx.moveTo(4, 28);
  ctx.bezierCurveTo(4, 42, 22, 42, 24, 32);
  ctx.stroke();
  ctx.fillStyle = "#94eaff";
  roundRect(-27, 70, 54, 9, 999);
  ctx.fill();
  ctx.restore();
}

function drawCuteRotor(x, y, phase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#203a5d";
  ctx.strokeStyle = "#0f223b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#dfeaf2";
  ctx.beginPath();
  ctx.ellipse(-15 + phase, 0, 22, 8, -0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(15 - phase, 0, 22, 8, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#314e70";
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEye(x, y) {
  ctx.beginPath();
  ctx.ellipse(x, y, 13, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x + 5, y - 7, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(x - 3, y + 8, 7, 3, 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function handleCanvasClick(event) {
  if (state.phase === "choosing") {
    const spot = passengerAt(canvasPoint(event));
    if (spot) {
      selectPassenger(spot.offer.id);
      return;
    }
  }
  handleRoutePointer(event);
}

function handleCanvasMove(event) {
  if (state.phase !== "selecting") return;
  handleRoutePointer(event);
}

canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("mousemove", handleCanvasMove);
canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  handleCanvasClick(event);
}, { passive: false });
canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  handleCanvasMove(event);
}, { passive: false });
window.addEventListener("resize", fitGameShellToViewport);

fitGameShellToViewport();
updateHud();
draw();
requestAnimationFrame(tick);
