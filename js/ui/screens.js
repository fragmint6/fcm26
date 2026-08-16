// ============ FCM 26 — main screens ============
import { h, esc, clamp, fmtMoney, fmtWage, fmtDate, fmtDateShort, fmtNum, addDays, flag, NAT_NAME, modal, toast, confirmBox, FORMATIONS, MENTALITIES, POS_LABEL, SLOT_AFF, SLOT_LABEL, POSITIONS, $ } from '../util.js';
import { LEAGUES, CUPS, UEFA } from '../data/clubs.js';
import { tableSorted, clubsInLeague } from '../engine/schedule.js';
import { isUserMatch, compLabel } from '../engine/advance.js';
import { playerValue, wageAsk, askPrice, aiSellResponse, playerContractResponse, executeUserBuy, executeUserLoanIn, respondOffer, listPlayer, unlistPlayer, releasePlayer, renewContract, totalWages } from '../engine/market.js';
import { effOvr, teamSheet, teamQuality, setSlotOverride, pruneSlotOverrides } from '../engine/match.js';
import { knownOf } from '../engine/scouting.js';
import { expPos, genObjectives } from '../engine/board.js';
import { promoteYouth } from '../engine/growth.js';
import { crestEl, ntCrestEl, playerFaceEl, playerCard, hexEl, formStripEl, statRowsEl, kpi, posLabel, ratingClass, detailedStatsEl, compLogoEl, compNameEl } from './ui.js';
import { showMatchday } from './matchscreen.js';

export const userClub = G => G.world.clubs.get(G.user.clubId);
export const clubOf = (G, pid) => { const p = G.world.players.get(pid); return p && p.clubId ? G.world.clubs.get(p.clubId) : null; };
export const playerName = (G, pid) => { const p = G.world.players.get(pid); return p ? p.name : '—'; };

export function nextUserMatch(G) {
  let best = null;
  for (const [date, arr] of G.cal) {
    if (date < G.date) continue;
    for (const m of arr) {
      if (G.results[m.id] || m.note) continue;
      if (isUserMatch(G, m)) {
        if (!best || date < best.date) best = m;
      }
    }
  }
  return best;
}
export function lastResult(G) {
  let best = null;
  for (const [mid, res] of Object.entries(G.results)) {
    const m = G.matchIndex.get(mid);
    if (!m || !isUserMatch(G, m)) continue;
    if (!best || m.date > best.date) best = { m, res };
  }
  return best;
}

// ================= HOME =================
export function renderHome(G) {
  const root = h('div');
  const club = userClub(G);
  const league = LEAGUES[club.league];
  const t = tableSorted(G, club.league);
  const pos = t.findIndex(r => r.id === club.id) + 1;
  const lr = lastResult(G);
  const nx = nextUserMatch(G);
  const pend = G.pendingMatch;

  if (pend) {
    root.append(h('div', { class: 'matchday-banner' },
      h('div', { style: 'font-size:26px' }, '⚽'),
      h('div', { style: 'flex:1' },
        h('div', { style: 'font-weight:800;font-size:15px;display:flex;align-items:center;gap:8px;flex-wrap:wrap' }, 'MATCHDAY —', compLogoEl(pend.comp, 20), compLabel(pend, G)),
        h('div', { class: 'screen-sub', style: 'margin:0' }, matchLine(G, pend)),
      ),
      h('button', { class: 'btn btn-primary', style: 'font-size:15px;padding:12px 22px', onclick: () => showMatchday(G) }, '▶ PLAY MATCH'),
    ));
  } else if (nx) {
    root.append(h('div', { class: 'card', style: 'display:flex;align-items:center;gap:14px;margin-bottom:14px' },
      h('div', { style: 'font-size:26px' }, '📅'),
      h('div', { style: 'flex:1' },
        h('div', { style: 'font-weight:700;display:flex;align-items:center;gap:7px;flex-wrap:wrap' }, 'Next match:', compLogoEl(nx.comp, 18), `${compLabel(nx, G)} — ${fmtDate(nx.date)}`),
        h('div', { class: 'screen-sub', style: 'margin:0' }, matchLine(G, nx)),
      ),
      h('div', { class: 'formstrip-el' }),
      h('button', { class: 'btn btn-primary', onclick: () => advanceFromUI(G) }, '▶ ADVANCE'),
    ));
  }
  // last result
  if (lr) {
    const m = lr.m, res = lr.res;
    const uSide = m.home === G.user.clubId ? 'h' : 'a';
    const won = uSide === 'h' ? res.hg > res.ag : res.ag > res.hg;
    const drew = res.hg === res.ag;
    const opp = G.world.clubs.get(uSide === 'h' ? m.away : m.home);
    root.append(h('div', { class: 'card', style: 'display:flex;align-items:center;gap:12px;margin-bottom:14px' },
      crestEl(club, 36), h('div', { style: 'font-size:22px;font-weight:900;font-style:italic' }, `${res.hg}–${res.ag}`),
      opp ? crestEl(opp, 36) : null,
      h('div', { style: 'flex:1' },
        h('div', { style: 'font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:7px;flex-wrap:wrap' }, `${won ? 'Won' : drew ? 'Drew' : 'Lost'} vs ${opp ? opp.name : ''} ·`, compLogoEl(m.comp, 16), compLabel(m, G)),
        h('div', { class: 'screen-sub', style: 'margin:0' }, fmtDate(m.date)),
      ),
      formStripEl(G, club.id),
      h('button', { class: 'btn', onclick: () => showResultModal(G, m) }, 'Report'),
    ));
  }
  // kpis
  root.append(h('div', { class: 'grid grid-4', style: 'margin-bottom:14px' },
    kpi('Balance', fmtMoney(club.bal)),
    kpi('Transfer budget', fmtMoney(club.tb)),
    kpi('Wage budget', fmtWage(club.wb)),
    kpi('League position', pos ? `${pos}${ord(pos)}` : '—', compNameEl(league.id, league.name, 14)),
  ));
  const grid = h('div', { class: 'grid grid-2' });
  // league mini table
  grid.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, compNameEl(league.id, league.name, 20)), h('div', { class: 'card-sub' }, `${t.length} teams`)),
    miniTableEl(G, club.league, pos),
  ));
  // objectives
  grid.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Board objectives'), h('div', { class: 'card-sub' }, `Rating ${club.rating}/100`)),
    meterEl(club.rating),
    h('div', { style: 'height:8px' }),
    ...(club.objectives || []).map(o => objRowEl(G, o, club)),
  ));
  root.append(grid);
  // news preview
  root.append(h('div', { class: 'card', style: 'margin-top:14px' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Latest news'), h('button', { class: 'btn btn-sm', onclick: () => location.hash = '#news' }, 'All news →')),
    h('div', {}, ...G.news.slice(0, 5).map(n => newsRowEl(G, n))),
  ));
  return root;
}
function matchLine(G, m) {
  if (m.nt) {
    const ntN = nat => (G.world.nts.find(n => n.id === nat) || {}).name || nat;
    return `${ntN(m.tnat.h)} vs ${ntN(m.tnat.a)} · ${fmtDate(m.date)}`;
  }
  const hc = G.world.clubs.get(m.home), ac = G.world.clubs.get(m.away);
  return `${hc ? hc.name : m.home} vs ${ac ? ac.name : m.away} · ${fmtDate(m.date)}`;
}
function ord(n) { return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'; }
function meterEl(v) {
  return h('div', { class: 'meter', style: 'margin-bottom:10px' }, h('div', { style: `width:${clamp(v, 0, 100)}%` }));
}
function objRowEl(G, o, club) {
  const st = club.objProgress[o.id] || {};
  let pct = 0, detail = '';
  if (o.type === 'pos') {
    const t = tableSorted(G, club.league);
    const pos = t.findIndex(r => r.id === club.id) + 1;
    pct = pos ? clamp(((o.target - pos) / o.target) * 60 + 40, 0, 100) : 0;
    detail = `Current: ${pos || '—'}${ord(pos || 0)}`;
  } else if (o.type === 'cup') {
    const st2 = G.sched.cups[o.cup];
    pct = st2 ? clamp((st2.round - 1) / 6 * 100, 0, 100) : 0;
    detail = st2 ? `Round ${st2.round - 1}` : 'Not started';
  } else if (o.type === 'euro') {
    const key = o.comp === 'UCL' ? 'ucl' : o.comp === 'UEL' ? 'uel' : 'uecl';
    const s = G.sched.euro[key];
    pct = s ? clamp((['playoff', 'r16', 'qf', 'sf', 'final', 'done'].indexOf(s.round) / 5) * 100, 0, 100) : 0;
    detail = s ? (s.round === 'lp' ? 'League phase' : s.round) : '—';
  } else if (o.type === 'youth') {
    pct = clamp(o.count / o.target * 100, 0, 100);
    detail = `${o.count}/${o.target} apps`;
  } else if (o.type === 'fin') {
    pct = clamp(club.bal / o.target * 100, 0, 100);
    detail = fmtMoney(club.bal);
  } else if (o.type === 'brand') {
    pct = clamp((o.count || 0) / o.target * 100, 0, 100);
    detail = `${o.count || 0}/${o.target}`;
  }
  const oComp = o.type === 'pos' ? club.league : o.type === 'cup' ? o.cup : o.type === 'euro' ? o.comp : null;
  return h('div', { class: 'obj-row' },
    h('div', { class: 'obj-label', style: 'display:flex;align-items:center;gap:7px' }, compLogoEl(oComp, 17), h('span', null, o.label)),
    h('div', { class: 'obj-track' }, h('div', { class: 'obj-fill', style: `width:${clamp(pct, 2, 100)}%` })),
    h('div', { class: 'obj-w' }, detail),
  );
}
function miniTableEl(G, lid, userPos) {
  const rows = tableSorted(G, lid).slice(0, 7);
  const user = tableSorted(G, lid).find(r => r.id === G.user.clubId);
  const show = [...rows];
  if (user && !show.includes(user)) show.push(user);
  const wrap = h('div');
  for (const r of show) {
    const c = G.world.clubs.get(r.id);
    const i = tableSorted(G, lid).indexOf(r) + 1;
    wrap.append(h('div', { class: 'obj-row', style: 'margin-bottom:4px' },
      h('span', { style: 'width:20px;color:var(--dim)' }, i),
      crestEl(c, 18),
      h('div', { class: 'obj-label', style: r.id === G.user.clubId ? 'color:var(--accent)' : '' }, c.name),
      h('span', { style: 'color:var(--dim);width:34px;text-align:right' }, `${r.pts}pts`),
    ));
  }
  return wrap;
}
function newsRowEl(G, n) {
  const el = h('div', { class: `news-item${n.read ? '' : ' unread'}` },
    h('div', { class: 'n-ic' }, n.icon || '📰'),
    h('div', { class: 'n-body' },
      h('div', { class: 'n-t' }, n.t),
      h('div', { class: 'n-d' }, `${n.cat || 'News'} · ${fmtDate(n.d)}`),
    ));
  el.addEventListener('click', () => { n.read = true; showNewsDetail(n); });
  return el;
}
function showNewsDetail(n) {
  modal({ title: n.cat || 'News', body: h('div', {}, h('div', { style: 'font-size:22px;margin-bottom:10px' }, n.icon), h('p', { style: 'font-size:15px;line-height:1.5' }, n.t), h('p', { class: 'screen-sub', style: 'margin-top:10px' }, fmtDate(n.d))) });
}

// ================= SQUAD =================
let squadFilter = 'ALL';
export function renderSquad(G) {
  const root = h('div');
  const club = userClub(G);
  root.append(h('div', { class: 'screen-title' }, crestEl(club, 30), `${club.name} — Squad`));
  const tabs = h('div', { class: 'tabs' },
    tabBtn('Players', squadTab === 'players', () => { squadTab = 'players'; rerender(); }),
    tabBtn('Team Sheet', squadTab === 'sheet', () => { squadTab = 'sheet'; rerender(); }),
    tabBtn('Tactics', squadTab === 'tactics', () => { squadTab = 'tactics'; rerender(); }),
    tabBtn('Development', squadTab === 'dev', () => { squadTab = 'dev'; rerender(); }),
  );
  root.append(tabs);
  if (squadTab === 'players') root.append(playersTab(G, club));
  else if (squadTab === 'sheet') root.append(sheetTab(G, club));
  else if (squadTab === 'tactics') root.append(tacticsTab(G, club));
  else root.append(devTab(G, club));
  return root;
}
let squadTab = 'players';
// router hook: main.js injects its route() so tab clicks re-render the ACTIVE screen
let _routeFn = null;
export const setRouterFn = fn => { _routeFn = fn; };
const rerender = () => { if (_routeFn) _routeFn(); };
function tabBtn(label, on, fn) { return h('button', { class: `tab${on ? ' on' : ''}`, onclick: fn }, label); }

function playersTab(G, club) {
  const wrap = h('div');
  const chips = h('div', { class: 'chip-row', style: 'margin-bottom:10px' },
    ...[['ALL', 'All'], ['GK', 'GK'], ['D', 'Defence'], ['M', 'Midfield'], ['A', 'Attack']].map(([k, l]) =>
      h('button', { class: `tab${squadFilter === k ? ' on' : ''}`, onclick: () => { squadFilter = k; rerender(); } }, l)),
  );
  wrap.append(chips);
  const players = club.squad.map(id => G.world.players.get(id)).filter(p => p && !p.retired)
    .filter(p => {
      if (squadFilter === 'ALL') return true;
      if (squadFilter === 'GK') return p.pos === 'GK';
      const grp = p.pos === 'GK' ? 'GK' : ['RB', 'RWB', 'CB', 'LB', 'LWB'].includes(p.pos) ? 'D' : ['CDM', 'CM', 'CAM', 'RM', 'RW', 'LM', 'LW'].includes(p.pos) ? 'M' : 'A';
      return grp === squadFilter;
    })
    .sort((a, b) => (b.ovr + b.gr) - (a.ovr + a.gr));
  const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(165px,1fr))' });
  for (const p of players) grid.append(playerCard(p, { onClick: () => showPlayerModal(G, p.id) }));
  wrap.append(grid);
  return wrap;
}

