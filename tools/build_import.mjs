// ============ FCM 26 — EAFC DB import builder (multi-file) ============
// Reads EVERY .csv under uploads/ (e.g. all your page exports from CM Tracker),
// merges & dedupes by database player id, emits js/data/import_bundle.js,
// caches all headshots locally and writes uploads/import_report.txt.
// Run:  node tools/build_import.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { CLUBS } from '../js/data/clubs.js';
import { norm } from '../js/util.js';
import { convertEaRow, convertGenericRow, convertGenericObject, CLUB_ALIASES, clubNorm } from '../js/engine/import.js';
import { LEAGUE_MAP_BY_NAME } from '../js/engine/worldextend.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const UPLOADS = join(ROOT, 'uploads');
const OUT_BUNDLE = join(ROOT, 'js/data/import_bundle.js');
const OUT_FACES = join(ROOT, 'assets/faces');
const REPORT = join(UPLOADS, 'import_report.txt');

function listDataFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listDataFiles(p));
    else if (e.toLowerCase().endsWith('.csv') || e.toLowerCase().endsWith('.json')) out.push(p);
  }
  return out.sort();
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows = [];
  let headers = null;
  for (const line of lines) {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { cells.push(cur.trim()); cur = ''; }
        else cur += c;
      }
    }
    cells.push(cur.trim());
    if (!headers) headers = cells;
    else {
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      rows.push(row);
    }
  }
  return rows;
}

const num = v => { const n = parseFloat(String(v).replace(/[€,\s]/g, '')); return Number.isFinite(n) ? Math.round(n) : null; };

// ---------- static club resolution (no game world needed) ----------
const clubIdx = new Map();
for (const c of CLUBS) {
  clubIdx.set(norm(c[1]), c[0]);
  clubIdx.set(norm(c[2]), c[0]);
}
function resolveClubStatic(clubName, slug) {
  if (clubName) {
    const n = norm(clubName);
    if (clubIdx.has(n)) return clubIdx.get(n);
    if (CLUB_ALIASES[n] && clubIdx.has(norm(CLUB_ALIASES[n]))) return clubIdx.get(norm(CLUB_ALIASES[n]));
  }
  if (slug) {
    const s = norm(slug);
    for (const [key, id] of clubIdx) if (s.includes(key) || key.includes(s)) return id;
  }
  return null;
}

// ---------- read, merge, dedupe ----------
const files = listDataFiles(UPLOADS);
let totalRows = 0, skippedRows = 0, dupes = 0;
const merged = new Map(); // key -> { data, ta }
for (const file of files) {
  const isJson = file.toLowerCase().endsWith('.json');
  let items;
  if (isJson) {
    try {
      let arr = JSON.parse(readFileSync(file, 'utf8'));
      if (!Array.isArray(arr)) arr = arr.players || arr.data || arr.rows || [];
      items = [];
      for (const obj of arr) {
        const data = ('attributes.acceleration' in obj) ? convertEaRow(obj) : convertGenericObject(obj);
        if (data) items.push({ data, ta: num(obj['info.total_attributes']) || 0 });
        else skippedRows++;
      }
    } catch (e) { console.log('  skipped unreadable JSON', file, e.message); continue; }
  } else {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const isEa = lines[0] && lines[0].toLowerCase().startsWith('"attributes.acceleration"');
    const rows = parseCSV(text); // whole-text parse → header-mapped objects
    items = [];
    for (const row of rows) {
      totalRows++;
      const data = isEa ? convertEaRow(row) : convertGenericObject(row);
      if (data) items.push({ data, ta: isEa ? (num(row['info.total_attributes']) || 0) : 0 });
      else skippedRows++;
    }
  }
  let okRows = 0;
  for (const { data, ta } of items) {
    okRows++;
    const key = data.pid ? 'p' + data.pid : norm(data.name) + '|' + data.pos;
    const existing = merged.get(key);
    if (existing) {
      dupes++;
      if (ta > existing.ta) merged.set(key, { data, ta });
    } else merged.set(key, { data, ta });
  }
  console.log(`read ${file.replace(ROOT, '.')}: ${okRows} players`);
}
const players = [...merged.values()].map(x => x.data);

// ---------- headshots ----------
// Only cache locally with --cache (a full database export is thousands of files —
// otherwise the game hotlinks the photo URLs from the data itself, which works fine).
const CACHE = process.argv.includes('--cache');
const matched = players.filter(p => (p.league && LEAGUE_MAP_BY_NAME[p.league]) || p.fa);
const photoQueue = (CACHE ? matched : []).filter(p => p.photoUrl && p.photoId);
if (CACHE) {
  mkdirSync(OUT_FACES, { recursive: true });
  const queue = photoQueue.map(p => ({ id: p.photoId, url: p.photoUrl, name: p.name }));
  let dl = 0, skip = 0, fail = 0;
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const file = join(OUT_FACES, 'p' + item.id + '.png');
      if (existsSync(file)) { skip++; continue; }
      try {
        const res = await fetch(item.url);
        if (!res.ok) { console.log('  headshot fail', res.status, item.name); fail++; continue; }
        writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        dl++;
        if ((dl + skip) % 50 === 0) console.log(`  headshots: ${dl + skip} …`);
      } catch (e) { fail++; }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`headshots: ${dl} downloaded, ${skip} already cached, ${fail} failed`);
} else {
  const withPhotos = matched.filter(p => p.photoUrl && p.photoId).length;
  console.log(`headshot caching skipped (${withPhotos} players have photo URLs — loaded live in-game). Use --cache to download them locally.`);
}

// ---------- bundle ----------
const bundleSrc = `// AUTO-GENERATED by tools/build_import.mjs from CSVs in uploads/ — do not edit.\n// ${players.length} players. Rebuild: node tools/build_import.mjs\nexport const IMPORT_BUNDLE = ${JSON.stringify(players)};\n`;
writeFileSync(OUT_BUNDLE, bundleSrc);
console.log('bundle written:', Math.round(bundleSrc.length / 1024), 'KB');

// ---------- report ----------
const unmatched = players.filter(p => !(p.league && LEAGUE_MAP_BY_NAME[p.league]) && !p.fa);
const lines = [
  'FCM 26 — IMPORT BUILD REPORT',
  `Built: ${new Date().toISOString()} · Files: ${files.length} · Rows: ${totalRows} · Unique players: ${players.length} · Duplicates dropped: ${dupes} · Skipped rows: ${skippedRows}`,
  `League mapped: ${matched.length}/${players.length}  (players whose league exists or is created in the game)`,
  '',
  'Players with unmapped leagues (ignored):',
  ...unmatched.slice(0, 120).map(p => `  - ${p.name} — ${p.club || '(none)'}`),
  unmatched.length > 120 ? `  … and ${unmatched.length - 120} more` : '',
  '',
  'Tips: add those clubs to js/data/clubs.js, or paste the CSVs in-game (Settings → Import player data)',
  'Add those leagues to js/engine/worldextend.js (LEAGUE_MAP_BY_NAME) to include them.',
].join('\n');
writeFileSync(REPORT, lines);
console.log('report:', REPORT.replace(ROOT, '.'));
console.log('DONE — start a NEW CAREER to see the imported data.');
