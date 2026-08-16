// ============ FCM 26 — season schedule builder ============
import { LEAGUES, CUPS, UEFA, NTS } from '../data/clubs.js';
import { RNG, hashStr, addDays, clamp } from '../util.js';

export const INTL_WINDOWS = [
  ['2026-09-05', '2026-09-09'], ['2026-10-10', '2026-10-14'], ['2026-11-14', '2026-11-18'], ['2027-03-21', '2027-03-29'],
  ['2027-09-04', '2027-09-08'], ['2027-10-09', '2027-10-13'], ['2027-11-13', '2027-11-17'], ['2028-03-25', '2028-04-02'],
  ['2028-09-02', '2028-09-06'], ['2028-10-07', '2028-10-11'], ['2028-11-11', '2028-11-15'], ['2029-03-24', '2029-04-01'],
  ['2029-09-01', '2029-09-05'], ['2029-10-06', '2029-10-10'], ['2029-11-10', '2029-11-14'], ['2030-03-23', '2030-03-31'],
];
export function inIntlWindow(date) {
  return INTL_WINDOWS.some(([a, b]) => date >= a && date <= b);
}

export function addMatch(G, m) {
  const arr = G.cal.get(m.date) || [];
  arr.push(m);
  G.cal.set(m.date, arr);
  G.sched.mcount = (G.sched.mcount || 0) + 1;
  if (G.matchIndex) G.matchIndex.set(m.id, m);
}
export function busyOn(G, clubId, date) {
  const arr = G.cal.get(date);
  if (!arr) return false;
  return arr.some(m => m.home === clubId || m.away === clubId);
}
export function placeMatch(G, m, prefDate) {
  const offsets = [0, 1, 2, 3, 4, 7, 8, 10];
  for (const off of offsets) {
    const d = addDays(prefDate, off);
    if (inIntlWindow(d) && m.comp !== 'NT' && m.comp !== 'TNT') continue;
    if (busyOn(G, m.home, d) || busyOn(G, m.away, d)) continue;
    m.date = d;
    addMatch(G, m);
    return d;
  }
  m.date = prefDate;
  addMatch(G, m);
  return prefDate;
}

// ---------- round robin ----------
export function roundRobin(rng, teams) {
  const n = teams.length;
  const odd = n % 2 === 1;
  const list = odd ? [...teams, null] : [...teams];
  const k = list.length;
  const rounds = [];
  for (let r = 0; r < k - 1; r++) {
    const round = [];
    for (let i = 0; i < k / 2; i++) {
      let h = list[i], a = list[k - 1 - i];
      if (h === null || a === null) continue;
      if (r % 2 === 1) [h, a] = [a, h];
      round.push([h, a]);
    }
    rounds.push(round);
    list.splice(1, 0, list.pop());
  }
  const shuffled = rng.shuffle(rounds);
  return shuffled;
}

function saturdays(year) {
  const out = [];
  let d = new Date(`${year}-08-01T12:00:00`);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  const end = new Date(`${year + 1}-06-01T12:00:00`);
  while (d < end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 7); }
  return out;
}
function wednesdays(year) {
  const out = [];
  let d = new Date(`${year}-08-01T12:00:00`);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  const end = new Date(`${year + 1}-06-01T12:00:00`);
  while (d < end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 7); }
  return out;
}

function leagueSlots(league, year) {
  const wk = saturdays(year).filter(d => !inIntlWindow(d));
  const mw = wednesdays(year).filter(d => !inIntlWindow(d));
  const winterBreak = lid => {
    if (lid === 'BUN' || lid === 'BU2') return d => !(d >= `${year}-12-19` && d <= `${year + 1}-01-08`);
    if (lid === 'LI1' || lid === 'LI2') return d => !(d >= `${year}-12-22` && d <= `${year + 1}-01-05`);
    return () => true;
  };
  const wb = winterBreak(league);
  return { weekends: wk.filter(wb), midweeks: mw.filter(wb) };
}

export function clubsInLeague(G, leagueId) {
  return [...G.world.clubs.values()].filter(c => c.league === leagueId).sort((a, b) => b.rep - a.rep);
}