function sheetTab(G, club) {
  const wrap = h('div');
  const sheet = teamSheet(club, G.world);
  const q = teamQuality(sheet, G.world, G.user.tact.mentality);
  wrap.append(h('div', { class: 'grid grid-4', style: 'margin-bottom:12px' },
    kpi('Squad rating', Math.round(q.ovr)), kpi('Attack', Math.round(q.att)), kpi('Midfield', Math.round(q.mid)), kpi('Defence', Math.round(q.def))));
  wrap.append(h('div', { class: 'grid grid-2' },
    pitchEl(G, club, sheet),
    h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Bench')),
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' },
        ...sheet.bench.map(pid => {
          const p = G.world.players.get(pid);
          return h('button', { class: 'club-pick', style: 'width:auto;padding:5px 8px', onclick: () => showPlayerModal(G, pid) },
            h('span', { class: 'pos-chip' }, p.pos), h('span', { style: 'font-weight:700' }, esc(p.name)), h('span', { class: 'screen-sub' }, effOvr(p).toFixed(0)));
        }))),
    h('div', { class: 'card' },
      h('div', { class: 'card-title', style: 'margin-bottom:10px' }, 'Set pieces & captain'),
      pickerEl('Captain', G.user.captain, club.squad.map(id => G.world.players.get(id)).filter(Boolean), pid => { G.user.captain = pid; rerender(); }),
      pickerEl('Penalties', G.user.kickers.pen, club.squad.map(id => G.world.players.get(id)).filter(Boolean), pid => { G.user.kickers.pen = pid; rerender(); }),
      pickerEl('Free kicks', G.user.kickers.fk, club.squad.map(id => G.world.players.get(id)).filter(Boolean), pid => { G.user.kickers.fk = pid; rerender(); }),
      pickerEl('Corners', G.user.kickers.cor, club.squad.map(id => G.world.players.get(id)).filter(Boolean), pid => { G.user.kickers.cor = pid; rerender(); }),
    ),
  ));
  return wrap;
}
function pickerEl(label, selected, players, onPick) {
  const sel = h('select', { onchange: e => onPick(e.target.value) },
    h('option', { value: '' }, '— none —'),
    ...players.map(p => h('option', { value: p.id, selected: p.id === selected }, p.name)));
  return h('div', { style: 'margin-bottom:10px' }, h('label', { class: 'fld' }, label), sel);
}

function tacticsTab(G, club) {
  const wrap = h('div');
  const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(200px,1fr))' });
  for (const f of Object.keys(FORMATIONS)) {
    const el = h('div', { class: `card${G.user.tact.formation === f ? ' sel-highlight' : ''}`, style: 'cursor:pointer;text-align:center' });
    el.addEventListener('click', () => { G.user.tact.formation = f; pruneSlotOverrides(G); rerender(); });
    el.append(h('div', { style: 'font-weight:800;font-size:13px;margin-bottom:6px' }, f), miniPitchEl(f));
    grid.append(el);
  }
  wrap.append(grid);
  wrap.append(h('div', { class: 'card', style: 'margin-top:14px' },
    h('div', { class: 'card-title', style: 'margin-bottom:10px' }, 'Mentality'),
    h('div', { class: 'chip-row' }, ...MENTALITIES.map((m, i) =>
      h('button', { class: `tab${G.user.tact.mentality === i + 1 ? ' on' : ''}`, onclick: () => { G.user.tact.mentality = i + 1; rerender(); } }, m))),
  ));
  return wrap;
}
function miniPitchEl(formation) {
  const slots = FORMATIONS[formation];
  const el = h('div', { class: 'pitch', style: 'height:130px;width:150px' });
  el.innerHTML = '<div class="line-mid"></div><div class="circle-mid"></div>';
  const coords = {
    GK: [6, 50], RB: [22, 88], RCB: [20, 62], LCB: [20, 38], LB: [22, 12], RWB: [22, 92], LWB: [22, 8],
    CDM: [38, 50], RCM: [45, 66], LCM: [45, 34], CM: [45, 50], CAM: [58, 50], RM: [42, 88], LM: [42, 12],
    RW: [62, 82], LW: [62, 18], CF: [72, 50], RST: [74, 62], LST: [74, 38], ST: [78, 50],
  };
  for (const s of slots) {
    const [top, left] = coords[s] || [50, 50];
    const d = h('div', { class: 'pdot', style: `top:${top}%;left:${left}%;transform:translate(-50%,-50%);width:14px;height:14px;font-size:7px;border-width:1px` }, SLOT_LABEL[s] === 'GK' ? 'G' : '•');
    el.append(d);
  }
  return el;
}

function devTab(G, club) {
  const wrap = h('div');
  const players = club.squad.map(id => G.world.players.get(id)).filter(p => p && !p.retired).sort((a, b) => (b.ovr + b.gr) - (a.ovr + a.gr));
  const table = h('table', { class: 'tbl' });
  const thead = h('thead', null, h('tr', null,
    h('th', null, 'Player'), h('th', null, 'Age'), h('th', null, 'OVR'), h('th', null, 'POT'),
    h('th', null, 'Role'), h('th', null, 'Focus'), h('th', null, 'Intensity'),
    h('th', null, 'Morale'), h('th', null, 'Form'), h('th', null, 'Fitness')));
  const tbody = h('tbody');
  for (const p of players) {
    const focusSel = h('select', { class: 'btn-sm', style: 'width:auto', onchange: e => { p.plan.focus = e.target.value; } },
      h('option', { value: 'BAL', selected: (p.plan.focus || 'BAL') === 'BAL' }, 'Balanced'),
      h('option', { value: 'ATT', selected: p.plan.focus === 'ATT' }, 'Attack'),
      h('option', { value: 'MID', selected: p.plan.focus === 'MID' }, 'Midfield'),
      h('option', { value: 'DEF', selected: p.plan.focus === 'DEF' }, 'Defence'),
      h('option', { value: 'GK', selected: p.plan.focus === 'GK' }, 'GK'),
      h('option', { value: 'PHY', selected: p.plan.focus === 'PHY' }, 'Physical'));
    const intSel = h('select', { class: 'btn-sm', style: 'width:auto', onchange: e => { p.plan.intensity = Number(e.target.value); } },
      h('option', { value: '0', selected: (p.plan.intensity || 1) === 0 }, 'Low'),
      h('option', { value: '1', selected: (p.plan.intensity || 1) === 1 }, 'Balanced'),
      h('option', { value: '2', selected: p.plan.intensity === 2 }, 'High'));
    tbody.append(h('tr', null,
      h('td', { style: 'cursor:pointer', onclick: () => showPlayerModal(G, p.id) }, esc(p.name)),
      h('td', null, p.age),
      h('td', { class: 'num' }, Math.round(p.ovr + p.gr)),
      h('td', { class: 'num' }, p.pot),
      h('td', null, h('span', { class: 'role-badge' + (p.role.fam === 2 ? ' role-plusplus' : p.role.fam === 1 ? ' role-plus' : '') }, p.role.label + (p.role.fam ? '+' : ''))),
      h('td', null, focusSel),
      h('td', null, intSel),
      h('td', null, String(Math.round(p.mor))),
      h('td', null, p.frm.toFixed(1)),
      h('td', null, Math.round(p.fit) + '%')));
  }
  table.append(thead, tbody);
  wrap.append(h('div', { class: 'card' }, h('div', { class: 'card-sub' }, 'Development plans shape how players grow. High intensity = faster growth but higher injury risk. Players under 23 grow fastest when they play.'), table));
  return wrap;
}

// ================= TRANSFERS =================
let trTab = 'search';
let trQuery = { name: '', pos: 'ALL', ageMin: 16, ageMax: 40, ovrMin: 0, ovrMax: 99, league: 'ALL' };
export function renderTransfers(G) {
  const root = h('div');
  const club = userClub(G);
  root.append(h('div', { class: 'screen-title' }, '💼 Transfers'));
  root.append(h('div', { class: 'grid grid-3', style: 'margin-bottom:14px' },
    kpi('Transfer budget', fmtMoney(club.tb)), kpi('Wage budget', fmtWage(club.wb)), kpi('Incoming offers', String(G.offers.filter(o => !o.responded).length)),
  ));
  root.append(h('div', { class: 'tabs' },
    tabBtn('Search', trTab === 'search', () => { trTab = 'search'; rerender(); }),
    tabBtn('Shortlist', trTab === 'shortlist', () => { trTab = 'shortlist'; rerender(); }),
    tabBtn(`Transfer hub${G.offers.some(o => !o.responded) ? ' 🔔' : ''}`, trTab === 'hub', () => { trTab = 'hub'; rerender(); }),
    tabBtn('Scouts', trTab === 'scouts', () => { trTab = 'scouts'; rerender(); }),
  ));
  if (trTab === 'search') root.append(searchTab(G));
  else if (trTab === 'shortlist') root.append(shortlistTab(G));
  else if (trTab === 'hub') root.append(hubTab(G));
  else root.append(scoutsTab(G));
  return root;
}

