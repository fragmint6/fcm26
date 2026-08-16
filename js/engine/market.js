// ============ FCM 26 — transfer market, values, wages, contracts ============
import { clamp, RNG, hashStr, addDays, fmtMoney } from '../util.js';

const LEAGUE_REP = { EPL: 1.15, LAL: 1.1, SEA: 1.05, BUN: 1.05, LI1: 1.0, CHP: 0.8, LA2: 0.75, SEB: 0.75, BU2: 0.75, LI2: 0.7, ERE: 0.7, LIP: 0.72, SUL: 0.7, BPL: 0.65, SCP: 0.62, AUB: 0.6, SUP: 0.6, DSU: 0.6, GSU: 0.6, CFL: 0.58, UPL: 0.55, ELI: 0.52, ALL: 0.52, EKS: 0.55, HNL: 0.55, SRL: 0.52, LS1: 0.5, SPL: 0.68 };
export function leagueFactor(leagueId) { return LEAGUE_REP[leagueId] || 0.5; }

// € millions value
export function playerValue(p, world) {
  if (p.marketValue) return p.marketValue; // real value from imported database
  const base = 0.45 * Math.pow(2.5, (p.ovr + (p.gr || 0) - 65) / 5);
  let v = base;
  if (p.pot >= p.ovr + 8) v *= 1.35; else if (p.pot >= p.ovr + 4) v *= 1.15; else if (p.pot < p.ovr) v *= 0.9;
  if (p.age <= 20) v *= 1.35; else if (p.age <= 23) v *= 1.2; else if (p.age <= 26) v *= 1.05;
  else if (p.age >= 31) v *= 0.7; else if (p.age >= 29) v *= 0.85; else if (p.age >= 33) v *= 0.55;
  const yrs = (p.ctr && p.ctr.y) || 1;
  v *= 0.7 + 0.1 * clamp(yrs, 0, 5);
  const club = world && p.clubId ? world.clubs.get(p.clubId) : null;
  v *= leagueFactor(club ? club.league : null);
  return Math.round(v * 100000) / 100000;
}

// €k/week wage demand — calibrated to real-world football wages
export function wageAsk(p, roleIdx = 1) {
  const eff = p.ovr + (p.gr || 0);
  let w = 2.2 * Math.pow(2.6, (eff - 60) / 5); // 60→2.2k · 70→15k · 75→39k · 80→101k · 85→263k · 88→464k · 90→678k
  if (eff >= 89) w *= 1.25;
  if (p.age >= 26 && p.age <= 30) w *= 1.2;
  if (p.age <= 21) w *= 0.75;
  if (p.age >= 32) w *= 0.7;
  w *= 0.85 + (roleIdx || 1) * 0.15;
  return Math.round(w * 100) / 100;
}

export function initialContract(p, clubRep, rng) {
  const roleIdx = rng ? rng.int(4) : 1;
  const y = 1 + (rng ? rng.intRange(0, 4) : 2);
  let w = wageAsk(p, roleIdx) * (0.55 + clubRep / 130);
  w = Math.round(w * 100) / 100;
  const release = (rng ? rng.chance(0.5) : false) ? Math.round(playerValue(p, null) * 1.4 * 100) / 100 : 0;
  return { y, w, r: release, role: roleIdx };
}

export function askPrice(p, world) {
  const club = p.clubId ? world.clubs.get(p.clubId) : null;
  if (!club) return playerValue(p, world);
  let mult = 1;
  const squad = (club.squad || []).map(id => world.players.get(id)).filter(Boolean);
  const better = squad.filter(x => x.pos === p.pos && x.ovr >= p.ovr).length;
  if (better === 0) mult += 0.35;
  else if (better === 1) mult += 0.15;
  if (p.age <= 21) mult += 0.25;
  if (p.age <= 23) mult += 0.1;
  if (club.rep > 88) mult += 0.2;
  else if (club.rep < 68) mult -= 0.2;
  if ((p.ctr?.y || 0) <= 1) mult -= 0.25;
  mult = clamp(mult, 0.35, 2.4);
  return Math.max(0.05, Math.round(playerValue(p, world) * mult * 100) / 100);
}

