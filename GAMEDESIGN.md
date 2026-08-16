# FOOTBALL CLUB MANAGER 2026 — Full Game Design Document

**Genre:** Football management simulation (career mode). **Platform:** Browser (single-page app, works offline after load). **Saves:** 3 local slots + autosave.
**Inspiration:** EA Sports FC 26 Manager Career Mode. You manage a club: tactics, squad, transfers, scouting, youth academy, finances, board — and every match is **simulated** (watch it unfold live, or jump to result). You never control the players.

> **Licensing note:** This is an original fan project. Player names and club names are factual information; all **ratings are original estimates**, club crests are **original stylized crests**, and player images are **procedurally generated portraits** (EA's database, logos, and photos are not used).

---

## 1. High-level game loop

1. Create a manager (name, nationality, style) → choose a club (any of ~470 clubs in 23 leagues) → set difficulty & feature toggles.
2. Pick a starting point: **pre-season (Aug 1, 2026)** or **current date (Aug 15, 2026)** — live-start style.
3. Run the club week to week: manage squad/tactics → advance the calendar → press conferences, news, scouting reports, transfer windows, injuries, board objectives all flow in real time.
4. On matchday: pick the XI, tactics, set-piece takers, team talk → **Watch Sim** (minute-by-minute replay with commentary, adjustable speed) or **Instant Result**.
5. Season ends → awards ceremony, season review → European qualification, promotions/relegations → new season with new objectives. Manage for 15+ seasons. You can be hired by other clubs or national teams, sacked, poached, or retire.

---

## 2. World model ("Deeper Simulation")

### 2.1 Leagues (23 leagues, ~470 clubs, ~10,000 players)
| Nation | Top flight | 2nd tier | Cups |
|---|---|---|---|
| England | Premier League (20) | Championship (24) | FA Cup, EFL Cup, Community Shield |
| Spain | LaLiga (20) | LaLiga 2 (22) | Copa del Rey, Supercopa de España |
| Italy | Serie A (20) | Serie B (20) | Coppa Italia, Supercoppa Italiana |
| Germany | Bundesliga (18) | 2. Bundesliga (18) | DFB-Pokal, DFL-Supercup |
| France | Ligue 1 (18) | Ligue 2 (18) | Coupe de France, Trophée des Champions |
| Netherlands | Eredivisie (18) | — | — |
| Portugal | Liga Portugal (18) | — | — |
| Türkiye | Süper Lig (19) | — | — |
| Belgium | Pro League (16) | — | — |
| Scotland | Premiership (12) | — | — |
| Austria, Switzerland, Denmark, Greece, Czechia, Ukraine, Norway, Sweden, Poland, Croatia, Serbia, Romania, Saudi Arabia | 1 league each | — | — |

- **Every league fully simulates** — results, tables, top scorers, form — so the whole football world is alive (transfers, awards and news come from all of it).
- Promotion/relegation in the big-5 (2 or 3 up/down, England has playoffs).
- Real squads (hand-authored names + original ratings) for the big-5 top flights + stars elsewhere; the rest of each squad is generated, as are full squads in smaller leagues (clearly presented as generated).

### 2.2 Continental competitions (real 2026 formats)
- **UEFA Champions League** — 36-team league phase, 8 matches vs 8 different opponents, top 8 → Round of 16, 9–24 → playoffs, rest eliminated.
- **UEFA Europa League** — 36-team league phase, same format.
- **UEFA Conference League** — 36-team league phase, 6 matches, 3 pots.
- Qualification from domestic tables + cup winners (season 1 seeded by club reputation). Knockout draws are seeded, no same-nation protection in group draws beyond UEFA rules.

### 2.3 International football
- **32 national teams** with full generated squads; real stars automatically called up by nationality.
- **Tournament cycle:** AFCON / Asian Cup / Gold Cup (summer 2027), UEFA EURO (24 teams) + Copa América (16) in 2028, **World Cup (48 teams, 12 groups) in 2030**, rotating onward. Friendlies in September/October/November/March windows.
- **International jobs:** offers arrive based on manager reputation & nationality; you can manage a club and a nation simultaneously. Squad selection, fixtures, tournament draws, awards (Golden Boot, Golden Ball, etc.).

### 2.4 Manager Market (FC 26 feature)
- AI managers have reputations, form, and objectives; underperforming managers get sacked and clubs hire replacements — news feed covers it.
- **Tactics transform with managers:** each AI manager has a preferred formation/mentality, so club identities change over seasons.
- **You** can be sacked (critical board rating) or **poached** by a bigger club; job offers arrive in the inbox with budgets and objectives.

### 2.5 Unexpected Events (FC 26 feature)
Random, realistic drama with consequences: board takeover (new budget/objectives), financial crisis, star's homesickness/transfer request, sudden retirement, injury crisis, dressing-room row (morale), sponsor bonus, stadium expansion windfall, FFP warning.

---

## 3. Start flow & settings

- **Manager creation:** name, nationality, avatar (procedural), preferred formation + playing style (possession / counter / balanced / gegenpress-lite), coaching style (affects youth growth slightly).
- **Club select:** browse by league, see squad quality, budget, objectives preview; filter by budget tier. Any club is playable.
- **Difficulty:** Beginner / Amateur / Semi-Pro / Professional / World Class / Legendary — affects sim luck, AI transfer aggression, board strictness, starting budget.
- **Feature toggles (FC 26 style):** Training Plans on/off, Scouting & Transfers on/off, Youth Academy on/off, Manager Market (locked to one club) on/off.
- **Career settings:** currency display, sim speed default, autosave on/off, news verbosity.

---

## 4. Hub & club management

### 4.1 Home / Hub
Next fixture, last result, form (W/D/L strip), league position mini-table, objective tracker with progress bars, unread news count, quick links (squad, transfers, academy), deadline-day countdown.

### 4.2 Squad hub
- Full squad list with EAFC-style **player cards** (OVR hexagon, position, 6 stats: PAC/SHO/PAS/DRI/DEF/PHY, potential, value, wage, morale, form, fitness/sharpness, contract).
- **FC IQ player roles** per position (e.g. Advanced Forward, Poacher, Box-to-Box, Ball-Playing Defender, Inverted Winger) with familiarity: Base / Role+ / Role++.
- **Development plans:** position role + training focus + intensity (Low/Balanced/High) — intensity trades injury risk for growth & sharpness.
- Contracts: renew (years, wage, squad role promise, release clause), squad roles (Crucial / Important / Rotation / Sporadic), captain & vice-captain, set-piece takers (penalty/FK/corner auto + manual).
- **Morale system:** playtime, results, contract happiness, promises; unhappy players can demand a transfer (accept / negotiate / refuse).
- **Fitness & sharpness:** match load, fatigue, recovery; sharpness from training intensity + matches.

### 4.3 Tactics
- 13 formations (4-3-3 Holding/Attack, 4-2-3-1 Wide/Narrow, 4-4-2 Flat/Diamond, 3-5-2, 5-4-1, 3-4-2-1, 4-1-4-1, 4-5-1, 4-2-2-2, 5-3-2).
- Mentality (5 levels), team sheet editor with auto-best-XI, position affinity logic, role-based chemistry, bench of 7, 5 subs per match.

---

## 5. Match simulation (the heart — matches are never played)

### 5.1 Pre-match
Team sheet → tactics → set pieces → captain → **team talk** (FC 25/26 style choice: motivate / demand win / relieve pressure / stay focused — affects morale with risk/reward).

### 5.2 Match engine (minute-by-minute)
- Full 90'+ engine: possession model, chance creation from attack vs defence quality, shots on/off target, blocked, woodwork, saves, goals, big chances, xG, fouls, yellow/red cards, offsides, corners, **injuries (18 types, 3 days – 7 months)**, fatigue curve, momentum swings, late-goal drama, AI substitutions at proper windows, added time.
- Player ratings computed per match (goals/assists/saves/key passes/cards...), MOTM.
- Modifiers: home advantage, form, morale, sharpness/fitness, team chemistry, tactics vs tactics, difficulty, weather (flavor).

### 5.3 Watch Sim
Live replay of the computed match: scoreboard, animated pitch (formations + ball movement + event flashes), scrolling **commentary feed**, stats panel (possession, shots, xG, corners, fouls, ratings), adjustable speed (1x/2x/4x/8x) and **Instant Result** jump. Quick Sim available from the calendar for non-user matches.

### 5.4 Post-match
Full report: score, scorers/assists, cards, injuries, player ratings, MOTM, league-table impact, press headline in news.

---

## 6. Transfers & contracts

### 6.1 Transfer search
Filter by name, position, age, OVR range, potential, value, wage, league, nation, contract length, release clause; sorting; player detail page with full stats and scouted/known accuracy.

### 6.2 Negotiations
- **Buy:** bid → AI counter-offers (3 rounds, willingness model based on importance, finances, rep gap, contract) → contract talks (wage, years, squad role, release clause on/off) → medical → signing news.
- **Sell:** AI clubs bid for your players; you set asking price, negotiate, counter; **player swap offers** supported (fee + player).
- **Loans:** in/out, 6–12 months, wage-share split; newly bought players can be loaned straight out (FC 26 logic).
- **Release clauses:** pay the clause to bypass negotiations (optional on user contracts).
- **Free agents:** sign any time; expiring contracts can be approached in January (Bosman) — players no longer auto-renew; they reach out to start talks (FC 26 logic).
- **Transfer windows:** Jul 1 – Aug 31 & Jan 1 – 31 with **Deadline Day** (increased AI activity + news ticker). Signings join immediately inside a window.

### 6.3 AI transfer market
Every window, AI clubs analyze squad needs (positional depth), budgets, wage space and club stature → realistic volume of moves (~200–400 per window across the world), loan out youngsters, sell surplus, trigger release clauses occasionally. News feed reports notable moves. Deeper simulation: AI teams track your shortlisted players too.

### 6.4 Player values
Value formula from OVR, age, potential, contract length, league reputation (€2026-scale: OVR 90 ≈ €120M, 85 ≈ €60M, 80 ≈ €30M, 75 ≈ €12M...). Wage demands scale with OVR/age/reputation and negotiation.

---

## 7. Scouting (Global Scouting Network)

- Hire up to 5 **scouts** (1–5★ judgment/experience, salary, region specialism).
- **Scouting instructions:** region (league/country), position, age range, min OVR/potential, max value.
- Reports arrive every few days: player cards with **attribute ranges** that narrow with scouting time; scouts now also report **potential** (FC 26 feature).
- Assign a scout to a specific player for a full report; known/well-known players have stats instantly visible (FC 26 "instantly access a player's full stats in a simulated league").
- **Transfer hub / shortlist** (up to 50), with value & wage estimates.

## 8. Youth Academy

- Academy squad of 8–14 U-15/U-17 players with position, OVR, and a **potential range** that refines over time.
- **Monthly intake report** (2–5 newgens), rare world-class gems.
- Youth scouts influence intake quality. Development plans + promotion to senior squad (min age 16), loan out for experience.
- Youth progression visible season over season; board objectives can require academy minutes (give X debuts / Y appearances).
- (FC 26's playable Youth Rush tournaments are out of scope — no gameplay — but youth development is fully simulated.)

## 9. Development, training & growth

- Growth engine: age curve (U-21 fast, 21–24 medium, 25–29 slow, 30+ decline), potential gap, game time, performance, morale, dev-plan fit, training intensity; sharpness mechanics; position conversion training; players retire at 34–38 (news + tribute).

## 10. Board, objectives & finances

- **Season objectives** (weighted priorities): domestic success (target position), continental success (target round), youth development, financial targets, brand exposure (sign X players of OVR ≥ Y). Progress tracked on Hub.
- **Manager rating 0–100**, monthly reviews, warnings, sacking; **job offers** from other clubs; **resign/retire** options.
- **Finances:** weekly P&L — sponsorships, matchday/ticket revenue, prize money, player wages, staff, transfer instalments; transfer budget & wage budget; FFP-lite warning; prize money tables for every competition; season-end budget allocation.

## 11. News, press & narrative

- Inbox + news feed: results, transfers, injuries, scout reports, board messages, tournament draws, awards, retirements, managerial changes, unexpected events.
- Press conferences: pre-match questions with answer choices affecting morale/media narrative; post-match headlines (simplified but present).
- Deadline Day ticker, Manager Market storylines, club records & milestones (e.g., 100th goal).

## 12. Records, stats & awards

- League tables (P/W/D/L/GF/GA/GD/PTS, form), top scorers/assists/clean sheets/avg ratings per league, competition brackets & rounds.
- End-of-season **awards**: Player of the Season, Young POTY, Golden Boot, Playmaker, Golden Glove, Team of the Season XI, Manager of the Year (per big league + continental), tournament awards (Golden Ball, Golden Boot, Best GK).
- Manager legacy: trophy cabinet, career win %, transfer spend/received, season-by-season history, club history of winners.

## 13. Settings & saves

- 3 manual save slots + autosave after every advance/match/window; career timestamps on saves (FC 26 detail); difficulty changeable mid-career; feature toggles; news verbosity; reset career.

---

## 14. Art direction (100% original assets)

- **Crests:** procedural vector shields/circles in each club's real colors with monograms & pattern variants (stripes, hoops, diagonals, halves) — original, not the registered logos.
- **Player portraits:** stylized procedural busts (skin tone, hair, jersey number, club colors) generated deterministically per player.
- **UI:** dark EAFC-style dashboard, lime/teal accents, hexagon OVR badges, stat bars, emoji nation flags, full dark mode.

## 15. Explicitly out of scope (with reasons)

- **Playing matches / Playable Highlights / Rush tournaments** — this is a management sim by request; matches are only simulated.
- **Women's football leagues** — doubles the data model; can be added later.
- **Manager Live Challenges online service / Season Points / ICONs & Heroes** — live-service & licensing features; an offline "Board Challenges" equivalent (Treble, Top at Christmas...) is included instead.
- **Real EA ratings database, official club crests, real player photos** — proprietary/copyrighted; original equivalents used.
- Online multiplayer, microtransactions, commentary audio.

---

## 16. Technical design

- **Stack:** vanilla JS (ES modules), no build step; single-page app served statically; localStorage saves (compact serialized state, ~1–2 MB); deterministic world generation (seeded) so saves stay small and replayable.
- **Engine is DOM-free** (testable headless in Node); UI renders from a global state object; hash-based screen router; all league simulations run instantly when you advance the calendar.
- **Performance:** ~10,000 players simulated daily (fitness/morale/injury), weekly/monthly growth, per-day transfer AI with indexed candidate pools — advances resolve in <1s.
