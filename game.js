const SLOT_ORDER = [
  'weapon', 'helmet', 'offhand', 'armor', 'belt', 'leggings', 'boots',
  'gloves', 'necklace', 'ring1', 'ring2', 'trinket1', 'trinket2',
];

const LAYER_SLOT_MAP = {
  weapon: 'weapon',
  offhand: 'offhand',
  helmet: 'helmet',
  armor: 'armor',
  leggings: 'leggings',
  boots: 'boots',
  gloves: 'gloves',
  necklace: 'ornament',
  ring1: 'ornament',
  ring2: 'ornament',
  trinket1: 'ornament',
  trinket2: 'ornament',
};

const state = {
  mode: 'explore',
  day: 1,
  mapSize: 12,
  player: {
    pos: { x: 6, y: 6 },
    hp: 100,
    stamina: 100,
    focus: 65,
    stats: { strength: 7, dexterity: 7, intelligence: 6, endurance: 7, willpower: 6 },
    skills: { swordplay: 1, evasion: 1, medicine: 1, survival: 1, discipline: 1 },
    xp: {},
    equipment: {},
    inventory: [],
  },
  joystick: { active: false, dx: 0, dy: 0 },
  monsters: [],
  bestiary: [],
  itemPool: [],
  encounter: null,
};

const worldEl = document.getElementById('world');
const playerEl = document.getElementById('playerCharacter');
const statsEl = document.getElementById('coreStats');
const resourceEl = document.getElementById('resourceBars');
const panelTitleEl = document.getElementById('panelTitle');
const panelTextEl = document.getElementById('panelText');
const actionsEl = document.getElementById('actions');
const inventoryEl = document.getElementById('inventory');
const logEl = document.getElementById('log');
const encounterEl = document.getElementById('encounterPanel');
const joystickEl = document.getElementById('joystick');
const joystickKnobEl = document.getElementById('joystickKnob');

function addLog(text) {
  const p = document.createElement('p');
  p.textContent = `[Day ${state.day}] ${text}`;
  logEl.prepend(p);
}