export function acceptanceChance(p, world, offer, fromClub) {
  const curClub = p.clubId ? world.clubs.get(p.clubId) : null;
  const curRep = curClub ? curClub.rep : 55;
  const newRep = fromClub.rep;
  const ask = wageAsk(p, offer.role ?? 1);
  let s = 0.5;
  s += (offer.w - ask) / (ask * 2);
  s += (newRep - curRep) / 120;
  s += (offer.role ?? 1) * 0.05;
  if (curClub && curClub.id === fromClub.id) s += 0.3;
  if (!curClub) s += 0.1;
  if (p.wantOut) s += 0.2;
  return clamp(s, 0.02, 0.98);
}

export function totalWages(world, club) {
  let t = 0;
  for (const id of club.squad) { const p = world.players.get(id); if (p) t += p.ctr.w; }
  return t;
}

function depthOf(world, club) {
  const groups = { GK: [], D: [], M: [], A: [] };
  for (const id of club.squad) {
    const p = world.players.get(id);
    if (!p || p.loan) continue;
    const g = p.pos === 'GK' ? 'GK' : ['RB', 'RWB', 'CB', 'LB', 'LWB'].includes(p.pos) ? 'D' : ['CDM', 'CM', 'CAM', 'RM', 'RW', 'LM', 'LW'].includes(p.pos) ? 'M' : 'A';
    groups[g].push(p);
  }
  return groups;
}
const NEED_MIN = { GK: 2, D: 7, M: 7, A: 4 };
const SURPLUS_AT = { GK: 3, D: 9, M: 9, A: 6 };

// ---------- transfer execution ----------
export function transferPlayer(G, p, fromId, toId, feeM, contract, loanInfo) {
  const world = G.world;
  const from = fromId ? world.clubs.get(fromId) : null;
  const to = toId ? world.clubs.get(toId) : null;
  if (from) {
    from.squad = from.squad.filter(id => id !== p.id);
    from.bal = Math.round(from.bal + feeM * 1e6);
    from.sold = (from.sold || 0) + feeM * 1e6;
  }
  if (to) {
    to.squad.push(p.id);
    to.bal = Math.round(to.bal - feeM * 1e6);
    to.bought = (to.bought || 0) + feeM * 1e6;
  }
  p.clubId = toId;
  if (loanInfo) p.loan = { from: fromId, end: loanInfo.end };
  else { p.loan = null; p.ctr = contract || p.ctr; }
  p.wantOut = false;
  p.mor = 72; p.frm = 5;
}

// ---------- AI transfer market ----------
export function transferAI(G, intensity = 1) {
  const rng = new RNG(hashStr(G.date + 'ai' + (G.tai || 0)));
  G.tai = (G.tai || 0) + 1;
  const world = G.world;
  const clubs = [...world.clubs.values()].filter(c => c.id !== G.user.clubId);
  const attempts = Math.min(clubs.length, Math.round(clubs.length * 0.16 * intensity));
  const shuffled = rng.shuffle(clubs);
  G.dealsToday = 0;
  // cache squad depth per club (scanned repeatedly during candidate search)
  const depthCache = new Map();
  const depth = c => { let d = depthCache.get(c.id); if (!d) depthCache.set(c.id, d = depthOf(world, c)); return d; };
  for (let i = 0; i < attempts; i++) {
    const club = shuffled[i % shuffled.length];
    if (!club || club.bal < 0) continue;
    const d = depth(club);
    const roll = rng.next();
    if (roll < 0.45) tryBuy(G, club, d, depth, rng, intensity);
    else if (roll < 0.62) tryLoanOut(G, club, d, rng);
    else if (roll < 0.85) tryFreeAgent(G, club, d, rng);
    else trySellToListed(G, club, d, rng);
  }
  userOffersTick(G, rng, intensity);
}

