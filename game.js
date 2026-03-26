const MAP_SIZE = 256;
const VIEW_RADIUS = 11;
const SLOT_ORDER = ['weapon', 'helmet', 'offhand', 'armor', 'belt', 'leggings', 'boots', 'gloves', 'necklace', 'ring1', 'ring2', 'trinket1', 'trinket2'];

const state = {
  mode: 'explore',
  day: 1,
  stepMs: 75,
  lastStep: 0,
  player: {
    pos: { x: 128, y: 128 },
    hp: 120,
    stamina: 100,
    focus: 70,
    fatigue: 0,
    bodyTemp: 36.8,
    stats: { strength: 7, dexterity: 7, intelligence: 6, endurance: 8, willpower: 6 },
    xp: {},
    equipment: {},
    inventory: [],
  },
  joystick: { active: false, dx: 0, dy: 0 },
  itemPool: [],
  bestiary: [],
  monsters: [],
  encounter: null,
};

const el = {
  world: document.getElementById('world'),
  player: document.getElementById('player'),
  coreStats: document.getElementById('coreStats'),
  resourceBars: document.getElementById('resourceBars'),
  encounter: document.getElementById('encounterPanel'),
  actions: document.getElementById('actions'),
  equipment: document.getElementById('equipmentSlots'),
  inventory: document.getElementById('inventory'),
  log: document.getElementById('log'),
  characterPreview: document.getElementById('characterPreview'),
  characterDetails: document.getElementById('characterDetails'),
  joystick: document.getElementById('joystick'),
  knob: document.getElementById('joystickKnob'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
};

function addLog(t) { const p = document.createElement('p'); p.textContent = `[Day ${Math.floor(state.day)}] ${t}`; el.log.prepend(p); }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const SAVE_KEY = 'ashen_marches_save_v1';

function knightSvg(weaponHue = 24, armorHue = 220, trimHue = 45) {
  return `<svg viewBox='0 0 120 160' xmlns='http://www.w3.org/2000/svg'>
    <g stroke='#18131f' stroke-width='2.6' stroke-linejoin='round' stroke-linecap='round'>
      <path d='M45 150 L60 88 L75 150 Z' fill='hsl(${trimHue} 48% 30%)'/>
      <ellipse cx='60' cy='43' rx='20' ry='18' fill='hsl(32 22% 76%)'/>
      <path d='M40 45 Q60 18 80 45 L78 56 L42 56 Z' fill='hsl(${armorHue} 22% 64%)'/>
      <rect x='38' y='60' width='44' height='44' rx='12' fill='hsl(${armorHue} 24% 54%)'/>
      <rect x='31' y='68' width='10' height='38' rx='4' fill='hsl(${armorHue} 20% 46%)'/>
      <rect x='79' y='68' width='10' height='38' rx='4' fill='hsl(${armorHue} 20% 46%)'/>
      <path d='M51 64 L69 64 L66 84 L54 84 Z' fill='hsl(${trimHue} 65% 44%)'/>
      <rect x='47' y='102' width='12' height='34' rx='4' fill='hsl(${armorHue} 18% 40%)'/>
      <rect x='61' y='102' width='12' height='34' rx='4' fill='hsl(${armorHue} 18% 40%)'/>
      <rect x='45' y='132' width='16' height='10' rx='4' fill='hsl(${armorHue} 24% 28%)'/>
      <rect x='59' y='132' width='16' height='10' rx='4' fill='hsl(${armorHue} 24% 28%)'/>
      <path d='M86 44 L92 100 L84 101 L78 47 Z' fill='hsl(${weaponHue} 60% 66%)'/>
      <rect x='74' y='81' width='24' height='6' rx='2' transform='rotate(10 86 84)' fill='hsl(${weaponHue} 45% 34%)'/>
      <circle cx='54' cy='44' r='2.1' fill='#1d171d'/>
      <circle cx='66' cy='44' r='2.1' fill='#1d171d'/>
    </g>
  </svg>`;
}

function applyKnight() {
  const w = state.player.equipment.weapon?.appearance?.hue ?? 24;
  const a = state.player.equipment.armor?.appearance?.hue ?? 220;
  const t = state.player.equipment.necklace?.appearance?.hue ?? 45;
  const svg = knightSvg(w, a, t);
  el.player.innerHTML = svg;
  el.characterPreview.innerHTML = svg;
}

function iso(x, y) {
  const s = 38;
  return { x: (x - y) * (s / 2) + el.world.clientWidth / 2 - 38, y: (x + y) * (s / 4) + 24 };
}

function biomeAt(x, y) {
  const n = Math.sin(x * 0.045) + Math.cos(y * 0.038) + Math.sin((x + y) * 0.02);
  if (n > 1.5) return 'frost';
  if (n > 0.9) return 'grass';
  if (n > 0.3) return 'road';
  if (n > -0.2) return 'swamp';
  if (n > -0.8) return 'ruin';
  if (n > -1.3) return 'desert';
  return 'water';
}

function biomeTravelProfile(biome) {
  const table = {
    road: { stamina: 0.7, fatigue: 0.35, temp: 0.0, danger: 0.85 },
    grass: { stamina: 1.0, fatigue: 0.55, temp: 0.0, danger: 1.0 },
    swamp: { stamina: 1.45, fatigue: 0.9, temp: -0.08, danger: 1.35 },
    frost: { stamina: 1.25, fatigue: 0.75, temp: -0.14, danger: 1.25 },
    desert: { stamina: 1.3, fatigue: 0.8, temp: 0.12, danger: 1.2 },
    ruin: { stamina: 1.15, fatigue: 0.7, temp: -0.03, danger: 1.4 },
    water: { stamina: 1.7, fatigue: 1.05, temp: -0.11, danger: 1.6 },
  };
  return table[biome] || table.grass;
}

function decoSeed(x, y) {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function renderMapChunk() {
  el.world.querySelectorAll('.tile,.monster,.deco').forEach((n) => n.remove());
  const { x: px, y: py } = state.player.pos;
  const fragment = document.createDocumentFragment();
  for (let y = py - VIEW_RADIUS; y <= py + VIEW_RADIUS; y += 1) {
    for (let x = px - VIEW_RADIUS; x <= px + VIEW_RADIUS; x += 1) {
      if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) continue;
      const tile = document.createElement('div');
      const biome = biomeAt(x, y);
      tile.className = `tile ${biome}`;
      const p = iso(x - px + VIEW_RADIUS, y - py + VIEW_RADIUS);
      tile.style.left = `${p.x}px`;
      tile.style.top = `${p.y}px`;
      fragment.appendChild(tile);
      if (decoSeed(x, y) < 0.22) {
        const deco = document.createElement('div');
        deco.className = `deco ${decoForBiome(biome)}`;
        deco.style.left = `${p.x + 34}px`;
        deco.style.top = `${p.y + 8}px`;
        fragment.appendChild(deco);
      }
    }
  }
  fragment.appendChild(drawMonsters());
  el.world.appendChild(fragment);
  el.world.appendChild(el.player);
  renderPlayer();
}

function decoForBiome(biome) {
  if (biome === 'grass') return 'tree';
  if (biome === 'swamp') return 'reed';
  if (biome === 'desert') return 'stone';
  if (biome === 'frost') return 'frostshrub';
  if (biome === 'ruin') return 'ruin';
  return 'stone';
}

function renderPlayer() {
  if (!el.player.innerHTML.trim()) applyKnight();
  const center = iso(VIEW_RADIUS, VIEW_RADIUS);
  el.player.style.left = `${center.x + 38}px`;
  el.player.style.top = `${center.y + 26}px`;
}

function iconSvg(item) {
  const h = item.appearance.hue;
  if (item.slot === 'weapon') return `<svg viewBox='0 0 40 40'><rect x='18' y='4' width='4' height='24' rx='2' fill='hsl(${h} 60% 64%)'/><rect x='12' y='23' width='16' height='3' rx='2' fill='hsl(${h} 40% 30%)'/></svg>`;
  if (['armor','helmet','offhand','belt','leggings','boots','gloves'].includes(item.slot)) return `<svg viewBox='0 0 40 40'><rect x='8' y='8' width='24' height='24' rx='8' fill='hsl(${h} 34% 45%)'/></svg>`;
  return `<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='10' fill='hsl(${h} 65% 58%)'/></svg>`;
}

function itemDesc(slot, s) {
  if (slot === 'weapon') return `DMG ${s.damage} | SPD ${s.attackSpeed} | CRIT ${s.crit}% | REACH ${s.reach} | STUN ${s.stunChance}%`;
  if (['armor','helmet','offhand','belt','leggings','boots','gloves'].includes(slot)) return `DEF ${s.defense} | HP +${s.hpIncrease} | EVA ${s.evasion}%`;
  return `STR +${s.strength} | INT +${s.intelligence} | WIL +${s.willpower} | CRIT +${s.crit}%`;
}

function generateItems() {
  state.itemPool = [];
  const names = {
    weapon:['Knight Sword','Spear','Falchion','Mace','War Pick'], helmet:['Iron Coif','Nasal Helm','Visor','Padded Coif','Chapel Helm'],
    offhand:['Kite Shield','Buckler','Parry Dagger','Hook Shield','Lantern Guard'], armor:['Gambeson','Mail Hauberk','Scale Coat','Brigandine','Cuir Bouilli'],
    belt:['Studded Belt','Mercenary Belt','Oath Sash','Chain Belt','Hunter Cord'], leggings:['Rider Leggings','Mail Chausses','Riveted Cuisses','Padded Hose','Ash Greaves'],
    boots:['Riding Boots','Mud Boots','Sabatons','Path Boots','Barrow Boots'], gloves:['Padded Gloves','Mail Mitts','Grip Gloves','Ash Gloves','Knight Gauntlets'],
    necklace:['Reliquary','Sun Chain','Bone Charm','Oath Locket','Runed Necklace'], ring1:['Silver Ring','Garnet Ring','Ash Ring','Rune Ring','Knight Signet'],
    ring2:['Copper Ring','Pilgrim Ring','Moon Ring','Iron Ring','Dust Band'], trinket1:['Saint Token','Witch Knot','Bone Dice','War Medal','Fog Charm'],
    trinket2:['Tooth Charm','Prayer Bead','Coin Relic','Rune Pebble','Crow Feather'],
  };
  const rar = ['common','sturdy','rare','ancient'];
  let id = 0;
  SLOT_ORDER.forEach((slot, si) => {
    for (let i = 0; i < 16; i += 1) {
      const p = 1 + Math.floor(i / 4) + (i % 4);
      const s = {strength:0,intelligence:0,willpower:0,damage:0,attackSpeed:0,crit:0,reach:0,stunChance:0,defense:0,hpIncrease:0,evasion:0};
      if (slot === 'weapon') { s.damage = 8 + p * 3; s.attackSpeed = +(0.8 + p * 0.05).toFixed(2); s.crit = 3 + p * 2; s.reach = 1 + Math.floor(p/2); s.stunChance = 2 + p; s.strength = Math.floor(p/2); }
      else if (['armor','helmet','offhand','belt','leggings','boots','gloves'].includes(slot)) { s.defense = 4 + p * 2; s.hpIncrease = 10 + p * 5; s.evasion = Math.max(1, 10 - p); }
      else { s.strength = slot.includes('ring') ? 1 : 0; s.intelligence = Math.floor(p/2); s.willpower = Math.ceil(p/2); s.crit = p; }
      state.itemPool.push({ id:`it-${++id}`, slot, rarity:rar[i%4], tier:1+Math.floor(i/4), name:`${rar[i%4].toUpperCase()} ${names[slot][i%5]} ${1+Math.floor(i/4)}`, stats:s, appearance:{hue:(si*27+i*9)%360} });
    }
  });
  state.itemPool = state.itemPool.slice(0, 200);
  state.player.inventory = state.itemPool.slice(0, 50);
}

function equipItem(item) {
  state.player.equipment[item.slot] = item;
  applyKnight();
  renderEquipment();
  updateHud();
  renderCharacterScreen();
  addLog(`Equipped ${item.name}.`);
}

function renderEquipment() {
  el.equipment.innerHTML = '';
  SLOT_ORDER.forEach((slot) => {
    const it = state.player.equipment[slot];
    const row = document.createElement('div'); row.className = 'slot-row';
    row.innerHTML = `<strong>${slot}</strong><small>${it ? it.name : 'Empty'}</small><small>${it ? itemDesc(slot, it.stats) : 'No stats'}</small>`;
    el.equipment.appendChild(row);
  });
}

function renderInventory() {
  el.inventory.innerHTML = '';
  state.player.inventory.slice(0, 30).forEach((item) => {
    const c = document.createElement('div'); c.className = 'item-card';
    c.innerHTML = `<div class='item-icon'>${iconSvg(item)}</div><div class='item-meta'><strong>${item.name}</strong><small>${item.slot.toUpperCase()} · ${item.rarity}</small><small>${itemDesc(item.slot, item.stats)}</small><button>Equip</button></div>`;
    c.querySelector('button').addEventListener('click', () => equipItem(item));
    el.inventory.appendChild(c);
  });
}

function totalStat(k) { return Object.values(state.player.equipment).reduce((a, it) => a + (it?.stats?.[k] || 0), 0); }
function derivedAttr(k) { return (state.player.stats[k] || 0) + totalStat(k); }

function calculationSnapshot() {
  const damage = totalStat('damage') + derivedAttr('strength') * 2;
  const crit = (0.58 + totalStat('crit') * 0.01).toFixed(2);
  const defense = totalStat('defense');
  const hp = state.player.hp + totalStat('hpIncrease');
  const evasion = (derivedAttr('dexterity') * 0.5 + totalStat('evasion')).toFixed(1);
  return { damage, crit, defense, hp, evasion, fatigue: state.player.fatigue.toFixed(1), bodyTemp: state.player.bodyTemp.toFixed(1) };
}

function updateHud() {
  el.coreStats.innerHTML = '';
  Object.entries(state.player.stats).forEach(([k, v]) => {
    const d = document.createElement('div'); d.className = 'pill'; d.textContent = `${k.slice(0,3).toUpperCase()} ${derivedAttr(k)}`; el.coreStats.appendChild(d);
  });
  el.resourceBars.innerHTML = '';
  const calc = calculationSnapshot();
  [['HP', calc.hp], ['STM', state.player.stamina], ['FOC', state.player.focus], ['DEF', calc.defense], ['FTG', calc.fatigue]].forEach(([k, v]) => {
    const d = document.createElement('div'); d.className = 'pill'; d.textContent = `${k} ${Math.round(v)}`; el.resourceBars.appendChild(d);
  });
}

function renderCharacterScreen() {
  const calc = calculationSnapshot();
  el.characterDetails.innerHTML = `
    <p><strong>Map:</strong> ${MAP_SIZE}x${MAP_SIZE} with biome regions.</p>
    <p><strong>Position:</strong> (${state.player.pos.x}, ${state.player.pos.y})</p>
    <p><strong>Strength:</strong> ${derivedAttr('strength')} <span class='formula'>Base ${state.player.stats.strength} + Gear ${totalStat('strength')}. Affects melee damage.</span></p>
    <p><strong>Dexterity:</strong> ${derivedAttr('dexterity')} <span class='formula'>Base ${state.player.stats.dexterity} + Gear ${totalStat('dexterity')}. Affects evasion and precision.</span></p>
    <p><strong>Intelligence:</strong> ${derivedAttr('intelligence')} <span class='formula'>Base ${state.player.stats.intelligence} + Gear ${totalStat('intelligence')}. Affects assess/utility scaling.</span></p>
    <p><strong>Endurance:</strong> ${derivedAttr('endurance')} <span class='formula'>Base ${state.player.stats.endurance} + Gear ${totalStat('endurance')}. Affects survival in exchanges.</span></p>
    <p><strong>Willpower:</strong> ${derivedAttr('willpower')} <span class='formula'>Base ${state.player.stats.willpower} + Gear ${totalStat('willpower')}. Helps guard/focus resilience.</span></p>
    <p><strong>Damage Formula:</strong> ${calc.damage} <span class='formula'>Weapon Damage ${totalStat('damage')} + (Strength ${derivedAttr('strength')} × 2)</span></p>
    <p><strong>Crit Chance:</strong> ${Math.round(calc.crit * 100)}% <span class='formula'>(${calc.crit}) = base 0.58 + CritStat ${totalStat('crit')} × 0.01</span></p>
    <p><strong>Defense:</strong> ${calc.defense} <span class='formula'>Sum of gear defense values.</span></p>
    <p><strong>Evasion Rating:</strong> ${calc.evasion}% <span class='formula'>(Dexterity ${derivedAttr('dexterity')} × 0.5) + Gear Evasion ${totalStat('evasion')}</span></p>
    <p><strong>Effective HP:</strong> ${calc.hp} <span class='formula'>Current HP ${state.player.hp} + HP bonus ${totalStat('hpIncrease')}</span></p>
    <p><strong>Fatigue:</strong> ${calc.fatigue} <span class='formula'>Increases with difficult terrain; higher fatigue lowers sustained combat performance.</span></p>
    <p><strong>Body Temperature:</strong> ${calc.bodyTemp}°C <span class='formula'>Biome climate shifts temperature; extreme cold/heat increases survival risk.</span></p>
  `;
}

function generateBestiary() {
  const names = ['Bog Ghoul','Fen Raider','Crypt Hound','Ash Spider','Hollow Monk','Rook Bandit','Rot Boar','Cairn Witch','Mire Stalker','Grave Crow','Warden Shade','Pike Marauder','Blight Wolf','Bone Knight','Thorn Devourer','Howling Penitent','Stone Revenant','Blood Vicar','Maw Leech','Iron Troll','Dread Pilgrim','Fog Serpent','Ruin Harpy','Oathbreaker','Nightsworn Giant'];
  state.bestiary = names.map((name, i) => ({ name, hp: 45 + i * 6, attack: 9 + i, poise: 30 + i * 3, evasion: 0.05 + i * 0.005, hue: (i * 17) % 360 }));
}

function monsterSvg(name, h) {
  if (name.includes('Spider')) {
    return `<svg viewBox='0 0 60 60'><ellipse cx='30' cy='33' rx='14' ry='11' fill='hsl(${h} 45% 30%)'/><circle cx='30' cy='22' r='8' fill='hsl(${h} 55% 38%)'/><path d='M10 35 L22 30 M50 35 L38 30 M10 25 L22 27 M50 25 L38 27' stroke='hsl(${h} 45% 55%)' stroke-width='3'/></svg>`;
  }
  if (name.includes('Wolf') || name.includes('Hound')) {
    return `<svg viewBox='0 0 60 60'><path d='M10 40 L20 25 L40 25 L50 40 Z' fill='hsl(${h} 45% 33%)'/><path d='M20 25 L24 14 L30 22 L36 14 L40 25' fill='hsl(${h} 60% 40%)'/></svg>`;
  }
  if (name.includes('Harpy') || name.includes('Crow')) {
    return `<svg viewBox='0 0 60 60'><path d='M8 34 Q30 10 52 34 Q30 28 8 34 Z' fill='hsl(${h} 40% 35%)'/><circle cx='30' cy='35' r='8' fill='hsl(${h} 55% 45%)'/></svg>`;
  }
  return `<svg viewBox='0 0 60 60'><ellipse cx='30' cy='33' rx='20' ry='16' fill='hsl(${h} 45% 34%)'/><circle cx='22' cy='27' r='5' fill='hsl(${h} 70% 56%)'/><circle cx='38' cy='27' r='5' fill='hsl(${h} 70% 56%)'/></svg>`;
}

function respawnMonsters() {
  if (!state.bestiary.length) return;
  state.monsters = [];
  replenishMonsters(14);
}

function replenishMonsters(targetCount = 14) {
  if (!state.bestiary.length) return;
  const p = state.player.pos;
  for (let i = state.monsters.length; i < targetCount; i += 1) {
    const t = state.bestiary[rand(0, state.bestiary.length - 1)];
    state.monsters.push({
      ...t,
      uid: `m-${Date.now()}-${i}`,
      x: clamp(p.x + rand(-18, 18), 0, MAP_SIZE - 1),
      y: clamp(p.y + rand(-18, 18), 0, MAP_SIZE - 1),
      hpNow: t.hp,
      poiseNow: t.poise,
    });
  }
}

function drawMonsters() {
  const { x: px, y: py } = state.player.pos;
  const fragment = document.createDocumentFragment();
  state.monsters.forEach((m) => {
    if (Math.abs(m.x - px) > VIEW_RADIUS || Math.abs(m.y - py) > VIEW_RADIUS) return;
    const node = document.createElement('div');
    node.className = 'monster';
    node.innerHTML = monsterSvg(m.name, m.hue);
    const p = iso(m.x - px + VIEW_RADIUS, m.y - py + VIEW_RADIUS);
    node.style.left = `${p.x + 38}px`;
    node.style.top = `${p.y + 24}px`;
    fragment.appendChild(node);
  });
  return fragment;
}

function bindTabs() {
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`screen-${btn.dataset.screen}`).classList.add('active');
    if (btn.dataset.screen === 'character') renderCharacterScreen();
  }));
}