export function initTable(G, compId, clubIds) {
  const rows = clubIds.map(id => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  G.tables[compId] = rows;
  return rows;
}
export function applyResult(G, compId, home, away, hg, ag) {
  const t = G.tables[compId];
  if (!t) return;
  const hr = t.find(r => r.id === home), ar = t.find(r => r.id === away);
  if (!hr || !ar) return;
  hr.p++; ar.p++; hr.gf += hg; hr.ga += ag; ar.gf += ag; ar.ga += hg;
  if (hg > ag) { hr.w++; ar.l++; hr.pts += 3; }
  else if (hg < ag) { ar.w++; hr.l++; ar.pts += 3; }
  else { hr.d++; ar.d++; hr.pts++; ar.pts++; }
}
export function tableSorted(G, compId) {
  const t = G.tables[compId] || [];
  return t.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.id.localeCompare(b.id));
}

// ---------- cups ----------
export function cupRounds(n) { const r = Math.ceil(Math.log2(n)); return { rounds: r, firstRoundMatches: Math.max(0, n - Math.pow(2, r - 1)) }; }

const CUP_DATES = {
  FAC: ['2026-09-09', '2026-10-07', '2027-01-06', '2027-02-10', '2027-03-24', '2027-05-13'],
  ELC: ['2026-09-02', '2026-09-23', '2026-10-28', '2026-12-02', '2027-01-13', '2027-02-28'],
  CDR: ['2026-09-02', '2026-10-07', '2027-01-13', '2027-02-10', '2027-03-03', '2027-04-22'],
  COI: ['2026-09-02', '2026-10-28', '2026-12-02', '2027-01-20', '2027-03-17', '2027-05-13'],
  DFP: ['2026-09-02', '2026-10-21', '2026-12-02', '2027-02-03', '2027-03-24', '2027-05-13'],
  CDF: ['2026-09-09', '2026-10-28', '2027-01-06', '2027-02-03', '2027-03-17', '2027-05-06'],
};

export function setupCup(G, cupId, year) {
  const cup = CUPS[cupId];
  const clubs = [...G.world.clubs.values()].filter(c => (c.ctry === cup.country) && ['EPL', 'CHP', 'LAL', 'LA2', 'SEA', 'SEB', 'BUN', 'BU2', 'LI1', 'LI2'].includes(c.league));
  const n = clubs.length;
  const { rounds, firstRoundMatches } = cupRounds(n);
  const sorted = clubs.sort((a, b) => a.rep - b.rep);
  const entrants = sorted.slice(0, firstRoundMatches * 2).map(c => c.id);
  const byes = sorted.slice(firstRoundMatches * 2).map(c => c.id);
  G.sched.cups[cupId] = { round: 1, rounds, entrants, byes, matches: [], dates: CUP_DATES[cupId].map(d => d.replace('2026-', `${year}-`).replace('2027-', `${year + 1}-`)) };
  drawCupRound(G, cupId, year);
}

export function drawCupRound(G, cupId, year) {
  const st = G.sched.cups[cupId];
  if (!st || !st.dates) return;
  const rng = new RNG(hashStr(`${year}-${cupId}-${st.round}`));
  let teams;
  if (st.round === 1) teams = [...st.entrants, ...st.byes];
  else teams = st.entrants;
  teams = rng.shuffle(teams);
  if (teams.length % 2 === 1) teams.pop(); // safety
  const pref = st.dates[Math.min(st.round - 1, st.dates.length - 1)];
  for (let i = 0; i < teams.length; i += 2) {
    const m = { id: `${year}-${cupId}-R${st.round}-M${i / 2}`, comp: cupId, stage: `R${st.round}`, home: teams[i], away: teams[i + 1], date: pref, user: false };
    if (m.home === G.user.clubId || m.away === G.user.clubId) m.user = true;
    placeMatch(G, m, pref);
    st.matches.push(m);
  }
}
export function cupRoundDone(G, cupId) {
  const st = G.sched.cups[cupId];
  if (!st || st.round > st.rounds) return;
  const played = st.matches.filter(m => G.results[m.id]);
  if (played.length < st.matches.length) return;
  const winners = st.matches.map(m => { const r = G.results[m.id]; return r.hg > r.ag ? m.home : m.away; });
  st.round++;
  if (st.round > st.rounds) {
    st.history = st.history || [];
    st.history.push({ round: st.round - 1, matches: st.matches });
    st.winner = winners[0];
    const cup = CUPS[cupId];
    const wclub = G.world.clubs.get(st.winner);
    if (wclub) G.news.unshift({ d: G.date, cat: 'Result', t: `${wclub.name} win the ${cup.name}!`, icon: '🏆' });
  } else {
    st.history = st.history || [];
    st.history.push({ round: st.round, matches: st.matches });
    st.matches = [];
    st.entrants = st.round === 2 ? [...winners, ...st.byes] : winners;
    st.byes = [];
    drawCupRound(G, cupId, G.year);
  }
}

