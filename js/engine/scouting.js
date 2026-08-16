// ============ FCM 26 — scouting ============
import { clamp, hashStr, RNG } from '../util.js';
import { playerValue } from './market.js';

export function knownOf(G, pid) {
  const p = G.world.players.get(pid);
  if (!p) return null;
  if (p.ovr >= 84) return { ovr: [p.ovr, p.ovr], pot: [p.pot, p.pot], exact: true };
  return G.known[pid] || null;
}

export function scoutReports(G) {
  const club = G.world.clubs.get(G.user.clubId);
  if (!club) return;
  const rng = new RNG(hashStr(G.date + 'scout'));
  for (const s of club.scouts) {
    if (!s.assignment) continue;
    const a = s.assignment;
    const cands = [];
    for (const p of G.world.players.values()) {
      if (p.retired || p.age > 35 || p.age < 16) continue;
      if (p.clubId === G.user.clubId) continue;
      if (a.pos && a.pos !== 'ALL') {
        if (!(p.pos === a.pos || p.pos.endsWith(a.pos) || (a.pos.length === 1 && p.pos.startsWith(a.pos)))) continue;
      }
      if (p.age < a.ageMin || p.age > a.ageMax) continue;
      const k = knownOf(G, p.id);
      const ovrEst = k ? (k.ovr[0] + k.ovr[1]) / 2 : p.ovr;
      const potEst = k ? (k.pot[0] + k.pot[1]) / 2 : p.pot;
      if (a.ovrMin && ovrEst < a.ovrMin) continue;
      if (a.potMin && potEst < a.potMin) continue;
      if (a.maxVal) {
        if (playerValue(p, G.world) > a.maxVal) continue;
      }
      if (a.region === 'HOME') { if (p.nat !== club.ctry) continue; }
      else if (a.region !== 'Worldwide') { if (p.nat !== a.region) continue; }
      cands.push(p);
    }
    if (!cands.length) continue;
    const n = rng.intRange(2, 5);
    for (let i = 0; i < n; i++) {
      const p = cands[rng.int(cands.length)];
      const err = Math.max(1, Math.round((6 - s.judge) * 2.5));
      let k = G.known[p.id];
      if (!k) {
        k = G.known[p.id] = {
          ovr: [clamp(p.ovr - err - 4, 40, 99), clamp(p.ovr + err + 4, 40, 99)],
          pot: [clamp(p.pot - err - 5, 40, 99), clamp(p.pot + err + 5, 40, 99)],
          since: G.date,
        };
      } else {
        k.ovr = [clamp(Math.max(k.ovr[0], p.ovr - err), 40, 99), clamp(Math.min(k.ovr[1], p.ovr + err), 40, 99)];
        k.pot = [clamp(Math.max(k.pot[0], p.pot - err), 40, 99), clamp(Math.min(k.pot[1], p.pot + err), 40, 99)];
        k.since = G.date;
      }
      G.scoutReports.unshift({ pid: p.id, scout: s.id, d: G.date, ovr: k.ovr.slice(), pot: k.pot.slice(), val: Math.round(playerValue(p, G.world) * 100) / 100 });
      if (G.scoutReports.length > 300) G.scoutReports.length = 300;
    }
  }
  if (Object.keys(G.known).length > 2500) {
    // prune oldest
    const entries = Object.entries(G.known).sort((a, b) => (a[1].since < b[1].since ? -1 : 1));
    for (const [pid] of entries.slice(0, 500)) delete G.known[pid];
  }
}

export const SCOUT_POSITIONS = ['ALL', 'GK', 'D', 'M', 'A', 'ST', 'CB', 'CDM', 'CM', 'CAM', 'RW', 'LW'];
export function posMatches(posCode, pos) {
  if (!posCode || posCode === 'ALL') return true;
  if (posCode.length === 1) {
    const grp = pos === 'GK' ? 'GK' : ['RB', 'RWB', 'CB', 'LB', 'LWB'].includes(pos) ? 'D' : ['CDM', 'CM', 'CAM', 'RM', 'RW', 'LM', 'LW'].includes(pos) ? 'M' : 'A';
    return grp === posCode;
  }
  return pos === posCode;
}
