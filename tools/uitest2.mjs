// ============ FCM 26 — deep flow test (jsdom) ============
// Wizard boot, badge-fallback club pick, intl/NT screens, transfer hub actions,
// academy promote, UI advance path, save/load, full season rollover.
import { JSDOM, VirtualConsole } from 'jsdom';

const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => pageErrors.push('jsdomError: ' + e.message));

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
global.localStorage = { _d: {}, setItem(k, v) { this._d[k] = v; }, getItem(k) { return this._d[k] || null; }, removeItem(k) { delete this._d[k]; } };
global.CustomEvent = win.CustomEvent;
global.requestAnimationFrame = cb => setTimeout(cb, 0);
win.requestAnimationFrame = cb => setTimeout(cb, 0);
win.addEventListener('error', e => pageErrors.push('window error: ' + e.message));

const tick = () => new Promise(r => setTimeout(r, 25));
const byText = (root, sel, txt) => [...root.querySelectorAll(sel)].find(b => b.textContent.includes(txt));
const closeModals = () => document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

let fails = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.error('FAIL  ' + name + ':', e.message, '\n     ', ((e.stack || '').split('\n')[1] || '').trim()); }
};

const { startWizard } = await import('../js/ui/wizard.js');
const screensMod = await import('../js/ui/screens.js');
const { setG, setRouterFn, updateTopbar, renderHome, renderSquad, renderTransfers, renderAcademy, renderSeason, renderClub, renderNews, renderIntl, renderSettings, advanceFromUI } = screensMod;
const { quickSim, matchSeed } = await import('../js/engine/match.js');
const { applyMatchResult, advanceUntil } = await import('../js/engine/advance.js');
const { saveGame } = await import('../js/state.js');

let G = null;
const content = document.querySelector('#content');
const screens = { home: renderHome, squad: renderSquad, transfers: renderTransfers, academy: renderAcademy, season: renderSeason, club: renderClub, news: renderNews, intl: renderIntl, settings: renderSettings };
let current = 'home';
const route = () => { content.innerHTML = ''; content.append(screens[current](G)); updateTopbar(G); };
setRouterFn(route);

// ---------- 1) full wizard, picking a club with NO remote badge (Gloria Buzău, GBZ) ----------
await step('wizard: title → manager → club (badge-fallback club) → settings → start', async () => {
  let done = null;
  startWizard(g => { done = g; });
  const wroot = document.querySelector('.title-screen');
  if (!wroot) throw new Error('no title screen');
  byText(wroot, 'button', 'NEW CAREER').click(); await tick();
  const nameIn = [...wroot.querySelectorAll('input')].find(i => /name/i.test(i.placeholder) || /alex/i.test(i.placeholder));
  nameIn.value = 'QA Manager'; nameIn.dispatchEvent(new win.Event('input', { bubbles: true }));
  byText(wroot, 'button', 'Choose club').click(); await tick();
  // pick the Romanian league (LS1) first, then search within it
  const leagueSel = [...wroot.querySelectorAll('select')].find(s => [...s.options].some(o => o.textContent.includes('Romania') || o.value === 'LS1'));
  if (!leagueSel) throw new Error('no league select');
  leagueSel.value = 'LS1'; leagueSel.dispatchEvent(new win.Event('change', { bubbles: true })); await tick();
  const search = [...wroot.querySelectorAll('input')].find(i => /club name/i.test(i.placeholder));
  search.value = 'gloria'; search.dispatchEvent(new win.Event('input', { bubbles: true })); await tick();
  const pick = wroot.querySelector('#club-list .club-pick');
  if (!pick) throw new Error('club search found nothing (GBZ not under LS1?)');
  pick.click(); await tick();
  const next = wroot.querySelector('#wiz-next');
  if (!next || next.disabled) throw new Error('next still disabled after club pick');
  next.click(); await tick();
  // toggle a couple of settings chips
  [...wroot.querySelectorAll('.tag')].forEach(t => t.click()); await tick();
  const startBtn = wroot.querySelector('#wiz-start') || byText(wroot, 'button', 'START CAREER');
  startBtn.click();
  for (let i = 0; i < 200 && !done; i++) await tick();
  if (!done) throw new Error('wizard never produced a game');
  G = done; window.G = G; setG(G);
  if (G.user.clubId !== 'GBZ') throw new Error('expected GBZ, got ' + G.user.clubId);
  document.querySelector('.title-screen')?.remove();
  document.getElementById('app').style.display = '';
});
await step('badge-fallback club: all screens render', async () => {
  for (const name of Object.keys(screens)) { current = name; win.location.hash = name; route(); }
});

// ---------- 2) intl / national-team flow ----------
await step('intl: nt job offers list', async () => {
  current = 'intl'; win.location.hash = 'intl'; route();
});
await step('intl: take ENG job → squad/fixtures/tournament tabs', async () => {
  G.user.ntJob = 'ENG';
  route();
  const tabs = [...content.querySelectorAll('.tabs .tab')];
  if (tabs.length < 3) throw new Error('only ' + tabs.length + ' intl tabs');
  for (const b of tabs) b.click();
});