function searchTab(G) {
  const wrap = h('div');
  const filters = h('div', { class: 'card', style: 'margin-bottom:12px' },
    h('div', { class: 'frow' },
      h('div', null, h('label', { class: 'fld' }, 'Name'), h('input', { type: 'text', value: trQuery.name, oninput: e => { trQuery.name = e.target.value; }, placeholder: 'Search players…' })),
      h('div', null, h('label', { class: 'fld' }, 'Position'),
        h('select', { onchange: e => { trQuery.pos = e.target.value; } },
          ...[['ALL', 'Any'], ['GK', 'GK'], ['D', 'Defence'], ['M', 'Midfield'], ['A', 'Attack'], ...POSITIONS.map(p => [p, p])].map(([k, l]) => h('option', { value: k, selected: trQuery.pos === k }, l)))),
      h('div', null, h('label', { class: 'fld' }, 'League'),
        h('select', { onchange: e => { trQuery.league = e.target.value; } },
          h('option', { value: 'ALL', selected: trQuery.league === 'ALL' }, 'Any league'),
          ...Object.values(LEAGUES).map(l => h('option', { value: l.id, selected: trQuery.league === l.id }, l.name)))),
      h('div', null, h('label', { class: 'fld' }, 'OVR min'), h('input', { type: 'number', min: 0, max: 99, value: trQuery.ovrMin, onchange: e => { trQuery.ovrMin = Number(e.target.value); } })),
      h('div', null, h('label', { class: 'fld' }, 'OVR max'), h('input', { type: 'number', min: 0, max: 99, value: trQuery.ovrMax, onchange: e => { trQuery.ovrMax = Number(e.target.value); } })),
      h('div', null, h('label', { class: 'fld' }, 'Age max'), h('input', { type: 'number', min: 16, max: 45, value: trQuery.ageMax, onchange: e => { trQuery.ageMax = Number(e.target.value); } })),
    ),
    h('button', { class: 'btn btn-primary', onclick: () => { applySearch(G, wrap); } }, '🔍 Search'),
  );
  wrap.append(filters);
  const results = h('div');
  wrap.append(results);
  return wrap;
}
function applySearch(G, wrap) {
  const results = wrap.querySelector('.search-results') || (() => { const el = h('div', { class: 'search-results' }); wrap.append(el); return el; })();
  results.innerHTML = '';
  const q = trQuery;
  const club = userClub(G);
  const out = [];
  for (const p of G.world.players.values()) {
    if (p.retired) continue;
    if (q.name && !p.name.toLowerCase().includes(q.name.toLowerCase())) continue;
    if (q.pos !== 'ALL') {
      const grp = p.pos === 'GK' ? 'GK' : ['RB', 'RWB', 'CB', 'LB', 'LWB'].includes(p.pos) ? 'D' : ['CDM', 'CM', 'CAM', 'RM', 'RW', 'LM', 'LW'].includes(p.pos) ? 'M' : 'A';
      if (q.pos.length === 1 ? grp !== q.pos : p.pos !== q.pos) continue;
    }
    const eff = p.ovr + p.gr;
    if (eff < q.ovrMin || eff > q.ovrMax) continue;
    if (p.age > q.ageMax) continue;
    if (q.league !== 'ALL') {
      const c = p.clubId ? G.world.clubs.get(p.clubId) : null;
      if (!c || c.league !== q.league) continue;
    }
    out.push(p);
    if (out.length > 400) break;
  }
  out.sort((a, b) => (b.ovr + b.gr) - (a.ovr + a.gr));
  const tbl = h('div', { class: 'card tbl-wrap' },
    h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, ...[['', ''], ['Player'], ['Age'], ['Nat'], ['Club'], ['Pos'], ['OVR'], ['POT'], ['Value'], ['Wage'], ['', '']].map(([x]) => h('th', null, x)))),
      h('tbody', null, ...out.slice(0, 250).map(p => {
        const c = p.clubId ? G.world.clubs.get(p.clubId) : null;
        const k = knownOf(G, p.id);
        const ovrTxt = k && !k.exact ? `${k.ovr[0]}–${k.ovr[1]}` : String(Math.round(p.ovr + p.gr));
        return h('tr', { style: 'cursor:pointer', onclick: () => showPlayerModal(G, p.id) },
          h('td', null, c ? crestEl(c, 18) : '🆓'),
          h('td', { style: 'font-weight:700' }, esc(p.name)),
          h('td', null, p.age),
          h('td', null, `${flag(p.nat)} ${NAT_NAME[p.nat] || p.nat}`),
          h('td', null, c ? c.short : 'Free agent'),
          h('td', null, h('span', { class: 'pos-chip' }, p.pos)),
          h('td', { class: `num ${ratingClass(p.ovr)}` }, ovrTxt),
          h('td', { class: 'num' }, k && !k.exact ? `${k.pot[0]}–${k.pot[1]}` : p.pot),
          h('td', { class: 'num' }, fmtMoney(playerValue(p, G.world) * 1e6)),
          h('td', { class: 'num' }, fmtWage(p.ctr.w)),
          h('td', null, h('button', { class: 'btn btn-sm', onclick: e => { e.stopPropagation(); showPlayerModal(G, p.id); } }, 'View')),
        );
      }))));
  results.append(tbl);
}

function shortlistTab(G) {
  const wrap = h('div');
  if (!G.user.shortlist.length) return wrap.append(h('div', { class: 'empty' }, 'Your shortlist is empty. Search for players and add them.'));
  const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(165px,1fr))' });
  for (const pid of G.user.shortlist) {
    const p = G.world.players.get(pid);
    if (!p) continue;
    const c = p.clubId ? G.world.clubs.get(p.clubId) : null;
    const slFace = playerFaceEl(p, 150, 96); slFace.style.width = '100%';
    grid.append(h('div', { class: 'pcard' },
      h('div', { class: 'pcard-top' },
        h('div', { class: 'pcard-ovr' }, h('div', { class: 'pcard-ovr-num' }, String(Math.round(p.ovr + p.gr))), h('div', { class: 'ovr-sub' }, p.pos)),
        h('div', { class: 'pcard-badges' }, h('button', { class: 'btn btn-sm btn-danger', title: 'Remove from shortlist', onclick: () => { G.user.shortlist = G.user.shortlist.filter(x => x !== pid); rerender(); } }, '✕'))),
      slFace,
      h('div', { class: 'pcard-name' }, esc(p.name)),
      h('div', { class: 'pcard-meta' }, h('span', null, c ? c.short : 'Free agent'), h('span', null, fmtMoney(playerValue(p, G.world) * 1e6))),
      h('button', { class: 'btn btn-sm btn-primary btn-block', onclick: () => showPlayerModal(G, p.id) }, 'View'),
    ));
  }
  wrap.append(grid);
  return wrap;
}

function hubTab(G) {
  const wrap = h('div');
  const club = userClub(G);
  // offers in
  const active = G.offers.filter(o => !o.responded);
  const card1 = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Offers for your players'), h('div', { class: 'card-sub' }, 'Offers expire after 12 days')),
    active.length ? h('div', null, ...active.map(o => {
      const p = G.world.players.get(o.pid);
      const from = G.world.clubs.get(o.from);
      if (!p || !from) return null;
      return h('div', { class: 'obj-row', style: 'background:var(--bg2);padding:8px;border-radius:8px' },
        h('div', { class: 'obj-label' },
          h('div', { style: 'font-weight:700' }, `${p.name} → ${from.name}`),
          h('div', { class: 'screen-sub' }, o.type === 'buy' ? `${fmtMoney(o.fee * 1e6)} · ${fmtWage(o.wage)} wages · expires ${fmtDateShort(o.until)}` : `Loan offer · ${o.wageShare}% wages · expires ${fmtDateShort(o.until)}`)),
        h('button', { class: 'btn btn-sm btn-primary', onclick: () => doOffer(G, o, 'accept') }, 'Accept'),
        o.type === 'buy' ? h('button', { class: 'btn btn-sm', onclick: () => counterOfferModal(G, o) }, 'Counter') : null,
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => doOffer(G, o, 'reject') }, 'Reject'),
      );
    })) : h('div', { class: 'empty' }, 'No active offers. Transfer-list players to attract bids.'));
  wrap.append(card1);
  // listings
  const listings = G.userListings || {};
  const card2 = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Your listings')),
    Object.keys(listings).length ? h('div', null, ...Object.entries(listings).map(([pid, l]) => {
      const p = G.world.players.get(pid);
      if (!p) return null;
      return h('div', { class: 'obj-row', style: 'background:var(--bg2);padding:8px;border-radius:8px;margin-bottom:6px' },
        h('div', { class: 'obj-label' }, h('div', { style: 'font-weight:700' }, p.name), h('div', { class: 'screen-sub' }, l.type === 'sell' ? `Transfer-listed${l.price ? ` at ${fmtMoney(l.price * 1e6)}` : ''}` : 'Available for loan')),
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { unlistPlayer(G, pid); rerender(); } }, 'Remove'));
    })) : h('div', { class: 'empty' }, 'Use the player profile to transfer-list or loan-list players.'));
  wrap.append(card2);
  // contract alerts
  const alerts = club.squad.map(id => G.world.players.get(id)).filter(p => p && p.ctr.y <= 1);
  if (alerts.length) {
    wrap.append(h('div', { class: 'card' },
      h('div', { class: 'card-title', style: 'margin-bottom:8px' }, '⚠️ Contracts expiring this season'),
      h('div', null, ...alerts.map(p => h('div', { class: 'obj-row' },
        h('div', { class: 'obj-label' }, esc(p.name)), h('button', { class: 'btn btn-sm', onclick: () => renewModal(G, p.id) }, 'Renew')))),
    ));
  }
  return wrap;
}
function doOffer(G, o, action) {
  if (action === 'counter') return;
  const r = respondOffer(G, o.id, action);
  if (!r.ok) toast(r.msg || 'Offer not possible.', 'error');
  rerender();
}
function counterOfferModal(G, o) {
  const p = G.world.players.get(o.pid);
  const input = h('input', { type: 'number', value: o.fee });
  const m = modal({
    title: `Counter ${G.world.clubs.get(o.from).name}`,
    body: h('div', null,
      h('p', { class: 'modal-msg', style: 'margin-bottom:10px' }, `They bid ${fmtMoney(o.fee * 1e6)} for ${p.name}. Their maximum is likely around ${fmtMoney(o.maxFee * 1e6)}.`),
      h('label', { class: 'fld' }, 'Your asking fee (€M)'), input),
    footer: h('button', { class: 'btn btn-primary', onclick: () => {
      const r = respondOffer(G, o.id, 'counter', Number(input.value));
      if (r.ok) { m.close(); toast('Deal agreed!'); } else { m.close(); toast(r.msg || 'They refused.', 'error'); }
      rerender();
    } }, 'Send counter'),
  });
}

