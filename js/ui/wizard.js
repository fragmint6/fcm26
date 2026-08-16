// ============ FCM 26 — title screen & new career wizard ============
import { h, esc, fmtMoney, flag, NAT_NAME, toast, modal, FORMATIONS, $ } from '../util.js';
import { LEAGUES, CLUBS } from '../data/clubs.js';
import { newGame, loadGame, loadSaves } from '../state.js';
import { crestEl } from './ui.js';

function estBudget(rep) {
  const balBase = rep >= 90 ? 550 : rep >= 85 ? 320 : rep >= 80 ? 170 : rep >= 75 ? 80 : rep >= 70 ? 35 : rep >= 65 ? 14 : rep >= 60 ? 6 : rep >= 55 ? 3 : 1.5;
  return Math.round(balBase * 0.65);
}

export function startWizard(onStart) {
  const root = h('div', { class: 'title-screen' });
  document.getElementById('app').style.display = 'none';
  document.body.append(root);
  renderTitle();
  function renderTitle() {
    root.innerHTML = '';
    root.append(
      h('div', { class: 'title-logo' }, h('span', { class: 't1' }, 'FOOTBALL '), h('span', { class: 't2' }, 'CLUB '), h('span', { class: 't3' }, 'MANAGER'), h('div', { style: 'text-align:right;font-size:34px;margin-top:-6px;color:#fff' }, '2026')),
      h('div', { class: 'title-sub' }, 'A full football career simulation — 23 leagues, ~470 clubs, ~14,000 players, transfer markets, scouting, youth academies and live match simulation. You never kick a ball. You decide everything else.'),
      h('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:260px' },
        h('button', { class: 'btn btn-primary', style: 'padding:12px 20px;font-size:15px', onclick: () => stepManager() }, '▶ NEW CAREER'),
        h('button', { class: 'btn', style: 'padding:12px 20px;font-size:15px', onclick: () => loadScreen() }, '📂 LOAD CAREER'),
        h('button', { class: 'btn btn-ghost', style: 'padding:12px 20px', onclick: () => showAbout() }, 'ℹ️ ABOUT'),
      ),
      h('div', { class: 'title-sub', style: 'font-size:11.5px;max-width:560px' }, 'Fan-made tribute game. Club & player names are factual; all ratings are original estimates and all badges/portraits are original generated artwork. Not affiliated with EA SPORTS.'),
    );
  }

  function showAbout() {
    modal({ title: 'About FCM 26', body: h('p', { class: 'modal-msg', style: 'line-height:1.6' }, 'FCM 26 is an original fan project inspired by football manager career modes. Every match is simulated; you control tactics, transfers, scouting, the youth academy, finances and the board. Player names and club names are factual information. Ratings are our own original estimates — not any publisher\'s database. Club crests are original stylized vectors in club colours, and player portraits are procedurally generated.') });
  }

  const st = { name: '', nat: 'ENG', style: 'Balanced', formation: '4-3-3 Holding', league: 'EPL', clubId: null, difficulty: 3, startDate: '2026-08-01', toggles: { training: true, transfers: true, academy: true, lockedClub: false } };

  function stepManager() {
    root.innerHTML = '';
    const box = h('div', { class: 'wizard-step' },
      h('div', { class: 'card-title', style: 'font-size:18px;margin-bottom:14px' }, 'Create your manager'),
      h('div', { class: 'frow' },
        h('div', { style: 'grid-column:1/-1' }, h('label', { class: 'fld' }, 'Manager name'), h('input', { type: 'text', value: st.name, placeholder: 'e.g. Alex Ferguson', oninput: e => st.name = e.target.value })),
        h('div', null, h('label', { class: 'fld' }, 'Nationality'),
          h('select', { onchange: e => st.nat = e.target.value }, ...Object.keys(NAT_NAME).sort((a, b) => (NAT_NAME[a] < NAT_NAME[b] ? -1 : 1)).map(n => h('option', { value: n, selected: n === st.nat }, `${flag(n)} ${NAT_NAME[n]}`)))),
        h('div', null, h('label', { class: 'fld' }, 'Coaching style'),
          h('select', { onchange: e => st.style = e.target.value }, ...[['Balanced', 'Balanced'], ['Possession', 'Possession'], ['Counter-attack', 'Counter-attack'], ['High press', 'High press'], ['Youth developer', 'Youth developer']].map(([k, l]) => h('option', { value: k, selected: k === st.style }, l)))),
        h('div', null, h('label', { class: 'fld' }, 'Preferred formation'),
          h('select', { onchange: e => st.formation = e.target.value }, ...Object.keys(FORMATIONS).map(f => h('option', { value: f, selected: f === st.formation }, f)))),
      ),
      h('div', { style: 'display:flex;justify-content:space-between;margin-top:16px' },
        h('button', { class: 'btn btn-ghost', onclick: renderTitle }, '← Back'),
        h('button', { class: 'btn btn-primary', onclick: stepClub }, 'Choose club →'),
      ));
    root.append(box);
  }

  function stepClub() {
    root.innerHTML = '';
    const box = h('div', { class: 'wizard-step' },
      h('div', { class: 'card-title', style: 'font-size:18px;margin-bottom:10px' }, 'Choose your club'),
      h('div', { class: 'frow' },
        h('div', null, h('label', { class: 'fld' }, 'League'),
          h('select', { onchange: e => { st.league = e.target.value; drawClubs(); } },
            ...Object.values(LEAGUES).map(l => h('option', { value: l.id, selected: l.id === st.league }, l.name)))),
        h('div', null, h('label', { class: 'fld' }, 'Search'), h('input', { type: 'text', placeholder: 'Club name…', oninput: e => drawClubs(e.target.value.toLowerCase()) })),
      ),
      h('div', { id: 'club-list', style: 'max-height:52vh;overflow:auto' }));
    root.append(box);
    drawClubs();
    function drawClubs(q = '') {
      const list = $('#club-list');
      list.innerHTML = '';
      const league = LEAGUES[st.league];
      const clubs = CLUBS.filter(c => c[4] === st.league && c[1].toLowerCase().includes(q)).sort((a, b) => b[5] - a[5]);
      for (const raw of clubs) {
        const c = { id: raw[0], name: raw[1], short: raw[2], c1: raw[6], c2: raw[7], badge: raw[8], mono: raw[9], rep: raw[5] };
        const el = h('div', { class: `club-pick${st.clubId === c.id ? ' sel-highlight' : ''}`, onclick: () => { st.clubId = c.id; const nb = document.getElementById('wiz-next'); if (nb) nb.disabled = false; drawClubs(q); } },
          crestEl(c, 34),
          h('div', { class: 'cp-info' }, h('div', { class: 'cp-name' }, c.name), h('div', { class: 'cp-sub' }, `${league.name} · Reputation ${c.rep} · Squad avg ~${Math.round(50 + (c.rep - 50) * 0.72)} · Est. budget ${fmtMoney(estBudget(c.rep) * 1e6)}`)),
          h('span', { class: 'pos-chip' }, '★'.repeat(c.rep >= 88 ? 5 : c.rep >= 82 ? 4 : c.rep >= 74 ? 3 : c.rep >= 64 ? 2 : 1)),
        );
        list.append(el);
      }
      if (!clubs.length) list.append(h('div', { class: 'empty' }, 'No clubs found.'));
    }
    root.append(h('div', { class: 'wizard-step', style: 'width:auto;display:flex;justify-content:space-between' },
      h('button', { class: 'btn btn-ghost', onclick: stepManager }, '← Back'),
      h('button', { id: 'wiz-next', class: 'btn btn-primary', disabled: !st.clubId, onclick: stepSettings }, 'Settings →'),
    ));
  }

  function stepSettings() {
    root.innerHTML = '';
    const box = h('div', { class: 'wizard-step' },
      h('div', { class: 'card-title', style: 'font-size:18px;margin-bottom:14px' }, 'Career settings'),
      h('div', { class: 'frow' },
        h('div', null, h('label', { class: 'fld' }, 'Difficulty'),
          h('select', { onchange: e => st.difficulty = Number(e.target.value) },
            ...[['0', 'Beginner'], ['1', 'Amateur'], ['2', 'Semi-Pro'], ['3', 'Professional'], ['4', 'World Class'], ['5', 'Legendary']].map(([k, l]) => h('option', { value: k, selected: st.difficulty === Number(k) }, l)))),
        h('div', null, h('label', { class: 'fld' }, 'Start date'),
          h('select', { onchange: e => st.startDate = e.target.value },
            h('option', { value: '2026-08-01', selected: st.startDate === '2026-08-01' }, 'Pre-season (Aug 1, 2026)'),
            h('option', { value: '2026-08-15' }, 'Current date (Aug 15, 2026)'))),
      ),
      h('div', { class: 'chip-row', style: 'margin:12px 0' },
        toggle('training', 'Training plans'),
        toggle('transfers', 'Scouting & transfers'),
        toggle('academy', 'Youth academy'),
        toggle('lockedClub', 'One-club challenge'),
      ),
      h('p', { class: 'screen-sub' }, 'Difficulty affects sim luck, AI transfer aggression and board strictness. All toggles can be changed later in Settings.'),
      h('div', { style: 'display:flex;justify-content:space-between;margin-top:16px' },
        h('button', { class: 'btn btn-ghost', onclick: stepClub }, '← Back'),
        h('button', { id: 'wiz-start', class: 'btn btn-primary', onclick: () => start() }, '🚀 START CAREER'),
      ));
    root.append(box);
    function toggle(key, label) {
      return h('button', { class: `tag${st.toggles[key] ? ' on' : ''}`, style: 'cursor:pointer;font-size:13px;padding:6px 12px', onclick: () => { st.toggles[key] = !st.toggles[key]; stepSettings(); } }, (st.toggles[key] ? '✓ ' : '') + label);
    }
  }

  async function start() {
    if (!st.name.trim()) st.name = 'A. Manager';
    const btn = document.querySelector('#wiz-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Building the football world…'; }
    const G = await newGame({
      managerName: st.name.trim(), managerNat: st.nat, style: st.style, formation: st.formation,
      clubId: st.clubId, difficulty: st.difficulty, startDate: st.startDate,
    });
    G.settings.toggles = st.toggles;
    root.remove();
    document.getElementById('app').style.display = '';
    onStart(G);
  }

  function loadScreen() {
    const saves = loadSaves();
    root.innerHTML = '';
    const box = h('div', { class: 'wizard-step' },
      h('div', { class: 'card-title', style: 'font-size:18px;margin-bottom:14px' }, 'Load career'),
      h('div', null, ...[1, 2, 3].map(slot => {
        const data = saves[slot];
        let meta = null;
        try { const s = JSON.parse(data); meta = { name: s.manager?.name, date: s.date, club: s.clubs && s.user ? s.clubs[s.user.clubId] : null, year: s.year }; } catch (e) { }
        return h('div', { class: 'club-pick', style: data ? '' : 'opacity:.4;cursor:default', onclick: async () => {
          if (!data) return;
          const G = await loadGame(slot);
          if (!G) return toast('Load failed.', 'error');
          root.remove();
          document.getElementById('app').style.display = '';
          onStart(G);
        } },
        h('div', { style: 'font-size:20px' }, data ? '💾' : '▫️'),
        h('div', { class: 'cp-info' },
          h('div', { class: 'cp-name' }, data ? `Slot ${slot} — ${meta.name || 'Career'}` : `Slot ${slot} — empty`),
          h('div', { class: 'cp-sub' }, data ? `${meta.year}/${meta.year + 1} · ${meta.date} · Club id ${meta.club ? '' : ''}` : 'Start a new career to fill this slot')),
        );
      })),
      h('div', { style: 'display:flex;justify-content:space-between;margin-top:16px' },
        h('button', { class: 'btn btn-ghost', onclick: renderTitle }, '← Back')));
    root.append(box);
  }
}
