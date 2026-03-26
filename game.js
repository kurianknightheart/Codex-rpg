const MAP_SIZE = 1024;
const VIEW_RADIUS = 11;
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
    stats: { strength: 7, dexterity: 7, intelligence: 6, endurance: 8, willpower: 6 },
    equipment: {},
    inventory: [],
  },
  destination: null,
  itemPool: [],
  bestiary: [],
  monsters: [],
  encounter: null,
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
  newGameBtn: document.getElementById('newGameBtn'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  lootDrop: document.getElementById('lootDrop'),
  levelUpPanel: document.getElementById('levelUpPanel'),
  levelUpText: document.getElementById('levelUpText'),
  levelUpChoices: document.getElementById('levelUpChoices'),
};

function addLog(t) { const p = document.createElement('p'); p.textContent = `[Day ${Math.floor(state.day)}] ${t}`; el.log.prepend(p); }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const SAVE_KEY = 'ashen_marches_save_v1';

function knightSvg(weaponHue = 24, armorHue = 220, trimHue = 45) {
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
      <ellipse cx='60' cy='43' rx='18' ry='16' fill='hsl(30 18% 78%)'/>
      <path d='M40 46 Q60 18 80 46 L78 58 L42 58 Z' fill='url(#armorGrad)'/>
      <rect x='37' y='60' width='46' height='56' rx='14' fill='url(#armorGrad)'/>
      <path d='M44 66 L76 66 L73 108 L47 108 Z' fill='hsl(${trimHue} 58% 38%)' opacity='.8'/>
      <path d='M46 72 L74 72 M46 80 L74 80 M46 88 L74 88 M46 96 L74 96' stroke='hsl(${trimHue} 62% 62%)' stroke-width='1'/>
      <rect x='29' y='68' width='10' height='40' rx='4' fill='hsl(${armorHue} 24% 40%)'/>
      <rect x='81' y='68' width='10' height='40' rx='4' fill='hsl(${armorHue} 24% 40%)'/>
      <rect x='47' y='112' width='12' height='24' rx='4' fill='hsl(${armorHue} 18% 37%)'/>
      <rect x='61' y='112' width='12' height='24' rx='4' fill='hsl(${armorHue} 18% 37%)'/>
      <rect x='45' y='132' width='16' height='10' rx='4' fill='hsl(${armorHue} 24% 25%)'/>
      <rect x='59' y='132' width='16' height='10' rx='4' fill='hsl(${armorHue} 24% 25%)'/>
      <path d='M86 43 L92 101 L83 102 L78 46 Z' fill='hsl(${weaponHue} 58% 70%)'/>
      <rect x='74' y='81' width='24' height='6' rx='2' transform='rotate(10 86 84)' fill='hsl(${weaponHue} 48% 28%)'/>
      <circle cx='54' cy='44' r='2.1' fill='#1d171d'/>
      <circle cx='66' cy='44' r='2.1' fill='#1d171d'/>
    </g>
  </svg>`;
}

function applyKnight() {
  const w = state.player.equipment.weapon?.appearance?.hue ?? 24;
  const a = state.player.equipment.chestArmor?.appearance?.hue ?? state.player.equipment.armor?.appearance?.hue ?? 220;
  const t = state.player.equipment.necklace?.appearance?.hue ?? 45;
  const svg = knightSvg(w, a, t);
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
  const cx = lx - (el.world.clientWidth / 2 - 38);
  const cy = ly - 24;
  const localX = (cx / (s / 2) + cy / (s / 4)) / 2;
  const localY = (cy / (s / 4) - cx / (s / 2)) / 2;
  const wx = Math.round(state.player.pos.x + localX - VIEW_RADIUS);
  const wy = Math.round(state.player.pos.y + localY - VIEW_RADIUS);
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
      if (decoSeed(x, y) < 0.34) {
        const deco = document.createElement('div');
        deco.className = `deco ${featureForTile(x, y, biome)}`;
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

function featureForTile(x, y, biome) {
  const seed = decoSeed(x * 3 + 7, y * 5 + 11);
  if (seed > 0.94 && biome !== 'water') return 'lake';
  if (seed > 0.8) return 'mountain';
  return decoForBiome(biome);
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
  const rarityGlow = item.rarity === 'legendary' ? 75 : item.rarity === 'epic' ? 62 : item.rarity === 'rare' ? 55 : 45;
  let studs = '';
  for (let i = 0; i < 10; i += 1) studs += `<circle cx='${8 + i * 2.4}' cy='${34 - (i % 2)}' r='0.9' fill='hsl(${h} 20% 25%)'/>`;
  const core = `<polygon points='20,4 ${30 + (idNum % 4)},14 20,36 ${10 - (idNum % 4)},14' fill='hsl(${h} 58% ${rarityGlow}%)'/>${studs}`;
  if (item.slot === 'weapon') {
    if (item.name.includes('Spear')) return `<svg viewBox='0 0 40 40'><path d='M20 2 L23 8 L20 13 L17 8 Z' fill='hsl(${h} 80% 82%)'/><rect x='18' y='9' width='4' height='26' rx='2' fill='hsl(${h} 36% 38%)'/>${studs}</svg>`;
    if (item.name.includes('Falchion')) return `<svg viewBox='0 0 40 40'><path d='M14 6 Q28 8 24 30 Q17 26 12 10 Z' fill='hsl(${h} 62% 72%)'/><rect x='14' y='24' width='12' height='3' rx='2' fill='hsl(${h} 30% 28%)'/>${studs}</svg>`;
    if (item.name.includes('Mace')) return `<svg viewBox='0 0 40 40'><circle cx='20' cy='8' r='6' fill='hsl(${h} 30% 44%)'/><rect x='18' y='12' width='4' height='22' rx='2' fill='hsl(${h} 35% 34%)'/>${studs}</svg>`;
    if (item.name.includes('War Pick')) return `<svg viewBox='0 0 40 40'><path d='M13 10 L27 10 L30 14 L10 14 Z' fill='hsl(${h} 55% 74%)'/><rect x='18' y='12' width='4' height='22' rx='2' fill='hsl(${h} 35% 34%)'/><path d='M27 10 L34 4 L31 14 Z' fill='hsl(${h} 65% 72%)'/>${studs}</svg>`;
    return `<svg viewBox='0 0 40 40'><rect x='18' y='3' width='4' height='25' rx='2' fill='hsl(${h} 62% 67%)'/><rect x='11' y='24' width='18' height='4' rx='2' fill='hsl(${h} 40% 30%)'/><rect x='18' y='27' width='4' height='8' rx='2' fill='hsl(${h} 35% 24%)'/><circle cx='20' cy='${v3}' r='2' fill='hsl(${h} 70% 78%)'/>${studs}</svg>`;
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
      ${slotFrameSvg(slot, it, Boolean(selectedClass))}
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

function slotFrameSvg(slot, item, selected) {
  const rarity = item?.rarity || 'common';
  const hue = rarity === 'legendary' ? 40 : rarity === 'epic' ? 280 : rarity === 'rare' ? 210 : rarity === 'uncommon' ? 140 : 230;
  const glow = selected ? 70 : 50;
  return `<svg class="slot-frame" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="metal-${slot}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue} 20% 40%)"/>
        <stop offset="50%" stop-color="hsl(${hue} 22% 18%)"/>
        <stop offset="100%" stop-color="hsl(${hue} 28% 32%)"/>
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="17" fill="url(#metal-${slot})" opacity=".95"/>
    <rect x="12" y="12" width="76" height="76" rx="13" fill="none" stroke="hsl(${hue} 45% ${glow}%)" stroke-width="2.6" opacity=".7"/>
    <path d="M20 20 L33 20 L20 33 Z M80 20 L67 20 L80 33 Z M20 80 L33 80 L20 67 Z M80 80 L67 80 L80 67 Z" fill="hsl(${hue} 55% 62%)" opacity=".35"/>
    <circle cx="50" cy="50" r="24" fill="none" stroke="hsl(${hue} 50% 58%)" stroke-width="1.6" opacity=".34"/>
  </svg>`;
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
    const c = document.createElement('div');
    c.className = `item-card ${state.selectedItemId === item.id ? 'selected' : ''}`;
    c.innerHTML = `<div class='item-icon'>${iconSvg(item)}</div><div class='item-meta'><strong>${item.name}</strong><small>${slotLabel(item.slot)} · ${item.rarity}</small><small>${itemDesc(item.slot, item.stats)}</small><button>Equip</button></div>`;
    c.addEventListener('click', () => {
      state.selectedItemId = item.id;
      renderInventory();
      renderEquipment();
      renderItemDetails();
    });
    c.querySelector('button').addEventListener('click', (ev) => { ev.stopPropagation(); equipItem(item); });
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
  [['LVL', state.player.level], ['XP', `${state.player.xp}/${state.player.xpToNext}`], ['HP', calc.hp], ['STM', state.player.stamina], ['FOC', state.player.focus], ['DEF', calc.defense], ['FTG', calc.fatigue]].forEach(([k, v]) => {
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
    <p><strong>Type:</strong> ${slotLabel(selected.slot)}</p>
    <p><strong>Level Requirement:</strong> ${selected.levelReq || selected.tier}</p>
    <p><strong>Stats:</strong> ${itemDesc(selected.slot, selected.stats)}</p>
    <p><strong>Bonus Effect:</strong> ${selected.bonusEffect || 'None'}</p>
    <p><strong>Lore:</strong> ${selected.lore || 'An item from the Ashen Marches.'}</p>
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
    node.dataset.uid = m.uid;
    node.innerHTML = monsterSvg(m.name, m.hue);
    const p = iso(m.x - px + VIEW_RADIUS, m.y - py + VIEW_RADIUS);
    node.style.left = `${p.x + 38}px`;
    node.style.top = `${p.y + 24}px`;
    fragment.appendChild(node);
  });
  return fragment;
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
    renderItemDetails();
    updateHud();
    renderMapChunk();
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
  animatePlayerAttack(state.encounter.uid);
  const dmg = totalStat('damage') + state.player.stats.strength * 2 + rand(4, 10);
  if (Math.random() < (0.58 + totalStat('crit') * 0.01)) state.encounter.hpNow -= Math.floor(dmg * 1.5);
  else state.encounter.hpNow -= dmg;
  enemyTurn(1);
  if (state.encounter.hpNow <= 0) {
    addLog(`Defeated ${state.encounter.name}.`);
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
    setExploreActions();
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
  const fatiguePenalty = 1 + state.player.fatigue / 220;
  const hit = Math.max(1, Math.floor((state.encounter.attack + rand(0, 7)) * mult * fatiguePenalty - totalStat('defense') * 0.35));
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
  generateBestiary();
  respawnMonsters();
  initStarterEquip();
  applyKnight();
  renderEquipment();
  renderInventory();
  renderCharacterScreen();
  renderItemDetails();
  updateHud();
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
