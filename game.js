const SLOT_ORDER = ['weapon', 'helmet', 'offhand', 'armor', 'belt', 'leggings', 'boots', 'gloves', 'necklace', 'ring1', 'ring2', 'trinket1', 'trinket2'];

const STAT_INFO = {
  strength: 'Increases base melee damage, carrying comfort, and stagger force on heavy strikes.',
  dexterity: 'Improves hit chance, evasion, and reduces stamina loss from movement and light attacks.',
  intelligence: 'Improves tactical reads, item synergy, and medical recovery actions.',
  endurance: 'Raises fatigue resistance, max HP gain from gear, and damage mitigation under pressure.',
  willpower: 'Improves focus recovery, guard efficiency, and resistance to panic/stun effects.',
};

const state = {
  mode: 'explore',
  mapSize: 12,
  day: 1,
  tickMoveMs: 220,
  lastStepTs: 0,
  player: {
    pos: { x: 6, y: 6 },
    hp: 110,
    stamina: 100,
    focus: 65,
    stats: { strength: 7, dexterity: 7, intelligence: 6, endurance: 8, willpower: 6 },
    skills: { swordplay: 1, evasion: 1, medicine: 1, survival: 1, discipline: 1 },
    xp: {},
    inventory: [],
    equipment: {},
  },
  joystick: { active: false, dx: 0, dy: 0 },
  bestiary: [],
  monsters: [],
  encounter: null,
  itemPool: [],
};

const worldEl = document.getElementById('world');
const playerEl = document.getElementById('player');
const coreStatsEl = document.getElementById('coreStats');
const resourceBarsEl = document.getElementById('resourceBars');
const panelTitleEl = document.getElementById('panelTitle');
const panelTextEl = document.getElementById('panelText');
const equipmentSlotsEl = document.getElementById('equipmentSlots');
const inventoryEl = document.getElementById('inventory');
const actionsEl = document.getElementById('actions');
const encounterEl = document.getElementById('encounterPanel');
const joystickEl = document.getElementById('joystick');
const joystickKnobEl = document.getElementById('joystickKnob');
const logEl = document.getElementById('log');

