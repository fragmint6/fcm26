// ============ FCM 26 — matchday: pre-match, watch sim, post-match ============
import { h, esc, fmtDate, flag, modal, toast, FORMATIONS, MENTALITIES, SLOT_AFF, SLOT_LABEL, NAT_NAME } from '../util.js';
import { LEAGUES, CUPS, UEFA } from '../data/clubs.js';
import { fullSim, quickSim, teamSheet, teamQuality, effOvr, matchSeed } from '../engine/match.js';
import { applyMatchResult, isUserMatch, compLabel } from '../engine/advance.js';
import { crestEl, ntCrestEl, playerFaceEl, ratingClass, compLogoEl } from './ui.js';
import { TEAM_TALKS } from '../data/names.js';

export function showMatchday(G) {
  const m = G.pendingMatch;
  if (!m) return;
  // never stack matchday overlays (e.g. double advance before CONTINUE)
  document.querySelectorAll('.match-wrap').forEach(w => w.remove());
  const isNT = !!m.nt;
  const hc = isNT ? pseudoNT(G, m.tnat.h) : G.world.clubs.get(m.home);
  const ac = isNT ? pseudoNT(G, m.tnat.a) : G.world.clubs.get(m.away);
  const uclub = G.world.clubs.get(G.user.clubId);
  const userSide = isNT ? (m.tnat.h === G.user.ntJob ? 'h' : 'a') : (m.home === G.user.clubId ? 'h' : 'a');
  const myClub = userSide === 'h' ? hc : ac;

  // user team sheet with overrides
  const xiOver = (isNT ? {} : G.user.xiOverrides) || {};
  const sheet = teamSheet(myClub, G.world, { xi: xiOver });
  const q = teamQuality(sheet, G.world, G.user.tact.mentality || 3);

  const ov = h('div', { class: 'match-wrap' });
  document.body.append(ov);
  const head = h('div', { class: 'match-top' });
  ov.append(head, h('div', { id: 'match-stage' }));
  const stageEl = () => ov.querySelector('#match-stage');

  // ---------- PRE-MATCH ----------
  function preMatch() {
    stageEl().innerHTML = '';
    const box = h('div', { style: 'display:grid;grid-template-columns:1fr 320px;gap:16px;padding:16px 20px;overflow:auto;flex:1' });
    stageEl().append(box);
    const editor = h('div', { class: 'card' });
    editor.append(h('div', { class: 'card-head' },
      h('div', { class: 'card-title' }, 'Team sheet'),
      h('div', { class: 'card-sub' }, `Squad rating ${Math.round(q.ovr)} · Att ${Math.round(q.att)} · Mid ${Math.round(q.mid)} · Def ${Math.round(q.def)}`)));
    editor.append(pitchEditor(G, myClub));
    box.append(editor);
    const side = h('div');
    side.append(h('div', { class: 'card' },
      h('div', { class: 'card-title', style: 'margin-bottom:10px' }, 'Tactics'),
      h('div', { class: 'chip-row', style: 'margin-bottom:10px' }, ...MENTALITIES.map((mn, i) =>
        h('button', { class: `tab${(G.user.tact.mentality || 3) === i + 1 ? ' on' : ''}`, onclick: () => { G.user.tact.mentality = i + 1; preMatch(); } }, mn))),
      h('label', { class: 'fld' }, 'Formation'),
      h('select', { onchange: e => { G.user.tact.formation = e.target.value; pruneSlotOverrides(G); preMatch(); } },
        ...Object.keys(FORMATIONS).map(f => h('option', { value: f, selected: G.user.tact.formation === f }, f))),
    ));
    side.append(h('div', { class: 'card' },
      h('div', { class: 'card-title', style: 'margin-bottom:10px' }, '🎤 Team talk'),
      h('div', null, ...TEAM_TALKS.map(tt => h('div', { class: 'club-pick', style: 'padding:7px 10px', onclick: () => applyTalk(G, tt, sheet) },
        h('div', { class: 'cp-info' }, h('div', { class: 'cp-name', style: 'font-size:13px' }, tt.label), h('div', { class: 'cp-sub' }, tt.desc))),
      ))));
    side.append(h('div', { class: 'card' },
      h('div', { class: 'card-sub', style: 'margin-bottom:10px' }, 'Bench: ' + sheet.bench.map(pid => G.world.players.get(pid)?.name.split(' ').pop()).join(', ')),
      h('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:8px', onclick: () => startWatch() }, '▶ WATCH SIM'),
      h('button', { class: 'btn btn-block', onclick: () => instantResult() }, '⚡ INSTANT RESULT'),
    ));
    box.append(side);
  }

  function applyTalk(G, tt, sheet) {
    const rng = Math.random();
    const backfire = rng < tt.risk;
    for (const x of sheet.xi) {
      const p = G.world.players.get(x.pid);
      if (!p) continue;
      p.mor = Math.max(0, Math.min(100, p.mor + (backfire ? -tt.morale : tt.morale)));
    }
    toast(backfire ? 'The team talk fell flat…' : 'The dressing room responds!', backfire ? 'error' : 'success');
  }

  // ---------- WATCH ----------
  let res = null;
  function startWatch() {
    const seed = matchSeed(m.id) ^ (Math.random() * 1e9 | 0);
    m.pseudoH = userSide === 'h' ? { ...myClub, xi: xiOver } : hc;
    m.pseudoA = userSide === 'a' ? { ...myClub, xi: xiOver } : ac;
    m.userHome = userSide === 'h';
    m.bonus = [0.05, 0.035, 0.02, 0, -0.03, -0.06][G.settings.difficulty] || 0;
    res = fullSim(m, G.world, seed);
    watch();
  }
  function instantResult() {
    const seed = matchSeed(m.id) ^ (Math.random() * 1e9 | 0);
    m.pseudoH = userSide === 'h' ? { ...myClub, xi: xiOver } : hc;
    m.pseudoA = userSide === 'a' ? { ...myClub, xi: xiOver } : ac;
    m.userHome = userSide === 'h';
    m.bonus = [0.05, 0.035, 0.02, 0, -0.03, -0.06][G.settings.difficulty] || 0;
    res = quickSim(m, G.world, seed);
    finish();
  }

  function watch() {
    stageEl().innerHTML = '';
    const wrap = h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0' });
    stageEl().append(wrap);
    const mid = h('div', { class: 'match-mid' });
    wrap.append(mid);
    const feed = h('div', { class: 'feed' });
    const side = h('div', { class: 'match-side' });
    mid.append(feed, side);
    const statsBox = h('div', { class: 'match-stats' });
    const ratingsBox = h('div', { class: 'match-stats', style: 'max-height:300px;overflow:auto' });
    side.append(statsBox, ratingsBox);

    const events = (res.events || []).slice();
    let ei = 0;
    let minute = 0;
    const speedMs = [220, 110, 55, 25][(G.settings.simSpeed || 3) - 1] || 55;
    let timer = null, paused = false;
    const finishAt = Math.max(90, ...events.map(e => e.min));

    const scoreEl = head.querySelector('.match-score-num');
    const minEl = head.querySelector('.match-minute');

    function tick() {
      if (paused) return;
      minute++;
      minEl.textContent = minute + "'";
      while (ei < events.length && events[ei].min <= minute) {
        const ev = events[ei++];
        feed.prepend(h('div', { class: `feed-item ev-${ev.type}` }, h('span', { class: 'fmin' }, ev.min + "'"), h('span', null, ev.text)));
        if (feed.children.length > 200) feed.lastChild.remove();
        if (ev.type === 'goal' || ev.type === 'penGoal') {
          updateScore(ev.side);
          flash(h('div', { style: 'font-size:26px' }, '⚽ GOAL! ' + ev.text.split('!')[0]));
        }
        if (ev.type === 'red') flash(h('div', { style: 'font-size:22px' }, '🟥 ' + ev.text));
      }
      updateStats();
      if (minute >= finishAt + 2) { clearInterval(timer); setTimeout(() => finish(), 500); }
    }
    function updateScore(side) {
      let hg = 0, ag = 0;
      for (const s of res.hs) hg++;
      for (const s of res.as) ag++;
      scoreEl.textContent = `${hg}–${ag}`;
    }
    function flash(el) {
      const box = h('div', { style: 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);background:rgba(10,13,20,.9);padding:14px 26px;border-radius:14px;border:1px solid var(--accent);z-index:80;text-align:center' });
      box.append(el);
      document.body.append(box);
      setTimeout(() => box.remove(), 1600);
    }
    function updateStats() {
      if (!res.hst) return;
      statsBox.innerHTML = '';
      const rows = [
        ['Possession', res.hst.poss, res.ast.poss],
        ['Shots', res.hst.shots, res.ast.shots],
        ['On target', res.hst.sot, res.ast.sot],
        ['xG', res.hst.xg, res.ast.xg],
        ['Corners', res.hst.corn, res.ast.corn],
        ['Fouls', res.hst.fouls, res.ast.fouls],
      ];
      for (const [label, hv, av] of rows) {
        const tot = hv + av || 1;
        statsBox.append(h('div', { class: 'ms-row' },
          h('b', { style: 'text-align:right' }, hv),
          h('div', null, h('div', { class: 'ms-bar' },
            h('div', { class: 'ms-fill-h', style: `width:${hv / tot * 100}%` }),
            h('div', { class: 'ms-fill-a', style: `width:${av / tot * 100}%` })),
            h('div', { style: 'text-align:center;font-size:10px;color:var(--dim);margin-top:2px' }, label)),
          h('b', null, av)));
      }
      if (res.ratings) {
        ratingsBox.innerHTML = '';
        const rows2 = Object.entries(res.ratings).sort((a, b) => b[1] - a[1]);
        for (const [pid, r] of rows2) {
          const p = G.world.players.get(pid);
          ratingsBox.append(h('div', { class: 'ms-row' },
            h('span', { style: 'font-size:12px', title: p?.name }, p ? p.name.split(' ').pop() : '?'),
            h('div', null, h('div', { class: 'ms-bar' }, h('div', { class: 'ms-fill-h', style: `width:${r * 10}%` }))),
            h('b', { style: `font-size:12px;color:${r >= 8.5 ? '#ffd66b' : r >= 7.5 ? 'var(--accent)' : ''}` }, r.toFixed(1))));
        }
      }
    }
    updateScore();
    timer = setInterval(tick, speedMs);
    wrap.append(h('div', { class: 'match-ctrl' },
      h('button', { class: 'btn btn-sm', onclick: () => { paused = !paused; } }, paused ? '▶' : '⏸'),
      h('div', { class: 'speed-sel' }, ...[['1x', 220], ['2x', 110], ['4x', 55], ['8x', 25]].map(([l, ms]) =>
        h('button', { class: `btn btn-sm${speedMs === ms ? ' on' : ''}`, onclick: () => { if (timer) clearInterval(timer); timer = setInterval(tick, ms); G.settings.simSpeed = [220, 110, 55, 25].indexOf(ms) + 1; } }, l))),
      h('div', { style: 'flex:1' }),
      h('button', { class: 'btn btn-sm', onclick: () => { clearInterval(timer); finish(); } }, '⏭ Jump to result'),
    ));
  }

  function finish() {
    applyMatchResult(G, m, res);
    stageEl().innerHTML = '';
    const box = h('div', { style: 'padding:18px 20px;overflow:auto;flex:1' });
    stageEl().append(box);
    const card = h('div', { class: 'card', style: 'max-width:760px;margin:0 auto' });
    const motm = res.motm ? G.world.players.get(res.motm) : null;
    const won = userSide === 'h' ? res.hg > res.ag : res.ag > res.hg;
    const drew = res.hg === res.ag;
    card.append(
      h('div', { style: 'text-align:center;font-size:20px;font-weight:900;font-style:italic;margin-bottom:12px' },
        `${isNT ? ntName(G, m.tnat.h) : hc.name} ${res.hg}–${res.ag} ${isNT ? ntName(G, m.tnat.a) : ac.name}`),
      h('div', { style: 'text-align:center;color:var(--dim);margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:7px' }, compLogoEl(m.comp, 18), `${compLabel(m, G)} · ${fmtDate(m.date)}`),
      h('div', { style: 'text-align:center;margin-bottom:14px' },
        h('span', { class: 'tag', style: 'font-size:14px;padding:6px 18px' }, won ? '✅ VICTORY' : drew ? '🤝 DRAW' : '❌ DEFEAT')),
    );
    const scorers = [...(res.hs || []), ...(res.as || [])].map(s => {
      const p = G.world.players.get(s.pid);
      return `${p ? p.name : '?'} ${s.min}'${s.pen ? ' (pen)' : ''}`;
    });
    if (scorers.length) card.append(h('div', { style: 'margin-bottom:10px' }, '⚽ ' + scorers.join(' · ')));
    if (motm) card.append(h('div', { style: 'margin-bottom:10px' }, `⭐ Man of the match: ${motm.name}`));
    if (res.ratings) {
      const rows = Object.entries(res.ratings).sort((a, b) => b[1] - a[1]);
      card.append(h('table', { class: 'tbl' }, h('tbody', null, ...rows.slice(0, 14).map(([pid, r]) => {
        const p = G.world.players.get(pid);
        return h('tr', null, h('td', null, p ? p.name : '?'), h('td', { class: `num rating-cell ${ratingClass(r * 10)}` }, r.toFixed(1)));
      }))));
    }
    card.append(h('div', { style: 'text-align:center;margin-top:16px' },
      h('button', { class: 'btn btn-primary', style: 'font-size:15px;padding:10px 26px', onclick: () => { ov.remove(); afterMatch(G); } }, 'CONTINUE →')));
    box.append(card);
    ov.append(h('div', { class: 'match-ctrl' }, h('div', { style: 'flex:1' }), h('button', { class: 'btn btn-sm btn-ghost', onclick: () => ov.remove() }, '✕ Close')));
  }

  // ---------- header ----------
  head.innerHTML = '';
  head.append(
    h('div', { class: 'match-score' },
      teamBox(hc, isNT, m.tnat?.h),
      h('div', { style: 'text-align:center' },
        h('div', { class: 'match-score-num' }, '0–0'),
        h('div', { class: 'match-minute' }, m.date === G.date ? "0'" : '—'),
        h('div', { class: 'card-sub', style: 'font-size:11px;display:flex;align-items:center;justify-content:center;gap:5px;margin-top:2px' }, compLogoEl(m.comp, 14), compLabel(m, G)),
      ),
      teamBox(ac, isNT, m.tnat?.a),
    ),
    h('button', { class: 'btn btn-ghost', onclick: () => ov.remove() }, '✕'),
  );
  function teamBox(c, nt, nat) {
    return h('div', { class: 'match-team' },
      nt ? ntCrestEl(G.world.nts.find(n => n.id === nat), 34) : crestEl(c, 34),
      h('div', { class: 'mt-name' }, nt ? ntName(G, nat) : c.name));
  }
  preMatch();
}

