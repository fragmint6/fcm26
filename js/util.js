// ============ FCM 26 — utilities ============
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sum = arr => arr.reduce((a, b) => a + b, 0);
export const avg = arr => arr.length ? sum(arr) / arr.length : 0;
export const round1 = v => Math.round(v * 10) / 10;
export const pad = (n, w = 2) => String(n).padStart(w, '0');

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class RNG {
  constructor(seed = 1) { this.s = seed >>> 0; }
  next() { this.s |= 0; this.s = (this.s + 0x6D2B79F5) | 0; let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + this.next() * (b - a); }
  intRange(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  gauss() { let u = 0, v = 0; while (u === 0) u = this.next(); while (v === 0) v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  weighted(items, wf) { let tot = 0; for (const it of items) tot += Math.max(0, wf(it)); let r = this.next() * tot; for (const it of items) { r -= Math.max(0, wf(it)); if (r <= 0) return it; } return items[items.length - 1]; }
}

// FNV-1a deterministic hash for stable generation
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
let _uidc = 0;
export const uid = p => `${p || 'id'}${(++_uidc).toString(36)}${Date.now().toString(36).slice(-3)}`;

// ------- formatting -------
const M = 1e6, K = 1e3;
export function fmtMoney(v) {
  if (v == null) return '—';
  const neg = v < 0; v = Math.abs(v);
  let s;
  if (v >= M) s = (v / M).toFixed(v >= 10 * M ? 0 : 1) + 'M';
  else if (v >= K) s = (v / K).toFixed(v >= 100 * K ? 0 : 1) + 'K';
  else s = String(Math.round(v));
  return (neg ? '−€' : '€') + s;
}
export function fmtMoneyFull(v) {
  if (v == null) return '—';
  const neg = v < 0; v = Math.abs(v);
  const s = Math.round(v).toLocaleString('en-US');
  return (neg ? '−€' : '€') + s;
}
export function fmtWage(w) { return '€' + Math.round(w).toLocaleString('en-US') + '/wk'; }
export function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export function fmtNum(n) { return Math.round(n).toLocaleString('en-US'); }
export function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
export function dow(iso) { return new Date(iso + 'T12:00:00').getDay(); }
export function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }

// ------- positions -------
export const POSITIONS = ['GK', 'RB', 'RWB', 'CB', 'LB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'RW', 'LM', 'LW', 'CF', 'ST'];
export const POS_GROUP = { GK: 'GK', RB: 'DEF', RWB: 'DEF', CB: 'DEF', LB: 'DEF', LWB: 'DEF', CDM: 'MID', CM: 'MID', CAM: 'MID', RM: 'MID', RW: 'MID', LM: 'MID', LW: 'MID', CF: 'ATT', ST: 'ATT' };
export const POS_LABEL = { GK: 'Goalkeeper', RB: 'Right Back', RWB: 'Right Wing Back', CB: 'Centre Back', LB: 'Left Back', LWB: 'Left Wing Back', CDM: 'Defensive Midfielder', CM: 'Central Midfielder', CAM: 'Attacking Midfielder', RM: 'Right Midfielder', RW: 'Right Winger', LM: 'Left Midfielder', LW: 'Left Winger', CF: 'Centre Forward', ST: 'Striker' };

// formation slot -> acceptable positions (affinity)
export const SLOT_AFF = {
  GK: { GK: 1 },
  RB: { RB: 1, RWB: .72, CB: .55, LB: .3, RM: .25, CM: .15 },
  RCB: { CB: 1, RB: .6, LB: .6, CDM: .3 },
  LCB: { CB: 1, LB: .6, RB: .6, CDM: .3 },
  CB: { CB: 1, RB: .6, LB: .6, CDM: .3 },
  CB: { CB: 1, RB: .6, LB: .6, CDM: .3 },
  LB: { LB: 1, LWB: .72, CB: .55, RB: .3, LM: .25, CM: .15 },
  RWB: { RWB: 1, RB: .75, RM: .6, RW: .45 },
  LWB: { LWB: 1, LB: .75, LM: .6, LW: .45 },
  CDM: { CDM: 1, CM: .85, CB: .55, CAM: .3 },
  RCM: { CM: 1, CAM: .8, CDM: .8, RM: .45, RW: .25 },
  LCM: { CM: 1, CAM: .8, CDM: .8, LM: .45, LW: .25 },
  CAM: { CAM: 1, CF: .75, CM: .7, RW: .55, LW: .55, ST: .45, CDM: .3 },
  RM: { RM: 1, RW: .85, RWB: .6, LM: .5, CM: .4 },
  RW: { RW: 1, RM: .85, LW: .65, CAM: .5, CF: .5, ST: .45 },
  LM: { LM: 1, LW: .85, LWB: .6, RM: .5, CM: .4 },
  LW: { LW: 1, LM: .85, RW: .65, CAM: .5, CF: .5, ST: .45 },
  CF: { CF: 1, ST: .85, CAM: .75, LW: .6, RW: .6 },
  RST: { ST: 1, CF: .8, RW: .55, LW: .55, CAM: .3 },
  LST: { ST: 1, CF: .8, LW: .55, RW: .55, CAM: .3 },
  ST: { ST: 1, CF: .8, RW: .5, LW: .5, CAM: .3 },
  CM: { CM: 1, CAM: .8, CDM: .8, RM: .4, LM: .4 },
};
export const SLOT_LABEL = { GK: 'GK', RB: 'RB', RCB: 'CB', LCB: 'CB', LB: 'LB', RWB: 'RWB', LWB: 'LWB', CDM: 'CDM', RCM: 'CM', LCM: 'CM', CAM: 'CAM', RM: 'RM', RW: 'RW', LM: 'LM', LW: 'LW', CF: 'CF', RST: 'ST', LST: 'ST' };

export const FORMATIONS = {
  '4-3-3 Holding': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'CDM', 'RCM', 'LCM', 'RW', 'ST', 'LW'],
  '4-3-3 Attack': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'RCM', 'LCM', 'CAM', 'RW', 'ST', 'LW'],
  '4-2-3-1 Wide': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'CDM', 'CDM', 'RM', 'CAM', 'LM', 'ST'],
  '4-2-3-1 Narrow': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'CDM', 'CDM', 'CAM', 'CAM', 'CAM', 'ST'],
  '4-4-2 Flat': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'RM', 'RCM', 'LCM', 'LM', 'RST', 'LST'],
  '4-4-2 Diamond': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'CDM', 'RM', 'CAM', 'LM', 'RST', 'LST'],
  '4-1-4-1': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'CDM', 'RM', 'RCM', 'LCM', 'LM', 'ST'],
  '4-5-1 Flat': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'RM', 'RCM', 'CM', 'LCM', 'LM', 'ST'],
  '4-2-2-2': ['GK', 'RB', 'RCB', 'LCB', 'LB', 'CDM', 'CDM', 'CAM', 'CAM', 'RST', 'LST'],
  '3-5-2': ['GK', 'RCB', 'CB', 'LCB', 'RWB', 'CDM', 'CDM', 'CAM', 'LWB', 'RST', 'LST'],
  '5-4-1': ['GK', 'RWB', 'RCB', 'CB', 'LCB', 'LWB', 'RM', 'RCM', 'LCM', 'LM', 'ST'],
  '5-3-2': ['GK', 'RWB', 'RCB', 'CB', 'LCB', 'LWB', 'RCM', 'CDM', 'LCM', 'RST', 'LST'],
  '3-4-2-1': ['GK', 'RCB', 'CB', 'LCB', 'RWB', 'RCM', 'LCM', 'LWB', 'CAM', 'CAM', 'ST'],
};
export const MENTALITIES = ['Ultra Defensive', 'Defensive', 'Balanced', 'Attacking', 'Ultra Attacking'];

