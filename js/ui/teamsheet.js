// ============ FCM 26 — shared EAFC-style team sheet editor ============
// One interactive sheet used by Squad → Team Sheet AND the matchday pre-match
// editor: player cards on a pitch, tap-tap swapping (XI ↔ XI, XI ↔ bench),
// an editable bench, and captain / set-piece assignment cards with real faces.
import { h, esc, modal, FORMATIONS, MENTALITIES, SLOT_AFF, SLOT_LABEL } from '../util.js';
import { derivedAtts } from '../data/worldgen.js';
import { teamSheet, effOvr, setSlotOverride, pruneSlotOverrides, swapSheetPlayers, recomputeBenchOverride, applyUserTact, playersAvailable } from '../engine/match.js';
import { playerFaceEl, crestEl, compLogoEl } from './ui.js';

const COORDS = {
  GK: [7, 50], RB: [24, 88], RCB: [22, 63], LCB: [22, 37], LB: [24, 12], RWB: [26, 94], LWB: [26, 6], CB: [22, 50],
  CDM: [42, 50], RCM: [48, 68], LCM: [48, 32], CM: [48, 50], CAM: [60, 50], RM: [45, 88], LM: [45, 12],
  RW: [66, 84], LW: [66, 16], CF: [74, 50], RST: [74, 63], LST: [74, 37], ST: [80, 50],
};

// position fit of player p for a slot (mirrors teamSheet's affinity incl. alt positions)
function slotFit(slot, p) {
  const base = SLOT_AFF[slot] ? (SLOT_AFF[slot][p.pos] ?? 0) : 0;
  const alt = ((p.profile && p.profile.alt) || []).reduce((m, ap) => Math.max(m, (SLOT_AFF[slot] && SLOT_AFF[slot][ap]) ?? 0), 0);
  return Math.max(base, alt > 0 ? alt - 0.1 : 0);
}
const fitClass = f => f >= 0.9 ? 'fit-good' : f >= 0.5 ? 'fit-ok' : 'fit-bad';

// role ids: 'cap' maps to G.user.captain, others to G.user.kickers.*
const ROLES = [
  ['cap', '©', 'Captain', p => Math.round(effOvr(p) * 0.7 + p.mor * 0.3), null],
  ['pen', '⚽', 'Penalties', p => Math.round(derivedAtts(p).pen), 'PEN'],
  ['fk', '🎯', 'Free kicks', p => Math.round(derivedAtts(p).fka), 'FK'],
  ['cor', '📐', 'Corners', p => Math.round(derivedAtts(p).cro), 'COR'],
];
const roleGet = (G, r) => r === 'cap' ? G.user.captain : (G.user.kickers || {})[r];
const roleSet = (G, r, pid) => {
  if (r === 'cap') { G.user.captain = pid || null; return; }
  G.user.kickers = G.user.kickers || {};
  G.user.kickers[r] = pid || null;
};
function roleBadges(G, pid) {
  const out = [];
  for (const [r, ico, , , tag] of ROLES) if (roleGet(G, r) === pid) out.push([r === 'cap' ? '©' : tag, ico]);
  return out;
}

/**
 * The interactive team sheet.
 * opts:
 *   onChanged()  — called after any roster change (re-render the host screen)
 *   roles        — show captain/set-piece assignment cards (default true)
 *   readonly     — render a view-only sheet (no swapping/picking)
 *   bench        — pid[] override passed through to teamSheet (defaults to G.user.benchOverride)
 */
