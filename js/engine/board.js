// ============ FCM 26 — board, objectives, manager market, events, awards ============
import { clamp, hashStr, RNG, addDays } from '../util.js';
import { LEAGUES, CUPS, UEFA } from '../data/clubs.js';
import { tableSorted } from './schedule.js';
import { genManager } from '../data/worldgen.js';
import { UNEXPECTED_EVENTS } from '../data/names.js';
import { news } from './advance.js';

export function expPos(rep) {
  if (rep >= 91) return 2; if (rep >= 88) return 3; if (rep >= 85) return 4; if (rep >= 82) return 6;
  if (rep >= 78) return 8; if (rep >= 74) return 10; if (rep >= 70) return 12; if (rep >= 66) return 14;
  if (rep >= 62) return 16; if (rep >= 58) return 18; return 30;
}

export function genObjectives(G, club) {
  const l = LEAGUES[club.league];
  const target = expPos(club.rep);
  const objs = [];
  objs.push({ id: 'league', label: `Finish in the top ${target} of ${l.name}`, weight: 5, target, type: 'pos' });
  const cup = Object.values(CUPS).find(c => c.country === club.ctry && c.type === 'cup');
  if (cup) {
    const cupTarget = club.rep >= 85 ? 'SF' : club.rep >= 76 ? 'QF' : club.rep >= 65 ? 'R5' : 'R4';
    objs.push({ id: 'cup', label: `Reach the ${cupTarget} of the ${cup.name}`, weight: 2, target: cupTarget, cup: cup.id, type: 'cup' });
  }
  const euro = uefaCompOf(G, club.id);
  if (euro) {
    const et = euro === 'UCL' ? (club.rep >= 88 ? 'QF' : 'R16') : euro === 'UEL' ? 'QF' : 'SF';
    objs.push({ id: 'europe', label: `Reach the ${et} of the ${UEFA[euro].short}`, weight: 4, target: et, comp: euro, type: 'euro' });
  }
  if (club.youth.length) objs.push({ id: 'youth', label: 'Give 3 academy players first-team appearances', weight: 1, target: 3, type: 'youth', count: 0 });
  objs.push({ id: 'financial', label: `Finish the season with a balance above ${(club.bal * 1.02 / 1e6).toFixed(0)}M`, weight: 1, target: Math.round(club.bal * 1.02), type: 'fin' });
  if (club.rep >= 84) objs.push({ id: 'brand', label: 'Sign 1 player rated 85 or higher', weight: 1, target: 1, type: 'brand', count: 0 });
  club.objectives = objs;
  club.objProgress = {};
}

function uefaCompOf(G, clubId) {
  const s = G.sched.euro;
  if (!s) return null;
  if (s.ucl && s.ucl.teams.includes(clubId)) return 'UCL';
  if (s.uel && s.uel.teams.includes(clubId)) return 'UEL';
  if (s.uecl && s.uecl.teams.includes(clubId)) return 'UCL2';
  return null;
}

