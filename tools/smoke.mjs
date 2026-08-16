// ============ FCM 26 — headless engine smoke test ============
import { newGame, serialize, deserialize, rollover } from '../js/state.js';
import { advanceUntil, advanceOne, applyMatchResult, processDay } from '../js/engine/advance.js';
import { fullSim, quickSim, matchSeed } from '../js/engine/match.js';
import { tableSorted } from '../js/engine/schedule.js';

const t0 = Date.now();
let G = await newGame({ managerName: 'Test Manager', managerNat: 'ENG', clubId: 'ARS', startDate: '2026-08-01' });
console.log('world built:', Date.now() - t0, 'ms');
console.log('clubs:', G.world.clubs.size, 'players:', G.world.players.size, 'freeAgents:', G.world.freeAgents.length, 'NTs:', G.world.nts.length);
console.log('calendar days:', G.cal.size, 'matches scheduled:', G.sched.mcount);

// check arsenal squad
const ars = G.world.clubs.get('ARS');
console.log('Arsenal squad size:', ars.squad.length, 'youth:', ars.youth.length);
const saka = [...G.world.players.values()].find(p => p.name === 'Bukayo Saka');
console.log('Saka:', saka && saka.ovr, saka && saka.pos, saka && saka.role && saka.role.label);

// advance through pre-season to first match
let stops = 0;
let r;
const t1 = Date.now();
while (stops < 3) {
  r = advanceUntil(G);
  if (r === 'match') {
    stops++;
    if (stops === 1) {
      // full sim the first friendly
      const m = G.pendingMatch;
      const res = fullSim(m, G.world, matchSeed(m.id));
      applyMatchResult(G, m, res);
      console.log(`friendly: ${m.home} vs ${m.away} -> ${res.hg}-${res.ag}, events: ${res.events.length}, motm: ${res.motm && G.world.players.get(res.motm).name}`);
    } else {
      // instant result
      const m = G.pendingMatch;
      const res = quickSim(m, G.world, matchSeed(m.id));
      applyMatchResult(G, m, res);
      console.log(`match ${m.comp} ${m.stage}: ${res.hg}-${res.ag}`);
    }
  } else if (r === 'seasonend' || r === 'rollover') break;
  else if (r === 'window') { console.log('stopped at window event', G.date); }
}
console.log('advanced to:', G.date, 'in', Date.now() - t1, 'ms');
console.log('results so far:', Object.keys(G.results).length);
console.log('news items:', G.news.length, '| latest:', G.news[0] && G.news[0].t);

// league table check
const t = tableSorted(G, 'EPL');
console.log('EPL table leader:', t[0] && G.world.clubs.get(t[0].id).name, t[0] && t[0].pts, 'pts after', t[0] && t[0].p, 'games');

// save / load roundtrip
const t2 = Date.now();
const s = serialize(G);
console.log('serialize:', Math.round(JSON.stringify(s).length / 1024), 'KB in', Date.now() - t2, 'ms');
const G2 = await deserialize(JSON.parse(JSON.stringify(s)));
console.log('reloaded: date', G2.date, 'results', Object.keys(G2.results).length, 'players', G2.world.players.size);
const saka2 = [...G2.world.players.values()].find(p => p.name === 'Bukayo Saka');
console.log('Saka after reload:', saka2 && saka2.ovr, 'mor', saka2 && saka2.mor);

// advance a lot more to exercise transfer AI & cups
let guard = 0;
while (guard++ < 60) {
  r = advanceUntil(G2);
  if (r === 'match') {
    const m = G2.pendingMatch;
    const res = quickSim(m, G2.world, matchSeed(m.id));
    applyMatchResult(G2, m, res);
  } else if (r === 'seasonend' || r === 'rollover') break;
}
console.log('after long advance:', G2.date, 'results', Object.keys(G2.results).length, 'news', G2.news.length);
console.log('offers:', G2.offers.length, 'scout reports:', G2.scoutReports.length, 'known:', Object.keys(G2.known).length);
const arsT = tableSorted(G2, 'EPL').find(x => x.id === 'ARS');
console.log('Arsenal league:', arsT && arsT.p, 'P', arsT && arsT.pts, 'pts');

// rollover test
if (r === 'seasonend') {
  const t3 = Date.now();
  rollover(G2);
  console.log('rollover done in', Date.now() - t3, 'ms; new year:', G2.year, 'date:', G2.date, 'matches:', G2.sched.mcount);
  const s2 = serialize(G2);
  console.log('post-rollover save size:', Math.round(JSON.stringify(s2).length / 1024), 'KB');
  const G3 = await deserialize(JSON.parse(JSON.stringify(s2)));
  console.log('post-rollover reload OK:', G3.date, G3.year, Object.keys(G3.results).length, 'results');
}
console.log('SMOKE TEST PASSED');