function exportSave() {
  return {
    day: state.day,
    mode: state.mode,
    player: state.player,
    monsters: state.monsters,
    encounter: state.encounter,
  };
}

function applySaveData(data) {
  if (!data || !data.player) return false;
  state.day = data.day ?? 1;
  state.mode = data.mode ?? 'explore';
  state.player = data.player;
  state.monsters = Array.isArray(data.monsters) ? data.monsters : [];
  state.encounter = data.encounter ?? null;
  return true;
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(exportSave()));
    addLog('Game saved to local storage.');
  } catch (err) {
    addLog('Save failed (storage unavailable).');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      addLog('No save found.');
      return;
    }
    const data = JSON.parse(raw);
    if (!applySaveData(data)) {
      addLog('Save file was invalid.');
      return;
    }
    applyKnight();
    renderEquipment();
    renderInventory();
    renderCharacterScreen();
    updateHud();
    renderMapChunk();
    addLog('Save loaded.');
  } catch (err) {
    addLog('Load failed (corrupt save).');
  }
}

function moveStep(ts) {
  if (!state.joystick.active || state.mode !== 'explore') return;
  if (ts - state.lastStep < state.stepMs) return;
  state.lastStep = ts;
  const { dx, dy } = state.joystick;
  if (!dx && !dy) return;
  state.player.pos.x = clamp(state.player.pos.x + dx, 0, MAP_SIZE - 1);
  state.player.pos.y = clamp(state.player.pos.y + dy, 0, MAP_SIZE - 1);
  const biome = biomeAt(state.player.pos.x, state.player.pos.y);
  const travel = biomeTravelProfile(biome);
  state.player.stamina = clamp(state.player.stamina - travel.stamina, 0, 100);
  state.player.fatigue = clamp(state.player.fatigue + travel.fatigue * 0.08, 0, 100);
  state.player.bodyTemp = clamp(state.player.bodyTemp + travel.temp * 0.08, 34.0, 39.5);
  state.day += 0.03;
  el.player.classList.add('walk');
  setTimeout(() => el.player.classList.remove('walk'), 150);
  renderMapChunk();
  updateHud();
  checkEncounter();
  if (state.monsters.length < 6) replenishMonsters(14);
}