export function boardReview(G) {
  const club = G.world.clubs.get(G.user.clubId);
  if (!club || !club.objectives) return;
  const l = LEAGUES[club.league];
  const t = tableSorted(G, club.league);
  const pos = t.findIndex(r => r.id === club.id) + 1;
  let delta = 0;
  const leagueObj = club.objectives.find(o => o.id === 'league');
  if (leagueObj) delta += (leagueObj.target - pos) * 1.6 + (pos === 1 ? 2 : 0) - (pos === 1 && leagueObj.target > 1 ? 0 : 0);
  const cupObj = club.objectives.find(o => o.id === 'cup');
  if (cupObj) {
    const st = G.sched.cups[cupObj.cup];
    const roundVal = r => ['R1', 'R2', 'R3', 'R4', 'R5', 'QF', 'SF', 'F'].indexOf(r);
    if (st) {
      const curRound = st.round - 1;
      const targetIdx = ['R1', 'R2', 'R3', 'R4', 'R5', 'QF', 'SF', 'F'].indexOf(cupObj.target);
      if (st.round > st.rounds) delta += 3; // won it
      else if (curRound > targetIdx) delta += 2;
    }
  }
  const euroObj = club.objectives.find(o => o.id === 'europe');
  if (euroObj) {
    const key = euroObj.comp === 'UCL' ? 'ucl' : euroObj.comp === 'UEL' ? 'uel' : 'uecl';
    const st = G.sched.euro[key];
    if (st && st.state === 'ko') {
      const order = ['playoff', 'r16', 'qf', 'sf', 'final', 'done'];
      const targetIdx = euroObj.target === 'SF' ? 3 : euroObj.target === 'QF' ? 2 : 1;
      const cur = order.indexOf(st.round);
      if (cur > targetIdx) delta += 2.5;
      if (st.round === 'done') delta += 2;
    }
  }
  if ((club.pnl || 0) < 0) delta -= 1;
  club.rating = clamp(Math.round((club.rating || 65) + delta), 0, 100);
  if (club.rating < 25 && !G.flags.boardWarned) {
    G.flags.boardWarned = true;
    news(G, 'Board', `The ${club.name} board have issued a public ultimatum: results must improve immediately.`, '🚨');
  }
  if (club.rating < 12 && !G.settings.toggles.lockedClub) {
    G.careerState = 'sacked';
    news(G, 'Board', `BREAKING: ${club.name} have sacked manager ${G.manager.name}.`, '🚨');
  }
  // job offers from other clubs
  if (club.rating >= 62 && !G.settings.toggles.lockedClub && G.date > `${G.year}-10-01` && (!G.flags.offered || G.flags.offered < addDays(G.date, -30))) {
    if (Math.random() < 0.22) maybeJobOffer(G, club);
    G.flags.offered = G.date;
  }
}

function maybeJobOffer(G, club) {
  const rng = new RNG(hashStr(G.date + 'offer'));
  const candidates = [...G.world.clubs.values()].filter(c =>
    c.id !== club.id && c.rep >= club.rep - 6 && c.rep <= club.rep + 10 && c.mgr && c.league in LEAGUES);
  if (!candidates.length) return;
  const c = candidates[rng.int(candidates.length)];
  const l = LEAGUES[c.league];
  if (!c.offeredJob) {
    c.offeredJob = true;
    G.jobOffers.push({ clubId: c.id, d: G.date, note: `${c.name} (${l.name}) want you as their new manager. Budget: transfer ${(c.tb / 1e6).toFixed(0)}M.` });
    news(G, 'Jobs', `${c.name} have approached you about their vacant manager role!`, '📩');
  }
}

export function managerMarketTick(G) {
  if (G.date.slice(8) !== '01') return;
  const rng = new RNG(hashStr(G.date + 'mgr'));
  const world = G.world;
  for (const c of world.clubs.values()) {
    if (c.id === G.user.clubId) continue;
    const l = LEAGUES[c.league];
    if (!l || l.tier !== 1) continue;
    const t = tableSorted(G, c.league);
    const pos = t.findIndex(r => r.id === c.id) + 1;
    const exp = expPos(c.rep);
    if (pos - exp > 5 && rng.chance(0.3) && !c.mgrFired) {
      c.mgrFired = true;
      const old = c.mgr;
      c.mgr = genManager(c, rng);
      c.tact = c.mgr.tact;
      news(G, 'Manager', `${c.name} sack ${old.name} and appoint ${c.mgr.name}. Expect a change of approach.`, '🔄');
    }
  }
}

