// ============ FCM 26 — daily advance engine ============
import { clamp, addDays, dow, RNG, hashStr, fmtMoney } from '../util.js';
import { LEAGUES, CUPS, UEFA } from '../data/clubs.js';
import { quickSim, matchSeed } from './match.js';
import { applyResult, tableSorted, cupRoundDone, superCupAdvance, lpDone, euroKnockoutDraw, euroRoundDone, euroRoundAdvance, inIntlWindow } from './schedule.js';
import { transferAI, deadlineDigest } from './market.js';
import { scoutReports } from './scouting.js';
import { monthlyGrowth, youthIntake } from './growth.js';
import { boardReview, unexpectedEvent, managerMarketTick } from './board.js';
import { ntWindowTick, tournamentTick, tournamentYear, scheduleTournament, aiNtSquad } from './intl.js';

export function isUserMatch(G, m) {
  if (m.nt) {
    if (!G.user.ntJob || !m.tnat) return false;
    return m.tnat.h === G.user.ntJob || m.tnat.a === G.user.ntJob;
  }
  return m.home === G.user.clubId || m.away === G.user.clubId;
}
export function ntPseudo(G, nat) {
  const nt = G.world.nts.find(n => n.id === nat);
  const squad = (nat === G.user.ntJob && G.ntSquads[nat]) ? G.ntSquads[nat] : aiNtSquad(G, nat);
  return { id: 'NT:' + nat, name: nt ? nt.name : nat, short: nt ? nt.name : nat, ctry: nat, rep: Math.round(nt ? nt.strength : 70), squad, tact: nt ? nt.tact : { formation: '4-3-3 Holding', mentality: 3 } };
}
import { weeklyRevenue } from '../data/worldgen.js';

const NEWS_CAP = 260;
export function news(G, cat, t, icon = '📰') {
  G.news.unshift({ d: G.date, cat, t, icon, read: false });
  if (G.news.length > NEWS_CAP) G.news.length = NEWS_CAP;
}

export function inTransferWindow(G) {
  const d = G.date;
  return (d >= `${G.year}-07-01` && d <= `${G.year}-08-31`) || (d >= `${G.year + 1}-01-01` && d <= `${G.year + 1}-01-31`);
}

