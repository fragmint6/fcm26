// Consolidates image-search/ downloads into assets/badges/<clubId>.<ext>
// Picks were curated from search result titles (modern official crests preferred).
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(ROOT, 'uploads/badge_manifest.json'), 'utf8'));
const byName = new Map(manifest.map(c => [c.name.toLowerCase(), c.id]));

// club name (as in manifest) → chosen image-search file
const PICKS = {
  'arsenal': 'arsenal-fc-crest-logo-png-1.webp', // clean modern crest (replaces watermarked promo mockup)
  'manchester city': 'manchester-city-fc-logo-png-2.png',
  'liverpool': 'liverpool-fc-logo-png-2.png',
  // 'chelsea': pending re-query
  'tottenham hotspur': 'tottenham-hotspur-logo-png-1.png',
  'manchester united': 'manchester-united-logo-png-2.png',
  'newcastle united': 'newcastle-united-logo-png-2.png',
  'aston villa': 'aston-villa-logo-png-2.png',
  'west ham united': 'west-ham-united-logo-png-1.png',
  'crystal palace': 'crystal-palace-fc-logo-png-1.png',
  'nottingham forest': 'nottingham-forest-logo-png-2.png',
  'everton': 'everton-fc-logo-png-1.png',
  'fulham': 'fulham-fc-logo-png-1.png',
  'brentford': 'brentford-fc-logo-png-1.png',
  'afc bournemouth': 'afc-bournemouth-logo-png-1.jpg',
  'leeds united': 'leeds-united-logo-png-1.png',
  'burnley': 'burnley-fc-logo-png-1.png',
  'sunderland': 'sunderland-afc-logo-png-1.png',
  'brighton & hove albion': 'brighton-hove-albion-logo-png-1.png',
  'real madrid': 'real-madrid-cf-logo-png-2.png',
  'fc barcelona': 'fc-barcelona-logo-png-1.webp',
  'atlético de madrid': 'atletico-madrid-logo-png-1.png',
  'real sociedad': 'real-sociedad-logo-png-1.png',
  'real betis': 'real-betis-logo-png-1.png',
  'athletic club': 'athletic-club-bilbao-logo-png-1.png',
  'deportivo alavés': 'deportivo-alaves-logo-png-1.png',
  'real valladolid': 'real-valladolid-logo-png-1.png',
  'rayo vallecano': 'rayo-vallecano-logo-png-1.png',
  'inter milan': 'inter-milan-logo-png-2.png',
  'ac milan': 'ac-milan-logo-png-1.png',
  'napoli': 'ssc-napoli-logo-png-1.png',
  'juventus': 'juventus-fc-logo-png-2.png',
  'lazio': 'ss-lazio-logo-png-1.png',
  'atalanta': 'atalanta-bc-logo-png-1.png',
  'fiorentina': 'acf-fiorentina-logo-png-1.png',
  'bologna': 'bologna-fc-logo-png-1.png',
  'torino': 'torino-fc-logo-png-1.png',
  'genoa': 'genoa-cfc-logo-png-1.webp',
  'lecce': 'us-lecce-logo-png-1.png',
  'udinese': 'udinese-calcio-logo-png-1.png',
  'parma': 'parma-calcio-logo-png-1.png',
  'cagliari': 'cagliari-calcio-logo-png-1.png',
  'hellas verona': 'hellas-verona-logo-png-1.jpg',
  'sassuolo': 'us-sassuolo-logo-png-1.png',
  'pisa': 'pisa-sc-logo-png-1.png',
  'cremonese': 'us-cremonese-logo-png-1.png',
  'bayern munich': 'bayern-munich-logo-png-1.png',
  'borussia dortmund': 'borussia-dortmund-logo-png-1.png',
  'bayer leverkusen': 'bayer-leverkusen-logo-png-1.png',
};

// optional extra mapping layer defined externally (later rounds append here)
const EXTRA = join(ROOT, 'uploads/badge_picks_extra.json');
if (existsSync(EXTRA)) Object.assign(PICKS, JSON.parse(readFileSync(EXTRA, 'utf8')));

const SRC = join(ROOT, 'image-search');
const DST = join(ROOT, 'assets/badges');
let ok = 0;
const missing = [];
for (const [name, file] of Object.entries(PICKS)) {
  const id = byName.get(name.toLowerCase());
  if (!id) { missing.push(`NO-CLUB ${name}`); continue; }
  const src = join(SRC, file);
  if (!existsSync(src)) { missing.push(`NO-FILE ${name} → ${file}`); continue; }
  const ext = file.split('.').pop();
  copyFileSync(src, join(DST, id + '.' + ext));
  ok++;
}
console.log(`badges applied: ${ok}`);
if (missing.length) console.log('misses:\n' + missing.join('\n'));
