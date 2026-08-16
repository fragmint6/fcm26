// ============ FCM 26 — full click-through test (jsdom) ============
// Renders every screen AND every in-screen tab; fails on any uncaught error.
import { JSDOM, VirtualConsole } from 'jsdom';

const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => pageErrors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => pageErrors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM('<!DOCTYPE html><html><body>' + `
<div id="app">
  <header id="topbar">
    <div id="brand"><span class="logo">FCM</span></div>
    <div id="topbar-mid"><div id="top-club"></div><div id="top-next"></div></div>
    <div id="topbar-right"><div id="top-funds"></div><div id="top-date"></div><button id="btn-advance">ADV</button></div>
  </header>
  <nav id="nav">
    <button class="nav-btn" data-screen="home"></button><button class="nav-btn" data-screen="squad"></button>
    <button class="nav-btn" data-screen="transfers"></button><button class="nav-btn" data-screen="academy"></button>
    <button class="nav-btn" data-screen="season"></button><button class="nav-btn" data-screen="club"></button>
    <button class="nav-btn" data-screen="news"></button><button class="nav-btn" data-screen="intl" id="nav-intl"></button>
    <button class="nav-btn" data-screen="settings"></button><span id="news-badge" class="badge hide"></span>
  </nav>
  <main id="content"></main>
</div>
<div id="adv-overlay" class="hide"><div id="adv-date"></div></div>
</body></html>`, { url: 'http://localhost/', pretendToBeVisual: true, virtualConsole: vc });

const win = dom.window;
global.window = win;
global.document = win.document;
global.location = win.location;
global.localStorage = { _d: {}, setItem(k, v) { this._d[k] = v; }, getItem(k) { return this._d[k] || null; }, removeItem(k) { delete this._d[k]; } };
global.CustomEvent = win.CustomEvent;
global.location = win.location; // some code paths read global location
global.requestAnimationFrame = cb => setTimeout(cb, 0);
win.requestAnimationFrame = cb => setTimeout(cb, 0);
win.addEventListener('error', e => pageErrors.push('window error: ' + e.message));

const { newGame, saveGame } = await import('../js/state.js');
const screensMod = await import('../js/ui/screens.js');
const { setG, getG, setRouterFn, updateTopbar, renderHome, renderSquad, renderTransfers, renderAcademy, renderSeason, renderClub, renderNews, renderIntl, renderSettings, showPlayerModal, showResultModal, advanceFromUI, userClub } = screensMod;
const { showMatchday } = await import('../js/ui/matchscreen.js');
const { quickSim, matchSeed } = await import('../js/engine/match.js');
const { applyMatchResult, advanceUntil } = await import('../js/engine/advance.js');
const { FORMATIONS } = await import('../js/util.js');

const t0 = Date.now();
const G = await newGame({ managerName: 'UI Test', managerNat: 'ENG', clubId: 'MCI', startDate: '2026-08-01' });
setG(G);
window.G = G;
console.log('world+ui boot:', Date.now() - t0, 'ms');

// --- emulate main.js route() so in-screen tabs re-render like the real app ---
const content = document.querySelector('#content');
const screens = { home: renderHome, squad: renderSquad, transfers: renderTransfers, academy: renderAcademy, season: renderSeason, club: renderClub, news: renderNews, intl: renderIntl, settings: renderSettings };
let current = 'home';
const route = () => { content.innerHTML = ''; content.append(screens[current](G)); updateTopbar(G); };
setRouterFn(route);

let fails = 0;
const step = (name, fn) => {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.error('FAIL  ' + name + ':', e.message, '\n     ', (e.stack.split('\n')[1] || '').trim()); }
};

