const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const balanceEl = document.getElementById("balance");
const rivalBalanceEl = document.getElementById("rivalBalance");
const towerHeightEl = document.getElementById("towerHeight");
const rivalHeightEl = document.getElementById("rivalHeight");
const targetHeightEl = document.getElementById("targetHeight");
const rightsOwnedEl = document.getElementById("rightsOwned");
const statusText = document.getElementById("statusText");
const phasePill = document.getElementById("phasePill");
const skipButton = document.getElementById("skipButton");
const resetButton = document.getElementById("resetButton");
const ledger = document.getElementById("floatingLedger");
const gameShell = document.querySelector(".game-shell");
const topbar = document.querySelector(".topbar");

const WORLD = { width: 1280, height: 660 };
const GROUND_Y = 592;
const FLOOR_H = 5.35;
const GRID_MAX_FLOORS = 100;
const START_MONEY = 25;
const TURN_INCOME = 3;
const BASE_FLOORS = 30;
const GENERAL_LIMIT_FLOORS = 30;
const RIGHT_PRICE_PER_FLOOR = 1;
const MARKET_SWING = 1;
const MIN_MARKET_PRICE = 1;
const TARGET_MIN_FLOORS = 80;
const TARGET_MAX_FLOORS = 90;
const TARGET_STEP_FLOORS = 1;

const MY_TOWER = { x: 76, w: 82 };
const RIVAL_TOWER = { x: 174, w: 82 };

const SELLER_PLANS = [
  { id: "landmark-row", name: "랜드마크", x: 270, w: 52, baseFloors: 8, color: "#c88b2d", kind: "보전권" },
  { id: "low-office", name: "오피스", x: 334, w: 56, baseFloors: 14, color: "#12756f", kind: "일반권" },
  { id: "hotel-annex", name: "호텔별관", x: 404, w: 58, baseFloors: 18, color: "#5c8144", kind: "잔여권" },
  { id: "theater", name: "극장", x: 478, w: 56, baseFloors: 9, color: "#a34f45", kind: "극장권" },
  { id: "commercial-annex", name: "상가별관", x: 550, w: 60, baseFloors: 16, color: "#2c6f9e", kind: "상업권" },
  { id: "brownstone", name: "주거동", x: 622, w: 54, baseFloors: 7, color: "#d1a03d", kind: "소형권" },
  { id: "bank-annex", name: "은행별관", x: 800, w: 58, baseFloors: 13, color: "#4f7c67", kind: "잔여권" },
  { id: "midblock-loft", name: "미드블록", x: 874, w: 58, baseFloors: 11, color: "#8d6aa8", kind: "로프트권" },
  { id: "corner-shop", name: "코너상가", x: 946, w: 52, baseFloors: 10, color: "#b77945", kind: "상가권" }
];

const REFERENCE_TOWERS = [
  { id: "trump", name: "트럼프 타워", x: 1010, w: 60, floors: 58, color: "#6a726f", accent: "#c7a85a" },
  { id: "vanderbilt", name: "원 밴더빌트", x: 1198, w: 58, floors: 72, color: "#405b6a", accent: "#89b5c9" }
];

const CENTRAL_PARK = {
  id: "central-park",
  name: "센트럴 파크",
  x: 690,
  w: 92,
  baseFloors: 2,
  rights: 0,
  cost: 0,
  color: "#5f8f4b",
  kind: "NFS",
  notForSale: true
};

const GRAND_CENTRAL = {
  id: "grand-central",
  name: "그랜드센트럴 터미널",
  x: 1086,
  w: 92,
  baseFloors: 7,
  rights: 14,
  cost: 0,
  color: "#8e9698",
  kind: "판매완료",
  sold: true
};

const state = createGame();
let lastTime = performance.now();

function createGame() {
  const targetFloors = randomTargetFloors();
  return {
    money: START_MONEY,
    rivalMoney: START_MONEY,
    turn: 1,
    floors: BASE_FLOORS,
    rivalFloors: BASE_FLOORS,
    targetFloors,
    ownedRights: 0,
    rivalOwnedRights: 0,
    hoverId: null,
    winner: null,
    message: `목표는 ${targetFloors}층입니다. 개발권 시세는 턴마다 조금씩 변하고, 턴 끝마다 양쪽에 ${TURN_INCOME}억이 들어옵니다.`,
    ended: false,
    sellers: SELLER_PLANS.map((plan) => ({ ...sellerWithComputedRights(plan), bought: false, owner: null })),
    particles: []
  };
}

function randomTargetFloors() {
  const steps = Math.floor((TARGET_MAX_FLOORS - TARGET_MIN_FLOORS) / TARGET_STEP_FLOORS);
  return TARGET_MIN_FLOORS + Math.floor(Math.random() * (steps + 1)) * TARGET_STEP_FLOORS;
}

function sellerWithComputedRights(plan) {
  const availableFloors = Math.max(0, GENERAL_LIMIT_FLOORS - plan.baseFloors);
  const baseCost = availableFloors * RIGHT_PRICE_PER_FLOOR;
  return {
    ...plan,
    availableFloors,
    rights: availableFloors,
    baseCost,
    marketDelta: 0,
    cost: baseCost
  };
}

function resetGame() {
  const fresh = createGame();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh);
  updateHud();
}

