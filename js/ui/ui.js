// ============ FCM 26 — shared UI components ============
import { h, esc, clamp, hashStr, fmtMoney, flag, NAT_NAME, POS_LABEL } from '../util.js';
import { derivedAtts, STAT_LABELS, SUBSTAT_GROUPS, GK_SUBSTAT_GROUPS } from '../data/worldgen.js';
import { BADGE_REMOTE } from '../data/badges_remote.js';

// ---------- club crests ----------
// Badge fallback chain per club:
//   1. remote 256px crest from football-logos.cc (js/data/badges_remote.js, 788 clubs)
//   2. generated stylized SVG (original vectors, always works offline)
const badgeCache = new Map(); // clubId -> resolved URL string, or 'gen'
const SHIELD_PATHS = {
  0: 'M4 6 C4 3 8 2 12 2 C16 2 20 3 20 6 L20 14 C20 20 16 22 12 22 C8 22 4 20 4 14 Z',
  1: 'M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2',
  2: 'M12 2 C17 2 22 7 22 12 C22 17 17 22 12 22 C7 22 2 17 2 12 C2 7 7 2 12 2',
  3: 'M12 2 L21 6 L21 14 C21 19 17 21.5 12 22.5 C7 21.5 3 19 3 14 L3 6 Z',
  4: 'M5 2 L19 2 L19 13 C19 19 16 21.5 12 22.5 C8 21.5 5 19 5 13 Z',
};
const PATTERNS = {
  0: '',
  1: 'M4 12 L20 12 M4 12 L20 12',
  2: 'M2 6 L12 6 M2 10 L12 10 M2 14 L12 14 M2 18 L12 18',
  3: 'M2 20 L20 2',
  4: 'M12 2 L12 22',
};
export function crestSVG(club, size = 40) {
  if (!club) return '';
  const hsh = hashStr(club.id);
  const path = SHIELD_PATHS[club.badge % 5];
  const pat = PATTERNS[hsh % 5];
  const c1 = club.c1 || '#ffffff', c2 = club.c2 || '#000000';
  const mono = club.mono || club.short.slice(0, 3);
  const fs = mono.length >= 4 ? 8 : mono.length === 3 ? 9.5 : 12;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="${path}" fill="${c1}" stroke="rgba(0,0,0,.55)" stroke-width="1"/>
    <clipPath id="cc${club.id}${size}"><path d="${path}"/></clipPath>
    <g clip-path="url(#cc${club.id}${size})">
      <path d="${pat}" stroke="${c2}" stroke-width="${hsh % 3 === 0 ? 3.4 : 2.6}" fill="none"/>
      <path d="M2 2 L12 2" stroke="${c2}" stroke-width="3.4"/>
    </g>
    <text x="12" y="${hsh % 2 === 0 ? 15.5 : 16}" text-anchor="middle" font-size="${fs}" font-weight="900" font-family="Segoe UI, sans-serif" fill="${c2}" stroke="${c1}" stroke-width=".5">${esc(mono)}</text>
  </svg>`;
}
export function crestEl(club, size = 22, cls = '') {
  const el = h('span', { class: `crest ${cls}` });
  el.style.width = size + 'px'; el.style.height = size + 'px';
  if (!club) return el;
  const gen = () => {
    badgeCache.set(club.id, 'gen');
    el.innerHTML = crestSVG(club, size);
  };
  const cached = badgeCache.get(club.id);
  if (cached === 'gen') { el.innerHTML = crestSVG(club, size); return el; }
  const src = typeof cached === 'string' ? cached : BADGE_REMOTE[club.id];
  if (!src) { el.innerHTML = crestSVG(club, size); return el; }
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
  img.addEventListener('error', gen);
  img.addEventListener('load', () => {
    badgeCache.set(club.id, img.src);
    // real crests ship on mixed backgrounds — seat them on a uniform light chip
    el.classList.add('crest-img');
    const pad = Math.max(1, Math.round(size * .09));
    img.style.padding = pad + 'px';
  });
  img.src = src;
  el.append(img);
  return el;
}
export function ntCrestEl(nt, size = 22, cls = '') {
  return h('span', { class: `crest ${cls}`, style: `width:${size}px;height:${size}px;background:#0d1120;font-size:${size * .62}px` }, flag(nt.id));
}

