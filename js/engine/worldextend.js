// ============ FCM 26 — dynamic world extension (from imported database) ============
// Creates leagues and clubs that exist in the imported data but not in the base
// game, so a full database export lands in a full football world.
import { LEAGUES } from '../data/clubs.js';
import { genManager, genPlayerForClub, genFreeAgent, genName } from '../data/worldgen.js';
import { hashStr, RNG, norm, clamp } from '../util.js';
import { applyImportBundle, resolveClubId, clubNorm, buildClubIndex } from './import.js';

// dataset league name → league id (existing or dynamically created)
export const LEAGUE_MAP_BY_NAME = {
  'Premier League': 'EPL', 'Championship': 'CHP', 'League One': 'ENG3', 'League Two': 'ENG4',
  'La Liga': 'LAL', 'La Liga 2': 'LA2',
  'Serie A': 'SEA', 'Serie B': 'SEB',
  'Bundesliga': 'BUN', '2. Bundesliga': 'BU2', '3. Liga': 'GER3',
  'Ligue 1': 'LI1', 'Ligue 2': 'LI2',
  'Eredivisie': 'ERE', 'Primeira Liga': 'LIP', 'Süper Lig': 'SUL',
  'Premiership': 'SCP', 'Superliga': 'DSU', 'Ekstraklasa': 'EKS', 'Liga I': 'LS1',
  'Eliteserien': 'ELI', 'Allsvenskan': 'ALL',
  'První liga': 'CFL', 'Hrvatska nogometna liga': 'HNL',
  'Pro League': 'SPL', // Saudi; Belgian clubs overridden at club level
  'Super League': 'CHN1', // default China; Swiss/Greek clubs overridden at club level
  'Liga Profesional de Fútbol': 'ARG1', 'Major League Soccer': 'MLS1', 'Série A': 'BRA1',
  'K League 1': 'KOR1', 'A-League Men': 'AUS1', 'Premier Division': 'IRL1',
  'Primera Division': 'CHI1', // Venezuelan clubs overridden at club level
  'Primera División': 'URU1', 'División de Fútbol Profesional': 'BOL1',
  'División Profesional': 'PAR1', 'Liga 1': 'PER1', 'Categoría Primera A': 'COL1',
  '1. Division': 'CYP1', 'Nemzeti Bajnokság I': 'HUN1', 'Veikkausliiga': 'FIN1', 'Premyer Liqa': 'AZE1',
};

// extra club-name disambiguation sets (the export mixes several leagues under one name)
const BELGIAN_CLUBS = new Set(['oudheverlee leuven', 'union saint-gilloise', 'standard de liège', 'sint-truidense vv',
  'fcv dender eh', 'kvc westerlo', 'cercle brugge ksv', 'royal charleroi sporting club', 'raal la louvière', 'sv zulte waregem'].map(norm));
const ECUADOR_CLUBS = new Set(['ldu quito', 'independiente del valle', 'mushuc runa', 'barcelona de guayaquil',
  'universidad católica del ecuador', 'barcelona sc'].map(norm));
const SWISS_CLUBS = new Set(['fc thun', 'grasshopper club zürich', 'grasshoppers'].map(norm));

