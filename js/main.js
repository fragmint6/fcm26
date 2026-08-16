// ============ FCM 26 — main boot & router ============
import { newGame, loadGame, saveGame, loadSaves, switchClub } from './state.js';
import { setG, getG, updateTopbar, renderHome, renderSquad, renderTransfers, renderAcademy, renderSeason, renderClub, renderNews, renderIntl, renderSettings, advanceFromUI, userClub } from './ui/screens.js';
import { startWizard } from './ui/wizard.js';
import { showMatchday } from './ui/matchscreen.js';
import { h, esc, fmtMoney, fmtDate, RNG } from './util.js';

let G = null;
const screens = { home: renderHome, squad: renderSquad, transfers: renderTransfers, academy: renderAcademy, season: renderSeason, club: renderClub, news: renderNews, intl: renderIntl, settings: renderSettings };

function boot() {
  startWizard(onStart);
}
function onStart(g) {
  G = g;
  setG(G);
  window.G = G;
  initUI();
  location.hash = 'home';
  route();
}
function initUI() {
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.screen; }));
  window.addEventListener('hashchange', route);
  document.querySelector('#btn-advance').addEventListener('click', () => advanceFromUI(G));
  document.querySelector('#brand').addEventListener('click', () => { location.hash = 'home'; });
  window.addEventListener('fcm-aftermatch', () => {
    if (G.settings.autosave) saveGame(G, 0);
    updateTopbar(G);
    route();
  });
  window.addEventListener('beforeunload', () => { if (G && G.settings.autosave) saveGame(G, 0); });
  setInterval(() => { if (G && G.settings.autosave) saveGame(G, 0); }, 90000);
}
function route() {
  const hsh = location.hash.replace('#', '') || 'home';
  const key = hsh in screens ? hsh : 'home';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === key));
  const c = document.querySelector('#content');
  c.innerHTML = '';
  let el;
  if (G.careerState === 'sacked') el = sackedScreen(G);
  else if (G.careerState === 'retired') el = retiredScreen(G);
  else el = screens[key](G);
  c.append(el);
  updateTopbar(G);
}

function sackedScreen(G) {
  const root = h('div');
  root.append(h('div', { class: 'card', style: 'text-align:center;padding:30px' },
    h('div', { style: 'font-size:40px;margin-bottom:10px' }, '🚨'),
    h('div', { class: 'screen-title', style: 'justify-content:center' }, 'You have been sacked'),
    h('p', { class: 'screen-sub', style: 'max-width:520px;margin:0 auto 16px' }, `The board of ${userClub(G).name} have terminated your contract. Your managerial journey does not have to end here.`)));
  const offers = genEmergencyOffers(G);
  root.append(h('div', { class: 'card' },
    h('div', { class: 'card-title', style: 'margin-bottom:10px' }, 'Available jobs'),
    h('div', null, ...offers.map(o => h('div', { class: 'obj-row' },
      h('div', { class: 'obj-label' }, h('div', { style: 'font-weight:700' }, o.name), h('div', { class: 'screen-sub' }, o.note)),
      h('button', { class: 'btn btn-sm btn-primary', onclick: () => { switchClub(G, o.id); G.careerState = 'active'; route(); } }, 'Take job')))),
    h('div', { style: 'text-align:center;margin-top:12px' },
      h('button', { class: 'btn btn-danger', onclick: () => { G.careerState = 'retired'; route(); } }, 'End career'))));
  return root;
}
function genEmergencyOffers(G) {
  const rng = new RNG(Date.now() & 0x7fffffff);
  const cur = userClub(G);
  const pool = [...G.world.clubs.values()].filter(c => c.rep <= cur.rep - 3 && c.rep >= 58 && !c.offeredJob);
  const picks = rng.shuffle(pool).slice(0, 3);
  for (const c of picks) c.offeredJob = true;
  return picks.map(c => ({ id: c.id, name: c.name, note: `Reputation ${c.rep} · Transfer budget ${fmtMoney(c.tb)}` }));
}

function retiredScreen(G) {
  const root = h('div');
  const seasons = G.hist.seasons.length;
  const rec = G.manager.record;
  const games = rec.w + rec.d + rec.l;
  root.append(h('div', { class: 'card', style: 'text-align:center;padding:30px' },
    h('div', { style: 'font-size:40px;margin-bottom:10px' }, '🏆'),
    h('div', { class: 'screen-title', style: 'justify-content:center;font-size:24px' }, `${esc(G.manager.name)} — Career complete`),
    h('p', { class: 'screen-sub', style: 'max-width:520px;margin:0 auto 20px' }, `You managed for ${seasons} season${seasons > 1 ? 's' : ''}, winning ${games} of ${games ? '' : '0'} games recorded in your legacy. The football world will remember you.`),
    h('div', { class: 'grid grid-3', style: 'max-width:640px;margin:0 auto' },
      kpiLite('Seasons', String(seasons)), kpiLite('Trophies', String(G.manager.trophies.length)), kpiLite('Record', `${rec.w}W ${rec.d}D ${rec.l}L`)),
    h('button', { class: 'btn btn-primary', style: 'margin-top:22px', onclick: () => location.reload() }, 'Back to title'),
  ));
  return root;
}
function kpiLite(label, val) {
  return h('div', { class: 'kpi' }, h('div', { class: 'k-label' }, label), h('div', { class: 'k-val' }, val));
}

boot();