function ntName(G, nat) { return (G.world.nts.find(n => n.id === nat) || {}).name || nat; }
function pseudoNT(G, nat) {
  const nt = G.world.nts.find(n => n.id === nat);
  const squad = (nat === G.user.ntJob && G.ntSquads[nat]) ? G.ntSquads[nat] : ntSquadAuto(G, nat);
  return { id: 'NT:' + nat, name: nt?.name || nat, short: nt?.name || nat, rep: Math.round(nt?.strength || 70), squad, tact: nt?.tact || { formation: '4-3-3 Holding', mentality: 3 } };
}
function ntSquadAuto(G, nat) {
  return [...G.world.players.values()].filter(p => p.nat === nat && !p.retired).sort((a, b) => (b.ovr + b.gr) - (a.ovr + a.gr)).slice(0, 23).map(p => p.id);
}

function afterMatch(G) {
  const { saveGame } = G._flow || {};
  // autosave handled by main via event
  window.dispatchEvent(new CustomEvent('fcm-aftermatch'));
}

function pitchEditor(G, club) {
  const el = h('div', { class: 'pitch', style: 'height:460px;max-width:340px' });
  el.innerHTML = '<div class="line-mid"></div><div class="circle-mid"></div><div class="box" style="left:0;right:0;top:78%;height:22%;border-bottom:none"></div><div class="box" style="left:0;right:0;bottom:78%;height:22%;border-top:none"></div>';
  const sheet = teamSheet(club, G.world, { xi: G.user.xiOverrides || {} });
  const coords = {
    GK: [8, 50], RB: [26, 88], RCB: [24, 63], LCB: [24, 37], LB: [26, 12], RWB: [28, 94], LWB: [28, 6], CB: [24, 50],
    CDM: [44, 50], RCM: [50, 68], LCM: [50, 32], CM: [50, 50], CAM: [62, 50], RM: [46, 88], LM: [46, 12],
    RW: [68, 84], LW: [68, 16], CF: [78, 50], RST: [78, 63], LST: [78, 37], ST: [84, 50],
  };
  for (const x of sheet.xi) {
    const p = G.world.players.get(x.pid);
    if (!p) continue;
    const [top, left] = coords[x.slot] || [50, 50];
    const dot = h('div', { class: `pdot${x.slot === 'GK' ? ' gk' : ''}`, style: `top:${top}%;left:${left}%`, title: `${p.name} (${p.pos}) — OVR ${Math.round(effOvr(p))}` },
      h('span', { style: 'font-size:8.5px' }, p.name.split(' ').pop().slice(0, 5).toUpperCase()));
    dot.addEventListener('click', () => slotPicker(G, club, x.slot));
    el.append(dot);
  }
  return el;
}
function slotPicker(G, club, slot) {
  const players = club.squad.map(id => G.world.players.get(id)).filter(p => p && !p.retired && !p.inj && p.sus <= 0 && !p.loan)
    .sort((a, b) => {
      const affA = SLOT_AFF[slot][a.pos] ?? 0, affB = SLOT_AFF[slot][b.pos] ?? 0;
      return (effOvr(b) * (0.55 + affB * 0.45)) - (effOvr(a) * (0.55 + affA * 0.45));
    });
  const current = teamSheet(club, G.world, { xi: G.user.xiOverrides || {} }).xi.find(x => x.slot === slot)?.pid;
  const ov = G.user.xiOverrides || {};
  const list = h('div', { style: 'max-height:50vh;overflow:auto' });
  let m;
  for (const p of players) {
    const pinnedHere = ov[slot] === p.id;
    const pinnedAt = Object.entries(ov).find(([s, v]) => v === p.id && s !== slot)?.[0];
    const row = h('div', { class: 'club-pick' + (p.id === current ? ' sel-highlight' : '') });
    row.addEventListener('click', () => {
      setSlotOverride(G, slot, p.id); // re-click pinned = back to auto; dup picks move him
      m.close();
      showMatchday(G); // re-render the pre-match stage in place
    });
    row.append(
      h('span', { class: 'pos-chip' }, p.pos),
      h('div', { class: 'cp-info' },
        h('div', { class: 'cp-name' }, esc(p.name)),
        h('div', { class: 'cp-sub' }, 'OVR ' + Math.round(effOvr(p)) + ' · ' + p.role.label + (p.role.fam ? '+' : '') + ' · fit ' + Math.round(p.fit) + '%')),
      pinnedHere ? h('span', { class: 'tag on' }, 'pinned') : pinnedAt ? h('span', { class: 'tag', title: 'Picking moves him here' }, `at ${SLOT_LABEL[pinnedAt] || pinnedAt}`) : h('b', null, Math.round(p.fit) + '%'));
    list.append(row);
  }
  m = modal({ title: `${SLOT_LABEL[slot] || slot} — pick player`, body: list,
    footer: ov[slot] ? h('button', { class: 'btn btn-ghost', onclick: () => { setSlotOverride(G, slot, null); m.close(); showMatchday(G); } }, '↺ Back to auto') : null });
}
