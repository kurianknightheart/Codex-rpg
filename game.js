const MAP_SIZE = 256;
const VIEW_RADIUS = 11;
const SLOT_ORDER = ['weapon', 'helmet', 'offhand', 'armor', 'belt', 'leggings', 'boots', 'gloves', 'necklace', 'ring1', 'ring2', 'trinket1', 'trinket2'];

const state = {
  mode: 'explore',
  combatLock: false,
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
};

const el = {
  world: document.getElementById('world'),
  player: document.getElementById('player'),
  combatOverlay: document.getElementById('combatOverlay'),
  combatPlayerSprite: document.getElementById('combatPlayerSprite'),
  combatMonsterSprite: document.getElementById('combatMonsterSprite'),
  combatMonsterName: document.getElementById('combatMonsterName'),
  combatPlayerDamage: document.getElementById('combatPlayerDamage'),
  combatMonsterDamage: document.getElementById('combatMonsterDamage'),
  coreStats: document.getElementById('coreStats'),
  resourceBars: document.getElementById('resourceBars'),
  encounter: document.getElementById('encounterPanel'),
  actions: document.getElementById('actions'),
  equipment: document.getElementById('equipmentSlots'),
  inventory: document.getElementById('inventory'),
  log: document.getElementById('log'),
  characterPreview: document.getElementById('characterPreview'),
  characterDetails: document.getElementById('characterDetails'),
  bottomNav: document.getElementById('bottomNav'),
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
  const seed = Number(item.id.replace('it-', '')) || 1;
  const h = item.appearance.hue;
  const v1 = 6 + (seed % 10);
  const v2 = 8 + (seed % 12);
  const sigil = (seed % 4);
  if (item.slot === 'weapon') {
    return `<svg viewBox='0 0 40 40'><rect x='${18 + (seed % 2)}' y='${4 + (seed % 3)}' width='4' height='${20 + (seed % 6)}' rx='2' fill='hsl(${h} 60% 64%)'/><rect x='${12 + (seed % 3)}' y='23' width='16' height='3' rx='2' fill='hsl(${h} 40% 30%)'/><circle cx='20' cy='${30 + (seed % 6)}' r='${2 + (seed % 2)}' fill='hsl(${(h + 40) % 360} 70% 60%)'/></svg>`;
  }
  if (['armor','helmet','offhand','belt','leggings','boots','gloves'].includes(item.slot)) {
    return `<svg viewBox='0 0 40 40'><rect x='8' y='8' width='24' height='24' rx='${v1}' fill='hsl(${h} 34% 45%)'/><path d='M12 ${v2} L28 ${40 - v2}' stroke='hsl(${(h + 60) % 360} 50% 65%)' stroke-width='2'/></svg>`;
  }
  if (sigil === 0) return `<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='10' fill='hsl(${h} 65% 58%)'/><path d='M15 20 L25 20 M20 15 L20 25' stroke='hsl(${(h+120)%360} 75% 70%)' stroke-width='2'/></svg>`;
  if (sigil === 1) return `<svg viewBox='0 0 40 40'><polygon points='20,9 30,20 20,31 10,20' fill='hsl(${h} 65% 58%)'/><circle cx='20' cy='20' r='3' fill='hsl(${(h+100)%360} 70% 70%)'/></svg>`;
  if (sigil === 2) return `<svg viewBox='0 0 40 40'><rect x='11' y='11' width='18' height='18' rx='6' fill='hsl(${h} 65% 58%)'/><path d='M14 26 L26 14' stroke='hsl(${(h+80)%360} 70% 72%)' stroke-width='2'/></svg>`;
  return `<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='10' fill='hsl(${h} 65% 58%)'/><path d='M14 24 Q20 12 26 24' stroke='hsl(${(h+140)%360} 70% 72%)' stroke-width='2' fill='none'/></svg>`;
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
  state.bestiary = names.map((name, i) => ({ name, tier: 1 + Math.floor(i / 7), hp: 45 + i * 6, attack: 9 + i, poise: 30 + i * 3, evasion: 0.05 + i * 0.005, hue: (i * 17) % 360 }));
}

function monsterVariantId(name) {
  let total = 0;
  for (let i = 0; i < name.length; i += 1) total += name.charCodeAt(i);
  return total % 15;
}

