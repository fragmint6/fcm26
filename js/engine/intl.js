// ============ FCM 26 — international football ============
import { RNG, hashStr, addDays } from '../util.js';
import { NTS } from '../data/clubs.js';
import { inIntlWindow } from './schedule.js';

export function tournamentYear(y) {
  return [2027, 2028, 2030, 2031, 2032, 2034].includes(y);
}

export function ntPool(G, nat) {
  return [...G.world.players.values()].filter(p => p.nat === nat && !p.retired && p.age <= 36).sort((a, b) => b.ovr - a.ovr);
}

export function aiNtSquad(G, nat) {
  return ntPool(G, nat).slice(0, 23).map(p => p.id);
}

export function ntWindowTick(G) {
  const date = G.date;
  if (!inIntlWindow(date)) return;
  const key = `nt${date.slice(0, 7)}`;
  if (G.flags[key]) return;
  G.flags[key] = true;
  const rng = new RNG(hashStr(key));
  const nts = G.world.nts.slice().sort((a, b) => rng.next() - 0.5);
  const friendlies = [];
  for (let i = 0; i < nts.length; i += 2) {
    if (i + 1 >= nts.length) continue;
    const h = nts[i], a = nts[i + 1];
    const d = addDays(date, 2 + (i % 4));
    if (!inIntlWindow(d)) continue;
    const m = { id: `${key}-F${i / 2}`, comp: 'NT', stage: 'F', home: 'NT:' + h.id, away: 'NT:' + a.id, date: d, user: false, nt: true, tnat: { h: h.id, a: a.id } };
    const arr = G.cal.get(d) || [];
    arr.push(m);
    G.cal.set(d, arr);
    friendlies.push(m);
  }
}

// ---------- tournaments ----------
const COMP_DEFS = {
  WC: { name: 'FIFA World Cup', teams: 48, groups: 12, thirds: 8, r32: true, hosts2030: ['ESP', 'POR', 'MAR', 'ARG', 'URU', 'PAR'], hosts2034: ['KSA'] },
  EURO: { name: 'UEFA Euro', teams: 24, groups: 6, thirds: 4 },
  COPA: { name: 'Copa América', teams: 16, groups: 4 },
  AFCON: { name: 'Africa Cup of Nations', teams: 24, groups: 6, thirds: 4 },
  ASIAN: { name: 'AFC Asian Cup', teams: 24, groups: 6, thirds: 4 },
  GOLD: { name: 'CONCACAF Gold Cup', teams: 16, groups: 4 },
};
const CONFED_OF = {
  ESP: 'UEFA', FRA: 'UEFA', ENG: 'UEFA', ARG: 'CONMEBOL', BRA: 'CONMEBOL', POR: 'UEFA', NED: 'UEFA', GER: 'UEFA',
  BEL: 'UEFA', ITA: 'UEFA', CRO: 'UEFA', MAR: 'CAF', URU: 'CONMEBOL', COL: 'CONMEBOL', MEX: 'CONCACAF', USA: 'CONCACAF',
  JPN: 'AFC', KOR: 'AFC', SEN: 'CAF', NGA: 'CAF', ALG: 'CAF', EGY: 'CAF', DEN: 'UEFA', SUI: 'UEFA', AUT: 'UEFA',
  TUR: 'UEFA', NOR: 'UEFA', SWE: 'UEFA', ECU: 'CONMEBOL', CAN: 'CONCACAF', KSA: 'AFC', AUS: 'AFC',
};

export function scheduleTournament(G, year) {
  const rng = new RNG(hashStr('tourn' + year));
  const comps = [];
  if (year === 2030 || year === 2034) {
    comps.push(mkComp(G, 'WC', rng, year));
  } else if (year === 2028 || year === 2032) {
    comps.push(mkComp(G, 'EURO', rng, year));
    comps.push(mkComp(G, 'COPA', rng, year));
  } else {
    comps.push(mkComp(G, 'AFCON', rng, year));
    comps.push(mkComp(G, 'ASIAN', rng, year));
    comps.push(mkComp(G, 'GOLD', rng, year));
  }
  G.sched.nt.tourn = { id: 'T' + year, name: `International Summer ${year}`, year, comps };
  if (G.user.ntJob) {
    const inIt = comps.some(c => c.teams.some(t => t.nat === G.user.ntJob));
    if (inIt) G.ntSquadNeeded = G.user.ntJob;
  }
  for (const c of comps) G.tables[c.key] = [];
  if (comps.length) {
    // news
    const all = comps.map(c => c.name).join(' & ');
    G.news.unshift({ d: G.date, cat: 'Intl', icon: '🌍', read: false, t: `The ${all} kicks off this month!` });
  }
}

