// ============ FCM 26 — player growth & youth intake ============
import { clamp, hashStr, RNG } from '../util.js';
import { derivedAtts } from '../data/worldgen.js';
import { genYouth, makePlayer, genName, TOP_NATS } from '../data/worldgen.js';

export function monthlyGrowth(G) {
  const month = G.date.slice(0, 7);
  for (const p of G.world.players.values()) {
    if (p.retired || !p.clubId) continue;
    const age = p.age;
    const eff = p.ovr + p.gr;
    let delta;
    if (age >= 32) {
      delta = -(0.012 + (age - 32) * 0.018) * (eff > 72 ? 1 : 0.35);
    } else {
      const gap = p.pot - eff;
      const af = age <= 19 ? 0.055 : age <= 23 ? 0.042 : age <= 26 ? 0.024 : age <= 29 ? 0.012 : 0.005;
      delta = clamp(gap, 0, 25) * af;
      const apps = p.mapps || 0;
      if (apps >= 3) delta *= 1.35; else if (apps === 0) delta *= 0.45;
      if (p.mor > 75) delta *= 1.15; else if (p.mor < 50) delta *= 0.8;
      delta *= [0.8, 1.0, 1.25][clamp(p.plan.intensity || 1, 0, 2)];
      if (p.yth) delta *= 1.7;
      if (p.inj) delta *= 0.5;
      delta *= 0.85 + ((hashStr(p.id + month) % 100) / 100) * 0.3;
    }
    p.mapps = 0;
    p.gr = Math.round((p.gr + delta) * 100) / 100;
    p.ovr = Math.round((p.ovr + delta) * 100) / 100;
    if (p.ovr + p.gr > p.pot && age < 32) { /* cap */ }
  }
}

export function youthIntake(G) {
  const club = G.world.clubs.get(G.user.clubId);
  if (!club) return;
  const rng = new RNG(hashStr(G.date + 'intake'));
  const n = rng.intRange(2, 4);
  const scouts = club.scouts.length ? club.scouts : [{ quality: 2, judge: 2 }];
  const bestQ = Math.max(...scouts.map(s => s.quality));
  const intake = [];
  for (let i = 0; i < n; i++) {
    const p = genYouth(club, G.seq + i + 1000, rng);
    p.id = 'y' + (G.seq++);
    p.created = true;
    p.name = genName(rng.chance(0.75) ? club.ctry : TOP_NATS[rng.int(TOP_NATS.length)], rng);
    // scout quality boosts potential
    const boost = bestQ >= 4 ? rng.intRange(1, 6) : bestQ >= 3 ? rng.intRange(0, 3) : 0;
    p.pot = clamp(p.pot + boost, p.ovr + 5, 94);
    G.world.players.set(p.id, p);
    club.youth.push(p.id);
    intake.push(p);
  }
  const gem = intake.find(p => p.pot >= 85);
  const G2 = G;
  const news = G2.news; // keep reference style consistent
  news.unshift({ d: G.date, cat: 'Youth', icon: '🎓', read: false, t: gem
    ? `Academy intake at ${club.name} — coaches are buzzing about ${gem.name} (${gem.pos}, ${gem.age})!`
    : `Academy intake at ${club.name}: ${n} new scholars signed.` });
  if (news.length > 260) news.length = 260;
}

export function promoteYouth(G, pid) {
  const club = G.world.clubs.get(G.user.clubId);
  const p = G.world.players.get(pid);
  if (!club || !p || !club.youth.includes(pid)) return false;
  if (p.age < 16) return false;
  club.youth = club.youth.filter(id => id !== pid);
  club.squad.push(pid);
  p.yth = false;
  p.ctr = { y: 3, w: 1.5, r: 0, role: 3 };
  return true;
}
