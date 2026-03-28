const MAP_SIZE = 1024;
const VIEW_RADIUS = 11;
const SAVE_VERSION = 2;
const CONTENT = {
  zones: [
    { id: 'ashen-approach', name: 'Ashen Approach', minTier: 1, maxTier: 1, minDist: 0, maxDist: 120 },
    { id: 'barrow-lowlands', name: 'Barrow Lowlands', minTier: 2, maxTier: 2, minDist: 120, maxDist: 220 },
    { id: 'frost-wards', name: 'Frost Wards', minTier: 3, maxTier: 3, minDist: 220, maxDist: 330 },
    { id: 'crownfall-depths', name: 'Crownfall Depths', minTier: 4, maxTier: 4, minDist: 330, maxDist: 9999 },
  ],
  affixes: {
    prefix: ['Stalwart', 'Runed', 'Dire', 'Stormforged', 'Sanctified'],
    suffix: ['of Embers', 'of Oaths', 'of Cinders', 'of Ruin', 'of Dawn'],
  },
  gems: ['Ruby', 'Sapphire', 'Topaz', 'Emerald'],
};
const SLOT_ORDER = ['weapon', 'helmet', 'chestArmor', 'cape', 'offhand', 'gloves', 'boots', 'necklace', 'ring1', 'ring2', 'trinket1', 'trinket2'];
const DEFENSE_SLOTS = ['helmet', 'chestArmor', 'armor', 'cape', 'offhand', 'belt', 'leggings', 'boots', 'gloves'];
const SLOT_LABELS = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  chestArmor: 'Chest Armor',
  armor: 'Armor',
  cape: 'Cape',
  offhand: 'Offhand',
  belt: 'Belt',
  leggings: 'Leggings',
  boots: 'Boots',
  gloves: 'Gloves',
  necklace: 'Necklace',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  trinket1: 'Trinket 1',
  trinket2: 'Trinket 2',
};
const WEAPON_TYPES = ['sword', 'spear', 'falchion', 'mace', 'warpick'];
const WEAPON_PASSIVES = {
  sword: ['Balanced Edge (+2% crit)', 'Duelist Rhythm (+4% damage)', 'Parry Expert (+6% damage)'],
  spear: ['Long Reach (+1 reach)', 'Impaling Thrust (+5% crit)', 'Linebreaker (+8% damage)'],
  falchion: ['Crescent Cuts (+3% damage)', 'Bleeding Arc (+5% damage)', 'Whirl Master (+7% crit)'],
  mace: ['Crushing Blows (+3 stun)', 'Bonebreaker (+5% damage)', 'Concussive Force (+8% damage)'],
  warpick: ['Armor Split (+4% damage)', 'Sunder (+6% damage)', 'Rend Plate (+10% damage)'],
};

const state = {
  mode: 'explore',
  day: 1,
  stepMs: 75,
  lastStep: 0,
  player: {
    pos: { x: 512, y: 512 },
    hp: 120,
    stamina: 100,
    focus: 70,
    fatigue: 0,
    bodyTemp: 36.8,
    level: 1,
    xp: 0,
    xpToNext: 100,
    unspentAttr: 0,
    mana: 40,
    skillCooldowns: { powerStrike: 0 },
    materials: { arcaneDust: 0, ironShard: 0 },
    stash: [],
    weaponProficiency: {},
    weaponProficiency: {},
    stats: { strength: 7, dexterity: 7, intelligence: 6, endurance: 8, willpower: 6 },
    equipment: {},
    inventory: [],
  },
  destination: null,
  itemPool: [],
  bestiary: [],
  monsters: [],
  encounter: null,
  quests: [{ id: 'hunt-elite', title: 'Cull Elite Threats', objective: 'Defeat 2 elite monsters', progress: 0, goal: 2, done: false }],
  dungeon: { active: false, tier: 1, room: 0, objectiveBossDefeated: false },
  lastRespawnTick: 0,
  inventoryFilter: 'all',
  selectedItemId: null,
};