function checkEncounter() {
  const p = state.player.pos;
  const biome = biomeAt(p.x, p.y);
  const travel = biomeTravelProfile(biome);
  const m = state.monsters.find((x) => Math.max(Math.abs(x.x - p.x), Math.abs(x.y - p.y)) <= 1);
  if (!m) { el.encounter.textContent = `Exploring ${MAP_SIZE}x${MAP_SIZE}. Biome: ${biome}. Terrain load ${travel.stamina.toFixed(2)}x.`; return; }
  state.encounter = m;
  state.mode = 'combat';
  el.encounter.textContent = `${m.name} confronts you.`;
  el.actions.innerHTML = '';
  ['Strike', 'Guard', 'Assess', 'Withdraw'].forEach((a) => {
    const b = document.createElement('button'); b.textContent = a; b.addEventListener('click', () => combatAction(a.toLowerCase())); el.actions.appendChild(b);
  });
}

function combatAction(action) {
  if (!state.encounter) return;
  if (action === 'withdraw') { state.mode = 'explore'; state.encounter = null; el.actions.innerHTML = ''; return; }
  if (action === 'assess') { el.encounter.textContent = `${state.encounter.name} HP ${Math.max(0, state.encounter.hpNow)} Poise ${Math.max(0, state.encounter.poiseNow)}`; enemyTurn(1); return; }
  if (action === 'guard') { state.player.stamina = clamp(state.player.stamina + 8, 0, 100); enemyTurn(0.6); return; }
  const dmg = totalStat('damage') + state.player.stats.strength * 2 + rand(4, 10);
  if (Math.random() < (0.58 + totalStat('crit') * 0.01)) state.encounter.hpNow -= Math.floor(dmg * 1.5);
  else state.encounter.hpNow -= dmg;
  enemyTurn(1);
  if (state.encounter.hpNow <= 0) {
    addLog(`Defeated ${state.encounter.name}.`);
    state.monsters = state.monsters.filter((m) => m.uid !== state.encounter.uid);
    state.encounter = null;
    state.mode = 'explore';
    el.actions.innerHTML = '';
  }
}

