// ============ FCM 26 — headless DOM test (jsdom) ============
import { JSDOM } from 'jsdom';
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
</body></html>`, { url: 'http://localhost/', pretendToBeVisual: true });

const win = dom.window;
global.window = win;
global.document = win.document;
global.localStorage = { _d: {}, setItem(k, v) { this._d[k] = v; }, getItem(k) { return this._d[k] || null; }, removeItem(k) { delete this._d[k]; } };
global.CustomEvent = win.CustomEvent;
global.requestAnimationFrame = cb => setTimeout(cb, 0);
win.requestAnimationFrame = cb => setTimeout(cb, 0);

const { newGame, saveGame } = await import('../js/state.js');
const { setG, updateTopbar, renderHome, renderSquad, renderTransfers, renderAcademy, renderSeason, renderClub, renderNews, renderIntl, renderSettings, showPlayerModal, showResultModal, advanceFromUI } = await import('../js/ui/screens.js');
const { showMatchday } = await import('../js/ui/matchscreen.js');
const { quickSim, matchSeed, fullSim } = await import('../js/engine/match.js');
const { applyMatchResult, advanceUntil } = await import('../js/engine/advance.js');

const t0 = Date.now();
const G = await newGame({ managerName: 'UI Test', managerNat: 'ENG', clubId: 'MCI', startDate: '2026-08-01' });
setG(G);
window.G = G;
console.log('world+ui boot:', Date.now() - t0, 'ms');

const content = document.querySelector('#content');
const screens = { home: renderHome, squad: renderSquad, transfers: renderTransfers, academy: renderAcademy, season: renderSeason, club: renderClub, news: renderNews, intl: renderIntl, settings: renderSettings };
let ok = 0;
for (const [name, fn] of Object.entries(screens)) {
  try {
    content.innerHTML = '';
    content.append(fn(G));
    updateTopbar(G);
    ok++;
  } catch (e) { console.error('SCREEN FAIL', name, ':', e.message, '\n', e.stack.split('\n')[1]); }
}
console.log('screens rendered:', ok, '/', Object.keys(screens).length);

// player modal
try {
  const star = [...G.world.players.values()].find(p => p.name === 'Erling Haaland');
  showPlayerModal(G, star.id);
  document.querySelector('.modal-overlay')?.remove();
  const fwd = [...G.world.players.values()].find(p => p.name === 'Bukayo Saka');
  showPlayerModal(G, fwd.id);
  document.querySelector('.modal-overlay')?.remove();
  console.log('player modal OK');
} catch (e) { console.error('PLAYER MODAL FAIL:', e.message, e.stack.split('\n')[1]); }

// advance to first match & run matchday
try {
  let r = advanceUntil(G);
  let guard = 0;
  while (r !== 'match' && guard++ < 20) {
    if (r === 'seasonend' || r === 'rollover') break;
    r = advanceUntil(G);
  }
  console.log('advance to:', G.date, r, '| pending:', G.pendingMatch && G.pendingMatch.id);
  if (G.pendingMatch) {
    showMatchday(G);
    // instant result via the engine path used by UI
    const m = G.pendingMatch;
    const res = quickSim(m, G.world, matchSeed(m.id));
    applyMatchResult(G, m, res);
    document.querySelector('.match-wrap')?.remove();
    console.log('matchday OK:', res.hg + '-' + res.ag);
  }
} catch (e) { console.error('MATCHDAY FAIL:', e.message, '\n', e.stack.split('\n').slice(0, 3).join('\n')); }

// result modal
try {
  const [mid, res] = Object.entries(G.results)[0];
  showResultModal(G, G.matchIndex.get(mid));
  document.querySelector('.modal-overlay')?.remove();
  console.log('result modal OK');
} catch (e) { console.error('RESULT MODAL FAIL:', e.message); }

// save via localStorage
try {
  const r = saveGame(G, 0);
  console.log('saveGame:', r.ok ? 'OK (' + Math.round(r.size / 1024) + ' KB)' : 'FAIL ' + r.err);
} catch (e) { console.error('SAVE FAIL:', e.message); }

// advance a full season with autosave off, clicking through all stops
try {
  let guard = 0, results = 0;
  while (guard++ < 800) {
    const r = advanceUntil(G);
    if (r === 'match') {
      const m = G.pendingMatch;
      const res = quickSim(m, G.world, matchSeed(m.id));
      applyMatchResult(G, m, res);
    } else if (r === 'seasonend') {
      console.log('season ended at', G.date);
    } else if (r === 'rollover') break;
  }
  console.log('full season sim OK →', G.date, '| results:', Object.keys(G.results).length);
} catch (e) { console.error('SEASON FAIL:', G.date, e.message, e.stack.split('\n')[1]); }

console.log('UI TEST DONE in', Date.now() - t0, 'ms');
process.exit(0);