function scoutsTab(G) {
  const wrap = h('div');
  const club = userClub(G);
  const card = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, `Your scouts (${club.scouts.length}/5)`),
      h('button', { class: 'btn btn-sm', onclick: () => hireScoutModal(G) }, '+ Hire scout')),
    h('div', null, ...club.scouts.map(s => scoutRowEl(G, s))),
  );
  wrap.append(card);
  // reports
  const reports = G.scoutReports.slice(0, 30);
  wrap.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Latest scout reports')),
    reports.length ? h('div', null, ...reports.slice(0, 12).map(r => {
      const p = G.world.players.get(r.pid);
      if (!p) return null;
      const c = p.clubId ? G.world.clubs.get(p.clubId) : null;
      return h('div', { class: 'obj-row', style: 'cursor:pointer', onclick: () => showPlayerModal(G, p.id) },
        h('div', { class: 'obj-label' }, h('div', { style: 'font-weight:700' }, `${p.name} (${p.pos}, ${p.age})`), h('div', { class: 'screen-sub' }, `${c ? c.short : 'Free agent'} · OVR ${r.ovr[0]}–${r.ovr[1]} · POT ${r.pot[0]}–${r.pot[1]} · ${fmtDateShort(r.d)}`)),
        h('span', { class: 'screen-sub' }, fmtMoney(r.val * 1e6)),
      );
    })) : h('div', { class: 'empty' }, 'Assign scouts to instructions to receive reports.')));
  return wrap;
}
function scoutRowEl(G, s) {
  const stars = '★'.repeat(s.quality) + '☆'.repeat(5 - s.quality);
  const judge = '👁'.repeat(s.judge) + '·'.repeat(5 - s.judge);
  const row = h('div', { style: 'background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:8px' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px' },
      h('div', null, h('div', { style: 'font-weight:700' }, s.name), h('div', { class: 'screen-sub' }, `${stars} · Judgment ${judge} · ${fmtWage(s.wage)}`)),
      h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { clubRemoveScout(G, s); rerender(); } }, 'Release')),
    h('div', { class: 'frow', style: 'margin:0' },
      h('div', null, h('label', { class: 'fld' }, 'Position'),
        h('select', { onchange: e => { s.assignment = s.assignment || {}; s.assignment.pos = e.target.value; } },
          ...[['ALL', 'Any'], ['GK', 'GK'], ['D', 'Defence'], ['M', 'Midfield'], ['A', 'Attack']].map(([k, l]) => h('option', { value: k, selected: (s.assignment?.pos || 'ALL') === k }, l)))),
      h('div', null, h('label', { class: 'fld' }, 'Region'),
        h('select', { onchange: e => { s.assignment = s.assignment || {}; s.assignment.region = e.target.value; } },
          h('option', { value: 'Worldwide', selected: (s.assignment?.region || 'Worldwide') === 'Worldwide' }, 'Worldwide'),
          h('option', { value: 'HOME', selected: s.assignment?.region === 'HOME' }, `Home nation (${clubCountry(G)})`),
          ...['ENG', 'ESP', 'GER', 'ITA', 'FRA', 'BRA', 'ARG', 'POR', 'NED', 'NGA', 'SEN', 'JPN', 'KOR', 'USA', 'MAR', 'TUR', 'KSA', 'CRO', 'SRB'].map(n => h('option', { value: n, selected: s.assignment?.region === n }, NAT_NAME[n] || n)))),
      h('div', null, h('label', { class: 'fld' }, 'Max age'), h('input', { type: 'number', value: s.assignment?.ageMax ?? 30, onchange: e => { s.assignment = s.assignment || {}; s.assignment.ageMax = Number(e.target.value); } })),
      h('div', null, h('label', { class: 'fld' }, 'Min potential'), h('input', { type: 'number', value: s.assignment?.potMin ?? 0, onchange: e => { s.assignment = s.assignment || {}; s.assignment.potMin = Number(e.target.value); } })),
    ));
  return row;
}
function clubCountry(G) { return userClub(G).ctry; }
function clubRemoveScout(G, s) {
  const club = userClub(G);
  club.scouts = club.scouts.filter(x => x.id !== s.id);
}
function hireScoutModal(G) {
  const club = userClub(G);
  if (club.scouts.length >= 5) return toast('Maximum 5 scouts.', 'error');
  const pool = G.world.scoutsPool.slice(0, 12);
  const m = modal({
    title: 'Hire a scout', wide: true,
    body: h('div', null, ...pool.map(s => {
      const stars = '★'.repeat(s.quality) + '☆'.repeat(5 - s.quality);
      return h('div', { class: 'club-pick', onclick: () => {
        G.world.scoutsPool = G.world.scoutsPool.filter(x => x.id !== s.id);
        club.scouts.push(s);
        m.close(); rerender(); toast(`${s.name} joined your scouting team!`, 'success');
      } },
      h('div', { class: 'cp-info' }, h('div', { class: 'cp-name' }, s.name), h('div', { class: 'cp-sub' }, `${stars} · Judgment ${s.judge}/5 · Region: ${s.region} · ${fmtWage(s.wage)}`)),
      );
    })),
  });
}

// ================= ACADEMY =================
export function renderAcademy(G) {
  const root = h('div');
  const club = userClub(G);
  root.append(h('div', { class: 'screen-title' }, `🎓 ${club.name} — Youth Academy`));
  const q = club.scouts.length ? Math.max(...club.scouts.map(s => s.quality)) : 2;
  root.append(h('div', { class: 'grid grid-3', style: 'margin-bottom:14px' },
    kpi('Academy players', String(club.youth.length)),
    kpi('Best scout', '★'.repeat(q) + '☆'.repeat(5 - q)),
    kpi('Promotions this season', String(club.youthPromo || 0)),
  ));
  const players = club.youth.map(id => G.world.players.get(id)).filter(Boolean).sort((a, b) => b.pot - a.pot);
  const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(175px,1fr))' });
  for (const p of players) {
    const el = h('div', { class: 'pcard' });
    const acFace = playerFaceEl(p, 150, 96); acFace.style.width = '100%';
    el.append(
      h('div', { class: 'pcard-top' },
        h('div', { class: 'pcard-ovr' }, h('div', { class: 'pcard-ovr-num' }, String(Math.round(p.ovr + p.gr))), h('div', { class: 'ovr-sub' }, p.pos)),
        h('div', { class: 'pcard-badges' })),
      acFace,
      h('div', { class: 'pcard-name' }, esc(p.name)),
      h('div', { class: 'pcard-meta' }, h('span', null, `${flag(p.nat)} ${p.age}yo`), h('span', { class: 'pcard-pot', style: p.pot >= 85 ? 'color:var(--gold)' : '' }, `★ ${p.pot}`)),
      h('button', { class: 'btn btn-sm', disabled: p.age < 16, title: p.age < 16 ? 'Too young to promote' : '', onclick: () => {
        if (promoteYouth(G, p.id)) { club.youthPromo = (club.youthPromo || 0) + 1; toast(`${p.name} promoted to the first team!`, 'success'); rerender(); }
      } }, p.age < 16 ? 'Too young' : '⬆ Promote'),
    );
    grid.append(el);
  }
  root.append(grid);
  return root;
}

// ================= SEASON =================
let seasonTab = 'league';
let seasonLeague = null;
export function renderSeason(G) {
  const root = h('div');
  root.append(h('div', { class: 'screen-title' }, '📅 Season ' + G.year + '/' + (G.year + 1)));
  if (!seasonLeague) seasonLeague = userClub(G).league;
  root.append(h('div', { class: 'tabs' },
    tabBtn('League', seasonTab === 'league', () => { seasonTab = 'league'; rerender(); }),
    tabBtn('Stats', seasonTab === 'stats', () => { seasonTab = 'stats'; rerender(); }),
    tabBtn('Cups', seasonTab === 'cups', () => { seasonTab = 'cups'; rerender(); }),
    tabBtn('Europe', seasonTab === 'europe', () => { seasonTab = 'europe'; rerender(); }),
    tabBtn('Calendar', seasonTab === 'cal', () => { seasonTab = 'cal'; rerender(); }),
  ));
  if (seasonTab === 'league') root.append(leagueTab(G));
  else if (seasonTab === 'stats') root.append(statsTab(G));
  else if (seasonTab === 'cups') root.append(cupsTab(G));
  else if (seasonTab === 'europe') root.append(europeTab(G));
  else root.append(calTab(G));
  return root;
}
function leagueTab(G) {
  const wrap = h('div');
  wrap.append(h('div', { class: 'comp-sel', style: 'max-width:340px;margin-bottom:10px' },
    h('select', { style: 'width:auto', onchange: e => { seasonLeague = e.target.value; rerender(); } },
      ...Object.values(LEAGUES).map(l => h('option', { value: l.id, selected: l.id === seasonLeague }, l.name))),
    compLogoEl(seasonLeague, 26)));
  const t = tableSorted(G, seasonLeague);
  const lg = LEAGUES[seasonLeague];
  const promoN = (() => { for (const l of Object.values(LEAGUES)) if (l.proRel && l.proRel.upTo === seasonLeague) return l.proRel.n; return 0; })();
  const relN = lg.proRel ? lg.proRel.n : 0;
  const wrap2 = h('div', { class: 'card tbl-wrap' });
  wrap2.append(h('table', { class: 'tbl' },
    h('thead', null, h('tr', null, ...[['', ''], ['Club'], ['P'], ['W'], ['D'], ['L'], ['GF'], ['GA'], ['GD'], ['Pts'], ['Form']].map(([x]) => h('th', null, x)))),
    h('tbody', null, ...t.map((r, i) => {
      const c = G.world.clubs.get(r.id);
      const promo = promoN > 0 && i < promoN;
      const rel = relN > 0 && i >= t.length - relN;
      return h('tr', { class: r.id === G.user.clubId ? 'sel' : '' },
        h('td', { class: 'num' }, i + 1),
        h('td', null, crestEl(c, 18), h('span', { style: 'margin-left:6px;font-weight:600' }, c.name), promo ? ' ⬆' : rel ? ' ⬇' : ''),
        h('td', { class: 'num' }, r.p), h('td', { class: 'num' }, r.w), h('td', { class: 'num' }, r.d), h('td', { class: 'num' }, r.l),
        h('td', { class: 'num' }, r.gf), h('td', { class: 'num' }, r.ga), h('td', { class: 'num' }, r.gf - r.ga),
        h('td', { class: 'num', style: 'font-weight:800' }, r.pts),
        h('td', null, formStripEl(G, r.id)),
      );
    }))));
  wrap.append(wrap2);
  return wrap;
}
function statsTab(G) {
  const wrap = h('div');
  const players = [];
  for (const c of clubsInLeague(G, seasonLeague)) for (const id of c.squad) { const p = G.world.players.get(id); if (p && p.sta.a > 0) players.push(p); }
  const boot = players.slice().sort((a, b) => b.sta.g - a.sta.g).slice(0, 10);
  const play = players.slice().sort((a, b) => b.sta.as - a.sta.as).slice(0, 10);
  const glove = players.filter(p => p.pos === 'GK').sort((a, b) => b.sta.cs - a.sta.cs).slice(0, 10);
  const rated = players.filter(p => p.sta.rn >= 3).sort((a, b) => (b.sta.rs / b.sta.rn) - (a.sta.rs / a.sta.rn)).slice(0, 10);
  const mk = (title, rows, val) => h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:8px' }, title),
    h('div', null, ...rows.map((p, i) => {
      const c = p.clubId ? G.world.clubs.get(p.clubId) : null;
      return h('div', { class: 'obj-row' },
        h('span', { style: 'width:20px;color:var(--dim)' }, i + 1),
        h('div', { class: 'obj-label' }, esc(p.name), h('div', { class: 'screen-sub' }, c ? c.short : '')),
        h('b', null, val(p)));
    })));
  wrap.append(h('div', { class: 'grid grid-2' },
    mk('Top scorers', boot, p => p.sta.g),
    mk('Top assists', play, p => p.sta.as),
    mk('Clean sheets', glove, p => p.sta.cs),
    mk('Avg rating', rated, p => (p.sta.rs / p.sta.rn).toFixed(2)),
  ));
  return wrap;
}
function cupsTab(G) {
  const wrap = h('div');
  const cups = Object.values(CUPS).filter(c => c.country === userClub(G).ctry && c.type === 'cup');
  for (const cup of cups) {
    const st = G.sched.cups[cup.id];
    const card = h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, compNameEl(cup.id, cup.name, 20)),
        h('div', { class: 'card-sub' }, st && st.winner ? `Winners: ${G.world.clubs.get(st.winner)?.name}` : st ? `Next round: ${st.round}` : '')));
    if (st) {
      const all = [...(st.history || []), ...(st.matches.length ? [{ round: st.round, matches: st.matches }] : [])];
      for (const r of all) {
        card.append(h('div', { style: 'margin:8px 0 4px;font-weight:700;font-size:12px;color:var(--dim)' }, r.round === 1 ? 'First round' : `Round ${r.round}`));
        const t = h('table', { class: 'tbl' }, h('tbody', null, ...r.matches.map(m => {
          const res = G.results[m.id];
          const hc = G.world.clubs.get(m.home), ac = G.world.clubs.get(m.away);
          return h('tr', { style: 'cursor:pointer', onclick: () => res && showResultModal(G, m) },
            h('td', null, hc ? hc.name : m.home),
            h('td', { class: 'num', style: 'font-weight:800' }, res ? `${res.hg}–${res.ag}` : 'vs'),
            h('td', null, ac ? ac.name : m.away),
            h('td', { class: 'screen-sub', style: 'width:90px;text-align:right' }, fmtDateShort(m.date)),
          );
        })));
        card.append(t);
      }
    }
    wrap.append(card);
  }
  return wrap;
}
function europeTab(G) {
  const wrap = h('div');
  for (const compId of ['UCL', 'UEL', 'UCL2']) {
    const key = compId === 'UCL' ? 'ucl' : compId === 'UEL' ? 'uel' : 'uecl';
    const st = G.sched.euro[key];
    if (!st || !st.teams) continue;
    const card = h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, compNameEl(compId, UEFA[compId].name, 20)),
        h('div', { class: 'card-sub' }, st.winner ? `Champions: ${G.world.clubs.get(st.winner)?.name}` : st.state === 'lp' ? 'League phase' : `Knockouts — ${st.round}`)));
    if (st.state === 'lp' || st.state === 'ko') {
      const t = tableSorted(G, compId);
      card.append(h('div', { class: 'tbl-wrap', style: 'max-height:300px' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ...[['#'], ['Club'], ['P'], ['W'], ['D'], ['L'], ['GD'], ['Pts']].map(([x]) => h('th', null, x)))),
        h('tbody', null, ...t.map((r, i) => {
          const c = G.world.clubs.get(r.id);
          const zone = i < 8 ? '🟢' : i < 24 ? '🟡' : '🔴';
          return h('tr', { class: r.id === G.user.clubId ? 'sel' : '' },
            h('td', null, `${i + 1} ${zone}`),
            h('td', null, crestEl(c, 16), h('span', { style: 'margin-left:5px' }, c.name)),
            h('td', { class: 'num' }, r.p), h('td', { class: 'num' }, r.w), h('td', { class: 'num' }, r.d), h('td', { class: 'num' }, r.l),
            h('td', { class: 'num' }, r.gf - r.ga), h('td', { class: 'num', style: 'font-weight:800' }, r.pts));
        })))));
    }
    if (st.state === 'ko') {
      const rounds = [['playoff', 'Knockout play-offs'], ['r16', 'Round of 16'], ['qf', 'Quarter-finals'], ['sf', 'Semi-finals'], ['final', 'Final']];
      for (const [r, label] of rounds) {
        const pairs = st[r];
        if (!pairs) continue;
        const list = (r === 'final' ? [pairs] : pairs).map(pair => {
          const hc = G.world.clubs.get(pair[0]), ac = pair[1] ? G.world.clubs.get(pair[1]) : null;
          return h('div', { class: 'obj-row' }, h('div', { class: 'obj-label' }, `${hc?.name || pair[0]} ${ac ? 'vs ' + ac.name : ''}`), h('span', { class: 'screen-sub' }, (st[`${r}Matches`] || []).length ? '2 legs' : ''));
        });
        card.append(h('div', { style: 'margin:8px 0 4px;font-weight:700;font-size:12px;color:var(--dim)' }, label), h('div', null, ...list));
      }
    }
    wrap.append(card);
  }
  return wrap;
}
function calTab(G) {
  const wrap = h('div');
  const days = [];
  for (let i = -7; i <= 21; i++) {
    const d = addDays(G.date, i);
    days.push([d, G.cal.get(d) || []]);
  }
  for (const [d, arr] of days) {
    const card = h('div', { class: 'card', style: 'margin-bottom:8px' },
      h('div', { class: 'card-head' }, h('div', { class: 'card-title', style: 'text-transform:none;font-size:13px' }, `${fmtDate(d)}${d === G.date ? ' · TODAY' : ''}`)));
    if (!arr.length) card.append(h('div', { class: 'screen-sub' }, 'No fixtures'));
    else for (const m of arr) {
      const res = G.results[m.id];
      const user = isUserMatch(G, m);
      const hc = m.nt ? null : G.world.clubs.get(m.home);
      const ac = m.nt ? null : G.world.clubs.get(m.away);
      const hn = m.nt ? (G.world.nts.find(n => n.id === m.tnat?.h) || {}).name : hc?.name;
      const an = m.nt ? (G.world.nts.find(n => n.id === m.tnat?.a) || {}).name : ac?.name;
      card.append(h('div', { class: 'obj-row', style: user ? 'background:rgba(182,255,46,.06);border-radius:6px;padding:3px 6px' : 'padding:3px 6px', onclick: () => res && showResultModal(G, m) },
        h('div', { class: 'obj-label' }, `${hn || m.home} ${res ? `${res.hg}–${res.ag}` : 'vs'} ${an || m.away}`),
        h('span', { class: 'screen-sub', style: 'display:inline-flex;align-items:center;gap:5px' }, compLogoEl(m.comp, 13), `${compLabel(m, G)}${user ? ' · YOUR MATCH' : ''}`)));
    }
    wrap.append(card);
  }
  return wrap;
}