function tryBuy(G, club, depth, depthFn, rng) {
  const world = G.world;
  const need = Object.keys(NEED_MIN).find(g => depth[g].length < NEED_MIN[g]) || (rng.chance(0.3) ? ['D', 'M', 'A', 'GK'][rng.int(4)] : null);
  if (!need) return;
  const tbM = club.tb / 1e6;
  const cands = [];
  for (const c of world.clubs.values()) {
    if (c.id === club.id || c.id === G.user.clubId) continue;
    const dep = depthFn(c);
    if (dep[need].length < NEED_MIN[need] + 1) continue;
    if (c.rep > club.rep + 6) continue;
    for (const p of dep[need]) {
      if (p.age < 17 || p.age > 31) continue;
      const val = playerValue(p, world);
      if (val > tbM * 0.65) continue;
      cands.push({ p, from: c, val });
    }
  }
  if (!cands.length) return;
  const pick = rng.pick(cands.slice(0, 40));
  const fee = Math.round(pick.val * (0.85 + rng.next() * 0.5) * 100) / 100;
  if (fee * 1e6 > club.tb) return;
  const wage = Math.round(wageAsk(pick.p, 1) * (1 + rng.next() * 0.35) * 100) / 100;
  const slack = club.wb - totalWages(world, club);
  if (wage > slack + 20) return;
  if (acceptanceChance(pick.p, world, { w: wage, role: 1 }, club) < 0.4) return;
  transferPlayer(G, pick.p, pick.from.id, club.id, fee, { y: 3 + rng.int(2), w: wage, r: 0, role: 1 });
  G.dealsToday++;
  if ((fee >= 25 || pick.p.ovr >= 83) && G.dealsToday <= 10) {
    G.news.unshift({ d: G.date, cat: 'Transfers', icon: '💼', read: false, t: `${club.name} sign ${pick.p.name} from ${pick.from.name} for ${fmtMoney(fee * 1e6)}` });
  }
}

function tryLoanOut(G, club, depth, rng) {
  const world = G.world;
  const surplusGroup = Object.keys(SURPLUS_AT).find(g => depth[g].length > SURPLUS_AT[g]);
  if (!surplusGroup) return;
  const young = depth[surplusGroup].filter(p => p.age <= 22 && !p.loan);
  if (!young.length) return;
  const p = young[rng.int(young.length)];
  const targets = [...world.clubs.values()].filter(c => c.id !== club.id && c.rep < club.rep - 8 && c.rep >= 50 && c.tb > 0.5e6 && c.squad.length < 24);
  if (!targets.length) return;
  const t = targets[rng.int(targets.length)];
  const end = `${G.year + 1}-07-01`;
  transferPlayer(G, p, club.id, t.id, 0, null, { from: club.id, end });
  G.dealsToday++;
  if (p.ovr >= 76) G.news.unshift({ d: G.date, cat: 'Transfers', icon: '🔄', read: false, t: `${p.name} joins ${t.name} on a season-long loan from ${club.name}` });
}

function tryFreeAgent(G, club, depth, rng) {
  const world = G.world;
  const need = Object.keys(NEED_MIN).find(g => depth[g].length < NEED_MIN[g]);
  if (!need) return;
  const groupOf = p => p.pos === 'GK' ? 'GK' : ['RB', 'RWB', 'CB', 'LB', 'LWB'].includes(p.pos) ? 'D' : ['CDM', 'CM', 'CAM', 'RM', 'RW', 'LM', 'LW'].includes(p.pos) ? 'M' : 'A';
  const fas = world.freeAgents.map(id => world.players.get(id)).filter(p => p && !p.retired && groupOf(p) === need && p.ovr <= club.rep * 0.8 + 8 && p.ovr >= club.rep * 0.55);
  if (!fas.length) return;
  const p = fas[rng.int(fas.length)];
  const wage = Math.round(wageAsk(p, 2) * (1 + rng.next() * 0.2) * 100) / 100;
  const slack = club.wb - totalWages(world, club);
  if (wage > slack + 10) return;
  if (acceptanceChance(p, world, { w: wage, role: 2 }, club) < 0.4) return;
  world.freeAgents = world.freeAgents.filter(id => id !== p.id);
  transferPlayer(G, p, null, club.id, 0, { y: 2 + rng.int(2), w: wage, r: 0, role: 2 });
  G.dealsToday++;
}