const el = {
  world: document.getElementById('world'),
  player: document.getElementById('player'),
  coreStats: document.getElementById('coreStats'),
  resourceBars: document.getElementById('resourceBars'),
  encounter: document.getElementById('encounterPanel'),
  questTracker: document.getElementById('questTracker'),
  actions: document.getElementById('actions'),
  equipment: document.getElementById('equipmentSlots'),
  inventory: document.getElementById('inventory'),
  inventoryFilter: document.getElementById('inventoryFilter'),
  log: document.getElementById('log'),
  characterPreview: document.getElementById('characterPreview'),
  equipOverlay: document.getElementById('equipOverlay'),
  characterDetails: document.getElementById('characterDetails'),
  characterStatsPanel: document.getElementById('characterStatsPanel'),
  itemDetails: document.getElementById('itemDetails'),
  weaponProficiencyPanel: document.getElementById('weaponProficiencyPanel'),
  newGameBtn: document.getElementById('newGameBtn'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  combatStage: document.getElementById('combatStage'),
  combatPlayer: document.getElementById('combatPlayer'),
  combatMonster: document.getElementById('combatMonster'),
  combatPlayerNums: document.getElementById('combatPlayerNums'),
  combatMonsterNums: document.getElementById('combatMonsterNums'),
  lootDrop: document.getElementById('lootDrop'),
  levelUpPanel: document.getElementById('levelUpPanel'),
  levelUpText: document.getElementById('levelUpText'),
  levelUpChoices: document.getElementById('levelUpChoices'),
};

function addLog(t) { const p = document.createElement('p'); p.textContent = `[Day ${Math.floor(state.day)}] ${t}`; el.log.prepend(p); }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const SAVE_KEY = 'ashen_marches_save_v1';

function getKnightAppearance() {
  const eq = state.player.equipment || {};
  return {
    weaponHue: eq.weapon?.appearance?.hue ?? 24,
    armorHue: eq.chestArmor?.appearance?.hue ?? eq.armor?.appearance?.hue ?? 220,
    trimHue: eq.necklace?.appearance?.hue ?? eq.ring1?.appearance?.hue ?? 45,
    clothHue: eq.cape?.appearance?.hue ?? eq.gloves?.appearance?.hue ?? 280,
    leatherHue: eq.boots?.appearance?.hue ?? eq.belt?.appearance?.hue ?? 30,
    helmHue: eq.helmet?.appearance?.hue ?? 210,
    eyeHue: 28,
    hasHelmet: Boolean(eq.helmet),
    hasCape: Boolean(eq.cape),
    hasOffhand: Boolean(eq.offhand),
  };
}

function knightSvg({
  weaponHue = 24,
  armorHue = 220,
  trimHue = 45,
  clothHue = 280,
  leatherHue = 30,
  helmHue = 210,
  eyeHue = 28,
  hasHelmet = false,
  hasCape = false,
  hasOffhand = false,
} = {}) {
  let plateDots = '';
  for (let y = 64; y <= 126; y += 7) {
    for (let x = 43; x <= 77; x += 4) {
      plateDots += `<circle cx='${x}' cy='${y}' r='0.75' fill='hsl(${armorHue} 22% 44%)'/>`;
    }
  }
  let runeMarks = '';
  for (let i = 0; i < 10; i += 1) {
    runeMarks += `<path d='M${44 + i * 4} 62 L${46 + i * 4} 58 L${48 + i * 4} 62' stroke='hsl(${trimHue} 70% 66%)' stroke-width='0.9' fill='none'/>`;
  }
  return `<svg viewBox='0 0 120 160' xmlns='http://www.w3.org/2000/svg'>
    <defs>
      <linearGradient id='armorGrad' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0%' stop-color='hsl(${armorHue} 30% 62%)'/>
        <stop offset='100%' stop-color='hsl(${armorHue} 34% 28%)'/>
      </linearGradient>
      <linearGradient id='trimGrad' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='hsl(${trimHue} 72% 68%)'/>
        <stop offset='100%' stop-color='hsl(${trimHue} 52% 34%)'/>
      </linearGradient>
      <radialGradient id='aura' cx='50%' cy='42%' r='55%'>
        <stop offset='0%' stop-color='rgba(157,117,191,.28)'/>
        <stop offset='100%' stop-color='rgba(31,19,45,0)'/>
      </radialGradient>
    </defs>
    <ellipse cx='60' cy='86' rx='42' ry='58' fill='url(#aura)'/>
    <g stroke='#18131f' stroke-width='2.2' stroke-linejoin='round' stroke-linecap='round'>
      <path d='M42 150 L60 92 L78 150 Z' fill='url(#trimGrad)'/>
      <ellipse cx='60' cy='43' rx='18' ry='16' fill='hsl(30 24% 78%)'/>
      <path d='M45 34 Q60 17 75 34 L75 39 Q60 26 45 39 Z' fill='hsl(15 8% 12%)'/>
      <path d='M49 52 Q60 57 71 52' stroke='hsl(22 34% 36%)' stroke-width='1.6' fill='none'/>
      <ellipse cx='54' cy='44' rx='3.2' ry='2.4' fill='hsl(${eyeHue} 42% 42%)'/>
      <ellipse cx='66' cy='44' rx='3.2' ry='2.4' fill='hsl(${eyeHue} 42% 42%)'/>
      <circle cx='54' cy='44' r='1.2' fill='#1c130f'/>
      <circle cx='66' cy='44' r='1.2' fill='#1c130f'/>
      <path d='M52 39 L56 38 M64 38 L68 39' stroke='hsl(15 10% 15%)' stroke-width='1.2'/>
      <path d='M40 46 Q60 18 80 46 L78 58 L42 58 Z' fill='url(#armorGrad)'/>
      <rect x='37' y='60' width='46' height='56' rx='14' fill='url(#armorGrad)'/>
      <path d='M44 66 L76 66 L73 108 L47 108 Z' fill='hsl(${trimHue} 58% 38%)' opacity='.8'/>
      ${hasCape ? `<path d='M38 60 L29 134 L48 144 L50 62 Z' fill='hsl(${clothHue} 34% 28%)' opacity='.85'/>` : ''}
      ${hasCape ? `<path d='M82 60 L70 144 L92 134 L84 62 Z' fill='hsl(${clothHue} 34% 28%)' opacity='.85'/>` : ''}
      <path d='M46 72 L74 72 M46 80 L74 80 M46 88 L74 88 M46 96 L74 96' stroke='hsl(${trimHue} 62% 62%)' stroke-width='1'/>
      ${runeMarks}
      ${plateDots}
      ${hasHelmet ? `<path d='M42 45 Q60 20 78 45 L75 58 L45 58 Z' fill='hsl(${helmHue} 28% 44%)'/>` : ''}
      ${hasHelmet ? `<path d='M50 44 L70 44 L68 53 L52 53 Z' fill='hsl(${helmHue} 24% 20%)'/>` : ''}
      <g class='limb arm-left'><rect x='29' y='68' width='10' height='40' rx='4' fill='hsl(${armorHue} 24% 40%)'/></g>
      <g class='limb arm-right'><rect x='81' y='68' width='10' height='40' rx='4' fill='hsl(${armorHue} 24% 40%)'/></g>
      <g class='limb leg-left'><rect x='47' y='112' width='12' height='24' rx='4' fill='hsl(${armorHue} 18% 37%)'/><circle cx='53' cy='125' r='2' fill='hsl(${leatherHue} 26% 38%)'/></g>
      <g class='limb leg-right'><rect x='61' y='112' width='12' height='24' rx='4' fill='hsl(${armorHue} 18% 37%)'/><circle cx='67' cy='125' r='2' fill='hsl(${leatherHue} 26% 38%)'/></g>
      <g class='limb leg-left'><rect x='45' y='132' width='16' height='10' rx='4' fill='hsl(${leatherHue} 26% 25%)'/></g>
      <g class='limb leg-right'><rect x='59' y='132' width='16' height='10' rx='4' fill='hsl(${leatherHue} 26% 25%)'/></g>
      <path d='M86 43 L92 101 L83 102 L78 46 Z' fill='hsl(${weaponHue} 58% 70%)'/>
      <rect x='74' y='81' width='24' height='6' rx='2' transform='rotate(10 86 84)' fill='hsl(${weaponHue} 48% 28%)'/>
      ${hasOffhand ? `<ellipse cx='24' cy='90' rx='10' ry='14' fill='hsl(${trimHue} 30% 35%)'/>` : ''}
      ${hasOffhand ? `<path d='M18 90 Q24 78 30 90 Q24 102 18 90 Z' fill='hsl(${armorHue} 20% 58%)'/>` : ''}
    </g>
  </svg>`;
}

function applyKnight() {
  const svg = knightSvg(getKnightAppearance());
  el.player.innerHTML = svg;
  const existingSvg = el.characterPreview.querySelector('svg');
  if (existingSvg) existingSvg.remove();
  el.characterPreview.insertAdjacentHTML('afterbegin', svg);
}

function iso(x, y) {
  const s = 38;
  return { x: (x - y) * (s / 2) + el.world.clientWidth / 2 - 38, y: (x + y) * (s / 4) + 24 };
}

function screenToWorldTile(clientX, clientY) {
  const rect = el.world.getBoundingClientRect();
  const lx = clientX - rect.left;
  const ly = clientY - rect.top;
  const s = 38;
  const centerX = el.world.clientWidth / 2;
  const centerY = el.world.clientHeight / 2;
  const dx = lx - centerX;
  const dy = ly - centerY;
  const localX = (dx / (s / 2) + dy / (s / 4)) / 2;
  const localY = (dy / (s / 4) - dx / (s / 2)) / 2;
  const wx = Math.round(state.player.pos.x + localX);
  const wy = Math.round(state.player.pos.y + localY);
  return {
    x: clamp(wx, 0, MAP_SIZE - 1),
    y: clamp(wy, 0, MAP_SIZE - 1),
  };
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

function zoneAt(x, y) {
  const dx = x - MAP_SIZE / 2;
  const dy = y - MAP_SIZE / 2;
  const dist = Math.hypot(dx, dy);
  return CONTENT.zones.find((z) => dist >= z.minDist && dist < z.maxDist) || CONTENT.zones[0];
}

function decoSeed(x, y) {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function renderMapChunk() {
  el.world.querySelectorAll('.patch,.monster,.deco').forEach((n) => n.remove());
  const { x: px, y: py } = state.player.pos;
  const fragment = document.createDocumentFragment();
  for (let y = py - VIEW_RADIUS; y <= py + VIEW_RADIUS; y += 1) {
    for (let x = px - VIEW_RADIUS; x <= px + VIEW_RADIUS; x += 1) {
      if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) continue;
      const biome = biomeAt(x, y);
      const p = iso(x - px + VIEW_RADIUS, y - py + VIEW_RADIUS);
      const patch = document.createElement('div');
      patch.className = `patch ${biome}`;
      patch.style.left = `${p.x + 38 + (decoSeed(x, y) - 0.5) * 16}px`;
      patch.style.top = `${p.y + 20 + (decoSeed(y, x) - 0.5) * 12}px`;
      patch.style.width = `${52 + Math.floor(decoSeed(x + 3, y + 5) * 38)}px`;
      patch.style.height = `${28 + Math.floor(decoSeed(x + 8, y + 2) * 22)}px`;
      fragment.appendChild(patch);
      if (decoSeed(x, y) < 0.78) {
        const deco = document.createElement('div');
        deco.className = `deco ${featureForTile(x, y, biome)}`;
        deco.style.left = `${p.x + 28 + (decoSeed(x + 19, y + 7) - 0.5) * 24}px`;
        deco.style.top = `${p.y + 6 + (decoSeed(x + 5, y + 23) - 0.5) * 14}px`;
        fragment.appendChild(deco);
        if (decoSeed(x + 13, y + 29) > 0.72) {
          const deco2 = document.createElement('div');
          deco2.className = `deco ${decoForBiome(biome, decoSeed(x + 41, y + 27))}`;
          deco2.style.left = `${p.x + 26 + (decoSeed(x + 31, y + 3) - 0.5) * 16}px`;
          deco2.style.top = `${p.y + 10 + (decoSeed(x + 9, y + 17) - 0.5) * 10}px`;
          fragment.appendChild(deco2);
        }
      }
    }
  }
  fragment.appendChild(drawMonsters());
  el.world.appendChild(fragment);
  el.world.appendChild(el.player);
  renderPlayer();
}

function decoForBiome(biome, seed = 0.5) {
  if (biome === 'grass') return seed > 0.5 ? 'shrub' : 'flowers';
  if (biome === 'forest') return seed > 0.5 ? 'pine' : 'fern';
  if (biome === 'hills') return seed > 0.55 ? 'stone' : 'bush';
  if (biome === 'moor') return seed > 0.45 ? 'heather' : 'vine';
  if (biome === 'swamp') return seed > 0.5 ? 'reed' : 'fern';
  if (biome === 'desert') return seed > 0.55 ? 'stone' : 'stump';
  if (biome === 'frost') return seed > 0.4 ? 'frostshrub' : 'shrub';
  if (biome === 'ruin') return seed > 0.4 ? 'ruin' : 'vine';
  if (biome === 'ash') return seed > 0.5 ? 'ash' : 'stump';
  return 'stone';
}

function featureForTile(x, y, biome) {
  const seed = decoSeed(x * 3 + 7, y * 5 + 11);
  if (seed > 0.94 && biome !== 'water') return 'lake';
  if (seed > 0.8) return 'mountain';
  return decoForBiome(biome, seed);
}

function renderPlayer() {
  if (!el.player.innerHTML.trim()) applyKnight();
  el.player.style.left = `${Math.floor(el.world.clientWidth / 2)}px`;
  el.player.style.top = `${Math.floor(el.world.clientHeight / 2)}px`;
}

function detailedWeaponSvg(kind, h, studs) {
  if (kind === 'spear') {
    return `<svg viewBox='0 0 40 40'>
      <path d='M20 2 L24 9 L20 15 L16 9 Z' fill='hsl(${h} 82% 84%)'/><path d='M18 13 L22 13 L22 36 L18 36 Z' fill='hsl(${h} 34% 36%)'/><rect x='18' y='18' width='4' height='2' fill='hsl(${h} 22% 48%)'/><rect x='18' y='24' width='4' height='2' fill='hsl(${h} 22% 48%)'/><rect x='18' y='30' width='4' height='2' fill='hsl(${h} 22% 48%)'/><path d='M16 10 L24 10' stroke='hsl(${h} 20% 32%)' stroke-width='1'/><path d='M17 16 L23 16' stroke='hsl(${h} 20% 32%)' stroke-width='1'/><circle cx='20' cy='20' r='0.8'/><circle cx='20' cy='26' r='0.8'/><circle cx='20' cy='32' r='0.8'/><path d='M19 3 L20 1 L21 3' stroke='hsl(${h} 20% 28%)' stroke-width='0.8'/><path d='M16 8 L20 12 L24 8' stroke='hsl(${h} 18% 22%)' stroke-width='0.8' fill='none'/><path d='M18 36 L22 36 L21 38 L19 38 Z' fill='hsl(${h} 30% 20%)'/><rect x='17' y='34' width='6' height='2' fill='hsl(${h} 18% 28%)'/><rect x='17' y='22' width='6' height='1' fill='hsl(${h} 70% 72%)' opacity='.55'/><rect x='17' y='28' width='6' height='1' fill='hsl(${h} 70% 72%)' opacity='.55'/><circle cx='18' cy='18' r='0.6'/><circle cx='22' cy='18' r='0.6'/><circle cx='18' cy='30' r='0.6'/><circle cx='22' cy='30' r='0.6'/>${studs}
    </svg>`;
  }
  if (kind === 'falchion') {
    return `<svg viewBox='0 0 40 40'>
      <path d='M13 6 Q30 8 25 31 Q17 28 11 10 Z' fill='hsl(${h} 62% 74%)'/><path d='M14 9 Q24 10 21 26' stroke='hsl(${h} 25% 42%)' stroke-width='1.1' fill='none'/><path d='M15 24 L26 24' stroke='hsl(${h} 74% 86%)' stroke-width='1'/><rect x='14' y='24' width='12' height='3' rx='2' fill='hsl(${h} 30% 28%)'/><rect x='18' y='27' width='4' height='8' rx='2' fill='hsl(${h} 26% 24%)'/><circle cx='20' cy='35' r='1.4' fill='hsl(${h} 76% 72%)'/><path d='M13 20 L11 19 M24 15 L26 14 M17 12 L19 12' stroke='hsl(${h} 18% 22%)' stroke-width='0.8'/><circle cx='16' cy='25' r='0.7'/><circle cx='20' cy='25' r='0.7'/><circle cx='24' cy='25' r='0.7'/><path d='M12 8 L15 6 L16 8' fill='hsl(${h} 70% 82%)'/><path d='M12 11 L15 9 L16 11' fill='hsl(${h} 70% 82%)'/><path d='M12 14 L15 12 L16 14' fill='hsl(${h} 70% 82%)'/><path d='M23 28 L24 31 L22 33 L20 31 L21 28' fill='hsl(${h} 45% 55%)'/><path d='M18 28 L17 31 L19 33 L21 31 L20 28' fill='hsl(${h} 45% 55%)'/><rect x='17' y='22' width='6' height='1' fill='hsl(${h} 70% 85%)' opacity='.6'/><rect x='17' y='30' width='6' height='1' fill='hsl(${h} 12% 14%)' opacity='.5'/><circle cx='13' cy='18' r='0.6'/><circle cx='25' cy='18' r='0.6'/><circle cx='12' cy='22' r='0.6'/>${studs}
    </svg>`;
  }
  if (kind === 'mace') {
    return `<svg viewBox='0 0 40 40'>
      <circle cx='20' cy='8' r='6' fill='hsl(${h} 30% 44%)'/><rect x='18' y='12' width='4' height='22' rx='2' fill='hsl(${h} 35% 34%)'/><path d='M20 2 L21 5 L20 8 L19 5 Z' fill='hsl(${h} 70% 72%)'/><path d='M14 8 L17 9 L20 8 L17 7 Z' fill='hsl(${h} 26% 52%)'/><path d='M26 8 L23 9 L20 8 L23 7 Z' fill='hsl(${h} 26% 52%)'/><path d='M20 14 L22 16 L20 18 L18 16 Z' fill='hsl(${h} 26% 48%)'/><rect x='17' y='16' width='6' height='2' fill='hsl(${h} 22% 40%)'/><rect x='17' y='20' width='6' height='2' fill='hsl(${h} 22% 40%)'/><rect x='17' y='24' width='6' height='2' fill='hsl(${h} 22% 40%)'/><rect x='17' y='28' width='6' height='2' fill='hsl(${h} 22% 40%)'/><circle cx='20' cy='34' r='1.3' fill='hsl(${h} 72% 78%)'/><circle cx='17' cy='4' r='0.9'/><circle cx='23' cy='4' r='0.9'/><circle cx='15' cy='8' r='0.8'/><circle cx='25' cy='8' r='0.8'/><circle cx='17' cy='12' r='0.8'/><circle cx='23' cy='12' r='0.8'/><path d='M18 33 L22 33' stroke='hsl(${h} 18% 20%)' stroke-width='1'/><path d='M19 36 L21 36' stroke='hsl(${h} 18% 20%)' stroke-width='1'/><rect x='18' y='30' width='4' height='2' fill='hsl(${h} 16% 28%)'/>${studs}
    </svg>`;
  }
  if (kind === 'warpick') {
    return `<svg viewBox='0 0 40 40'>
      <path d='M13 10 L27 10 L30 14 L10 14 Z' fill='hsl(${h} 55% 74%)'/><rect x='18' y='12' width='4' height='22' rx='2' fill='hsl(${h} 35% 34%)'/><path d='M27 10 L34 4 L31 14 Z' fill='hsl(${h} 65% 72%)'/><path d='M13 10 L7 6 L10 14 Z' fill='hsl(${h} 45% 62%)'/><rect x='17' y='16' width='6' height='2' fill='hsl(${h} 22% 44%)'/><rect x='17' y='20' width='6' height='2' fill='hsl(${h} 22% 44%)'/><rect x='17' y='24' width='6' height='2' fill='hsl(${h} 22% 44%)'/><rect x='17' y='28' width='6' height='2' fill='hsl(${h} 22% 44%)'/><path d='M30 8 L33 5' stroke='hsl(${h} 18% 30%)' stroke-width='1'/><path d='M28 11 L32 9' stroke='hsl(${h} 18% 30%)' stroke-width='1'/><path d='M11 10 L8 8' stroke='hsl(${h} 18% 30%)' stroke-width='1'/><path d='M12 13 L8 12' stroke='hsl(${h} 18% 30%)' stroke-width='1'/><circle cx='20' cy='34' r='1.4' fill='hsl(${h} 74% 78%)'/><circle cx='20' cy='17' r='0.8'/><circle cx='20' cy='21' r='0.8'/><circle cx='20' cy='25' r='0.8'/><circle cx='20' cy='29' r='0.8'/><rect x='18' y='32' width='4' height='2' fill='hsl(${h} 18% 25%)'/><rect x='18' y='35' width='4' height='2' fill='hsl(${h} 18% 20%)'/><circle cx='14' cy='12' r='0.7'/><circle cx='26' cy='12' r='0.7'/>${studs}
    </svg>`;
  }
  return `<svg viewBox='0 0 40 40'>
    <rect x='18' y='3' width='4' height='25' rx='2' fill='hsl(${h} 62% 67%)'/><rect x='11' y='24' width='18' height='4' rx='2' fill='hsl(${h} 40% 30%)'/><rect x='18' y='27' width='4' height='8' rx='2' fill='hsl(${h} 35% 24%)'/><circle cx='20' cy='5' r='1.1' fill='hsl(${h} 74% 82%)'/><circle cx='20' cy='9' r='1.1' fill='hsl(${h} 74% 82%)'/><circle cx='20' cy='13' r='1.1' fill='hsl(${h} 74% 82%)'/><circle cx='20' cy='17' r='1.1' fill='hsl(${h} 74% 82%)'/><circle cx='20' cy='21' r='1.1' fill='hsl(${h} 74% 82%)'/><path d='M12 24 L16 20 L20 24' fill='hsl(${h} 44% 44%)'/><path d='M28 24 L24 20 L20 24' fill='hsl(${h} 44% 44%)'/><rect x='13' y='25' width='14' height='2' fill='hsl(${h} 20% 20%)'/><rect x='18' y='30' width='4' height='2' fill='hsl(${h} 18% 28%)'/><rect x='18' y='33' width='4' height='2' fill='hsl(${h} 18% 22%)'/><circle cx='15' cy='26' r='0.7'/><circle cx='20' cy='26' r='0.7'/><circle cx='25' cy='26' r='0.7'/><circle cx='20' cy='37' r='1.2' fill='hsl(${h} 74% 78%)'/><path d='M18 2 L20 1 L22 2' stroke='hsl(${h} 18% 26%)' stroke-width='0.8'/><path d='M19 28 L21 28' stroke='hsl(${h} 12% 18%)' stroke-width='1'/><path d='M19 35 L21 35' stroke='hsl(${h} 12% 18%)' stroke-width='1'/>${studs}
  </svg>`;
}

function iconSvg(item) {
  const h = item.appearance.hue;
  const idNum = Number(String(item.id).replace(/\D/g, '')) || 1;
  const v1 = 6 + (idNum % 8);
  const v2 = 10 + (idNum % 14);
  const rarityGlow = item.rarity === 'legendary' ? 75 : item.rarity === 'epic' ? 62 : item.rarity === 'rare' ? 55 : 45;
  let studs = '';
  for (let i = 0; i < 10; i += 1) studs += `<circle cx='${8 + i * 2.4}' cy='${34 - (i % 2)}' r='0.9' fill='hsl(${h} 20% 25%)'/>`;
  const core = `<polygon points='20,4 ${30 + (idNum % 4)},14 20,36 ${10 - (idNum % 4)},14' fill='hsl(${h} 58% ${rarityGlow}%)'/>${studs}`;
  if (item.slot === 'weapon') {
    const kind = item.name.includes('Spear')
      ? 'spear'
      : item.name.includes('Falchion')
        ? 'falchion'
        : item.name.includes('Mace')
          ? 'mace'
          : item.name.includes('War Pick')
            ? 'warpick'
            : 'sword';
    return detailedWeaponSvg(kind, h, studs);
  }
  if (DEFENSE_SLOTS.includes(item.slot)) {
    return `<svg viewBox='0 0 40 40'><rect x='8' y='8' width='24' height='24' rx='7' fill='hsl(${h} 34% 45%)'/><path d='M${v1} 12 L${v2} 30 L${32 - (idNum % 6)} 12' stroke='hsl(${h} 50% 70%)' stroke-width='2' fill='none'/><rect x='13' y='13' width='14' height='14' rx='3' fill='hsl(${h} 24% 32%)'/><circle cx='16' cy='16' r='1'/><circle cx='20' cy='16' r='1'/><circle cx='24' cy='16' r='1'/><circle cx='16' cy='20' r='1'/><circle cx='20' cy='20' r='1'/><circle cx='24' cy='20' r='1'/><circle cx='16' cy='24' r='1'/><circle cx='20' cy='24' r='1'/><circle cx='24' cy='24' r='1'/></svg>`;
  }
  return `<svg viewBox='0 0 40 40'>${core}<circle cx='20' cy='20' r='${6 + (idNum % 4)}' fill='none' stroke='hsl(${h} 70% 76%)' stroke-width='1.6'/><circle cx='20' cy='20' r='2.5' fill='hsl(${h} 85% 85%)'/><circle cx='14' cy='14' r='1.2'/><circle cx='26' cy='14' r='1.2'/><circle cx='14' cy='26' r='1.2'/><circle cx='26' cy='26' r='1.2'/></svg>`;
}

function itemDesc(slot, s) {
  if (slot === 'weapon') return `DMG ${s.damage} | SPD ${s.attackSpeed} | CRIT ${s.crit}% | REACH ${s.reach} | STUN ${s.stunChance}%`;
  if (DEFENSE_SLOTS.includes(slot)) return `DEF ${s.defense} | HP +${s.hpIncrease} | EVA ${s.evasion}%`;
  return `STR +${s.strength} | INT +${s.intelligence} | WIL +${s.willpower} | CRIT +${s.crit}%`;
}

function weaponTypeFromItem(item) {
  const n = (item?.name || '').toLowerCase();
  if (n.includes('spear')) return 'spear';
  if (n.includes('falchion')) return 'falchion';
  if (n.includes('mace')) return 'mace';
  if (n.includes('war pick') || n.includes('warpick')) return 'warpick';
  return 'sword';
}

function ensureWeaponProficiency() {
  if (!state.player.weaponProficiency || typeof state.player.weaponProficiency !== 'object') state.player.weaponProficiency = {};
  WEAPON_TYPES.forEach((t) => {
    if (!state.player.weaponProficiency[t]) state.player.weaponProficiency[t] = { xp: 0, unlocked: [] };
  });
}

function proficiencyLevel(type) {
  ensureWeaponProficiency();
  return Math.min(10, Math.floor((state.player.weaponProficiency[type]?.xp || 0) / 1000));
}

function proficiencyDamageBonus(type) {
  return proficiencyLevel(type) * 0.015;
}

function addWeaponProficiencyXP(type, amount) {
  ensureWeaponProficiency();
  const prof = state.player.weaponProficiency[type];
  const prevLevel = proficiencyLevel(type);
  prof.xp = Math.min(10000, prof.xp + amount);
  const newLevel = proficiencyLevel(type);
  const unlockThresholds = [2, 5, 8];
  unlockThresholds.forEach((lvl, idx) => {
    if (newLevel >= lvl && !prof.unlocked.includes(WEAPON_PASSIVES[type][idx])) {
      prof.unlocked.push(WEAPON_PASSIVES[type][idx]);
      addLog(`${type.toUpperCase()} mastery unlocked: ${WEAPON_PASSIVES[type][idx]}.`);
    }
  });
  if (newLevel > prevLevel) addLog(`${type.toUpperCase()} proficiency reached level ${newLevel}.`);
}

const slotLore = {
  weapon: 'Tempered under moonlit anvils for relentless duels.',
  helmet: 'A guardian crest that turns fear into resolve.',
  chestArmor: 'Forged to hold the line against impossible odds.',
  cape: 'Threads blessed by wardens of the Ashen Marches.',
  offhand: 'Balanced for parries, counters, and steadfast defense.',
  gloves: 'Grip and precision refined for split-second strikes.',
  boots: 'Trusted steps on ruined roads and frozen marshes.',
  necklace: 'A relic humming with quiet, ancient intent.',
  ring1: 'Marked with runes of old vows.',
  ring2: 'A bond of steel and omen.',
  trinket1: 'A keepsake that stirs forgotten luck.',
  trinket2: 'A charm against shadows beyond the firelight.',
};

function generateItems() {
  state.itemPool = [];
  const names = {
    weapon:['Knight Sword','Spear','Falchion','Mace','War Pick'], helmet:['Iron Coif','Nasal Helm','Visor','Padded Coif','Chapel Helm'],
    chestArmor:['Gambeson','Mail Hauberk','Steel Chestplate','Brigandine','Cuir Bouilli'], cape:['Warden Cloak','Ember Mantle','Griffon Cape','Ashweave Cape','Royal Drape'], armor:['Spaulders','Lamellar Mantle','Knight Pauldrons','Scale Wrap','Warder Harness'],
    offhand:['Kite Shield','Buckler','Parry Dagger','Hook Shield','Lantern Guard'],
    belt:['Studded Belt','Mercenary Belt','Oath Sash','Chain Belt','Hunter Cord'], leggings:['Rider Leggings','Mail Chausses','Riveted Cuisses','Padded Hose','Ash Greaves'],
    boots:['Riding Boots','Mud Boots','Sabatons','Path Boots','Barrow Boots'], gloves:['Padded Gloves','Mail Mitts','Grip Gloves','Ash Gloves','Knight Gauntlets'],
    necklace:['Reliquary','Sun Chain','Bone Charm','Oath Locket','Runed Necklace'], ring1:['Silver Ring','Garnet Ring','Ash Ring','Rune Ring','Knight Signet'],
    ring2:['Copper Ring','Pilgrim Ring','Moon Ring','Iron Ring','Dust Band'], trinket1:['Saint Token','Witch Knot','Bone Dice','War Medal','Fog Charm'],
    trinket2:['Tooth Charm','Prayer Bead','Coin Relic','Rune Pebble','Crow Feather'],
  };
  const rar = ['common','rare','epic','legendary'];
  let id = 0;
  SLOT_ORDER.forEach((slot, si) => {
    for (let i = 0; i < 16; i += 1) {
      const tier = 1 + Math.floor(i / 4);
      const p = tier + (i % 3);
      const s = {strength:0,intelligence:0,willpower:0,damage:0,attackSpeed:0,crit:0,reach:0,stunChance:0,defense:0,hpIncrease:0,evasion:0};
      if (slot === 'weapon') { s.damage = 8 + p * 3; s.attackSpeed = +(0.8 + p * 0.05).toFixed(2); s.crit = 3 + p * 2; s.reach = 1 + Math.floor(p/2); s.stunChance = 2 + p; s.strength = Math.floor(p/2); }
      else if (DEFENSE_SLOTS.includes(slot)) {
        const chestBonus = slot === 'chestArmor' ? 3 : 0;
        const armorBonus = slot === 'armor' ? 1 : 0;
        s.defense = 4 + p * 2 + chestBonus + armorBonus;
        s.hpIncrease = 10 + p * 5 + chestBonus * 3;
        s.evasion = Math.max(1, 10 - p - chestBonus + armorBonus);
      }
      else { s.strength = slot.includes('ring') ? 1 : 0; s.intelligence = Math.floor(p/2); s.willpower = Math.ceil(p/2); s.crit = p; }
      const rarity = rar[Math.min(3, tier - 1)];
      state.itemPool.push({
        id:`it-${++id}`,
        slot,
        rarity,
        tier,
        affixes: [`${CONTENT.affixes.prefix[(id + si) % CONTENT.affixes.prefix.length]}`, `${CONTENT.affixes.suffix[(id + i) % CONTENT.affixes.suffix.length]}`],
        sockets: rarity === 'legendary' ? 2 : rarity === 'epic' ? 1 : 0,
        gems: [],
        setName: (slot === 'chestArmor' || slot === 'boots') && tier >= 3 ? 'Ward of Cinders' : null,
        uniqueName: rarity === 'legendary' && i % 7 === 0 ? 'Relic of the Dread March' : null,
        levelReq: Math.max(1, tier + Math.floor(i / 5)),
        bonusEffect: rarity === 'legendary' ? 'Soulbound Ward' : rarity === 'epic' ? 'Arcane Resonance' : rarity === 'rare' ? 'Battle Focus' : 'Field Ready',
        lore: slotLore[slot] || 'Recovered from a forgotten caravan of the Marches.',
        name:`${rarity.toUpperCase()} ${names[slot][i%5]} ${tier}`,
        stats:s,
        appearance:{hue:(si*27+i*9)%360}
      });
    }
  });
  state.itemPool = state.itemPool.slice(0, 200);
  const starterWeapon = state.itemPool.find((it) => it.slot === 'weapon' && it.rarity === 'common' && it.tier === 1);
  const starterChest = state.itemPool.find((it) => it.slot === 'chestArmor' && it.rarity === 'common' && it.tier === 1);
  state.player.inventory = [starterWeapon, starterChest].filter(Boolean);
}

function equipItem(item) {
  state.player.equipment[item.slot] = item;
  state.selectedItemId = item.id;
  applyKnight();
  renderEquipment();
  updateHud();
  renderCharacterScreen();
  renderItemDetails();
  addLog(`Equipped ${item.name}.`);
}

function renderEquipment() {
  el.equipment.innerHTML = '';
  const leftSlots = ['helmet', 'gloves', 'weapon', 'ring1', 'trinket1'];
  const rightSlots = ['necklace', 'chestArmor', 'offhand', 'ring2', 'trinket2'];
  const bottomSlots = ['boots', 'cape'];

  const makeSlot = (slot) => {
    const it = state.player.equipment[slot];
    const slotNode = document.createElement('div');
    const rarityClass = it ? `rarity-${it.rarity}` : '';
    const selectedClass = it && state.selectedItemId === it.id ? 'selected' : '';
    slotNode.className = `equip-slot ${it ? '' : 'empty'} ${rarityClass} ${selectedClass}`;
    slotNode.innerHTML = `
      <div class="slot-core">${it ? iconSvg(it) : `<span class="slot-empty">${slotPlaceholderGlyph(slot)}</span>`}</div>
      <span class="slot-label">${slotLabel(slot)}</span>
    `;
    slotNode.addEventListener('click', () => {
      if (!it) return;
      state.selectedItemId = it.id;
      renderEquipment();
      renderInventory();
      renderItemDetails();
    });
    return slotNode;
  };

  const board = document.createElement('div');
  board.className = 'equip-board';
  const leftCol = document.createElement('div'); leftCol.className = 'equip-col';
  const center = document.createElement('div'); center.className = 'equip-center';
  const rightCol = document.createElement('div'); rightCol.className = 'equip-col';
  const bottomRow = document.createElement('div'); bottomRow.className = 'equip-bottom';

  leftSlots.forEach((slot) => leftCol.appendChild(makeSlot(slot)));
  rightSlots.forEach((slot) => rightCol.appendChild(makeSlot(slot)));
  bottomSlots.forEach((slot) => bottomRow.appendChild(makeSlot(slot)));
  center.innerHTML = `<div class="paper-doll">Champion</div>`;

  board.append(leftCol, center, rightCol);
  el.equipment.append(board, bottomRow);
}

function slotPlaceholderGlyph(slot) {
  if (slot.includes('ring')) return '◌';
  if (slot.includes('trinket')) return '✦';
  if (slot === 'weapon') return '⚔';
  if (slot === 'offhand') return '🛡';
  if (slot === 'boots') return '⋈';
  return '✧';
}

function renderInventory() {
  el.inventory.innerHTML = '';
  const filter = state.inventoryFilter;
  const filtered = state.player.inventory.filter((item) => {
    if (filter === 'all') return true;
    if (['common', 'rare', 'epic', 'legendary'].includes(filter)) return item.rarity === filter;
    if (filter === 'weapon') return item.slot === 'weapon';
    if (filter === 'armor') return DEFENSE_SLOTS.includes(item.slot);
    if (filter === 'chestArmor') return item.slot === 'chestArmor';
    if (filter === 'helmet') return item.slot === 'helmet';
    if (filter === 'jewelry') return ['necklace', 'ring1', 'ring2', 'trinket1', 'trinket2'].includes(item.slot);
    return true;
  });
  filtered.slice(0, 40).forEach((item) => {
    const equipped = state.player.equipment[item.slot];
    const compareDefense = (item.stats.defense || 0) - (equipped?.stats?.defense || 0);
    const compareDamage = (item.stats.damage || 0) - (equipped?.stats?.damage || 0);
    const c = document.createElement('div');
    c.className = `item-card ${state.selectedItemId === item.id ? 'selected' : ''}`;
    c.innerHTML = `<div class='item-icon'>${iconSvg(item)}</div><div class='item-meta'><strong>${item.name}</strong><small>${slotLabel(item.slot)} · ${item.rarity}</small><small>${itemDesc(item.slot, item.stats)}</small><small>Compare: DMG ${compareDamage >= 0 ? '+' : ''}${compareDamage} | DEF ${compareDefense >= 0 ? '+' : ''}${compareDefense}</small><button>Equip</button><button class='salvage-btn'>Salvage</button></div>`;
    c.addEventListener('click', () => {
      state.selectedItemId = item.id;
      renderInventory();
      renderEquipment();
      renderItemDetails();
    });
    c.querySelector('button').addEventListener('click', (ev) => { ev.stopPropagation(); equipItem(item); });
    c.querySelector('.salvage-btn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      salvageItem(item.id);
    });
    el.inventory.appendChild(c);
  });
}

function salvageItem(itemId) {
  const idx = state.player.inventory.findIndex((it) => it.id === itemId);
  if (idx < 0) return;
  const item = state.player.inventory[idx];
  state.player.inventory.splice(idx, 1);
  state.player.materials.arcaneDust += 1 + (item.rarity === 'epic' ? 2 : item.rarity === 'legendary' ? 4 : 0);
  state.player.materials.ironShard += 1 + item.tier;
  addLog(`Salvaged ${item.name} for crafting materials.`);
  renderInventory();
  updateHud();
}

function maxPlayerHp() {
  return 120 + totalStat('hpIncrease') + derivedAttr('endurance') * 4 + Math.max(0, state.player.level - 1) * 8;
}

function totalStat(k) { return Object.values(state.player.equipment).reduce((a, it) => a + (it?.stats?.[k] || 0), 0); }
function derivedAttr(k) { return (state.player.stats[k] || 0) + totalStat(k); }

function calculationSnapshot() {
  const currentType = weaponTypeFromItem(state.player.equipment.weapon);
  const profBonus = 1 + proficiencyDamageBonus(currentType);
  const damage = Math.floor((totalStat('damage') + derivedAttr('strength') * 2) * profBonus);
  const crit = (0.58 + totalStat('crit') * 0.01).toFixed(2);
  const defense = totalStat('defense');
  const hp = state.player.hp + totalStat('hpIncrease');
  const evasion = (derivedAttr('dexterity') * 0.5 + totalStat('evasion')).toFixed(1);
  const fatigue = Number.isFinite(state.player.fatigue) ? state.player.fatigue : 0;
  const bodyTemp = Number.isFinite(state.player.bodyTemp) ? state.player.bodyTemp : 36.8;
  return { damage, crit, defense, hp, evasion, fatigue: fatigue.toFixed(1), bodyTemp: bodyTemp.toFixed(1) };
}

function updateHud() {
  const calc = calculationSnapshot();
  const hpMax = maxPlayerHp();
  state.player.hp = clamp(state.player.hp, 0, hpMax);
  const manaMax = 60;
  el.coreStats.innerHTML = `
    <div class="resource-bar">
      <div class="resource-label">HP ${Math.round(state.player.hp)}/${Math.round(hpMax)}</div>
      <div class="resource-track hp"><span style="width:${clamp((state.player.hp / hpMax) * 100, 0, 100)}%"></span></div>
    </div>
    <div class="resource-bar">
      <div class="resource-label">MANA ${Math.round(state.player.mana)}/${manaMax}</div>
      <div class="resource-track mana"><span style="width:${clamp((state.player.mana / manaMax) * 100, 0, 100)}%"></span></div>
    </div>
  `;
  el.resourceBars.innerHTML = '';
  [['ATK', calc.damage], ['DEF', calc.defense], ['FTG', calc.fatigue], ['STM', state.player.stamina]].forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'pill';
    d.textContent = `${k} ${typeof v === 'number' ? Math.round(v) : v}`;
    el.resourceBars.appendChild(d);
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
  renderCharacterStatsPanel();
  renderWeaponProficiencyPanel();
}

function renderCharacterStatsPanel() {
  if (!el.characterStatsPanel) return;
  const calc = calculationSnapshot();
  const lines = [
    ['Attack', calc.damage],
    ['Defense', calc.defense],
    ['Magic', derivedAttr('intelligence') * 2 + totalStat('willpower')],
    ['Agility', Math.round(derivedAttr('dexterity') * 1.6)],
    ['Vitality', calc.hp],
    ['Crit %', Math.round(calc.crit * 100)],
  ];
  el.characterStatsPanel.innerHTML = lines.map(([k, v]) => `<div class="stat-chip"><strong>${k}</strong><br>${v}</div>`).join('');
}

function renderWeaponProficiencyPanel() {
  if (!el.weaponProficiencyPanel) return;
  ensureWeaponProficiency();
  el.weaponProficiencyPanel.innerHTML = WEAPON_TYPES.map((type) => {
    const prof = state.player.weaponProficiency[type];
    const xp = prof.xp || 0;
    const level = proficiencyLevel(type);
    const unlocked = prof.unlocked?.length ? prof.unlocked.join(' • ') : 'No passive unlocked yet';
    return `
      <div class="wp-row">
        <div class="wp-head"><strong>${type.toUpperCase()}</strong><span>Lv ${level}</span><span>${xp}/10000</span></div>
        <div class="wp-bar"><span style="width:${(xp / 10000) * 100}%"></span></div>
        <small>${unlocked}</small>
      </div>
    `;
  }).join('');
}

function renderItemDetails() {
  if (!el.itemDetails) return;
  const selected = state.player.inventory.find((it) => it.id === state.selectedItemId)
    || Object.values(state.player.equipment).find((it) => it?.id === state.selectedItemId);
  if (!selected) {
    el.itemDetails.innerHTML = `<p>Select an equipped or inventory item to inspect its details.</p>`;
    return;
  }
  el.itemDetails.innerHTML = `
    <h4>${selected.name}</h4>
    <span class="rarity ${selected.rarity}">${selected.rarity}</span>
    ${selected.uniqueName ? `<p><strong>Unique:</strong> ${selected.uniqueName}</p>` : ''}
    ${selected.setName ? `<p><strong>Set:</strong> ${selected.setName}</p>` : ''}
    <p><strong>Type:</strong> ${slotLabel(selected.slot)}</p>
    <p><strong>Level Requirement:</strong> ${selected.levelReq || selected.tier}</p>
    <p><strong>Stats:</strong> ${itemDesc(selected.slot, selected.stats)}</p>
    <p><strong>Affixes:</strong> ${(selected.affixes || []).join(' · ') || 'None'}</p>
    <p><strong>Sockets:</strong> ${selected.sockets || 0} ${selected.gems?.length ? `(${selected.gems.join(', ')})` : ''}</p>
    <p><strong>Bonus Effect:</strong> ${selected.bonusEffect || 'None'}</p>
    <p><strong>Lore:</strong> ${selected.lore || 'An item from the Ashen Marches.'}</p>
  `;
}

function generateBestiary() {
  const names = [
    'Bog Ghoul', 'Fen Raider', 'Crypt Hound', 'Ash Spider', 'Hollow Monk', 'Rook Bandit', 'Rot Boar', 'Cairn Witch', 'Mire Stalker', 'Grave Crow',
    'Warden Shade', 'Pike Marauder', 'Blight Wolf', 'Bone Knight', 'Thorn Devourer', 'Howling Penitent', 'Stone Revenant', 'Blood Vicar', 'Maw Leech', 'Iron Troll',
    'Dread Pilgrim', 'Fog Serpent', 'Ruin Harpy', 'Oathbreaker', 'Nightsworn Giant',
    'Barrow Lancer', 'Tomb Acolyte', 'Soot Charger', 'Ravenous Lurker', 'Ember Gnawer',
    'Witchfen Stalker', 'Marsh Paladin', 'Brine Widow', 'Mire Fang', 'Ghast Piper',
    'Ashen Enforcer', 'Storm Cairn Drake', 'Crypt Arbalist', 'Cinder Harrier', 'Nocturne Howler',
    'Moonlit Reaver', 'Dusk Ravager', 'Rimebound Sentry', 'Woad Hexer', 'Briar Executioner',
  ];
  state.bestiary = names.map((name, i) => ({
    name,
    tier: 1 + Math.floor(i / 7),
    hp: 45 + i * 6,
    attack: 9 + i,
    poise: 30 + i * 3,
    evasion: 0.05 + i * 0.005,
    hue: (i * 17) % 360,
    isBossTemplate: i % 11 === 0,
  }));
}

function monsterSvg(name, h) {
  if (name.includes('Spider')) {
    return `<svg viewBox='0 0 80 80'>
      <ellipse cx='40' cy='45' rx='17' ry='13' fill='hsl(${h} 46% 20%)'/>
      <ellipse cx='40' cy='32' rx='12' ry='10' fill='hsl(${h} 56% 30%)'/>
      <ellipse cx='40' cy='47' rx='10' ry='8' fill='hsl(${h} 41% 15%)'/>
      <circle cx='35' cy='30' r='1.8' fill='#fff'/>
      <circle cx='45' cy='30' r='1.8' fill='#fff'/>
      <circle cx='35' cy='30' r='0.7' fill='#111'/>
      <circle cx='45' cy='30' r='0.7' fill='#111'/>
      <circle cx='40' cy='37' r='2.1' fill='hsl(${h} 72% 60%)'/>
      <circle cx='34' cy='40' r='1.2' fill='hsl(${h} 18% 75%)'/>
      <circle cx='46' cy='40' r='1.2' fill='hsl(${h} 18% 75%)'/>
      <circle cx='31' cy='44' r='1' fill='hsl(${h} 18% 70%)'/>
      <circle cx='49' cy='44' r='1' fill='hsl(${h} 18% 70%)'/>
      <circle cx='40' cy='23' r='1.8' fill='hsl(${h} 58% 40%)'/>
      <circle cx='40' cy='57' r='1.4' fill='hsl(${h} 42% 36%)'/>
      <path d='M35 52 L45 52' stroke='hsl(${h} 20% 72%)' stroke-width='1.4'/>
      <path d='M28 28 L19 23' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M52 28 L61 23' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M28 34 L14 31' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M52 34 L66 31' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M27 39 L12 41' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M53 39 L68 41' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M28 45 L13 51' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M52 45 L67 51' stroke='hsl(${h} 33% 56%)' stroke-width='2.8' stroke-linecap='round'/>
      <path d='M31 26 L26 20' stroke='hsl(${h} 35% 44%)' stroke-width='1.2'/>
      <path d='M49 26 L54 20' stroke='hsl(${h} 35% 44%)' stroke-width='1.2'/>
      <path d='M33 49 L30 53' stroke='hsl(${h} 35% 44%)' stroke-width='1.2'/>
      <path d='M47 49 L50 53' stroke='hsl(${h} 35% 44%)' stroke-width='1.2'/>
      <circle cx='24' cy='33' r='1.1' fill='hsl(${h} 18% 70%)'/>
      <circle cx='56' cy='33' r='1.1' fill='hsl(${h} 18% 70%)'/>
      <circle cx='40' cy='50' r='1.2' fill='hsl(${h} 18% 70%)'/>
    </svg>`;
  }
  if (name.includes('Wolf') || name.includes('Hound')) {
    return `<svg viewBox='0 0 80 80'>
      <path d='M11 55 L23 33 L51 33 L66 48 L57 61 L18 61 Z' fill='hsl(${h} 40% 24%)'/>
      <path d='M24 34 L28 20 L35 31 L43 21 L50 34 Z' fill='hsl(${h} 49% 34%)'/>
      <path d='M22 45 L55 45' stroke='hsl(${h} 30% 40%)' stroke-width='8' stroke-linecap='round'/>
      <path d='M50 42 L59 39 L56 47 Z' fill='hsl(${h} 26% 44%)'/>
      <path d='M63 49 L72 46 L67 55 Z' fill='hsl(${h} 25% 38%)'/>
      <path d='M23 35 L17 29 L20 42 Z' fill='hsl(${h} 30% 30%)'/>
      <circle cx='33' cy='40' r='2.1' fill='#fff'/>
      <circle cx='35' cy='40' r='1' fill='#111'/>
      <circle cx='30' cy='43' r='0.7' fill='hsl(${h} 10% 75%)'/>
      <path d='M25 48 L53 48' stroke='hsl(${h} 14% 64%)' stroke-width='1.6'/>
      <path d='M22 55 L26 63' stroke='hsl(${h} 26% 64%)' stroke-width='2.2' stroke-linecap='round'/>
      <path d='M36 56 L39 64' stroke='hsl(${h} 26% 64%)' stroke-width='2.2' stroke-linecap='round'/>
      <path d='M47 56 L50 64' stroke='hsl(${h} 26% 64%)' stroke-width='2.2' stroke-linecap='round'/>
      <path d='M55 54 L59 62' stroke='hsl(${h} 26% 64%)' stroke-width='2.2' stroke-linecap='round'/>
      <circle cx='19' cy='46' r='1.1' fill='hsl(${h} 12% 16%)'/>
      <circle cx='27' cy='46' r='1.1' fill='hsl(${h} 12% 16%)'/>
      <circle cx='35' cy='46' r='1.1' fill='hsl(${h} 12% 16%)'/>
      <circle cx='43' cy='46' r='1.1' fill='hsl(${h} 12% 16%)'/>
      <circle cx='51' cy='46' r='1.1' fill='hsl(${h} 12% 16%)'/>
      <circle cx='58' cy='49' r='1' fill='hsl(${h} 10% 18%)'/>
      <path d='M26 28 L31 30' stroke='hsl(${h} 22% 62%)' stroke-width='1.2'/>
      <path d='M41 27 L46 29' stroke='hsl(${h} 22% 62%)' stroke-width='1.2'/>
      <path d='M30 37 L37 35' stroke='hsl(${h} 18% 56%)' stroke-width='1.2'/>
      <path d='M38 36 L45 34' stroke='hsl(${h} 18% 56%)' stroke-width='1.2'/>
      <path d='M24 50 L31 52' stroke='hsl(${h} 18% 56%)' stroke-width='1.2'/>
      <path d='M32 51 L39 53' stroke='hsl(${h} 18% 56%)' stroke-width='1.2'/>
      <path d='M40 52 L47 54' stroke='hsl(${h} 18% 56%)' stroke-width='1.2'/>
      <path d='M48 53 L55 55' stroke='hsl(${h} 18% 56%)' stroke-width='1.2'/>
      <circle cx='61' cy='52' r='0.9' fill='hsl(${h} 10% 16%)'/>
      <circle cx='15' cy='53' r='0.9' fill='hsl(${h} 10% 16%)'/>
    </svg>`;
  }
  if (name.includes('Harpy') || name.includes('Crow')) {
    return `<svg viewBox='0 0 80 80'>
      <path d='M8 44 Q40 12 72 44 Q40 34 8 44 Z' fill='hsl(${h} 44% 26%)'/>
      <path d='M12 45 Q24 33 36 39 Q22 43 12 45 Z' fill='hsl(${h} 50% 34%)'/>
      <path d='M68 45 Q56 33 44 39 Q58 43 68 45 Z' fill='hsl(${h} 50% 34%)'/>
      <ellipse cx='40' cy='49' rx='12' ry='10' fill='hsl(${h} 54% 38%)'/>
      <ellipse cx='40' cy='50' rx='8' ry='6' fill='hsl(${h} 44% 24%)'/>
      <path d='M40 28 L45 37 L35 37 Z' fill='hsl(${h} 62% 56%)'/>
      <path d='M39 36 L43 43 L37 43 Z' fill='hsl(${h} 28% 48%)'/>
      <circle cx='37' cy='48' r='1.6' fill='#fff'/>
      <circle cx='43' cy='48' r='1.6' fill='#fff'/>
      <circle cx='37' cy='48' r='0.7' fill='#111'/>
      <circle cx='43' cy='48' r='0.7' fill='#111'/>
      <path d='M34 56 L40 63 L46 56' stroke='hsl(${h} 28% 72%)' stroke-width='2' fill='none'/>
      <path d='M15 43 L22 50 L16 55' stroke='hsl(${h} 36% 58%)' stroke-width='2'/>
      <path d='M65 43 L58 50 L64 55' stroke='hsl(${h} 36% 58%)' stroke-width='2'/>
      <circle cx='28' cy='44' r='1' fill='hsl(${h} 18% 82%)'/>
      <circle cx='32' cy='43' r='1' fill='hsl(${h} 18% 82%)'/>
      <circle cx='48' cy='43' r='1' fill='hsl(${h} 18% 82%)'/>
      <circle cx='52' cy='44' r='1' fill='hsl(${h} 18% 82%)'/>
      <path d='M24 37 L30 40' stroke='hsl(${h} 34% 66%)' stroke-width='1.3'/>
      <path d='M56 37 L50 40' stroke='hsl(${h} 34% 66%)' stroke-width='1.3'/>
      <path d='M18 46 L24 48' stroke='hsl(${h} 20% 70%)' stroke-width='1.1'/>
      <path d='M24 48 L30 50' stroke='hsl(${h} 20% 70%)' stroke-width='1.1'/>
      <path d='M30 50 L36 52' stroke='hsl(${h} 20% 70%)' stroke-width='1.1'/>
      <path d='M62 46 L56 48' stroke='hsl(${h} 20% 70%)' stroke-width='1.1'/>
      <path d='M56 48 L50 50' stroke='hsl(${h} 20% 70%)' stroke-width='1.1'/>
      <path d='M50 50 L44 52' stroke='hsl(${h} 20% 70%)' stroke-width='1.1'/>
      <circle cx='40' cy='65' r='1.4' fill='hsl(${h} 18% 72%)'/>
      <circle cx='35' cy='63' r='0.9' fill='hsl(${h} 18% 66%)'/>
      <circle cx='45' cy='63' r='0.9' fill='hsl(${h} 18% 66%)'/>
      <circle cx='40' cy='60' r='0.9' fill='hsl(${h} 18% 66%)'/>
    </svg>`;
  }
  return `<svg viewBox='0 0 80 80'>
    <ellipse cx='40' cy='46' rx='24' ry='18' fill='hsl(${h} 40% 28%)'/>
    <ellipse cx='40' cy='47' rx='18' ry='13' fill='hsl(${h} 46% 20%)'/>
    <circle cx='31' cy='40' r='6' fill='hsl(${h} 67% 54%)'/>
    <circle cx='49' cy='40' r='6' fill='hsl(${h} 67% 54%)'/>
    <circle cx='31' cy='40' r='2' fill='#111'/>
    <circle cx='49' cy='40' r='2' fill='#111'/>
    <circle cx='26' cy='37' r='1.1' fill='hsl(${h} 10% 76%)'/>
    <circle cx='54' cy='37' r='1.1' fill='hsl(${h} 10% 76%)'/>
    <path d='M26 53 Q40 60 54 53' stroke='hsl(${h} 25% 72%)' stroke-width='2' fill='none'/>
    <path d='M33 54 L37 51' stroke='hsl(${h} 12% 62%)' stroke-width='1.2'/>
    <path d='M47 54 L43 51' stroke='hsl(${h} 12% 62%)' stroke-width='1.2'/>
    <path d='M18 45 L10 42' stroke='hsl(${h} 30% 54%)' stroke-width='2'/>
    <path d='M62 45 L70 42' stroke='hsl(${h} 30% 54%)' stroke-width='2'/>
    <path d='M20 52 L12 56' stroke='hsl(${h} 30% 54%)' stroke-width='2'/>
    <path d='M60 52 L68 56' stroke='hsl(${h} 30% 54%)' stroke-width='2'/>
    <circle cx='24' cy='46' r='1' fill='hsl(${h} 10% 16%)'/>
    <circle cx='30' cy='46' r='1' fill='hsl(${h} 10% 16%)'/>
    <circle cx='36' cy='46' r='1' fill='hsl(${h} 10% 16%)'/>
    <circle cx='44' cy='46' r='1' fill='hsl(${h} 10% 16%)'/>
    <circle cx='50' cy='46' r='1' fill='hsl(${h} 10% 16%)'/>
    <circle cx='56' cy='46' r='1' fill='hsl(${h} 10% 16%)'/>
    <path d='M32 28 L40 18 L48 28' stroke='hsl(${h} 35% 60%)' stroke-width='2' fill='none'/>
    <path d='M34 28 L40 24 L46 28' stroke='hsl(${h} 35% 50%)' stroke-width='1.4' fill='none'/>
    <circle cx='40' cy='31' r='1.2' fill='hsl(${h} 18% 68%)'/>
    <circle cx='21' cy='50' r='0.9' fill='hsl(${h} 10% 14%)'/>
    <circle cx='59' cy='50' r='0.9' fill='hsl(${h} 10% 14%)'/>
    <path d='M24 56 L29 58' stroke='hsl(${h} 18% 62%)' stroke-width='1.1'/>
    <path d='M29 58 L34 59' stroke='hsl(${h} 18% 62%)' stroke-width='1.1'/>
    <path d='M56 56 L51 58' stroke='hsl(${h} 18% 62%)' stroke-width='1.1'/>
    <path d='M51 58 L46 59' stroke='hsl(${h} 18% 62%)' stroke-width='1.1'/>
  </svg>`;
}

function respawnMonsters() {
  if (!state.bestiary.length) return;
  state.monsters = [];
  replenishMonsters(14);
}

function replenishMonsters(targetCount = 14) {
  if (!state.bestiary.length) return;
  const p = state.player.pos;
  const zone = zoneAt(p.x, p.y);
  for (let i = state.monsters.length; i < targetCount; i += 1) {
    const pool = state.bestiary.filter((b) => b.tier <= zone.maxTier + 1 && b.tier >= Math.max(1, zone.minTier - 1));
    const t = (pool.length ? pool : state.bestiary)[rand(0, (pool.length ? pool : state.bestiary).length - 1)];
    const isElite = Math.random() < 0.16;
    const isBoss = state.dungeon.active && !state.dungeon.objectiveBossDefeated && (t.isBossTemplate || Math.random() < 0.12);
    state.monsters.push({
      ...t,
      uid: `m-${Date.now()}-${i}`,
      isElite,
      isBoss,
      x: clamp(p.x + rand(-18, 18), 0, MAP_SIZE - 1),
      y: clamp(p.y + rand(-18, 18), 0, MAP_SIZE - 1),
      hpNow: Math.floor(t.hp * (isBoss ? 2.5 : isElite ? 1.45 : 1)),
      poiseNow: t.poise,
      intent: 'Strike',
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
    node.dataset.uid = m.uid;
    node.innerHTML = monsterSvg(m.name, m.hue);
    const p = iso(m.x - px + VIEW_RADIUS, m.y - py + VIEW_RADIUS);
    node.style.left = `${p.x + 38}px`;
    node.style.top = `${p.y + 24}px`;
    fragment.appendChild(node);
  });
  return fragment;
}

function openCombatStage(monster) {
  if (!el.combatStage) return;
  el.combatStage.classList.remove('hidden');
  el.combatPlayer.innerHTML = knightSvg(getKnightAppearance());
  el.combatMonster.innerHTML = monsterSvg(monster.name, monster.hue);
}

function closeCombatStage() {
  if (!el.combatStage) return;
  el.combatStage.classList.add('hidden');
  if (el.combatPlayerNums) el.combatPlayerNums.innerHTML = '';
  if (el.combatMonsterNums) el.combatMonsterNums.innerHTML = '';
}

function combatActorAnimate(target, cls) {
  target.classList.remove(cls);
  void target.offsetWidth;
  target.classList.add(cls);
}

function showCombatDamage(targetNums, value, crit = false) {
  if (!targetNums) return;
  const n = document.createElement('div');
  n.className = `combat-float ${crit ? 'crit' : ''}`;
  n.textContent = `${value}`;
  targetNums.appendChild(n);
  setTimeout(() => n.remove(), 850);
}

function bindTabs() {
  document.querySelectorAll('.nav-btn').forEach((btn) => bindTapAction(btn, () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`screen-${btn.dataset.screen}`).classList.add('active');
    if (btn.dataset.screen === 'character') renderCharacterScreen();
  }));
}

