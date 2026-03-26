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
  destination: null,
  itemPool: [],
  bestiary: [],
  monsters: [],
  encounter: null,
  lastRespawnTick: 0,
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
  equipOverlay: document.getElementById('equipOverlay'),
  characterDetails: document.getElementById('characterDetails'),
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
  const n = Math.sin(x * 0.045) + Math.cos(y * 0.038) + Math.sin((x + y) * 0.02) + Math.cos((x - y) * 0.015);
  if (n > 1.7) return 'frost';
  if (n > 1.25) return 'forest';
  if (n > 0.8) return 'grass';
  if (n > 0.35) return 'hills';
  if (n > 0.1) return 'road';
  if (n > -0.25) return 'moor';
  if (n > -0.7) return 'swamp';
  if (n > -1.1) return 'ruin';
  if (n > -1.45) return 'ash';
  return 'water';
}

function biomeTravelProfile(biome) {
  const table = {
    road: { stamina: 0.7, fatigue: 0.35, temp: 0.0, danger: 0.85 },
    forest: { stamina: 1.15, fatigue: 0.7, temp: -0.02, danger: 1.1 },
    hills: { stamina: 1.2, fatigue: 0.78, temp: -0.01, danger: 1.1 },
    moor: { stamina: 1.12, fatigue: 0.72, temp: -0.04, danger: 1.15 },
    grass: { stamina: 1.0, fatigue: 0.55, temp: 0.0, danger: 1.0 },
    swamp: { stamina: 1.45, fatigue: 0.9, temp: -0.08, danger: 1.35 },
    frost: { stamina: 1.25, fatigue: 0.75, temp: -0.14, danger: 1.25 },
    desert: { stamina: 1.3, fatigue: 0.8, temp: 0.12, danger: 1.2 },
    ruin: { stamina: 1.15, fatigue: 0.7, temp: -0.03, danger: 1.4 },
    ash: { stamina: 1.35, fatigue: 0.82, temp: 0.05, danger: 1.5 },
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
      tile.dataset.x = String(x);
      tile.dataset.y = String(y);
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
  if (biome === 'forest') return 'pine';
  if (biome === 'hills') return 'stone';
  if (biome === 'moor') return 'heather';
  if (biome === 'swamp') return 'reed';
  if (biome === 'desert') return 'stone';
  if (biome === 'frost') return 'frostshrub';
  if (biome === 'ruin') return 'ruin';
  if (biome === 'ash') return 'ash';
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
  const idNum = Number(String(item.id).replace(/\D/g, '')) || 1;
  const v1 = 6 + (idNum % 8);
  const v2 = 10 + (idNum % 14);
  const v3 = 18 + (idNum % 10);
  const rarityGlow = item.rarity === 'legendary' ? 75 : item.rarity === 'magical' ? 62 : item.rarity === 'rare' ? 55 : 45;
  const core = `<polygon points='20,4 ${30 + (idNum % 4)},14 20,36 ${10 - (idNum % 4)},14' fill='hsl(${h} 58% ${rarityGlow}%)'/>`;
  if (item.slot === 'weapon') {
    return `<svg viewBox='0 0 40 40'><rect x='18' y='3' width='4' height='25' rx='2' fill='hsl(${h} 62% 67%)'/><rect x='11' y='24' width='18' height='4' rx='2' fill='hsl(${h} 40% 30%)'/><circle cx='20' cy='${v3}' r='2' fill='hsl(${h} 70% 78%)'/></svg>`;
  }
  if (['armor','helmet','offhand','belt','leggings','boots','gloves'].includes(item.slot)) {
    return `<svg viewBox='0 0 40 40'><rect x='8' y='8' width='24' height='24' rx='7' fill='hsl(${h} 34% 45%)'/><path d='M${v1} 12 L${v2} 30 L${32 - (idNum % 6)} 12' stroke='hsl(${h} 50% 70%)' stroke-width='2' fill='none'/></svg>`;
  }
  return `<svg viewBox='0 0 40 40'>${core}<circle cx='20' cy='20' r='${6 + (idNum % 4)}' fill='none' stroke='hsl(${h} 70% 76%)' stroke-width='1.6'/></svg>`;
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
  const rar = ['common','rare','magical','legendary'];
  let id = 0;
  SLOT_ORDER.forEach((slot, si) => {
    for (let i = 0; i < 16; i += 1) {
      const tier = 1 + Math.floor(i / 4);
      const p = tier + (i % 3);
      const s = {strength:0,intelligence:0,willpower:0,damage:0,attackSpeed:0,crit:0,reach:0,stunChance:0,defense:0,hpIncrease:0,evasion:0};
      if (slot === 'weapon') { s.damage = 8 + p * 3; s.attackSpeed = +(0.8 + p * 0.05).toFixed(2); s.crit = 3 + p * 2; s.reach = 1 + Math.floor(p/2); s.stunChance = 2 + p; s.strength = Math.floor(p/2); }
      else if (['armor','helmet','offhand','belt','leggings','boots','gloves'].includes(slot)) { s.defense = 4 + p * 2; s.hpIncrease = 10 + p * 5; s.evasion = Math.max(1, 10 - p); }
      else { s.strength = slot.includes('ring') ? 1 : 0; s.intelligence = Math.floor(p/2); s.willpower = Math.ceil(p/2); s.crit = p; }
      const rarity = rar[Math.min(3, tier - 1)];
      state.itemPool.push({ id:`it-${++id}`, slot, rarity, tier, name:`${rarity.toUpperCase()} ${names[slot][i%5]} ${tier}`, stats:s, appearance:{hue:(si*27+i*9)%360} });
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
  renderEquipmentOverlay();
}

function renderEquipmentOverlay() {
  if (!el.equipOverlay) return;
  el.equipOverlay.innerHTML = '';
  const slotPositions = {
    helmet: [50, 10], armor: [50, 30], weapon: [82, 46], offhand: [18, 46],
    gloves: [50, 53], belt: [50, 67], leggings: [50, 80], boots: [50, 92],
    necklace: [50, 20], ring1: [14, 64], ring2: [86, 64], trinket1: [20, 87], trinket2: [80, 87],
  };
  Object.entries(slotPositions).forEach(([slot, [x, y]]) => {
    const item = state.player.equipment[slot];
    const badge = document.createElement('div');
    badge.className = 'slot-badge';
    badge.style.left = `${x}%`;
    badge.style.top = `${y}%`;
    badge.style.transform = 'translate(-50%,-50%)';
    badge.textContent = item ? item.rarity[0].toUpperCase() : '-';
    el.equipOverlay.appendChild(badge);
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
  const fatigue = Number.isFinite(state.player.fatigue) ? state.player.fatigue : 0;
  const bodyTemp = Number.isFinite(state.player.bodyTemp) ? state.player.bodyTemp : 36.8;
  return { damage, crit, defense, hp, evasion, fatigue: fatigue.toFixed(1), bodyTemp: bodyTemp.toFixed(1) };
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
  state.bestiary = names.map((name, i) => ({ name, tier: 1 + Math.floor(i / 7), hp: 45 + i * 6, attack: 9 + i, poise: 30 + i * 3, evasion: 0.05 + i * 0.005, hue: (i * 17) % 360 }));
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

function bindMapTap() {
  el.world.addEventListener('pointerdown', (ev) => {
    const tile = ev.target.closest('.tile');
    if (!tile) return;
    const x = Number(tile.dataset.x);
    const y = Number(tile.dataset.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    state.destination = { x, y };
    el.encounter.textContent = `Travelling to (${x}, ${y}) through ${biomeAt(x, y)}.`;
  });
}

function setExploreActions() {
  el.actions.innerHTML = '';
  const camp = document.createElement('button');
  camp.textContent = 'Make Camp';
  camp.addEventListener('click', () => {
    state.day += 0.35;
    state.player.stamina = clamp(state.player.stamina + 14, 0, 100);
    state.player.focus = clamp(state.player.focus + 10, 0, 100);
    state.player.fatigue = clamp(state.player.fatigue - 8, 0, 100);
    addLog('You establish a small campfire and recover composure.');
    updateHud();
    renderCharacterScreen();
  });
  const forage = document.createElement('button');
  forage.textContent = 'Forage';
  forage.addEventListener('click', () => {
    const biome = biomeAt(state.player.pos.x, state.player.pos.y);
    const gain = biome === 'swamp' || biome === 'ruin' ? 4 : 7;
    state.player.hp = clamp(state.player.hp + gain, 0, 140);
    state.player.stamina = clamp(state.player.stamina - 3, 0, 100);
    addLog(`You forage in ${biome} terrain and recover ${gain} vitality.`);
    updateHud();
  });
  el.actions.append(camp, forage);
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
  const basePlayer = {
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
  };
  state.player = {
    ...basePlayer,
    ...data.player,
    pos: { ...basePlayer.pos, ...(data.player.pos || {}) },
    stats: { ...basePlayer.stats, ...(data.player.stats || {}) },
    xp: { ...(data.player.xp || {}) },
    equipment: { ...(data.player.equipment || {}) },
    inventory: Array.isArray(data.player.inventory) ? data.player.inventory : [],
  };
  state.monsters = Array.isArray(data.monsters) ? data.monsters : [];
  state.encounter = data.encounter ?? null;
  state.destination = null;
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
  if (!state.destination || state.mode !== 'explore') return;
  if (ts - state.lastStep < state.stepMs) return;
  state.lastStep = ts;
  const dx = Math.sign(state.destination.x - state.player.pos.x);
  const dy = Math.sign(state.destination.y - state.player.pos.y);
  if (!dx && !dy) return;
  state.player.pos.x = clamp(state.player.pos.x + dx, 0, MAP_SIZE - 1);
  state.player.pos.y = clamp(state.player.pos.y + dy, 0, MAP_SIZE - 1);
  if (state.player.pos.x === state.destination.x && state.player.pos.y === state.destination.y) {
    state.destination = null;
  }
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
  if (!m) {
    el.encounter.textContent = `Exploring ${MAP_SIZE}x${MAP_SIZE}. Biome: ${biome}. Terrain load ${travel.stamina.toFixed(2)}x.`;
    setExploreActions();
    return;
  }
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
  if (action === 'withdraw') { state.mode = 'explore'; state.encounter = null; setExploreActions(); return; }
  if (action === 'assess') { el.encounter.textContent = `${state.encounter.name} HP ${Math.max(0, state.encounter.hpNow)} Poise ${Math.max(0, state.encounter.poiseNow)}`; enemyTurn(1); return; }
  if (action === 'guard') { state.player.stamina = clamp(state.player.stamina + 8, 0, 100); enemyTurn(0.6); return; }
  const dmg = totalStat('damage') + state.player.stats.strength * 2 + rand(4, 10);
  if (Math.random() < (0.58 + totalStat('crit') * 0.01)) state.encounter.hpNow -= Math.floor(dmg * 1.5);
  else state.encounter.hpNow -= dmg;
  enemyTurn(1);
  if (state.encounter.hpNow <= 0) {
    addLog(`Defeated ${state.encounter.name}.`);
    const loot = rollLoot(state.encounter);
    if (loot) {
      state.player.inventory.unshift(loot);
      addLog(`Loot found: ${loot.name}.`);
      renderInventory();
    }
    state.monsters = state.monsters.filter((m) => m.uid !== state.encounter.uid);
    state.encounter = null;
    state.mode = 'explore';
    setExploreActions();
  }
}

function rollLoot(monster) {
  const tier = monster.tier || 1;
  const rarityAllowed = tier === 1 ? ['common'] : tier === 2 ? ['common', 'rare'] : tier === 3 ? ['rare', 'magical'] : ['magical', 'legendary'];
  const pool = state.itemPool.filter((it) => it.tier <= Math.min(4, tier + 1) && rarityAllowed.includes(it.rarity));
  if (!pool.length) return null;
  const roll = Math.random();
  if (roll > 0.72) return pool[rand(0, pool.length - 1)];
  return null;
}

function enemyTurn(mult) {
  if (!state.encounter) return;
  const fatiguePenalty = 1 + state.player.fatigue / 220;
  const hit = Math.max(1, Math.floor((state.encounter.attack + rand(0, 7)) * mult * fatiguePenalty - totalStat('defense') * 0.35));
  state.player.hp -= hit;
  if (state.player.hp <= 0) { addLog('You fell in battle. Refresh to restart.'); }
  updateHud();
}

function gameLoop(ts = 0) {
  moveStep(ts);
  const daylight = 0.72 + Math.sin(state.day * 0.24) * 0.18;
  el.world.style.filter = `brightness(${daylight.toFixed(2)}) saturate(1.05)`;
  if (ts - state.lastRespawnTick > 7000) {
    replenishMonsters(14);
    state.lastRespawnTick = ts;
  }
  requestAnimationFrame(gameLoop);
}

function initStarterEquip() {
  SLOT_ORDER.forEach((s) => {
    const starter = state.player.inventory.find((x) => x.slot === s && x.rarity === 'common' && x.tier === 1);
    if (starter) state.player.equipment[s] = starter;
  });
}

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
  bindMapTap();
  bindTabs();
  setExploreActions();
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
  el.encounter.textContent = 'Tap a tile to set destination. Your party will march there automatically.';
  gameLoop();
}

window.addEventListener('resize', renderMapChunk);
init();