function addLog(msg) {
  const p = document.createElement('p');
  p.textContent = `[Day ${Math.floor(state.day)}] ${msg}`;
  logEl.prepend(p);
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function roll(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function isoPos(x, y) {
  const base = 42;
  return {
    x: (x - y) * base + worldEl.clientWidth / 2 - 40,
    y: (x + y) * (base / 2) + 24,
  };
}

function awardPractice(key, amount, threshold = 8) {
  state.player.xp[key] = (state.player.xp[key] || 0) + amount;
  if (state.player.xp[key] < threshold) return;
  state.player.xp[key] = 0;
  if (state.player.stats[key] !== undefined) {
    state.player.stats[key] += 1;
    addLog(`${key} increased through repeated effort.`);
  }
  if (state.player.skills[key] !== undefined) {
    state.player.skills[key] += 1;
    addLog(`${key} skill improved to ${state.player.skills[key]}.`);
  }
}

function tileClass() {
  const r = Math.random();
  if (r > 0.87) return 'water';
  if (r > 0.68) return 'ruin';
  if (r > 0.37) return 'road';
  return 'grass';
}

function renderWorld() {
  worldEl.querySelectorAll('.tile,.monster').forEach((n) => n.remove());
  for (let y = 0; y < state.mapSize; y += 1) {
    for (let x = 0; x < state.mapSize; x += 1) {
      const tile = document.createElement('div');
      tile.className = `tile ${tileClass()}`;
      const iso = isoPos(x, y);
      tile.style.left = `${iso.x}px`;
      tile.style.top = `${iso.y}px`;
      worldEl.appendChild(tile);
    }
  }
  spawnRoamingMonsters(10);
}

function knightSvg(weaponHue = 24, armorHue = 218, trimHue = 48) {
  return `
    <svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="young knight">
      <defs>
        <linearGradient id="cape" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="hsl(${trimHue} 55% 45%)"/>
          <stop offset="100%" stop-color="hsl(${trimHue} 55% 25%)"/>
        </linearGradient>
      </defs>
      <path d="M45 148 L60 82 L75 148 Z" fill="url(#cape)" opacity="0.95"/>
      <rect x="42" y="60" width="36" height="40" rx="9" fill="hsl(${armorHue} 25% 52%)"/>
      <rect x="33" y="66" width="10" height="35" rx="4" fill="hsl(${armorHue} 20% 45%)"/>
      <rect x="77" y="66" width="10" height="35" rx="4" fill="hsl(${armorHue} 20% 45%)"/>
      <rect x="48" y="98" width="10" height="33" rx="4" fill="hsl(${armorHue} 20% 40%)"/>
      <rect x="62" y="98" width="10" height="33" rx="4" fill="hsl(${armorHue} 20% 40%)"/>
      <ellipse cx="60" cy="45" rx="16" ry="18" fill="hsl(30 28% 76%)"/>
      <path d="M42 45 Q60 20 78 45 L78 52 L42 52 Z" fill="hsl(${armorHue} 25% 58%)"/>
      <rect x="83" y="48" width="8" height="52" rx="3" transform="rotate(22 87 74)" fill="hsl(${weaponHue} 55% 58%)"/>
      <rect x="86" y="80" width="24" height="4" rx="2" transform="rotate(22 98 82)" fill="hsl(${weaponHue} 55% 66%)"/>
      <circle cx="59" cy="43" r="2" fill="#1f1a1a"/>
      <circle cx="65" cy="43" r="2" fill="#1f1a1a"/>
    </svg>`;
}

function applyKnightAppearance() {
  const weapon = state.player.equipment.weapon;
  const armor = state.player.equipment.armor;
  const necklace = state.player.equipment.necklace;
  const weaponHue = weapon ? weapon.appearance.hue : 24;
  const armorHue = armor ? armor.appearance.hue : 218;
  const trimHue = necklace ? necklace.appearance.hue : 48;
  playerEl.innerHTML = knightSvg(weaponHue, armorHue, trimHue);
}

function renderPlayer() {
  const iso = isoPos(state.player.pos.x, state.player.pos.y);
  playerEl.style.left = `${iso.x + 42}px`;
  playerEl.style.top = `${iso.y + 28}px`;
}

function statBlock(statObj) {
  return Object.entries(statObj)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k.slice(0, 3).toUpperCase()} ${v > 0 ? '+' : ''}${v}`)
    .join(' · ') || 'No bonuses';
}

function itemIconSvg(item) {
  const h = item.appearance.hue;
  if (item.slot === 'weapon') {
    return `<svg viewBox='0 0 40 40'><rect x='18' y='4' width='4' height='24' rx='2' fill='hsl(${h} 58% 64%)'><animate attributeName='y' values='4;3;4' dur='0.8s' repeatCount='indefinite'/></rect><rect x='12' y='23' width='16' height='3' rx='2' fill='hsl(${h} 40% 30%)'/></svg>`;
  }
  if (item.slot === 'helmet' || item.slot === 'armor' || item.slot === 'leggings' || item.slot === 'boots' || item.slot === 'gloves' || item.slot === 'offhand' || item.slot === 'belt') {
    return `<svg viewBox='0 0 40 40'><rect x='8' y='8' width='24' height='24' rx='8' fill='hsl(${h} 34% 45%)'><animate attributeName='fill' values='hsl(${h} 34% 45%);hsl(${h} 34% 55%);hsl(${h} 34% 45%)' dur='1.1s' repeatCount='indefinite'/></rect></svg>`;
  }
  return `<svg viewBox='0 0 40 40'><circle cx='20' cy='20' r='10' fill='hsl(${h} 65% 58%)'><animate attributeName='r' values='9;11;9' dur='1s' repeatCount='indefinite'/></circle></svg>`;
}

function generateItems() {
  state.itemPool = [];
  const bases = {
    weapon: ['Knight Sword', 'Short Spear', 'Falchion', 'Mace', 'War Pick'],
    helmet: ['Iron Coif', 'Nasal Helm', 'Visored Helm', 'Padded Coif', 'Chapel Helm'],
    offhand: ['Kite Shield', 'Buckler', 'Parry Dagger', 'Hook Shield', 'Lantern Guard'],
    armor: ['Gambeson', 'Mail Hauberk', 'Scale Coat', 'Brigandine', 'Cuir Bouilli'],
    belt: ['Studded Belt', 'Mercenary Belt', 'Oath Sash', 'Chain Belt', 'Hunter Cord'],
    leggings: ['Rider Leggings', 'Mail Chausses', 'Riveted Cuisses', 'Padded Hose', 'Ash Greaves'],
    boots: ['Riding Boots', 'Mud Boots', 'Iron Sabatons', 'Path Boots', 'Barrow Boots'],
    gloves: ['Padded Gloves', 'Mail Mitts', 'Grip Gloves', 'Ash Gloves', 'Knight Gauntlets'],
    necklace: ['Knight Reliquary', 'Sun Chain', 'Bone Charm', 'Locket of Oaths', 'Runed Necklace'],
    ring1: ['Silver Ring', 'Garnet Ring', 'Ash Ring', 'Rune Ring', 'Knight Signet'],
    ring2: ['Copper Ring', 'Pilgrim Ring', 'Moon Ring', 'Iron Ring', 'Band of Dust'],
    trinket1: ['Saint Token', 'Witch Knot', 'Bone Dice', 'War Medal', 'Fog Charm'],
    trinket2: ['Tooth Charm', 'Prayer Bead', 'Coin Relic', 'Rune Pebble', 'Crow Feather'],
  };

  const rarityMod = { common: 0, sturdy: 1, rare: 2, ancient: 3 };
  const rarities = Object.keys(rarityMod);
  let id = 0;
  SLOT_ORDER.forEach((slot, slotIdx) => {
    for (let i = 0; i < 16; i += 1) {
      const rarity = rarities[i % 4];
      const tier = 1 + Math.floor(i / 4);
      const name = `${rarity.toUpperCase()} ${bases[slot][i % 5]} ${tier}`;
      const power = tier + rarityMod[rarity];
      const stats = {
        strength: 0, dexterity: 0, intelligence: 0, endurance: 0, willpower: 0,
        damage: 0, attackSpeed: 0, crit: 0, reach: 0, stunChance: 0,
        defense: 0, hpIncrease: 0, evasion: 0,
      };

      if (slot === 'weapon') {
        stats.damage = 7 + power * 3;
        stats.attackSpeed = Number((0.85 + (power * 0.06)).toFixed(2));
        stats.crit = 3 + power * 2;
        stats.reach = 1 + Math.floor(power / 2);
        stats.stunChance = 2 + power * 1.5;
        stats.strength = Math.floor(power / 2);
      } else if (['armor', 'helmet', 'offhand', 'leggings', 'boots', 'gloves', 'belt'].includes(slot)) {
        stats.defense = 4 + power * 2;
        stats.hpIncrease = 8 + power * 6;
        stats.evasion = Math.max(0, 8 - power) + (slot === 'boots' ? 3 : 0);
        stats.endurance = Math.floor(power / 2);
      } else {
        stats.intelligence = Math.floor(power / 2);
        stats.willpower = Math.ceil(power / 2);
        stats.crit = power;
        stats.evasion = power;
        stats.strength = slot.includes('ring') ? 1 : 0;
      }

      state.itemPool.push({
        id: `item-${++id}`,
        slot,
        rarity,
        tier,
        name,
        stats,
        appearance: { hue: (slotIdx * 27 + i * 9) % 360 },
        description: itemDescription(slot, stats),
      });
    }
  });
  state.itemPool = state.itemPool.slice(0, 200);
  state.player.inventory = state.itemPool.slice(0, 36);
}

function itemDescription(slot, s) {
  if (slot === 'weapon') {
    return `Damage ${s.damage}, Atk Speed ${s.attackSpeed}, Crit ${s.crit}%, Reach ${s.reach}, Stun ${s.stunChance.toFixed(1)}%.`;
  }
  if (['armor', 'helmet', 'offhand', 'leggings', 'boots', 'gloves', 'belt'].includes(slot)) {
    return `Defense ${s.defense}, HP +${s.hpIncrease}, Evasion ${s.evasion}%.`;
  }
  return `Bonuses: STR +${s.strength}, INT +${s.intelligence}, WIL +${s.willpower}, Crit +${s.crit}%.`;
}

function renderEquipment() {
  equipmentSlotsEl.innerHTML = '';
  SLOT_ORDER.forEach((slot) => {
    const item = state.player.equipment[slot];
    const row = document.createElement('div');
    row.className = 'slot-row';
    row.innerHTML = `<strong>${slot}</strong><span>${item ? item.name : 'Empty'}</span><small>${item ? item.description : 'No bonuses'}</small>`;
    equipmentSlotsEl.appendChild(row);
  });
}

function equipItem(item) {
  state.player.equipment[item.slot] = item;
  addLog(`Equipped ${item.name}.`);
  applyKnightAppearance();
  renderEquipment();
  updateHud();
}

function renderInventory() {
  inventoryEl.innerHTML = '';
  const visibleItems = state.player.inventory.slice(0, 24);
  if (!visibleItems.length) {
    const empty = document.createElement('div');
    empty.className = 'slot-row';
    empty.innerHTML = '<strong>No items generated</strong><small>Debug: item pool did not initialize.</small>';
    inventoryEl.appendChild(empty);
    return;
  }
  visibleItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class='item-icon'>${itemIconSvg(item)}</div>
      <div class='item-meta'>
        <strong>${item.name}</strong>
        <small>${item.slot.toUpperCase()} · Tier ${item.tier} · ${item.rarity}</small>
        <small>${item.description}</small>
        <div class='item-actions'><button data-equip='${item.id}'>Equip</button></div>
      </div>`;
    card.querySelector('button').addEventListener('click', () => equipItem(item));
    inventoryEl.appendChild(card);
  });
}