// FC IQ style roles per position (label + stats emphasis)
export const ROLES = {
  GK: ['Sweeper Keeper', 'Traditional GK'],
  RB: ['Fullback', 'Wingback', 'Inverted Fullback'], LB: ['Fullback', 'Wingback', 'Inverted Fullback'],
  RWB: ['Wingback', 'Attacking Wingback'], LWB: ['Wingback', 'Attacking Wingback'],
  CB: ['Ball-Playing Defender', 'Stopper', 'Defender'], RCB: ['Ball-Playing Defender', 'Stopper', 'Defender'], LCB: ['Ball-Playing Defender', 'Stopper', 'Defender'],
  CDM: ['Holding', 'Deep-Lying Playmaker', 'Box-to-Box'],
  CM: ['Box-to-Box', 'Playmaker', 'Holding'],
  CAM: ['Playmaker', 'Shadow Striker'],
  RM: ['Wide Playmaker', 'Winger'], LM: ['Wide Playmaker', 'Winger'],
  RW: ['Inside Forward', 'Winger', 'Wide Playmaker'], LW: ['Inside Forward', 'Winger', 'Wide Playmaker'],
  CF: ['False 9', 'Target Forward'],
  ST: ['Advanced Forward', 'Poacher', 'Target Forward', 'False 9'],
  RST: ['Advanced Forward', 'Poacher', 'Target Forward'], LST: ['Advanced Forward', 'Poacher', 'Target Forward'],
};

