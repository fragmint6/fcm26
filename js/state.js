// ============ FCM 26 — global state, new game, save/load, rollover ============
import { buildWorld, genManager } from './data/worldgen.js';
import { LEAGUES, CUPS, UEFA } from './data/clubs.js';
import { buildSeason, tableSorted, clubsInLeague, applyResult } from './engine/schedule.js';
import { genObjectives, seasonAwards } from './engine/board.js';
import { news } from './engine/advance.js';
import { totalWages } from './engine/market.js';
import { hashStr, RNG, clamp, fmtDate, fmtMoney } from './util.js';
import { applyImportedPlayer } from './engine/import.js';
import { prepareWorldWithBundle, trimSquads } from './engine/worldextend.js';
import { applyUserTact } from './engine/match.js';

// ---- EAFC database bundle (js/data/import_bundle.js, built from uploads/*.csv) ----
let bundlePromise = null;
function loadBundle() {
  if (!bundlePromise) {
    bundlePromise = import('./data/import_bundle.js')
      .then(m => (m.IMPORT_BUNDLE && m.IMPORT_BUNDLE.length ? m.IMPORT_BUNDLE : []))
      .catch(() => []);
  }
  return bundlePromise;
}

export const SAVE_KEY = 'fcm26_saves';
export const START_YEAR = 2026;

function emptyG() {
  return {
    world: null, manager: null, settings: null, user: null,
    date: null, year: START_YEAR, seq: 1000, tai: 0, offSeq: 0,
    news: [], form: {}, known: {}, scoutReports: [], userListings: {}, ntSquads: {},
    offers: [], jobOffers: [], ntOffers: [],
    hist: { seasons: [], lastSeason: null },
    flags: {}, results: {}, tables: {}, cal: new Map(), matchIndex: new Map(), sched: null,
    pendingMatch: null, seasonOver: false, careerState: 'active', stopPoint: null,
    lastScoutDay: null, dealsToday: 0, awards: null, ntSquadNeeded: null,
  };
}

export async function newGame(opts) {
  const G = emptyG();
  G.world = buildWorld();
  G.manager = { name: opts.managerName || 'Alex Ferguson', nat: opts.managerNat || 'ENG', avatar: opts.avatar || null, style: opts.style || 'Balanced', trophies: [], record: { w: 0, d: 0, l: 0, g: 0 } };
  G.settings = {
    difficulty: opts.difficulty ?? 3,
    toggles: { training: true, transfers: true, academy: true, lockedClub: false },
    simSpeed: 3, autosave: true,
  };
  G.user = {
    clubId: opts.clubId, ntJob: null,
    tact: { formation: opts.formation || '4-3-3 Holding', mentality: 3, press: 'balanced', style: opts.style || 'Balanced' },
    kickers: { pen: null, fk: null, cor: null }, captain: null,
    shortlist: [], challenges: [],
  };
  const club = G.world.clubs.get(opts.clubId);
  // give the user a scouting team
  club.scouts = [];
  for (let i = 0; i < 3; i++) { if (G.world.scoutsPool.length) club.scouts.push(G.world.scoutsPool.shift()); }
  club.rating = 70;
  G.date = opts.startDate || `${START_YEAR}-08-01`;
  // apply EAFC database import bundle (js/data/import_bundle.js, built from uploads/*.csv)
  const bundle = await loadBundle();
  const res = bundle.length ? prepareWorldWithBundle(G, bundle) : { applied: 0 };
  G.importCount = res.applied;
  G.importClubsCreated = res.created || 0;
  buildSeason(G, START_YEAR);
  applyUserTact(G);
  genObjectives(G, club);
  news(G, 'Board', `Welcome to ${club.name}, ${G.manager.name}. The board expect ${club.objectives[0].label.toLowerCase()}.`, '👋');
  if (res.applied) news(G, 'Data', `${res.applied} players loaded with real database stats & photos${res.created ? `, ${res.created} new clubs created` : ''}.`, '🗄️');
  return G;
}