function roll(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function awardPractice(key, amount, threshold = 8) {
  state.player.xp[key] = (state.player.xp[key] || 0) + amount;
  if (state.player.xp[key] >= threshold) {
    state.player.xp[key] = 0;
    if (state.player.stats[key] !== undefined) {
      state.player.stats[key] += 1;
      addLog(`${key} improved from repeated strain and practice.`);
    }
    if (state.player.skills[key] !== undefined) {
      state.player.skills[key] += 1;
      addLog(`${key} skill advanced to ${state.player.skills[key]}.`);
    }
  }
}

function tileType() {
  const r = Math.random();
  if (r > 0.87) return 'water';
  if (r > 0.68) return 'ruin';
  if (r > 0.38) return 'road';
  return 'grass';
}

function buildWorld() {
  worldEl.querySelectorAll('.tile,.monster').forEach((n) => n.remove());
  for (let y = 0; y < state.mapSize; y += 1) {
    for (let x = 0; x < state.mapSize; x += 1) {
      const tile = document.createElement('div');
      const t = tileType();
      tile.className = `tile ${t}`;
      tile.dataset.x = x;
      tile.dataset.y = y;
      const iso = isoPosition(x, y);
      tile.style.left = `${iso.x}px`;
      tile.style.top = `${iso.y}px`;
      worldEl.appendChild(tile);
    }
  }
}

function isoPosition(x, y) {
  const size = 42;
  return {
    x: (x - y) * size + worldEl.clientWidth / 2 - 40,
    y: (x + y) * (size / 2) + 28,
  };
}

function renderPlayer() {
  const p = state.player.pos;
  const iso = isoPosition(p.x, p.y);
  playerEl.style.left = `${iso.x + 42}px`;
  playerEl.style.top = `${iso.y + 26}px`;
}

function generateItems() {
  const slots = {
    weapon: ['Falchion', 'Arming Sword', 'War Hammer', 'Spear', 'Hatchet'],
    helmet: ['Iron Cap', 'Leather Coif', 'Nasal Helm', 'Bone Visor', 'Warden Hood'],
    offhand: ['Kite Shield', 'Buckler', 'Lantern Charm', 'Tome Plate', 'Parry Dagger'],
    armor: ['Gambeson', 'Mail Hauberk', 'Scale Vest', 'Lamellar Coat', 'Brigandine'],
    belt: ['Rope Belt', 'Studded Belt', 'Mercenary Belt', 'Bone Clasp', 'Alchemist Sash'],
    leggings: ['Wool Hose', 'Mail Chausses', 'Rider Leggings', 'Riveted Cuisses', 'Hunter Wrap'],
    boots: ['Mud Boots', 'Riding Boots', 'Iron Sabatons', 'Tracker Boots', 'Ash Boots'],
    gloves: ['Work Gloves', 'Padded Gloves', 'Mail Mitts', 'Falcon Gloves', 'Ritual Gloves'],
    necklace: ['Bronze Chain', 'Oath Locket', 'Night Reliquary', 'Fang Thread', 'Saint Bone'],
    ring1: ['Copper Ring', 'Silver Signet', 'Garnet Band', 'Rune Ring', 'Ash Ring'],
    ring2: ['Tin Loop', 'Pilgrim Ring', 'Black Steel Band', 'Worn Ring', 'Moon Band'],
    trinket1: ['Bone Dice', 'Wax Idol', 'Hawk Feather', 'Old Coin', 'Witch Knot'],
    trinket2: ['Tooth Charm', 'Mini Reliquary', 'Rune Pebble', 'Torn Banner', 'Prayer Bead'],
  };

  const rarities = ['common', 'sturdy', 'rare', 'ancient'];
  const pool = [];
  let id = 1;
  SLOT_ORDER.forEach((slot, slotIndex) => {
    for (let i = 0; i < 16; i += 1) {
      const base = slots[slot][i % slots[slot].length];
      const rarity = rarities[i % rarities.length];
      const tier = 1 + Math.floor(i / 4);
      pool.push({
        id: `item-${id += 1}`,
        slot,
        name: `${rarity.toUpperCase()} ${base} ${tier}`,
        stats: {
          strength: (slot === 'weapon' || slot === 'armor') ? tier : 0,
          dexterity: (slot === 'boots' || slot === 'gloves') ? tier : 0,
          intelligence: (slot.includes('trinket') || slot === 'necklace') ? tier : 0,
          endurance: (slot === 'helmet' || slot === 'leggings') ? tier : 0,
          willpower: (slot === 'belt' || slot.includes('ring')) ? tier : 0,
        },
        appearance: {
          layer: LAYER_SLOT_MAP[slot],
          hue: (slotIndex * 26 + i * 7) % 360,
          light: 35 + (tier * 6),
          anim: ['none', 'pulse', 'glint', 'ember'][tier % 4],
        },
        tier,
      });
    }
  });

  state.itemPool = pool.slice(0, 200);
  state.player.inventory = [...state.itemPool.slice(0, 36)];
}

function applyEquipmentVisuals() {
  const layers = ['helmet', 'armor', 'leggings', 'boots', 'gloves', 'weapon', 'offhand', 'ornament'];
  layers.forEach((layerName) => {
    const layer = playerEl.querySelector(`.layer.${layerName}`);
    if (!layer) return;
    layer.style.background = 'transparent';
    layer.style.boxShadow = 'none';
    layer.style.animation = 'none';
  });

  Object.values(state.player.equipment).forEach((item) => {
    if (!item) return;
    const target = playerEl.querySelector(`.layer.${item.appearance.layer}`);
    if (!target) return;
    target.style.background = `hsl(${item.appearance.hue} 45% ${item.appearance.light}%)`;
    target.style.boxShadow = `0 0 7px hsla(${item.appearance.hue} 70% 60% / 0.55)`;
    if (item.appearance.anim === 'pulse') target.style.animation = 'monsterFloat 0.9s ease-in-out infinite alternate';
    if (item.appearance.anim === 'glint') target.style.animation = 'walkBob 0.35s ease-in-out infinite alternate';
    if (item.appearance.anim === 'ember') target.style.animation = 'attackLunge 0.5s linear infinite alternate';
  });
}

function equipItem(item) {
  state.player.equipment[item.slot] = item;
  addLog(`Equipped ${item.name} on ${item.slot}.`);
  applyEquipmentVisuals();
  updateHud();
}

function renderInventory() {
  inventoryEl.innerHTML = '<strong>Inventory (tap to equip)</strong>';
  state.player.inventory.slice(0, 24).forEach((item) => {
    const btn = document.createElement('button');
    btn.textContent = `${item.slot}: ${item.name}`;
    btn.addEventListener('click', () => equipItem(item));
    inventoryEl.appendChild(btn);
  });
}

function generateBestiary() {
  const names = [
    'Bog Ghoul', 'Fen Raider', 'Crypt Hound', 'Ash Spider', 'Hollow Monk',
    'Rook Bandit', 'Rot Boar', 'Cairn Witch', 'Mire Stalker', 'Grave Crow',
    'Warden Shade', 'Pike Marauder', 'Blight Wolf', 'Bone Knight', 'Thorn Devourer',
    'Howling Penitent', 'Stone Revenant', 'Blood Vicar', 'Maw Leech', 'Iron Troll',
    'Dread Pilgrim', 'Fog Serpent', 'Ruin Harpy', 'Oathbreaker', 'Nightsworn Giant',
  ];

  state.bestiary = names.map((name, i) => ({
    id: `monster-${i + 1}`,
    name,
    tier: 1 + Math.floor(i / 5),
    hp: 34 + i * 5,
    poise: 24 + i * 3,
    attack: 8 + i,
    evasion: 0.06 + i * 0.005,
    hue: (i * 15) % 360,
  }));
}

function spawnRoamingMonsters(count = 8) {
  worldEl.querySelectorAll('.monster').forEach((m) => m.remove());
  state.monsters = [];
  for (let i = 0; i < count; i += 1) {
    const type = state.bestiary[roll(0, state.bestiary.length - 1)];
    const x = roll(1, state.mapSize - 2);
    const y = roll(1, state.mapSize - 2);
    const monster = { ...type, uid: `spawn-${Date.now()}-${i}`, x, y, hpCurrent: type.hp, poiseCurrent: type.poise };
    state.monsters.push(monster);
    drawMonster(monster);
  }
}

function drawMonster(monster) {
  const el = document.createElement('div');
  el.className = 'monster';
  el.dataset.uid = monster.uid;
  el.style.background = `radial-gradient(circle at 35% 35%, hsl(${monster.hue} 70% 65%), hsl(${monster.hue} 35% 28%))`;
  const iso = isoPosition(monster.x, monster.y);
  el.style.left = `${iso.x + 42}px`;
  el.style.top = `${iso.y + 26}px`;
  worldEl.appendChild(el);
}

function updateHud() {
  statsEl.innerHTML = '';
  Object.entries(state.player.stats).forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'pill';
    d.textContent = `${k.slice(0, 3).toUpperCase()} ${v}`;
    statsEl.appendChild(d);
  });
  resourceEl.innerHTML = '';
  [
    ['HP', state.player.hp], ['STM', state.player.stamina], ['FOC', state.player.focus],
    ['SKL', state.player.skills.swordplay], ['DAY', state.day],
  ].forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'pill';
    d.textContent = `${k} ${Math.round(v)}`;
    resourceEl.appendChild(d);
  });
}