function generateBestiary() {
  const names = [
    'Bog Ghoul', 'Fen Raider', 'Crypt Hound', 'Ash Spider', 'Hollow Monk', 'Rook Bandit', 'Rot Boar', 'Cairn Witch', 'Mire Stalker', 'Grave Crow',
    'Warden Shade', 'Pike Marauder', 'Blight Wolf', 'Bone Knight', 'Thorn Devourer', 'Howling Penitent', 'Stone Revenant', 'Blood Vicar', 'Maw Leech',
    'Iron Troll', 'Dread Pilgrim', 'Fog Serpent', 'Ruin Harpy', 'Oathbreaker', 'Nightsworn Giant',
  ];

  state.bestiary = names.map((name, i) => ({
    name,
    tier: 1 + Math.floor(i / 5),
    hp: 45 + i * 6,
    poise: 30 + i * 3,
    attack: 9 + i,
    evasion: 0.05 + i * 0.005,
    hue: (i * 17) % 360,
  }));
}

function monsterSvg(hue) {
  return `<svg viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'>
    <ellipse cx='30' cy='33' rx='20' ry='16' fill='hsl(${hue} 45% 34%)'/>
    <circle cx='22' cy='27' r='5' fill='hsl(${hue} 70% 56%)'/>
    <circle cx='38' cy='27' r='5' fill='hsl(${hue} 70% 56%)'/>
    <circle cx='22' cy='27' r='2' fill='#120d0e'/>
    <circle cx='38' cy='27' r='2' fill='#120d0e'/>
    <path d='M20 40 Q30 48 40 40' stroke='hsl(${hue} 75% 72%)' stroke-width='3' fill='none'/>
  </svg>`;
}

