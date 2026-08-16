// Build js/data/badges_remote.js: club-id -> football-logos.cc PNG URL.
// Sources: uploads/flcc/{country-slug}.tsv (scraped "Name \t file.png" rows)
// Targets: uploads/clubs_country.json (every club in the game world)
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const COUNTRY_SLUG = {
  ENG:'england', ESP:'spain', ITA:'italy', GER:'germany', FRA:'france',
  NED:'netherlands', POR:'portugal', TUR:'turkey', BEL:'belgium', SCO:'scotland',
  SUI:'switzerland', AUT:'austria', DEN:'denmark', GRE:'greece', CZE:'czech-republic',
  NOR:'norway', SWE:'sweden', POL:'poland', CRO:'croatia', SRB:'serbia',
  ROU:'romania', UKR:'ukraine', KSA:'saudi-arabia', ARG:'argentina', BRA:'brazil',
  USA:'usa', CHN:'china', KOR:'south-korea', IND:'india', AUS:'australia',
  COL:'colombia', CHI:'chile', ECU:'ecuador', URU:'uruguay', PAR:'paraguay',
  PER:'peru', VEN:'venezuela', BOL:'bolivia', IRL:'republic-of-ireland',
  FIN:'finland', CYP:'cyprus', AZE:'azerbaijan', HUN:'hungary', WAL:'england',
};

// legal-form tokens removed from BOTH sides (keeps entity words like united/city)
const STOP = /\b(fc|cf|sc|afc|cfc|pfc|ac|as|ss|ssd|ssv|sv|vfl|vfb|bv|tsv|tsg|fk|sk|nk|hnk|gnk|ud|cd|rcd|sd|ca|cs|us|usl|spvgg|sg|bsc|vv|if|bk|ff|fotboll|futebol|sad|club|de|del|deportivo|deportes|rc|stade|olympique|the|1|2|ii|1899|1907|1905|1904|1896|1995|1923|1961|1912|1913|1948|1908|1911|1964|calcio)\b/g;

