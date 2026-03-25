const state = {
  mode: 'explore',
  day: 1,
  playerPos: { x: 2, y: 2 },
  player: {
    hp: 100,
    stamina: 100,
    focus: 60,
    stats: {
      strength: 6,
      dexterity: 6,
      intelligence: 5,
      endurance: 6,
      willpower: 5,
    },
    skills: {
      swordplay: 1,
      evasion: 1,
      medicine: 1,
      survival: 1,
      discipline: 1,
    },
    xp: {
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      endurance: 0,
      willpower: 0,
      swordplay: 0,
      evasion: 0,
      medicine: 0,
      survival: 0,
      discipline: 0,
    },
  },
  enemy: null,
  map: [],
  combatRound: 0,
};

const worldEl = document.getElementById('world');
const coreStatsEl = document.getElementById('coreStats');
const resourceEl = document.getElementById('resourceBars');
const panelTitleEl = document.getElementById('panelTitle');
const panelTextEl = document.getElementById('panelText');
const actionsEl = document.getElementById('actions');
const logEl = document.getElementById('log');

const mapSize = 6;
const tileSize = 70;

function addLog(text) {
  const line = document.createElement('p');
  line.textContent = `[Day ${state.day}] ${text}`;
  logEl.prepend(line);
}

function awardPractice(key, amount, threshold = 5) {
  state.player.xp[key] += amount;
  if (state.player.xp[key] >= threshold) {
    state.player.xp[key] -= threshold;
    if (state.player.stats[key] !== undefined) {
      state.player.stats[key] += 1;
      addLog(`${key} improved through practice.`);
    } else if (state.player.skills[key] !== undefined) {
      state.player.skills[key] += 1;
      addLog(`${key} skill increased to ${state.player.skills[key]}.`);
    }
  }
}

function updateHud() {
  coreStatsEl.innerHTML = '';
  Object.entries(state.player.stats).forEach(([key, val]) => {
    const node = document.createElement('div');
    node.className = 'pill';
    node.textContent = `${key.slice(0, 3).toUpperCase()} ${val}`;
    coreStatsEl.appendChild(node);
  });

  const resources = [
    ['HP', state.player.hp],
    ['STM', state.player.stamina],
    ['FOC', state.player.focus],
    ['SWD', state.player.skills.swordplay],
    ['EVS', state.player.skills.evasion],
  ];
  resourceEl.innerHTML = '';
  resources.forEach(([label, val]) => {
    const node = document.createElement('div');
    node.className = 'pill';
    node.textContent = `${label} ${Math.round(val)}`;
    resourceEl.appendChild(node);
  });
}

function buildMap() {
  state.map = Array.from({ length: mapSize }, (_, y) =>
    Array.from({ length: mapSize }, (_, x) => {
      const roll = Math.random();
      const type = roll > 0.8 ? 'ruin' : roll > 0.45 ? 'road' : 'grass';
      return { x, y, type };
    })
  );
}

function isAdjacent(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy <= 1;
}

function renderMap() {
  worldEl.innerHTML = '';
  state.map.flat().forEach((tile) => {
    const el = document.createElement('button');
    el.className = `tile ${tile.type}`;
    const isoX = (tile.x - tile.y) * (tileSize / 2) + worldEl.clientWidth / 2 - 35;
    const isoY = (tile.x + tile.y) * (tileSize / 4) + 20;
    el.style.left = `${isoX}px`;
    el.style.top = `${isoY}px`;
    el.dataset.label = tile.type[0].toUpperCase();

    if (tile.x === state.playerPos.x && tile.y === state.playerPos.y) {
      el.classList.add('player');
      el.dataset.label = 'You';
    }

    if (state.mode === 'explore' && isAdjacent(tile, state.playerPos)) {
      el.classList.add('reachable');
      el.addEventListener('click', () => travelTo(tile));
    }

    if (state.enemy && tile.x === state.enemy.pos.x && tile.y === state.enemy.pos.y) {
      el.classList.add('enemy');
      el.dataset.label = 'Foe';
    }

    worldEl.appendChild(el);
  });
}

function travelTo(tile) {
  state.day += 1;
  state.playerPos = { x: tile.x, y: tile.y };
  state.player.stamina = Math.max(10, state.player.stamina - 5);
  awardPractice('endurance', 1);
  awardPractice('dexterity', 1);
  awardPractice('survival', 1);
  addLog(`You traversed ${tile.type} terrain and conserved supplies.`);

  if (Math.random() > 0.62) {
    spawnEncounter();
  } else {
    panelTitleEl.textContent = 'Road Journal';
    panelTextEl.textContent = 'Quiet passage. Rest at camp to recover stamina and focus.';
    actionsEl.innerHTML = '';
    createAction('Make Camp', rest);
  }
  updateHud();
  renderMap();
}

function rest() {
  state.day += 1;
  const heal = 10 + state.player.stats.endurance;
  state.player.hp = Math.min(100, state.player.hp + heal);
  state.player.stamina = Math.min(100, state.player.stamina + 30);
  state.player.focus = Math.min(100, state.player.focus + 20);
  awardPractice('medicine', 1);
  awardPractice('discipline', 1);
  awardPractice('willpower', 1);
  addLog('You made camp and treated fatigue and bruises.');
  panelTextEl.textContent = 'Body restored; morale steadied by routine.';
  updateHud();
}

function spawnEncounter() {
  state.mode = 'combat';
  state.enemy = {
    name: Math.random() > 0.5 ? 'Raider' : 'Ghoul',
    hp: 45 + Math.floor(Math.random() * 20),
    poise: 40,
    bleed: 0,
    pos: { ...state.playerPos },
  };
  state.combatRound = 1;
  panelTitleEl.textContent = `Combat: ${state.enemy.name}`;
  panelTextEl.textContent = 'Turn-based duel. Every action taxes stamina and focus. Target poise, then flesh.';
  addLog(`A ${state.enemy.name} ambushes you. Combat begins.`);
  renderCombatActions();
}