// ------- flags -------
const ISO_FLAG = {
  ENG: 'GB', SCO: 'GB', WAL: 'GB', NIR: 'GB', IRL: 'IE', FRA: 'FR', ESP: 'ES', GER: 'DE', ITA: 'IT',
  POR: 'PT', NED: 'NL', BEL: 'BE', TUR: 'TR', BRA: 'BR', ARG: 'AR', URU: 'UY', COL: 'CO', ECU: 'EC',
  MEX: 'MX', USA: 'US', CAN: 'CA', JPN: 'JP', KOR: 'KR', AUS: 'AU', NZL: 'NZ', NGA: 'NG', GHA: 'GH',
  CIV: 'CI', SEN: 'SN', CMR: 'CM', MLI: 'ML', GUI: 'GN', MAR: 'MA', ALG: 'DZ', TUN: 'TN', EGY: 'EG',
  CRO: 'HR', SRB: 'RS', POL: 'PL', CZE: 'CZ', SVK: 'SK', HUN: 'HU', ROU: 'RO', BUL: 'BG', GRE: 'GR',
  AUT: 'AT', SUI: 'CH', DEN: 'DK', SWE: 'SE', NOR: 'NO', FIN: 'FI', ISL: 'IS', UKR: 'UA', RUS: 'RU',
  GEO: 'GE', ALB: 'AL', SVN: 'SI', BIH: 'BA', MKD: 'MK', MNE: 'ME', KOS: 'XK', KAZ: 'KZ', ISR: 'IL',
  KSA: 'SA', QAT: 'QA', UAE: 'AE', IRN: 'IR', IRQ: 'IQ', JOR: 'JO', SYR: 'SY', LBN: 'LB', KUW: 'KW',
  OMA: 'OM', BHR: 'BH', UZB: 'UZ', CHN: 'CN', IDN: 'ID', THA: 'TH', VIE: 'VN', MAS: 'MY', SGP: 'SG',
  PHI: 'PH', IND: 'IN', RSA: 'ZA', ZAM: 'ZM', ZIM: 'ZW', ANG: 'AO', COD: 'CD', CPV: 'CV', GAB: 'GA',
  BFA: 'BF', BEN: 'BJ', TOG: 'TG', GAM: 'GM', SLE: 'SL', LBR: 'LR', GUI: 'GN', MTN: 'MR', NIG: 'NE',
  CHA: 'TD', SUD: 'SD', ETH: 'ET', KEN: 'KE', TAN: 'TZ', UGA: 'UG', MOZ: 'MZ', MAD: 'MG', PAR: 'PY',
  CHI: 'CL', PER: 'PE', VEN: 'VE', BOL: 'BO', CRC: 'CR', HON: 'HN', SLV: 'SV', GUA: 'GT', PAN: 'PA',
  JAM: 'JM', HAI: 'HT', TRI: 'TT', CUW: 'CW', SUR: 'SR', ARM: 'AM', AZE: 'AZ', MDA: 'MD', BLR: 'BY',
  EST: 'EE', LAT: 'LV', LTU: 'LT', LUX: 'LU', MLT: 'MT', CYP: 'CY', FRO: 'FO', KVX: 'XK', NIR2: 'GB',
};
export const NATS = ['ENG', 'SCO', 'WAL', 'NIR', 'IRL', 'FRA', 'ESP', 'GER', 'ITA', 'POR', 'NED', 'BEL', 'TUR', 'BRA', 'ARG', 'URU', 'COL', 'ECU', 'MEX', 'USA', 'CAN', 'JPN', 'KOR', 'AUS', 'NGA', 'GHA', 'CIV', 'SEN', 'CMR', 'MAR', 'ALG', 'TUN', 'EGY', 'CRO', 'SRB', 'POL', 'CZE', 'SVK', 'HUN', 'ROU', 'GRE', 'AUT', 'SUI', 'DEN', 'SWE', 'NOR', 'FIN', 'ISL', 'UKR', 'RUS', 'GEO', 'ALB', 'SVN', 'BIH', 'KSA', 'QAT', 'UAE', 'IRN', 'CHN', 'JPN', 'AUS', 'RSA', 'ZAM', 'ANG', 'COD', 'CPV', 'PAR', 'CHI', 'PER', 'VEN', 'CRC', 'JAM', 'ARM', 'AZE', 'MDA', 'EST', 'LAT', 'LTU', 'LUX', 'MLT', 'CYP', 'ISR', 'UZB', 'IDN', 'THA', 'VIE', 'IND', 'MAS'];
export const NAT_NAME = {
  ENG: 'England', SCO: 'Scotland', WAL: 'Wales', NIR: 'N. Ireland', IRL: 'Ireland', FRA: 'France', ESP: 'Spain', GER: 'Germany', ITA: 'Italy',
  POR: 'Portugal', NED: 'Netherlands', BEL: 'Belgium', TUR: 'Türkiye', BRA: 'Brazil', ARG: 'Argentina', URU: 'Uruguay', COL: 'Colombia', ECU: 'Ecuador',
  MEX: 'Mexico', USA: 'United States', CAN: 'Canada', JPN: 'Japan', KOR: 'South Korea', AUS: 'Australia', NGA: 'Nigeria', GHA: 'Ghana', CIV: 'Ivory Coast',
  SEN: 'Senegal', CMR: 'Cameroon', MAR: 'Morocco', ALG: 'Algeria', TUN: 'Tunisia', EGY: 'Egypt', CRO: 'Croatia', SRB: 'Serbia', POL: 'Poland',
  CZE: 'Czechia', SVK: 'Slovakia', HUN: 'Hungary', ROU: 'Romania', GRE: 'Greece', AUT: 'Austria', SUI: 'Switzerland', DEN: 'Denmark', SWE: 'Sweden',
  NOR: 'Norway', FIN: 'Finland', ISL: 'Iceland', UKR: 'Ukraine', RUS: 'Russia', GEO: 'Georgia', ALB: 'Albania', SVN: 'Slovenia', BIH: 'Bosnia',
  KSA: 'Saudi Arabia', QAT: 'Qatar', UAE: 'UAE', IRN: 'Iran', CHN: 'China', RSA: 'South Africa', ZAM: 'Zambia', ANG: 'Angola', COD: 'DR Congo',
  CPV: 'Cape Verde', PAR: 'Paraguay', CHI: 'Chile', PER: 'Peru', VEN: 'Venezuela', CRC: 'Costa Rica', JAM: 'Jamaica', ARM: 'Armenia', AZE: 'Azerbaijan',
  MDA: 'Moldova', EST: 'Estonia', LAT: 'Latvia', LTU: 'Lithuania', LUX: 'Luxembourg', MLT: 'Malta', CYP: 'Cyprus', ISR: 'Israel', UZB: 'Uzbekistan',
  IDN: 'Indonesia', THA: 'Thailand', VIE: 'Vietnam', IND: 'India', MAS: 'Malaysia',
  TUN: 'Tunisia', GUI: 'Guinea', BFA: 'Burkina Faso', GAB: 'Gabon', ZAM: 'Zambia', ANG: 'Angola', BEN: 'Benin', TOG: 'Togo',
  MTN: 'Mauritania', SDN: 'Sudan', KEN: 'Kenya', GAM: 'Gambia', UGA: 'Uganda', IRQ: 'Iraq', JOR: 'Jordan', OMA: 'Oman',
  BHR: 'Bahrain', KUW: 'Kuwait', SYR: 'Syria', LBN: 'Lebanon', KAZ: 'Kazakhstan', KGZ: 'Kyrgyzstan', TJK: 'Tajikistan',
  HON: 'Honduras', SLV: 'El Salvador', GUA: 'Guatemala', TRI: 'Trinidad & Tobago', HAI: 'Haiti', CUW: 'Curaçao',
  NCA: 'Nicaragua', DOM: 'Dominican Republic', BLZ: 'Belize', SUR: 'Suriname',
  // extended set (full SoFIFA/EAFC database coverage)
  BOL: 'Bolivia', KOS: 'Kosovo', MNE: 'Montenegro', NZL: 'New Zealand', GNB: 'Guinea-Bissau', BUL: 'Bulgaria',
  MKD: 'North Macedonia', SLE: 'Sierra Leone', ZIM: 'Zimbabwe', CGO: 'Congo', COM: 'Comoros', EQG: 'Equatorial Guinea',
  LBR: 'Liberia', MAD: 'Madagascar', CTA: 'Central African Republic', MOZ: 'Mozambique', PHI: 'Philippines', PLE: 'Palestine',
  ATG: 'Antigua and Barbuda', SKN: 'Saint Kitts and Nevis', FRO: 'Faroe Islands', TPE: 'Chinese Taipei', BDI: 'Burundi',
  LBY: 'Libya', TAN: 'Tanzania', LCA: 'Saint Lucia', BLR: 'Belarus', MSR: 'Montserrat', BER: 'Bermuda', RWA: 'Rwanda',
  MWI: 'Malawi', CUB: 'Cuba', YEM: 'Yemen', BAN: 'Bangladesh', CHA: 'Chad', VAN: 'Vanuatu', NIG: 'Niger', NAM: 'Namibia',
  AFG: 'Afghanistan', SRI: 'Sri Lanka', SOM: 'Somalia', PAK: 'Pakistan', NCL: 'New Caledonia', BAR: 'Barbados',
  LIE: 'Liechtenstein', PUR: 'Puerto Rico', GIB: 'Gibraltar', AND: 'Andorra', GRN: 'Grenada', GUY: 'Guyana', HKG: 'Hong Kong',
};
export function flag(nat) {
  if (!nat) return '';
  const iso = ISO_FLAG[nat] || nat;
  if (iso.length !== 2) return nat;
  try {
    return String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch (e) { return nat; }
}

// ------- tiny DOM helpers (UI only; safe in node as long as not called) -------
export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(9)) {
    if (kid == null) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}