// ---------- apply a finished match ----------
export function applyMatchResult(G, m, res) {
  G.results[m.id] = res;
  const world = G.world;
  if (m.comp in LEAGUES || m.comp in UEFA) applyResult(G, m.comp, m.home, m.away, res.hg, res.ag);
  else if (G.tables[m.comp]) applyResult(G, m.comp, m.home, m.away, res.hg, res.ag);

  const isNT = !!m.nt;
  const hc = world.clubs.get(m.home), ac = world.clubs.get(m.away);
  const isUserM = isUserMatch(G, m);
  // suspensions tick down for players not involved in the match
  if (!isNT) for (const c of [hc, ac]) {
    if (!c) continue;
    for (const pid of c.squad) {
      const p = world.players.get(pid);
      if (p && p.sus > 0 && !(res.xiH || []).includes(pid) && !(res.xiA || []).includes(pid)) p.sus--;
    }
  }

  // stats & fitness
  const touch = (pid, mins, side) => {
    const p = world.players.get(pid);
    if (!p) return;
    const st = p.sta;
    st.a++; st.min += mins;
    if (res.ratings && res.ratings[pid] != null) { st.rs += res.ratings[pid]; st.rn++; }
    if (res.fit && res.fit[pid] != null) p.fit = clamp(p.fit + res.fit[pid], 20, 100);
    else p.fit = clamp(p.fit - mins * 0.22, 20, 100);
    if (side === 'h') { if (res.hg > res.ag && st.cs !== undefined) {} }
  };
  const mins = 90;
  for (const pid of res.xiH || []) touch(pid, mins, 'h');
  for (const pid of res.xiA || []) touch(pid, mins, 'a');
  for (const s of res.hs || []) { const p = world.players.get(s.pid); if (p) { p.sta.g++; } }
  for (const s of res.as || []) { const p = world.players.get(s.pid); if (p) { p.sta.g++; } }
  for (const a of res.hAs || []) { const p = world.players.get(a.pid); if (p) p.sta.as++; }
  for (const a of res.aAs || []) { const p = world.players.get(a.pid); if (p) p.sta.as++; }
  // clean sheets
  if (res.ag === 0) for (const pid of res.xiH || []) { const p = world.players.get(pid); if (p && p.pos === 'GK') p.sta.cs++; }
  if (res.hg === 0) for (const pid of res.xiA || []) { const p = world.players.get(pid); if (p && p.pos === 'GK') p.sta.cs++; }

  // cards & suspensions
  const card = (pid, y, r) => {
    const p = world.players.get(pid);
    if (!p) return;
    if (y) {
      p.yc = (p.yc || 0) + 1;
      if (p.yc >= 5) { p.sus = Math.max(p.sus || 0, 1); p.yc = 0; }
    }
    if (r) p.sus = Math.max(p.sus || 0, 1);
  };
  for (const c of res.hc || []) card(c.pid, c.y, c.r);
  for (const c of res.ac || []) card(c.pid, c.y, c.r);

  // injuries
  for (const inj of res.injuries || []) {
    const p = world.players.get(inj.pid);
    if (!p || p.inj) continue;
    p.inj = addDays(G.date, inj.days);
    const club = p.clubId ? world.clubs.get(p.clubId) : null;
    if (club && (isUserM || club.id === G.user.clubId)) {
      news(G, 'Injury', `${p.name} (${club.short}) is out for ${Math.round(inj.days / 7)} week(s) with a ${inj.name}.`, '🩹');
    }
  }

  // form tracking
  if (!isNT) {
    const pushForm = (cid, resStr) => {
      G.form[cid] = G.form[cid] || [];
      G.form[cid].push(resStr);
      if (G.form[cid].length > 5) G.form[cid].shift();
    };
    if (res.hg > res.ag) { pushForm(m.home, 'W'); pushForm(m.away, 'L'); }
    else if (res.hg < res.ag) { pushForm(m.home, 'L'); pushForm(m.away, 'W'); }
    else { pushForm(m.home, 'D'); pushForm(m.away, 'D'); }
  }

  // user match extras
  if (isUserM) {
    const userSide = isNT ? (m.tnat.h === G.user.ntJob ? 'h' : 'a') : (m.home === G.user.clubId ? 'h' : 'a');
    const won = userSide === 'h' ? res.hg > res.ag : res.ag > res.hg;
    const drew = res.hg === res.ag;
    const xi = userSide === 'h' ? res.xiH : res.xiA;
    const score = `${res.hg}–${res.ag}`;
    for (const pid of xi) {
      const p = world.players.get(pid);
      if (!p) continue;
      p.mor = clamp(p.mor + (won ? 3 : drew ? 0 : -3), 0, 100);
      p.frm = clamp(p.frm + (won ? 0.4 : drew ? 0.05 : -0.4), 0, 10);
    }
    const motm = res.motm ? world.players.get(res.motm) : null;
    if (motm) { motm.mor = clamp(motm.mor + 3, 0, 100); motm.frm = clamp(motm.frm + 0.3, 0, 10); }
    if (G.manager && G.manager.record) {
      if (won) G.manager.record.w++; else if (drew) G.manager.record.d++; else G.manager.record.l++;
      G.manager.record.g++;
    }
    const compName = compLabel(m, G);
    if (isNT) {
      const ntName = nat => (G.world.nts.find(n => n.id === nat) || {}).name || nat;
      const my = ntName(G.user.ntJob), opp = ntName(userSide === 'h' ? m.tnat.a : m.tnat.h);
      news(G, 'Intl', won ? `${my} beat ${opp} ${score} in the ${compName}.` : drew ? `${my} drew ${score} with ${opp} (${compName}).` : `${my} lost ${score} to ${opp} in the ${compName}.`, won ? '✅' : drew ? '🤝' : '❌');
    } else {
      const uclub = world.clubs.get(G.user.clubId);
      const opp = world.clubs.get(m.home === G.user.clubId ? m.away : m.home);
      const verb = won ? `beat ${opp.name}` : drew ? `drew ${score} with ${opp.name}` : `lost ${score} to ${opp.name}`;
      news(G, 'Result', `${uclub.name} ${verb} in the ${compName}.`, won ? '✅' : drew ? '🤝' : '❌');
      if (m.comp in UEFA && ['sf', 'final'].includes(m.stage)) {
        news(G, 'Result', won ? `${uclub.name} advance in the ${compName}!` : `${uclub.name} are out of the ${compName}.`, '🏆');
      }
    }
    G.pendingMatch = null;
  } else if (!isNT) {
    // notable results
    const repGap = Math.abs(hc.rep - ac.rep);
    const lower = hc.rep < ac.rep ? hc : ac;
    const lowerWon = (hc.rep < ac.rep && res.hg > res.ag) || (ac.rep < hc.rep && res.ag > res.hg);
    if (lowerWon && repGap > 12 && (m.comp in CUPS || m.comp in UEFA)) {
      news(G, 'Result', `Cupset! ${lower.name} shock ${lower === hc ? ac.name : hc.name} ${res.hg}–${res.ag} in the ${compLabel(m, G)}.`, '😱');
    }
  }

  // manager records
  if (!isNT) {
    if (hc.mgr) { if (res.hg > res.ag) hc.mgr.wins++; else if (res.hg === res.ag) hc.mgr.draws++; else hc.mgr.losses++; }
    if (ac.mgr) { if (res.ag > res.hg) ac.mgr.wins++; else if (res.hg === res.ag) ac.mgr.draws++; else ac.mgr.losses++; }
    // cup & supercup winners news
    if (m.stage === 'F' && m.comp in CUPS) {
      const w = res.hg > res.ag ? hc : ac;
      if (!isUserM) news(G, 'Result', `${w.name} win the ${CUPS[m.comp].name}!`, '🏆');
    }
    if (m.comp in UEFA && m.stage === 'final') {
      const w = res.hg > res.ag ? hc : ac;
      if (!isUserM) news(G, 'Result', `${w.name} are ${UEFA[m.comp].name} champions!`, '🏆');
    }
  }
}