function mkComp(G, compId, rng, year) {
  const def = COMP_DEFS[compId];
  const world = G.world;
  let pool;
  if (compId === 'WC') {
    const hosts = (def[`hosts${year}`] || []);
    const ranked = world.nts.slice().sort((a, b) => a.rank - b.rank);
    pool = [...ranked.filter(n => hosts.includes(n.id)), ...ranked.filter(n => !hosts.includes(n.id))].slice(0, def.teams);
  } else if (compId === 'EURO') {
    pool = world.nts.filter(n => n.confed === 'UEFA').sort((a, b) => a.rank - b.rank).slice(0, def.teams);
  } else if (compId === 'COPA') {
    const c = world.nts.filter(n => n.confed === 'CONMEBOL').sort((a, b) => a.rank - b.rank).slice(0, def.teams - 2);
    const guests = world.nts.filter(n => ['CONCACAF', 'CAF'].includes(n.confed)).sort((a, b) => a.rank - b.rank).slice(0, 2);
    pool = [...c, ...guests];
  } else if (compId === 'AFCON') {
    pool = world.nts.filter(n => n.confed === 'CAF').sort((a, b) => a.rank - b.rank).slice(0, def.teams);
  } else if (compId === 'ASIAN') {
    pool = world.nts.filter(n => n.confed === 'AFC').sort((a, b) => a.rank - b.rank).slice(0, def.teams);
  } else {
    pool = world.nts.filter(n => n.confed === 'CONCACAF').sort((a, b) => a.rank - b.rank).slice(0, def.teams);
  }
  const sorted = pool.slice().sort((a, b) => a.rank - b.rank);
  const groups = [];
  const g = def.groups;
  const per = def.teams / g;
  for (let i = 0; i < g; i++) groups.push([]);
  // snake seeding
  for (let i = 0; i < sorted.length; i++) {
    const gi = i < g ? i : (g - 1 - (i % g));
    groups[gi].push(sorted[i].id);
  }
  // draw matches — group stage
  const dates = [`${year}-06-10`, `${year}-06-11`, `${year}-06-14`, `${year}-06-15`, `${year}-06-18`, `${year}-06-19`];
  const mdDates = [dates.slice(0, 2), dates.slice(2, 4), dates.slice(4, 6)];
  const comp = { id: 'TNT-' + (G.sched.nt.tourn ? G.sched.nt.tourn.id : '') + '-' + compId, key: compId, name: def.name, teams: sorted.map(n => ({ nat: n.id, rank: n.rank })), groups, stage: 'group', matches: [], year, def };
  groups.forEach((grp, gi) => {
    const t = grp;
    const md0 = [[t[0], t[3]], [t[1], t[2]]];
    const md1 = [[t[3], t[1]], [t[0], t[2]]];
    const md2 = [[t[3], t[2]], [t[1], t[0]]];
    const mds = [md0, md1, md2];
    mds.forEach((md, mi) => {
      md.forEach(([h, a], k) => {
        const d = mdDates[mi][(gi + k) % 2];
        const m = { id: `${comp.key}-G${gi}-MD${mi}-${k}`, comp: `${comp.key}-G${gi}`, stage: 'G', home: 'NT:' + h, away: 'NT:' + a, date: d, user: false, nt: true, tnat: { h, a } };
        if (G.user.ntJob && (h === G.user.ntJob || a === G.user.ntJob)) m.user = true;
        const arr = G.cal.get(d) || [];
        arr.push(m);
        G.cal.set(d, arr);
        comp.matches.push(m);
      });
    });
    // group table
    G.tables[`${comp.key}-G${gi}`] = t.map(nat => ({ id: 'NT:' + nat, nat, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  });
  return comp;
}

export function tournamentTick(G) {
  const t = G.sched.nt.tourn;
  if (!t) return;
  for (const comp of t.comps) {
    if (comp.done) continue;
    if (comp.stage === 'group' && comp.matches.every(m => G.results[m.id])) {
      buildKnockout(G, comp);
    } else if (['r32', 'r16', 'qf', 'sf', 'final'].includes(comp.stage) && (comp.koMatches || []).every(m => G.results[m.id])) {
      advanceKnockout(G, comp);
    }
  }
}

function groupStandings(G, comp, gi) {
  const rows = (G.tables[`${comp.key}-G${gi}`] || []).slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  return rows.map(r => r.nat);
}

function buildKnockout(G, comp) {
  const rng = new RNG(hashStr(comp.key + 'ko'));
  const def = comp.def;
  const tops = [], thirds = [];
  for (let gi = 0; gi < def.groups; gi++) {
    const rows = (G.tables[`${comp.key}-G${gi}`] || []).slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    tops.push(rows[0].nat, rows[1].nat);
    if (rows[2]) thirds.push({ nat: rows[2].nat, pts: rows[2].pts, gd: rows[2].gf - rows[2].ga });
  }
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd);
  const adv = [...tops, ...thirds.slice(0, def.thirds || 0).map(t => t.nat)];
  const shuffled = rng.shuffle(adv);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
  if (def.r32) {
    comp.stage = 'r32';
    scheduleKo(G, comp, pairs, 'r32', [`${comp.year}-06-23`, `${comp.year}-06-24`]);
  } else if (adv.length === 8) {
    comp.stage = 'qf';
    scheduleKo(G, comp, pairs, 'qf', [`${comp.year}-07-01`, `${comp.year}-07-02`]);
  } else {
    comp.stage = 'r16';
    scheduleKo(G, comp, pairs, 'r16', [`${comp.year}-06-27`, `${comp.year}-06-28`]);
  }
}

function scheduleKo(G, comp, pairs, stage, dates) {
  comp.koMatches = [];
  pairs.forEach(([h, a], i) => {
    if (!h || !a) return;
    const d = dates[i % dates.length];
    const m = { id: `${comp.key}-${stage}-${i}`, comp: comp.key, stage, home: 'NT:' + h, away: 'NT:' + a, date: d, user: false, nt: true, tnat: { h, a } };
    if (G.user.ntJob && (h === G.user.ntJob || a === G.user.ntJob)) m.user = true;
    const arr = G.cal.get(d) || [];
    arr.push(m);
    G.cal.set(d, arr);
    comp.koMatches.push(m);
  });
}

function advanceKnockout(G, comp) {
  const winners = (comp.koMatches || []).map(m => {
    const r = G.results[m.id];
    let w;
    if (r.hg === r.ag) { // pens
      w = new RNG(hashStr(m.id + 'pens')).chance(0.5) ? m.home : m.away;
    } else w = r.hg > r.ag ? m.home : m.away;
    return w.slice(3);
  });
  const year = comp.year;
  const stage = comp.stage;
  const next = stage === 'r32' ? 'r16' : stage === 'r16' ? 'qf' : stage === 'qf' ? 'sf' : stage === 'sf' ? 'final' : 'done';
  if (next === 'done') {
    comp.done = true;
    comp.winner = winners[0];
    const nt = G.world.nts.find(n => n.id === comp.winner);
    G.news.unshift({ d: G.date, cat: 'Intl', icon: '🏆', read: false, t: `${nt ? nt.name : comp.winner} win the ${comp.name}!` });
    // NT job offers
    if (!G.user.ntJob && Math.random() < 0.4) {
      const candidates = G.world.nts.filter(n => n.rank <= 20 && Math.abs(n.strength - (G.world.nts.find(x => x.id === comp.winner)?.strength || 80)) < 6);
      if (candidates.length) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        G.ntOffers.push({ nat: pick.id, d: G.date });
        G.news.unshift({ d: G.date, cat: 'Jobs', icon: '📩', read: false, t: `${pick.name} have offered you the national team job!` });
      }
    }
    return;
  }
  const rng = new RNG(hashStr(comp.key + next));
  const shuffled = rng.shuffle(winners);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
  comp.stage = next;
  const dates = next === 'r16' ? [`${year}-06-27`, `${year}-06-28`] : next === 'qf' ? [`${year}-07-01`, `${year}-07-02`] : next === 'sf' ? [`${year}-07-05`, `${year}-07-06`] : [`${year}-07-10`];
  scheduleKo(G, comp, pairs, next, dates);
}