// ---------- 3) transfer hub: accept / reject / counter synthetic offers ----------
await step('transfers: hub accept+reject+counter', async () => {
  const uclub = G.world.clubs.get(G.user.clubId);
  const squad = uclub.squad.map(id => G.world.players.get(id)).filter(Boolean);
  const buyers = [...G.world.clubs.values()].filter(c => c.id !== uclub.id && c.league === 'EPL');
  G.offers = G.offers || [];
  G.offers.push(
    { id: 'qa1', pid: squad[0].id, from: buyers[0].id, type: 'buy', fee: 8, wage: squad[0].wage, role: 1, maxFee: 20, responded: false },
    { id: 'qa2', pid: squad[1].id, from: buyers[1].id, type: 'buy', fee: 5, wage: squad[1].wage, role: 1, maxFee: 12, responded: false },
    { id: 'qa3', pid: squad[2].id, from: buyers[2].id, type: 'loan', fee: 0, wage: squad[2].wage, role: 1, maxFee: 0, responded: false },
  );
  current = 'transfers'; win.location.hash = 'transfers'; route();
  const hub = byText(content, '.tabs .tab', 'Transfer hub');
  if (hub) hub.click();
  const acc = byText(content, 'button', 'Accept'); if (acc) acc.click();
  const rej = byText(content, 'button', 'Reject'); if (rej) rej.click();
  const ctr = byText(content, 'button', 'Counter');
  if (ctr) { ctr.click(); await tick(); const inp = document.querySelector('.modal-overlay input'); if (inp) { inp.value = '10'; inp.dispatchEvent(new win.Event('input', { bubbles: true })); const ok = byText(document, '.modal-overlay button', 'Send') || byText(document, '.modal-overlay button', 'Counter'); if (ok) ok.click(); } }
  closeModals();
  const remaining = G.offers.filter(o => !o.responded);
  if (remaining.length > 1) throw new Error(remaining.length + ' offers unresponded after clicks');
});

// ---------- 4) list/unlist/release ----------
await step('transfers: list + unlist', async () => {
  const { listPlayer, unlistPlayer } = await import('../js/engine/market.js');
  current = 'transfers'; route();
  const uclub = G.world.clubs.get(G.user.clubId);
  const p = G.world.players.get(uclub.squad[4]);
  listPlayer(G, p.id, 'sell', 15);
  unlistPlayer(G, p.id);
  route();
});

// ---------- 5) academy promote ----------
await step('academy: promote a youth player', async () => {
  current = 'academy'; win.location.hash = 'academy'; route();
  const btn = [...content.querySelectorAll('button')].find(b => b.textContent.includes('Promote') && !b.disabled);
  if (!btn) return console.log('     (no promotable youth — intake runs in-season, skipping click)');
  btn.click();
  closeModals();
});

// ---------- 6) hire scout modal ----------
await step('transfers: hire scout via modal', async () => {
  current = 'transfers'; route();
  const tab = byText(content, '.tabs .tab', 'Scouts'); if (tab) tab.click();
  const hire = byText(content, 'button', '+ Hire scout');
  if (!hire) throw new Error('no hire button');
  hire.click(); await tick();
  const modalEl = document.querySelector('.modal-overlay');
  if (!modalEl) throw new Error('no scout modal');
  const hireBtn = byText(modalEl, 'button', 'Hire') || [...modalEl.querySelectorAll('.club-pick')][0];
  if (hireBtn) hireBtn.click();
  await tick(); closeModals();
});

// ---------- 7) UI advance path ----------
await step('advanceFromUI several times', async () => {
  for (let i = 0; i < 6; i++) { await advanceFromUI(G); await tick(); closeModals(); }
  route();
});

// ---------- 8) save + reload from localStorage ----------
await step('save then reload slot 0 and re-render', async () => {
  saveGame(G, 0);
  const { loadGame } = await import('../js/state.js');
  const G2 = await loadGame(0);
  if (!G2 || !G2.world) throw new Error('loadGame returned nothing');
  G = G2; window.G = G; setG(G);
  for (const name of Object.keys(screens)) { current = name; win.location.hash = name; route(); }
});

// ---------- 9) long sim to season rollover, playing out matchdays ----------
await step('full season: advance to rollover', async () => {
  let guard = 0, matches = 0, rollovers = 0;
  const t0 = Date.now();
  while (guard++ < 400 && rollovers === 0) {
    const r = advanceUntil(G);
    if (r === 'match' && G.pendingMatch) {
      const m = G.pendingMatch;
      applyMatchResult(G, m, quickSim(m, G.world, matchSeed(m.id)));
      G.pendingMatch = null;
      matches++;
      closeModals();
    } else if (r === 'seasonend' || r === 'rollover') {
      rollovers++;
    }
    if (Date.now() - t0 > 60000) throw new Error('season sim timeout at ' + G.date);
  }
  console.log('     sim: ' + matches + ' user-visible matches, date=' + G.date);
  if (rollovers === 0) throw new Error('never reached rollover');
});

// ---------- 10) post-rollover screens + new-season tabs ----------
await step('post-rollover: all screens + tabs again', async () => {
  for (const name of Object.keys(screens)) {
    current = name; win.location.hash = name; route();
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const next = [...content.querySelectorAll('.tabs > .tab:not(.on)')].find(b => !seen.has(b.textContent));
      if (!next) break;
      seen.add(next.textContent);
      next.click();
    }
  }
});
await step('post-rollover: save size sanity', async () => {
  const r = saveGame(G, 0);
  const all = JSON.parse(localStorage._d['fcm26_saves'] || '{}');
  const sz = all[0] ? all[0].length / 1e6 : -1;
  console.log('     save ok=' + (r && r.ok), 'size ~', sz.toFixed(2), 'MB');
  if (!r || !r.ok || sz < 0.5) throw new Error('save broken: ' + (r && r.err));
});

console.log(fails === 0 && pageErrors.length === 0 ? 'DEEP FLOW TEST PASSED' : 'DEEP FLOW TEST FAILED');
if (fails) console.log('failed steps:', fails);
if (pageErrors.length) { console.log('page errors:'); [...new Set(pageErrors)].slice(0, 15).forEach(e => console.log('  ' + e)); }
process.exit(fails || pageErrors.length ? 1 : 0);