export function teamSheetEditor(G, club, opts = {}) {
  const onChanged = opts.onChanged || (() => {});
  const showRoles = opts.roles !== false;
  const readonly = !!opts.readonly;
  let sel = null; // selected pid awaiting a swap target

  const wrap = h('div', { class: 'ts' });
  render();
  return wrap;

  function curSheet() {
    applyUserTact(G);
    return teamSheet(club, G.world, { xi: G.user.xiOverrides || {}, bench: opts.bench || G.user.benchOverride || null });
  }
  function changed() { onChanged(); }

  function render() {
    const sheet = curSheet();
    wrap.innerHTML = '';
    wrap.append(mainRow(sheet), benchTray(sheet), hintBar());
  }

  // ---------- visual pieces ----------
  function badgeStrip(pid) {
    const bits = roleBadges(G, pid);
    if (!bits.length) return null;
    return h('div', { class: 'tc-badges' }, ...bits.map(([label, ico]) => h('span', { class: 'tc-badge', title: label === '©' ? 'Captain' : label }, label)));
  }
  function playerCardEl(p, slot, pinned) {
    const ovr = Math.round(effOvr(p));
    const card = h('div', { class: `tcard${slot === 'GK' ? ' tcard-gk' : ''}${sel === p.id ? ' sel' : ''}`, dataset: { pid: p.id } });
    const face = playerFaceEl(p, 46, 46);
    face.classList.add('tc-face');
    card.append(...[
      h('div', { class: `tc-ovr ${ovr >= 85 ? 'rating-85' : ovr >= 78 ? 'rating-80' : ''}` }, String(ovr)),
      face,
      h('div', { class: 'tc-name' }, esc((p.name.split(' ').pop() || p.name).toUpperCase())),
      slot ? h('div', { class: `tc-pos ${fitClass(slotFit(slot, p))}` }, SLOT_LABEL[slot] || slot) : h('div', { class: `tc-pos` }, p.pos),
      badgeStrip(p.id),
      pinned ? h('div', { class: 'tc-pin', title: 'Pinned by manager' }, '📌') : null,
    ].filter(Boolean));
    if (!readonly) {
      card.classList.add('tclick');
      card.title = `${p.name} — ${p.pos} · OVR ${ovr} · fit ${Math.round(p.fit)}%\nClick, then click another player to swap${slot ? ' · or click again for options' : ''}`;
      card.addEventListener('click', e => { e.stopPropagation(); onCardClick(p.id, slot, card); });
    }
    return card;
  }
  function onCardClick(pid, slot, cardEl) {
    if (sel && sel !== pid) {
      const a = sel; sel = null;
      if (swapSheetPlayers(G, club, a, pid)) { changed(); return; }
      // not swappable (e.g. two bench players) — reselect the new card instead
    } else if (sel === pid) {
      sel = null;
      if (slot) { slotChoices(slot); return; } // second tap on a pitch player → shortlist picker
    } else {
      sel = pid;
    }
    // light DOM-only re-highlight (no full rerender so the flow feels instant)
    wrap.querySelectorAll('.tcard.sel').forEach(c => c.classList.remove('sel'));
    if (sel) {
      const el = wrap.querySelector(`.tcard[data-pid="${sel}"]`);
      if (el) el.classList.add('sel');
    }
    const hint = wrap.querySelector('.ts-hint');
    if (hint) hint.textContent = hintText();
  }
  function hintText() {
    if (sel) return 'Now tap the player to swap with — anyone on the pitch, the bench or in the reserves.';
    return 'Tap two players to swap them — XI, bench and reserves are all swappable. Double-tap a pitch player to open the full squad shortlist.';
  }
  // classic list picker for a slot (precision picking, unpin, etc.)
  function slotChoices(slot) {
    const sheet = curSheet();
    const current = sheet.xi.find(x => x.slot === slot)?.pid;
    const players = club.squad.map(id => G.world.players.get(id)).filter(p => p && !p.retired && !p.loan)
      .sort((a, b) => (effOvr(b) * (0.55 + slotFit(slot, b) * 0.45)) - (effOvr(a) * (0.55 + slotFit(slot, a) * 0.45)));
    const ov = G.user.xiOverrides || {};
    const m = modal({
      title: `${SLOT_LABEL[slot] || slot} — pick player`,
      body: h('div', { style: 'max-height:55vh;overflow:auto' }, ...players.map(p => {
        const pinnedHere = ov[slot] === p.id;
        const pinnedAt = Object.entries(ov).find(([s, v]) => v === p.id && s !== slot)?.[0];
        return h('div', { class: `club-pick${p.id === current ? ' sel-highlight' : ''}`, onclick: () => {
          sel = null;
          setSlotOverride(G, slot, p.id); // re-click pinned = back to auto; dup picks move him
          m.close(); changed();
        } },
          h('span', { class: 'pos-chip' }, p.pos),
          h('div', { class: 'cp-info' }, h('div', { class: 'cp-name' }, esc(p.name)), h('div', { class: 'cp-sub' }, `OVR ${Math.round(effOvr(p))} · ${p.role.label}${p.role.fam ? '+' : ''} · fit ${Math.round(p.fit)}%`)),
          pinnedHere ? h('span', { class: 'tag on' }, 'pinned') : pinnedAt ? h('span', { class: 'tag', title: 'Picking moves him here' }, `at ${SLOT_LABEL[pinnedAt] || pinnedAt}`) : null);
      })),
      footer: ov[slot] ? h('button', { class: 'btn btn-ghost', onclick: () => { setSlotOverride(G, slot, null); m.close(); changed(); } }, '↺ Back to auto') : null,
    });
  }

  // ---------- pitch ----------
  function mainRow(sheet) {
    const row = h('div', { class: 'ts-main' });
    const pitch = h('div', { class: 'pitch tspitch' });
    pitch.innerHTML = '<div class="line-mid"></div><div class="circle-mid"></div><div class="box" style="left:6%;right:6%;top:76%;height:24%;border-bottom:none"></div><div class="box" style="left:6%;right:6%;bottom:76%;height:24%;border-top:none"></div><div class="box6" style="left:26%;right:26%;top:88%;height:12%;border-bottom:none"></div><div class="box6" style="left:26%;right:26%;bottom:88%;height:12%;border-top:none"></div>';
    const ov = G.user.xiOverrides || {};
    for (const x of sheet.xi) {
      const p = G.world.players.get(x.pid);
      if (!p) continue;
      const [top, left] = COORDS[x.slot] || [50, 50];
      const cell = h('div', { class: 'ts-cell', style: `top:${top}%;left:${left}%` });
      cell.append(playerCardEl(p, x.slot, ov[x.slot] === x.pid));
      pitch.append(cell);
    }
    row.append(h('div', { class: 'card ts-pitchcard' },
      h('div', { class: 'card-head' },
        h('div', { class: 'card-title' }, 'Starting XI'),
        h('div', { class: 'card-sub' }, `${sheet.tact.formation}${Object.keys(ov).length ? ' · custom' : ' · auto'}`)),
      pitch));
    if (showRoles) row.append(rolesCard(sheet));
    return row;
  }

  // ---------- captain & set pieces ----------
  function rolesCard(sheet) {
    const card = h('div', { class: 'card ts-roles' });
    card.append(h('div', { class: 'card-head' },
      h('div', { class: 'card-title' }, 'Roles'),
      h('div', { class: 'card-sub' }, 'Captain & set pieces')));
    const squadP = () => club.squad.map(id => G.world.players.get(id)).filter(p => p && !p.retired && !p.loan);
    for (const [r, ico, label, statOf] of ROLES) {
      const pid = roleGet(G, r);
      const p = pid ? G.world.players.get(pid) : null;
      const autoBest = squadP().sort((a, b) => statOf(b) - statOf(a))[0];
      const shown = p || autoBest;
      const face = shown ? playerFaceEl(shown, 30, 30) : null;
      if (face) { face.classList.add('tc-face'); face.style.borderRadius = '6px'; }
      card.append(h('div', { class: 'ts-role' },
        h('span', { class: 'ts-role-ico' }, ico),
        h('div', { class: 'ts-role-info' },
          h('div', { class: 'ts-role-name' }, label),
          h('div', { class: 'screen-sub' }, shown ? `${shown.name} · ${statOf(shown)}${p ? '' : ' (auto)'}` : '—')),
        face,
        readonly ? null : h('button', { class: 'btn btn-sm', onclick: () => assignRole(r, label, statOf) }, 'Change'),
      ));
    }
    return card;
  }
  function assignRole(r, label, statOf) {
    const players = club.squad.map(id => G.world.players.get(id)).filter(p => p && !p.retired && !p.loan)
      .sort((a, b) => statOf(b) - statOf(a));
    const cur = roleGet(G, r);
    const m = modal({
      title: `${label} — assign`,
      wide: true,
      body: h('div', { class: 'ts-pickgrid' }, ...players.map(p => {
        const face = playerFaceEl(p, 52, 52);
        face.classList.add('tc-face');
        return h('div', { class: `tcard ts-pick${p.id === cur ? ' sel' : ''}`, onclick: () => {
          roleSet(G, r, p.id === cur ? null : p.id); // re-click current frees the role back to auto
          m.close(); changed();
        } },
          face,
          h('div', { class: 'tc-name' }, esc(p.name)),
          h('div', { class: 'tc-stat' }, `${statOf(p)} ${r === 'cap' ? 'OVR' : r === 'pen' ? 'PEN' : r === 'fk' ? 'FK' : 'CRS'}`),
          r !== 'cap' && roleBadges(G, p.id).length ? badgeStrip(p.id) : null);
      })),
      footer: cur ? h('button', { class: 'btn btn-ghost', onclick: () => { roleSet(G, r, null); m.close(); changed(); } }, '↺ Auto (best available)') : null,
    });
  }

  // ---------- bench + reserves ----------
  function benchTray(sheet) {
    const card = h('div', { class: 'card ts-benchcard' });
    const inSheet = new Set([...sheet.xi.map(x => x.pid), ...sheet.bench]);
    const reserves = playersAvailable(club, G.world)
      .filter(p => !inSheet.has(p.id))
      .sort((a, b) => effOvr(b) - effOvr(a));
    card.append(h('div', { class: 'card-head' },
      h('div', { class: 'card-title' }, `Substitutes · ${sheet.bench.length}`),
      h('div', { class: 'card-sub' }, G.user.benchOverride ? 'custom bench' : 'auto bench')));
    const row = h('div', { class: 'ts-bench' });
    for (const pid of sheet.bench) {
      const p = G.world.players.get(pid);
      if (!p) continue;
      row.append(playerCardEl(p, null, false));
    }
    card.append(row);
    if (reserves.length) {
      card.append(h('div', { class: 'ts-res-head' },
        h('div', { class: 'card-title' }, `Reserves · ${reserves.length}`),
        h('div', { class: 'card-sub' }, 'tap a reserve, then an XI / bench player to swap them in')));
      const rrow = h('div', { class: 'ts-reserves' });
      for (const p of reserves) rrow.append(playerCardEl(p, null, false));
      card.append(rrow);
    }
    if (!readonly) {
      card.append(h('div', { class: 'chip-row', style: 'margin-top:10px' },
        h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { delete G.user.xiOverrides; changed(); } }, '↺ Auto XI'),
        G.user.benchOverride ? h('button', { class: 'btn btn-sm btn-ghost', onclick: () => { delete G.user.benchOverride; changed(); } }, '↺ Auto bench') : null,
      ));
    }
    return card;
  }
  function hintBar() {
    return readonly ? h('div') : h('div', { class: 'screen-sub ts-hint' }, hintText());
  }
}
