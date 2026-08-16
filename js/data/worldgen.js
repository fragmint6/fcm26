// ============ FCM 26 — world generation (deterministic) ============
import { CLUBS, LEAGUES, NTS } from '../data/clubs.js';
import { NAMES, SCOUT_FIRST, SCOUT_LAST, MGR_FIRST, MGR_LAST } from '../data/names.js';
import { PLAYERS_ENG } from '../data/players_eng.js';
import { PLAYERS_ESP } from '../data/players_esp.js';
import { PLAYERS_ITA } from '../data/players_ita.js';
import { PLAYERS_GER } from '../data/players_ger.js';
import { PLAYERS_FRA } from '../data/players_fra.js';
import { PLAYERS_OTH } from '../data/players_oth.js';
import { hashStr, clamp, RNG, POSITIONS, FORMATIONS } from '../util.js';
import { initialContract } from '../engine/market.js';

export const NATFIX = { CAF: 'CF', GUF: 'GF', EQG: 'GQ', GAB: 'GA', GAM: 'GM', MOZ: 'MZ', BDI: 'BI', CGO: 'CG', GBS: 'GW', MAD: 'MG', ZIM: 'ZW', TOG: 'TG', PAN: 'PA', DOM: 'DO', SUR: 'SR', TRI: 'TT' };
export const TOP_NATS = ['ENG', 'FRA', 'ESP', 'GER', 'ITA', 'POR', 'NED', 'BEL', 'BRA', 'ARG', 'URU', 'COL', 'JPN', 'KOR', 'USA', 'MEX', 'NGA', 'GHA', 'SEN', 'CIV', 'CMR', 'MAR', 'ALG', 'TUN', 'EGY', 'CRO', 'SRB', 'POL', 'CZE', 'SVK', 'HUN', 'ROU', 'GRE', 'AUT', 'SUI', 'DEN', 'SWE', 'NOR', 'FIN', 'ISL', 'UKR', 'GEO', 'ALB', 'SVN', 'BIH', 'MKD', 'KOS', 'TUR', 'AUS', 'RSA', 'COD', 'CPV', 'PAR', 'CHI', 'PER', 'VEN', 'ECU', 'CRC', 'JAM', 'ISR', 'UZB', 'KSA', 'QAT', 'UAE', 'IRN', 'CHN', 'IDN', 'THA', 'VIE', 'IND', 'MAS'];

const CURATED = [...PLAYERS_ENG, ...PLAYERS_ESP, ...PLAYERS_ITA, ...PLAYERS_GER, ...PLAYERS_FRA, ...PLAYERS_OTH];

// ---------- full EA-style substat model ----------
// Every player carries ~35 attributes beyond the six face stats.
export const STAT_LABELS = {
  spe: 'Sprint Speed', acc: 'Acceleration',
  fin: 'Finishing', lon: 'Long Shots', pos: 'Positioning', pen: 'Penalties', spow: 'Shot Power', vol: 'Volleys',
  vis: 'Vision', cro: 'Crossing', fka: 'Free Kick Acc.', spa: 'Short Passing', lpa: 'Long Passing', cur: 'Curve',
  agi: 'Agility', bal: 'Balance', rea: 'Reactions', bac: 'Ball Control', com: 'Composure',
  int: 'Interceptions', hei: 'Heading Accuracy', mar: 'Marking', tac: 'Standing Tackle', slt: 'Sliding Tackle',
  jum: 'Jumping', sta: 'Stamina', str: 'Strength', agg: 'Aggression',
  div: 'GK Diving', han: 'GK Handling', kic: 'GK Kicking', ref: 'GK Reflexes', spd: 'GK Speed', gkpos: 'GK Positioning',
};
export const SUBSTAT_GROUPS = [
  ['PACE', ['spe', 'acc']],
  ['SHOOTING', ['fin', 'lon', 'pos', 'pen', 'spow', 'vol']],
  ['PASSING', ['vis', 'cro', 'fka', 'spa', 'lpa', 'cur']],
  ['DRIBBLING', ['agi', 'bal', 'rea', 'bac', 'com']],
  ['DEFENDING', ['int', 'hei', 'mar', 'tac', 'slt']],
  ['PHYSICAL', ['jum', 'sta', 'str', 'agg']],
];
export const GK_SUBSTAT_GROUPS = [
  ['GOALKEEPING', ['div', 'han', 'kic', 'ref', 'spd', 'gkpos']],
];
const OUTFIELD_KEYS = SUBSTAT_GROUPS.flatMap(([, ks]) => ks);
const GK_KEYS = GK_SUBSTAT_GROUPS.flatMap(([, ks]) => ks);