function monsterSvg(name, h) {
  const v = monsterVariantId(name);
  const shades = [`hsl(${h} 52% 28%)`, `hsl(${h} 58% 38%)`, `hsl(${(h + 24) % 360} 68% 62%)`];
  const variants = [
    `<svg viewBox='0 0 60 60'><ellipse cx='30' cy='33' rx='18' ry='14' fill='${shades[0]}'/><circle cx='30' cy='20' r='8' fill='${shades[1]}'/><path d='M10 34 L22 30 M50 34 L38 30 M13 24 L23 26 M47 24 L37 26' stroke='${shades[2]}' stroke-width='3'/></svg>`,
    `<svg viewBox='0 0 60 60'><path d='M8 39 L20 22 L42 22 L52 39 Z' fill='${shades[0]}'/><path d='M20 22 L24 12 L30 20 L36 12 L42 22' fill='${shades[1]}'/><circle cx='29' cy='30' r='2' fill='${shades[2]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><path d='M7 34 Q30 9 53 34 Q30 29 7 34 Z' fill='${shades[1]}'/><ellipse cx='30' cy='37' rx='10' ry='8' fill='${shades[0]}'/><path d='M18 29 Q30 20 42 29' stroke='${shades[2]}' stroke-width='2' fill='none'/></svg>`,
    `<svg viewBox='0 0 60 60'><rect x='14' y='20' width='32' height='24' rx='8' fill='${shades[0]}'/><path d='M16 22 L30 8 L44 22' fill='${shades[1]}'/><circle cx='24' cy='32' r='3' fill='${shades[2]}'/><circle cx='36' cy='32' r='3' fill='${shades[2]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><polygon points='30,8 48,18 43,42 17,42 12,18' fill='${shades[0]}'/><path d='M21 24 L39 24 L35 36 L25 36 Z' fill='${shades[1]}'/><path d='M23 16 Q30 12 37 16' stroke='${shades[2]}' stroke-width='2' fill='none'/></svg>`,
    `<svg viewBox='0 0 60 60'><ellipse cx='30' cy='28' rx='17' ry='13' fill='${shades[1]}'/><rect x='18' y='33' width='24' height='14' rx='5' fill='${shades[0]}'/><path d='M18 42 L10 48 M42 42 L50 48' stroke='${shades[2]}' stroke-width='3'/></svg>`,
    `<svg viewBox='0 0 60 60'><path d='M30 10 L44 24 L38 46 L22 46 L16 24 Z' fill='${shades[0]}'/><circle cx='24' cy='28' r='3' fill='${shades[2]}'/><circle cx='36' cy='28' r='3' fill='${shades[2]}'/><path d='M24 38 Q30 43 36 38' stroke='${shades[1]}' stroke-width='2' fill='none'/></svg>`,
    `<svg viewBox='0 0 60 60'><ellipse cx='30' cy='34' rx='20' ry='12' fill='${shades[0]}'/><path d='M10 34 L20 18 L30 28 L40 18 L50 34' fill='${shades[1]}'/><rect x='26' y='28' width='8' height='15' rx='3' fill='${shades[2]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><path d='M12 41 L18 17 L30 11 L42 17 L48 41 Z' fill='${shades[0]}'/><path d='M20 32 L30 21 L40 32' stroke='${shades[2]}' stroke-width='3' fill='none'/><rect x='24' y='33' width='12' height='9' rx='3' fill='${shades[1]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><circle cx='30' cy='29' r='16' fill='${shades[1]}'/><path d='M16 29 L8 39 M44 29 L52 39 M30 45 L30 53' stroke='${shades[2]}' stroke-width='3'/><ellipse cx='30' cy='29' rx='9' ry='6' fill='${shades[0]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><rect x='15' y='17' width='30' height='30' rx='12' fill='${shades[0]}'/><path d='M15 29 L5 23 M45 29 L55 23' stroke='${shades[2]}' stroke-width='3'/><path d='M24 37 L36 37' stroke='${shades[1]}' stroke-width='3'/></svg>`,
    `<svg viewBox='0 0 60 60'><polygon points='10,38 20,16 40,16 50,38 30,48' fill='${shades[1]}'/><path d='M18 30 L30 23 L42 30' stroke='${shades[2]}' stroke-width='2' fill='none'/><circle cx='30' cy='34' r='5' fill='${shades[0]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><ellipse cx='30' cy='35' rx='19' ry='12' fill='${shades[0]}'/><path d='M13 35 Q30 16 47 35' stroke='${shades[2]}' stroke-width='3' fill='none'/><rect x='26' y='23' width='8' height='18' rx='4' fill='${shades[1]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><path d='M30 9 L46 25 L39 45 L21 45 L14 25 Z' fill='${shades[0]}'/><path d='M24 22 L30 17 L36 22' stroke='${shades[2]}' stroke-width='2' fill='none'/><ellipse cx='30' cy='33' rx='8' ry='6' fill='${shades[1]}'/></svg>`,
    `<svg viewBox='0 0 60 60'><path d='M8 40 L18 20 L42 20 L52 40 L30 50 Z' fill='${shades[1]}'/><path d='M20 21 L20 10 M40 21 L40 10' stroke='${shades[2]}' stroke-width='3'/><circle cx='30' cy='33' r='7' fill='${shades[0]}'/></svg>`,
  ];
  return variants[v];
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
    const variant = monsterVariantId(m.name);
    node.className = `monster variant-${variant}`;
    node.innerHTML = monsterSvg(m.name, m.hue);
    const p = iso(m.x - px + VIEW_RADIUS, m.y - py + VIEW_RADIUS);
    node.style.left = `${p.x + 38}px`;
    node.style.top = `${p.y + 24}px`;
    fragment.appendChild(node);
  });
  return fragment;
}