function createAction(label, fn) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', fn);
  actionsEl.appendChild(btn);
}

function renderCombatActions() {
  actionsEl.innerHTML = '';
  createAction('Measured Strike', () => playerAttack('measured'));
  createAction('Feint & Cut', () => playerAttack('feint'));
  createAction('Guard', playerGuard);
  createAction('Assess Wound', assessWound);
}

function playerAttack(style) {
  if (state.player.stamina < 8) return addLog('Too exhausted to mount an attack.');
  const { strength, dexterity, intelligence } = state.player.stats;
  const sword = state.player.skills.swordplay;
  const evasion = state.player.skills.evasion;
  let hitChance = 0.55 + dexterity * 0.025 + sword * 0.02;
  let poiseDamage = 0;
  let fleshDamage = 0;

  if (style === 'feint') {
    hitChance += intelligence * 0.015;
    poiseDamage = 8 + dexterity + sword;
    fleshDamage = 4 + Math.floor(strength * 0.7);
    state.player.focus -= 8;
    awardPractice('intelligence', 1);
  } else {
    poiseDamage = 6 + Math.floor(strength * 0.8);
    fleshDamage = 6 + strength + Math.floor(sword / 2);
    state.player.focus -= 4;
  }

  state.player.stamina -= 10;
  awardPractice('strength', 1);
  awardPractice('dexterity', 1);
  awardPractice('swordplay', 1);

  if (Math.random() < hitChance) {
    state.enemy.poise -= poiseDamage;
    const vulnerability = state.enemy.poise <= 0 ? 1.7 : 1;
    const damage = Math.floor(fleshDamage * vulnerability);
    state.enemy.hp -= damage;
    state.enemy.bleed += style === 'feint' ? 2 : 1;
    addLog(`Hit landed: ${damage} wound, ${poiseDamage} poise damage.`);
  } else {
    awardPractice('evasion', 1);
    addLog(`Your ${style} attack misses as the foe shifts stance.`);
  }

  endTurn();
}

function playerGuard() {
  state.player.stamina = Math.min(100, state.player.stamina + 6);
  state.player.focus = Math.min(100, state.player.focus + 4);
  awardPractice('willpower', 1);
  awardPractice('discipline', 1);
  addLog('You tighten guard, recover breath, and reset distance.');
  enemyTurn(0.65);
}

function assessWound() {
  const detail = state.enemy.poise <= 0
    ? 'Foe balance broken; finishing strikes are highly effective.'
    : `Foe poise at ${Math.max(0, Math.floor(state.enemy.poise))}; keep pressure with feints.`;
  panelTextEl.textContent = detail;
  state.player.focus = Math.max(0, state.player.focus - 3);
  awardPractice('medicine', 1);
  awardPractice('intelligence', 1);
  enemyTurn(1);
}

function enemyTurn(multiplier = 1) {
  if (!state.enemy) return;
  const swing = 7 + Math.floor(Math.random() * 9) + state.combatRound;
  const dodgeChance = 0.22 + state.player.stats.dexterity * 0.02 + state.player.skills.evasion * 0.03;
  if (Math.random() < dodgeChance) {
    addLog('You evade the incoming blow.');
    awardPractice('evasion', 1);
  } else {
    const dmg = Math.floor(swing * multiplier);
    state.player.hp -= dmg;
    state.player.stamina = Math.max(0, state.player.stamina - 6);
    addLog(`Enemy strikes for ${dmg}. Armor straps strain under impact.`);
    awardPractice('endurance', 1);
  }

  if (state.enemy.bleed > 0) {
    state.enemy.hp -= state.enemy.bleed;
    addLog(`Bleeding drains foe for ${state.enemy.bleed}.`);
  }
  endTurn(false);
}

function endTurn(playerActed = true) {
  updateHud();

  if (state.enemy && state.enemy.hp <= 0) {
    addLog(`You survive the encounter with the ${state.enemy.name}.`);
    state.mode = 'explore';
    state.enemy = null;
    actionsEl.innerHTML = '';
    panelTitleEl.textContent = 'Aftermath';
    panelTextEl.textContent = 'You gather yourself and return to cautious travel.';
    createAction('Continue Journey', () => {
      panelTitleEl.textContent = 'Road Journal';
      panelTextEl.textContent = 'The Ashen Marches still swallow travelers. Move carefully.';
      actionsEl.innerHTML = '';
      createAction('Make Camp', rest);
    });
    renderMap();
    return;
  }

  if (state.player.hp <= 0) {
    addLog('You collapse in the mud. The march ends here.');
    panelTitleEl.textContent = 'Defeat';
    panelTextEl.textContent = 'Refresh the page to attempt another life on the road.';
    actionsEl.innerHTML = '';
    return;
  }

  if (state.mode === 'combat' && playerActed) {
    state.combatRound += 1;
    enemyTurn();
  } else if (state.mode === 'combat') {
    renderCombatActions();
    panelTextEl.textContent = `Round ${state.combatRound}. Enemy HP ${Math.max(0, Math.floor(state.enemy.hp))}, Poise ${Math.max(0, Math.floor(state.enemy.poise))}.`;
  }
}

function init() {
  buildMap();
  updateHud();
  renderMap();
  actionsEl.innerHTML = '';
  createAction('Make Camp', rest);
  addLog('You enter the Ashen Marches under a moonless sky.');
}

window.addEventListener('resize', renderMap);
init();