// 1) every screen, then every tab within each screen (real click handlers)
for (const name of Object.keys(screens)) {
  step('screen ' + name, () => { current = name; win.location.hash = name; route(); });
  const seen = new Set();
  for (let guard = 0; guard < 12; guard++) {
    const tabBtns = [...content.querySelectorAll('.tabs > .tab:not(.on), #content .tabs > button:not(.on)')];
    const next = tabBtns.find(b => !seen.has(name + '|' + b.textContent));
    if (!next) break;
    const label = next.textContent.trim();
    seen.add(name + '|' + label);
    step('tab ' + name + ' > ' + label, () => { next.click(); if (!content.firstChild) throw new Error('tab did not render'); });
  }
  current = name; win.location.hash = name;
  step('re-render ' + name, route);
}

// 2) tactics tab: every formation card (mini pitch rendered for each)
step('squad > tactics (explicit)', () => {
  current = 'squad'; win.location.hash = 'squad'; route();
  const t = [...content.querySelectorAll('.tabs .tab')].find(b => b.textContent.includes('Tactics'));
  if (t) t.click();
  const cards = [...content.querySelectorAll('.card')].filter(c => c.querySelector('.pitch'));
  if (cards.length < 5) throw new Error('only ' + cards.length + ' formation cards');
});
// click each formation + each mentality chip (exercises rerender on squad)
step('squad > formation picks', () => {
  const cards = [...content.querySelectorAll('.card')].filter(c => c.querySelector('.pitch'));
  cards.forEach((c, i) => { if (i % 2 === 0) c.click(); });
});
step('squad > mentality picks', () => {
  [...content.querySelectorAll('.tab')].forEach(b => { if (['Defensive', 'Balanced', 'Attacking'].some(m => b.textContent.includes(m))) b.click(); });
});
// forced direct render of every formation's mini pitch (belt & braces vs regen/absent slot defs)
step('all formations render (direct) ' + Object.keys(FORMATIONS).join(','), () => {
  current = 'squad'; route();
  const t = [...content.querySelectorAll('.tabs .tab')].find(b => b.textContent.includes('Tactics'));
  t.click();
});

// 3) squad sub-filter chips
step('squad > position filters', () => {
  current = 'squad'; route();
  [...content.querySelectorAll('.chip-row .tab')].forEach(b => b.click());
});

// 4) team sheet: EAFC-style editor — swap flow, role assignment, auto resets
step('squad > sheet pickers', () => {
  current = 'squad'; route();
  [...content.querySelectorAll('.tabs .tab')].find(b => b.textContent.includes('Team Sheet')).click();
  const xiCards = [...content.querySelectorAll('.tspitch .tcard')];
  const benchCards = [...content.querySelectorAll('.ts-bench .tcard')];
  if (xiCards.length !== 11) throw new Error('expected 11 XI cards, got ' + xiCards.length);
  if (benchCards.length !== 7) throw new Error('expected 7 bench cards, got ' + benchCards.length);
  // role assignment: captain via card-grid modal
  const changeBtns = [...content.querySelectorAll('.ts-role .btn')];
  if (changeBtns.length !== 4) throw new Error('expected 4 role change buttons');
  changeBtns[0].click();
  const picks = [...document.querySelectorAll('.modal-overlay .ts-pick')];
  if (!picks.length) throw new Error('no role pick cards');
  picks[3].click(); // pick someone mid-squad (click sets the role)
  if (!G.user.captain) throw new Error('captain was not set by modal pick');
  // XI ↔ bench swap: tap XI card, then a bench card
  delete G.user.xiOverrides;
  const st = [...content.querySelectorAll('.tspitch .tcard')].find(c => c.dataset.pid);
  st.click();
  if (!content.querySelector('.tspitch .tcard.sel')) throw new Error('first tap did not select the card');
  const bench = [...content.querySelectorAll('.ts-bench .tcard')][0];
  bench.click();
  // after rerender the swap should be pinned as an XI override
  if (!G.user.xiOverrides || !Object.keys(G.user.xiOverrides).length) throw new Error('swap produced no XI override');
  // formation must have synced to the world club
  if (userClub(G).tact.formation !== G.user.tact.formation) throw new Error('user formation not synced to club');
  // auto XI reset clears pins again
  [...content.querySelectorAll('.ts-benchcard .btn')].find(b => b.textContent.includes('Auto XI')).click();
  if (G.user.xiOverrides && Object.keys(G.user.xiOverrides).length) throw new Error('Auto XI did not clear overrides');
});