// ---------- save / load ----------
// compact result encoding (display-only fields dropped; match application happens live)
function encRes(res) {
  if (!res) return null;
  if (res.events) return res; // user fullSim results: keep verbatim (commentary etc.)
  return [
    res.hg, res.ag,
    res.hst ? [res.hst.shots, res.hst.sot, res.hst.xg, res.hst.corn, res.hst.fouls, res.hst.poss] : null,
    res.ast ? [res.ast.shots, res.ast.sot, res.ast.xg, res.ast.corn, res.ast.fouls, res.ast.poss] : null,
    (res.hs || []).map(x => (x.pen ? [x.min, x.pid, 1] : [x.min, x.pid])),
    (res.as || []).map(x => (x.pen ? [x.min, x.pid, 1] : [x.min, x.pid])),
    (res.hAs || []).map(x => x.pid), (res.aAs || []).map(x => x.pid),
    (res.hc || []).map(x => x.pid), (res.ac || []).map(x => x.pid),
    (res.injuries || []).map(x => [x.pid, x.days]),
    res.ratings ? Object.entries(res.ratings).flat() : null,
    res.motm || null,
  ];
}
function decRes(arr) {
  if (!arr) return null;
  if (!Array.isArray(arr)) return arr; // verbatim fullSim result
  const [hg, ag, hst, ast, hs, as, hAs, aAs, hc, ac, inj, ratings, motm] = arr;
  const S = (x, i) => ({ shots: x[0], sot: x[1], xg: x[2], corn: x[3], fouls: x[4], poss: x[5] });
  const rat = {};
  if (ratings) for (let i = 0; i < ratings.length; i += 2) rat[ratings[i]] = ratings[i + 1];
  return {
    hg, ag,
    hs: hs.map(x => ({ min: x[0], pid: x[1], pen: !!x[2] })),
    as: as.map(x => ({ min: x[0], pid: x[1], pen: !!x[2] })),
    hAs: hAs.map(pid => ({ pid, min: 0 })), aAs: aAs.map(pid => ({ pid, min: 0 })),
    hc: hc.map(pid => ({ pid, min: 0, y: 1 })), ac: ac.map(pid => ({ pid, min: 0, y: 1 })),
    injuries: inj.map(x => ({ pid: x[0], days: x[1], name: 'injury' })),
    hst: hst ? S(hst) : { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 },
    ast: ast ? S(ast) : { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 },
    ratings: rat, motm: motm || null,
    xiH: [], xiA: [], subs: [], events: null, fit: null,
  };
}

export function serialize(G) {
  const clubs = {};
  for (const c of G.world.clubs.values()) {
    clubs[c.id] = {
      league: c.league, squad: c.squad, youth: c.youth, bal: c.bal, tb: c.tb, wb: c.wb,
      tact: c.tact, mgr: c.mgr, scouts: c.scouts, rating: c.rating, objectives: c.objectives,
      objProgress: c.objProgress, bought: c.bought, sold: c.sold, pnl: c.pnl,
    };
  }
  const players = {};
  for (const p of G.world.players.values()) {
    players[p.id] = [
      [p.mor, p.frm, p.fit, p.shp, p.inj || 0, p.sus, p.gr, p.ctr.y, p.ctr.w, p.ctr.r, p.ctr.role,
        p.sta.a, p.sta.g, p.sta.as, p.sta.cs, p.sta.rs, p.sta.rn, p.sta.min,
        p.yc || 0, p.plan.focus || 'BAL', p.plan.intensity, p.loan ? p.loan.from : 0, p.loan ? p.loan.end : '', p.retired ? 1 : 0, p.wantOut ? 1 : 0].join('~'),
      (p.imported === 'runtime' ? (p.det || 0) : 0),
      (p.imported === 'runtime' ? p.baseOvr : 0),
      (p.imported === 'runtime' ? (p.profile || {}) : 0),
    ];
  }
  const created = {};
  for (const p of G.world.players.values()) {
    if (p.created && p.imported === 'runtime') created[p.id] = JSON.parse(JSON.stringify(p));
  }
  const results = {};
  for (const [mid, res] of Object.entries(G.results)) results[mid] = encRes(res);
  return {
    v: 6, ts: Date.now(),
    manager: G.manager, settings: G.settings, user: G.user,
    date: G.date, year: G.year, seq: G.seq, tai: G.tai, offSeq: G.offSeq,
    news: G.news, form: G.form, known: G.known, scoutReports: G.scoutReports,
    userListings: G.userListings, ntSquads: G.ntSquads,
    offers: G.offers, jobOffers: G.jobOffers, ntOffers: G.ntOffers,
    hist: G.hist, flags: G.flags, results, sched: G.sched,
    clubs, players, createdPlayers: created,
    freeAgents: G.world.freeAgents, scoutsPool: G.world.scoutsPool,
    careerState: G.careerState, seasonOver: G.seasonOver,
    lastScoutDay: G.lastScoutDay, awards: G.awards,
  };
}