// ---------- stylized player face ----------
const SKINS = ['#f2c9a0', '#e0ac7c', '#c68b5c', '#8d5a38', '#6b4226'];
const HAIRS = [
  'M10 8 C10 4 14 4 14 8 L14 11 L10 11 Z', 'M10 7 C8 3 16 3 14 7 L14 10 L10 10 Z',
  'M10 8 C10 5 14 5 14 8 C14 5 18 6 17 9 L10 9 Z', 'M10 9 C10 6 14 6 14 9 L14 12 L10 12 Z',
  'M9 8 C9 4 15 4 15 8 C15 4 20 5 19 9 L9 9 Z', 'M10 7 C9 3 15 3 14 7 L14 9 L10 9 Z',
];
const HAIR_COLS = ['#1b1b1f', '#3a2a1a', '#5a3d22', '#7d7d85', '#2a2a2e', '#8c8c92', '#d8c26a', '#c9a24b'];
const KIT_COLS = [['#c8102e', '#ffffff'], ['#004170', '#da291c'], ['#1a3b8f', '#ffffff'], ['#0f7a3d', '#ffffff'], ['#6c1d45', '#99d6ea'], ['#fdb913', '#231f20'], ['#7a263a', '#1bb1e7'], ['#000000', '#ffffff'], ['#ffd200', '#003da5'], ['#f77f00', '#00803c']];
export function playerFaceSVG(p, w = 84, h = 64) {
  const hsh = hashStr(p.id);
  const skin = SKINS[hsh % SKINS.length];
  const hair = HAIRS[hsh % HAIRS.length];
  const hcol = HAIR_COLS[hsh % HAIR_COLS.length];
  const kit = KIT_COLS[hsh % KIT_COLS.length];
  const c1 = '#1a2236', c2 = '#0f1320';
  return `<svg width="${w}" height="${h}" viewBox="0 0 84 64" xmlns="http://www.w3.org/2000/svg">
    <rect width="84" height="64" rx="8" fill="url(#${'pf' + p.id})"/>
    <defs><linearGradient id="${'pf' + p.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <path d="M16 64 L68 64 L64 41 Q42 34 20 41 Z" fill="${kit[0]}"/>
    <path d="M16 64 L68 64 L66 60 L18 60 Z" fill="${kit[1]}" opacity=".85"/>
    <path d="M30 41 Q33 38 35 41 L35 45 Q33 46 31 44 Z" fill="${kit[1]}" opacity=".5"/>
    <circle cx="42" cy="30" r="12.5" fill="${skin}"/>
    <path d="${hair}" fill="${hcol}"/>
    <path d="M42 23 C45 22.5 46.5 23.5 47.5 26 C49 27 50 29 50.2 31.5 C50.4 34 50 35 49.5 36 L34.5 36 C34 35 33.6 34 33.8 31.5 C34 29 35 27 36.5 26 C37.5 23.5 39 22.5 42 23 Z" fill="${hcol}"/>
    <path d="M30 44 Q32 42 34 43 L34 52 Q32 53 30 52 Z" fill="#c0392b" opacity=".85"/>
    <path d="M50 44 Q52 42 54 43 L54 52 Q52 53 50 52 Z" fill="#c0392b" opacity=".85"/>
    <text x="42" y="61" text-anchor="middle" font-size="13" font-weight="900" fill="${kit[1]}" font-family="Segoe UI">${hsh % 99 + 1}</text>
  </svg>`;
}
// ---------- player portrait: real photo → local file → generated art ----------
const faceCache = new Map();
let faceMisses = 0, faceHits = 0, faceOff = false;
export function playerFaceEl(p, w = 84, ht = 64, club = null) {
  const el = h('div', { class: 'pcard-face' });
  el.style.width = w + 'px'; el.style.height = ht + 'px';
  el.style.overflow = 'hidden';
  el.style.borderRadius = '8px';
  if (faceOff) { el.innerHTML = playerFaceSVG(p, w, ht); return el; }
  if (faceCache.get(p.id) !== 'gen') {
    // 1) local cached DB headshot (assets/faces/p<dbid>.png)  2) live DB headshot URL  3) user files
    const prof = p.profile || {};
    const srcs = [];
    if (prof.photoId) srcs.push('assets/faces/p' + prof.photoId + '.png');
    if (prof.photoUrl) srcs.push(prof.photoUrl);
    srcs.push('assets/faces/' + p.id + '.png', 'assets/faces/' + p.id + '.jpg',
      'assets/faces/' + encodeURIComponent(p.name) + '.png', 'assets/faces/' + encodeURIComponent(p.name) + '.jpg');
    let i = 0;
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:top;display:block';
    const next = () => {
      if (i < srcs.length) img.src = srcs[i++];
      else {
        faceCache.set(p.id, 'gen'); el.innerHTML = playerFaceSVG(p, w, ht);
        if (++faceMisses > 60 && faceHits === 0) faceOff = true;
      }
    };
    img.addEventListener('error', next);
    img.addEventListener('load', () => { faceCache.set(p.id, 'img'); faceHits++; });
    next();
    el.append(img);
  } else {
    el.innerHTML = playerFaceSVG(p, w, ht);
  }
  return el;
}