function distance(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy);
}

function beginCombat(monster) {
  state.mode = 'combat';
  state.encounter = { ...monster };
  panelTitleEl.textContent = `Combat: ${monster.name}`;
  panelTextEl.textContent = 'Turn-based engagement. Break poise, manage stamina, and commit to timing.';
  playerEl.classList.add('attacking');
  setTimeout(() => playerEl.classList.remove('attacking'), 260);
  renderCombatActions();
  addLog(`Encountered ${monster.name} (Tier ${monster.tier}).`);
}

function renderCombatActions() {
  actionsEl.innerHTML = '';
  [
    ['Measured Strike', () => playerAttack('measured')],
    ['Driving Cut', () => playerAttack('driving')],
    ['Guard Stance', playerGuard],
    ['Clinical Read', assessEnemy],
  ].forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', fn);
    actionsEl.appendChild(b);
  });
}

function derivedAttackPower() {
  const eq = Object.values(state.player.equipment);
  const bonus = eq.reduce((sum, item) => sum + (item?.tier || 0), 0);
  return state.player.stats.strength + state.player.skills.swordplay + Math.floor(bonus / 3);
}

function playerAttack(style) {
  if (!state.encounter) return;
  const p = state.player;
  if (p.stamina < 8) return addLog('You are too exhausted for committed offense.');

  const atk = derivedAttackPower();
  let hit = 0.56 + p.stats.dexterity * 0.02 - state.encounter.evasion;
  let poise = 6 + Math.floor(atk * 0.75);
  let flesh = 7 + atk;
  if (style === 'driving') {
    hit -= 0.07;
    poise += 8;
    flesh += 5;
    p.focus -= 8;
  } else {
    p.focus -= 4;
  }

  p.stamina -= 10;
  awardPractice('strength', 1);
  awardPractice('dexterity', 1);
  awardPractice('swordplay', 1);

  if (Math.random() < hit) {
    state.encounter.poiseCurrent -= poise;
    const vuln = state.encounter.poiseCurrent <= 0 ? 1.6 : 1;
    const dmg = Math.floor(flesh * vuln);
    state.encounter.hpCurrent -= dmg;
    addLog(`You hit for ${dmg} and reduced poise by ${poise}.`);
  } else {
    addLog('Your strike glances wide.');
    awardPractice('evasion', 1);
  }
  resolveCombatRound(true);
}