export async function deserialize(save) {
  const G = emptyG();
  G.world = buildWorld();
  G.manager = save.manager;
  G.settings = save.settings;
  G.user = save.user;
  G.date = save.date; G.year = save.year; G.seq = save.seq || 1000;
  // re-apply the static database bundle (deterministic — not persisted per player)
  const bundle = await loadBundle();
  if (bundle.length) prepareWorldWithBundle(G, bundle);
  G.tai = save.tai || 0; G.offSeq = save.offSeq || 0;
  G.news = save.news || []; G.form = save.form || {}; G.known = save.known || {};
  G.scoutReports = save.scoutReports || []; G.userListings = save.userListings || {};
  G.ntSquads = save.ntSquads || {}; G.offers = save.offers || [];
  G.jobOffers = save.jobOffers || []; G.ntOffers = save.ntOffers || [];
  G.hist = save.hist || { seasons: [], lastSeason: null };
  G.flags = save.flags || {};
  G.results = {};
  for (const [mid, res] of Object.entries(save.results || {})) G.results[mid] = decRes(res);
  G.sched = save.sched; G.careerState = save.careerState || 'active';
  G.seasonOver = save.seasonOver || false; G.lastScoutDay = save.lastScoutDay || null;
  G.awards = save.awards || null;
  G.world.freeAgents = save.freeAgents || G.world.freeAgents;
  G.world.scoutsPool = save.scoutsPool || G.world.scoutsPool;

  // created players
  for (const [pid, po] of Object.entries(save.createdPlayers || {})) {
    G.world.players.set(pid, Object.assign({}, po));
  }
  // player mutable state
  const yearOff = G.year - START_YEAR;
  for (const p of G.world.players.values()) {
    p.baseAge = p.baseAge ?? p.age;
    p.age = p.baseAge + yearOff;
  }
  for (const [pid, arr] of Object.entries(save.players || {})) {
    const p = G.world.players.get(pid);
    if (!p) continue;
    const head = typeof arr[0] === 'string' ? arr[0].split('~') : arr;
    const [mor, frm, fit, shp, inj, sus, gr, y, w, r, role, a, g, as, cs, rs, rn, min, yc, focus, intensity, loanC, loanEnd, retired, wantOut] = head;
    const N = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
    const B = v => v === 1 || v === true || v === '1';
    p.mor = N(mor, 70); p.frm = N(frm, 5); p.fit = N(fit, 100); p.shp = N(shp, 60); p.inj = N(inj) > 0 ? String(N(inj)) : null; p.sus = N(sus); p.gr = N(gr);
    p.ctr = { y: N(y, 1), w: N(w), r: N(r), role: N(role, 1) };
    p.sta = { a: N(a), g: N(g), as: N(as), cs: N(cs), rs: N(rs), rn: N(rn), min: N(min) };
    p.yc = N(yc); p.plan = { focus: focus || 'BAL', intensity: N(intensity, 1) };
    p.loan = loanC && loanC !== '0' ? { from: loanC, end: loanEnd } : null;
    p.retired = B(retired); p.wantOut = B(wantOut);
    const detO = arr[25], ovrO = arr[26], profO = arr[27];
    if (detO) { p.det = detO; p.imported = 'runtime'; }
    if (ovrO) { p.baseOvr = ovrO; p.imported = 'runtime'; }
    if (profO) { p.profile = profO; p.imported = 'runtime'; }
    p.ovr = (ovrO || p.baseOvr) + (p.gr || 0);
  }
  // clubs
  for (const [cid, cs] of Object.entries(save.clubs || {})) {
    const c = G.world.clubs.get(cid);
    if (!c) continue;
    Object.assign(c, cs);
  }
  // rebuild calendar & tables
  buildSeason(G, G.year, true);
  return G;
}

export function saveGame(G, slot = 0) {
  try {
    const data = JSON.stringify(serialize(G));
    const all = loadSaves();
    all[slot] = data;
    localStorage.setItem(SAVE_KEY, JSON.stringify(all));
    return { ok: true, size: data.length };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}
export function loadSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch (e) { return {}; }
}
export async function loadGame(slot) {
  const all = loadSaves();
  const data = all[slot];
  if (!data) return null;
  return deserialize(JSON.parse(data));
}
export function saveMeta(data) {
  try {
    const s = typeof data === 'string' ? JSON.parse(data) : data;
    return { ts: s.ts, date: s.date, club: s.manager ? (s.user ? (s.clubs?.[s.user.clubId] ? '' : '') : '') : '', name: s.manager?.name || '—' };
  } catch (e) { return { ts: 0, date: '—', name: '—' }; }
}