// ================= CLUB =================
export function renderClub(G) {
  const root = h('div');
  const club = userClub(G);
  root.append(h('div', { class: 'screen-title' }, `🏛️ ${club.name} — Club`));
  root.append(h('div', { class: 'grid grid-4', style: 'margin-bottom:14px' },
    kpi('Balance', fmtMoney(club.bal)), kpi('Transfer budget', fmtMoney(club.tb)),
    kpi('Wage bill', fmtWage(totalWages(G.world, club))), kpi('Board rating', `${club.rating}/100`)));
  const grid = h('div', { class: 'grid grid-2' });
  grid.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'Board confidence')),
    meterEl(club.rating),
    h('div', { class: 'screen-sub', style: 'margin-top:6px' }, club.rating < 25 ? 'The board are losing patience…' : club.rating >= 75 ? 'The board are delighted with your work.' : 'The board are satisfied.'),
    h('div', { style: 'height:14px' }),
    ...(club.objectives || []).map(o => objRowEl(G, o, club)),
  ));
  grid.append(h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:10px' }, 'Manager'),
    h('div', { style: 'font-weight:800;font-size:16px' }, esc(G.manager.name)),
    h('div', { class: 'screen-sub', style: 'margin-bottom:8px' }, `${flag(G.manager.nat)} ${NAT_NAME[G.manager.nat] || G.manager.nat} · ${G.manager.style}`),
    h('div', { class: 'screen-sub' }, `In charge of ${club.name} since ${G.year} · Seasons: ${G.hist.seasons.length}`),
    h('div', { style: 'height:10px' }),
    h('button', { class: 'btn btn-sm', onclick: () => resignModal(G) }, 'Resign'),
    h('button', { class: 'btn btn-sm btn-danger', style: 'margin-left:6px', onclick: () => retireModal(G) }, 'Retire'),
  ));
  root.append(grid);
  // job offers
  if (G.jobOffers.length) {
    root.append(h('div', { class: 'card' },
      h('div', { class: 'card-title', style: 'margin-bottom:8px' }, '📩 Job offers'),
      h('div', null, ...G.jobOffers.map(o => {
        const c = G.world.clubs.get(o.clubId);
        if (!c) return null;
        return h('div', { class: 'obj-row' },
          h('div', { class: 'obj-label' }, h('div', { style: 'font-weight:700' }, c.name), h('div', { class: 'screen-sub' }, o.note)),
          h('button', { class: 'btn btn-sm btn-primary', onclick: async () => {
            if (await confirmBox('Accept job?', `Take over as manager of ${c.name}? You will leave ${club.name}.`)) {
              const { switchClub } = await import('../state.js');
              switchClub(G, c.id);
              G.jobOffers = [];
              toast(`You are the new manager of ${c.name}!`, 'success');
              rerender();
            }
          } }, 'Accept'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { G.jobOffers = G.jobOffers.filter(x => x !== o); rerender(); } }, 'Decline'));
      }))));
  }
  // history
  if (G.hist.seasons.length) {
    root.append(h('div', { class: 'card' },
      h('div', { class: 'card-title', style: 'margin-bottom:8px' }, 'Season history'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ...[['Season'], ['Club'], ['League'], ['Finish']].map(([x]) => h('th', null, x)))),
        h('tbody', null, ...G.hist.seasons.map(s => h('tr', null,
          h('td', null, `${s.year}/${s.year + 1}`),
          h('td', null, G.world.clubs.get(s.club)?.name || '—'),
          h('td', null, LEAGUES[s.league] ? compNameEl(s.league, LEAGUES[s.league].name, 16) : '—'),
          h('td', null, s.pos ? `${s.pos}${ord(s.pos)}` : '—'))))))));
  }
  return root;
}
function resignModal(G) {
  confirmBox('Resign?', 'Leave your job? You will enter the job market and can accept offers from other clubs.', 'Resign', true).then(yes => {
    if (!yes) return;
    G.careerState = 'unemployed';
    toast('You have resigned.', 'success');
  });
}
function retireModal(G) {
  confirmBox('Retire?', 'End your managerial career and see your legacy summary.', 'Retire', true).then(yes => {
    if (!yes) return;
    G.careerState = 'retired';
    toast('Career over.', 'success');
  });
}

// ================= NEWS =================
let newsFilter = 'All';
export function renderNews(G) {
  const root = h('div');
  root.append(h('div', { class: 'screen-title' }, '📰 News'));
  const cats = ['All', ...new Set(G.news.map(n => n.cat || 'News'))];
  root.append(h('div', { class: 'tabs' }, ...cats.map(c => tabBtn(c, newsFilter === c, () => { newsFilter = c; rerender(); }))));
  const items = G.news.filter(n => newsFilter === 'All' || (n.cat || 'News') === newsFilter);
  const wrap = h('div', { class: 'card' });
  for (const n of items) {
    const el = newsRowEl(G, n);
    wrap.append(el);
  }
  if (!items.length) wrap.append(h('div', { class: 'empty' }, 'No news yet.'));
  root.append(wrap);
  return root;
}