export function compLabel(m, G) {
  if (m.comp in LEAGUES) return LEAGUES[m.comp].name;
  if (m.comp in CUPS) return CUPS[m.comp].name;
  if (m.comp in UEFA) return UEFA[m.comp].name;
  if (m.comp === 'FRI') return 'Friendly';
  if (m.comp === 'NT') return 'International Friendly';
  if (m.comp.startsWith('TNT') && G && G.sched.nt.tourn) {
    const base = m.comp.replace(/-G\d+$/, '');
    const comp = G.sched.nt.tourn.comps.find(c => c.key === base);
    return comp ? comp.name : 'International';
  }
  return m.comp;
}

// ---------- daily updates ----------
function dailyPlayerUpdate(G) {
  for (const p of G.world.players.values()) {
    if (p.retired) continue;
    if (p.inj) { if (p.inj <= G.date) p.inj = null; }
    if (!p.clubId) continue; // free agents stay fit
    if (!p.inj) {
      p.fit = clamp(p.fit + 9, 20, 100);
      if (G.settings.toggles.training) {
        const shpGain = p.yth ? 4 : [1.2, 2.4, 3.6][p.plan.intensity] || 2.4;
        p.shp = clamp(p.shp + shpGain, 0, 100);
      }
    }
    p.mor = clamp(p.mor + (70 - p.mor) * 0.02, 0, 100);
    p.frm = clamp(p.frm - 0.02, 0, 10);
  }
}

function weeklyFinance(G) {
  const world = G.world;
  const userClub = world.clubs.get(G.user.clubId);
  for (const c of world.clubs.values()) {
    const inc = Math.round(weeklyRevenue(c) / 7);
    let wages = 0;
    for (const id of c.squad) {
      const p = world.players.get(id);
      if (p) wages += p.ctr.w / 7;
    }
    c.bal += inc - wages;
    if (c.id === G.user.clubId) c.pnl = (c.pnl || 0) + inc - wages;
  }
  // board financial alerts
  if (userClub.bal < -20e6) news(G, 'Board', `The board are alarmed: ${userClub.name} are ${fmtMoney(Math.abs(userClub.bal))} in debt!`, '⚠️');
}

function monthlyTick(G) {
  monthlyGrowth(G);
  if (G.user.clubId && G.settings.toggles.academy) youthIntake(G);
  boardReview(G);
  if (Math.random() < 0.06) unexpectedEvent(G);
  managerMarketTick(G);
}

// ---------- user match helpers ----------
export function startUserMatch(G) {
  const m = G.pendingMatch;
  if (!m) return null;
  return m;
}
export function simulateUserMatch(G, mode, overrides) {
  const m = G.pendingMatch;
  if (!m) return null;
  let res;
  const seed = matchSeed(m.id) ^ (Math.random() * 1e9 | 0);
  if (mode === 'instant') {
    res = quickSim(m, G.world, seed);
  } else {
    res = (G.fullSimCache && G.fullSimCache[m.id]) || quickSim(m, G.world, seed);
  }
  applyMatchResult(G, m, res);
  return res;
}