// ---------- UEFA competitions ----------
export function uefaEntrants(G, year) {
  // season 1: rep-based. later: G.hist.lastSeason.qual
  const q = G.hist.lastSeason && G.hist.lastSeason.qual;
  if (q) return q;
  const ucl = [], uel = [], uecl = [];
  for (const [lid, l] of Object.entries(LEAGUES)) {
    const clubs = clubsInLeague(G, lid);
    const s = l.spots;
    for (let i = 0; i < s.ucl; i++) if (clubs[i]) ucl.push(clubs[i].id);
    for (let i = 0; i < s.uel; i++) if (clubs[s.ucl + i]) uel.push(clubs[s.ucl + i].id);
    for (let i = 0; i < s.uecl; i++) if (clubs[s.ucl + s.uel + i]) uecl.push(clubs[s.ucl + s.uel + i].id);
  }
  return { ucl, uel, uecl };
}

const UCL_MD = [['09-16', '09-30', '10-21', '11-04', '11-25', '12-09', '01-20', '01-27'], ['09-17', '10-01', '10-22', '11-05', '11-26', '12-10', '01-21', '01-28'], ['10-01', '10-22', '11-05', '11-26', '12-10', '12-17', '', '']];

export function setupEuro(G, year) {
  const { ucl, uel, uecl } = uefaEntrants(G, year);
  G.sched.euro = { ucl: setupEuroComp(G, 'UCL', ucl, year), uel: setupEuroComp(G, 'UEL', uel, year), uecl: setupEuroComp(G, 'UCL2', uecl, year), state: 'lp' };
}
function setupEuroComp(G, compId, ids, year) {
  const cfg = UEFA[compId];
  const rng = new RNG(hashStr(`${year}-${compId}-lp`));
  const teams = ids.map(id => G.world.clubs.get(id)).sort((a, b) => b.rep - a.rep);
  const potSize = Math.ceil(teams.length / cfg.pots);
  const pots = [];
  for (let i = 0; i < cfg.pots; i++) pots.push(teams.slice(i * potSize, (i + 1) * potSize));
  const mds = UCL_MD[compId === 'UCL' ? 0 : compId === 'UEL' ? 1 : 2].filter(Boolean).slice(0, cfg.lp);
  const pairings = [];
  for (const t of teams) {
    const opps = [];
    for (let p = 0; p < cfg.pots; p++) {
      const pot = pots[p].filter(x => x.id !== t.id && !opps.some(o => o.id === x.id));
      const noNat = pot.filter(x => x.ctry !== t.ctry);
      let pool = noNat.length >= 2 ? noNat : pot;
      if (pool.length > 2) {
        const shuffle = rng.shuffle(pool);
        // avoid same league if possible
        const noLeague = shuffle.filter(x => x.league !== t.league);
        const pick1 = noLeague.length ? noLeague[0] : shuffle[0];
        pool = shuffle.filter(x => x.id !== pick1.id);
        const noNat2 = pool.filter(x => x.ctry !== t.ctry);
        pool = noNat2.length ? noNat2 : pool;
        const pick2 = pool[0];
        opps.push(pick1, pick2);
      } else {
        for (const x of pool) if (!opps.some(o => o.id === x.id)) opps.push(x);
      }
    }
    // venue assignment: half home half away, balanced per pot
    const vens = [];
    for (let p = 0; p < cfg.pots; p++) {
      const pair = opps.slice(p * 2, p * 2 + 2);
      if (p % 2 === 0) { vens.push([pair[0], 'h'], [pair[1], 'a']); } else { vens.push([pair[0], 'a'], [pair[1], 'h']); }
    }
    pairings.push({ team: t.id, games: vens });
  }
  // slot assignment
  for (let attempt = 0; attempt < 30; attempt++) {
    const slotMap = new Map(); // team -> {slot: oppId}
    let ok = true;
    for (const pr of rng.shuffle(pairings)) {
      const used = new Set();
      for (let g = 0; g < pr.games.length; g++) {
        const [opp, venue] = pr.games[g];
        const oppUsed = [...slotMap.entries()].filter(([tid, v]) => tid === opp).map(([tid, v]) => v.slot);
        const avail = mds.map((_, i) => i).filter(i => !used.has(i) && !oppUsed.includes(i));
        if (!avail.length) { ok = false; break; }
        const slot = avail[rng.int(avail.length)];
        used.add(slot);
        slotMap.set(pr.team + '|' + g, { slot, opp: opp.id, venue });
      }
      if (!ok) break;
    }
    if (ok) {
      // create matches
      const matches = [];
      for (const pr of pairings) {
        for (let g = 0; g < pr.games.length; g++) {
          const a = slotMap.get(pr.team + '|' + g);
          const home = a.venue === 'h' ? pr.team : a.opp;
          const away = a.venue === 'h' ? a.opp : pr.team;
          const md = mds[a.slot];
          const d = md.startsWith('01') ? `${year + 1}-${md}` : `${year}-${md}`;
          const m = { id: `${year}-${compId}-LP-${pr.team}-${a.slot}`, comp: compId, stage: 'LP', home, away, date: d, user: false };
          if (m.home === G.user.clubId || m.away === G.user.clubId) m.user = true;
          placeMatch(G, m, d);
          matches.push(m);
        }
      }
      initTable(G, compId, ids);
      return { teams: ids, matches, state: 'lp' };
    }
  }
  initTable(G, compId, ids);
  return { teams: ids, matches: [], state: 'lp' };
}

