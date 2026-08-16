// ============ FCM 26 — external data importer ============
// Two formats supported:
//   1. Generic CSV (see assets/template.csv) — headers or headerless, flexible column names.
//   2. EAFC database exports (CM Tracker style, 117 columns: attributes.*, card_attrs.*, info.*)
//      — every substat, contract, traits and headshot URL is applied.
import { clamp, hashStr, RNG, NAT_NAME, norm } from '../util.js';
import { derivedAtts, faceStatsFromDet, ovrFromStats, SUBSTAT_GROUPS, GK_SUBSTAT_GROUPS, assignRole, makePlayer } from '../data/worldgen.js';

// header aliases → internal keys (generic format)
const COL_KEYS = {
  name: 'name', player: 'name',
  club: 'club', team: 'club', clubid: 'club', club_id: 'club',
  pos: 'pos', position: 'pos',
  age: 'age', nat: 'nat', nationality: 'nat', nation: 'nat',
  ovr: 'ovr', overall: 'ovr', rating: 'ovr',
  pot: 'pot', potential: 'pot',
  pac: 'pac', pace: 'pac', sho: 'sho', shooting: 'sho', pas: 'pas', passing: 'pas',
  dri: 'dri', dribbling: 'dri', def: 'def', defending: 'def', phy: 'phy', physical: 'phy',
  spe: 'spe', sprint: 'spe', sprintspeed: 'spe', sprint_speed: 'spe', acc: 'acc', acceleration: 'acc',
  fin: 'fin', finishing: 'fin', lon: 'lon', longshots: 'lon', long_shots: 'lon', lonshots: 'lon',
  pos: 'pos', positioning: 'posAttr', attackpositioning: 'posAttr', pen: 'pen', penalties: 'pen',
  spow: 'spow', shotpower: 'spow', shot_power: 'spow', vol: 'vol', volleys: 'vol',
  vis: 'vis', vision: 'vis', cro: 'cro', crossing: 'cro', fka: 'fka', freekick: 'fka', freekicks: 'fka',
  freekickaccuracy: 'fka', freekickacc: 'fka', free_kick_accuracy: 'fka', spa: 'spa', shortpassing: 'spa', short_passing: 'spa',
  lpa: 'lpa', longpassing: 'lpa', long_passing: 'lpa', cur: 'cur', curve: 'cur',
  agi: 'agi', agility: 'agi', bal: 'bal', balance: 'bal', rea: 'rea', reactions: 'rea',
  bac: 'bac', ballcontrol: 'bac', ball_control: 'bac', com: 'com', composure: 'com',
  int: 'int', interceptions: 'int', hei: 'hei', heading: 'hei', headingaccuracy: 'hei', heading_accuracy: 'hei',
  mar: 'mar', marking: 'mar', tac: 'tac', standingtackle: 'tac', standing_tackle: 'tac',
  slt: 'slt', slidingtackle: 'slt', sliding_tackle: 'slt',
  jum: 'jum', jumping: 'jum', sta: 'sta', stamina: 'sta', str: 'str', strength: 'str', agg: 'agg', aggression: 'agg',
  div: 'div', gkdiving: 'div', gk_diving: 'div', diving: 'div', han: 'han', gkhandling: 'han', gk_handling: 'han', handling: 'han',
  kic: 'kic', gkkicking: 'kic', gk_kicking: 'kic', kicking: 'kic', ref: 'ref', gkreflexes: 'ref', gk_reflexes: 'ref', reflexes: 'ref',
  spd: 'spd', gkspeed: 'spd', gk_speed: 'spd', gkpos: 'gkpos', gkpositioning: 'gkpos', gk_positioning: 'gkpos',
  // SoFIFA/Kaggle-style extras
  overallrating: 'ovr', defawareness: 'awa', def_awareness: 'awa', dribbling2: 'bac',
  longname: 'name', fullname: 'name', knownas: 'name', playerpositions: 'positions', positions: 'positions',
  shortname: 'shortname', valueeur: 'value', value_eur: 'value',
  wageeur: 'wage', wage_eur: 'wage', releaseclauseeur: 'release', release_clause_eur: 'release',
  heightcm: 'height', height_cm: 'height', weightkg: 'weight', weight_kg: 'weight',
  clubjerseynumber: 'shirt', club_jersey_number: 'shirt', jerseynumber: 'shirt', jersey_number: 'shirt',
  playerfaceurl: 'url', player_face_url: 'url', faceurl: 'url',
  clubcontractvaliduntilyear: 'endyear', club_contract_valid_until_year: 'endyear', contractendyear: 'endyear',
  clubposition: 'clubposition', club_position: 'clubposition',
  leaguelevel: 'leaguelevel', league_level: 'leaguelevel', leaguename: 'league', league_name: 'league',
  clubname: 'club', club_name: 'club', teamname: 'club',
  playerid: 'pid', player_id: 'pid', id: 'pid',
  // per-position ratings (SoFIFA ls..gk)
  ls: 'ls', st: 'st', rs: 'rs', lw: 'lw', lf: 'lf', cf: 'cf', rf: 'rf', rw: 'rw',
  lam: 'lam', cam: 'cam', ram: 'ram', lm: 'lm', lcm: 'lcm', cm: 'cm', rcm: 'rcm', rm: 'rm',
  lwb: 'lwb', ldm: 'ldm', cdm: 'cdm', rdm: 'rdm', rwb: 'rwb', lb: 'lb', lcb: 'lcb', cb: 'cb', rcb: 'rcb', rb: 'rb', gk: 'gk',
};
// profile / meta columns (generic datasets)
const PROFILE_KEYS = {
  weakfoot: 'wf', weak_foot: 'wf', skillmoves: 'sm', skill_moves: 'sm', preferredfoot: 'foot', preferred_foot: 'foot',
  height: 'height', weight: 'weight', jerseynumber: 'shirt', jersey_number: 'shirt',
  traits: 'traits', playstyle: 'traits', playstyles: 'traits', play_style: 'traits', playertraits: 'traits',
  alternativepositions: 'alt', alternative_positions: 'alt', otherpositions: 'alt',
  url: 'url', headshot: 'url', releaseclause: 'release', release_clause: 'release',
  wage: 'wage', wageeur: 'wage', wage_eur: 'wage', contractend: 'enddate', contract_end: 'enddate', contractenddate: 'enddate',
  gender: 'gender', sex: 'gender', league: 'league', rank: 'rank', card: 'card', team: 'club',
  workrate: 'workrate', work_rate: 'workrate', bodytype: 'bodytype', body_type: 'bodytype',
  playertags: 'tags', player_tags: 'tags', realface: 'realface', real_face: 'realface',
  internationalreputation: 'intlrep', international_reputation: 'intlrep',
};
// SoFIFA position codes → canonical
const SOPOS = { LS: 'ST', RS: 'ST', LF: 'CF', RF: 'CF', LAM: 'CAM', RAM: 'CAM', LCM: 'CM', RCM: 'CM', LDM: 'CDM', RDM: 'CDM', LCB: 'CB', RCB: 'CB' };
const WOMEN_LEAGUE_RE = /women|wsl|nwsl|feminin|femeni|frauen|arkema|a-league w/i;
const VALID_POS = new Set(['GK', 'RB', 'RWB', 'CB', 'LB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'RW', 'LM', 'LW', 'CF', 'ST', 'RCB', 'LCB', 'RST', 'LST']);
const HEADERLESS_ORDER = ['name', 'club', 'pos', 'age', 'nat', 'ovr', 'pot', 'pac', 'sho', 'pas', 'dri', 'def', 'phy',
  'spe', 'acc', 'fin', 'lon', 'posAttr', 'pen', 'spow', 'vol', 'vis', 'cro', 'fka', 'spa', 'lpa', 'cur',
  'agi', 'bal', 'rea', 'bac', 'com', 'int', 'hei', 'mar', 'tac', 'slt', 'jum', 'sta', 'str', 'agg',
  'div', 'han', 'kic', 'ref', 'spd', 'gkpos'];

const num = v => { const n = parseFloat(String(v).replace(/[€,\s]/g, '')); return Number.isFinite(n) ? Math.round(n) : null; };

// ---------- generic row converter (SoFIFA / Kaggle / template schemas) ----------
export function convertGenericRow(header, cells) {
  const row = {};
  header.forEach((h, i) => {
    if (h == null) return;
    const n = norm(h);
    const k = COL_KEYS[n] || PROFILE_KEYS[n] || null;
    if (k && !(k in row)) row[k] = String(cells[i] ?? '').trim();
  });
  return rowToData(row);
}
export function convertGenericObject(obj) {
  return convertGenericRow(Object.keys(obj), Object.values(obj).map(v => (v == null ? '' : String(v))));
}

function rowToData(row) {
  if (!row.name) return null;
  // women filter: explicit gender or women's league names
  if (row.gender && /^[fw]/i.test(String(row.gender))) return null;
  if (row.league && WOMEN_LEAGUE_RE.test(String(row.league))) return null;
  // position: explicit column, else "RW, ST, CAM" list, else best per-position rating
  let pos = row.pos ? String(row.pos).toUpperCase() : '';
  let rawAlt = String(row.alt || '');
  if (row.positions) {
    const parts = String(row.positions).split(/[+|,;]/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (parts.length) {
      pos = pos || parts[0];
      if (!rawAlt) rawAlt = parts.slice(1).join(',');
    }
  }
  if (!pos) {
    const PERPOS = ['ls', 'st', 'rs', 'lw', 'lf', 'cf', 'rf', 'rw', 'lam', 'cam', 'ram', 'lm', 'lcm', 'cm', 'rcm', 'rm', 'lwb', 'ldm', 'cdm', 'rdm', 'rwb', 'lb', 'lcb', 'cb', 'rcb', 'rb', 'gk'];
    let best = null, bestV = -1;
    for (const k of PERPOS) {
      const raw = row[k];
      if (!raw) continue;
      const v = parseInt(String(raw).split('+')[0], 10);
      if (Number.isFinite(v) && v > bestV) { bestV = v; best = k; }
    }
    if (best) pos = best.toUpperCase();
  }
  if (!pos) return null;
  pos = SOPOS[pos] || pos;
  if (!VALID_POS.has(pos)) return null;
  const SUB_KEYS = new Set([...SUBSTAT_GROUPS.flatMap(([, ks]) => ks), ...GK_SUBSTAT_GROUPS.flatMap(([, ks]) => ks)]);
  const det = {};
  for (const [key, val] of Object.entries(row)) {
    if (key === 'posAttr') { const n = num(val); if (n != null) det.pos = n; continue; }
    if (key === 'awa') { const n = num(val); if (n != null && det.int == null) det.int = n; continue; }
    if (!SUB_KEYS.has(key)) continue;
    const n = num(val);
    if (n != null) det[key] = n;
  }
  const alt = rawAlt.split(/[+|,;]/).map(s => SOPOS[s.trim().toUpperCase()] || s.trim().toUpperCase())
    .filter(s => VALID_POS.has(s) && s !== pos);
  const data = {
    name: String(row.name), club: row.club || '', pos, slug: '',
    alt: [...new Set(alt)],
    age: num(row.age), nat: row.nat || '',
    ovr: num(row.ovr), pot: num(row.pot),
    det,
  };
  let faceN = 0;
  for (const k of ['pac', 'sho', 'pas', 'dri', 'def', 'phy']) {
    const n = num(row[k]);
    if (n != null) { data[k] = n; faceN++; }
  }
  if (faceN > 0 && faceN < 6) {
    const comp = faceStatsFromDet(det, pos);
    for (const k of ['pac', 'sho', 'pas', 'dri', 'def', 'phy']) if (data[k] == null) data[k] = comp[k];
  }
  if (row.shortname) data.shortname = String(row.shortname);
  if (row.foot) data.foot = String(row.foot);
  if (num(row.sm) != null) data.sm = num(row.sm);
  if (num(row.wf) != null) data.wf = num(row.wf);
  if (num(row.height) != null) data.height = num(row.height);
  if (num(row.weight) != null) data.weight = num(row.weight);
  if (num(row.shirt) != null) data.shirt = num(row.shirt);
  const traitsBits = [row.traits, row.tags].filter(t => t && String(t).trim());
  if (row.workrate && String(row.workrate).trim()) traitsBits.unshift('Work rate: ' + String(row.workrate).trim());
  if (traitsBits.length) data.traits = traitsBits.join(' · ');
  if (row.realface) data.realface = /^y/i.test(String(row.realface));
  if (row.url && /\.(png|jpe?g|webp)(\?|$)/i.test(String(row.url))) data.photoUrl = String(row.url);
  if (num(row.wage) != null) data.wage = num(row.wage);
  if (num(row.release) != null) data.release = num(row.release);
  if (num(row.value) != null && num(row.value) > 0) data.value = num(row.value);
  if (row.endyear && num(row.endyear) != null && num(row.endyear) >= 2026) data.enddate = num(row.endyear) + '-07-01';
  if (row.enddate) data.enddate = String(row.enddate).slice(0, 10);
  if (row.pid && num(row.pid) != null) { data.pid = num(row.pid); data.photoId = data.pid; }
  // squad role from club_position (ST/SUB/RES)
  if (row.clubposition) {
    const cp = String(row.clubposition).trim().toUpperCase();
    if (cp === 'SUB') data.role = 1;
    else if (cp === 'RES') data.role = 3;
    else data.role = 0;
  }
  // no club at all → free agent
  if (row.league) data.league = String(row.league);
  if (!data.club || !String(data.club).trim()) data.fa = true;
  return data;
}

// ---------- generic CSV parsing ----------
function parseCSVLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',' || c === ';' || c === '\t') { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

export function importPlayers(G, text) {
  const report = { updated: 0, created: 0, skipped: [], total: 0 };
  const trimmed = String(text).trim();
  if (!trimmed) return { ...report, error: 'No data found.' };
  // JSON paste?
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      let arr = JSON.parse(trimmed);
      if (!Array.isArray(arr)) arr = arr.players || arr.data || arr.rows || [];
      for (const obj of arr) {
        report.total++;
        const data = ('attributes.acceleration' in obj) ? convertEaRow(obj) : convertGenericObject(obj);
        if (!data) { report.skipped.push(obj['info.name.knownas'] || obj.name || 'row'); continue; }
        const r = applyImportedPlayer(G, data, { allowFA: true });
        if (r === 'updated') report.updated++;
        else if (r === 'created') report.created++;
        else report.skipped.push(data.name + ' (' + r + ')');
      }
    } catch (e) { return { ...report, error: 'JSON parse failed: ' + e.message }; }
    return report;
  }
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  // EAFC DB format?
  if (lines[0].toLowerCase().startsWith('"attributes.acceleration"')) {
    const rows = [];
    let headers = null;
    for (const line of lines) {
      const cells = parseCSVLine(line);
      if (!headers) headers = cells;
      else {
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
        rows.push(row);
      }
    }
    for (const row of rows) {
      const data = convertEaRow(row);
      if (!data) { report.skipped.push(row['info.name.knownas'] || 'row'); continue; }
      report.total++;
      const r = applyImportedPlayer(G, data, { allowFA: true });
      if (r === 'updated') report.updated++;
      else if (r === 'created') report.created++;
      else { report.skipped.push(data.name + ' (' + r + ')'); }
    }
    return report;
  }
  // generic format
  return importGeneric(G, lines, report);
}

function importGeneric(G, lines, report) {
  let headers = null;
  const first = parseCSVLine(lines[0]);
  if (first.some(c => norm(c) === 'name' || norm(c) === 'knownas') && !first.some(c => /^\d+$/.test(c))) {
    headers = first;
    lines.shift();
  }
  for (const line of lines) {
    const cells = parseCSVLine(line);
    if (cells.length < 3 || !cells[0]) { report.skipped.push(line.slice(0, 50)); continue; }
    report.total++;
    let data;
    if (headers) data = convertGenericRow(headers, cells);
    else {
      const row = {};
      HEADERLESS_ORDER.forEach((k, i) => { if (k && !(k in row)) row[k] = cells[i] ?? ''; });
      data = rowToData(row);
    }
    if (!data) { report.skipped.push(cells[0] || 'row'); continue; }
    const r = applyImportedPlayer(G, data, { allowFA: true });
    if (r === 'updated') report.updated++;
    else if (r === 'created') report.created++;
    else report.skipped.push(data.name + ' (' + r + ')');
  }
  return report;
}

// ---------- EAFC DB format ----------
export function convertEaRow(a) {
  const name = (a['info.name.knownas'] || (a['info.name.firstname'] + ' ' + a['info.name.lastname'])).trim();
  const pos = String(a.primary_position || '').toUpperCase();
  if (!name || !VALID_POS.has(pos)) return null;
  const out = {
    name, club: a['info.teams.club_team.name'] || '', slug: a.slug || '', pos,
    pid: num(a['info.playerid']),
    alt: (a.other_positions || '-').split('|').map(s => s.trim()).filter(s => s && s !== '-'),
    age: num(a['info.age']), nat: a['info.nation.name'] || '',
    ovr: num(a['info.overallrating']), pot: num(a['info.potential']),
    pac: num(a['card_attrs.pac']), sho: num(a['card_attrs.sho']), pas: num(a['card_attrs.pas']),
    dri: num(a['card_attrs.dri']), def: num(a['card_attrs.def']), phy: num(a['card_attrs.phy']),
    det: {
      acc: num(a['attributes.acceleration']), spe: num(a['attributes.sprintspeed']), agi: num(a['attributes.agility']),
      bal: num(a['attributes.balance']), jum: num(a['attributes.jumping']), sta: num(a['attributes.stamina']),
      str: num(a['attributes.strength']), rea: num(a['attributes.reactions']), agg: num(a['attributes.aggression']),
      com: num(a['attributes.composure']), int: num(a['attributes.interceptions']), pos: num(a['attributes.positioning']),
      vis: num(a['attributes.vision']), bac: num(a['attributes.ballcontrol']), cro: num(a['attributes.crossing']),
      fin: num(a['attributes.finishing']), fka: num(a['attributes.freekickaccuracy']), hei: num(a['attributes.headingaccuracy']),
      lpa: num(a['attributes.longpassing']), spa: num(a['attributes.shortpassing']), mar: num(a['attributes.marking']),
      spow: num(a['attributes.shotpower']), lon: num(a['attributes.longshots']), tac: num(a['attributes.standingtackle']),
      slt: num(a['attributes.slidingtackle']), vol: num(a['attributes.volleys']), cur: num(a['attributes.curve']),
      pen: num(a['attributes.penalties']),
      div: num(a['attributes.gkdiving']), han: num(a['attributes.gkhandling']), kic: num(a['attributes.gkkicking']),
      ref: num(a['attributes.gkreflexes']), gkpos: num(a['attributes.gkpositioning']),
    },
    photoUrl: a['info.headshot'] || '',
    photoId: num(a['info.playerid']),
    foot: a['info.preferredfoot'] || '',
    sm: num(a['info.skillmoves']), wf: num(a['info.weafoot']),
    height: num(a['info.height']), weight: num(a['info.weight']),
    traits: [a['info.traits.trait1'], a['info.traits.trait2']].filter(Boolean).join(', '),
    shirt: num(a['info.teams.club_team.jerseynumber']),
    wage: num(a['info.wageEUR']), release: num(a['info.release_clause']),
    enddate: a['info.contract.enddate'] || '',
    realface: (a['info.real_face'] || '').toLowerCase() === 'yes',
  };
  Object.keys(out.det).forEach(k => { if (out.det[k] == null) delete out.det[k]; });
  if (out.pac == null && out.sho == null) { out.pac = null; out.sho = null; out.pas = null; out.dri = null; out.def = null; out.phy = null; }
  return out;
}

// ---------- club & player matching ----------
export const CLUB_ALIASES = {
  'bayernmunchen': 'Bayern Munich', 'bayernmunich': 'Bayern Munich',
  'bayer04leverkusen': 'Bayer Leverkusen', 'bayerleverkusen': 'Bayer Leverkusen',
  'atleticomadrid': 'Atlético de Madrid', 'atleticodemadrid': 'Atlético de Madrid',
  '1fckoln': 'FC Köln', 'fckoln': 'FC Köln', 'koln': 'FC Köln',
  'borussiamonchengladbach': 'Borussia Mönchengladbach', 'monchengladbach': 'Borussia Mönchengladbach',
  'realmadrid': 'Real Madrid', 'fcbarcelona': 'FC Barcelona', 'manchestercity': 'Manchester City',
  'parissaintgermain': 'Paris Saint-Germain', 'manchesterunited': 'Manchester United',
  'intermilan': 'Inter Milan', 'acmilan': 'AC Milan',
  'fckobenhavn': 'FC København', 'fckopenhagen': 'FC København',
  'bayerleverkusen04': 'Bayer Leverkusen', 'leverkusen': 'Bayer Leverkusen',
  'newcastleunited': 'Newcastle United', 'tottenhamhotspur': 'Tottenham Hotspur',
  'westhamunited': 'West Ham United', 'nottinghamforest': 'Nottingham Forest',
  'wolverhamptonwanderers': 'Wolverhampton Wanderers', 'afcbournemouth': 'AFC Bournemouth',
  'crystalpalacefc': 'Crystal Palace', 'brightonhovealbion': 'Brighton & Hove Albion',
  'brightonandhovealbion': 'Brighton & Hove Albion',
  'redbullsalzburg': 'RB Salzburg', 'fcredbullsalzburg': 'RB Salzburg',
  'lask': 'LASK Linz', 'bscyoungboys': 'Young Boys',
  'rapid': 'Rapid Wien',
};
const NAME_ALIASES = {
  'vinijr': 'Vinícius Júnior', 'vinijr.': 'Vinícius Júnior', 'viniciusjr': 'Vinícius Júnior', 'viniciusjunior': 'Vinícius Júnior',
  'gabriel': 'Gabriel Magalhães', 'gabrielmagalhaes': 'Gabriel Magalhães',
  'rodri': 'Rodri', 'khvichakvaratskhelia': 'Khvicha Kvaratskhelia',
  'kylianmbappe': 'Kylian Mbappé', 'kylianmbappelottin': 'Kylian Mbappé',
  'jamalmusiala': 'Jamal Musiala', 'florianwirtz': 'Florian Wirtz',
  'ousmanedembele': 'Ousmane Dembélé',
  'mohamedsalah': 'Mohamed Salah', 'harrykane': 'Harry Kane', 'erlinghaaland': 'Erling Haaland',
  'lamineyamal': 'Lamine Yamal', 'judebellingham': 'Jude Bellingham', 'pedri': 'Pedri',
  'raphinha': 'Raphinha', 'vitinha': 'Vitinha', 'joaoneves': 'João Neves',
  'nunomendes': 'Nuno Mendes', 'achrafhakimi': 'Achraf Hakimi',
  'willianpacho': 'Willian Pacho', 'williamsaliba': 'William Saliba',
  'thibautcourtois': 'Thibaut Courtois', 'gianluigidonnarumma': 'Gianluigi Donnarumma',
  'federicovalverde': 'Federico Valverde', 'michaelolise': 'Michael Olise',
  'joshuakimmich': 'Joshua Kimmich', 'moises': 'Moisés Caicedo', 'moisescaicedo': 'Moisés Caicedo',
  'cristianoronaldodossantosaveiro': 'Cristiano Ronaldo', 'cristianoronaldo': 'Cristiano Ronaldo',
  'lionelmessi': 'Lionel Messi', 'lionelandresmessicuccitini': 'Lionel Messi',
  'neymardasilvasantosjunior': 'Neymar', 'neymarjr': 'Neymar',
  'viniciusjosepaixaodeoliveirajunior': 'Vinícius Júnior',
  'karimmostafabenzema': 'Karim Benzema', 'rodrygogoes': 'Rodrygo', 'rodrygo': 'Rodrygo',
};

// club name normalization: strip common club affixes ("FC", "SK", "JK", "AFC", numbers…)
const CLUB_SUFFIXES = ['gymnastikforening', 'boldklub', 'athletic', 'association', 'wanderers', 'united', 'city', 'town', 'county', 'albion', 'rovers', 'rangers', 'athleticfc', 'afc', 'cfc', 'ffc', 'krc', 'rsc', 'rcd', 'rc', 'sv', 'cf', 'fc', 'sc', 'sk', 'jk', 'ac', 'as', 'ad', 'cd', 'ca', 'cs', 'sd', 'ss', 'ud', 'fk', 'ks', 'kv', 'dc', 'sf', 'hc', 'bc', 'bk', 'if', 'ifk', '1fc', 'vfl', 'tsg', 'tsv', 'spvgg', 'ssv', 'dfc', 'rbc', 'hsv', 'nkc', 'cfc'].sort((a, b) => b.length - a.length);
const CLUB_PREFIXES = ['fc', 'cf', 'afc', 'ac', 'as', '1fc', 'spvgg', 'tsv', 'tsg', 'sv', 'vfl', 'krc', 'rsc', 'rcd', 'ss', 'ad', 'ud', 'cd', 'cs', 'sd', 'fk', 'nk', 'dc', 'sc', 'sk', 'rb', 'ks', 'kv', 'ffc', 'hsv', 'ifk', 'if', 'bk', 'bc', 'hc', 'rbc', 'dfc', 'nkc', 'fsv', 'bsc', 'sg', 'ts', 'efc'].sort((a, b) => b.length - a.length);
export function clubNorm(name) {
  let s = norm(name);
  // strip leading digits & affixes
  let changed = true;
  while (changed && s.length > 4) {
    changed = false;
    if (/^\d/.test(s)) { s = s.replace(/^\d+/, ''); changed = true; continue; }
    for (const p of CLUB_PREFIXES) {
      if (s.startsWith(p) && s.length - p.length >= 4) { s = s.slice(p.length); changed = true; break; }
    }
  }
  // strip trailing digits & affixes
  changed = true;
  while (changed && s.length > 4) {
    changed = false;
    if (/\d$/.test(s)) { s = s.replace(/\d+$/, ''); changed = true; continue; }
    for (const suf of CLUB_SUFFIXES) {
      if (s.endsWith(suf) && s.length - suf.length >= 4) { s = s.slice(0, -suf.length); changed = true; break; }
    }
  }
  return s;
}

export function buildClubIndex(G) {
  const idx = {};
  for (const c of G.world.clubs.values()) {
    idx[norm(c.name)] = c.id;
    idx[norm(c.short)] = c.id;
    const stripped = clubNorm(c.name);
    if (stripped.length >= 3) idx[stripped] = c.id;
    if (!idx[norm(c.name)]) idx[norm(c.name)] = c.id;
  }
  return idx;
}

export function resolveClubId(G, clubName, slug, idx) {
  const idx2 = idx || buildClubIndex(G);
  if (!clubName && !slug) return null;
  const n = norm(clubName);
  if (n && idx2[n]) return idx2[n];
  if (n) {
    const stripped = clubNorm(clubName);
    if (stripped.length >= 4 && idx2[stripped]) return idx2[stripped];
    if (CLUB_ALIASES[n] && idx2[norm(CLUB_ALIASES[n])]) return idx2[norm(CLUB_ALIASES[n])];
    if (stripped.length >= 4 && CLUB_ALIASES[stripped] && idx2[norm(CLUB_ALIASES[stripped])]) return idx2[norm(CLUB_ALIASES[stripped])];
  }
  if (slug) {
    const s = norm(slug);
    for (const c of G.world.clubs.values()) {
      if (s.includes(norm(c.short)) || norm(c.short).includes(s)) return c.id;
    }
    for (const c of G.world.clubs.values()) {
      if (norm(c.name).includes(s)) return c.id;
    }
  }
  return null;
}

export function findPlayer(G, name, pos, clubName) {
  const n = norm(name);
  const targetName = NAME_ALIASES[n] || name;
  const tn = norm(targetName);
  const clubId = resolveClubId(G, clubName, null);
  const cands = [];
  for (const p of G.world.players.values()) {
    if (norm(p.name) === tn) {
      if (clubId && p.clubId !== clubId) continue;
      cands.push(p);
    }
  }
  if (cands.length === 1) return cands[0];
  if (cands.length > 1) {
    const byPos = cands.find(p => p.pos === pos);
    return byPos || cands[0];
  }
  // lastname fallback within the club
  const parts = tn.split(' ').filter(Boolean);
  if (clubId && parts.length >= 1) {
    const last = parts[parts.length - 1];
    let best = null, count = 0;
    for (const p of G.world.players.values()) {
      if (p.clubId !== clubId) continue;
      if (!norm(p.name).endsWith(last)) continue;
      best = p; count++;
    }
    if (count === 1 && best) return best;
  }
  return null;
}

// ---------- apply imported data to a player (create if missing) ----------
export function applyImportedPlayer(G, data, ctx) {
  const natISO = nationISO(G, data.nat);
  const clubId = resolveClubId(G, data.club, data.slug, ctx && ctx.clubIdx);
  const allowFA = !!(data.fa || (ctx && ctx.allowFA));
  let isNew = false;
  let p = (ctx && ctx.nameIndex) ? findPlayerIdx(G, data, clubId, ctx) : findPlayer(G, data.name, data.pos, data.club);
  if (!p) {
    if (!clubId && !allowFA) return 'no club in world';
    const rng = new RNG(hashStr('ea' + norm(data.name) + data.pos));
    const base = data.ovr || 60;
    const dispName = data.shortname || data.name;
    p = makePlayer({
      id: 'i' + hashStr(norm(data.name) + data.pos).toString(36), name: dispName, pos: data.pos,
      age: data.age || 23, nat: natISO, ovr: base, pot: data.pot || base + 2,
      pac: base, sho: base, pas: base, dri: base, def: base, phy: base,
      clubId, created: true, rng, skipRole: true,
    });
    if (data.shortname && data.shortname !== dispName) p.profile.fullname = data.name;
    G.world.players.set(p.id, p);
    if (clubId) G.world.clubs.get(clubId).squad.push(p.id);
    else G.world.freeAgents.push(p.id);
    p.imported = data.bundle ? 'bundle' : 'runtime';
    if (ctx && ctx.nameIndex) {
      for (const k of [norm(p.name), norm(data.name)]) {
        let arr = ctx.nameIndex.get(k);
        if (!arr) ctx.nameIndex.set(k, arr = []);
        if (!arr.includes(p)) arr.push(p);
      }
    }
    isNew = true;
  }
  // move club if needed
  if (clubId && p.clubId !== clubId) {
    const old = p.clubId ? G.world.clubs.get(p.clubId) : null;
    if (old) old.squad = old.squad.filter(id => id !== p.id);
    G.world.clubs.get(clubId).squad.push(p.id);
    p.clubId = clubId;
    p.loan = null;
  }
  // primary position (real DB data) + secondary positions
  if (data.pos && VALID_POS.has(data.pos)) p.pos = data.pos;
  // stats
  if (data.ovr != null) p.baseOvr = data.ovr;
  if (data.pot != null) p.pot = clamp(data.pot, p.baseOvr, 99); else if (p.pot < p.baseOvr) p.pot = p.baseOvr;
  p.ovr = p.baseOvr; p.gr = 0;
  if (data.age != null) { p.age = data.age; p.baseAge = data.age; }
  if (natISO) p.nat = natISO;
  if (data.pac != null) { p.pac = data.pac; p.sho = data.sho; p.pas = data.pas; p.dri = data.dri; p.def = data.def; p.phy = data.phy; }
  const det = { ...(p.det || {}) };
  for (const [k, v] of Object.entries(data.det || {})) if (v != null) det[k] = v;
  if (data.pos === 'GK') {
    // only remap outfield Positioning → GK Positioning when the DB gave no explicit GK positioning
    if (det.gkpos == null && det.pos != null) det.gkpos = det.pos;
    for (const key of SUBSTAT_GROUPS.flatMap(([, ks]) => ks)) delete det[key];
  }
  // fill missing substats only when needed (full DB rows skip this — big perf win at scale)
  const NEEDED = data.pos === 'GK' ? GK_SUBSTAT_GROUPS.flatMap(([, ks]) => ks) : SUBSTAT_GROUPS.flatMap(([, ks]) => ks);
  if (NEEDED.some(k => det[k] == null)) {
    const derived = derivedAtts({ ...p, det: null });
    for (const key of NEEDED) if (det[key] == null && derived[key] != null) det[key] = derived[key];
  }
  p.det = det;
  // profile fields
  p.profile = p.profile || {};
  Object.assign(p.profile, {
    alt: data.alt || [], foot: data.foot || '', sm: data.sm || 0, wf: data.wf || 0,
    height: data.height || 0, weight: data.weight || 0, traits: data.traits || '',
    shirt: data.shirt || 0, photoUrl: data.photoUrl || '', photoId: data.photoId || 0,
    realface: !!data.realface,
  });
  // contract: real wage & release clause & end date
  if (data.wage != null) p.ctr.w = Math.round(data.wage / 1000 * 100) / 100; // € → €k/week
  if (data.release != null) p.ctr.r = Math.round(data.release / 1e6 * 100) / 100;
  if (data.role != null) p.ctr.role = data.role;
  if (data.value != null) p.marketValue = data.value / 1e6; // € → M€
  if (data.enddate) {
    const end = new Date(data.enddate + 'T12:00:00');
    const years = Math.max(1, Math.round((end - new Date(G.date + 'T12:00:00')) / (365 * 86400000) * 2) / 2);
    p.ctr.y = Math.max(1, Math.ceil(years));
  }
  p.imported = data.bundle ? 'bundle' : 'runtime';
  if (isNew) assignRole(p, new RNG(hashStr(p.id + 'role'))); // cheap now: det is cached
  return isNew ? 'created' : 'updated';
}

// diacritic-collapsed loose norm ("Håland" ≈ "Haaland")
const looseNorm = s => norm(s).replace(/(.)\1+/g, '$1');

// indexed lookup used by the batch bundle applier
function findPlayerIdx(G, data, clubId, ctx) {
  const tn = norm(NAME_ALIASES[norm(data.name)] || data.name);
  const rawParts = String(NAME_ALIASES[norm(data.name)] || data.name).split(/\s+/).map(t => norm(t)).filter(Boolean);
  const filter = arr => arr.filter(p => !clubId || p.clubId === clubId);
  // 1) exact full name
  let cands = filter(ctx.nameIndex.get(tn) || []);
  if (cands.length === 1) return cands[0];
  if (cands.length > 1) return cands.find(p => p.pos === data.pos) || cands[0];
  // 1b) loose (diacritic/double-letter collapsed) full name
  const ln = looseNorm(data.name);
  if (ln !== tn) {
    cands = filter(ctx.looseIndex.get(ln) || []);
    if (cands.length === 1) return cands[0];
    if (cands.length > 1) return cands.find(p => p.pos === data.pos) || cands[0];
  }
  // 2) first two tokens ("Kylian Mbappé" vs "Kylian Mbappé Lottin")
  if (rawParts.length >= 2) {
    const f2 = rawParts[0] + rawParts[1];
    cands = filter(ctx.f2Index.get(f2) || []);
    if (cands.length === 1) return cands[0];
    if (cands.length > 1) return cands.find(p => p.pos === data.pos) || cands[0];
  }
  // 3) lastname within the club
  if (clubId) {
    const last = rawParts[rawParts.length - 1];
    if (last && last.length >= 4) {
      cands = (ctx.lastIndex.get(last) || []).filter(p => p.clubId === clubId);
      if (cands.length === 1) return cands[0];
      if (cands.length > 1) return cands.find(p => p.pos === data.pos) || null;
      // loose lastname too ("Håland" at Manchester City)
      const lLast = looseNorm(last);
      if (lLast !== last) {
        cands = (ctx.lastIndex.get(lLast) || []).filter(p => p.clubId === clubId);
        if (cands.length === 1) return cands[0];
        if (cands.length > 1) return cands.find(p => p.pos === data.pos) || null;
      }
    }
  }
  return null;
}

// batch apply (fast, indexed) — used for the baked-in bundle
export function applyImportBundle(G, list) {
  const clubIdx = buildClubIndex(G);
  const nameIndex = new Map();
  const looseIndex = new Map();
  const f2Index = new Map();
  const lastIndex = new Map();
  for (const p of G.world.players.values()) {
    const k = norm(p.name);
    let arr = nameIndex.get(k);
    if (!arr) nameIndex.set(k, arr = []);
    arr.push(p);
    const lk = looseNorm(p.name);
    if (lk !== k) {
      let a0 = looseIndex.get(lk);
      if (!a0) looseIndex.set(lk, a0 = []);
      a0.push(p);
    }
    const parts = String(p.name).split(/\s+/).map(t => norm(t)).filter(Boolean);
    if (parts.length >= 2) {
      const f2 = parts[0] + parts[1];
      let a2 = f2Index.get(f2);
      if (!a2) f2Index.set(f2, a2 = []);
      a2.push(p);
    }
    const last = parts[parts.length - 1];
    if (last && last.length >= 4) {
      let a3 = lastIndex.get(last);
      if (!a3) lastIndex.set(last, a3 = []);
      a3.push(p);
      const lLast = looseNorm(last);
      if (lLast !== last) {
        let a4 = lastIndex.get(lLast);
        if (!a4) lastIndex.set(lLast, a4 = []);
        a4.push(p);
      }
    }
  }
  let applied = 0;
  for (const data of list) {
    data.bundle = true;
    const r = applyImportedPlayer(G, data, { clubIdx, nameIndex, looseIndex, f2Index, lastIndex });
    if (r === 'updated' || r === 'created') applied++;
  }
  return applied;
}

// nation name → ISO
const NAT_BY_NAME = {};
for (const [iso, n] of Object.entries(NAT_NAME)) NAT_BY_NAME[norm(n)] = iso;
export function nationISO(G, name) {
  if (!name) return null;
  if (name.length <= 3 && name === name.toUpperCase()) return name;
  const n = norm(name);
  if (NAT_BY_NAME[n]) return NAT_BY_NAME[n];
  for (const nt of G.world.nts) if (norm(nt.name) === n) return nt.id;
  return null;
}
