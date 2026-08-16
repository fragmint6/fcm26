// ============ FCM 26 — match simulation engine ============
import { clamp, RNG, FORMATIONS, SLOT_AFF, hashStr } from '../util.js';
import { derivedAtts } from '../data/worldgen.js';
import { COMMENTARY, INJURIES } from '../data/names.js';

const MENT_ATT = [0.78, 0.9, 1.0, 1.12, 1.25]; // attack multiplier by mentality 1..5
const MENT_DEF = [1.18, 1.1, 1.0, 0.92, 0.85];

export function effOvr(p) {
  if (p.retired) return 40;
  let v = p.ovr + p.gr;
  const fam = p.role ? p.role.fam : 0;
  v += fam === 2 ? 3 : fam === 1 ? 1.5 : 0;
  v += (p.frm - 5) * 0.4;
  v += (p.mor - 65) * 0.05;
  if (p.fit < 40) v -= 7; else if (p.fit < 60) v -= 4; else if (p.fit < 75) v -= 1.5;
  v += (p.shp - 50) * 0.02;
  if (p.inj) v -= 3;
  return v;
}

// pick the XI + bench for a club
export function teamSheet(club, world, opts = {}) {
  const players = (club.squad || []).map(id => world.players.get(id)).filter(p => p && !p.retired && !p.inj && p.sus <= 0 && !p.loan);
  const tact = opts.tact || club.tact || { formation: '4-3-3 Holding', mentality: 3 };
  const xiOver = opts.xi || club.xi || {};
  const slots = FORMATIONS[tact.formation] || FORMATIONS['4-3-3 Holding'];
  // slot affinity, honouring secondary positions from real data
  const affOf = (slot, p) => {
    const base = SLOT_AFF[slot][p.pos] ?? 0;
    const alt = ((p.profile && p.profile.alt) || []).reduce((m, ap) => Math.max(m, SLOT_AFF[slot][ap] ?? 0), 0);
    return Math.max(base, alt > 0 ? alt - 0.1 : 0);
  };
  const used = new Set();
  const xi = [];
  for (const slot of slots) {
    let best = null, bestScore = -999;
    if (xiOver[slot]) {
      const p = players.find(x => x.id === xiOver[slot]);
      if (p) { used.add(p.id); xi.push({ slot, pid: p.id }); continue; }
    }
    for (const p of players) {
      if (used.has(p.id)) continue;
      const aff = affOf(slot, p);
      if (aff < 0.12) continue;
      const score = effOvr(p) * (0.55 + aff * 0.45) + (p.pos === slot ? 2 : 0);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (!best) {
      for (const p of players) {
        if (used.has(p.id)) continue;
        const aff = affOf(slot, p);
        const score = effOvr(p) * (0.3 + aff * 0.45);
        if (score > bestScore) { bestScore = score; best = p; }
      }
    }
    if (best) { used.add(best.id); xi.push({ slot, pid: best.id }); }
  }
  const bench = players.filter(p => !used.has(p.id)).sort((a, b) => effOvr(b) - effOvr(a)).slice(0, 7).map(p => p.id);
  return { xi, bench, tact };
}

export function teamQuality(sheet, world, mentality = 3) {
  const slots = sheet.tact ? FORMATIONS[sheet.tact.formation] : null;
  let att = 0, attN = 0, mid = 0, midN = 0, def = 0, defN = 0, gk = 0;
  let tot = 0, n = 0;
  for (const { slot, pid } of sheet.xi) {
    const p = world.players.get(pid);
    if (!p) continue;
    const e = effOvr(p);
    tot += e; n++;
    const s = slot;
    if (s === 'GK') { gk += e; continue; }
    if (['RB', 'RCB', 'LCB', 'LB', 'RWB', 'LWB', 'CB'].includes(s)) { def += e; defN++; }
    else if (['RCM', 'LCM', 'CDM', 'CM', 'RM', 'LM'].includes(s)) { mid += e; midN++; }
    else { att += e; attN++; }
  }
  att = attN ? att / attN : 60; mid = midN ? mid / midN : 60; def = defN ? def / defN : 60; gk = gk || 60;
  const ovr = n ? tot / n : 60;
  const m = clamp(mentality || 3, 1, 5);
  return {
    ovr, att: att * MENT_ATT[m - 1], mid: mid * (0.95 + m * 0.012), def: def * MENT_DEF[m - 1], gk,
  };
}

const SHOT_W = { ST: 3.2, RST: 3, LST: 3, CF: 2.8, CAM: 2.2, RW: 2.2, LW: 2.2, RM: 1.4, LM: 1.4, RCM: 1.1, LCM: 1.1, CM: 1, CDM: 0.5, RB: 0.35, LB: 0.35, RWB: 0.6, LWB: 0.6, CB: 0.3, RCB: 0.3, LCB: 0.3, GK: 0 };

function pickShooter(sheet, world, rng, side) {
  const cands = sheet.xi.map(x => ({ x, p: world.players.get(x.pid) })).filter(o => o.p && o.x.slot !== 'GK');
  if (!cands.length) return null;
  const w = o => SHOT_W[o.x.slot] || 0.5;
  return rng.weighted(cands, w);
}

function commentary(tpl, map) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? '');
}