export function lpRanking(G, compId) {
  return tableSorted(G, compId);
}
export function lpDone(G, compId) {
  const st = G.sched.euro[compId.toLowerCase() === 'ucl2' ? 'uecl' : compId.toLowerCase()];
  if (!st || st.state !== 'lp') return false;
  return st.matches.every(m => G.results[m.id]);
}
export function euroKnockoutDraw(G, compId) {
  const key = compId === 'UCL' ? 'ucl' : compId === 'UEL' ? 'uel' : 'uecl';
  const st = G.sched.euro[key];
  const cfg = UEFA[compId];
  const rank = lpRanking(G, compId).map(r => r.id);
  const rng = new RNG(hashStr(`${G.year}-${compId}-ko`));
  st.state = 'ko';
  st.rank = rank;
  // playoffs: 9-24
  const seeded = rank.slice(8, 16);
  const unseeded = rng.shuffle(rank.slice(16, 24));
  st.playoff = seeded.map((s, i) => [s, unseeded[i]]);
  st.r16 = rank.slice(0, 8).map(s => [s, null]); // winners paired after playoff
  st.round = 'playoff';
  scheduleEuroRound(G, compId, 'playoff', st.playoff, ['02-10', '02-17']);
}
export function scheduleEuroRound(G, compId, round, pairs, datePrefs) {
  const key = compId === 'UCL' ? 'ucl' : compId === 'UEL' ? 'uel' : 'uecl';
  const st = G.sched.euro[key];
  const year = G.year;
  const rng = new RNG(hashStr(`${year}-${compId}-${round}`));
  const legs = ['playoff', 'r16', 'qf', 'sf'].includes(round) ? 2 : 1;
  const matches = [];
  pairs.forEach(([h, a], i) => {
    for (let leg = 0; leg < legs; leg++) {
      const home = leg === 0 ? h : a, away = leg === 0 ? a : h;
      const prefBase = datePrefs[leg] || datePrefs[0];
      const d = prefBase.startsWith('01') || prefBase.startsWith('02') || prefBase.startsWith('03') || prefBase.startsWith('04') || prefBase.startsWith('05') ? `${year + 1}-${prefBase}` : `${year}-${prefBase}`;
      const off = leg === 0 ? 0 : 7;
      const m = { id: `${year}-${compId}-${round}-${i}-${leg}`, comp: compId, stage: round, home, away, date: addDays(d, off), user: false };
      if (m.home === G.user.clubId || m.away === G.user.clubId) m.user = true;
      placeMatch(G, m, addDays(d, off));
      matches.push(m);
    }
  });
  st[`${round}Matches`] = matches;
  return matches;
}
export function euroRoundDone(G, compId) {
  const key = compId === 'UCL' ? 'ucl' : compId === 'UEL' ? 'uel' : 'uecl';
  const st = G.sched.euro[key];
  if (!st || st.state !== 'ko') return false;
  const ms = st[`${st.round}Matches`] || [];
  return ms.length > 0 && ms.every(m => G.results[m.id]);
}
export function euroRoundAdvance(G, compId) {
  const key = compId === 'UCL' ? 'ucl' : compId === 'UEL' ? 'uel' : 'uecl';
  const st = G.sched.euro[key];
  const cfg = UEFA[compId];
  const rng = new RNG(hashStr(`${G.year}-${compId}-adv${st.round}`));
  // compute aggregate winners
  const agg = {};
  for (const m of st[`${st.round}Matches`]) {
    const r = G.results[m.id];
    agg[m.home] = agg[m.home] || { g: 0, a: 0, id: m.home };
    agg[m.away] = agg[m.away] || { g: 0, a: 0, id: m.away };
    agg[m.home].g += r.hg; agg[m.away].g += r.ag;
    agg[m.away].a += r.ag; agg[m.home].a += r.hg;
  }
  const rawPairs = st.round === 'playoff' ? st.playoff : st.round === 'r16' ? st.r16 : st.round === 'qf' ? st.qf : st.round === 'sf' ? st.sf : st.final;
  const pairs = st.round === 'final' ? [st.final] : rawPairs;
  const adv = pairs.map(([h, a]) => {
    const gh = agg[h], ga = agg[a];
    if (!gh || !ga) {
      console.error('EURO AGG MISS', compId, st.round, 'pairs', h, a, 'aggKeys', Object.keys(agg).join(','));
      const fall = gh ? h : ga ? a : (h || 'X');
      return fall;
    }
    if (gh.g > ga.g) return h;
    if (ga.g > gh.g) return a;
    return gh.a > ga.a ? h : a; // away goals
  });
  if (st.round === 'playoff') {
    const shuffledAdv = rng.shuffle(adv);
    st.r16 = st.rank.slice(0, 8).map((s, i) => [s, shuffledAdv[i]]);
    st.round = 'r16';
    scheduleEuroRound(G, compId, 'r16', st.r16, ['03-10', '03-17']);
  } else if (st.round === 'r16') {
    const shuffled = rng.shuffle(adv);
    st.qf = [];
    for (let i = 0; i < shuffled.length; i += 2) st.qf.push([shuffled[i], shuffled[i + 1]]);
    st.round = 'qf';
    scheduleEuroRound(G, compId, 'qf', st.qf, ['04-07', '04-14']);
  } else if (st.round === 'qf') {
    const shuffled = rng.shuffle(adv);
    st.sf = [[shuffled[0], shuffled[1]], [shuffled[2], shuffled[3]]];
    st.round = 'sf';
    scheduleEuroRound(G, compId, 'sf', st.sf, ['04-28', '05-05']);
  } else if (st.round === 'sf') {
    st.final = [adv[0], adv[1]];
    st.round = 'final';
    scheduleEuroRound(G, compId, 'final', [st.final], ['05-20']);
  } else if (st.round === 'final') {
    st.round = 'done';
    st.winner = adv[0];
    const w = G.world.clubs.get(st.winner);
    G.news.unshift({ d: G.date, cat: 'Result', t: `${w.name} win the ${cfg.name}!`, icon: '🏆' });
  }
}