// ================= INTERNATIONAL =================
let intlTab = 'squad';
export function renderIntl(G) {
  const root = h('div');
  const job = G.user.ntJob;
  if (!job) {
    root.append(h('div', { class: 'screen-title' }, '🌍 International'));
    const card = h('div', { class: 'card' },
      h('div', { class: 'card-sub', style: 'margin-bottom:8px' }, 'You are not managing a national team. Win trophies and keep your reputation high to receive offers.'),
      G.ntOffers.length ? h('div', null, ...G.ntOffers.map(o => {
        const nt = G.world.nts.find(n => n.id === o.nat);
        return h('div', { class: 'obj-row' },
          h('div', { class: 'obj-label' }, h('div', { style: 'font-weight:700' }, `${flag(o.nat)} ${nt?.name}`), h('div', { class: 'screen-sub' }, 'National team job offer')),
          h('button', { class: 'btn btn-sm btn-primary', onclick: () => { G.user.ntJob = o.nat; G.ntOffers = []; toast(`You now manage ${nt.name}!`, 'success'); rerender(); } }, 'Accept'),
          h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { G.ntOffers = G.ntOffers.filter(x => x !== o); rerender(); } }, 'Decline'));
      })) : null);
    root.append(card);
    // rankings
    root.append(h('div', { class: 'card' },
      h('div', { class: 'card-title', style: 'margin-bottom:8px' }, 'World rankings'),
      h('div', null, ...G.world.nts.slice(0, 15).map((n, i) => h('div', { class: 'obj-row' },
        h('span', { style: 'width:24px;color:var(--dim)' }, i + 1),
        ntCrestEl(n, 18),
        h('div', { class: 'obj-label' }, n.name),
        h('b', null, Math.round(n.strength)))))));
    return root;
  }
  const nt = G.world.nts.find(n => n.id === job);
  root.append(h('div', { class: 'screen-title' }, ntCrestEl(nt, 30), `${nt.name} (FIFA #${nt.rank})`));
  root.append(h('div', { class: 'tabs' },
    tabBtn('Squad', intlTab === 'squad', () => { intlTab = 'squad'; rerender(); }),
    tabBtn('Fixtures', intlTab === 'fix', () => { intlTab = 'fix'; rerender(); }),
    tabBtn('Tournament', intlTab === 'tourn', () => { intlTab = 'tourn'; rerender(); }),
  ));
  if (intlTab === 'squad') {
    const pool = [...G.world.players.values()].filter(p => p.nat === job && !p.retired).sort((a, b) => (b.ovr + b.gr) - (a.ovr + a.gr));
    const squad = G.ntSquads[job] || pool.slice(0, 23).map(p => p.id);
    root.append(h('div', { class: 'card-sub', style: 'margin-bottom:10px' }, `Pick your 23-man squad (currently ${squad.length}).`));
    const grid = h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr))' });
    for (const p of pool) {
      const inSquad = squad.includes(p.id);
      const el = h('div', { class: `pcard${inSquad ? ' sel-highlight' : ''}`, style: inSquad ? '' : 'opacity:.55' });
      el.addEventListener('click', () => {
        let s = G.ntSquads[job] || pool.slice(0, 23).map(x => x.id);
        if (inSquad) s = s.filter(x => x !== p.id);
        else { if (s.length >= 23) return toast('Squad is full (23). Remove someone first.', 'error'); s.push(p.id); }
        G.ntSquads[job] = s;
        rerender();
      });
      const ntFace = playerFaceEl(p, 130, 84); ntFace.style.width = '100%';
      el.append(h('div', { class: 'pcard-top' },
          h('div', { class: 'pcard-ovr' }, h('div', { class: 'pcard-ovr-num' }, String(Math.round(p.ovr + p.gr))), h('div', { class: 'ovr-sub' }, p.pos)),
          h('div', { class: 'pcard-badges' })),
        ntFace,
        h('div', { class: 'pcard-name' }, esc(p.name)),
        h('div', { class: 'pcard-meta' }, h('span', null, p.clubId ? G.world.clubs.get(p.clubId)?.short : 'FA')));
      grid.append(el);
    }
    root.append(grid);
  } else if (intlTab === 'fix') {
    const matches = [];
    for (const arr of G.cal.values()) for (const m of arr) if (m.nt && m.tnat && (m.tnat.h === job || m.tnat.a === job)) matches.push(m);
    matches.sort((a, b) => a.date.localeCompare(b.date));
    const card = h('div', { class: 'card' });
    for (const m of matches.slice(0, 30)) {
      const res = G.results[m.id];
      const hn = (G.world.nts.find(n => n.id === m.tnat.h) || {}).name;
      const an = (G.world.nts.find(n => n.id === m.tnat.a) || {}).name;
      card.append(h('div', { class: 'obj-row' },
        h('div', { class: 'obj-label' }, `${hn} ${res ? `${res.hg}–${res.ag}` : 'vs'} ${an}`),
        h('span', { class: 'screen-sub', style: 'display:inline-flex;align-items:center;gap:5px' }, compLogoEl(m.comp, 13), `${compLabel(m, G)} · ${fmtDateShort(m.date)}`)));
    }
    root.append(card);
  } else {
    const t = G.sched.nt.tourn;
    if (!t) { root.append(h('div', { class: 'empty' }, 'No tournament running.')); return root; }
    for (const comp of t.comps) {
      if (!comp.teams.some(x => x.nat === job)) continue;
      const card = h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, comp.name), h('div', { class: 'card-sub' }, comp.done ? `Winners: ${comp.winner}` : comp.stage)));
      for (let gi = 0; gi < comp.groups.length; gi++) {
        const grp = comp.groups[gi];
        if (!grp.includes(job)) continue;
        const tbl = G.tables[`${comp.key}-G${gi}`] || [];
        const rows = tbl.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
        card.append(h('div', { class: 'card-sub', style: 'margin:6px 0' }, `Group ${String.fromCharCode(65 + gi)}`));
        card.append(h('table', { class: 'tbl' }, h('tbody', null, ...rows.map(r => {
          const nt2 = G.world.nts.find(n => n.id === r.nat);
          return h('tr', null, h('td', null, `${flag(r.nat)} ${nt2?.name}`), h('td', { class: 'num' }, r.p), h('td', { class: 'num' }, r.w), h('td', { class: 'num' }, r.d), h('td', { class: 'num' }, r.l), h('td', { class: 'num' }, r.gf + ':' + r.ga), h('td', { class: 'num', style: 'font-weight:800' }, r.pts));
        }))));
      }
      root.append(card);
    }
  }
  return root;
}

// ================= SETTINGS =================
export function renderSettings(G) {
  const root = h('div');
  root.append(h('div', { class: 'screen-title' }, '⚙️ Settings'));
  const card = h('div', { class: 'card' },
    h('div', { class: 'frow' },
      h('div', null, h('label', { class: 'fld' }, 'Difficulty'),
        h('select', { onchange: e => { G.settings.difficulty = Number(e.target.value); } },
          ...[['0', 'Beginner'], ['1', 'Amateur'], ['2', 'Semi-Pro'], ['3', 'Professional'], ['4', 'World Class'], ['5', 'Legendary']].map(([k, l]) => h('option', { value: k, selected: G.settings.difficulty === Number(k) }, l)))),
      h('div', null, h('label', { class: 'fld' }, 'Default sim speed'),
        h('select', { onchange: e => { G.settings.simSpeed = Number(e.target.value); } },
          ...[['1', '1x'], ['2', '2x'], ['3', '4x'], ['4', '8x']].map(([k, l]) => h('option', { value: k, selected: G.settings.simSpeed === Number(k) }, l)))),
    ),
    h('div', { class: 'chip-row', style: 'margin:10px 0' },
      toggleTag(G.settings.toggles, 'training', 'Training plans'),
      toggleTag(G.settings.toggles, 'transfers', 'Scouting & transfers'),
      toggleTag(G.settings.toggles, 'academy', 'Youth academy'),
      toggleTag(G.settings.toggles, 'lockedClub', 'One-club challenge (no manager moves)'),
      toggleTag(G.settings, 'autosave', 'Autosave'),
    ),
  );
  root.append(card);
  const saveCard = h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:10px' }, 'Save games'),
    h('div', { class: 'chip-row', style: 'margin-bottom:10px' },
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => doSave(G, 1) }, '💾 Save slot 1'),
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => doSave(G, 2) }, '💾 Save slot 2'),
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => doSave(G, 3) }, '💾 Save slot 3'),
    ),
    h('div', { class: 'screen-sub' }, 'Saves are stored locally in your browser.'),
  );
  root.append(saveCard);
  root.append(h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:8px' }, '🗄️ Real database data'),
    h('p', { class: 'screen-sub', style: 'line-height:1.5' }, G.importCount
      ? `${G.importCount} players in this career carry full FC26 database data — every attribute, real wages, contracts, traits and photos${G.importClubsCreated ? `, with ${G.importClubsCreated} clubs created from the data` : ''}.`
      : 'No database players loaded yet. Paste EAFC DB-format CSV in "Import player data" below.'),
    h('p', { class: 'screen-sub', style: 'line-height:1.5;margin-top:6px' }, 'To import a whole database: drop every file (CSV or JSON — CM Tracker exports, Kaggle datasets, SoFIFA-style CSVs, any .json array) into uploads/ and run node tools/build_import.mjs. Merged, deduped by player id, women\'s rows filtered, headshots cached with --cache, report at uploads/import_report.txt.'),
  ));
  root.append(h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:8px' }, '📥 Import player data'),
    h('p', { class: 'screen-sub', style: 'margin-bottom:8px;line-height:1.5' }, 'Have ratings data you want to use? Paste CSV rows (header optional). Matches by name+position and applies every attribute. Format: Name,Club,Pos,Age,Nat,OVR,POT,PAC,SHO,PAS,DRI,DEF,PHY + any substats (Finishing, Sprint Speed, Vision, Interceptions, GK Diving…). See assets/template.csv.'),
    h('textarea', { id: 'import-ta', placeholder: 'CSV or JSON. CSV: Name,Club,Pos,Age,Nat,OVR,POT,PAC,SHO,PAS,DRI,DEF,PHY,Finishing,Sprint Speed,Interceptions…  JSON: [{"name":"…","overall":…}] or the full EAFC export format.', style: 'min-height:110px;font-family:monospace;font-size:11.5px;margin-bottom:8px' }),
    h('button', { class: 'btn btn-primary btn-sm', onclick: async () => {
      const ta = document.querySelector('#import-ta');
      if (!ta || !ta.value.trim()) return toast('Paste some data first.', 'error');
      const { importPlayers } = await import('../engine/import.js');
      const r = importPlayers(G, ta.value);
      if (r.error) toast(r.error, 'error');
      else toast(`Import done: ${r.updated} players updated, ${r.created} created${r.skipped.length ? ', ' + r.skipped.length + ' skipped' : ''}.`, 'success', 4500);
      if (G.settings.autosave) { const { saveGame } = await import('../state.js'); saveGame(G, 0); }
      rerender();
    } }, 'Import now'),
  ));
  root.append(h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:8px' }, '🖼️ Custom artwork'),
    h('p', { class: 'screen-sub', style: 'line-height:1.5' }, 'Drop your own images into the workspace and the game uses them automatically, falling back to generated art:'),
    h('ul', { class: 'screen-sub', style: 'margin:8px 0 0 18px;line-height:1.7' },
      h('li', null, 'Club badges → real crests loaded from football-logos.cc (built in for 788 clubs); the rest use generated crests'),
      h('li', null, 'Player photos → assets/faces/<name>.png — e.g. assets/faces/Bukayo Saka.png')),
  ));
  root.append(h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:8px' }, 'About'),
    h('p', { class: 'screen-sub', style: 'line-height:1.6' }, 'FCM 26 is a fan-made football management career game inspired by EA Sports FC manager career. Player & club names are factual; ratings derive from the public 2026 player database. Club crests courtesy of football-logos.cc; uncovered clubs and all player portraits use original generated artwork. Matches are simulated — you manage everything else.'),
  ));
  return root;
}
function toggleTag(obj, key, label) {
  return h('button', { class: `tag${obj[key] ? ' on' : ''}`, style: 'cursor:pointer', onclick: () => { obj[key] = !obj[key]; rerender(); } }, (obj[key] ? '✓ ' : '') + label);
}
async function doSave(G, slot) {
  const { saveGame } = await import('../state.js');
  const r = saveGame(G, slot);
  if (r.ok) toast(`Saved to slot ${slot} (${Math.round(r.size / 1024)} KB).`, 'success');
  else toast('Save failed: ' + r.err, 'error');
}