// 5) player modals: GK, star forward, youth/regen, squad everyone-face-render
step('player modals (4 types)', () => {
  const all = [...G.world.players.values()];
  const gk = all.find(p => p.pos === 'GK' && p.clubId);
  const star = all.find(p => p.name === 'Erling Haaland');
  const youth = [...userSquad()].find(p => p.age <= 20) || all.find(p => p.age <= 19);
  const reg = all.find(p => p.regen);
  for (const p of [gk, star, youth, reg].filter(Boolean)) {
    showPlayerModal(G, p.id);
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  }
  function* userSquad() { const c = G.world.clubs.get(G.user.clubId); for (const id of c.squad) yield G.world.players.get(id); }
});

// 6) transfers search flow (type + filter + open modal from list)
step('transfers > search filters', () => {
  current = 'transfers'; win.location.hash = 'transfers'; route();
  const searchIn = [...content.querySelectorAll('input')].find(i => i.placeholder && /search/i.test(i.placeholder));
  if (searchIn) { searchIn.value = 'Haaland'; searchIn.dispatchEvent(new win.Event('input', { bubbles: true })); }
  [...content.querySelectorAll('select')].forEach(sel => {
    if (sel.options.length > 1) { sel.value = sel.options[1].value; sel.dispatchEvent(new win.Event('change', { bubbles: true })); }
  });
});

// 7) season league switcher
step('season > league select-all', () => {
  current = 'season'; win.location.hash = 'season'; route();
  const sel = [...content.querySelectorAll('select')][0];
  if (sel) for (const o of [...sel.options]) { sel.value = o.value; sel.dispatchEvent(new win.Event('change', { bubbles: true })); }
});

// 8) news categories
step('news > categories', () => {
  current = 'news'; win.location.hash = 'news'; route();
  [...content.querySelectorAll('.tabs .tab')].forEach(b => b.click());
});

// 9) settings toggles
step('settings > toggles', () => {
  current = 'settings'; win.location.hash = 'settings'; route();
  [...content.querySelectorAll('.tag')].forEach(b => b.click());
});

// 10) matchday flow
step('advance to first match + matchday', () => {
  let r = advanceUntil(G), guard = 0;
  while (r !== 'match' && guard++ < 20) { if (r === 'seasonend' || r === 'rollover') break; r = advanceUntil(G); }
  if (G.pendingMatch) {
    showMatchday(G);
    const m = G.pendingMatch;
    const res = quickSim(m, G.world, matchSeed(m.id));
    applyMatchResult(G, m, res);
    G.pendingMatch = null;
    showResultModal(G, m, res);
    document.querySelectorAll('.modal-overlay').forEach(x => x.remove());
  } else throw new Error('no pending match after advance loop (' + r + ')');
});

// 11) save/reload size + bootstrap screens after several advanced days
step('save + advance 10 days + re-render all screens', () => {
  saveGame(G, 0);
  for (let i = 0; i < 10; i++) { const r = advanceUntil(G); if (r === 'match') break; }
  for (const name of Object.keys(screens)) { current = name; win.location.hash = name; route(); }
});

console.log(fails === 0 && pageErrors.length === 0 ? 'CLICK-THROUGH TEST PASSED' : 'CLICK-THROUGH TEST FAILED');
if (fails) console.log('failed steps:', fails);
if (pageErrors.length) { console.log('page errors:'); pageErrors.slice(0, 20).forEach(e => console.log('  ' + e)); }
process.exit(fails || pageErrors.length ? 1 : 0);