// ---------- FULL SIM (user matches) ----------
export function fullSim(match, world, seed) {
  const rng = new RNG(seed ?? (Date.now() & 0x7fffffff));
  const hc = match.pseudoH || world.clubs.get(match.home);
  const ac = match.pseudoA || world.clubs.get(match.away);
  if (!hc || !ac) return { hg: 0, ag: 0, hs: [], as: [], hAs: [], aAs: [], hc: [], ac: [], hst: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 }, ast: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 }, injuries: [], events: [], ratings: {}, motm: null, subs: [], xiH: [], xiA: [], fit: {} };
  if (!hc.squad.length || !ac.squad.length) return { hg: 0, ag: 0, hs: [], as: [], hAs: [], aAs: [], hc: [], ac: [], hst: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 }, ast: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 }, injuries: [], events: [], ratings: {}, motm: null, subs: [], xiH: [], xiA: [], fit: {} };
  const hs = teamSheet(hc, world);
  const as = teamSheet(ac, world);
  const hq = teamQuality(hs, world, hs.tact.mentality);
  const aq = teamQuality(as, world, as.tact.mentality);
  const ub = match.bonus || 0;
  if (match.userHome === true) { hq.att += ub * 6; hq.mid += ub * 6; hq.def += ub * 6; hq.gk += ub * 6; }
  else if (match.userHome === false) { aq.att += ub * 6; aq.mid += ub * 6; aq.def += ub * 6; aq.gk += ub * 6; }
  const diff = (hc.rep - ac.rep) * 0.2;

  const st = {
    min: 0, hg: 0, ag: 0, poss: 50, mom: 0,
    hs: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0 }, as: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0 },
    hposs: 0, events: [],
    hAs: [], aAs: [],
    rat: new Map(), fit: new Map(), // fit delta per player
    hScorers: [], aScorers: [], hCards: [], aCards: [],
    redH: 0, redA: 0, injuries: [], subs: { h: [], a: [] },
  };
  const startFit = new Map();
  for (const x of [...hs.xi, ...as.xi]) {
    const p = world.players.get(x.pid);
    st.rat.set(x.pid, 6.0);
    startFit.set(x.pid, p.fit);
  }
  const rat = (pid, d) => st.rat.set(pid, clamp(st.rat.get(pid) + d, 3, 10));
  st.xgAdd = (h, v) => { (h ? st.hs : st.as).xg += v; };
  st.shots = h => { (h ? st.hs : st.as).shots++; };
  st.sot = h => { (h ? st.hs : st.as).sot++; };
  st.corn = h => { (h ? st.hs : st.as).corn++; };
  st.fouls = s => { (s === 'h' ? st.hs : st.as).fouls++; };
  const finisher = (pid, side) => {
    const p = world.players.get(pid); if (!p) return 70;
    const d = derivedAtts(p);
    return side === 'h' ? clamp(d.fin + (p.frm - 5) * 1.5, 30, 99) : clamp(d.fin + (p.frm - 5) * 1.5, 30, 99);
  };
  const keeper = (side) => {
    const sheet = side === 'h' ? hs : as;
    const gkX = sheet.xi.find(x => x.slot === 'GK');
    const p = world.players.get(gkX.pid);
    const d = derivedAtts(p);
    return { pid: gkX.pid, ref: d.ref ?? 70, han: d.han ?? 70 };
  };
  const shout = (side) => (side === 'h' ? hc : ac).short;

  let stoppage = rng.intRange(1, 5);
  let lastSubMin = { h: 45, a: 45 };

  for (let min = 1; min <= 90 + stoppage; min++) {
    st.min = min;
    const hEffDef = hq.def * (st.redH ? 0.86 : 1);
    const aEffDef = aq.def * (st.redA ? 0.86 : 1);
    const hEffMid = hq.mid * (st.redH ? 0.9 : 1);
    const aEffMid = aq.mid * (st.redA ? 0.9 : 1);
    // possession
    st.poss = clamp(50 + (hEffMid - aEffMid) * 0.55 + st.mom * 0.6 + 2.5 + diff, 18, 82);
    st.hposs += st.poss;
    // who attacks
    const hAttacks = rng.chance(st.poss / 100);
    const attQ = hAttacks ? { att: hq.att * (st.redH ? 0.9 : 1), def: aEffDef, gk: keeper('a'), sheet: hs, side: 'h' } : { att: aq.att * (st.redA ? 0.9 : 1), def: hEffDef, gk: keeper('h'), sheet: as, side: 'a' };
    const defQ = hAttacks ? { sheet: as, side: 'a' } : { sheet: hs, side: 'h' };

    // fatigue
    for (const x of hs.xi) { const p = world.players.get(x.pid); st.fit.set(x.pid, (st.fit.get(x.pid) || 0) - (0.32 + (100 - (derivedAtts(p).sta || 70)) / 260)); }
    for (const x of as.xi) { const p = world.players.get(x.pid); st.fit.set(x.pid, (st.fit.get(x.pid) || 0) - (0.32 + (100 - (derivedAtts(p).sta || 70)) / 260)); }

    // chance of a shot this minute
    const shotP = clamp(0.045 + (attQ.att - attQ.def) * 0.004 + st.mom * (hAttacks ? 0.0022 : -0.0022), 0.02, 0.3);
    if (rng.chance(shotP)) {
      const shooter = pickShooter(attQ.sheet, world, rng, attQ.side);
      if (!shooter) continue;
      const p = shooter.p;
      const d = derivedAtts(p);
      const stBox = st.poss > 55 || rng.chance(0.3);
      const fin = d.fin + (stBox ? 4 : -6);
      const pGoal = clamp(0.09 + (fin - attQ.gk.ref) * 0.007 + (stBox ? 0.05 : 0) + st.mom * (hAttacks ? 0.0015 : -0.0015), 0.03, 0.48);
      st.xgAdd(hAttacks, pGoal);
      st.shots(hAttacks);
      const roll = rng.next();
      if (roll < pGoal) {
        // GOAL
        if (hAttacks) st.hg++; else st.ag++;
        const side = hAttacks ? 'h' : 'a';
        if (side === 'h') st.hScorers.push({ min, pid: p.id, pen: false }); else st.aScorers.push({ min, pid: p.id, pen: false });
        rat(p.id, 0.75);
        rat(attQ.gk.pid, -0.2);
        for (const x of defQ.sheet.xi.filter(x => x.slot.includes('B') || x.slot === 'CDM')) rat(x.pid, -0.15);
        // assist
        if (rng.chance(0.75)) {
          const ast = rng.weighted(attQ.sheet.xi.filter(x => x.pid !== p.id && x.slot !== 'GK'), w => 1);
          if (ast) { rat(ast.pid, 0.5); (hAttacks ? st.hAs : st.aAs).push({ pid: ast.pid, min }); }
        }
        st.mom += hAttacks ? 14 : -14;
        const score = `${st.hg}–${st.ag}`;
        st.events.push({ min, type: 'goal', side, text: commentary(rng.pick(COMMENTARY.goal), { p: p.name, c: shout(side), s: score }) });
      } else if (roll < pGoal + 0.12) {
        st.sot(hAttacks);
        rat(attQ.gk.pid, 0.15);
        rat(p.id, 0.08);
        if (roll < pGoal + 0.045) {
          st.events.push({ min, type: 'big', side: hAttacks ? 'h' : 'a', text: commentary(rng.pick(COMMENTARY.big), { p: p.name }) });
          st.mom += hAttacks ? 6 : -6;
        } else {
          st.events.push({ min, type: 'save', side: hAttacks ? 'h' : 'a', text: commentary(rng.pick(COMMENTARY.save), { p: world.players.get(attQ.gk.pid).name, c: shout(hAttacks ? 'a' : 'h') }) });
        }
      } else if (roll < pGoal + 0.22) {
        st.events.push({ min, type: 'shot', side: hAttacks ? 'h' : 'a', text: commentary(rng.pick(COMMENTARY.shot), { p: p.name }) });
        st.corn(hAttacks);
      } else if (roll < pGoal + 0.30) {
        st.events.push({ min, type: 'shot', side: hAttacks ? 'h' : 'a', text: commentary(rng.pick(COMMENTARY.shot), { p: p.name }) });
        rat(p.id, 0.04);
        st.mom += hAttacks ? 4 : -4;
      } else {
        st.events.push({ min, type: 'shot', side: hAttacks ? 'h' : 'a', text: commentary(rng.pick(COMMENTARY.shot), { p: p.name }) });
        st.sot(hAttacks);
        rat(p.id, 0.06);
      }
    }

    // fouls / cards
    if (rng.chance(0.14)) {
      const fSide = rng.chance(0.5) ? 'h' : 'a';
      const sheet = fSide === 'h' ? hs : as;
      const foul = rng.weighted(sheet.xi.filter(x => x.slot !== 'GK'), w => (SHOT_W[w.slot] || 0.4) * 0.3 + 0.6);
      const p = world.players.get(foul.pid);
      st.fouls(fSide);
      if (rng.chance(0.16)) {
        const list = fSide === 'h' ? st.hCards : st.aCards;
        list.push({ pid: p.id, min, y: 1 });
        rat(p.id, -0.4);
        st.events.push({ min, type: 'card', side: fSide, text: commentary(rng.pick(COMMENTARY.card), { p: p.name }) });
        const prior = list.filter(c => c.pid === p.id).length - 1;
        if (prior >= 1 && rng.chance(0.25)) {
          list.push({ pid: p.id, min, r: 1 });
          if (fSide === 'h') st.redH++; else st.redA++;
          st.events.push({ min, type: 'red', side: fSide, text: commentary(rng.pick(COMMENTARY.red), { p: p.name, c: shout(fSide) }) });
        }
      } else if (rng.chance(0.004)) {
        const list = fSide === 'h' ? st.hCards : st.aCards;
        list.push({ pid: p.id, min, r: 1 });
        if (fSide === 'h') st.redH++; else st.redA++;
        rat(p.id, -1);
        st.events.push({ min, type: 'red', side: fSide, text: commentary(rng.pick(COMMENTARY.red), { p: p.name, c: shout(fSide) }) });
      }
    }

    // injuries
    if (rng.chance(0.004)) {
      const side = rng.chance(0.5) ? 'h' : 'a';
      const sheet = side === 'h' ? hs : as;
      const v = rng.pick(sheet.xi);
      const p = world.players.get(v.pid);
      const inj = INJURIES[rng.int(INJURIES.length)];
      const weeks = rng.intRange(inj[1], inj[2]);
      st.injuries.push({ pid: p.id, name: inj[0], days: weeks * 7 });
      st.events.push({ min, type: 'injury', side, text: commentary(rng.pick(COMMENTARY.injury), { p: p.name }) });
    }

    // penalties
    if (rng.chance(0.006)) {
      const side = rng.chance(0.5) ? 'h' : 'a';
      const sheet = side === 'h' ? hs : as;
      const taker = rng.weighted(sheet.xi.filter(x => x.slot !== 'GK'), w => SHOT_W[w.slot] || 0.5);
      const p = world.players.get(taker.pid);
      const d = derivedAtts(p);
      const gk = keeper(side === 'h' ? 'a' : 'h');
      const pSc = clamp(0.72 + (d.pen - gk.ref) * 0.004, 0.5, 0.92);
      st.events.push({ min, type: 'pen', side, text: commentary(rng.pick(COMMENTARY.pen), { p: p.name, c: shout(side) }) });
      if (rng.chance(pSc)) {
        if (side === 'h') st.hg++; else st.ag++;
        if (side === 'h') st.hScorers.push({ min, pid: p.id, pen: true }); else st.aScorers.push({ min, pid: p.id, pen: true });
        rat(p.id, 0.8); rat(gk.pid, -0.1);
        st.mom += side === 'h' ? 10 : -10;
        st.events.push({ min, type: 'penGoal', side, text: commentary(rng.pick(COMMENTARY.penGoal), { p: p.name, c: shout(side), s: `${st.hg}–${st.ag}` }) });
      } else {
        rat(gk.pid, 0.5);
        st.events.push({ min, type: 'penMiss', side, text: commentary(rng.pick(COMMENTARY.penMiss), { p: p.name }) });
      }
    }

    // subs (auto)
    for (const side of ['h', 'a']) {
      if (min < 55 || min > 88 || min - lastSubMin[side] < 10) continue;
      const sheet = side === 'h' ? hs : as;
      const subsDone = st.subs[side].length;
      const maxSubs = 5;
      if (subsDone >= maxSubs) continue;
      const tired = sheet.xi.filter(x => x.slot !== 'GK').sort((a, b) => (st.fit.get(a.pid) || 0) - (st.fit.get(b.pid) || 0)).slice(0, 2);
      for (const out of tired) {
        if (st.subs[side].length >= maxSubs || min - lastSubMin[side] < 10) break;
        const bestIn = sheet.bench.map(id => world.players.get(id)).filter(p => p && !st.subs[side].find(s => s.in === p.id) && !sheet.xi.some(x => x.pid === p.id))
          .sort((a, b) => effOvr(b) - effOvr(a))[0];
        if (!bestIn) break;
        // only sub if tired significantly
        if ((st.fit.get(out.pid) || 0) > -28) break;
        st.subs[side].push({ out: out.pid, in: bestIn.id, min });
        st.rat.set(bestIn.id, 6.0);
        const pOut = world.players.get(out.pid);
        st.events.push({ min, type: 'sub', side, text: commentary(rng.pick(COMMENTARY.sub), { c: shout(side), out: pOut.name, in: bestIn.name }) });
        lastSubMin[side] = min;
      }
    }

    st.mom *= 0.985;
  }

  // finalize stats
  const res = {
    hg: st.hg, ag: st.ag,
    hs: st.hScorers, as: st.aScorers, hAs: st.hAs, aAs: st.aAs, hc: st.hCards, ac: st.aCards,
    hst: { ...st.hs, poss: Math.round(st.hposs / st.min) }, ast: { ...st.as, poss: 100 - Math.round(st.hposs / st.min) },
    events: st.events, injuries: st.injuries,
    ratings: {}, motm: null,
    fit: Object.fromEntries(st.fit),
    xiH: hs.xi.map(x => x.pid), xiA: as.xi.map(x => x.pid),
    benchH: hs.bench, benchA: as.bench,
    tactH: hs.tact, tactA: as.tact,
    subs: st.subs,
  };
  res.hst = { shots: st.hs.shots, sot: st.hs.sot, xg: Math.round(st.hs.xg * 10) / 10, corn: st.hs.corn, fouls: st.hs.fouls, poss: Math.round(st.hposs / st.min) };
  res.ast = { shots: st.as.shots, sot: st.as.sot, xg: Math.round(st.as.xg * 10) / 10, corn: st.as.corn, fouls: st.as.fouls, poss: 100 - Math.round(st.hposs / st.min) };
  // MOTM
  let best = null, bestR = -1;
  for (const [pid, r] of st.rat) {
    const w = r + (st.hScorers.some(s => s.pid === pid) ? 0.5 : 0) + (st.aScorers.some(s => s.pid === pid) ? 0.5 : 0);
    if (w > bestR) { bestR = w; best = pid; }
    res.ratings[pid] = Math.round(clamp(r, 3, 10) * 10) / 10;
  }
  res.motm = best;
  res.xiH = hs.xi.map(x => x.pid); res.xiA = as.xi.map(x => x.pid);
  return res;
}