function bindTapAction(node, handler) {
  if (!node) return;
  let gate = false;
  const run = (ev) => {
    ev.preventDefault?.();
    if (gate) return;
    gate = true;
    handler(ev);
    setTimeout(() => { gate = false; }, 220);
  };
  node.addEventListener('pointerup', run);
  node.addEventListener('click', run);
}

function bindMapTap() {
  const onTap = (clientX, clientY) => {
    const { x, y } = screenToWorldTile(clientX, clientY);
    state.destination = { x, y };
    state.mode = 'explore';
    state.encounter = null;
    el.encounter.textContent = `Travelling to (${x}, ${y}) through ${biomeAt(x, y)}.`;
  };
  el.world.addEventListener('pointerdown', (ev) => onTap(ev.clientX, ev.clientY));
  el.world.addEventListener('click', (ev) => onTap(ev.clientX, ev.clientY));
  el.world.addEventListener('touchstart', (ev) => {
    if (!ev.touches?.length) return;
    onTap(ev.touches[0].clientX, ev.touches[0].clientY);
  }, { passive: true });
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
    state.player.hp = clamp(state.player.hp + gain, 0, maxPlayerHp());
    state.player.stamina = clamp(state.player.stamina - 3, 0, 100);
    addLog(`You forage in ${biome} terrain and recover ${gain} vitality.`);
    updateHud();
  });
  const dungeon = document.createElement('button');
  dungeon.textContent = state.dungeon.active ? 'Leave Dungeon' : 'Enter Dungeon';
  dungeon.addEventListener('click', () => {
    state.dungeon.active = !state.dungeon.active;
    state.dungeon.objectiveBossDefeated = false;
    state.dungeon.tier = zoneAt(state.player.pos.x, state.player.pos.y).maxTier;
    state.monsters = [];
    replenishMonsters(state.dungeon.active ? 8 : 14);
    addLog(state.dungeon.active ? `Entered dungeon tier ${state.dungeon.tier}.` : 'Returned to the overworld.');
    setExploreActions();
  });
  el.actions.append(camp, forage, dungeon);
}