// ---------- hexagon OVR ----------
export function hexEl(ovr, size = 46, cls = '') {
  const s = size, r = s * .46;
  const pts = [0, 1, 2, 3, 4, 5].map(i => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(s / 2 + r * Math.cos(a)).toFixed(1)},${(s / 2 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const el = h('div', { class: `hex ${cls}`, style: `width:${s}px;height:${s}px` });
  el.innerHTML = `<svg width="${s}" height="${s}"><polygon points="${pts}" fill="#0d1120" stroke="var(--accent)" stroke-width="2"/></svg><span class="hex-num" style="font-size:${s * .36}px">${ovr}</span>`;
  return el;
}

export function ratingClass(v) { return v >= 85 ? 'rating-85' : v >= 78 ? 'rating-80' : v >= 70 ? 'rating-70' : ''; }

// ---------- player card ----------
const ratingTier = v => v >= 90 ? 't-x' : v >= 80 ? 't-a' : v >= 70 ? 't-b' : v >= 55 ? 't-c' : 't-d';
const attrCell = (k, v) => h('div', { class: 'pb' },
  h('b', { class: v >= 90 ? 'rating-90' : v >= 80 ? 'rating-80' : v >= 70 ? 'rating-70' : '' }, v),
  h('span', null, k));
export function playerCard(p, opts = {}) {
  const { club, compact, onClick } = opts;
  const moodIcon = p.mor >= 65 ? '🙂' : p.mor >= 45 ? '😐' : '😠';
  const moodCls = p.mor >= 65 ? 'mood-ok' : p.mor >= 45 ? 'mood-bad' : 'mood-angry';
  const ovr = Math.round(p.ovr + p.gr);
  const shown = ovr >= 100 ? 99 : ovr;
  const el = h('div', { class: `pcard ${ratingTier(shown)}${compact ? ' pcard-compact' : ''}` });
  if (onClick) el.addEventListener('click', onClick);
  const face = playerFaceEl(p, 160, 100);
  face.style.width = '100%';
  const attrs = p.pos === 'GK'
    ? [['DIV', derivedAtts(p).div], ['HAN', derivedAtts(p).han], ['KIC', derivedAtts(p).kic], ['REF', derivedAtts(p).ref], ['SPD', derivedAtts(p).spd], ['POS', derivedAtts(p).gkpos]]
    : [['PAC', p.pac], ['SHO', p.sho], ['PAS', p.pas], ['DRI', p.dri], ['DEF', p.def], ['PHY', p.phy]];
  el.append(...[
    h('div', { class: 'pcard-top' },
      h('div', { class: 'pcard-ovr' },
        h('div', { class: 'pcard-ovr-num rating-cell ' + ratingClass(shown) }, String(shown)),
        h('div', { class: 'ovr-sub' }, p.pos)),
      h('div', { class: 'pcard-badges' },
        p.imported ? h('span', { class: 'tag tag-db', title: 'Real database profile' }, 'DB') : null,
        p.yth ? h('span', { class: 'tag tag-aca' }, 'ACA') : null,
        p.inj ? h('span', { class: 'tag tag-bad' }, 'INJ') : null,
        p.sus > 0 ? h('span', { class: 'tag tag-bad' }, 'SUS') : null,
        p.loan ? h('span', { class: 'tag' }, 'LOAN') : null,
      )),
    face,
    h('div', { class: 'pcard-name' }, esc(p.name)),
    h('div', { class: 'pcard-meta' },
      h('span', { title: NAT_NAME[p.nat] || p.nat }, flag(p.nat)),
      h('span', null, `${p.age} yrs`),
      h('span', { class: moodCls, title: 'Morale' }, moodIcon),
      h('span', { class: 'pcard-pot', title: `Potential ${p.pot}` }, `★ ${p.pot}`)),
    compact ? null : h('div', { class: 'pcard-bars' }, ...attrs.map(([k, v]) => attrCell(k, v))),
    club ? h('div', { class: 'pcard-wage' }, fmtMoney(p.ctr.w * 52 * 1000) + '/yr') : null,
  ].filter(Boolean));
  return el;
}

// ---------- generic bits ----------
export function formStripEl(G, clubId) {
  const arr = G.form[clubId] || [];
  const el = h('div', { class: 'formstrip', title: 'Form (oldest → latest)' });
  for (const r of arr.slice(-5)) {
    el.append(h('span', { class: r === 'W' ? 'f-w' : r === 'D' ? 'f-d' : 'f-l' }, r));
  }
  if (!arr.length) el.append(h('span', { class: 'tag' }, '—'));
  return el;
}

export function statRowsEl(p) {
  const rows = [
    ['PAC', p.pac], ['SHO', p.sho], ['PAS', p.pas], ['DRI', p.dri], ['DEF', p.def], ['PHY', p.phy],
  ];
  const wrap = h('div');
  for (const [k, v] of rows) {
    const color = v >= 90 ? '#ffd66b' : v >= 80 ? 'var(--accent)' : v >= 70 ? 'var(--accent2)' : '';
    wrap.append(statBar(k, v, 99, color));
  }
  return wrap;
}
function statBar(label, v, max, color) {
  const pct = clamp(v / max * 100, 0, 100);
  return h('div', { class: 'statbar' },
    h('div', { class: 'statbar-label' }, h('span', null, label), h('span', { class: 'statbar-val' }, v)),
    h('div', { class: 'statbar-track' }, h('div', { class: 'statbar-fill', style: `width:${pct}%;background:${color || ''}` })));
}

export function kpi(label, val, sub) {
  return h('div', { class: 'kpi' },
    h('div', { class: 'k-label' }, label),
    h('div', { class: 'k-val' }, val),
    sub ? h('div', { class: 'k-label', style: 'margin-top:3px;text-transform:none;letter-spacing:0' }, sub) : null);
}

export function posLabel(pos) { return POS_LABEL[pos] || pos; }

// ---------- full attribute grid (EA-style substats) ----------
export function detailedStatsEl(p) {
  const d = derivedAtts(p);
  const groups = p.pos === 'GK' ? GK_SUBSTAT_GROUPS : SUBSTAT_GROUPS;
  const wrap = h('div', { class: 'grid grid-2' });
  for (const [name, keys] of groups) {
    const box = h('div', { class: 'card', style: 'padding:10px' });
    box.append(h('div', { class: 'card-title', style: 'font-size:11.5px;margin-bottom:8px' }, name));
    for (const k of keys) {
      const v = d[k];
      if (v == null) continue;
      const color = v >= 90 ? '#ffd66b' : v >= 80 ? 'var(--accent)' : v >= 70 ? 'var(--accent2)' : '';
      box.append(statBar(STAT_LABELS[k] || k, v, 99, color));
    }
    wrap.append(box);
  }
  return wrap;
}
