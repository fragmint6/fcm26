// FCM 26 — data import test
import { newGame, serialize, deserialize } from '../js/state.js';
import { importPlayers } from '../js/engine/import.js';

const G = await newGame({ managerName: 'T', managerNat: 'ENG', clubId: 'ARS', startDate: '2026-08-01' });

const csv = `Name,Club,Pos,Age,Nat,OVR,POT,PAC,SHO,PAS,DRI,DEF,PHY,Sprint Speed,Acceleration,Finishing,Long Shots,Positioning,Penalties,Shot Power,Volleys,Vision,Crossing,Free Kick Acc.,Short Passing,Long Passing,Curve,Agility,Balance,Reactions,Ball Control,Composure,Interceptions,Heading Accuracy,Marking,Standing Tackle,Sliding Tackle,Jumping,Stamina,Strength,Aggression,GK Diving,GK Handling,GK Kicking,GK Reflexes,GK Speed,GK Positioning
Erling Haaland,Manchester City,ST,26,NOR,91,92,90,94,72,82,48,90,90,89,95,84,93,92,95,84,72,64,68,74,72,66,76,72,84,82,88,83,65,70,48,52,40,82,86,92,66,,,,,,
Fake Player FC,Arsenal,CM,22,FRA,80,88,78,74,82,84,70,76,79,80,74,76,80,78,81,76,72,74,78,79,80,75,78,72,74,76,78,80,72,74,76,72,66,72,74,78,70,,,,,,
Thibaut Courtois,Real Madrid,GK,34,BEL,89,89,52,15,74,78,46,82,,,,,,,,,,,,,,,,,,,,,,,,,,,,,86,87,80,88,50,88`;

const r = importPlayers(G, csv);
console.log('report:', JSON.stringify(r));
const haaland = [...G.world.players.values()].find(p => p.name === 'Erling Haaland');
console.log('Haaland: ovr', haaland.ovr, '| fin', haaland.det.fin, '| spe', haaland.det.spe, '| pen', haaland.det.pen, '| spow', haaland.det.spow);
const fake = [...G.world.players.values()].find(p => p.name === 'Fake Player FC');
console.log('created: club', fake && fake.clubId, 'ovr', fake && fake.baseOvr, 'vis', fake && fake.det.vis);
const courtois = [...G.world.players.values()].find(p => p.name === 'Thibaut Courtois');
console.log('Courtois: ovr', courtois.ovr, '| div', courtois.det.div, '| gkpos', courtois.det.gkpos, '| fin leaked?', courtois.det.fin);

const G2 = await deserialize(JSON.parse(JSON.stringify(serialize(G))));
const h2 = [...G2.world.players.values()].find(p => p.name === 'Erling Haaland');
console.log('after reload: ovr', h2.ovr, 'fin', h2.det.fin, 'spe', h2.det.spe);
const f2 = [...G2.world.players.values()].find(p => p.name === 'Fake Player FC');
console.log('created after reload:', !!f2, f2 && f2.baseOvr, f2 && f2.clubId);
const c2 = [...G2.world.players.values()].find(p => p.name === 'Thibaut Courtois');
console.log('GK after reload:', c2.det.div, c2.det.gkpos);
console.log('IMPORT TEST PASSED');