function progressQuest(id, amount) {
  const q = state.quests.find((x) => x.id === id);
  if (!q || q.done) return;
  q.progress = Math.min(q.goal, q.progress + amount);
  if (q.progress >= q.goal) {
    q.done = true;
    addLog(`Quest complete: ${q.title}.`);
    state.player.materials.arcaneDust += 5;
  }
}

function updateQuestTracker() {
  if (!el.questTracker) return;
  const active = state.quests.find((q) => !q.done) || state.quests[0];
  if (!active) { el.questTracker.textContent = 'Quest: None'; return; }
  el.questTracker.textContent = `Quest: ${active.title} — ${active.progress}/${active.goal}`;
}

function exportSave() {
  return {
    version: SAVE_VERSION,
    day: state.day,
    mode: state.mode,
    player: state.player,
    monsters: state.monsters,
    encounter: state.encounter,
    quests: state.quests,
    dungeon: state.dungeon,
  };
}

function applySaveData(data) {
  if (!data || !data.player) return false;
  const version = data.version || 1;
  state.day = data.day ?? 1;
  state.mode = data.mode ?? 'explore';
  const basePlayer = {
    pos: { x: 512, y: 512 },
    hp: 120,
    stamina: 100,
    focus: 70,
    fatigue: 0,
    bodyTemp: 36.8,
    level: 1,
    xp: 0,
    xpToNext: 100,
    unspentAttr: 0,
    stats: { strength: 7, dexterity: 7, intelligence: 6, endurance: 8, willpower: 6 },
    equipment: {},
    inventory: [],
  };
  state.player = {
    ...basePlayer,
    ...data.player,
    pos: { ...basePlayer.pos, ...(data.player.pos || {}) },
    stats: { ...basePlayer.stats, ...(data.player.stats || {}) },
    xp: Number.isFinite(data.player.xp) ? data.player.xp : 0,
    level: Number.isFinite(data.player.level) ? data.player.level : 1,
    xpToNext: Number.isFinite(data.player.xpToNext) ? data.player.xpToNext : 100,
    unspentAttr: Number.isFinite(data.player.unspentAttr) ? data.player.unspentAttr : 0,
    equipment: { ...(data.player.equipment || {}) },
    inventory: Array.isArray(data.player.inventory) ? data.player.inventory : [],
  };
  ensureWeaponProficiency();
  state.monsters = Array.isArray(data.monsters) ? data.monsters : [];
  state.encounter = data.encounter ?? null;
  state.quests = Array.isArray(data.quests) ? data.quests : state.quests;
  state.dungeon = data.dungeon || state.dungeon;
  if (version < 2) {
    state.player.materials = state.player.materials || { arcaneDust: 0, ironShard: 0 };
    state.player.stash = state.player.stash || [];
    state.quests = state.quests?.length ? state.quests : [{ id: 'hunt-elite', title: 'Cull Elite Threats', objective: 'Defeat 2 elite monsters', progress: 0, goal: 2, done: false }];
  }
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
    renderItemDetails();
    updateHud();
    renderMapChunk();
    updateQuestTracker();
    if (state.player.unspentAttr > 0) showLevelUpPanel();
    addLog('Save loaded.');
  } catch (err) {
    addLog('Load failed (corrupt save).');
  }
}