function fitGameShellToViewport() {
  if (!gameShell || !topbar) return;

  gameShell.style.setProperty("--game-shell-width", `${Math.max(320, window.innerWidth - 28)}px`);
  requestAnimationFrame(() => {
    const shellStyle = window.getComputedStyle(gameShell);
    const paddingY = parseFloat(shellStyle.paddingTop) + parseFloat(shellStyle.paddingBottom);
    const gap = parseFloat(shellStyle.rowGap || shellStyle.gap) || 0;
    const sideMargin = window.matchMedia("(max-width: 940px)").matches ? 18 : 28;
    const availableWidth = Math.max(320, window.innerWidth - sideMargin);
    const availableHeight = Math.max(320, window.innerHeight - paddingY - topbar.getBoundingClientRect().height - gap - 6);
    const widthByHeight = availableHeight * (WORLD.width / WORLD.height);
    const fittedWidth = Math.max(320, Math.min(availableWidth, widthByHeight));
    gameShell.style.setProperty("--game-shell-width", `${Math.floor(fittedWidth)}px`);
  });
}

function moneyText(value) {
  return `${value}억`;
}

function updateHud() {
  balanceEl.textContent = moneyText(state.money);
  rivalBalanceEl.textContent = moneyText(state.rivalMoney);
  towerHeightEl.textContent = `${state.floors}층`;
  rivalHeightEl.textContent = `${state.rivalFloors}층`;
  targetHeightEl.textContent = `${state.targetFloors}층`;
  rightsOwnedEl.textContent = `${state.ownedRights}층`;

  if (state.ended) {
    phasePill.textContent = state.winner === "player" ? "승리" : state.winner === "rival" ? "패배" : "마감";
  } else {
    phasePill.textContent = `턴 ${state.turn}`;
  }

  statusText.textContent = state.message;
  skipButton.disabled = state.ended;
}

function parcelTop(parcel) {
  return GROUND_Y - parcel.baseFloors * FLOOR_H;
}

function airRect(parcel) {
  const limitFloors = parcel.limitFloors || GENERAL_LIMIT_FLOORS;
  const limitY = GROUND_Y - limitFloors * FLOOR_H;
  const y = limitY;
  const h = Math.max(44, parcelTop(parcel) - limitY - 10);
  return {
    x: parcel.x - 4,
    y,
    w: parcel.w + 8,
    h
  };
}

function pointInRect(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  return {
    x: ((source.clientX - rect.left) / rect.width) * WORLD.width,
    y: ((source.clientY - rect.top) / rect.height) * WORLD.height
  };
}

function allParcels() {
  return [...state.sellers, CENTRAL_PARK, GRAND_CENTRAL];
}

function parcelAt(point) {
  return allParcels().find((parcel) => pointInRect(point, airRect(parcel))) || null;
}

function buyParcel(parcel) {
  if (!parcel || state.ended) return;

  const initialBlock = playerPurchaseBlock(parcel);
  if (initialBlock) {
    showPlayerPurchaseBlock(parcel, initialBlock);
    updateHud();
    return;
  }

  const messages = [];
  const rivalFirst = state.turn > 1 && state.rivalFloors < state.floors;

  if (rivalFirst) {
    messages.push(takeRivalTurn(true));
    evaluateEnd();
    if (state.ended) {
      updateHud();
      return;
    }
  }

  const playerBlock = playerPurchaseBlock(parcel);
  if (playerBlock) {
    showPlayerPurchaseBlock(parcel, playerBlock);
    if (messages.length) {
      messages.push(state.message);
      finishTurn(messages);
    } else {
      updateHud();
    }
    return;
  }

  acquireParcel(parcel, "player");
  messages.push(`내가 시세 ${moneyText(parcel.cost)}에 개발권 +${parcel.rights}층을 매입했습니다. 내 스카이빌딩은 ${state.floors}층입니다.`);

  evaluateEnd();
  if (!state.ended && !rivalFirst) {
    messages.push(takeRivalTurn(false));
    evaluateEnd();
  }

  if (state.ended) {
    updateHud();
    return;
  }

  finishTurn(messages);
}

function playerPurchaseBlock(parcel) {
  if (parcel.notForSale) {
    return {
      message: "센트럴 파크 위 공간은 NFS(Not For Sale)입니다. 공원 위 공중권은 살 수 없습니다.",
      popText: "NFS",
      popOffset: 30
    };
  }

  if (parcel.sold) {
    return {
      message: "그랜드센트럴 위 공중권은 이미 팔렸습니다. 이 게임에서는 더 이상 살 수 없습니다.",
      popText: "판매완료",
      popOffset: 22
    };
  }

  if (parcel.bought) {
    return {
      message: parcel.owner === "rival"
        ? "이 공중권은 개구쟁이빌딩이 먼저 사 갔습니다. 다른 개발권을 고르세요."
        : "이 공중권은 이미 내 건물에 반영됐습니다."
    };
  }

  if (state.money < parcel.cost) {
    return {
      message: `이 개발권 시세는 ${moneyText(parcel.cost)}입니다. 돈이 부족하면 '이번 턴 안 사기'로 ${TURN_INCOME}억을 모으세요.`,
      popText: "자금부족",
      popOffset: 22
    };
  }

  return null;
}