// new leagues to create
const LEAGUE_EXTRA = {
  ECU1: { name: 'LigaPro Serie A', country: 'ECU', tier: 1, teams: 16, prizeBase: 2 },
  ENG3: { name: 'EFL League One', country: 'ENG', tier: 3, teams: 24, prizeBase: 6, proRel: { upTo: 'CHP', n: 3 } },
  ENG4: { name: 'EFL League Two', country: 'ENG', tier: 4, teams: 24, prizeBase: 4, proRel: { upTo: 'ENG3', n: 3 } },
  GER3: { name: '3. Liga', country: 'GER', tier: 3, teams: 20, prizeBase: 4, proRel: { upTo: 'BU2', n: 3 } },
  ARG1: { name: 'Liga Profesional', country: 'ARG', tier: 1, teams: 30, prizeBase: 14 },
  MLS1: { name: 'Major League Soccer', country: 'USA', tier: 1, teams: 30, prizeBase: 8 },
  BRA1: { name: 'Série A', country: 'BRA', tier: 1, teams: 20, prizeBase: 12 },
  KOR1: { name: 'K League 1', country: 'KOR', tier: 1, teams: 12, prizeBase: 4 },
  AUS1: { name: 'A-League', country: 'AUS', tier: 1, teams: 13, prizeBase: 3 },
  CHN1: { name: 'Chinese Super League', country: 'CHN', tier: 1, teams: 16, prizeBase: 6 },
  IND1: { name: 'Indian Super League', country: 'IND', tier: 1, teams: 13, prizeBase: 2 },
  IRL1: { name: 'League of Ireland', country: 'IRL', tier: 1, teams: 10, prizeBase: 1 },
  CHI1: { name: 'Chilean Primera División', country: 'CHI', tier: 1, teams: 16, prizeBase: 3 },
  VEN1: { name: 'Liga FUTVE', country: 'VEN', tier: 1, teams: 14, prizeBase: 1.5 },
  URU1: { name: 'Uruguayan Primera División', country: 'URU', tier: 1, teams: 16, prizeBase: 2 },
  BOL1: { name: 'Bolivian División Profesional', country: 'BOL', tier: 1, teams: 16, prizeBase: 1 },
  PAR1: { name: 'Paraguayan Primera División', country: 'PAR', tier: 1, teams: 12, prizeBase: 2 },
  PER1: { name: 'Peruvian Liga 1', country: 'PER', tier: 1, teams: 18, prizeBase: 2 },
  COL1: { name: 'Categoría Primera A', country: 'COL', tier: 1, teams: 20, prizeBase: 2 },
  CYP1: { name: 'Cypriot First Division', country: 'CYP', tier: 1, teams: 14, prizeBase: 1 },
  HUN1: { name: 'Nemzeti Bajnokság I', country: 'HUN', tier: 1, teams: 12, prizeBase: 2 },
  FIN1: { name: 'Veikkausliiga', country: 'FIN', tier: 1, teams: 12, prizeBase: 1 },
  AZE1: { name: 'Premyer Liqa', country: 'AZE', tier: 1, teams: 10, prizeBase: 1 },
};

// Venezuelan clubs (to split the mixed "Primera Division")
const VEN_CLUBS = new Set(['deportivotachira', 'academiapuertocabello', 'caracasfc', 'zamorafc', 'lalaguaira', 'monagassc', 'estudiantesdemerida', 'angosturafc', 'rayozuliano', 'metropolitanosfc', 'portuguesafc', 'ucvfc', 'deportivolaragua', 'carabobofc', 'minerosdeguayana']);
// Austrian clubs (the dataset calls both GER and AUT top flights "Bundesliga")
const AUSTRIAN_CLUBS = new Set(['salzburg', 'redbullsalzburg', 'sturmgraz', 'rapid', 'rapidwien', 'lask', 'lasklinz', 'austriawien', 'wolfsberger', 'wolfsbergerac', 'hartberg', 'altach', 'rheindorfaltach', 'wsgtirol', 'blauweisslinz', 'blauweiss', 'klagenfurt', 'austriaklagenfurt', 'grazerak', 'gak', 'ried', 'svried']);
// Indian Super League clubs (mixed into the dataset's "Super League" bucket)
const INDIAN_CLUBS = new Set(['bengalurufc', 'chennaiyin', 'chennaiyinfc', 'mohunbagan', 'mohunbagansupergiant', 'eastbengal', 'eastbengalfc', 'mumbacity', 'mumbacityfc', 'fcgoa', 'keralablasters', 'keralablastersfc', 'jamshedpur', 'jamshedpurfc', 'hyderabadfc', 'odisha', 'odishafc', 'northeastunited', 'northeastunitedfc', 'punjabfc', 'roundglasspunjab', 'mohammedan', 'mohammedansc', 'isl', 'unitedtigerssc', 'unitedtigers']);