function startNewGame() {
  const confirmed = window.confirm('Start a new game? This will delete your current saved progress.');
  if (!confirmed) return;
  localStorage.removeItem(SAVE_KEY);
  window.location.reload();
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
  if (state.destination) {
    const biomeMoving = biomeAt(state.player.pos.x, state.player.pos.y);
    el.encounter.textContent = `Marching... Biome: ${biomeMoving}.`;
    return;
  }
  const p = state.player.pos;
  const biome = biomeAt(p.x, p.y);
  const zone = zoneAt(p.x, p.y);
  const travel = biomeTravelProfile(biome);
  const m = state.monsters.find((x) => Math.max(Math.abs(x.x - p.x), Math.abs(x.y - p.y)) <= 1);
  if (!m) {
    el.encounter.textContent = `Exploring ${zone.name} (${zone.minTier}-${zone.maxTier}). Biome: ${biome}. Terrain load ${travel.stamina.toFixed(2)}x.`;
    closeCombatStage();
    setExploreActions();
    return;
  }
  state.encounter = m;
  state.mode = 'combat';
  openCombatStage(m);
  const threat = m.isBoss ? 'Boss' : m.isElite ? 'Elite' : 'Normal';
  el.encounter.textContent = `${threat} ${m.name} confronts you. Intent: ${m.intent}.`;
  el.actions.innerHTML = '';
  ['Strike', 'Power Strike', 'Guard', 'Dodge', 'Assess', 'Withdraw'].forEach((a) => {
    const b = document.createElement('button'); b.textContent = a; b.addEventListener('click', () => combatAction(a.toLowerCase())); el.actions.appendChild(b);
  });
}

