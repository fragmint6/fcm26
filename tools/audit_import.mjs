// ============ FCM 26 — import parity audit ============
// Boots a real newGame world, then diffs it against js/data/import_bundle.js:
//   1. every bundle player must exist in the world (matched by database pid)
//   2. every (non-youth) world player must come from the bundle
//   3. reports generated leftovers, missing rows, nat coverage, club coverage
// Run:  node tools/audit_import.mjs [--verbose]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { newGame } from '../js/state.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERBOSE = process.argv.includes('--verbose');

// load bundle
const src = readFileSync(join(ROOT, 'js/data/import_bundle.js'), 'utf8');
const players = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
console.log(`bundle: ${players.length} players`);

const t0 = Date.now();
const G = await newGame({ managerName: 'Audit', managerNat: 'ENG', clubId: 'ARS', startDate: '2026-08-01' });
console.log(`world built in ${Date.now() - t0} ms — clubs: ${G.world.clubs.size}, players: ${G.world.players.size}, free agents: ${G.world.freeAgents.length}`);

// index world players by database pid
const byPid = new Map();
let imported = 0, generated = 0;
const genInSquads = [];
for (const p of G.world.players.values()) {
  if (p.imported) { imported++; if (p.profile && p.profile.photoId) byPid.set(p.profile.photoId, p); }
  else {
    generated++;
    genInSquads.push(p);
  }
}
console.log(`world players: imported ${imported} · generated ${generated}`);

// 1) bundle → world coverage
const missing = [];
for (const b of players) {
  if (b.pid) { if (!byPid.has(b.pid)) missing.push(b); }
  else {
    // no pid rows: fall back to name+club match
    const hit = [...G.world.players.values()].some(p => p.imported && p.profile && p.profile.fullname === b.name);
    if (!hit) missing.push(b);
  }
}
console.log(`\n[1] bundle players MISSING from world: ${missing.length}`);
const byLg = {};
for (const m of missing) byLg[m.league || '(no league)'] = (byLg[m.league || '(no league)'] || 0) + 1;
console.log('    by league:', JSON.stringify(byLg, null, 0));
for (const m of missing.slice(0, VERBOSE ? missing.length : 15)) console.log(`    - ${m.shortname || m.name} · ${m.club || '(free agent)'} · ${m.league || '-'}`);

// 2) generated leftovers
const genNotRetired = genInSquads.filter(p => !p.retired);
console.log(`\n[2] generated (non-database) players in world: ${generated} (${genNotRetired.length} active)`);
const genClubs = {};
for (const p of genNotRetired) { const c = p.clubId || 'FA'; genClubs[c] = (genClubs[c] || 0) + 1; }
console.log(`    spread over ${Object.keys(genClubs).length} clubs. sample:`);
for (const p of genNotRetired.slice(0, VERBOSE ? 40 : 10)) console.log(`    - ${p.name} · ${p.pos} · ovr ${p.ovr} · club ${p.clubId}`);

// 3) nationality coverage of imported players
let natEmpty = 0;
for (const b of players) if (!b.nat) natEmpty++;
let worldNatEmpty = 0;
for (const p of G.world.players.values()) if (p.imported && !p.nat) worldNatEmpty++;
console.log(`\n[3] nat field empty — bundle rows: ${natEmpty}, world imported players: ${worldNatEmpty}`);

// 4) clubs with thin squads
const thin = [];
for (const c of G.world.clubs.values()) if (c.squad.length < 16) thin.push(c);
console.log(`\n[4] clubs with <16 players: ${thin.length}`);
for (const c of thin.slice(0, 20)) console.log(`    - ${c.name} (${c.league}): ${c.squad.length}`);

// 5) spot checks
for (const q of ['talisca', 'haaland', 'bellingham', 'yamal', 'pedri', 'grimaldo']) {
  const hits = [...G.world.players.values()].filter(p => p.name.toLowerCase().includes(q) || (p.profile.fullname || '').toLowerCase().includes(q));
  console.log(`\nsearch "${q}": ${hits.length} hit(s)` + hits.slice(0, 4).map(p => `\n    ✓ ${p.name} · ${p.pos} · ovr ${p.ovr} · nat ${p.nat} · ${p.clubId ? G.world.clubs.get(p.clubId).name : 'FREE AGENT'}`).join(''));
}

// 6) generated breakdown: youth vs senior vs filler
let genYth = 0, genFill = 0, genOther = 0;
for (const p of G.world.players.values()) {
  if (p.imported) continue;
  if (p.yth) genYth++; else if (p.filler) genFill++; else genOther++;
}
console.log(`\n[6] generated breakdown: youth ${genYth} · filler ${genFill} · OTHER (must be 0) ${genOther}`);

// 7) failed nationality resolution (bundle side)
import { NAT_NAME } from '../js/util.js';
const natNames = new Set(Object.values(NAT_NAME).map(n => n.toLowerCase()));
const badNat = new Map();
for (const b of players) {
  if (!b.nat) { badNat.set('(empty)', (badNat.get('(empty)') || 0) + 1); continue; }
}
for (const p of G.world.players.values()) {
  if (p.imported && !p.nat) {
    const b = players.find(x => x.pid === (p.profile && p.profile.photoId));
    const k = b ? b.nat : '?';
    badNat.set(k, (badNat.get(k) || 0) + 1);
  }
}
console.log(`[7] imported players with unresolved nat: ${[...badNat.entries()].slice(0, 15).map(([k, v]) => `${k}:${v}`).join(' ')}`);

// 8) league integrity: club counts + duplicate-name collisions within a league
import { LEAGUES } from '../js/data/clubs.js';
const byLeague = new Map();
for (const c of G.world.clubs.values()) { if (!byLeague.has(c.league)) byLeague.set(c.league, []); byLeague.get(c.league).push(c); }
const dupes = [];
for (const [lid, clubs] of byLeague) {
  const seen = new Map();
  for (const c of clubs) {
    const k1 = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(k1) && seen.get(k1) !== c) dupes.push(`${lid}: "${seen.get(k1).name}"(${seen.get(k1).id}) vs "${c.name}"(${c.id})`);
    else seen.set(k1, c);
  }
}
console.log(`[8] leagues: ${byLeague.size} · club-count sample: ` + ['EPL', 'CHP', 'LAL', 'SEA', 'BUN', 'LI1', 'SPL', 'BPL', 'UPL', 'CHN1', 'IND1', 'SUP', 'SEA', 'ECU1', 'SUL', 'LIP'].map(l => `${l}:${(byLeague.get(l) || []).length}`).join(' '));
console.log(`    same-league duplicate club names: ${dupes.length}` + (dupes.length ? '\n    ' + dupes.slice(0, 20).join('\n    ') : ''));
// filler clubs
const fillerClubs = [...G.world.clubs.values()].filter(c => c.squad.some(id => { const p = G.world.players.get(id); return p && p.filler && !p.imported; }));
console.log(`    clubs with filler players: ${fillerClubs.length} —`, fillerClubs.slice(0, 12).map(c => c.name).join(', '));