function enemyTurn(mult) {
  if (!state.encounter) return;
  const fatiguePenalty = 1 + state.player.fatigue / 220;
  const hit = Math.max(1, Math.floor((state.encounter.attack + rand(0, 7)) * mult * fatiguePenalty - totalStat('defense') * 0.35));
  state.player.hp -= hit;
  if (state.player.hp <= 0) { addLog('You fell in battle. Refresh to restart.'); }
  updateHud();
}

function bindJoystick() {
  const update = (ev) => {
    const t = ev.touches ? ev.touches[0] : ev;
    const r = el.joystick.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    const rx = t.clientX - cx; const ry = t.clientY - cy;
    const dist = Math.hypot(rx, ry); const max = 35; const sc = dist > max ? max / dist : 1;
    const x = rx * sc; const y = ry * sc;
    el.knob.style.transform = `translate(${x}px,${y}px)`;
    state.joystick.dx = Math.abs(x) < 10 ? 0 : (x > 0 ? 1 : -1);
    state.joystick.dy = Math.abs(y) < 10 ? 0 : (y > 0 ? 1 : -1);
  };
  const start = (ev) => { state.joystick.active = true; update(ev); };
  const move = (ev) => { if (state.joystick.active) update(ev); };
  const end = () => { state.joystick.active = false; state.joystick.dx = 0; state.joystick.dy = 0; el.knob.style.transform = 'translate(0px,0px)'; };
  el.joystick.addEventListener('touchstart', start, { passive: true });
  el.joystick.addEventListener('touchmove', move, { passive: true });
  el.joystick.addEventListener('touchend', end, { passive: true });
  el.joystick.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
}