const norm = s => String(s || '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/ß/gi, 'ss').replace(/ø/gi, 'o').replace(/æ/gi, 'ae').replace(/ð/gi, 'd')
  .replace(/þ/gi, 'th').replace(/ł/gi, 'l').replace(/ı/gi, 'i').replace(/đ/gi, 'd')
  .replace(/đ/g, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(STOP, ' ')
  .replace(/\s+/g, ' ').trim();

// game-name-norm -> tsv-name-norm (both sides already normed)
const ALIAS = {
  'rennais':'rennes',
  'koln':'cologne', 'jahn regensburg':'jahn', 'wehen wiesbaden':'wiesbaden',
  'waldhof mannheim':'sv waldhof mannheim', 'energie cottbus':'cottbus',
  'viktoria koln':'viktoria koln', 'grossaspach':'grossaspach',
  'erzgebirge aue':'erzgebirge aue', 'carl zeiss jena':'jena', 'hallescher':'hallescher',
  'mainz':'mainz 05', '1860 munich':'1860 munchen', '1860 munchen':'1860 munchen',
  'schweinfurt':'schweinfurt', 'ssv ulm':'ssv ulm fussball', 'ulm':'ssv ulm fussball',
  'stuttgart ii':'stuttgart', 'hoffenheim ii':'hoffenheim',
  'st pauli':'st pauli', 'werder bremen':'werder', 'union berlin':'union berlin',
  'fortuna dusseldorf':'fortuna dusseldorf', 'hannover':'hannover 96', 'karlsruher':'karlsruher',
  'hertha':'hertha', 'holstein kiel':'kiel', 'rot weiss essen':'essen',
  'preussen munster':'preussen munster', 'ingolstadt':'ingolstadt',

  'sheffield united':'sheffield united', 'sheffield wednesday':'sheffield wednesday',
  'queens park rangers':'queens park rangers', 'notts':'notts', 'wimbledon':'wimbledon',
  'brighton hove albion':'brighton', 'west bromwich albion':'west bromwich albion',
  'wolverhampton wanderers':'wolverhampton', 'preston north end':'preston north end',

  'atletico madrid':'atletico madrid', 'athletic bilbao':'athletic club',
  'celta vigo':'celta', 'alaves':'alaves', 'deportivo alaves':'alaves',
  'racing santander':'racing', 'racing ferrol':'racing ferrol', 'cadiz':'cadiz',
  'mallorca':'mallorca', 'espanyol':'espanyol', 'osasuna':'osasuna', 'leganes':'leganes',
  'las palmas':'las palmas', 'zaragoza':'zaragoza', 'oviedo':'oviedo', 'almeria':'almeria',
  'granada':'granada', 'malaga':'malaga', 'tenerife':'tenerife', 'eibar':'eibar',
  'burgos':'burgos', 'huesca':'huesca', 'mirandes':'mirandes', 'cartagena':'cartagena',
  'albacete':'albacete', 'eldense':'eldense', 'alcorcon':'alcorcon', 'castellon':'castellon',
  'cordoba':'cordoba', 'cultural leonesa':'cultural leonesa', 'valladolid':'valladolid',
  'andorra':'andorra', 'getafe':'getafe', 'levante':'levante', 'elche':'elche',
  'girona':'girona', 'sporting gijon':'sporting gijon', 'real sociedad b':'real sociedad',

  'milan':'milan', 'inter':'inter', 'roma':'roma', 'verona':'verona', 'sudtirol':'suditrol',
  'brescia':'union brescia', 'como':'como 1907', 'mantova':'mantova 1911',
  'carrarese':'carrarese calcio', 'frosinone':'frosinone calcio', 'cittadella':'cittadella',
  'virtus entella':'virtus entella', 'juve stabia':'juve stabia', 'union brescia':'union brescia',

  'paris saint germain psg':'paris saint germain psg', 'lyon':'lyonnais',
  'olympique lyon':'lyonnais', 'marseille':'marseille', 'rennes':'rennes',
  'stade rennais':'rennes', 'brest':'brest', 'stade brestois':'brest',
  'montpellier':'montpellier', 'auxerre':'auxerre', 'angers':'angers',
  'caen':'caen', 'sm caen':'caen', 'troyes':'troyes', 'ajaccio':'ajaccio',
  'martigues':'martigues', 'dunkerque':'dunkerque', 'guingamp':'guingamp',
  'en avant guingamp':'guingamp', 'rouen':'rouen', 'saint etienne':'saint etienne',
  'laval':'stade lavallois', 'stade lavallois mayenne':'stade lavallois',
  'rodea aveyron':'rodez af', 'rodez aveyron':'rodez af', 'rodez':'rodez af',
  'bastia':'bastia', 'boulogne cote opale':'boulogne', 'boulogne':'boulogne',
  'annecy':'annecy', 'clermont':'clermont', 'grenoble':'grenoble', 'nancy':'nancy',
  'pau':'pau', 'reims':'reims', 'nantes':'nantes', 'metz':'metz', 'dijon':'dijon',
  'sochaux':'sochaux', 'amiens':'amiens', 'le mans':'le mans', 'le havre':'le havre',
  'lens':'lens', 'lorient':'lorient', 'monaco':'monaco', 'nice':'nice', 'lille':'lille',
  'strasbourg':'strasbourg', 'toulouse':'toulouse', 'red star':'red star',
  'valenciennes':'valenciennes', 'versailles':'versailles', 'concarneau':'concarneau',
  'quevilly':'quevilly rouen metropole', 'orleans':'orleans', 'le puy':'le puy',
  'villefranche':'villefranche beaujolais', 'nimes':'nimes olympique',
  'bourg en bresse':'bourg en bresse peronnas', 'chateauroux':'chateauroux',

  'pec zwolle':'pec', 'pec':'pec', 'nec':'nec', 'go ahead eagles':'go ahead eagles',
  'nac':'nac', 'rkc':'rkc', 'az':'az', 'psv':'psv', 'top oss':'top oss',
  'vvv':'vvv', 'de graafschap':'de graafschap', 'den bosch':'den bosch',
  'excelsior':'excelsior', 'telstar':'telstar', 'cambuur':'cambuur', 'emmen':'emmen',
  'heracles':'heracles', 'roda':'roda', 'vitesse':'vitesse', 'volendam':'volendam',
  'utrecht':'utrecht', 'groningen':'groningen', 'heerenveen':'heerenveen',
  'sparta':'sparta', 'willem ii':'willem ii', 'fortuna sittard':'fortuna sittard',
  'almere':'almere', 'ado':'ado', 'dordrecht':'dordrecht', 'helmond':'helmond',
  'eindhoven':'eindhoven', 'mvv':'mvv',

  'sporting cp':'sporting cp', 'braga':'braga', 'vitoria guimaraes':'vitoria guimaraes',
  'vitoria':'vitoria guimaraes', 'nacional':'nacional madeira', 'academica':'academica coimbra',
  'estrela amadora':'estrela amadora', 'gil vicente':'gil vicente', 'arouca':'arouca',
  'alverca':'alverca', 'casa pia':'casa pia', 'estoril':'estoril', 'famalicao':'famalicao',
  'moreirense':'moreirense', 'rio ave':'rio ave', 'santa clara':'santa clara',
  'academico viseu':'academico viseu', 'maritimo':'maritimo', 'avs':'avs futebol sad',
  'boavista':'boavista', 'farense':'farense', 'tondela':'tondela',

  'antwerp':'antwerp', 'cercle brugge':'cercle brugge', 'club brugge':'club brugge',
  'sint truiden':'sint truidense', 'sint truidense':'sint truidense',
  'standard liege':'standard liege', 'standard de liege':'standard liege',
  'union saint gilloise':'union sg', 'union sg':'union sg', 'raal la louviere':'raal la louviere',
  'oud heverlee leuven':'oh leuven', 'oh leuven':'oh leuven', 'zulte waregem':'zulte waregem',
  'kortrijk':'kortrijk', 'lommel':'lommel', 'dender':'dender eh', 'eupen':'eupen',
  'rfc liege':'rfc liege', 'charleroi':'charleroi', 'westerlo':'westerlo', 'genk':'genk',
  'gent':'gent', 'mechelen':'mechelen', 'anderlecht':'anderlecht', 'beveren':'beveren',

  'hearts':'hearts', 'heart of midlothian':'hearts', 'dundee':'dundee',
  'dundee united':'dundee united', 'st mirren':'st mirren', 'st johnstone':'st johnstone',
  'morton':'morton', 'greenock morton':'morton', 'partick':'partick thistle',
  'inverness':'inverness', 'dunfermline':'dunfermline', 'ayr':'ayr', 'falkirk':'falkirk',
  'livingston':'livingston', 'arbroath':'arbroath', 'ross':'ross county',
  'hibernian':'hibernian', 'motherwell':'motherwell', 'kilmarnock':'kilmarnock',
  'aberdeen':'aberdeen', 'celtic':'celtic', 'rangers':'rangers',

  'salzburg':'salzburg', 'rapid wien':'rapid vienna', 'lask':'lask',
  'wolfsberg':'wolfsberg', 'hartberg':'hartberg', 'wsg tirol':'tirol', 'altach':'altach',
  'rheindorf altach':'altach', 'blau weiss linz':'bw linz', 'grazer ak':'grazer ak',
  'austria klagenfurt':'klagenfurt', 'austria wien':'austria wien', 'sk rapid':'rapid vienna',
  'ried':'ried', 'lustenau':'lustenau', 'admira':'admira', 'st polten':'st polten',

  'grasshopper':'grasshoppers', 'grasshoppers':'grasshoppers', 'lausanne':'lausanne sport',
  'lausanne sport':'lausanne sport', 'zurich':'zurich', 'basel':'basel', 'sion':'sion',
  'st gallen':'st gallen', 'thun':'thun', 'young boys':'young boys', 'lugano':'lugano',
  'luzern':'luzern', 'servette':'servette', 'winterthur':'winterthur', 'xamax':'xamax',
  'yverdon':'yverdon sport', 'kriens':'kriens', 'aarau':'aarau', 'wil':'wil',

  'copenhagen':'copenhagen', 'kbh':'copenhagen', 'kopenhamn':'copenhagen',
  'midtjylland':'midtjylland', 'brondby':'brondby', 'agf':'agf', 'nordsjaelland':'nordsjaelland',
  'silkeborg':'silkeborg', 'sonderjyske':'sonderjyske', 'lyngby':'lyngby', 'vejle':'vejle',
  'odense':'odense', 'fredericia':'fredericia', 'horsens':'horsens', 'esbjerg':'esbjerg',

  'olympiacos':'olympiacos', 'aek athens':'aek athens', 'aris':'aris thessaloniki',
  'ofi':'ofi', 'kallithea':'athens kallithea', 'lamia':'lamia', 'larissa':'larissa',
  'panserraikos':'panserraikos', 'panathinaikos':'panathinaikos', 'paok':'paok',
  'volos':'volos nfc', 'levadiakos':'levadiakos', 'asteras tripolis':'asteras',
  'panetolikos':'panetolikos', 'atromitos':'atromitos', 'iraklis':'iraklis thessaloniki',
  'giannina':'giannina', 'pas giannina':'giannina', 'panionios':'panionios', 'ofii':'ofi',

  'banik':'banik', 'banik ostrava':'banik', 'sparta praha':'sparta praha',
  'slavia praha':'slavia praha', 'viktoria plzen':'viktoria plzen', 'sigma olomouc':'olomouc',
  'mlada boleslav':'mlada boleslav', 'slovan liberec':'liberec', 'hradec kralove':'hradec kralove',
  'bohemians praha':'bohemians praha', 'zbrojovka brno':'zbrojovka brno', 'jablonec':'jablonec',
  'ceske budejovice':'ceske budejovice', 'slovacko':'slovacko', 'zlin':'zlin',
  'karvina':'karvina', 'dukla':'dukla', 'dukla praha':'dukla', 'opava':'opava',
  'trinec':'fotbal trinec', 'pardubice':'pardubice', 'teplice':'teplice',
  'vysocina jihlava':'jihlava', 'jihlava':'jihlava',

  'hamarkameratene':'hamkam', 'kfum kameratene':'kfum', 'sandefjord':'sandefjord',
  'bodo glimt':'bodo glimt', 'start':'start', 'stabaek':'stabaek', 'stromsgodset':'stromsgodset',
  'valerenga':'valerenga', 'odds':'odd', 'rosenborg':'rosenborg', 'molde':'molde',
  'brann':'brann', 'tromso':'tromso', 'viking':'viking', 'kristiansund':'kristiansund',
  'lillestrom':'lillestrom', 'fredrikstad':'fredrikstad', 'sarpsborg':'sarpsborg',
  'sarpsborg 08':'sarpsborg 08', 'haugesund':'haugesund', 'bryne':'bryne',
  'kongsvinger':'kongsvinger', 'aalesund':'aalesund', 'aalesunds':'aalesund',
  'hodd':'hodd', 'lyn':'lyn 1896',

  'goteborg':'goteborg', 'hacken':'hacken', 'elfsborg':'elfsborg', 'gais':'gais',
  'malmo':'malmo', 'hammarby':'hammarby', 'djurgarden':'djurgarden', 'aik':'aik',
  'norrkoping':'norrkoping', 'mjallby':'mjallby', 'sirius':'sirius', 'kalmar':'kalmar',
  'halmstad':'halmstad', 'halmstads':'halmstad', 'degerfors':'degerfors',
  'brommapojkarna':'brommapojkarna', 'vasteras':'vasteras', 'helsingborg':'helsingborg',
  'osters':'osters', 'varnamo':'varnamo', 'ostersund':'ostersund', 'orgryte':'orgryte',
  'falkenberg':'falkenberg', 'landskrona':'landskrona', 'brage':'brage',

  'legia':'legia', 'lech':'lech', 'slask':'slask', 'widzew':'widzew', 'gornik':'gornik',
  'korona':'korona', 'motor lublin':'motor lublin', 'piast':'piast', 'pogon':'pogon',
  'radomiak':'radomiak', 'rakow':'rakow', 'zaglebie':'zaglebie', 'arka':'arka',
  'katowice':'katowice', 'lks':'lks', 'miedz':'miedz', 'stal mielec':'stal mielec',
  'chrobry':'chrobry', 'ruch':'ruch', 'tychy':'tychy', 'jagiellonia':'jagiellonia',
  'cracovia':'cracovia', 'termalica':'bruk bet termalica nieciecza',
  'bruk bet termalica':'bruk bet termalica nieciecza', 'wisla krakow':'wisla krakow',
  'wisla plock':'wisla plock', 'wieczysta':'wieczysta', 'puszcza':'puszcza',
  'stal rzeszow':'stal rzeszow', 'odra':'odra', 'znicz':'znicz',

  'dinamo zagreb':'dinamo zagreb', 'rijeka':'rijeka', 'gorica':'gorica',
  'hajduk':'hajduk split', 'istra':'istra 1961', 'lokomotiva':'lokomotiva',
  'osijek':'osijek', 'rudes':'rudes', 'slaven':'slaven', 'varazdin':'varazdin',

  'red star belgrade':'crvena zvezda', 'crvena zvezda':'crvena zvezda', 'partizan':'partizan',
  'vojvodina':'vojvodina', 'radnicki nis':'radnicki nis', 'cukaricki':'cukaricki',
  'napredak':'napredak', 'spartak subotica':'spartak subotica', 'mladost lucani':'mladost lucani',
  'zeleznicar pancevo':'zeleznicar pancevo', 'ofk beograd':'ofk beograd',
  'novi pazar':'novi pazar', 'imt':'imt', 'javor':'javor matis', 'tsc backa topola':'tsc',
  'tsc':'tsc', 'radnik surdulica':'radnik surdulica', 'vozdovac':'vozdovac',
  'macva':'macva', 'zemun':'zemun', 'metalac':'metalac',

  'fcsb':'steaua bucuresti', 'steaua':'steaua bucuresti', 'u cluj':'u cluj',
  'u craiova':'u craiova', 'farul':'farul', 'ota':'otelul', 'petrolul':'petrolul',
  'petrolul 52':'petrolul', 'uta arad':'uta', 'corvinul':'corvinul', 'arges':'arges pitesti',
  'csikszereda':'csikszereda', 'metaloglobus':'metaloglobus', 'poli iasi':'poli iasi',
  'unirea slobozia':'unirea slobozia', 'gloria buzau':'x', 'cfr cluj':'cfr cluj',
  'rapid bucuresti':'rapid bucuresti', 'dinamo bucuresti':'dinamo bucuresti',
  'sepsi':'sepsi', 'voluntari':'voluntari', 'hermannstadt':'hermannstadt',
  'botosani':'botosani', 'chindia':'chindia', 'concordia':'concordia',

  'dynamo kyiv':'dynamo kyiv', 'shakhtar':'shakhtar', 'zorya':'zorya luhansk',
  'vorskla':'vorskla poltava', 'kolos':'kolos kovalivka', 'polissya':'polissya',
  'kryvbas':'kryvbas', 'chornomorets':'chornomorets', 'obolon':'obolon',
  'lnz':'lnz cherkasy', 'karpaty':'karpaty', 'veres':'veres', 'epitsentr':'epitsentr',
  'livyi bereh':'livyi bereh', 'inhulets':'inhulets petrove', 'metalist':'metalist',
  'oleksandriya':'olexandriya', 'rukh':'rukh lviv', 'dnipro':'dnipro', 'kharkiv':'kharkiv',

  'neom':'neom', 'diriyah':'diriyah', 'al kholood':'al kholood', 'alokhdood':'al okhdood',
  'al akhdoud':'al okhdood', 'al faisaly':'al faisaly', 'al qadsiah':'al qadsiah',
  'al hazem':'al hazem', 'al riyadh':'al riyadh', 'al khaleej':'al khaleej',
  'al taawoun':'al taawoun', 'al fateh':'al fateh', 'al fayha':'al fayha',
  'al raed':'al raed', 'al wehda':'al wehda', 'al orobah':'al orobah', 'abha':'abha',
  'al najma':'al najma', 'al batin':'al batin', 'al ula':'al ula', 'al jabalain':'al jabalain',
  'al bukayriyah':'al bukayriyah', 'al jandal':'al jandal', 'al arabi':'al arabi',

  'boca':'boca', 'boca juniors':'boca', 'river plate':'river plate', 'racing':'racing',
  'velez':'velez sarsfield', 'velez sarsfield':'velez sarsfield',
  'estudiantes lp':'estudiantes', 'gimnasia lp':'gimnasia y esgrima lp',
  'rosario':'rosario central', 'newells':'newells old boys', 'newell':'newells old boys',
  'lanus':'lanus', 'talleres':'talleres', 'banfield':'banfield', 'defensa':'defensa y justicia',
  'huracan':'huracan', 'belgrano':'belgrano', 'tigre':'tigre', 'sarmiento':'sarmiento',
  'aldosivi':'aldosivi', 'barracas':'barracas central', 'riestra':'riestra',
  'deportivo riestra':'riestra', 'central cordoba':'central cordoba',
  'atl tucuman':'atletico tucuman', 'ind rivadavia':'independiente rivadavia',
  'instituto':'instituto', 'platense':'platense', 'argentinos juniors':'argentinos juniors',
  'gimnasia mendoza':'gimnasia y esgrima mza', 'gimnasia y esgrima':'gimnasia y esgrima mza',
  'estudiantes rio cuarto':'estudiantes de rio cuarto', 'godoy cruz':'godoy cruz',
  'san martin':'san martin', 'independiente':'independiente', 'union':'union',
  'san lorenzo':'san lorenzo de almagro',

  'atletico mineiro':'atletico mineiro', 'gremio':'gremio', 'internacional':'internacional',
  'sao paulo':'sao paulo', 'palmeiras':'palmeiras', 'flamengo':'flamengo',
  'fluminense':'fluminense', 'corinthians':'corinthians', 'santos':'santos',
  'vasco':'vasco da gama', 'botafogo':'botafogo', 'cruzeiro':'cruzeiro', 'bahia':'bahia',
  'athletico paranaense':'athletico paranaense', 'bragantino':'rb bragantino',
  'vitoria':'vitoria', 'chapecoense':'chapecoense', 'coritiba':'coritiba',
  'mirassol':'mirassol', 'fortaleza':'fortaleza', 'remo':'remo', 'juventude':'juventude',

  'america de cali':'america de cali', 'junior':'atletico junior', 'deportivo pereira':'deportivo pereira',
  'deportes tolima':'deportes tolima', 'independiente medellin':'independiente medellin',
  'santa fe':'independiente santa fe', 'millonarios':'millonarios', 'once caldas':'once caldas',
  'deportivo cali':'deportivo cali', 'deportivo pasto':'deportivo pasto',
  'atletico nacional':'atletico nacional', 'bucaramanga':'bucaramanga',

  'colo colo':'colo colo', 'universidad de chile':'universidad de chile',
  'u catolica':'universidad catolica', 'union espanola':'union espanola',
  'palestino':'palestino', 'iquique':'deportes iquique', 'coquimbo':'coquimbo unido',
  'ohiggins':'ohiggins', 'everton':'everton de vina del mar', 'nublense':'nublense',
  'cobresal':'cobresal', 'union la calera':'union la calera', 'limache':'deportes limache',

  'universitario':'universitario', 'cusco':'cusco', 'sporting cristal':'sporting cristal',
  'alianza lima':'alianza lima', 'cienciano':'cienciano del cusco', 'melgar':'melgar',
  'adt tarma':'adt', 'huancayo':'sport huancayo', 'grau':'atletico grau', 'utc':'utc',

  'penarol':'penarol', 'defensor':'defensor sporting', 'wanderers':'montevideo wanderers',
  'liverpool montevideo':'liverpool', 'cerro largo':'cerro largo', 'nacional':'nacional',
  'racing montevideo':'racing', 'danubio':'danubio', 'boston river':'boston river',
  'progreso':'progreso', 'miramar':'miramar misiones',

  'cerro porteno':'cerro porteno', 'guarani':'guarani', 'luqueno':'sportivo luqueno',
  'sportivo luqueno':'sportivo luqueno', 'trinidense':'trinidense', 'libertad':'libertad',
  'olimpia':'olimpia', 'ameliano':'sportivo ameliano', 'sportivo ameliano':'sportivo ameliano',
  'recoleta':'deportivo recoleta',

  'liga de quito':'liga de quito', 'ldu quito':'liga de quito', 'barcelona':'barcelona sc',
  'emelec':'emelec', 'independiente del valle':'independiente del valle', 'aucas':'aucas',
  'el nacional':'el nacional', 'delfin':'delfin', 'tecnico':'tecnico universitario',
  'mushuc runa':'mushuc runa', 'u catolica quito':'universidad catolica quito',
  'orense':'orense', 'cuenca':'deportivo cuenca', 'macara':'macara',

  'la guaira':'deportivo la guaira', 'tachira':'deportivo tachira', 'carabobo':'carabobo',
  'monagas':'monagas', 'caracas':'caracas', 'zamora':'zamora',
  'puerto cabello':'academia puerto cabello', 'metropolitanos':'metropolitanos',
  'estudiantes merida':'estudiantes merida', 'portuguesa':'portuguesa',

  'always ready':'always ready', 'bolivar':'bolivar', 'bulo bulo':'san antonio bulo bulo',
  'san antonio bulo bulo':'san antonio bulo bulo', 'nacional potosi':'nacional potosi',
  'aurora':'aurora', 'the strongest':'the strongest', 'blooming':'blooming',
  'wilstermann':'jorge wilstermann', 'oriente petrolero':'oriente petrolero',
  'gualberto villarroel':'gv san jose', 'gualberto villarroel sj':'gv san jose', 'gv san jose':'gv san jose',

  'qarabag':'qarabag', 'neftci':'neftci', 'sabah':'sabah', 'sumqayit':'sumqayit',
  'zire':'zire', 'turan':'turan', 'gabala':'gabala', 'sabail':'sabail',
  'ferencvaros':'ferencvaros', 'debrecen':'debrecen', 'gyor':'gyor', 'honved':'honved',
  'kisvarda':'kisvarda', 'mtk':'mtk', 'nyiregyhaza':'nyiregyhaza', 'paksi':'paksi',
  'puskas':'puskas akademia', 'ujpest':'ujpest', 'vasas':'vasas', 'zalaegerszeg':'zalaegerszeg',

  'aek larnaca':'aek larnaca', 'ael':'ael limassol', 'anorthosis':'anorthosis',
  'apoel':'apoel', 'apollon':'apollon limassol', 'aris limassol':'aris limassol',
  'omonoia':'omonoia', 'pafos':'pafos', 'olympiakos':'olympiakos',
  'nea salamis':'nea salamis', 'doxa':'doxa',

  'hjk':'hjk', 'gnistan':'gnistan', 'ilves':'ilves', 'inter turku':'inter turku',
  'jaro':'jaro', 'kups':'kups', 'mariehamn':'mariehamn', 'oulu':'oulu', 'sjk':'sjk',
  'lahti':'lahti',

  'jeonbuk':'jeonbuk', 'ulsan':'ulsan hd', 'seoul':'seoul', 'pohang':'pohang steelers',
  'daegu':'daegu', 'daejeon':'daejeon hana citizen', 'gwangju':'gwangju',
  'gangwon':'gangwon', 'anyang':'anyang', 'jeju':'jeju sk', 'suwon bluewings':'suwon bluewings',
  'incheon':'incheon united', 'jeonnam':'jeonnam dragons', 'seongnam':'seongnam',
  'gyeongnam':'gyeongnam', 'busan':'busan ipark', 'bucheon':'bucheon 1995',
  'e land':'seoul e land', 'hwaseong':'hwaseong', 'gimpo':'gimpo',
  'gimcheon':'gimcheon sangmu', 'asan':'chungnam asan', 'cheonan':'cheonan city',
  'suwon':'suwon', 'chungbuk cheongju':'chungbuk cheongju', 'ansan':'ansan greeners',

  'mohun bagan':'mohun bagan super giant', 'east bengal':'east bengal',
  'bengaluru':'bengaluru', 'kerala blasters':'kerala blasters', 'jamshedpur':'jamshedpur',
  'odisha':'odisha', 'hyderabad':'hyderabad', 'chennaiyin':'chennaiyin', 'punjab':'punjab',
  'northeast':'northeast united', 'goa':'goa', 'mumbai':'mumbai', 'mohammedan':'mohammedan',
  'northeast united':'northeast united', 'kerala':'kerala blasters', 'inter kashi':'inter kashi',

  'adelaide':'adelaide united', 'brisbane':'brisbane roar', 'mariners':'central coast mariners',
  'central coast mariners':'central coast mariners', 'macarthur':'macarthur',
  'melbourne city':'melbourne city', 'melbourne victory':'melbourne victory',
  'jets':'newcastle jets', 'perth':'perth glory', 'sydney':'sydney',
  'wanderers':'western sydney wanderers', 'western united':'western united',
  'auckland':'x', 'wellington':'x', 'phoenix':'x',

  'shenhua':'shanghai shenhua', 'haigang':'shanghai port', 'rongcheng':'chengdu rongcheng',
  'guoan':'beijing guoan', 'zhejiang':'zhejiang professional', 'tianjin':'tianjin jinmen tiger',
  'dalian':'dalian yingbo', 'shandong':'shandong taishan', 'yunnan':'yunnan yukun',
  'qingdao':'qingdao west coast', 'wuhan':'wuhan three towns', 'henan':'henan songshan longmen',
  'shenzhen':'shenzhen xinpengcheng', 'shenzhen peng city':'shenzhen xinpengcheng',
  'hainiu':'qingdao hainiu', 'meizhou':'meizhou hakka', 'changchun':'changchun yatai',
  'chongqing':'chongqing tonglianglong', 'liaoning':'liaoning tiening',
  'qingdao westcoast':'qingdao west coast',

  'atlanta':'atlanta', 'austin':'austin', 'charlotte':'charlotte', 'chicago':'chicago',
  'cincinnati':'cincinnati', 'montreal':'montreal', 'colorado':'colorado',
  'columbus':'columbus', 'dc':'dc', 'dallas':'dallas', 'houston':'houston dynamo',
  'kansas':'sporting kansas city', 'sporting kc':'sporting kansas city',
  'galaxy':'los angeles galaxy', 'la galaxy':'los angeles galaxy',
  'los angeles galaxy':'los angeles galaxy', 'lafc':'los angeles football club',
  'los angeles':'los angeles football club', 'inter miami':'inter miami',
  'minnesota':'minnesota', 'nashville':'nashville', 'new england':'new england',
  'nyrb':'nyrb', 'nyc':'nyc', 'orlando':'orlando', 'philadelphia':'philadelphia',
  'portland':'portland', 'salt lake':'real salt lake', 'real salt lake':'real salt lake',
  'san diego':'san diego', 'san jose':'san jose', 'seattle':'seattle',
  'st louis':'st louis', 'toronto':'toronto', 'vancouver':'vancouver',

  'bohemian':'bohemian', 'cork':'cork', 'derry':'derry', 'drogheda':'drogheda',
  'dundalk':'dundalk', 'harps':'finn harps', 'shamrock':'shamrock rovers',
  'shelbourne':'shelbourne', 'sligo':'sligo rovers', 'patricks':'st patricks',
  'st patricks':'st patricks', 'waterford':'waterford', 'galway':'galway',
};

// explicit per-id overrides (cross-country quirks, parent-badge shares)
const B = 'https://assets.football-logos.cc/logos';
const IDMAP = {
  cezqxva: `${B}/new-zealand/256x256/auckland-fc.a1055db9.png`,
  ca8617g: `${B}/new-zealand/256x256/wellington-phoenix.c68759f2.png`,
  c1c1j407: `${B}/india/256x256/mumbai-city-fc.d4d6f7a1.png`,
  czq5wkp: `${B}/spain/256x256/real-sociedad.501e3b1e.png`,
  c5tj2og: `${B}/germany/256x256/vfb-stuttgart.5b4b15e7.png`,
  cslb2j8: `${B}/germany/256x256/hoffenheim.23c07771.png`,
  KBH: `${B}/denmark/256x256/copenhagen.4b2af707.png`,
  POL3: `${B}/romania/256x256/poli-iasi.a7f97297.png`,
  cj2k8j0: `${B}/romania/256x256/petrolul-ploiesti.787b17c4.png`,
  c1g6tfy: `${B}/ecuador/256x256/universidad-catolica-quito.0eaece2d.png`,
  cx4lww1: `${B}/saudi-arabia/256x256/al-okhdood.ee597d67.png`,
  c12ub0fq: `${B}/bolivia/256x256/gv-san-jose.698e66b3.png`,
};

const maps = {};
for (const f of readdirSync('uploads/flcc')) {
  const slug = f.replace('.tsv', '');
  maps[slug] = readFileSync(`uploads/flcc/${f}`, 'utf8').trim().split('\n').map(l => {
    const [name, file] = l.split('\t');
    // cell may be "1500x1500|file.png" — hashes on football-logos.cc are
    // size-specific: a hash is only valid under the size it was scraped from
    // (club pages expose 1500x1500, country pages 256x256).
    let size = '256x256', fn = (file || '').trim();
    if (fn.includes('|')) [size, fn] = fn.split('|');
    return { name, size, file: fn, norm: norm(name) };
  }).filter(r => r.file && r.file.includes('.png'));
}

const clubs = JSON.parse(readFileSync('uploads/clubs_country.json', 'utf8'));
const out = { ...IDMAP }, unmatched = [];

for (const c of clubs) {
  if (out[c.id]) continue;
  const slug = COUNTRY_SLUG[c.country];
  if (!slug || !maps[slug]) { unmatched.push(`${c.id}\t${c.name}\t[${c.country}] no-map`); continue; }
  let n = norm(c.name);
  if (ALIAS[n] !== undefined) n = ALIAS[n];
  const table = maps[slug];
  let hit = table.find(t => t.norm === n);
  if (!hit) {
    const tok = n.split(' ').filter(x => x.length > 2);
    let best = null, bestScore = 0;
    for (const t of table) {
      const tt = t.norm.split(' ').filter(x => x.length > 2);
      if (!tok.length || !tt.length) continue;
      const inter = tok.filter(x => tt.includes(x) || (x.length >= 5 && tt.some(y => y.startsWith(x))) || (tt.some(y => y.length >= 5 && x.startsWith(y))));
      if (!inter.length) continue;
      if (inter.length === tok.length || inter.length === tt.length) {
        const score = inter.length + Math.min(tok.length, tt.length) / 10;
        if (score > bestScore) { bestScore = score; best = t; }
      }
    }
    hit = best;
  }
  if (hit && hit.norm !== 'x') {
    out[c.id] = `https://assets.football-logos.cc/logos/${slug}/${hit.size}/${hit.file}`;
  } else {
    unmatched.push(`${c.id}\t${c.name}\t[${c.country}]`);
  }
}

writeFileSync('js/data/badges_remote.js',
  `// Generated by tools/build_remote_badges.mjs — football-logos.cc 256px badge URLs per club id.\n` +
  `// Sources scraped from https://football-logos.cc (regen: node tools/build_remote_badges.mjs)\n` +
  `export const BADGE_REMOTE = ${JSON.stringify(out)};\n`);
console.log(`matched: ${Object.keys(out).length}/${clubs.length}`);
console.log('UNMATCHED (' + unmatched.length + '):');
for (const u of unmatched) console.log('  ' + u);