// ---------- super cups ----------
export function setupSuperCups(G, year) {
  const ch = (lid) => { // champion of previous season (or top rep)
    const last = G.hist.lastSeason && G.hist.lastSeason.champs;
    return (last && last[lid]) || clubsInLeague(G, lid)[0].id;
  };
  const cupW = (cupId) => {
    const last = G.hist.lastSeason && G.hist.lastSeason.cups;
    return (last && last[cupId]) || null;
  };
  const mk = (comp, h, a, pref) => {
    const m = { id: `${year}-${comp}-F`, comp, stage: 'F', home: h, away: a, date: pref, user: false };
    if (m.home === G.user.clubId || m.away === G.user.clubId) m.user = true;
    placeMatch(G, m, pref);
  };
  const facW = cupW('FAC') || clubsInLeague(G, 'EPL')[1].id;
  mk('CSH', ch('EPL'), facW, `${year}-08-09`);
  const dfpW = cupW('DFP') || clubsInLeague(G, 'BUN')[1].id;
  mk('DSC', ch('BUN'), dfpW, `${year}-08-09`);
  const cdfW = cupW('CDF') || clubsInLeague(G, 'LI1')[1].id;
  mk('TDC', ch('LI1'), cdfW, `${year}-08-09`);
  // 4-team supercups in January
  for (const [comp, lid, cupId] of [['SDE', 'LAL', 'CDR'], ['SCI', 'SEA', 'COI']]) {
    const top = clubsInLeague(G, lid).slice(0, 2).map(c => c.id);
    const cupFinalists = cupW(cupId) ? [cupW(cupId)] : [clubsInLeague(G, lid)[2].id];
    const fourth = clubsInLeague(G, lid)[3].id;
    const four = [top[0], top[1], cupFinalists[0], fourth];
    const rng = new RNG(hashStr(`${year}-${comp}`));
    const sf1 = [four[0], four[3]], sf2 = [four[1], four[2]];
    G.sched.cups[comp] = { round: 1, rounds: 2, matches: [], special: true, sf1, sf2 };
    const m1 = { id: `${year}-${comp}-SF1`, comp, stage: 'SF', home: sf1[0], away: sf1[1], date: `${year + 1}-01-08`, user: false };
    const m2 = { id: `${year}-${comp}-SF2`, comp, stage: 'SF', home: sf2[0], away: sf2[1], date: `${year + 1}-01-09`, user: false };
    if ([m1.home, m1.away].includes(G.user.clubId)) m1.user = true;
    if ([m2.home, m2.away].includes(G.user.clubId)) m2.user = true;
    placeMatch(G, m1, m1.date); placeMatch(G, m2, m2.date);
    G.sched.cups[comp].matches = [m1, m2];
  }
}
export function superCupAdvance(G, comp) {
  const st = G.sched.cups[comp];
  if (!st || !st.special) return;
  const played = st.matches.filter(m => G.results[m.id]);
  if (played.length < st.matches.length || st.round >= 2) return;
  const [m1, m2] = st.matches;
  const w1 = G.results[m1.id].hg > G.results[m1.id].ag ? m1.home : m1.away;
  const w2 = G.results[m2.id].hg > G.results[m2.id].ag ? m2.home : m2.away;
  const fin = { id: `${G.year}-${comp}-F`, comp, stage: 'F', home: w1, away: w2, date: `${G.year + 1}-01-12`, user: false };
  if ([fin.home, fin.away].includes(G.user.clubId)) fin.user = true;
  placeMatch(G, fin, fin.date);
  st.round = 2;
  st.matches.push(fin);
  if (G.results[fin.id] && !st.winner) {
    st.winner = G.results[fin.id].hg > G.results[fin.id].ag ? fin.home : fin.away;
  }
}