function trySellToListed(G, club, depth, rng) {
  const world = G.world;
  const surplusGroup = Object.keys(SURPLUS_AT).find(g => depth[g].length > SURPLUS_AT[g]);
  if (!surplusGroup) return;
  const candidates = [...world.clubs.values()].filter(c => c.id !== club.id && c.rep >= club.rep - 2 && c.rep <= club.rep + 6);
  if (!candidates.length) return;
  const buyer = candidates[rng.int(candidates.length)];
  const p = depth[surplusGroup][rng.int(depth[surplusGroup].length)];
  const val = playerValue(p, world);
  if (val * 1e6 > buyer.tb * 0.6) return;
  const fee = Math.round(val * (0.8 + rng.next() * 0.4) * 100) / 100;
  const wage = Math.round(wageAsk(p, 2) * (1 + rng.next() * 0.25) * 100) / 100;
  if (acceptanceChance(p, world, { w: wage, role: 2 }, buyer) < 0.4) return;
  transferPlayer(G, p, club.id, buyer.id, fee, { y: 3 + rng.int(2), w: wage, r: 0, role: 2 });
  G.dealsToday++;
}

// AI interest in user-listed players
function userOffersTick(G, rng, intensity) {
  const world = G.world;
  const list = G.userListings || {};
  const uclub = world.clubs.get(G.user.clubId);
  if (!uclub) return;
  for (const [pid, listing] of Object.entries(list)) {
    const p = world.players.get(pid);
    if (!p || p.clubId !== G.user.clubId || p.loan) continue;
    const existing = G.offers.filter(o => o.pid === pid && !o.responded);
    if (existing.length >= 3 || rng.chance(0.55)) continue;
    const val = playerValue(p, world);
    const candidates = [...world.clubs.values()].filter(c => c.id !== G.user.clubId && c.rep >= uclub.rep - 10 && c.bal > 2e6);
    if (!candidates.length) continue;
    const c = candidates[rng.int(candidates.length)];
    G.offSeq = (G.offSeq || 0) + 1;
    if (listing.type === 'sell') {
      const base = listing.price ? Math.min(listing.price, val * 1.6) : val;
      const fee = Math.round(base * (0.72 + rng.next() * 0.3) * 100) / 100;
      if (fee * 1e6 > c.tb * 0.8) continue;
      G.offers.push({ id: 'of' + G.offSeq, pid, from: c.id, fee, maxFee: Math.round(base * (1.05 + rng.next() * 0.25) * 100) / 100, type: 'buy', wage: Math.round(wageAsk(p, 1) * 100) / 100, role: 1 + rng.int(2), d: G.date, until: addDays(G.date, 12), responded: false });
    } else {
      G.offers.push({ id: 'of' + G.offSeq, pid, from: c.id, type: 'loan', wageShare: 30 + rng.int(41), d: G.date, until: addDays(G.date, 12), responded: false });
    }
    G.news.unshift({ d: G.date, cat: 'Transfers', icon: '📨', read: false, t: `${c.name} have made a ${listing.type === 'sell' ? 'bid' : 'loan approach'} for ${p.name}. Check the transfer hub.` });
  }
}

export function deadlineDigest(G) {
  const n = G.dealsToday || 0;
  if (n > 0) G.news.unshift({ d: G.date, cat: 'Transfers', icon: '⏳', read: false, t: `Deadline Day: ${n} deal${n > 1 ? 's' : ''} completed across the football world.` });
}