function skipPlayerTurn() {
  if (state.ended) return;

  const messages = [];
  const rivalFirst = state.turn > 1 && state.rivalFloors < state.floors;

  if (rivalFirst) {
    messages.push(takeRivalTurn(true));
    evaluateEnd();
    if (state.ended) {
      updateHud();
      return;
    }
  }

  messages.push(`이번 턴에는 개발권을 사지 않고 자금을 모았습니다.`);

  if (!rivalFirst) {
    messages.push(takeRivalTurn(false));
    evaluateEnd();
    if (state.ended) {
      updateHud();
      return;
    }
  }

  finishTurn(messages);
}

function finishTurn(messages) {
  addTurnIncome();
  const marketMessage = updateMarketPrices();
  state.turn += 1;
  messages.push(`턴 수입: 나와 개구쟁이 모두 +${TURN_INCOME}억.`);
  if (marketMessage) messages.push(marketMessage);
  evaluateEnd();
  if (!state.ended) state.message = messages.join(" ");
  updateHud();
}

function addTurnIncome() {
  state.money += TURN_INCOME;
  state.rivalMoney += TURN_INCOME;
  popMoney(`+${TURN_INCOME}억`, MY_TOWER.x + MY_TOWER.w / 2, GROUND_Y - state.floors * FLOOR_H - 18, true);
  popMoney(`+${TURN_INCOME}억`, RIVAL_TOWER.x + RIVAL_TOWER.w / 2, GROUND_Y - state.rivalFloors * FLOOR_H - 18, true);
}

function updateMarketPrices() {
  let up = 0;
  let down = 0;
  let flat = 0;

  state.sellers.forEach((parcel) => {
    if (parcel.bought) return;

    const previousCost = parcel.cost;
    const change = randomMarketChange();
    parcel.marketDelta += change;
    parcel.cost = Math.max(MIN_MARKET_PRICE, parcel.baseCost + parcel.marketDelta);
    parcel.marketDelta = parcel.cost - parcel.baseCost;

    if (parcel.cost > previousCost) up += 1;
    else if (parcel.cost < previousCost) down += 1;
    else flat += 1;
  });

  if (up + down + flat === 0) return "";
  return `시세 변동: 오른 개발권 ${up}개, 내린 개발권 ${down}개, 그대로 ${flat}개.`;
}

function randomMarketChange() {
  return Math.floor(Math.random() * (MARKET_SWING * 2 + 1)) - MARKET_SWING;
}

function showPlayerPurchaseBlock(parcel, block) {
  state.message = block.message;
  if (block.popText) {
    popMoney(block.popText, parcel.x + parcel.w / 2, airRect(parcel).y + block.popOffset);
  }
}

function evaluateEnd() {
  if (state.floors >= state.targetFloors) {
    endGame("player", `내 스카이빌딩이 목표 ${state.targetFloors}층에 먼저 도달했습니다. 승리입니다.`);
    return;
  }

  if (state.rivalFloors >= state.targetFloors) {
    endGame("rival", `개구쟁이빌딩이 목표 ${state.targetFloors}층에 먼저 도달했습니다. 이번 경쟁은 졌습니다.`);
    return;
  }

  const hasUnsoldRights = state.sellers.some((parcel) => !parcel.bought);
  if (!hasUnsoldRights) {
    const winner = state.floors > state.rivalFloors ? "player" : state.rivalFloors > state.floors ? "rival" : "draw";
    endGame(winner, `살 수 있는 개발권이 모두 팔렸습니다. 최종 높이는 내 스카이빌딩 ${state.floors}층, 개구쟁이빌딩 ${state.rivalFloors}층입니다.`);
  }
}

function acquireParcel(parcel, owner) {
  parcel.bought = true;
  parcel.owner = owner;

  const tower = towerForOwner(owner);
  const previousFloors = owner === "player" ? state.floors : state.rivalFloors;

  if (owner === "player") {
    state.money -= parcel.cost;
    state.floors += parcel.rights;
    state.ownedRights += parcel.rights;
  } else {
    state.rivalMoney -= parcel.cost;
    state.rivalFloors += parcel.rights;
    state.rivalOwnedRights += parcel.rights;
  }

  const rect = airRect(parcel);
  popMoney(`-${moneyText(parcel.cost)}`, parcel.x + parcel.w / 2, rect.y + 20);
  popMoney(`+${parcel.rights}층`, tower.x + tower.w / 2, GROUND_Y - (previousFloors + parcel.rights) * FLOOR_H - 18, true);
  addTransferParticles(parcel, owner);
}

function takeRivalTurn(first = false) {
  const parcel = chooseRivalParcel();
  if (!parcel) return "개구쟁이빌딩은 이번 턴에 살 수 있는 개발권이 없습니다.";

  acquireParcel(parcel, "rival");
  return first
    ? `개구쟁이빌딩이 더 낮아서 먼저 시세 ${moneyText(parcel.cost)}에 개발권 +${parcel.rights}층을 사서 ${state.rivalFloors}층까지 올라갔습니다.`
    : `개구쟁이빌딩도 시세 ${moneyText(parcel.cost)}에 개발권 +${parcel.rights}층을 사서 ${state.rivalFloors}층까지 올라갔습니다.`;
}