const PALETTE = [['#c8102e', '#ffffff'], ['#004170', '#ffffff'], ['#1a3b8f', '#ffffff'], ['#0f7a3d', '#ffffff'], ['#6c1d45', '#ffffff'], ['#fdb913', '#231f20'], ['#000000', '#ffffff'], ['#f77f00', '#ffffff'], ['#7a263a', '#ffffff'], ['#003da5', '#ffffff'], ['#007a33', '#ffffff'], ['#e30613', '#ffffff']];

function leagueViaExisting(G, data, idx) {
  const existing = resolveClubId(G, data.club, data.slug, idx);
  if (!existing) return null;
  const c = G.world.clubs.get(existing);
  return c ? c.league : null;
}

export function leagueIdFor(G, data, idx) {
  if (!data.league) return data.fa ? null : null;
  const mapped = LEAGUE_MAP_BY_NAME[data.league];
  if (!mapped) return null;
  // --- mixed-league buckets: the export merges several real leagues under one name ---
  if (data.league === 'Premier League') {
    // English Premier League + Ukrainian Premier League (Shakhtar, Dynamo Kyiv)
    const via = leagueViaExisting(G, data, idx);
    return via === 'UPL' ? 'UPL' : 'EPL';
  }
  if (data.league === 'Serie A') {
    // Italian Serie A (plus newly-promoted Serie B sides) + Ecuador's Serie A
    const via = leagueViaExisting(G, data, idx);
    if (via === 'SEA' || via === 'SEB' || via === 'BRA1') return via;
    if (ECUADOR_CLUBS.has(norm(data.club))) return 'ECU1';
    return 'SEA';
  }
  if (data.league === 'Super League') {
    // Switzerland, Greece, China and India all under one label
    const via = leagueViaExisting(G, data, idx);
    if (via) return via;
    const raw = norm(data.club);
    if (INDIAN_CLUBS.has(raw) || INDIAN_CLUBS.has(clubNorm(data.club))) return 'IND1';
    if (SWISS_CLUBS.has(raw)) return 'SUP';
    return mapped; // CHN1
  }
  if (data.league === 'Pro League') {
    // Belgian Pro League + Saudi Pro League (+ the odd Gulf club, which rides with the Saudi league)
    const via = leagueViaExisting(G, data, idx);
    if (via) return via;
    if (BELGIAN_CLUBS.has(norm(data.club))) return 'BPL';
    return mapped; // SPL
  }
  if (data.league === 'Bundesliga') {
    const via = leagueViaExisting(G, data, idx);
    if (via === 'AUB' || via === 'BUN') return via;
    // Austrian Bundesliga clubs share the "Bundesliga" name in the dataset
    const n = clubNorm(data.club);
    if (AUSTRIAN_CLUBS.has(n) || AUSTRIAN_CLUBS.has(norm(data.club))) return 'AUB';
    return 'BUN';
  }
  if (data.league === 'Primera Division') {
    const n = norm(data.club);
    if (VEN_CLUBS.has(n)) return 'VEN1';
    return 'CHI1';
  }
  return mapped;
}

export function ensureLeagues() {
  let created = 0;
  for (const [id, cfg] of Object.entries(LEAGUE_EXTRA)) {
    if (LEAGUES[id]) continue;
    LEAGUES[id] = { id, name: cfg.name, country: cfg.country, tier: cfg.tier, teams: cfg.teams, prizeBase: cfg.prizeBase, proRel: cfg.proRel || null, spots: { ucl: 0, uel: 0, uecl: 0 }, dyn: true };
    created++;
  }
  return created;
}