// ---------- user-facing negotiations ----------
export function aiSellResponse(G, pid, fee) {
  const p = G.world.players.get(pid);
  if (!p || !p.clubId) return { status: 'reject', msg: 'Player unavailable.' };
  const ask = askPrice(p, G.world);
  if (fee >= ask * 0.92) return { status: 'accept', fee };
  if (fee < ask * 0.55) return { status: 'reject', counter: Math.round(ask * 0.9 * 100) / 100, msg: 'The club rejected the bid outright.' };
  return { status: 'counter', counter: Math.round((ask * 0.85 + fee * 0.3) * 100) / 100, msg: 'The club have countered your offer.' };
}

export function playerContractResponse(G, pid, offer, fromClubId) {
  const p = G.world.players.get(pid);
  const from = G.world.clubs.get(fromClubId);
  if (!p || !from) return { status: 'reject', msg: 'Unavailable.' };
  const chance = acceptanceChance(p, G.world, offer, from);
  const rng = new RNG(hashStr(pid + G.date + offer.w + offer.y));
  if (rng.chance(chance)) return { status: 'accept' };
  const ask = wageAsk(p, offer.role ?? 1);
  if (offer.w < ask) return { status: 'counter', counter: { ...offer, w: Math.round(ask * 105) / 100 }, msg: `${p.name} is holding out for higher wages.` };
  if ((offer.role ?? 1) < 1) return { status: 'counter', counter: { ...offer, role: 1 }, msg: `${p.name} wants a more important squad role.` };
  return { status: 'reject', msg: `${p.name} is not convinced by the project.` };
}

export function executeUserBuy(G, pid, fee, contract) {
  const p = G.world.players.get(pid);
  if (!p || !p.clubId) return { ok: false, msg: 'Player unavailable.' };
  const fromId = p.clubId;
  const uclub = G.world.clubs.get(G.user.clubId);
  if (fee * 1e6 > uclub.tb) return { ok: false, msg: 'You cannot afford this transfer fee.' };
  const slack = uclub.wb - totalWages(G.world, uclub);
  if (contract.w > slack + 5) return { ok: false, msg: 'Wage budget exceeded.' };
  const from = G.world.clubs.get(fromId);
  transferPlayer(G, p, fromId, G.user.clubId, fee, contract);
  G.news.unshift({ d: G.date, cat: 'Transfers', icon: '✅', read: false, t: `${uclub.name} complete the signing of ${p.name} from ${from.name} for ${fmtMoney(fee * 1e6)}` });
  // objectives: brand
  const brand = uclub.objectives && uclub.objectives.find(o => o.id === 'brand');
  if (brand && p.ovr >= 85) brand.count = (brand.count || 0) + 1;
  return { ok: true };
}

export function executeUserLoanIn(G, pid, wageShare) {
  const p = G.world.players.get(pid);
  if (!p || !p.clubId) return { ok: false, msg: 'Player unavailable.' };
  const fromId = p.clubId;
  const uclub = G.world.clubs.get(G.user.clubId);
  const wageCost = p.ctr.w * wageShare / 100;
  const slack = uclub.wb - totalWages(G.world, uclub);
  if (wageCost > slack + 2) return { ok: false, msg: 'Wage budget exceeded.' };
  const from = G.world.clubs.get(fromId);
  transferPlayer(G, p, fromId, G.user.clubId, 0, null, { from: fromId, end: `${G.year + 1}-07-01` });
  G.news.unshift({ d: G.date, cat: 'Transfers', icon: '✅', read: false, t: `${uclub.name} sign ${p.name} on loan from ${from.name} (${wageShare}% wages).` });
  return { ok: true };
}