function bindTabs() {
  el.bottomNav.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.nav-btn');
    if (!btn) return;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(`screen-${btn.dataset.screen}`);
    if (target) target.classList.add('active');
    if (btn.dataset.screen === 'character') renderCharacterScreen();
  });
}

function bindMapInteraction() {
  el.world.addEventListener('click', (ev) => {
    const tile = ev.target.closest('.tile');
    if (!tile || state.mode !== 'explore') return;
    const x = Number(tile.dataset.x);
    const y = Number(tile.dataset.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    state.destination = { x, y };
    el.encounter.textContent = `Travelling to (${x}, ${y}) through ${biomeAt(x, y)}.`;
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showCombatOverlay(monster) {
  el.combatOverlay.classList.remove('hidden');
  el.combatPlayerSprite.innerHTML = knightSvg(
    state.player.equipment.weapon?.appearance?.hue ?? 24,
    state.player.equipment.armor?.appearance?.hue ?? 220,
    state.player.equipment.necklace?.appearance?.hue ?? 45,
  );
  el.combatMonsterSprite.innerHTML = monsterSvg(monster.name, monster.hue);
  el.combatMonsterName.textContent = monster.name;
}

function hideCombatOverlay() {
  el.combatOverlay.classList.add('hidden');
  el.combatPlayerDamage.innerHTML = '';
  el.combatMonsterDamage.innerHTML = '';
}

function popDamage(targetEl, amount, isCrit = false, isHeal = false) {
  const pop = document.createElement('div');
  pop.className = `damage-pop${isCrit ? ' crit' : ''}${isHeal ? ' heal' : ''}`;
  pop.textContent = isHeal ? `+${amount}` : `-${amount}`;
  pop.style.left = `${40 + rand(12, 50)}%`;
  pop.style.top = `${30 + rand(8, 55)}%`;
  targetEl.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}

async function animateAction(kind, actor = 'player') {
  const actorEl = actor === 'player' ? el.combatPlayerSprite : el.combatMonsterSprite;
  const targetEl = actor === 'player' ? el.combatMonsterSprite : el.combatPlayerSprite;
  if (kind === 'guard') {
    actorEl.classList.add('guarding');
    await wait(420);
    actorEl.classList.remove('guarding');
    return;
  }
  if (kind === 'assess') {
    actorEl.classList.add('assessing');
    await wait(360);
    actorEl.classList.remove('assessing');
    return;
  }
  actorEl.classList.add('attacking');
  await wait(200);
  targetEl.classList.add('hit');
  await wait(220);
  actorEl.classList.remove('attacking');
  targetEl.classList.remove('hit');
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
    hideCombatOverlay();
    state.mode = 'explore';
    state.encounter = null;
    el.encounter.textContent = `Exploring ${MAP_SIZE}x${MAP_SIZE}. Biome: ${biome}. Terrain load ${travel.stamina.toFixed(2)}x.`;
    setExploreActions();
    return;
  }
  state.encounter = m;
  state.mode = 'combat';
  state.combatLock = false;
  showCombatOverlay(m);
  el.encounter.textContent = `${m.name} confronts you.`;
  el.actions.innerHTML = '';
  ['Strike', 'Guard', 'Assess', 'Withdraw'].forEach((a) => {
    const b = document.createElement('button'); b.textContent = a; b.addEventListener('click', () => combatAction(a.toLowerCase())); el.actions.appendChild(b);
  });
}

async function combatAction(action) {
  if (!state.encounter || state.combatLock) return;
  state.combatLock = true;
  if (action === 'withdraw') {
    state.mode = 'explore';
    state.encounter = null;
    hideCombatOverlay();
    setExploreActions();
    state.combatLock = false;
    el.encounter.textContent = 'You withdrew and returned to exploration.';
    return;
  }
  if (action === 'assess') {
    await animateAction('assess', 'player');
    el.encounter.textContent = `${state.encounter.name} HP ${Math.max(0, state.encounter.hpNow)} Poise ${Math.max(0, state.encounter.poiseNow)}`;
    await enemyTurn(1, 'assess');
    state.combatLock = false;
    return;
  }
  if (action === 'guard') {
    state.player.stamina = clamp(state.player.stamina + 8, 0, 100);
    popDamage(el.combatPlayerDamage, 8, false, true);
    await animateAction('guard', 'player');
    await enemyTurn(0.6, 'guard');
    state.combatLock = false;
    return;
  }
  const dmg = totalStat('damage') + state.player.stats.strength * 2 + rand(4, 10);
  const crit = Math.random() < (0.58 + totalStat('crit') * 0.01);
  const dealt = crit ? Math.floor(dmg * 1.5) : dmg;
  state.encounter.hpNow -= dealt;
  await animateAction('strike', 'player');
  popDamage(el.combatMonsterDamage, dealt, crit, false);
  el.encounter.textContent = crit ? `Critical hit for ${dealt}!` : `You struck ${state.encounter.name} for ${dealt}.`;
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
    hideCombatOverlay();
    setExploreActions();
    updateHud();
    renderMapChunk();
    state.combatLock = false;
    return;
  }
  await enemyTurn(1, 'strike');
  state.combatLock = false;
}

function rollLoot(monster) {
  const tier = monster.tier || 1;
  const rarityAllowed = tier === 1 ? ['common'] : tier === 2 ? ['common', 'rare'] : tier === 3 ? ['rare', 'magical'] : ['magical', 'legendary'];
  const pool = state.itemPool.filter((it) => it.tier <= Math.min(4, tier + 1) && rarityAllowed.includes(it.rarity));
  if (!pool.length) return null;
  const roll = Math.random();
  if (roll > 0.88) return pool[rand(0, pool.length - 1)];
  return null;
}

async function enemyTurn(mult, responseAction = 'strike') {
  if (!state.encounter) return;
  if (responseAction === 'assess') await animateAction('assess', 'monster');
  else await animateAction('strike', 'monster');
  const fatiguePenalty = 1 + state.player.fatigue / 220;
  const hit = Math.max(1, Math.floor((state.encounter.attack + rand(0, 7)) * mult * fatiguePenalty - totalStat('defense') * 0.35));
  state.player.hp -= hit;
  const crit = mult >= 1 && Math.random() < 0.15;
  popDamage(el.combatPlayerDamage, crit ? Math.floor(hit * 1.35) : hit, crit, false);
  if (crit) state.player.hp -= Math.floor(hit * 0.35);
  if (responseAction === 'guard') el.encounter.textContent = `You brace and absorb ${hit} damage.`;
  else el.encounter.textContent = `${state.encounter.name} hits you for ${hit}${crit ? ' (CRIT)' : ''}.`;
  if (state.player.hp <= 0) { addLog('You fell in battle. Refresh to restart.'); }
  updateHud();
}

function gameLoop(ts = 0) {
  moveStep(ts);
  const daylight = 0.72 + Math.sin(state.day * 0.24) * 0.18;
  el.world.style.filter = `brightness(${daylight.toFixed(2)}) saturate(1.05)`;
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
  bindTabs();
  bindMapInteraction();
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