export function extendWorldFromBundle(G, bundle) {
  ensureLeagues();
  const clubIdx = buildClubIndex(G);
  // group bundle players by (league, club)
  const groups = new Map();
  for (const data of bundle) {
    if (!data.club) continue;
    const lid = leagueIdFor(G, data, clubIdx);
    if (!lid) continue;
    const key = lid + '|' + norm(data.club);
    let grp = groups.get(key);
    if (!grp) groups.set(key, grp = { lid, name: data.club, players: [] });
    grp.players.push(data);
  }
  let clubsCreated = 0;
  for (const [key, grp] of groups) {
    // skip clubs that already exist
    const existing = resolveClubId(G, grp.name, null, clubIdx);
    if (existing) continue;
    const club = createClub(G, grp);
    if (club) clubsCreated++;
  }
  return { clubsCreated, groups: groups.size };
}

function createClub(G, grp) {
  const rng = new RNG(hashStr('dync' + grp.lid + grp.name));
  const avgOvr = grp.players.reduce((s, p) => s + (p.ovr || 60), 0) / Math.max(1, grp.players.length);
  const rep = clamp(Math.round(avgOvr * 1.02 + 2), 42, 90);
  const id = 'c' + hashStr('dyn' + norm(grp.name)).toString(36).slice(0, 8);
  const palette = PALETTE[hashStr(grp.name) % PALETTE.length];
  const league = LEAGUES[grp.lid];
  const balBase = rep >= 90 ? 550 : rep >= 85 ? 320 : rep >= 80 ? 170 : rep >= 75 ? 80 : rep >= 70 ? 35 : rep >= 65 ? 14 : rep >= 60 ? 6 : rep >= 55 ? 3 : 1.5;
  const bal = Math.round(balBase * 1e6 * (0.8 + rng.next() * 0.4));
  const club = {
    id, name: grp.name, short: grp.name, ctry: league.country, league: grp.lid,
    rep, c1: palette[0], c2: palette[1], badge: hashStr(grp.name) % 5,
    mono: norm(grp.name).slice(0, 3).toUpperCase(), rivals: [],
    squad: [], youth: [], squadSize: 26,
    bal, tb: Math.round(bal * (0.5 + rng.next() * 0.3)), wb: 0,
    tact: null, mgr: null, scouts: [],
    rating: 70, objectives: null, objProgress: {},
    bought: 0, sold: 0, fanBase: rep, dyn: true,
  };
  club.mgr = genManager(club, rng);
  club.tact = club.mgr.tact;
  G.world.clubs.set(club.id, club);
  return club;
}

// full pipeline: ensure leagues → create clubs → apply bundle → drop every non-database
// senior player → restock uncovered clubs → tidy world
export function prepareWorldWithBundle(G, bundle) {
  const t0 = Date.now();
  const ext = extendWorldFromBundle(G, bundle);
  const applied = applyImportBundle(G, bundle);
  const purged = purgeNonImported(G);
  const restocked = restockThinClubs(G);
  trimSquads(G, 40);
  fixWageBudgets(G);
  rebuildNTSquads(G);
  const ms = Date.now() - t0;
  return { applied, created: ext.clubsCreated, purged, restocked, ms };
}

// The database is the single source of truth: after the bundle lands, every senior
// player that did not come from the imported data is removed from the world
// (youth-intake prospects are fictional regens and stay).
export function purgeNonImported(G) {
  let removed = 0;
  for (const club of G.world.clubs.values()) {
    club.squad = club.squad.filter(id => {
      const p = G.world.players.get(id);
      return p && (p.imported || p.yth);
    });
  }
  for (const [id, p] of [...G.world.players]) {
    if (!p.imported && !p.yth) { G.world.players.delete(id); removed++; }
  }
  G.world.freeAgents = G.world.freeAgents.filter(id => G.world.players.has(id));
  return removed;
}