export function derivedAtts(p) {
  if (p.det) return p.det;
  const H = k => (hashStr(p.id + k) % 7) - 3;
  const { pac, sho, pas, dri, def, phy } = p;
  const d = {};
  if (p.pos === 'GK') {
    d.div = clamp(sho + H('div'), 40, 99); d.han = clamp(dri + H('han'), 40, 99); d.kic = clamp(pas + H('kic'), 40, 99);
    d.ref = clamp(phy + H('ref'), 40, 99); d.spd = clamp(pac + H('spd'), 40, 99); d.gkpos = clamp(def + H('gkpos'), 40, 99);
  } else {
    // shooting
    d.fin = clamp(sho + H('fin'), 20, 99); d.lon = clamp(sho - 6 + H('lon'), 20, 99);
    d.pos = clamp(sho * .85 + def * .15 + H('pos'), 20, 99); d.pen = clamp(sho * .9 + 5 + H('pen'), 20, 99);
    d.spow = clamp(sho - 3 + H('spow'), 20, 99); d.vol = clamp(sho - 7 + H('vol'), 20, 99);
    // passing
    d.vis = clamp(pas + H('vis'), 20, 99); d.cro = clamp(pas - 5 + H('cro'), 20, 99); d.fka = clamp(pas - 5 + H('fka'), 20, 99);
    d.spa = clamp(pas + 2 + H('spa'), 20, 99); d.lpa = clamp(pas - 2 + H('lpa'), 20, 99); d.cur = clamp(pas - 5 + H('cur'), 20, 99);
    // dribbling
    d.agi = clamp(dri + H('agi'), 20, 99); d.bal = clamp((dri + phy) / 2 + H('bal'), 20, 99);
    d.rea = clamp((pac + dri) / 2 + H('rea'), 20, 99); d.bac = clamp(dri - 2 + H('bac'), 20, 99);
    d.com = clamp((sho + pas) / 2 + H('com'), 20, 99);
    // defending
    d.int = clamp(def - 2 + H('int'), 20, 99); d.hei = clamp((def + phy) / 2 + H('hei'), 20, 99); d.mar = clamp(def + H('mar'), 20, 99);
    d.tac = clamp(def + H('tac'), 20, 99); d.slt = clamp(def - 4 + H('slt'), 20, 99);
    // physical
    d.jum = clamp(phy - 10 + H('jum'), 20, 99); d.sta = clamp(phy - 5 + H('sta'), 20, 99);
    d.str = clamp(phy + H('str'), 20, 99); d.agg = clamp((phy + def) / 2 + H('agg'), 20, 99);
    d.spe = clamp(pac + H('spe'), 20, 99); d.acc = clamp(pac + H('acc'), 20, 99);
  }
  p.det = d;
  return d;
}

// Build the six face stats from full substats (used by the data importer)
export function faceStatsFromDet(det, pos) {
  if (pos === 'GK') {
    return {
      pac: Math.round((det.spd + 50) / 2), sho: det.div, pas: det.kic, dri: det.han, def: det.gkpos, phy: det.ref,
    };
  }
  const pac = Math.round((det.spe + det.acc) / 2);
  const sho = Math.round((det.fin + det.lon + det.pos + det.pen + det.spow + det.vol) / 6);
  const pas = Math.round((det.vis + det.cro + det.fka + det.spa + det.lpa + det.cur) / 6);
  const dri = Math.round((det.agi + det.bal + det.rea + det.bac + det.com) / 5);
  const def = Math.round((det.int + det.hei + det.mar + det.tac + det.slt) / 5);
  const phy = Math.round((det.jum + det.sta + det.str + det.agg) / 4);
  return { pac, sho, pas, dri, def, phy };
}
export function ovrFromStats(p) {
  if (p.pos === 'GK') return Math.round(p.sho * .38 + p.pas * .12 + p.dri * .2 + p.def * .18 + p.phy * .12);
  const W = {
    GK: [], RB: [0.08, 0.12, 0.2, 0.18, 0.3, 0.12], RWB: [0.12, 0.12, 0.18, 0.18, 0.28, 0.12],
    CB: [0.12, 0.05, 0.16, 0.12, 0.42, 0.13], LB: [0.08, 0.12, 0.2, 0.18, 0.3, 0.12], LWB: [0.12, 0.12, 0.18, 0.18, 0.28, 0.12],
    CDM: [0.08, 0.1, 0.2, 0.16, 0.32, 0.14], CM: [0.1, 0.14, 0.24, 0.2, 0.2, 0.12],
    CAM: [0.12, 0.18, 0.24, 0.24, 0.1, 0.12], RM: [0.18, 0.14, 0.2, 0.22, 0.14, 0.12], RW: [0.2, 0.2, 0.18, 0.26, 0.06, 0.1],
    LM: [0.18, 0.14, 0.2, 0.22, 0.14, 0.12], LW: [0.2, 0.2, 0.18, 0.26, 0.06, 0.1],
    CF: [0.16, 0.26, 0.18, 0.22, 0.06, 0.12], ST: [0.18, 0.3, 0.14, 0.2, 0.06, 0.12],
  };
  const w = W[p.pos] || [0.16, 0.2, 0.2, 0.2, 0.12, 0.12];
  const v = p.pac * w[0] + p.sho * w[1] + p.pas * w[2] + p.dri * w[3] + p.def * w[4] + p.phy * w[5];
  const over = v > 88 ? 2 : v > 80 ? 1.5 : v > 72 ? 1 : 0;
  return Math.round(v + over);
}