function gameLoop(ts = 0) {
  moveStep(ts);
  const daylight = 0.72 + Math.sin(state.day * 0.24) * 0.18;
  el.world.style.filter = `brightness(${daylight.toFixed(2)}) saturate(1.05)`;
  requestAnimationFrame(gameLoop);
}

function initStarterEquip() { SLOT_ORDER.forEach((s) => { const i = state.player.inventory.find((x) => x.slot === s); if (i) state.player.equipment[s] = i; }); }

function init() {
  generateItems();
  generateBestiary();
  respawnMonsters();
  initStarterEquip();
  applyKnight();
  renderEquipment();
  renderInventory();
  renderCharacterScreen();
  updateHud();
  renderMapChunk();
  bindJoystick();
  bindTabs();
  el.saveBtn.addEventListener('click', saveGame);
  el.loadBtn.addEventListener('click', loadGame);
  const autoSaveRaw = localStorage.getItem(SAVE_KEY);
  if (autoSaveRaw) {
    try {
      const parsed = JSON.parse(autoSaveRaw);
      if (applySaveData(parsed)) {
        addLog('Autosave restored.');
        applyKnight();
        renderEquipment();
        renderInventory();
        renderCharacterScreen();
        updateHud();
        renderMapChunk();
      }
    } catch (_) {
      addLog('Autosave could not be restored.');
    }
  }
  addLog(`Loaded world ${MAP_SIZE}x${MAP_SIZE}, ${state.player.inventory.length} items, ${state.bestiary.length} monster types.`);
  gameLoop();
}

window.addEventListener('resize', renderMapChunk);
init();