// Clubs the database doesn't cover (tiny leagues with partial exports — e.g. Czech,
// Serbian or Cypriot sides) would end up with empty squads and break scheduling, so
// they are restocked with clearly-fictional filler players.
function restockThinClubs(G) {
  const rng = new RNG(hashStr('restock26'));
  let clubs = 0, made = 0;
  for (const club of G.world.clubs.values()) {
    let need = Math.max(0, 18 - club.squad.length);
    if (!need) continue;
    let idx = 0, guard = 0;
    while (need > 0 && guard++ < 60) {
      const p = genPlayerForClub(club, idx, rng, idx); // idx restart → GK coverage first
      idx++;
      p.imported = null; p.filler = true;
      if (G.world.players.has(p.id)) continue;
      p.created = true;
      G.world.players.set(p.id, p);
      club.squad.push(p.id);
      need--; made++;
    }
    clubs++;
  }
  return { clubs, made };
}

function fixWageBudgets(G) {
  for (const club of G.world.clubs.values()) {
    let tot = 0;
    for (const id of club.squad) {
      const p = G.world.players.get(id);
      if (p) tot += p.ctr.w;
    }
    if (!club.wb || club.wb < tot * 1.2) club.wb = Math.round(tot * 1.35);
  }
}

export function trimSquads(G, cap = 30) {
  for (const club of G.world.clubs.values()) {
    if (club.squad.length <= cap) continue;
    const players = club.squad.map(id => G.world.players.get(id)).filter(Boolean);
    const generated = players.filter(p => p.id.startsWith('g')).sort((a, b) => (a.ovr + a.gr) - (b.ovr + b.gr));
    let extra = club.squad.length - cap;
    for (const p of generated) {
      if (extra <= 0) break;
      club.squad = club.squad.filter(id => id !== p.id);
      p.clubId = null;
      G.world.freeAgents.push(p.id);
      extra--;
    }
    if (extra > 0) {
      const rest = club.squad.map(id => G.world.players.get(id)).filter(Boolean)
        .sort((a, b) => (a.ovr + a.gr) - (b.ovr + b.gr));
      for (const p of rest) {
        if (extra <= 0) break;
        club.squad = club.squad.filter(id => id !== p.id);
        p.clubId = null;
        G.world.freeAgents.push(p.id);
        extra--;
      }
    }
  }
}

export function rebuildNTSquads(G) {
  const world = G.world;
  const byNat = new Map();
  for (const p of world.players.values()) {
    if (p.retired || p.age > 36 || p.yth) continue;
    let arr = byNat.get(p.nat);
    if (!arr) byNat.set(p.nat, arr = []);
    arr.push(p);
  }
  for (const arr of byNat.values()) arr.sort((a, b) => (b.ovr + b.gr) - (a.ovr + a.gr));
  const rng = new RNG(hashStr('nttopup26'));
  let idx = 0;
  for (const nt of world.nts) {
    const pool = byNat.get(nt.id) || [];
    nt.squad = pool.slice(0, 23).map(p => p.id);
    // nations with too few real (database) players get fictional natives so
    // international fixtures always have a workable squad
    let guard = 0;
    while (nt.squad.length < 18 && guard++ < 40) {
      idx++;
      const p = genFreeAgent(hashStr('ntfill' + nt.id + idx) % 100000, rng);
      p.id = 'f' + hashStr('ntfill' + nt.id + '#' + idx).toString(36);
      p.nat = nt.id;
      p.name = genName(nt.id, rng);
      p.imported = null; p.filler = true; p.created = true;
      if (world.players.has(p.id)) continue;
      world.players.set(p.id, p);
      world.freeAgents.push(p.id);
      nt.squad.push(p.id);
    }
    nt.strength = nt.squad.length
      ? nt.squad.reduce((s, id) => s + (world.players.get(id) ? world.players.get(id).ovr : 60), 0) / nt.squad.length
      : 60;
  }
}