// ---------- season rollover ----------
export function rollover(G) {
  const world = G.world;
  const year = G.year;
  const userClub = world.clubs.get(G.user.clubId);

  // 1. summary & champions
  const champs = {};
  for (const lid of Object.keys(LEAGUES)) {
    const t = tableSorted(G, lid);
    if (t[0]) champs[lid] = t[0].id;
  }
  const cupsW = {};
  for (const cupId of Object.keys(CUPS)) {
    const st = G.sched.cups[cupId];
    if (st && st.winner) cupsW[cupId] = st.winner;
  }
  const euroW = {};
  for (const [key, compId] of [['ucl', 'UCL'], ['uel', 'UEL'], ['uecl', 'UCL2']]) {
    const st = G.sched.euro[key];
    if (st && st.winner) euroW[compId] = st.winner;
  }
  let pos = 0, wdl = null;
  if (userClub) {
    const t = tableSorted(G, userClub.league);
    pos = t.findIndex(r => r.id === userClub.id) + 1;
  }
  const awards = seasonAwards(G);
  G.awards = awards;
  const trophies = [];
  if (userClub) {
    for (const [lid, cid] of Object.entries(champs)) if (cid === userClub.id) trophies.push(LEAGUES[lid].name + ' title');
    for (const [cupId, cid] of Object.entries(cupsW)) if (cid === userClub.id) trophies.push(CUPS[cupId].name);
    for (const [compId, cid] of Object.entries(euroW)) if (cid === userClub.id) trophies.push(UEFA[compId].name);
    for (const t of trophies) G.manager.trophies.push({ name: t, year });
  }
  G.hist.seasons.push({ year, club: G.user.clubId, league: userClub ? userClub.league : null, pos, trophies });
  G.hist.lastSeason = { champs, cups: cupsW, euro: euroW, qual: computeQual(G, champs, cupsW), awards };

  // 2. promotion / relegation (pair-based: each lower league holds { upTo, n })
  const moves = [];
  for (const [lid, l] of Object.entries(LEAGUES)) {
    if (!l.proRel || !l.proRel.upTo) continue;
    const n = l.proRel.n;
    const upTo = l.proRel.upTo;
    const down = tableSorted(G, upTo).slice(-n).map(r => r.id);
    const up = tableSorted(G, lid).slice(0, n).map(r => r.id);
    moves.push({ down, up, from: upTo, to: lid });
  }
  for (const m of moves) {
    for (const id of m.down) { const c = world.clubs.get(id); if (c) c.league = m.to; }
    for (const id of m.up) { const c = world.clubs.get(id); if (c) c.league = m.from; }
    if (m.down.includes(G.user.clubId)) news(G, 'Board', `${userClub ? userClub.name : 'Your club'} have been relegated from the ${LEAGUES[m.from].name}.`, '📉');
    if (m.up.includes(G.user.clubId)) news(G, 'Board', `${userClub ? userClub.name : 'Your club'} have been promoted to the ${LEAGUES[m.from].name}!`, '🎉');
  }

  // 3. prize money & budgets
  for (const c of world.clubs.values()) {
    const l = LEAGUES[c.league];
    const t = tableSorted(G, c.league);
    const p = t.findIndex(r => r.id === c.id) + 1;
    const prize = l.prizeBase * Math.max(0.1, 1 - ((p - 1) / l.teams) * 0.92);
    let euroBonus = 0;
    for (const [key, compId] of [['ucl', 'UCL'], ['uel', 'UEL'], ['uecl', 'UCL2']]) {
      const st = G.sched.euro[key];
      if (st && st.teams && st.teams.includes(c.id)) euroBonus += compId === 'UCL' ? 25 : compId === 'UEL' ? 12 : 6;
      if (st && st.winner === c.id) euroBonus += compId === 'UCL' ? 55 : compId === 'UEL' ? 18 : 9;
    }
    for (const cupId of Object.keys(CUPS)) {
      if (G.sched.cups[cupId] && G.sched.cups[cupId].winner === c.id) euroBonus += CUPS[cupId].prize || 1;
    }
    c.bal = Math.round(c.bal + (prize + euroBonus) * 1e6);
    c.tb = Math.round(clamp(c.bal * 0.55, 0, 600e6));
    c.wb = Math.round(totalWages(world, c) * 1.35);
    c.pnl = 0; c.sold = 0; c.bought = 0; c.mgrFired = false;
    c.rating = c.id === G.user.clubId ? clamp(Math.round((c.rating + 65) / 2), 45, 85) : 60 + (hashStr(c.id + year) % 30);
  }

  // 4. contracts, retirements, loans
  const rng = new RNG(hashStr('rollover' + year));
  for (const c of world.clubs.values()) {
    for (const pid of c.squad.slice()) {
      const p = world.players.get(pid);
      if (!p) continue;
      if (p.loan) {
        if (p.loan.end <= G.date) { p.clubId = p.loan.from; p.loan = null; continue; }
      }
      p.ctr.y--;
      if (p.ctr.y <= 0) {
        if (c.id === G.user.clubId) {
          news(G, 'Contracts', `${p.name} has left ${c.name} after his contract expired.`, '📄');
          c.squad = c.squad.filter(id => id !== pid);
          p.clubId = null; p.ctr = { y: 1, w: 0, r: 0, role: 2 };
          world.freeAgents.push(pid);
        } else if (rng.chance(0.55)) {
          p.ctr.y = 2 + rng.int(3);
          p.ctr.w = Math.round(p.ctr.w * 1.08 * 100) / 100;
        } else {
          c.squad = c.squad.filter(id => id !== pid);
          p.clubId = null; p.ctr = { y: 1, w: 0, r: 0, role: 2 };
          world.freeAgents.push(pid);
        }
      }
    }
    // retirements
    for (const pid of c.squad.slice()) {
      const p = world.players.get(pid);
      if (!p) continue;
      const retireChance = p.age >= 39 ? 1 : p.age >= 36 ? (p.ovr <= 76 ? 0.6 : 0.25) : p.age >= 34 ? (p.ovr <= 70 ? 0.3 : 0.06) : 0;
      if (rng.chance(retireChance)) {
        p.retired = true;
        c.squad = c.squad.filter(id => id !== pid);
        p.clubId = null;
        if (p.ovr >= 80 || c.id === G.user.clubId) news(G, 'Events', `${p.name} (${p.age}) has retired from football.`, '👋');
      }
    }
  }
  // free agents also retire/decline
  for (const pid of world.freeAgents.slice()) {
    const p = world.players.get(pid);
    if (!p) continue;
    p.age++;
    if (p.age >= 37 && rng.chance(0.7)) { p.retired = true; world.freeAgents = world.freeAgents.filter(id => id !== pid); }
  }

  // 5. age everyone
  for (const p of world.players.values()) p.age++;

  // 6. new season
  const newYear = year + 1;
  G.seasonOver = false;
  G.pendingMatch = null;
  buildSeason(G, newYear);
  G.date = `${newYear}-07-01`;
  if (userClub) genObjectives(G, userClub);
  news(G, 'Board', `The ${newYear}/${newYear + 1} season is here. Transfer window open until August 31.`, '🗓️');
  return G;
}