// ================= PLAYER MODAL =================
export function showPlayerModal(G, pid) {
  const p = G.world.players.get(pid);
  if (!p) return;
  const club = p.clubId ? G.world.clubs.get(p.clubId) : null;
  const k = knownOf(G, pid);
  const isMine = p.clubId === G.user.clubId;
  const uclub = userClub(G);
  const ovr = Math.round(p.ovr + p.gr);
  const val = playerValue(p, G.world);

  const body = h('div');
  body.append(h('div', { style: 'display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap' },
    playerFaceEl(p, 150, 110),
    h('div', { style: 'flex:1;min-width:220px' },
      h('div', { style: 'display:flex;align-items:center;gap:10px' },
        hexEl(ovr, 54),
        h('div', null,
          h('div', { style: 'font-size:19px;font-weight:800' }, esc(p.name)),
          h('div', { class: 'screen-sub' }, `${posLabel(p.pos)} · ${p.age} yo · ${flag(p.nat)} ${NAT_NAME[p.nat] || p.nat}`),
          h('div', { class: 'screen-sub' }, club ? `${club.name} · Contract ${p.ctr.y}y · ${fmtWage(p.ctr.w)}${p.ctr.r ? ` · Clause ${fmtMoney(p.ctr.r * 1e6)}` : ''}` : 'Free agent'),
          h('div', { class: 'screen-sub' }, `${h('b', null, p.role.label)}${p.role.fam ? '+' : ''} familiarity`))),
      h('div', { style: 'height:8px' }),
      statRowsEl(p),
    ),
  ));
  // info kpis
  body.append(h('div', { class: 'grid grid-4', style: 'margin:12px 0' },
    kpi('Value', fmtMoney(val * 1e6)),
    kpi('Potential', k && !k.exact ? `${k.pot[0]}–${k.pot[1]}` : String(p.pot)),
    kpi('Morale', `${Math.round(p.mor)}`),
    kpi('Fitness', `${Math.round(p.fit)}%`),
  ));
  // full attribute breakdown
  body.append(h('details', null,
    h('summary', { style: 'cursor:pointer;font-weight:800;margin:8px 0;color:var(--accent)' }, '📊 All ' + (p.pos === 'GK' ? 'goalkeeping' : '') + ' attributes (' + (p.pos === 'GK' ? 6 : 30) + ')'),
    detailedStatsEl(p)));
  if (k && !k.exact) body.append(h('div', { class: 'card-sub', style: 'margin-bottom:8px' }, `🔎 Scout estimate: OVR ${k.ovr[0]}–${k.ovr[1]} · POT ${k.pot[0]}–${k.pot[1]}`));
  // season stats
  body.append(h('div', { class: 'card-sub', style: 'margin-bottom:10px' },
    `Season: ${p.sta.a} apps · ${p.sta.g} goals · ${p.sta.as} assists${p.pos === 'GK' ? ` · ${p.sta.cs} clean sheets` : ''}${p.sta.rn ? ` · rating ${(p.sta.rs / p.sta.rn).toFixed(2)}` : ''}`));
  // real-database profile info
  const prof = p.profile || {};
  if (p.imported) {
    const bits = [];
    if (prof.foot) bits.push(h('span', { class: 'tag' }, (prof.foot === 'Left' ? '🦶 Left' : prof.foot === 'Right' ? '🦶 Right' : prof.foot)));
    if (prof.sm) bits.push(h('span', { class: 'tag', title: 'Skill moves' }, '⭐'.repeat(Math.min(5, prof.sm)) + ' SM'));
    if (prof.wf) bits.push(h('span', { class: 'tag', title: 'Weak foot' }, '⭐'.repeat(Math.min(5, prof.wf)) + ' WF'));
    if (prof.height) bits.push(h('span', { class: 'tag' }, `${prof.height}cm`));
    if (prof.weight) bits.push(h('span', { class: 'tag' }, `${prof.weight}kg`));
    if (prof.shirt) bits.push(h('span', { class: 'tag' }, `#${prof.shirt}`));
    if (prof.realface) bits.push(h('span', { class: 'tag', style: 'background:rgba(25,227,177,.15);color:var(--accent2)' }, '★ REAL FACE'));
    if (p.imported) bits.push(h('span', { class: 'tag', style: 'background:rgba(182,255,46,.15);color:var(--accent)' }, '🗄️ DB DATA'));
    if (bits.length) body.append(h('div', { class: 'chip-row', style: 'margin-bottom:8px' }, ...bits));
    if (prof.traits) body.append(h('div', { class: 'card-sub', style: 'margin-bottom:8px' }, `🎯 Traits: ${prof.traits}`));
    if (prof.alt && prof.alt.length) body.append(h('div', { class: 'card-sub', style: 'margin-bottom:8px' }, `Other positions: ${prof.alt.join(' · ')}`));
  }

  const actions = h('div', { class: 'chip-row' });
  if (isMine) {
    actions.append(
      h('button', { class: 'btn btn-sm', onclick: () => renewModal(G, pid) }, '✍️ Contract'),
      h('button', { class: 'btn btn-sm', onclick: () => { listPlayer(G, pid, 'sell'); toast(`${p.name} transfer-listed.`); rerender(); } }, '📋 Transfer list'),
      h('button', { class: 'btn btn-sm', onclick: () => { listPlayer(G, pid, 'loan'); toast(`${p.name} made available for loan.`); rerender(); } }, '🔄 Loan list'),
      h('button', { class: 'btn btn-sm btn-danger', onclick: async () => { if (await confirmBox('Release player?', `Release ${p.name}? You will pay ~${fmtMoney(p.ctr.w * p.ctr.y * 52 * 500)} in severance.`, 'Release', true)) { releasePlayer(G, pid); toast(`${p.name} released.`); rerender(); } } }, '🗑️ Release'),
    );
  } else {
    actions.append(
      h('button', { class: 'btn btn-sm', onclick: () => { G.user.shortlist = G.user.shortlist || []; if (!G.user.shortlist.includes(pid)) { G.user.shortlist.push(pid); toast('Added to shortlist.', 'success'); } } }, '⭐ Shortlist'),
      h('button', { class: 'btn btn-sm', onclick: () => buyModal(G, pid) }, club ? '💶 Approach to buy' : '💶 Sign'),
      club ? h('button', { class: 'btn btn-sm', onclick: () => loanInModal(G, pid) }, '🔄 Loan in') : null,
    );
  }
  body.append(actions);
  modal({ title: `${p.name} — ${posLabel(p.pos)}`, body, wide: true, footer: null });
}

function buyModal(G, pid) {
  const p = G.world.players.get(pid);
  const from = p.clubId ? G.world.clubs.get(p.clubId) : null;
  const val = playerValue(p, G.world);
  const ask = from ? askPrice(p, G.world) : 0;
  const feeInput = h('input', { type: 'number', value: Math.round(from ? val : 0) });
  let stage = 'fee';
  const status = h('div', { class: 'card-sub', style: 'margin-bottom:8px' });
  const m = modal({
    title: from ? `Negotiate with ${from.name}` : `Sign free agent ${p.name}`,
    body: h('div', null,
      status,
      h('div', { id: 'buy-body' },
        h('label', { class: 'fld' }, from ? `Your bid (€M) — guide value ${fmtMoney(val * 1e6)}, they may want ~${fmtMoney(ask * 1e6)}` : 'No transfer fee (free agent)'),
        from ? feeInput : null),
    ),
    footer: [
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', id: 'buy-go', onclick: () => step() }, from ? 'Make offer' : 'Offer contract'),
    ],
  });
  function step() {
    if (stage === 'fee' && from) {
      const r = aiSellResponse(G, pid, Number(feeInput.value));
      if (r.status === 'accept') { stage = 'contract'; showContract(r.fee); }
      else if (r.status === 'counter') { status.textContent = r.msg + ' Counter: ' + fmtMoney(r.counter * 1e6) + 'M'; feeInput.value = r.counter; }
      else { status.textContent = r.msg + ' Counter: ' + fmtMoney(r.counter * 1e6) + 'M'; feeInput.value = r.counter; }
    } else if (stage === 'fee') { stage = 'contract'; showContract(0); }
    else finishContract();
  }
  function showContract(fee) {
    const w = Math.round(wageAsk(p, 1) * 105) / 100;
    const body = $('#buy-body');
    body.innerHTML = '';
    const wIn = h('input', { type: 'number', value: w });
    const yIn = h('input', { type: 'number', value: 4 });
    const roleIn = h('select', null, ...[['Crucial', 0], ['Important', 1], ['Rotation', 2], ['Sporadic', 3]].map(([l, i]) => h('option', { value: i }, l)));
    const clauseIn = h('input', { type: 'number', value: Math.round(val * 1.4) });
    body.append(
      h('div', { class: 'frow' },
        h('div', null, h('label', { class: 'fld' }, `Weekly wage (€k) — wants ~${fmtWage(w)}`), wIn),
        h('div', null, h('label', { class: 'fld' }, 'Contract years'), yIn),
        h('div', null, h('label', { class: 'fld' }, 'Squad role'), roleIn),
        h('div', null, h('label', { class: 'fld' }, 'Release clause (€M, 0 = none)'), clauseIn),
      ),
      h('div', { class: 'card-sub' }, `Fee agreed: ${fmtMoney(fee * 1e6)}`),
    );
    $('#buy-go').textContent = 'Confirm signing';
    stage = 'contract2';
    $('#buy-body')._ctx = { fee, wIn, yIn, roleIn, clauseIn };
  }
  function finishContract() {
    const ctx = $('#buy-body')._ctx || {};
    const offer = { w: Number(ctx.wIn?.value || 0), y: Number(ctx.yIn?.value || 3), role: Number(ctx.roleIn?.value || 1), r: Number(ctx.clauseIn?.value || 0) };
    const fee = ctx.fee ?? 0;
    const resp = playerContractResponse(G, pid, offer, G.user.clubId);
    if (resp.status === 'accept') {
      const r = executeUserBuy(G, pid, fee, offer);
      if (r.ok) { m.close(); toast(`${p.name} signs for ${userClub(G).name}! 🎉`, 'success'); rerender(); }
      else { status.textContent = r.msg; }
    } else if (resp.status === 'counter') {
      status.textContent = resp.msg;
      ctx.wIn.value = resp.counter.w;
      if (resp.counter.role !== undefined) ctx.roleIn.value = resp.counter.role;
    } else status.textContent = resp.msg;
  }
}

function loanInModal(G, pid) {
  const p = G.world.players.get(pid);
  const from = G.world.clubs.get(p.clubId);
  const shareIn = h('input', { type: 'number', value: 50 });
  const m = modal({
    title: `Loan ${p.name} from ${from.name}`,
    body: h('div', null,
      h('label', { class: 'fld' }, 'Wage share you pay (%)'), shareIn,
      h('div', { class: 'card-sub', style: 'margin-top:8px' }, `Season-long loan. Estimated cost: ${fmtWage(p.ctr.w * Number(shareIn.value) / 100)}/wk`)),
    footer: [
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: () => {
        const r = executeUserLoanIn(G, pid, Number(shareIn.value));
        if (r.ok) { m.close(); toast('Loan agreed!', 'success'); rerender(); } else toast(r.msg, 'error');
      } }, 'Offer loan'),
    ],
  });
}

export function renewModal(G, pid) {
  const p = G.world.players.get(pid);
  const val = playerValue(p, G.world);
  const wIn = h('input', { type: 'number', value: Math.round(wageAsk(p, 1) * 110) / 100 });
  const yIn = h('input', { type: 'number', value: 4 });
  const roleIn = h('select', null, ...[['Crucial', 0], ['Important', 1], ['Rotation', 2], ['Sporadic', 3]].map(([l, i]) => h('option', { value: i }, l)));
  const clauseIn = h('input', { type: 'number', value: Math.round(val * 1.4) });
  const status = h('div', { class: 'card-sub', style: 'margin-bottom:8px' });
  const m = modal({
    title: `New contract — ${p.name}`,
    body: h('div', null, status,
      h('div', { class: 'frow' },
        h('div', null, h('label', { class: 'fld' }, `Weekly wage (€k) — wants ~${fmtWage(wageAsk(p, 1))}`), wIn),
        h('div', null, h('label', { class: 'fld' }, 'Years'), yIn),
        h('div', null, h('label', { class: 'fld' }, 'Squad role'), roleIn),
        h('div', null, h('label', { class: 'fld' }, 'Release clause (€M, 0 = none)'), clauseIn),
      )),
    footer: [
      h('button', { class: 'btn btn-ghost', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: () => {
        const offer = { w: Number(wIn.value), y: Number(yIn.value), role: Number(roleIn.value), r: Number(clauseIn.value) };
        const r = renewContract(G, pid, offer);
        if (r.ok) { m.close(); toast(`${p.name} signed a new deal!`, 'success'); rerender(); }
        else { status.textContent = r.msg; if (r.counter) { wIn.value = r.counter.w; if (r.counter.role !== undefined) roleIn.value = r.counter.role; } }
      } }, 'Offer'),
    ],
  });
}

// ================= flow: advance, season end, rollover =================
let _G = null;
export const setG = g => { _G = g; };
export const getG = () => _G;