function combatAction(action) {
  if (!state.encounter) return;
  if (action === 'withdraw') { state.mode = 'explore'; state.encounter = null; closeCombatStage(); setExploreActions(); return; }
  if (action === 'assess') { el.encounter.textContent = `${state.encounter.name} HP ${Math.max(0, state.encounter.hpNow)} Poise ${Math.max(0, state.encounter.poiseNow)}`; enemyTurn(1); return; }
  if (action === 'guard') { state.player.stamina = clamp(state.player.stamina + 8, 0, 100); enemyTurn(0.6); return; }
  if (action === 'dodge') { state.player.stamina = clamp(state.player.stamina - 6, 0, 100); enemyTurn(0.35); return; }
  if (action === 'power strike') {
    if (state.player.skillCooldowns.powerStrike > 0 || state.player.mana < 12) {
      addLog('Power Strike is unavailable.');
      enemyTurn(1);
      return;
    }
    state.player.mana = clamp(state.player.mana - 12, 0, 60);
    state.player.skillCooldowns.powerStrike = 3;
  }
  animatePlayerAttack(state.encounter.uid);
  if (el.combatPlayer) combatActorAnimate(el.combatPlayer, 'attack');
  const weaponType = weaponTypeFromItem(state.player.equipment.weapon);
  addWeaponProficiencyXP(weaponType, action === 'power strike' ? 55 : 30);
  const dmgBase = Math.floor((totalStat('damage') + state.player.stats.strength * 2 + rand(4, 10)) * (1 + proficiencyDamageBonus(weaponType)));
  const dmg = action === 'power strike' ? Math.floor(dmgBase * 1.65) : dmgBase;
  let dealt = dmg;
  let crit = false;
  if (Math.random() < (0.58 + totalStat('crit') * 0.01)) { dealt = Math.floor(dmg * 1.5); crit = true; }
  state.encounter.hpNow -= dealt;
  if (el.combatMonster) combatActorAnimate(el.combatMonster, 'hit');
  showCombatDamage(el.combatMonsterNums, dealt, crit);
  enemyTurn(1);
  if (state.encounter.hpNow <= 0) {
    addLog(`Defeated ${state.encounter.name}.`);
    if (state.encounter.isElite || state.encounter.isBoss) progressQuest('hunt-elite', 1);
    if (state.encounter.isBoss) state.dungeon.objectiveBossDefeated = true;
    grantXp((state.encounter.tier || 1) * 24 + rand(8, 18));
    const loot = rollLoot(state.encounter);
    if (loot) {
      state.player.inventory.unshift(loot);
      addLog(`Loot found: ${loot.name}.`);
      showLootDrop(loot);
      renderInventory();
    }
    state.monsters = state.monsters.filter((m) => m.uid !== state.encounter.uid);
    state.encounter = null;
    state.mode = 'explore';
    closeCombatStage();
    setExploreActions();
    updateQuestTracker();
  }
}