function playerGuard() {
  state.player.stamina = clamp(state.player.stamina + 8, 0, 100);
  state.player.focus = clamp(state.player.focus + 5, 0, 100);
  awardPractice('discipline', 1);
  awardPractice('willpower', 1);
  addLog('You raise guard and recover your breathing cadence.');
  resolveCombatRound(false, 0.58);
}

function assessEnemy() {
  if (!state.encounter) return;
  panelTextEl.textContent = `${state.encounter.name} — HP ${Math.max(0, Math.floor(state.encounter.hpCurrent))}, Poise ${Math.max(0, Math.floor(state.encounter.poiseCurrent))}.`;
  state.player.focus = clamp(state.player.focus - 3, 0, 100);
  awardPractice('medicine', 1);
  awardPractice('intelligence', 1);
  resolveCombatRound(false, 1);
}

function resolveCombatRound(playerCommitted, mitigation = 1) {
  if (!state.encounter) return;

  if (state.encounter.hpCurrent <= 0) {
    addLog(`You defeated ${state.encounter.name}.`);
    state.mode = 'explore';
    state.day += 1;
    state.player.stamina = clamp(state.player.stamina + 12, 0, 100);
    state.player.focus = clamp(state.player.focus + 6, 0, 100);
    removeMonsterByName(state.encounter.name);
    state.encounter = null;
    actionsEl.innerHTML = '';
    panelTitleEl.textContent = 'Road Journal';
    panelTextEl.textContent = 'The road opens again. Hunt, rest, and improve through use.';
    updateHud();
    return;
  }

  const dodge = 0.2 + state.player.stats.dexterity * 0.018 + state.player.skills.evasion * 0.02;
  if (Math.random() < dodge) {
    addLog('You evade the monster attack.');
    awardPractice('evasion', 1);
  } else {
    const inc = Math.floor((state.encounter.attack + roll(0, 6)) * mitigation);
    state.player.hp -= inc;
    state.player.stamina = clamp(state.player.stamina - 5, 0, 100);
    addLog(`${state.encounter.name} hits for ${inc}.`);
    awardPractice('endurance', 1);
  }

  if (state.player.hp <= 0) {
    actionsEl.innerHTML = '';
    panelTitleEl.textContent = 'Defeat';
    panelTextEl.textContent = 'You fell in the mud and shadow.';
    addLog('You were slain. Refresh to begin again.');
    return;
  }

  if (playerCommitted) {
    playerEl.classList.add('attacking');
    setTimeout(() => playerEl.classList.remove('attacking'), 260);
  }
  panelTextEl.textContent = `${state.encounter.name} | HP ${Math.max(0, Math.floor(state.encounter.hpCurrent))} | Poise ${Math.max(0, Math.floor(state.encounter.poiseCurrent))}`;
  updateHud();
}