export async function advanceFromUI(G) {
  if (G.pendingMatch) { showMatchday(G); return; }
  const overlay = document.querySelector('#adv-overlay');
  overlay.classList.remove('hide');
  document.querySelector('#adv-date').textContent = fmtDate(G.date);
  await new Promise(r => requestAnimationFrame(r));
  let stop;
  try {
    const { advanceUntil } = await import('../engine/advance.js');
    stop = advanceUntil(G);
  } catch (e) {
    console.error(e);
    overlay.classList.add('hide');
    toast('Simulation error: ' + e.message, 'error', 5000);
    return;
  }
  overlay.classList.add('hide');
  if (stop === 'match') { updateTopbar(G); rerender(); showMatchday(G); return; }
  if (stop === 'seasonend') { seasonEndModal(G); }
  else if (stop === 'rollover') { doRollover(G); }
  else if (stop === 'window') { toast('Transfer window update — check the news.', 'info'); }
  else if (stop === 'tournament') { toast('International tournament draw announced!', 'success'); }
  if (G.settings.autosave) { const { saveGame } = await import('../state.js'); saveGame(G, 0); }
  updateTopbar(G);
  rerender();
}
export async function doRollover(G) {
  const { rollover } = await import('../state.js');
  rollover(G);
  if (G.settings.autosave) { const { saveGame } = await import('../state.js'); saveGame(G, 0); }
  toast(`New season ${G.year}/${G.year + 1} — good luck!`, 'success');
  updateTopbar(G);
  rerender();
}
function seasonEndModal(G) {
  G.flags.seasonEndShown = true;
  const champs = {};
  for (const lid of Object.keys(LEAGUES)) {
    const t = tableSorted(G, lid);
    if (t[0]) champs[lid] = t[0].id;
  }
  const club = userClub(G);
  const t = tableSorted(G, club.league);
  const pos = t.findIndex(r => r.id === club.id) + 1;
  const body = h('div');
  body.append(h('div', { style: 'text-align:center;font-size:17px;font-weight:800;margin-bottom:12px' }, `🏆 ${G.year}/${G.year + 1} season complete`));
  body.append(h('div', { class: 'card-sub', style: 'text-align:center;margin-bottom:12px' }, `${club.name} finished ${pos}${ord(pos)} in the `, compNameEl(club.league, LEAGUES[club.league].name, 15), '.'));
  body.append(h('div', { class: 'card', style: 'margin-bottom:10px' },
    h('div', { class: 'card-title', style: 'margin-bottom:8px' }, 'League champions'),
    h('div', null, ...Object.entries(champs).slice(0, 14).map(([lid, cid]) => {
      const c = G.world.clubs.get(cid);
      return h('div', { class: 'obj-row' }, h('div', { class: 'obj-label' }, compNameEl(lid, LEAGUES[lid].name, 16)), h('b', null, c ? c.name : '—'));
    }))));
  const cupWinners = Object.values(CUPS).filter(c => G.sched.cups[c.id] && G.sched.cups[c.id].winner).map(c => ({ id: c.id, name: c.name, cid: G.sched.cups[c.id].winner }));
  if (cupWinners.length) body.append(h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:8px' }, 'Cup winners'),
    h('div', null, ...cupWinners.map(w => h('div', { class: 'obj-row' }, h('div', { class: 'obj-label' }, compNameEl(w.id, w.name, 16)), h('b', null, G.world.clubs.get(w.cid)?.name || '—'))))));
  modal({
    title: 'Season review',
    body,
    footer: h('button', { class: 'btn btn-primary', onclick: () => { const ov = document.querySelector('.modal-overlay'); ov && ov.remove(); doRollover(G); } }, 'Start next season →'),
  });
}
export function updateTopbar(G) {
  const club = userClub(G);
  const el = document.querySelector('#top-club');
  if (club && el) {
    el.innerHTML = '';
    const c = crestEl(club, 26);
    el.append(c, h('span', null, esc(club.name)));
  }
  const nx = nextUserMatch(G);
  const pend = G.pendingMatch;
  const nxEl = document.querySelector('#top-next');
  if (nxEl) {
    nxEl.textContent = pend ? `⚽ MATCHDAY: ${compLabel(pend, G)} — ${matchLine(G, pend)}` : nx ? `Next: ${compLabel(nx, G)} — ${matchLine(G, nx)}` : 'No upcoming fixtures';
  }
  const funds = document.querySelector('#top-funds');
  if (funds && club) {
    funds.innerHTML = '';
    funds.append(h('div', { class: 'tf-label' }, 'Balance'), h('div', { class: 'tf-val' }, fmtMoney(club.bal)),
      h('div', { class: 'tf-label', style: 'margin-top:2px' }, 'Budget'), h('div', { class: 'tf-val', style: 'font-size:12px' }, fmtMoney(club.tb)));
  }
  const dEl = document.querySelector('#top-date');
  if (dEl) dEl.textContent = fmtDate(G.date);
  const badge = document.querySelector('#news-badge');
  if (badge) {
    const unread = G.news.filter(n => !n.read).length;
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.classList.toggle('hide', unread === 0);
  }
  const intl = document.querySelector('#nav-intl');
  if (intl) intl.style.display = G.user.ntJob || G.ntOffers.length ? '' : 'none';
  const adv = document.querySelector('#btn-advance');
  if (adv) adv.textContent = pend ? '▶ PLAY MATCH' : '▶ ADVANCE';
}

// ================= result modal =================
export function showResultModal(G, m) {
  const res = G.results[m.id];
  if (!res) return;
  const hc = m.nt ? null : G.world.clubs.get(m.home);
  const ac = m.nt ? null : G.world.clubs.get(m.away);
  const hn = m.nt ? (G.world.nts.find(n => n.id === m.tnat?.h) || {}).name : hc?.name;
  const an = m.nt ? (G.world.nts.find(n => n.id === m.tnat?.a) || {}).name : ac?.name;
  const isUser = isUserMatch(G, m);
  const body = h('div');
  body.append(h('div', { style: 'display:flex;justify-content:center;align-items:center;gap:18px;margin-bottom:14px' },
    h('div', { style: 'text-align:center' }, hc ? crestEl(hc, 44) : ntCrestEl(G.world.nts.find(n => n.id === m.tnat?.h), 40), h('div', { style: 'font-weight:700;margin-top:4px' }, hn)),
    h('div', { style: 'font-size:30px;font-weight:900;font-style:italic' }, `${res.hg}–${res.ag}`),
    h('div', { style: 'text-align:center' }, ac ? crestEl(ac, 44) : ntCrestEl(G.world.nts.find(n => n.id === m.tnat?.a), 40), h('div', { style: 'font-weight:700;margin-top:4px' }, an)),
  ));
  const scorers = txt => {
    const list = [...(res.hs || []), ...(res.as || [])].map(s => {
      const p = G.world.players.get(s.pid);
      return `${p ? p.name : '?'} ${s.min}'${s.pen ? ' (pen)' : ''}`;
    });
    return list.join(' · ') || '—';
  };
  if (res.hg + res.ag > 0) body.append(h('div', { class: 'card-sub', style: 'margin-bottom:8px' }, `⚽ ${scorers()}`));
  const motm = res.motm ? G.world.players.get(res.motm) : null;
  if (motm) body.append(h('div', { class: 'card-sub', style: 'margin-bottom:8px' }, `⭐ Man of the match: ${motm.name}`));
  // stats table
  if (res.hst && res.ast) {
    body.append(h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'num' }, hn), h('th', null, ''), h('th', { class: 'num' }, an))),
      h('tbody', null,
        statRow('Possession', res.hst.poss + '%', res.ast.poss + '%'),
        statRow('Shots', res.hst.shots, res.ast.shots),
        statRow('On target', res.hst.sot, res.ast.sot),
        statRow('xG', res.hst.xg, res.ast.xg),
        statRow('Corners', res.hst.corn, res.ast.corn),
        statRow('Fouls', res.hst.fouls, res.ast.fouls),
      )));
  }
  // ratings
  if (res.ratings) {
    const rows = Object.entries(res.ratings).map(([pid, r]) => ({ pid, r })).sort((a, b) => b.r - a.r);
    body.append(h('div', { class: 'card-sub', style: 'margin:10px 0 4px' }, 'Player ratings'));
    body.append(h('table', { class: 'tbl' }, h('tbody', null, ...rows.map(x => {
      const p = G.world.players.get(x.pid);
      return h('tr', null, h('td', null, p ? p.name : '?'), h('td', { class: `num rating-cell ${ratingClass(x.r * 10)}` }, x.r.toFixed(1)));
    }))));
  }
  modal({ title: `${hn} ${res.hg}–${res.ag} ${an} · ${compLabel(m, G)}`, body, wide: true, footer: isUser && G.pendingMatch ? h('button', { class: 'btn btn-primary', onclick: () => { const ov = document.querySelector('.modal-overlay'); ov && ov.remove(); showMatchday(G); } }, 'Matchday →') : null });
}
function statRow(label, hv, av) {
  return h('tr', null, h('td', null, label), h('td', { class: 'num', style: 'font-weight:700' }, hv), h('td', null), h('td', { class: 'num', style: 'font-weight:700' }, av));
}

// ================= pitch (team sheet editor) =================
function pitchEl(G, club, sheet) {
  const el = h('div', { class: 'pitch', style: 'height:430px;width:100%;max-width:330px' });
  el.innerHTML = '<div class="line-mid"></div><div class="circle-mid"></div><div class="box" style="left:0;right:0;top:78%;height:22%;border-bottom:none"></div><div class="box" style="left:0;right:0;bottom:78%;height:22%;border-top:none"></div>';
  const coords = {
    GK: [8, 50], RB: [26, 88], RCB: [24, 63], LCB: [24, 37], LB: [26, 12], RWB: [28, 94], LWB: [28, 6], CB: [24, 50],
    CDM: [44, 50], RCM: [50, 68], LCM: [50, 32], CM: [50, 50], CAM: [62, 50], RM: [46, 88], LM: [46, 12],
    RW: [68, 84], LW: [68, 16], CF: [78, 50], RST: [78, 63], LST: [78, 37], ST: [84, 50],
  };
  for (const x of sheet.xi) {
    const p = G.world.players.get(x.pid);
    if (!p) continue;
    const pinned = (G.user.xiOverrides || {})[x.slot] === p.id;
    const [top, left] = coords[x.slot] || [50, 50];
    const dot = h('div', { class: `pdot${x.slot === 'GK' ? ' gk' : ''}${pinned ? ' pinned' : ''}`, style: `top:${top}%;left:${left}%`, title: `${p.name} — ${p.pos} · OVR ${Math.round(effOvr(p))} · ${SLOT_LABEL[x.slot] || x.slot}${pinned ? ' (pinned — click slot to change)' : ' — click to change'}` },
      h('span', { class: 'pdot-nm' }, p.name.split(' ').pop().slice(0, 5).toUpperCase()));
    dot.addEventListener('click', () => slotPicker(G, x.slot));
    el.append(dot);
  }
  return el;
}
function slotPicker(G, slot) {
  const club = userClub(G);
  const sheet = teamSheet(club, G.world);
  const current = sheet.xi.find(x => x.slot === slot)?.pid;
  const players = club.squad.map(id => G.world.players.get(id)).filter(p => p && !p.retired && !p.loan)
    .sort((a, b) => {
      const affA = SLOT_AFF[slot][a.pos] ?? 0, affB = SLOT_AFF[slot][b.pos] ?? 0;
      return (effOvr(b) * (0.55 + affB * 0.45)) - (effOvr(a) * (0.55 + affA * 0.45));
    });
  const ov = G.user.xiOverrides || {};
  const m = modal({
    title: `${SLOT_LABEL[slot] || slot} — pick player`,
    body: h('div', { style: 'max-height:55vh;overflow:auto' }, ...players.map(p => {
      const pinnedHere = ov[slot] === p.id;
      const pinnedAt = Object.entries(ov).find(([s, v]) => v === p.id && s !== slot)?.[0];
      return h('div', { class: `club-pick${p.id === current ? ' sel-highlight' : ''}`, onclick: () => {
        setSlotOverride(G, slot, p.id); // re-clicking the pinned player un-pins (auto)
        m.close();
        rerender();
      } },
      h('span', { class: 'pos-chip' }, p.pos),
      h('div', { class: 'cp-info' }, h('div', { class: 'cp-name' }, esc(p.name)), h('div', { class: 'cp-sub' }, `OVR ${Math.round(effOvr(p))} · ${p.role.label}${p.role.fam ? '+' : ''} · fit ${Math.round(p.fit)}%`)),
      pinnedHere ? h('span', { class: 'tag on' }, 'pinned') : pinnedAt ? h('span', { class: 'tag', title: 'Picking moves him here' }, `at ${SLOT_LABEL[pinnedAt] || pinnedAt}`) : null);
    })),
    footer: ov[slot] ? h('button', { class: 'btn btn-ghost', onclick: () => { setSlotOverride(G, slot, null); m.close(); rerender(); } }, '↺ Back to auto') : null,
  });
}