function chooseRivalParcel() {
  const options = state.sellers
    .filter((parcel) => !parcel.bought && state.rivalMoney >= parcel.cost)
    .sort((a, b) => {
      const byValue = (b.rights / b.cost) - (a.rights / a.cost);
      if (Math.abs(byValue) > 0.001) return byValue;
      const byRights = b.rights - a.rights;
      if (byRights) return byRights;
      return a.cost - b.cost;
    });

  return options[0] || null;
}

function towerForOwner(owner) {
  return owner === "rival" ? RIVAL_TOWER : MY_TOWER;
}

function endGame(winner, message) {
  state.ended = true;
  state.winner = winner;
  state.message = message;
}

function addTransferParticles(parcel, owner = "player") {
  const rect = airRect(parcel);
  const from = { x: parcel.x + parcel.w / 2, y: rect.y + rect.h / 2 };
  const tower = towerForOwner(owner);
  const floors = owner === "rival" ? state.rivalFloors : state.floors;
  const to = { x: tower.x + tower.w / 2, y: GROUND_Y - floors * FLOOR_H + 18 };

  for (let i = 0; i < 8; i += 1) {
    state.particles.push({
      fromX: from.x + (i - 3.5) * 4,
      fromY: from.y + Math.sin(i) * 8,
      toX: to.x + (i - 3.5) * 6,
      toY: to.y + (i % 2) * 9,
      age: 0,
      life: 650 + i * 45,
      color: parcel.color
    });
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
  window.setTimeout(() => node.remove(), 1000);
}

function tick(time) {
  const delta = Math.min(48, time - lastTime);
  lastTime = time;
  updateParticles(delta);
  draw(time);
  requestAnimationFrame(tick);
}

function updateParticles(delta) {
  state.particles.forEach((particle) => {
    particle.age += delta;
  });
  state.particles = state.particles.filter((particle) => particle.age < particle.life);
}

function draw(time) {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawSky(time);
  drawStreetGrid();
  drawGround();
  drawMyTower();
  drawSellers();
  drawReferenceSkyline();
  drawHeightGuides();
  drawParticles();
  if (state.ended) drawEndingPanel();
}

function drawSky(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, "#c6e3ee");
  sky.addColorStop(0.58, "#f4f5ec");
  sky.addColorStop(1, "#d9ded6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 5; i += 1) {
    const x = (160 + i * 260 + time * 0.006) % (WORLD.width + 180) - 90;
    drawCloud(x, 84 + (i % 2) * 38, 0.85 + (i % 3) * 0.18);
  }
  ctx.restore();
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.ellipse(x, y, 38 * scale, 13 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 32 * scale, y - 7 * scale, 30 * scale, 15 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 66 * scale, y, 44 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawStreetGrid() {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = "#91a1a8";
  ctx.lineWidth = 1;
  const gridTop = GROUND_Y - GRID_MAX_FLOORS * FLOOR_H;
  for (let floor = 10; floor <= GRID_MAX_FLOORS; floor += 10) {
    const y = GROUND_Y - floor * FLOOR_H;
    if (y < gridTop - 1) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.2;
  for (let x = 55; x < WORLD.width; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, Math.max(44, gridTop));
    ctx.lineTo(x, GROUND_Y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGround() {
  const ground = ctx.createLinearGradient(0, GROUND_Y - 10, 0, WORLD.height);
  ground.addColorStop(0, "#d9d2bd");
  ground.addColorStop(0.55, "#c6bda6");
  ground.addColorStop(1, "#aa9e89");
  ctx.fillStyle = ground;
  ctx.fillRect(0, GROUND_Y, WORLD.width, WORLD.height - GROUND_Y);

  ctx.fillStyle = "#6f8d7a";
  ctx.fillRect(0, GROUND_Y, WORLD.width, 8);

  ctx.fillStyle = "#86a96f";
  ctx.fillRect(0, GROUND_Y + 9, WORLD.width, 16);

  ctx.fillStyle = "rgba(255,255,255,0.26)";
  for (let x = 0; x < WORLD.width; x += 54) {
    ctx.fillRect(x, GROUND_Y + 26, 36, 1);
  }

  ctx.strokeStyle = "rgba(101,86,68,0.24)";
  ctx.lineWidth = 1;
  for (let x = -16; x < WORLD.width; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 26);
    ctx.lineTo(x + 24, WORLD.height);
    ctx.stroke();
  }

  ctx.fillStyle = "#5e745f";
  for (let x = 42; x < WORLD.width; x += 128) {
    ctx.fillRect(x - 2, GROUND_Y + 17, 4, 17);
    ctx.beginPath();
    ctx.arc(x, GROUND_Y + 13, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#73975e";
    ctx.beginPath();
    ctx.arc(x + 7, GROUND_Y + 16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5e745f";
  }
}

function drawMyTower() {
  drawCompetitionTower({
    tower: MY_TOWER,
    floors: state.floors,
    ownedRights: state.ownedRights,
    label: "내 스카이빌딩",
    colorTop: "#2e5964",
    colorBottom: "#18343d",
    capTop: "#d09a3b",
    capBottom: "#b76f41",
    labelColor: "#244f5d",
    crown: "spire",
    symbol: "smile"
  });

  drawCompetitionTower({
    tower: RIVAL_TOWER,
    floors: state.rivalFloors,
    ownedRights: state.rivalOwnedRights,
    label: "개구쟁이빌딩",
    colorTop: "#6b4c73",
    colorBottom: "#392d45",
    capTop: "#80b76a",
    capBottom: "#4f8f5d",
    labelColor: "#613c70",
    crown: "flag",
    symbol: "mischief"
  });
}

function drawCompetitionTower(config) {
  const { tower, floors, ownedRights, label, colorTop, colorBottom, capTop, capBottom, labelColor, crown, symbol } = config;
  const x = tower.x;
  const w = tower.w;
  const totalHeight = floors * FLOOR_H;
  const top = GROUND_Y - totalHeight;
  const baseTop = GROUND_Y - BASE_FLOORS * FLOOR_H;
  const acquiredTop = Math.min(baseTop, top);

  drawShadow(x - 10, top, w + 24, totalHeight);

  const body = ctx.createLinearGradient(x, top, x + w, GROUND_Y);
  body.addColorStop(0, colorTop);
  body.addColorStop(1, colorBottom);
  ctx.fillStyle = body;
  roundRect(x, top, w, totalHeight, 7);
  ctx.fill();

  if (ownedRights > 0) {
    const cap = ctx.createLinearGradient(x, acquiredTop, x + w, baseTop);
    cap.addColorStop(0, capTop);
    cap.addColorStop(1, capBottom);
    ctx.fillStyle = cap;
    roundRect(x + 4, acquiredTop, w - 8, baseTop - acquiredTop, 5);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 2;
  for (let y = top + 20; y < GROUND_Y - 10; y += 24) {
    ctx.beginPath();
    ctx.moveTo(x + 9, y);
    ctx.lineTo(x + w - 9, y);
    ctx.stroke();
  }

  drawWindows(x + 14, top + 16, w - 28, totalHeight - 30, 18, "#dbe8dd", 0.62);
  drawTowerSymbol(x, top, w, totalHeight, symbol);
  if (crown === "flag") {
    drawRivalFlag(x, top, w);
  } else {
    drawTowerCrown(x, top, w);
  }
  drawNamePlate(x + w / 2, Math.max(22, top - 84), label, labelColor);
}

function drawHeightGuides() {
  drawZoningLimitLine();
  drawTargetMarker();
}

function drawZoningLimitLine() {
  const y = GROUND_Y - GENERAL_LIMIT_FLOORS * FLOOR_H;
  ctx.save();
  ctx.strokeStyle = "rgba(36, 103, 91, 0.78)";
  ctx.setLineDash([12, 7]);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(250, y);
  ctx.lineTo(1004, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTargetMarker() {
  const y = GROUND_Y - state.targetFloors * FLOOR_H;
  ctx.save();
  ctx.strokeStyle = "rgba(163,79,69,0.75)";
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(36, y);
  ctx.lineTo(270, y);
  ctx.stroke();
  ctx.setLineDash([]);
  drawGuideLabel(278, y - 10, `이번 목표 ${state.targetFloors}층`, "#a34f45");
  ctx.restore();
}

function drawGuideLabel(x, y, label, color) {
  ctx.save();
  ctx.font = "900 14px 'Segoe UI', 'Noto Sans KR', sans-serif";
  const w = ctx.measureText(label).width + 18;
  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.strokeStyle = hexToRgba(color, 0.36);
  ctx.lineWidth = 1;
  roundRect(x, y, w, 26, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 9, y + 13);
  ctx.restore();
}

function drawTowerCrown(x, top, w) {
  ctx.fillStyle = "#f2d56b";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, top - 26);
  ctx.lineTo(x + w * 0.62, top);
  ctx.lineTo(x + w * 0.38, top);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#f2d56b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, top - 26);
  ctx.lineTo(x + w / 2, top - 52);
  ctx.stroke();
}

function drawRivalFlag(x, top, w) {
  const poleX = x + w / 2;
  ctx.strokeStyle = "#9fd06f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(poleX, top - 3);
  ctx.lineTo(poleX, top - 44);
  ctx.stroke();

  ctx.fillStyle = "#80b76a";
  ctx.beginPath();
  ctx.moveTo(poleX + 2, top - 42);
  ctx.lineTo(poleX + 34, top - 32);
  ctx.lineTo(poleX + 2, top - 22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f5f9ed";
  ctx.beginPath();
  ctx.arc(poleX + 15, top - 32, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawTowerSymbol(x, top, w, totalHeight, type) {
  if (!type || totalHeight < 96) return;

  const size = Math.min(w * 0.66, Math.max(44, totalHeight * 0.27));
  const cx = x + w / 2;
  const cy = top + Math.min(totalHeight * 0.48, 124);

  ctx.save();
  if (type === "mischief") {
    const faceR = drawSymbolBadge(cx, cy, size, {
      rimTop: "#f3def0",
      rimBottom: "#80528b",
      faceTop: "#fffaf1",
      faceBottom: "#ead7f1",
      stroke: "#5d3b6d"
    });
    drawMischiefFace(cx, cy, faceR);
  } else {
    const faceR = drawSymbolBadge(cx, cy, size, {
      rimTop: "#f7f5db",
      rimBottom: "#60aaa5",
      faceTop: "#fffdf1",
      faceBottom: "#d8efe8",
      stroke: "#235f62"
    });
    drawSmileFace(cx, cy, faceR);
  }
  ctx.restore();
}

function drawSymbolBadge(cx, cy, size, palette) {
  const rimR = size * 0.56;
  const faceR = size * 0.41;

  ctx.save();
  ctx.shadowColor = "rgba(12, 18, 24, 0.28)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  const rim = ctx.createLinearGradient(cx - rimR, cy - rimR, cx + rimR, cy + rimR);
  rim.addColorStop(0, palette.rimTop);
  rim.addColorStop(1, palette.rimBottom);
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, rimR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, rimR - 1, 0, Math.PI * 2);
  ctx.stroke();

  const face = ctx.createLinearGradient(cx, cy - faceR, cx, cy + faceR);
  face.addColorStop(0, palette.faceTop);
  face.addColorStop(1, palette.faceBottom);
  ctx.fillStyle = face;
  ctx.strokeStyle = hexToRgba(palette.stroke, 0.22);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(cx, cy, faceR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.beginPath();
  ctx.ellipse(cx - faceR * 0.28, cy - faceR * 0.34, faceR * 0.22, faceR * 0.1, -0.35, 0, Math.PI * 2);
  ctx.fill();

  return faceR;
}

function drawSmileFace(cx, cy, faceR) {
  const ink = "#49505a";
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(cx - faceR * 0.34, cy - faceR * 0.2, faceR * 0.12, 0, Math.PI * 2);
  ctx.arc(cx + faceR * 0.34, cy - faceR * 0.2, faceR * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.arc(cx - faceR * 0.38, cy - faceR * 0.24, faceR * 0.04, 0, Math.PI * 2);
  ctx.arc(cx + faceR * 0.3, cy - faceR * 0.24, faceR * 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(231,126,109,0.5)";
  ctx.beginPath();
  ctx.arc(cx - faceR * 0.48, cy + faceR * 0.13, faceR * 0.08, 0, Math.PI * 2);
  ctx.arc(cx + faceR * 0.48, cy + faceR * 0.13, faceR * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(3, faceR * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy - faceR * 0.02, faceR * 0.43, 0.17 * Math.PI, 0.83 * Math.PI);
  ctx.stroke();
}

function drawMischiefFace(cx, cy, faceR) {
  const ink = "#292631";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.lineWidth = Math.max(3, faceR * 0.15);
  ctx.beginPath();
  ctx.moveTo(cx - faceR * 0.53, cy - faceR * 0.34);
  ctx.quadraticCurveTo(cx - faceR * 0.31, cy - faceR * 0.48, cx - faceR * 0.08, cy - faceR * 0.28);
  ctx.moveTo(cx + faceR * 0.09, cy - faceR * 0.28);
  ctx.quadraticCurveTo(cx + faceR * 0.34, cy - faceR * 0.5, cx + faceR * 0.55, cy - faceR * 0.34);
  ctx.stroke();

  ctx.lineWidth = Math.max(2.4, faceR * 0.12);
  ctx.beginPath();
  ctx.moveTo(cx - faceR * 0.43, cy - faceR * 0.06);
  ctx.quadraticCurveTo(cx - faceR * 0.29, cy - faceR * 0.18, cx - faceR * 0.14, cy - faceR * 0.06);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx + faceR * 0.28, cy - faceR * 0.06, faceR * 0.1, faceR * 0.14, 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.arc(cx + faceR * 0.24, cy - faceR * 0.11, faceR * 0.035, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(3, faceR * 0.14);
  ctx.beginPath();
  ctx.moveTo(cx - faceR * 0.37, cy + faceR * 0.24);
  ctx.quadraticCurveTo(cx + faceR * 0.04, cy + faceR * 0.46, cx + faceR * 0.43, cy + faceR * 0.14);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx - faceR * 0.05, cy + faceR * 0.39);
  ctx.lineTo(cx + faceR * 0.05, cy + faceR * 0.57);
  ctx.lineTo(cx + faceR * 0.13, cy + faceR * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(164,91,181,0.5)";
  ctx.beginPath();
  ctx.arc(cx - faceR * 0.53, cy + faceR * 0.12, faceR * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

function drawSellers() {
  state.sellers.forEach((parcel, index) => {
    drawParcelBuilding(parcel, index);
    drawAirRight(parcel);
  });
}

function drawParcelBuilding(parcel, index) {
  const top = parcelTop(parcel);
  const h = GROUND_Y - top;
  drawShadow(parcel.x - 6, top + 10, parcel.w + 16, h);

  const body = ctx.createLinearGradient(parcel.x, top, parcel.x + parcel.w, GROUND_Y);
  body.addColorStop(0, index % 2 ? "#947966" : "#817c72");
  body.addColorStop(1, index % 2 ? "#57493f" : "#4d514d");
  ctx.fillStyle = body;
  roundRect(parcel.x, top, parcel.w, h, 5);
  ctx.fill();

  drawWindows(parcel.x + 10, top + 14, parcel.w - 20, h - 22, 16, "#f3e6b0", 0.55);
}

function drawReferenceSkyline() {
  drawCentralPark();
  REFERENCE_TOWERS.forEach((tower) => drawReferenceTower(tower));
  drawGrandCentral();
}

function drawCentralPark() {
  const park = CENTRAL_PARK;
  const top = parcelTop(park);
  const h = GROUND_Y - top;

  ctx.save();
  drawShadow(park.x - 8, top + 10, park.w + 18, h + 4);

  const grass = ctx.createLinearGradient(park.x, top, park.x + park.w, GROUND_Y);
  grass.addColorStop(0, "#84b86c");
  grass.addColorStop(1, "#537a45");
  ctx.fillStyle = grass;
  roundRect(park.x, top, park.w, h, 7);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.62)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(park.x + 8, top + 18);
  ctx.bezierCurveTo(park.x + 34, top + 8, park.x + 46, top + 42, park.x + park.w - 10, top + 26);
  ctx.stroke();

  ctx.fillStyle = "#6ba5b3";
  ctx.beginPath();
  ctx.ellipse(park.x + park.w * 0.6, top + h * 0.62, 22, 9, -0.18, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 6; i += 1) {
    const tx = park.x + 12 + i * 13;
    const ty = top + 16 + (i % 3) * 16;
    ctx.fillStyle = "#44683c";
    ctx.fillRect(tx - 1, ty + 8, 3, 10);
    ctx.beginPath();
    ctx.arc(tx, ty + 6, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  drawAirRight(park);
  drawNamePlate(park.x + park.w / 2, top - 24, park.name, "#355f38");
}

function drawReferenceTower(tower) {
  const h = tower.floors * FLOOR_H;
  const top = GROUND_Y - h;
  drawShadow(tower.x - 8, top + 14, tower.w + 20, h);

  const body = ctx.createLinearGradient(tower.x, top, tower.x + tower.w, GROUND_Y);
  body.addColorStop(0, tower.color);
  body.addColorStop(1, "#28323a");
  ctx.fillStyle = body;
  roundRect(tower.x, top, tower.w, h, 6);
  ctx.fill();

  ctx.fillStyle = tower.accent;
  for (let y = top + 18; y < GROUND_Y - 16; y += 28) {
    ctx.fillRect(tower.x + 12, y, tower.w - 24, 3);
  }
  drawWindows(tower.x + 13, top + 20, tower.w - 26, h - 34, 18, "#cfe1e8", 0.38);

  if (tower.id === "vanderbilt") {
    ctx.fillStyle = "#9cc6d5";
    ctx.beginPath();
    ctx.moveTo(tower.x + tower.w / 2, top - 42);
    ctx.lineTo(tower.x + tower.w, top + 6);
    ctx.lineTo(tower.x, top + 6);
    ctx.closePath();
    ctx.fill();
  }

  drawNamePlate(tower.x + tower.w / 2, top - (tower.id === "vanderbilt" ? 58 : 24), tower.name, tower.color);
}

function drawGrandCentral() {
  const parcel = GRAND_CENTRAL;
  const top = parcelTop(parcel);
  const h = GROUND_Y - top;

  drawShadow(parcel.x - 10, top + 12, parcel.w + 24, h);

  ctx.fillStyle = "#b7aa91";
  roundRect(parcel.x, top, parcel.w, h, 5);
  ctx.fill();

  ctx.fillStyle = "#7e6d58";
  ctx.fillRect(parcel.x - 8, top + h - 16, parcel.w + 16, 16);
  ctx.fillStyle = "#d6c6a6";
  ctx.fillRect(parcel.x + 12, top - 14, parcel.w - 24, 18);

  ctx.fillStyle = "#35515a";
  ctx.beginPath();
  ctx.arc(parcel.x + parcel.w / 2, top + 14, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f4e6b5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(parcel.x + parcel.w / 2, top + 14);
  ctx.lineTo(parcel.x + parcel.w / 2 + 6, top + 10);
  ctx.moveTo(parcel.x + parcel.w / 2, top + 14);
  ctx.lineTo(parcel.x + parcel.w / 2, top + 7);
  ctx.stroke();

  for (let x = parcel.x + 13; x < parcel.x + parcel.w - 10; x += 19) {
    ctx.fillStyle = "#5f6d65";
    ctx.fillRect(x, top + 35, 10, 32);
  }

  drawAirRight(parcel);
  drawNamePlate(parcel.x + parcel.w / 2, top - 32, "그랜드센트럴 터미널", "#6f6556");
}

function drawAirRight(parcel) {
  const rect = airRect(parcel);
  const isHover = state.hoverId === parcel.id;
  const isNfs = parcel.notForSale;
  const isSold = parcel.sold;
  const isLocked = isSold || isNfs;
  const isBought = parcel.bought;
  const canBuy = !isLocked && !isBought;

  ctx.save();

  if (isNfs) {
    ctx.fillStyle = "rgba(94, 130, 70, 0.28)";
  } else if (isSold) {
    ctx.fillStyle = "rgba(104,112,116,0.34)";
  } else if (isBought) {
    ctx.fillStyle = parcel.owner === "rival" ? "rgba(97,60,112,0.2)" : "rgba(41,92,72,0.16)";
  } else {
    ctx.fillStyle = hexToRgba(parcel.color, isHover ? 0.78 : 0.58);
  }

  ctx.strokeStyle = isNfs ? "rgba(67,105,55,0.82)" : isSold ? "rgba(82,88,92,0.8)" : isBought ? parcel.owner === "rival" ? "rgba(97,60,112,0.7)" : "rgba(39,111,70,0.65)" : parcel.color;
  ctx.lineWidth = isHover && canBuy ? 4 : 2;
  ctx.setLineDash(isBought || isLocked ? [7, 6] : []);
  roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  if (isLocked) drawHatch(rect, isNfs ? "rgba(58,95,47,0.42)" : "rgba(82,88,92,0.45)");
  if (isBought) drawBoughtCheck(rect, parcel.owner);

  ctx.fillStyle = isNfs ? "#254b2a" : isSold ? "#394247" : isBought ? parcel.owner === "rival" ? "#613c70" : "#276f46" : "#ffffff";
  ctx.font = "900 16px 'Segoe UI', 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isNfs ? "NFS" : isSold ? "판매완료" : isBought ? parcel.owner === "rival" ? "개구쟁이" : "내 매입" : `+${parcel.rights}층`, rect.x + rect.w / 2, rect.y + rect.h / 2 - 8);

  ctx.font = "800 12px 'Segoe UI', 'Noto Sans KR', sans-serif";
  ctx.fillText(isNfs ? "Not For Sale" : isSold ? "잠금" : isBought ? `+${parcel.rights}층` : `시세 ${moneyText(parcel.cost)}`, rect.x + rect.w / 2, rect.y + rect.h / 2 + 12);
  ctx.restore();
}

function drawHatch(rect, color) {
  ctx.save();
  ctx.beginPath();
  roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let x = rect.x - rect.h; x < rect.x + rect.w + rect.h; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.h);
    ctx.lineTo(x + rect.h, rect.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoughtCheck(rect, owner = "player") {
  ctx.save();
  ctx.strokeStyle = owner === "rival" ? "#613c70" : "#276f46";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.w - 34, rect.y + 18);
  ctx.lineTo(rect.x + rect.w - 24, rect.y + 29);
  ctx.lineTo(rect.x + rect.w - 9, rect.y + 10);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  state.particles.forEach((particle) => {
    const t = Math.min(1, particle.age / particle.life);
    const ease = 1 - Math.pow(1 - t, 3);
    const x = particle.fromX + (particle.toX - particle.fromX) * ease;
    const y = particle.fromY + (particle.toY - particle.fromY) * ease - Math.sin(t * Math.PI) * 26;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = particle.color;
    roundRect(x - 8, y - 8, 16, 16, 4);
    ctx.fill();
    ctx.restore();
  });
}

function drawEndingPanel() {
  ctx.save();
  ctx.fillStyle = "rgba(21, 29, 34, 0.48)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const won = state.winner === "player";
  const lost = state.winner === "rival";
  const w = 420;
  const h = 172;
  const x = WORLD.width / 2 - w / 2;
  const y = WORLD.height / 2 - h / 2;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(23,33,43,0.18)";
  ctx.lineWidth = 2;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = won ? "#12756f" : lost ? "#a34f45" : "#5f6972";
  ctx.font = "900 30px 'Segoe UI', 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(won ? "경쟁 승리" : lost ? "개구쟁이 승리" : "경쟁 마감", WORLD.width / 2, y + 50);

  ctx.fillStyle = "#26323c";
  ctx.font = "800 18px 'Segoe UI', 'Noto Sans KR', sans-serif";
  ctx.fillText(`나 ${state.floors}층  |  개구쟁이 ${state.rivalFloors}층  |  목표 ${state.targetFloors}층`, WORLD.width / 2, y + 92);

  ctx.fillStyle = "#5f6972";
  ctx.font = "700 15px 'Segoe UI', 'Noto Sans KR', sans-serif";
  ctx.fillText("새 게임 버튼으로 다시 시작할 수 있습니다.", WORLD.width / 2, y + 127);
  ctx.restore();
}

function drawWindows(x, y, w, h, gap, color, alpha) {
  if (h <= 18) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const cols = Math.max(2, Math.floor(w / gap));
  const rows = Math.max(2, Math.floor(h / (gap + 4)));
  const cellW = w / cols;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if ((row + col) % 5 === 0) continue;
      const wx = x + col * cellW + cellW * 0.28;
      const wy = y + row * (gap + 4);
      ctx.fillRect(wx, wy, Math.max(4, cellW * 0.36), 8);
    }
  }
  ctx.restore();
}

function drawNamePlate(x, y, label, color) {
  ctx.save();
  ctx.font = "900 14px 'Segoe UI', 'Noto Sans KR', sans-serif";
  const w = Math.min(176, ctx.measureText(label).width + 20);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = hexToRgba(color, 0.42);
  ctx.lineWidth = 1.4;
  roundRect(x - w / 2, y, w, 28, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + 14);
  ctx.restore();
}

function drawShadow(x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#151d22";
  roundRect(x, y + 10, w, h, 8);
  ctx.fill();
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function handleCanvasClick(event) {
  const parcel = parcelAt(canvasPoint(event));
  if (!parcel) return;
  buyParcel(parcel);
}

function handleCanvasMove(event) {
  const parcel = parcelAt(canvasPoint(event));
  state.hoverId = parcel?.id || null;
  canvas.style.cursor = parcel ? "pointer" : "default";
}

canvas.addEventListener("click", handleCanvasClick);
canvas.addEventListener("mousemove", handleCanvasMove);
canvas.addEventListener("mouseleave", () => {
  state.hoverId = null;
  canvas.style.cursor = "default";
});
canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  handleCanvasClick(event);
}, { passive: false });
skipButton.addEventListener("click", skipPlayerTurn);
resetButton.addEventListener("click", resetGame);
window.addEventListener("resize", fitGameShellToViewport);

fitGameShellToViewport();
updateHud();
requestAnimationFrame(tick);