function computeQual(G, champs, cupsW) {
  const qual = { ucl: [], uel: [], uecl: [] };
  for (const [lid, l] of Object.entries(LEAGUES)) {
    const t = tableSorted(G, lid).map(r => r.id);
    const s = l.spots;
    for (let i = 0; i < s.ucl; i++) if (t[i]) qual.ucl.push(t[i]);
    for (let i = 0; i < s.uel; i++) if (t[s.ucl + i]) qual.uel.push(t[s.ucl + i]);
    for (let i = 0; i < s.uecl; i++) if (t[s.ucl + s.uel + i]) qual.uecl.push(t[s.ucl + s.uel + i]);
  }
  // cup winners → UEL if not already in UCL
  for (const [cupId, winner] of Object.entries(cupsW)) {
    if (!winner) continue;
    const cup = CUPS[cupId];
    if (cup.country && ['ENG', 'ESP', 'ITA', 'GER', 'FRA'].includes(cup.country)) {
      if (!qual.ucl.includes(winner) && !qual.uel.includes(winner)) {
        qual.uel.push(winner);
        if (qual.uel.length > 36) qual.uel.pop();
      }
    }
  }
  return qual;
}

export function switchClub(G, clubId) {
  const old = G.world.clubs.get(G.user.clubId);
  const neu = G.world.clubs.get(clubId);
  if (old) old.rating = 70;
  G.user.clubId = clubId;
  // fresh squad → old XI/bench pins no longer apply; your tactics travel with you
  delete G.user.xiOverrides;
  delete G.user.benchOverride;
  applyUserTact(G);
  if (neu.scouts.length === 0) {
    for (let i = 0; i < 3 && G.world.scoutsPool.length; i++) neu.scouts.push(G.world.scoutsPool.shift());
  }
  neu.rating = 70;
  genObjectives(G, neu);
  news(G, 'Jobs', `${G.manager.name} takes over at ${neu.name}!`, '📩');
}