function removeMonsterByName(name) {
  const idx = state.monsters.findIndex((m) => m.name === name);
  if (idx >= 0) {
    const uid = state.monsters[idx].uid;
    state.monsters.splice(idx, 1);
    const node = worldEl.querySelector(`.monster[data-uid='${uid}']`);
    if (node) node.remove();
  }
}

function movePlayer(dx, dy) {
  if (state.mode !== 'explore') return;
  if (dx === 0 && dy === 0) {
    playerEl.classList.remove('walking');
    return;
  }

  const nx = clamp(state.player.pos.x + dx, 0, state.mapSize - 1);
  const ny = clamp(state.player.pos.y + dy, 0, state.mapSize - 1);
  if (nx === state.player.pos.x && ny === state.player.pos.y) return;

  state.player.pos.x = nx;
  state.player.pos.y = ny;
  state.day += 0.03;
  state.player.stamina = clamp(state.player.stamina - 0.35, 0, 100);
  awardPractice('endurance', 0.4, 12);
  awardPractice('dexterity', 0.4, 12);
  awardPractice('survival', 0.35, 12);

  playerEl.classList.add('walking');
  renderPlayer();
  checkMonsterContact();
  updateHud();
}

function checkMonsterContact() {
  const target = state.monsters.find((m) => distance(state.player.pos, m) <= 1);
  if (target) beginCombat(target);
}

function handleJoystickStart(ev) {
  state.joystick.active = true;
  updateJoystick(ev);
}

function handleJoystickMove(ev) {
  if (!state.joystick.active) return;
  updateJoystick(ev);
}

function handleJoystickEnd() {
  state.joystick.active = false;
  state.joystick.dx = 0;
  state.joystick.dy = 0;
  joystickKnobEl.style.transform = 'translate(0px, 0px)';
  playerEl.classList.remove('walking');
}

function updateJoystick(ev) {
  const touch = ev.touches ? ev.touches[0] : ev;
  const rect = joystickEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rawX = touch.clientX - cx;
  const rawY = touch.clientY - cy;
  const dist = Math.sqrt(rawX ** 2 + rawY ** 2);
  const max = 34;
  const scale = dist > max ? max / dist : 1;
  const x = rawX * scale;
  const y = rawY * scale;

  joystickKnobEl.style.transform = `translate(${x}px, ${y}px)`;

  const ndx = Math.abs(x) < 10 ? 0 : (x > 0 ? 1 : -1);
  const ndy = Math.abs(y) < 10 ? 0 : (y > 0 ? 1 : -1);
  state.joystick.dx = ndx;
  state.joystick.dy = ndy;
}

function gameLoop() {
  movePlayer(state.joystick.dx, state.joystick.dy);
  const content = state.encounter
    ? `${state.encounter.name} presses in. Use tactical actions to break poise.`
    : `Roaming monsters: ${state.monsters.length}. 25 monster families are active in regional spawns.`;
  encounterEl.textContent = content;
  requestAnimationFrame(gameLoop);
}

function bindJoystick() {
  joystickEl.addEventListener('touchstart', handleJoystickStart, { passive: true });
  joystickEl.addEventListener('touchmove', handleJoystickMove, { passive: true });
  joystickEl.addEventListener('touchend', handleJoystickEnd, { passive: true });
  joystickEl.addEventListener('mousedown', handleJoystickStart);
  window.addEventListener('mousemove', handleJoystickMove);
  window.addEventListener('mouseup', handleJoystickEnd);
}

function initStarterGear() {
  SLOT_ORDER.forEach((slot, index) => {
    equipItem(state.itemPool[index]);
  });
}

function init() {
  generateItems();
  generateBestiary();
  buildWorld();
  spawnRoamingMonsters(9);
  initStarterGear();
  renderInventory();
  renderPlayer();
  bindJoystick();
  updateHud();
  addLog('You step into the Ashen Marches with layered gear and hard lessons.');
  panelTextEl.textContent = 'Move using the circular joystick for seamless 8-direction movement. Entering melee radius triggers turn-based combat.';
  gameLoop();
}

window.addEventListener('resize', () => {
  buildWorld();
  spawnRoamingMonsters(9);
  renderPlayer();
});

init();