export function unexpectedEvent(G) {
  const club = G.world.clubs.get(G.user.clubId);
  if (!club) return;
  const rng = new RNG(hashStr(G.date + 'evt'));
  const ev = UNEXPECTED_EVENTS[rng.int(UNEXPECTED_EVENTS.length)];
  let p = null;
  if (club.squad.length) {
    const pool = club.squad.map(id => G.world.players.get(id)).filter(x => x && !x.retired);
    if (pool.length) p = pool[rng.int(pool.length)];
  }
  const msg = ev.desc.replace('{club}', club.name).replace('{p}', p ? p.name : 'a first-team player');
  news(G, 'Events', msg, ev.good ? '🌟' : '⚠️');
  if (ev.money) { club.bal += club.bal * ev.money; club.tb = clamp(club.tb + club.tb * ev.money, 0, club.bal); }
  if (ev.rating) club.rating = clamp(club.rating + ev.rating, 0, 100);
  if (ev.morale) for (const id of club.squad) { const pl = G.world.players.get(id); if (pl) pl.mor = clamp(pl.mor + ev.morale, 0, 100); }
  if (ev.injure) {
    for (let i = 0; i < ev.injure; i++) {
      const v = club.squad[rng.int(club.squad.length)];
      const pl = G.world.players.get(v);
      if (pl && !pl.inj) pl.inj = addDays(G.date, rng.intRange(7, 28));
    }
  }
  if (ev.t === 'Star wants out' || ev.t === 'Homesick player') {
    if (p) { p.wantOut = true; p.mor = clamp(p.mor - 20, 0, 100); }
  }
  if (ev.t === 'Sudden retirement') {
    if (p) {
      p.retired = true;
      const c = G.world.clubs.get(p.clubId);
      if (c) c.squad = c.squad.filter(id => id !== p.id);
      news(G, 'Events', `${p.name} has retired from football with immediate effect.`, '👋');
    }
  }
}

// ---------- end of season ----------
export function seasonAwards(G) {
  const awards = {};
  const world = G.world;
  const leagueIds = ['EPL', 'LAL', 'SEA', 'BUN', 'LI1', 'ERE', 'LIP', 'SUL', 'SPL', 'CHP'];
  for (const lid of leagueIds) {
    const clubs = [...world.clubs.values()].filter(c => c.league === lid);
    const players = [];
    for (const c of clubs) for (const id of c.squad) { const p = world.players.get(id); if (p && p.sta.a > 0) players.push(p); }
    if (!players.length) continue;
    const boot = players.slice().sort((a, b) => b.sta.g - a.sta.g || b.sta.as - a.sta.as)[0];
    const play = players.slice().sort((a, b) => b.sta.as - a.sta.as)[0];
    const glove = players.filter(p => p.pos === 'GK').sort((a, b) => b.sta.cs - a.sta.cs)[0];
    const poty = players.slice().sort((a, b) => (b.sta.rn ? b.sta.rs / b.sta.rn : 0) - (a.sta.rn ? a.sta.rs / a.sta.rn : 0))[0];
    const ypoty = players.filter(p => p.age <= 21).sort((a, b) => (b.sta.rn ? b.sta.rs / b.sta.rn : 0) - (a.sta.rn ? a.sta.rs / a.sta.rn : 0))[0];
    awards[lid] = {
      boot: boot && { pid: boot.id, v: boot.sta.g }, play: play && { pid: play.id, v: play.sta.as },
      glove: glove && { pid: glove.id, v: glove.sta.cs }, poty: poty && { pid: poty.id, v: poty.sta.rn ? (poty.sta.rs / poty.sta.rn) : 0 },
      ypoty: ypoty && { pid: ypoty.id, v: ypoty.sta.rn ? (ypoty.sta.rs / ypoty.sta.rn) : 0 },
    };
    const an = (pid) => pid ? world.players.get(pid).name : '—';
    if (boot) news(G, 'Awards', `${an(boot.pid)} wins the ${LEAGUES[lid].name} Golden Boot with ${boot.sta.g} goals.`, '👟');
    if (poty) news(G, 'Awards', `${an(poty.pid)} is the ${LEAGUES[lid].name} Player of the Season.`, '⭐');
  }
  G.hist.lastSeason = G.hist.lastSeason || {};
  G.hist.lastSeason.awards = awards;
  return awards;
}