const ROLE_BY_POS = {
  GK: ['Sweeper Keeper', 'Traditional GK'], RB: ['Fullback', 'Wingback', 'Inverted Fullback'], LB: ['Fullback', 'Wingback', 'Inverted Fullback'],
  RWB: ['Wingback', 'Attacking Wingback'], LWB: ['Wingback', 'Attacking Wingback'],
  CB: ['Ball-Playing Defender', 'Stopper', 'Defender'], RCB: ['Ball-Playing Defender', 'Stopper', 'Defender'], LCB: ['Ball-Playing Defender', 'Stopper', 'Defender'],
  CDM: ['Holding', 'Deep-Lying Playmaker', 'Box-to-Box'], CM: ['Box-to-Box', 'Playmaker', 'Holding'],
  CAM: ['Playmaker', 'Shadow Striker'], RM: ['Wide Playmaker', 'Winger'], LM: ['Wide Playmaker', 'Winger'],
  RW: ['Inside Forward', 'Winger', 'Wide Playmaker'], LW: ['Inside Forward', 'Winger', 'Wide Playmaker'],
  CF: ['False 9', 'Target Forward'], ST: ['Advanced Forward', 'Poacher', 'Target Forward', 'False 9'],
  RST: ['Advanced Forward', 'Poacher', 'Target Forward'], LST: ['Advanced Forward', 'Poacher', 'Target Forward'],
};
export function assignRole(p, rng) {
  const opts = ROLE_BY_POS[p.pos] || ['Balanced'];
  let label = opts[0];
  const d = derivedAtts(p);
  if (p.pos === 'ST' || p.pos === 'CF' || p.pos === 'RST' || p.pos === 'LST') {
    if (d.pas >= 78 && d.dri >= 78) label = 'False 9';
    else if (p.phy >= 82) label = 'Target Forward';
    else if (d.pos >= 82 && d.fin >= 80 && p.pac >= 78) label = 'Advanced Forward';
    else if (d.fin >= 80) label = 'Poacher';
  } else if (p.pos === 'CB' || p.pos === 'RCB' || p.pos === 'LCB') {
    if (d.pas >= 72 && d.dri >= 60) label = 'Ball-Playing Defender';
    else if (p.def >= 84) label = 'Stopper';
  } else if (p.pos === 'CM') {
    if (d.vis >= 80 && d.pas >= 80) label = 'Playmaker';
    else if (d.tac >= 76) label = 'Holding';
    else label = 'Box-to-Box';
  } else if (p.pos === 'CDM') {
    if (d.vis >= 80) label = 'Deep-Lying Playmaker';
    else if (p.phy >= 78 && d.sta >= 76) label = 'Box-to-Box';
  } else if (p.pos === 'RW' || p.pos === 'LW') {
    if (d.fin >= 76 && p.sho >= 74) label = 'Inside Forward';
    else if (d.vis >= 78) label = 'Wide Playmaker';
  } else if (p.pos === 'RB' || p.pos === 'LB') {
    if (d.cro >= 78 && p.pac >= 80) label = 'Wingback';
    else if (d.pas >= 76) label = 'Inverted Fullback';
  } else if (p.pos === 'CAM') {
    if (d.fin >= 78) label = 'Shadow Striker';
  }
  let fam = 0;
  const roll = rng ? rng.next() : hashStr(p.id + 'fam') / 4294967296;
  if (p.ovr >= 86) fam = roll < 0.30 ? 2 : roll < 0.75 ? 1 : 0;
  else fam = roll < 0.08 ? 2 : roll < 0.38 ? 1 : 0;
  p.role = { label, fam };
  return p.role;
}