function spawnRoamingMonsters(count) {
  if (!state.bestiary.length) return;
  state.monsters = [];
  for (let i = 0; i < count; i += 1) {
    const type = state.bestiary[roll(0, state.bestiary.length - 1)];
    const x = roll(1, state.mapSize - 2);
    const y = roll(1, state.mapSize - 2);
    const m = { ...type, uid: `m-${Date.now()}-${i}`, x, y, hpNow: type.hp, poiseNow: type.poise };
    state.monsters.push(m);

    const el = document.createElement('div');
    el.className = 'monster';
    el.dataset.uid = m.uid;
    el.innerHTML = monsterSvg(m.hue);
    const iso = isoPos(x, y);
    el.style.left = `${iso.x + 42}px`;
    el.style.top = `${iso.y + 26}px`;
    worldEl.appendChild(el);
  }
}

function totalGearStat(field) {
  return Object.values(state.player.equipment).reduce((acc, item) => acc + (item?.stats?.[field] || 0), 0);
}

function derivedStat(stat) {
  return state.player.stats[stat] + totalGearStat(stat);
}

function updateHud() {
  coreStatsEl.innerHTML = '';
  Object.keys(state.player.stats).forEach((k) => {
    const d = document.createElement('button');
    d.className = 'pill stat';
    d.textContent = `${k.slice(0, 3).toUpperCase()} ${derivedStat(k)}`;
    d.addEventListener('click', () => {
      panelTitleEl.textContent = k.toUpperCase();
      panelTextEl.textContent = `${STAT_INFO[k]} Current value: ${derivedStat(k)} (base ${state.player.stats[k]} + gear ${totalGearStat(k)}).`;
    });
    coreStatsEl.appendChild(d);
  });

  resourceBarsEl.innerHTML = '';
  [
    ['HP', state.player.hp],
    ['STM', state.player.stamina],
    ['FOC', state.player.focus],
    ['DEF', totalGearStat('defense')],
    ['DMG', totalGearStat('damage')],
  ].forEach(([k, v]) => {
    const d = document.createElement('div');
    d.className = 'pill';
    d.textContent = `${k} ${Math.round(v)}`;
    resourceBarsEl.appendChild(d);
  });
}