function rollLoot(monster) {
  const tier = monster.tier || 1;
  const rarityAllowed = tier === 1 ? ['common'] : tier === 2 ? ['common', 'rare'] : tier === 3 ? ['rare', 'epic'] : ['epic', 'legendary'];
  const pool = state.itemPool.filter((it) => it.tier <= Math.min(4, tier + 1) && rarityAllowed.includes(it.rarity));
  const fallbackPool = state.itemPool.length ? state.itemPool : state.player.inventory;
  const sourcePool = pool.length ? pool : fallbackPool;
  if (!sourcePool.length) return null;
  const weighted = sourcePool.filter((it) => DEFENSE_SLOTS.includes(it.slot) || it.slot === 'weapon');
  const picked = (weighted.length && Math.random() > 0.35)
    ? weighted[rand(0, weighted.length - 1)]
    : sourcePool[rand(0, sourcePool.length - 1)];
  return {
    ...picked,
    id: `loot-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: picked.name,
    stats: { ...picked.stats },
    appearance: { ...picked.appearance },
  };
}

function showLootDrop(item) {
  if (!el.lootDrop) return;
  el.lootDrop.textContent = `Loot Acquired: ${item.name}`;
  el.lootDrop.classList.remove('show');
  void el.lootDrop.offsetWidth;
  el.lootDrop.classList.add('show');
}

function slotLabel(slot) {
  return SLOT_LABELS[slot] || slot;
}

function enemyTurn(mult) {
  if (!state.encounter) return;
  state.player.skillCooldowns.powerStrike = Math.max(0, state.player.skillCooldowns.powerStrike - 1);
  state.encounter.intent = Math.random() > 0.6 ? 'Heavy Blow' : 'Quick Slash';
  const fatiguePenalty = 1 + state.player.fatigue / 220;
  const hit = Math.max(1, Math.floor((state.encounter.attack + rand(0, 7)) * mult * fatiguePenalty - totalStat('defense') * 0.35));
  if (el.combatMonster) combatActorAnimate(el.combatMonster, 'attack');
  if (el.combatPlayer) combatActorAnimate(el.combatPlayer, 'hit');
  showCombatDamage(el.combatPlayerNums, hit, false);
  animatePlayerHurt();
  state.player.hp -= hit;
  if (state.player.hp <= 0) { addLog('You fell in battle. Refresh to restart.'); }
  updateHud();
}

function grantXp(amount) {
  state.player.xp += amount;
  addLog(`Gained ${amount} XP.`);
  let leveled = false;
  while (state.player.xp >= state.player.xpToNext) {
    state.player.xp -= state.player.xpToNext;
    state.player.level += 1;
    state.player.xpToNext = Math.floor(state.player.xpToNext * 1.3);
    state.player.unspentAttr += 2;
    leveled = true;
    addLog(`Reached level ${state.player.level}! Choose attributes to improve.`);
  }
  if (leveled) showLevelUpPanel();
  updateHud();
  renderCharacterScreen();
}

function showLevelUpPanel() {
  if (!el.levelUpPanel || state.player.unspentAttr <= 0) return;
  el.levelUpPanel.classList.remove('hidden');
  el.levelUpText.textContent = `Spend ${state.player.unspentAttr} attribute point(s).`;
  const attrs = ['strength', 'dexterity', 'intelligence', 'endurance', 'willpower'];
  el.levelUpChoices.innerHTML = '';
  attrs.forEach((attr) => {
    const btn = document.createElement('button');
    btn.textContent = `+1 ${attr.toUpperCase().slice(0, 3)}`;
    btn.addEventListener('click', () => {
      if (state.player.unspentAttr <= 0) return;
      state.player.stats[attr] += 1;
      state.player.unspentAttr -= 1;
      addLog(`${attr} increased to ${state.player.stats[attr]}.`);
      updateHud();
      renderCharacterScreen();
      if (state.player.unspentAttr <= 0) {
        el.levelUpPanel.classList.add('hidden');
      } else {
        el.levelUpText.textContent = `Spend ${state.player.unspentAttr} attribute point(s).`;
      }
    });
    el.levelUpChoices.appendChild(btn);
  });
}

function animatePlayerAttack(monsterUid) {
  el.player.classList.remove('attack');
  void el.player.offsetWidth;
  el.player.classList.add('attack');
  const monsterNode = el.world.querySelector(`.monster[data-uid="${monsterUid}"]`);
  if (monsterNode) {
    monsterNode.classList.remove('hit');
    void monsterNode.offsetWidth;
    monsterNode.classList.add('hit');
  }
}

function animatePlayerHurt() {
  el.player.classList.remove('hurt');
  void el.player.offsetWidth;
  el.player.classList.add('hurt');
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
  state.player.equipment = {};
  const starterWeapon = state.player.inventory.find((x) => x.slot === 'weapon');
  const starterChest = state.player.inventory.find((x) => x.slot === 'chestArmor');
  if (starterWeapon) state.player.equipment.weapon = starterWeapon;
  if (starterChest) state.player.equipment.chestArmor = starterChest;
}

function init() {
  generateItems();
  ensureWeaponProficiency();
  generateBestiary();
  respawnMonsters();
  initStarterEquip();
  applyKnight();
  renderEquipment();
  renderInventory();
  renderCharacterScreen();
  renderItemDetails();
  updateHud();
  updateQuestTracker();
  renderMapChunk();
  bindMapTap();
  bindTabs();
  setExploreActions();
  if (el.inventoryFilter) {
    el.inventoryFilter.addEventListener('change', (ev) => {
      state.inventoryFilter = ev.target.value;
      renderInventory();
    });
  }
  bindTapAction(el.saveBtn, saveGame);
  bindTapAction(el.loadBtn, loadGame);
  bindTapAction(el.newGameBtn, startNewGame);
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
        renderItemDetails();
        updateHud();
        renderMapChunk();
        updateQuestTracker();
        if (state.player.unspentAttr > 0) showLevelUpPanel();
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