export function makePlayer({ id, name, pos, age, nat, ovr, pot, pac, sho, pas, dri, def, phy, clubId = null, created = false, yth = false, rng, skipRole = false }) {
  const p = {
    id, name, pos, age, nat, ovr, pot, pac, sho, pas, dri, def, phy, clubId, created, yth,
    baseAge: age, baseOvr: ovr,
    mor: 70, frm: 5, fit: 100, shp: 60, inj: null, sus: 0, gr: 0,
    sta: { a: 0, g: 0, as: 0, cs: 0, rs: 0, rn: 0, min: 0 },
    ctr: { y: 0, w: 0, r: 0, role: 1 },
    plan: { focus: 'BAL', intensity: 1 },
    loan: null, retired: false, det: null, role: null, profile: {},
  };
  if (!skipRole) assignRole(p, rng);
  return p;
}

export function genName(nat, rng) {
  const pool = NAMES[nat] || NAMES.ENG;
  return pool.f[rng.int(pool.f.length)] + ' ' + pool.l[rng.int(pool.l.length)];
}

const POS_NEEDS = ['GK', 'GK', 'RB', 'LB', 'CB', 'CB', 'CB', 'CB', 'CDM', 'CDM', 'CM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'ST'];

export function genPlayerForClub(club, idx, rng, needIdx) {
  const h = hashStr(club.id + '#' + idx);
  const nat = rng.chance(0.55) ? club.ctry : TOP_NATS[rng.int(TOP_NATS.length)];
  const pos = POS_NEEDS[needIdx % POS_NEEDS.length];
  const avg = 50 + (club.rep - 50) * 0.72;
  const age = rng.chance(0.6) ? rng.intRange(17, 26) : rng.intRange(26, 33);
  let ovr = clamp(Math.round(avg - rng.range(0, 7) - (age > 30 ? 2 : 0)), 45, 83);
  if (pos === 'GK') ovr -= 1;
  const potGap = age <= 21 ? rng.intRange(2, 14) : age <= 25 ? rng.intRange(1, 8) : age <= 29 ? rng.intRange(0, 4) : 0;
  const pot = clamp(ovr + potGap, ovr, 92);
  const j = () => rng.intRange(-5, 5);
  let pac, sho, pas, dri, def, phy;
  const base = clamp(ovr + j(), 40, 95);
  const shape = pos === 'GK' ? [0.6, 0.2, 0.8, 0.7, 0.5, 0.9] : pos.startsWith('CB') ? [0.85, 0.35, 0.75, 0.65, 1.15, 1.15] : pos.includes('B') ? [1.0, 0.55, 0.85, 0.8, 1.0, 1.0] : pos === 'CDM' ? [0.75, 0.6, 0.95, 0.85, 1.1, 1.05] : ['CM', 'CAM'].includes(pos) ? [0.8, 0.85, 1.1, 1.0, 0.7, 0.85] : ['RM', 'LM', 'RW', 'LW'].includes(pos) ? [1.15, 0.85, 0.9, 1.1, 0.5, 0.75] : [1.0, 1.1, 0.75, 0.95, 0.4, 1.0];
  pac = clamp(Math.round(base * shape[0] + j()), 40, 95); sho = clamp(Math.round(base * shape[1] + j()), 20, 95);
  pas = clamp(Math.round(base * shape[2] + j()), 20, 95); dri = clamp(Math.round(base * shape[3] + j()), 20, 95);
  def = clamp(Math.round(base * shape[4] + j()), 20, 95); phy = clamp(Math.round(base * shape[5] + j()), 20, 95);
  const p = makePlayer({ id: 'g' + h.toString(36), name: genName(nat, rng), pos, age, nat, ovr, pot, pac, sho, pas, dri, def, phy, clubId: club.id, rng });
  p.ctr = initialContract(p, club.rep, rng);
  return p;
}

export function genYouth(club, idx, rng) {
  const nat = rng.chance(0.7) ? club.ctry : TOP_NATS[rng.int(TOP_NATS.length)];
  const pos = POS_NEEDS[rng.int(POS_NEEDS.length)];
  const age = rng.intRange(15, 17);
  const repBoost = clamp(Math.round((club.rep - 55) / 4), 0, 9);
  const ovr = clamp(46 + repBoost + rng.intRange(-2, 4), 40, 64);
  const roll = rng.next();
  let pot;
  if (roll < 0.01) pot = rng.intRange(89, 94);
  else if (roll < 0.07) pot = rng.intRange(85, 88);
  else if (roll < 0.25) pot = rng.intRange(80, 84);
  else if (roll < 0.6) pot = rng.intRange(73, 79);
  else pot = rng.intRange(60, 72);
  pot = clamp(pot, ovr + 5, 94);
  const base = ovr + rng.intRange(-3, 3);
  const p = makePlayer({ id: 'y' + hashStr(club.id + 'y' + idx).toString(36), name: genName(nat, rng), pos, age, nat, ovr,
    pot, pac: clamp(base + 6, 40, 90), sho: clamp(base + 2, 20, 90), pas: clamp(base + 3, 20, 90), dri: clamp(base + 4, 20, 90),
    def: clamp(base + 1, 20, 90), phy: clamp(base + 3, 20, 90), clubId: club.id, yth: true, rng });
  p.ctr = { y: 0, w: 0, r: 0, role: 3 };
  return p;
}

export function genFreeAgent(idx, rng) {
  const nat = TOP_NATS[rng.int(TOP_NATS.length)];
  const pos = POS_NEEDS[rng.int(POS_NEEDS.length)];
  const age = rng.intRange(20, 34);
  const ovr = clamp(Math.round(60 + rng.gauss() * 8), 50, 84);
  const pot = clamp(ovr + (age <= 24 ? rng.intRange(1, 8) : 0), ovr, 88);
  const base = ovr;
  const p = makePlayer({ id: 'f' + hashStr('fa' + idx).toString(36), name: genName(nat, rng), pos, age, nat, ovr, pot,
    pac: clamp(base + rng.intRange(-4, 8), 40, 92), sho: clamp(base + rng.intRange(-8, 6), 20, 92), pas: clamp(base + rng.intRange(-4, 6), 20, 92),
    dri: clamp(base + rng.intRange(-6, 8), 20, 92), def: clamp(base + rng.intRange(-8, 4), 20, 92), phy: clamp(base + rng.intRange(-6, 8), 20, 92),
    clubId: null, rng });
  p.ctr = { y: 1, w: Math.round(wageOf(p) * 100) / 100, r: 0, role: 2 };
  return p;
}
import { wageAsk } from '../engine/market.js';
function wageOf(p) { return wageAsk(p, 1); }

const TACT_OPTS = Object.keys(FORMATIONS);
export function genManager(club, rng, name) {
  const nat = club.ctry === 'ENG' && rng.chance(0.3) ? 'SCO' : (rng.chance(0.15) ? TOP_NATS[rng.int(TOP_NATS.length)] : club.ctry);
  return {
    name: name || (MGR_FIRST[rng.int(MGR_FIRST.length)] + ' ' + MGR_LAST[rng.int(MGR_LAST.length)]),
    nat,
    rep: clamp(Math.round(club.rep - 8 + rng.intRange(-4, 12)), 30, 92),
    tact: { formation: TACT_OPTS[rng.int(TACT_OPTS.length)], mentality: 3 },
    since: 2024, wins: 0, draws: 0, losses: 0,
  };
}

export function buildWorld() {
  const rng = new RNG(20260815);
  const clubs = new Map();
  const players = new Map();
  const freeAgents = [];
  const scoutsPool = [];
  const world = { clubs, players, freeAgents, scoutsPool, nts: [], year: 2026 };

  // clubs
  for (const [id, name, short, ctry, league, rep, c1, c2, badge, mono, rivals] of CLUBS) {
    const club = {
      id, name, short, ctry, league, rep, c1, c2, badge, mono, rivals: rivals || [],
      squad: [], youth: [], squadSize: 23,
      bal: 0, tb: 0, wb: 0,
      tact: { formation: TACT_OPTS[rng.int(TACT_OPTS.length)], mentality: 3 },
      mgr: null, scouts: [],
      rating: 70, objectives: null, objProgress: {},
      bought: 0, sold: 0, fanBase: rep,
    };
    const balBase = rep >= 90 ? 550 : rep >= 85 ? 320 : rep >= 80 ? 170 : rep >= 75 ? 80 : rep >= 70 ? 35 : rep >= 65 ? 14 : rep >= 60 ? 6 : rep >= 55 ? 3 : 1.5;
    // balBase is in MILLIONS of euros — balances/budgets are stored in raw euros
    club.bal = Math.round(balBase * 1e6 * (0.8 + rng.next() * 0.4));
    club.tb = Math.round(club.bal * (0.5 + rng.next() * 0.3));
    club.mgr = genManager(club, rng);
    clubs.set(id, club);
  }

  // curated players
  for (const [cid, name, pos, age, nat, ovr, pot, pac, sho, pas, dri, def, phy] of CURATED) {
    const club = clubs.get(cid);
    if (!club) continue;
    const nat2 = NATFIX[nat] || nat;
    const p = makePlayer({ id: 'r' + hashStr(cid + name + nat2).toString(36), name, pos, age, nat: nat2, ovr, pot, pac, sho, pas, dri, def, phy, clubId: cid, rng });
    p.ctr = initialContract(p, club.rep, rng);
    players.set(p.id, p);
    club.squad.push(p.id);
  }

  // fill squads with generated players
  for (const club of clubs.values()) {
    const tier1 = ['EPL', 'LAL', 'SEA', 'BUN', 'LI1'].includes(club.league);
    const target = club.squad.length >= 24 ? club.squad.length : (tier1 ? 23 : 22);
    let idx = 0;
    let safety = 0;
    while (club.squad.length < target && safety++ < 200) {
      const p = genPlayerForClub(club, idx++, rng, club.squad.length);
      if (players.has(p.id)) continue;
      players.set(p.id, p);
      club.squad.push(p.id);
    }
    // youth academy
    const nYouth = rng.intRange(6, 10);
    for (let i = 0; i < nYouth; i++) {
      const p = genYouth(club, i, rng);
      if (players.has(p.id)) continue;
      players.set(p.id, p);
      club.youth.push(p.id);
    }
  }

  // free agents
  for (let i = 0; i < 300; i++) {
    const p = genFreeAgent(i, rng);
    players.set(p.id, p);
    freeAgents.push(p.id);
  }

  // wage budgets
  for (const club of clubs.values()) {
    let tot = 0;
    for (const id of club.squad) tot += players.get(id).ctr.w;
    club.wb = Math.round(tot * 1.4);
  }

  // scouts pool
  for (let i = 0; i < 40; i++) {
    const q = rng.intRange(1, 5);
    const j = rng.intRange(1, 5);
    scoutsPool.push({
      id: 'sc' + i, name: SCOUT_FIRST[rng.int(SCOUT_FIRST.length)] + ' ' + SCOUT_LAST[rng.int(SCOUT_LAST.length)],
      nat: TOP_NATS[rng.int(TOP_NATS.length)], quality: q, judge: j,
      region: rng.chance(0.4) ? 'Worldwide' : TOP_NATS[rng.int(TOP_NATS.length)],
      wage: Math.round((300 + q * 400 + rng.int(0, 300)) * 100) / 100,
    });
  }

  // national teams
  const natPool = {};
  for (const p of players.values()) {
    (natPool[p.nat] = natPool[p.nat] || []).push(p.id);
  }
  for (const [nat, name, confed] of NTS) {
    const pool = (natPool[nat] || []).slice().sort((a, b) => players.get(b).ovr - players.get(a).ovr);
    const squad = pool.slice(0, 23);
    // top up small nations with generated NT players
    let i = 0;
    while (squad.length < 23 && i < 60) {
      const p = genFreeAgent(hashStr('nt' + nat + i) % 100000, rng);
      p.id = 'f' + hashStr('ntf' + nat + i).toString(36);
      p.nat = nat;
      p.name = genName(nat, rng);
      if (!players.has(p.id)) {
        players.set(p.id, p);
        freeAgents.push(p.id);
        squad.push(p.id);
      }
      i++;
    }
    const strength = squad.length ? squad.reduce((s, id) => s + players.get(id).ovr, 0) / squad.length : 60;
    world.nts.push({ id: nat, name, confed, squad, strength, rank: 0, coach: genName(nat, rng), userManaged: false, tact: { formation: '4-3-3 Holding', mentality: 3 } });
  }
  world.nts.sort((a, b) => b.strength - a.strength);
  world.nts.forEach((nt, i) => (nt.rank = i + 1));

  return world;
}

export function weeklyRevenue(club) {
  return Math.round(11e6 * Math.pow(club.rep / 92, 6));
}