// ---------- full season build ----------
export function buildSeason(G, year, rebuild = false) {
  G.year = year;
  G.cal = new Map();
  G.matchIndex = new Map();
  if (!rebuild) {
    G.sched = { year, cups: {}, euro: { ucl: null, uel: null, uecl: null, state: 'lp' }, nt: { tourn: null }, mcount: 0 };
    G.results = {};
    G.tables = {};
    G.flags = {};
    G.form = {};
  }
  buildLeagues(G, year);
  if (!rebuild) {
    setupFriendlies(G, year);
    setupSuperCups(G, year);
    for (const cupId of Object.keys(CUPS)) if (CUPS[cupId].type === 'cup') setupCup(G, cupId, year);
    setupEuro(G, year);
  } else {
    setupFriendlies(G, year);
    // re-add stored cup / supercup / euro matches
    for (const [cupId, st] of Object.entries(G.sched.cups)) {
      if (st.matches) for (const m of st.matches) addMatch(G, m);
    }
    for (const key of ['ucl', 'uel', 'uecl']) {
      const st = G.sched.euro[key];
      if (!st || !st.teams) continue;
      const compId = key === 'ucl' ? 'UCL' : key === 'uel' ? 'UEL' : 'UCL2';
      initTable(G, compId, st.teams);
      for (const m of st.matches || []) addMatch(G, m);
      for (const r of ['playoffMatches', 'r16Matches', 'qfMatches', 'sfMatches', 'finalMatches']) {
        for (const m of st[r] || []) addMatch(G, m);
      }
    }
    // NT tournament state
    const t = G.sched.nt.tourn;
    if (t) {
      for (const comp of t.comps) {
        G.tables[comp.key] = [];
        for (let gi = 0; gi < comp.groups.length; gi++) {
          const g = comp.groups[gi];
          const tblId = `${comp.key}-G${gi}`;
          G.tables[tblId] = g.map(nat => ({ id: 'NT:' + nat, nat, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
          for (const m of comp.matches) if (m.comp === tblId) addMatch(G, m);
        }
        for (const m of comp.koMatches || []) addMatch(G, m);
      }
    }
    // replay results into tables
    for (const [mid, res] of Object.entries(G.results)) {
      const m = G.matchIndex.get(mid);
      if (!m || !G.tables[m.comp]) continue;
      applyResult(G, m.comp, m.home, m.away, res.hg, res.ag);
    }
  }
}

function buildLeagues(G, year) {
  const rng = new RNG(hashStr('season' + year));
  for (const [lid, l] of Object.entries(LEAGUES)) {
    const teams = clubsInLeague(G, lid).map(c => c.id);
    const rounds = roundRobin(rng, teams);
    const { weekends, midweeks } = leagueSlots(lid, year);
    initTable(G, lid, teams);
    let wi = 0, mi = 0;
    for (let r = 0; r < rounds.length; r++) {
      let d;
      if (wi < weekends.length) d = weekends[wi++];
      else d = midweeks[mi++];
      for (const [h, a] of rounds[r]) {
        if (!h || !a) continue;
        const m = { id: `${year}-${lid}-R${r + 1}-M${h}-${a}`, comp: lid, stage: 'R' + (r + 1), home: h, away: a, date: d, user: false };
        if (m.home === G.user.clubId || m.away === G.user.clubId) m.user = true;
        addMatch(G, m);
      }
    }
  }
}

// ---------- pre-season friendlies (user) ----------
export function setupFriendlies(G, year) {
  const uclub = G.world.clubs.get(G.user.clubId);
  const rng = new RNG(hashStr(`${year}-fri-${G.user.clubId}`));
  const others = [...G.world.clubs.values()].filter(c => c.id !== G.user.clubId && Math.abs(c.rep - uclub.rep) < 12);
  const opps = rng.shuffle(others).slice(0, 3);
  const dates = [`${year}-08-01`, `${year}-08-04`, `${year}-08-08`];
  opps.forEach((o, i) => {
    const m = { id: `${year}-FRI-${i}`, comp: 'FRI', stage: 'F', home: uclub.id, away: o.id, date: dates[i], user: true };
    addMatch(G, m);
  });
}