function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function beginCombat(monster) {
  state.mode = 'combat';
  state.encounter = { ...monster };
  panelTitleEl.textContent = `Combat: ${monster.name}`;
  panelTextEl.textContent = 'Turn-based duel: strike, drive, guard, assess. Weapons and armor directly affect formulas.';
  actionsEl.innerHTML = '';
  addAction('Measured Strike', () => attackAction('measured'));
  addAction('Driving Strike', () => attackAction('driving'));
  addAction('Guard', guardAction);
  addAction('Assess', assessAction);
}

function addAction(label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', fn);
  actionsEl.appendChild(b);
}

function attackAction(type) {
  if (!state.encounter || state.player.stamina < 8) return;
  const weaponDmg = totalGearStat('damage');
  const speed = 1 + totalGearStat('attackSpeed') / 10;
  const crit = totalGearStat('crit') + derivedStat('dexterity');
  const reach = totalGearStat('reach');
  const stun = totalGearStat('stunChance');
  const power = derivedStat('strength') + weaponDmg * speed;

  let hitChance = 0.58 + derivedStat('dexterity') * 0.018 + reach * 0.02 - state.encounter.evasion;
  let dmg = Math.floor(power * (type === 'driving' ? 1.2 : 1));
  if (Math.random() * 100 < crit) dmg = Math.floor(dmg * 1.55);

  if (Math.random() < hitChance) {
    state.encounter.poiseNow -= 6 + Math.floor(power / 9);
    const vuln = state.encounter.poiseNow <= 0 ? 1.6 : 1;
    state.encounter.hpNow -= Math.floor(dmg * vuln);
    if (Math.random() * 100 < stun) {
      addLog('Stunning impact! Enemy turn weakened.');
      enemyTurn(0.55);
    } else {
      enemyTurn(1);
    }
    addLog(`${type === 'driving' ? 'Driving' : 'Measured'} hit for ${dmg}.`);
  } else {
    addLog('Attack missed.');
    enemyTurn(1);
  }

  state.player.stamina = clamp(state.player.stamina - (type === 'driving' ? 14 : 10), 0, 100);
  state.player.focus = clamp(state.player.focus - 4, 0, 100);
  playerEl.className = 'player attacking';
  setTimeout(() => playerEl.className = 'player', 220);
  awardPractice('strength', 1);
  awardPractice('dexterity', 1);
  awardPractice('swordplay', 1);
  resolveCombatState();
}

function guardAction() {
  state.player.stamina = clamp(state.player.stamina + 9, 0, 100);
  state.player.focus = clamp(state.player.focus + 6, 0, 100);
  addLog('Guard raised, posture restored.');
  awardPractice('discipline', 1);
  awardPractice('willpower', 1);
  enemyTurn(0.6);
  resolveCombatState();
}

function assessAction() {
  if (!state.encounter) return;
  panelTextEl.textContent = `${state.encounter.name}: HP ${Math.max(0, Math.floor(state.encounter.hpNow))}, Poise ${Math.max(0, Math.floor(state.encounter.poiseNow))}, Threat ${state.encounter.attack}.`;
  state.player.focus = clamp(state.player.focus - 2, 0, 100);
  awardPractice('intelligence', 1);
  awardPractice('medicine', 1);
  enemyTurn(1);
  resolveCombatState();
}

function enemyTurn(multiplier) {
  if (!state.encounter) return;
  const defense = totalGearStat('defense') + derivedStat('endurance');
  const evasion = totalGearStat('evasion') + derivedStat('dexterity');
  const avoidChance = 0.16 + evasion * 0.004;
  if (Math.random() < avoidChance) {
    addLog('You evade the enemy blow.');
    awardPractice('evasion', 1);
    return;
  }
  const raw = state.encounter.attack + roll(0, 8);
  const reduced = Math.max(1, Math.floor(raw * multiplier - defense * 0.35));
  state.player.hp -= reduced;
  state.player.stamina = clamp(state.player.stamina - 5, 0, 100);
  addLog(`${state.encounter.name} hits for ${reduced}.`);
}