export function respondOffer(G, offerId, action, counterFee) {
  const o = G.offers.find(x => x.id === offerId);
  if (!o || o.responded) return { ok: false };
  const p = G.world.players.get(o.pid);
  const from = G.world.clubs.get(o.from);
  const uclub = G.world.clubs.get(G.user.clubId);
  if (!p || !from) return { ok: false };
  if (action === 'accept') {
    if (o.type === 'buy') {
      transferPlayer(G, p, G.user.clubId, o.from, o.fee, { y: 3, w: o.wage, r: 0, role: o.role });
      G.news.unshift({ d: G.date, cat: 'Transfers', icon: '💸', read: false, t: `${p.name} leaves ${uclub.name} for ${from.name} (${fmtMoney(o.fee * 1e6)})` });
    } else {
      transferPlayer(G, p, G.user.clubId, o.from, 0, null, { from: G.user.clubId, end: `${G.year + 1}-07-01` });
      G.news.unshift({ d: G.date, cat: 'Transfers', icon: '🔄', read: false, t: `${p.name} joins ${from.name} on loan from ${uclub.name}.` });
    }
    delete (G.userListings || {})[o.pid];
    o.responded = true;
    return { ok: true };
  }
  if (action === 'counter') {
    if (counterFee <= o.maxFee) {
      o.fee = counterFee;
      transferPlayer(G, p, G.user.clubId, o.from, counterFee, { y: 3, w: o.wage, r: 0, role: o.role });
      G.news.unshift({ d: G.date, cat: 'Transfers', icon: '💸', read: false, t: `${from.name} agree improved terms for ${p.name} (${fmtMoney(counterFee * 1e6)})` });
      delete (G.userListings || {})[o.pid];
      o.responded = true;
      return { ok: true };
    }
    return { ok: false, msg: `${from.name} are unwilling to raise their bid that high.` };
  }
  o.responded = true;
  p.mor = clamp(p.mor - 4, 0, 100);
  return { ok: true };
}

export function listPlayer(G, pid, type, price) {
  const p = G.world.players.get(pid);
  if (!p) return;
  G.userListings = G.userListings || {};
  G.userListings[pid] = { type, price: price || null, d: G.date };
  G.news.unshift({ d: G.date, cat: 'Transfers', icon: '📋', read: false, t: type === 'sell' ? `${p.name} has been transfer-listed${price ? ` (asking ${fmtMoney(price * 1e6)})` : ''}.` : `${p.name} has been made available for loan.` });
}
export function unlistPlayer(G, pid) {
  if (G.userListings) delete G.userListings[pid];
}

export function releasePlayer(G, pid) {
  const p = G.world.players.get(pid);
  const uclub = G.world.clubs.get(G.user.clubId);
  if (!p || !uclub) return;
  const cost = Math.round(p.ctr.w * p.ctr.y * 52 * 0.5); // severance
  uclub.squad = uclub.squad.filter(id => id !== pid);
  uclub.bal -= cost;
  p.clubId = null;
  p.ctr = { y: 1, w: 0, r: 0, role: 2 };
  G.world.freeAgents.push(p.id);
  G.news.unshift({ d: G.date, cat: 'Transfers', icon: '👋', read: false, t: `${p.name} has been released by ${uclub.name}.` });
}

export function renewContract(G, pid, contract) {
  const p = G.world.players.get(pid);
  const uclub = G.world.clubs.get(G.user.clubId);
  if (!p || !uclub) return { ok: false, msg: 'Unavailable.' };
  const slack = uclub.wb - totalWages(G.world, uclub);
  if (contract.w > slack + p.ctr.w + 5) return { ok: false, msg: 'Wage budget exceeded.' };
  const resp = playerContractResponse(G, pid, contract, G.user.clubId);
  if (resp.status === 'accept') {
    p.ctr = { y: contract.y, w: contract.w, r: contract.r || 0, role: contract.role ?? 1 };
    p.mor = clamp(p.mor + 8, 0, 100);
    G.news.unshift({ d: G.date, cat: 'Contracts', icon: '✍️', read: false, t: `${p.name} signs a new ${contract.y}-year deal with ${uclub.name}.` });
    return { ok: true };
  }
  return { ok: false, counter: resp.counter, msg: resp.msg };
}