// ---------- QUICK SIM (background matches) ----------
export function quickSim(match, world, seed) {
  const rng = new RNG(seed ?? (Date.now() & 0x7fffffff));
  const hc = match.pseudoH || world.clubs.get(match.home);
  const ac = match.pseudoA || world.clubs.get(match.away);
  if (!hc || !hc.squad || !hc.squad.length || !ac || !ac.squad || !ac.squad.length) return { hg: 0, ag: 0, hs: [], as: [], hAs: [], aAs: [], hc: [], ac: [], hst: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 }, ast: { shots: 0, sot: 0, xg: 0, corn: 0, fouls: 0, poss: 50 }, injuries: [], events: null, ratings: null, motm: null, subs: [], xiH: [], xiA: [], fit: null };
  const hs = teamSheet(hc, world);
  const as = teamSheet(ac, world);
  const hq = teamQuality(hs, world, hs.tact.mentality);
  const aq = teamQuality(as, world, as.tact.mentality);
  const diff = (hq.ovr - aq.ovr) + (hc.rep - ac.rep) * 0.12 + 1.6;
  let lh = clamp(1.25 * Math.pow(10, diff / 26), 0.15, 6);
  let la = clamp(1.25 * Math.pow(10, -diff / 26), 0.15, 6);
  let hg = poisson(rng, lh), ag = poisson(rng, la);
  if (hg > 7) hg = 7; if (ag > 7) ag = 7;
  const res = { hg, ag, hs: [], as: [], hAs: [], aAs: [], hc: [], ac: [], hst: null, ast: null, injuries: [], events: null, ratings: null, motm: null, subs: [], xiH: [], xiA: [], fit: null };
  const scorerPick = (sheet, side) => {
    const cands = sheet.xi.filter(x => x.slot !== 'GK');
    if (!cands.length) return null;
    const w = x => SHOT_W[x.slot] || 0.4;
    return rng.weighted(cands, w).pid;
  };
  const asstPick = (sheet, scorerPid) => {
    const cands = sheet.xi.filter(x => x.slot !== 'GK' && x.pid !== scorerPid);
    return cands.length ? rng.weighted(cands, x => SHOT_W[x.slot] || 0.4).pid : null;
  };
  for (let i = 0; i < hg; i++) {
    const pid = scorerPick(hs, 'h');
    if (pid) {
      res.hs.push({ min: rng.intRange(1, 93), pid, pen: false });
      if (rng.chance(0.7)) { const a = asstPick(hs, pid); if (a) res.hAs.push({ pid: a, min: 0 }); }
    }
  }
  for (let i = 0; i < ag; i++) {
    const pid = scorerPick(as, 'a');
    if (pid) {
      res.as.push({ min: rng.intRange(1, 93), pid, pen: false });
      if (rng.chance(0.7)) { const a = asstPick(as, pid); if (a) res.aAs.push({ pid: a, min: 0 }); }
    }
  }
  const nCards = rng.intRange(0, 7);
  for (let i = 0; i < nCards; i++) {
    const side = rng.chance(0.5) ? 'h' : 'a';
    const sheet = side === 'h' ? hs : as;
    const pid = rng.pick(sheet.xi).pid;
    if (side === 'h') res.hc.push({ pid, min: rng.intRange(10, 90), y: 1 }); else res.ac.push({ pid, min: rng.intRange(10, 90), y: 1 });
  }
  // injury chance
  if (rng.chance(0.03)) {
    const side = rng.chance(0.5) ? 'h' : 'a';
    const sheet = side === 'h' ? hs : as;
    const pid = rng.pick(sheet.xi).pid;
    const inj = INJURIES[rng.int(INJURIES.length)];
    res.injuries.push({ pid, name: inj[0], days: rng.intRange(inj[1], inj[2]) });
  }
  res.hst = { shots: Math.round(6 + lh * 3.2 + rng.int(-3, 3)), sot: Math.round(hg + lh * 1.4 + rng.int(0, 3)), xg: Math.round(lh * 10) / 10, corn: rng.intRange(1, 9), fouls: rng.intRange(5, 14), poss: Math.round(clamp(50 + diff * 2, 30, 70)) };
  res.ast = { shots: Math.round(6 + la * 3.2 + rng.int(-3, 3)), sot: Math.round(ag + la * 1.4 + rng.int(0, 3)), xg: Math.round(la * 10) / 10, corn: rng.intRange(1, 9), fouls: rng.intRange(5, 14), poss: 100 - res.hst.poss };
  res.xiH = hs.xi.map(x => x.pid); res.xiA = as.xi.map(x => x.pid);
  res.subs = [];
  return res;
}

function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng.next(); } while (p > L && k < 12);
  return k - 1;
}

// seed from match id so replays are stable
export function matchSeed(id) { return hashStr(id); }