function resolveCombatState() {
  if (!state.encounter) return;
  if (state.encounter.hpNow <= 0) {
    addLog(`Defeated ${state.encounter.name}.`);
    removeMonster(state.encounter.uid);
    state.mode = 'explore';
    state.day += 1;
    state.encounter = null;
    actionsEl.innerHTML = '';
    panelTitleEl.textContent = 'Field Notes';
    panelTextEl.textContent = 'Victory. Continue moving turn-by-turn with the joystick.';
  }
  if (state.player.hp <= 0) {
    addLog('You fell in battle. Refresh to restart.');
    actionsEl.innerHTML = '';
    panelTitleEl.textContent = 'Defeat';
    panelTextEl.textContent = 'The expedition ended in the mire.';
  }
  updateHud();
}

function removeMonster(uid) {
  state.monsters = state.monsters.filter((m) => m.uid !== uid);
  const node = worldEl.querySelector(`.monster[data-uid='${uid}']`);
  if (node) node.remove();
}

function processTurnMove(ts) {
  if (state.mode !== 'explore' || !state.joystick.active) return;
  if (ts - state.lastStepTs < state.tickMoveMs) return;
  state.lastStepTs = ts;

  const { dx, dy } = state.joystick;
  if (!dx && !dy) return;

  const nx = clamp(state.player.pos.x + dx, 0, state.mapSize - 1);
  const ny = clamp(state.player.pos.y + dy, 0, state.mapSize - 1);
  if (nx === state.player.pos.x && ny === state.player.pos.y) return;

  state.player.pos = { x: nx, y: ny };
  state.player.stamina = clamp(state.player.stamina - 1.2, 0, 100);
  state.day += 0.04;
  awardPractice('endurance', 0.4, 12);
  awardPractice('dexterity', 0.4, 12);
  awardPractice('survival', 0.4, 12);

  playerEl.classList.add('walking');
  setTimeout(() => playerEl.classList.remove('walking'), 140);
  renderPlayer();
  updateHud();
  checkEncounterRange();
}

function checkEncounterRange() {
  const near = state.monsters.find((m) => distance(state.player.pos, m) <= 1);
  if (near) beginCombat(near);
}

function updateJoystick(ev) {
  const touch = ev.touches ? ev.touches[0] : ev;
  const rect = joystickEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rawX = touch.clientX - cx;
  const rawY = touch.clientY - cy;
  const dist = Math.hypot(rawX, rawY);
  const max = 35;
  const scale = dist > max ? max / dist : 1;
  const x = rawX * scale;
  const y = rawY * scale;

  joystickKnobEl.style.transform = `translate(${x}px, ${y}px)`;
  state.joystick.dx = Math.abs(x) < 10 ? 0 : (x > 0 ? 1 : -1);
  state.joystick.dy = Math.abs(y) < 10 ? 0 : (y > 0 ? 1 : -1);
}

function bindJoystick() {
  const start = (ev) => {
    state.joystick.active = true;
    updateJoystick(ev);
  };
  const move = (ev) => {
    if (!state.joystick.active) return;
    updateJoystick(ev);
  };
  const end = () => {
    state.joystick.active = false;
    state.joystick.dx = 0;
    state.joystick.dy = 0;
    joystickKnobEl.style.transform = 'translate(0px,0px)';
  };

  joystickEl.addEventListener('touchstart', start, { passive: true });
  joystickEl.addEventListener('touchmove', move, { passive: true });
  joystickEl.addEventListener('touchend', end, { passive: true });
  joystickEl.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
}

function gameLoop(ts = 0) {
  processTurnMove(ts);
  encounterEl.textContent = state.encounter
    ? `${state.encounter.name} engaged. Enemy HP ${Math.max(0, Math.floor(state.encounter.hpNow))}.`
    : `Patrolling threats: ${state.monsters.length}. Hold joystick to take step-by-step turns.`;
  requestAnimationFrame(gameLoop);
}

function initStarterEquipment() {
  SLOT_ORDER.forEach((slot) => {
    const starter = state.player.inventory.find((it) => it.slot === slot);
    if (starter) equipItem(starter);
  });
}

function init() {
  generateItems();
  generateBestiary();
  renderWorld();
  worldEl.appendChild(playerEl);
  renderPlayer();
  renderInventory();
  initStarterEquipment();
  applyKnightAppearance();
  renderEquipment();
  updateHud();
  bindJoystick();
  addLog('A young knight enters the Ashen Marches.');
  addLog(`Debug: ${state.player.inventory.length} inventory items loaded, ${state.bestiary.length} monster types ready.`);
  panelTextEl.textContent = 'Tap any stat to read what it changes. Equip items to alter visuals and combat math.';
  gameLoop();
}

window.addEventListener('resize', () => {
  renderWorld();
  renderPlayer();
});

init();