// ---------- season flow ----------
export function anyFutureMatches(G) {
  for (const [date, arr] of G.cal) {
    if (date <= G.date) continue;
    for (const m of arr) if (!G.results[m.id]) return true;
  }
  return false;
}

export function processDay(G) {
  const date = G.date;
  dailyPlayerUpdate(G);

  // transfer window events
  const openDays = [`${G.year}-07-01`, `${G.year}-09-01`, `${G.year + 1}-01-01`, `${G.year + 1}-02-01`];
  const isDeadline = date === `${G.year}-08-31` || date === `${G.year + 1}-01-31`;
  if (openDays.includes(date) && !G.flags[`win${date}`]) {
    G.flags[`win${date}`] = true;
    const opening = date.endsWith('-07-01') || date.endsWith('-01-01');
    news(G, 'Board', opening ? 'The transfer window is now OPEN.' : 'The transfer window has CLOSED.', '💼');
    G.stopPoint = 'window';
  }
  if (G.settings.toggles.transfers && inTransferWindow(G) && Number(date.slice(8)) % 2 === 0) transferAI(G, isDeadline ? 3 : 1);
  if (isDeadline) { transferAI(G, 2); deadlineDigest(G); }

  // scouting
  if (!G.lastScoutDay || date >= addDays(G.lastScoutDay, 3)) {
    G.lastScoutDay = date;
    if (G.user.clubId) scoutReports(G);
  }

  if (dow(date) === 1) weeklyFinance(G);
  if (date.slice(8) === '01') monthlyTick(G);

  ntWindowTick(G);
  if (date === `${G.year + 1}-06-05` && tournamentYear(G.year + 1) && !G.sched.nt.tourn) {
    scheduleTournament(G, G.year + 1);
    G.stopPoint = 'tournament';
  }

  // matches: find user match, sim the rest in the background
  const arr = G.cal.get(date) || [];
  const userM = arr.find(m => !m.note && !G.results[m.id] && isUserMatch(G, m));
  for (const m of arr) {
    if (G.results[m.id] || m.note || m === userM) continue;
    if (m.nt) {
      m.pseudoH = ntPseudo(G, m.tnat.h);
      m.pseudoA = ntPseudo(G, m.tnat.a);
    }
    const res = quickSim(m, G.world, matchSeed(m.id));
    applyMatchResult(G, m, res);
  }

  // cup / europe progression
  for (const cupId of Object.keys(CUPS)) if (CUPS[cupId].type === 'cup') cupRoundDone(G, cupId);
  for (const comp of ['SDE', 'SCI']) superCupAdvance(G, comp);
  for (const compId of ['UCL', 'UEL', 'UCL2']) {
    const key = compId === 'UCL' ? 'ucl' : compId === 'UEL' ? 'uel' : 'uecl';
    const st = G.sched.euro[key];
    if (!st) continue;
    if (st.state === 'lp' && lpDone(G, compId)) {
      const r = tableSorted(G, compId);
      news(G, 'Result', `League phase complete in the ${UEFA[compId].name}. Knockout rounds set.`, '⚽');
      euroKnockoutDraw(G, compId);
    } else if (st.state === 'ko' && euroRoundDone(G, compId)) {
      euroRoundAdvance(G, compId);
    }
  }
  tournamentTick(G);

  if (userM) {
    G.pendingMatch = userM;
    return 'match';
  }

  // season end
  if (date >= `${G.year + 1}-07-01` && !anyFutureMatches(G)) {
    G.seasonOver = 'rollover';
    return 'rollover';
  }
  if (date >= `${G.year + 1}-05-31` && !anyFutureMatches(G) && !G.sched.nt.tourn) {
    G.seasonOver = 'awards';
    return G.flags.seasonEndShown ? 'ok' : 'seasonend';
  }
  return 'ok';
}
export function advanceOne(G) {
  G.date = addDays(G.date, 1);
  return processDay(G);
}
export function advanceUntil(G, stopFns) {
  let guard = 0;
  let r = 'ok';
  while (guard++ < 500) {
    G.date = addDays(G.date, 1);
    r = processDay(G);
    if (r === 'match') return 'match';
    if (r === 'seasonend') return 'seasonend';
    if (r === 'rollover') return 'rollover';
    if (G.stopPoint) { const sp = G.stopPoint; G.stopPoint = null; return sp; }
  }
  return r;
}