export function toast(msg, type = 'info', ms = 3200) {
  if (typeof document === 'undefined') return;
  const wrap = $('#toasts') || h('div', { id: 'toasts' });
  if (!$('#toasts')) document.body.append(wrap);
  const t = h('div', { class: `toast toast-${type}` }, msg);
  wrap.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}
export function modal({ title, body, footer, wide, onClose }) {
  const ov = h('div', { class: 'modal-overlay' });
  const box = h('div', { class: `modal${wide ? ' modal-wide' : ''}` },
    h('div', { class: 'modal-head' }, h('div', { class: 'modal-title' }, title), h('button', { class: 'modal-x', onclick: () => close() }, '✕')),
    h('div', { class: 'modal-body' }, body),
    footer ? h('div', { class: 'modal-foot' }, footer) : null);
  ov.append(box);
  document.body.append(ov);
  function close() { ov.remove(); onClose && onClose(); }
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  return { close, box };
}
export function confirmBox(title, msg, okLabel = 'Confirm', danger = false) {
  return new Promise(res => {
    const m = modal({
      title, body: h('p', { class: 'modal-msg' }, msg),
      footer: [
        h('button', { class: 'btn btn-ghost', onclick: () => { m.close(); res(false); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => { m.close(); res(true); } }, okLabel),
      ],
    });
  });
}
export function statBar(label, v, max = 99, color) {
  const pct = clamp(v / max * 100, 0, 100);
  return h('div', { class: 'statbar' },
    h('div', { class: 'statbar-label' }, h('span', null, label), h('span', { class: 'statbar-val' }, Math.round(v))),
    h('div', { class: 'statbar-track' }, h('div', { class: 'statbar-fill', style: `width:${pct}%;background:${color || ''}` })));
}
