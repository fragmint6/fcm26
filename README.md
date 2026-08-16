# ⚽ FOOTBALL CLUB MANAGER 2026 (FCM 26)

A complete football management career game for the browser — inspired by EA Sports FC manager career mode, but **you never play a match**: every match is simulated, and you control everything else.

▶ **Play it now:** open the live preview (served on port 8000). Everything runs in your browser; no install needed.

---

## What's in the game

**The world**
- **50 leagues · 800+ clubs · ~33,000 players** — with the full FC26 database (18,405 real players) imported, the game dynamically builds every league the data covers: the big 5 + their tiers (down to League Two and 3. Liga), Eredivisie, Portugal, Türkiye, Belgium, Scotland, Austria, Switzerland, Denmark, Greece, Czechia, Croatia, Poland, Norway, Sweden, Ukraine, Romania, Saudi Arabia — plus Argentina, Brazil, MLS, China, Korea, Australia, India, Ireland, Chile, Uruguay, Venezuela, Colombia, Peru, Paraguay, Bolivia, Cyprus, Hungary, Finland and Azerbaijan. — Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 + their second tiers, plus Eredivisie, Liga Portugal, Süper Lig, Belgium, Scotland, Austria, Switzerland, Denmark, Greece, Czechia, Ukraine, Norway, Sweden, Poland, Croatia, Serbia, Romania & Saudi Arabia.
- **18,405 real players from the FC26 database** — full attributes, real wages, release clauses, contracts, positions, weak foot, skill moves, traits and real photos. Clubs the game didn't know are created from the data itself.
- **Every league simulates** — results, tables, top scorers, form, transfers and awards flow from the whole world.
- **UEFA Champions League / Europa League / Conference League** in the real 2026 formats (36-team league phases, seeded knockouts, two-legged ties).
- **Domestic cups** (FA Cup, EFL Cup, Copa del Rey, Coppa Italia, DFB-Pokal, Coupe de France), super cups, and the 4-team Spanish/Italian supercups.
- **Promotion & relegation**, European qualification from real results.

**Match simulation (matches are never played)**
- Full minute-by-minute engine: possession, chances, xG, saves, cards, injuries (18 types), momentum, auto-subs, added time, MOTM, player ratings.
- **Watch Sim** with live commentary, adjustable speed (1x–8x) or **Instant Result**.
- Tactics: 13 formations, 5 mentalities, editable team sheet, captain & set-piece takers, FC IQ-style player roles (Base / Role+ / Role++), pre-match **team talks**.

**Management**
- **Transfers:** global search with filters, AI counter-negotiations, release clauses, loans, free agents, transfer-listing your players, incoming AI bids you can accept/counter/reject, swap-style multi-round talks, deadline days, and a living AI market (~200–400 moves per window).
- **Full attribute model & real data**
- Every player carries **~35 attributes** beyond the six face stats — Sprint Speed, Acceleration, Finishing, Long Shots, Shot Power, Volleys, Positioning, Penalties, Vision, Crossing, Free Kick Accuracy, Short/Long Passing, Curve, Agility, Balance, Reactions, Ball Control, Composure, Interceptions, Heading Accuracy, Marking, Standing/Sliding Tackle, Jumping, Stamina, Strength, Aggression, and the six GK stats. Open any player → **📊 All attributes**.
- **EAFC database import:** drop **any number of files** into `uploads/` (`.csv` or `.json`, subfolders fine) and run `node tools/build_import.mjs` (or `npm run build:data`). Three schemas supported: the 117-column CM Tracker format (`attributes.*`, `card_attrs.*`, `info.*`), SoFIFA/Kaggle-style CSVs (Acceleration, Sprint Speed, Weak foot, Skill moves, Alternative positions, GK columns…), and JSON arrays. Files are merged and deduped by database player id, women's rows are filtered, every matched player gets real overall/potential/all substats/positions/foot/skill moves/weak foot/height/weight/traits/wage/release clause/contract length — plus their real headshot (live from the data; `--cache` downloads locally). Report at `uploads/import_report.txt`. 25 players ship pre-loaded; a full database scales automatically (2,000-row test: 0.6s world build, saves stay ~3MB).
- **Real photos:** imported players render their actual headshot — a local cached copy in `assets/faces/p<id>.png` first, the live URL from the data as fallback, then your own files (`assets/faces/<name>.png`), then generated art. Club badges work the same way: `assets/badges/<CLUBID>.png`.
- **Settings → Import player data** accepts the same CSV formats by paste, for quick experiments without rebuilding.
- **Scouting:** hire up to 5 scouts (1–5★), set instructions (position/region/age/potential), receive reports with narrowing attribute ranges.
- **Youth Academy:** monthly intakes, potential gems, promote your prospects to the first team.
- **Development:** age-curve growth, training plans (focus + intensity), morale, form, fitness & sharpness, suspensions, retirements, contract renewals & expiries.
- **Board & objectives:** weighted season objectives (league, cups, Europe, youth, financial, brand), manager rating, sackings, **job offers from other clubs**, resign/retire.
- **Unexpected events:** takeovers, financial crises, dressing-room rows, transfer requests, injury crises…
- **Manager Market:** AI managers get hired and fired and change clubs' tactics (FC 26-style).
- **International football:** 100+ national teams, friendlies in FIFA windows, **AFCON / Asian Cup / Gold Cup (2027), EURO + Copa América (2028), World Cup (2030)**, national-team job offers, squad selection, and full tournament simulations.
- **Awards & history:** Golden Boot, Playmaker, Golden Glove, Player of the Season, Team of the Season, champions history, your manager legacy.

**Settings & saves**
- 6 difficulties, feature toggles (training / scouting & transfers / youth academy / one-club challenge), autosave + 3 manual save slots (localStorage).

## Running locally

```bash
npm run serve   # → http://localhost:8000
```

Tests (headless):
```bash
npm run smoke           # engine: world gen, full season, rollover, save/load
node tools/uitest.mjs   # jsdom: renders every screen + matchday + wizard
```

## Project layout

```
index.html            app shell
css/style.css         EAFC-style dark UI theme
js/util.js            helpers, RNG, positions, formations, DOM utils
js/data/clubs.js      473 clubs, 23 leagues, cups, UEFA, national teams
js/data/players_*.js  ~1,900 real squads (original ratings)
js/data/names.js      name pools, commentary, injuries, events, team talks
js/data/worldgen.js   deterministic world build (~15k players)
js/engine/match.js    minute-by-minute & quick sim engines
js/engine/schedule.js fixtures, cups, Europe, season builder
js/engine/advance.js  daily simulation loop, match application
js/engine/market.js   values, wages, negotiations, AI transfer market
js/engine/scouting.js scouting reports & knowledge
js/engine/growth.js   development, youth intakes
js/engine/board.js    objectives, rating, manager market, events, awards
js/engine/intl.js     national teams, windows, tournaments
js/state.js           new game, save/load, season rollover
js/ui/*.js            components, screens, matchday, wizard
js/main.js            boot & router
GAMEDESIGN.md         the full feature plan
```

## Licensing & attribution note

FCM 26 is an original fan project. Club names and player names are factual information; the game's bundled ratings are original estimates and its bundled artwork is procedurally generated. The project also supports **user-supplied data and images**: a database CSV you provide (`uploads/players.csv`) is applied by the importer, and images you provide (or that your own data file references) are loaded at runtime in your browser. This project is not affiliated with or endorsed by EA SPORTS or any football organisation.
