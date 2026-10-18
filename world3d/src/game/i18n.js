import { T2 } from './i18n_ch2.js';
// Tiny i18n table: Russian primary, English fallback. Lang: ?lang= > Telegram user language > 'ru'.
const T = {
  ru: {
    level: 'Ур.', points: 'Moon Points', today: 'сегодня', quests: 'Задания', map: 'Карта', mapSoon: 'Голо-карта скоро', mapYou: 'ТЫ', mapGo: 'В ПУТЬ', mapNoQuest: 'Исследуй Луну', map_base: 'База', map_crystals: 'Кристаллы', map_cave: 'Портал', map_antenna: 'Антенна', map_reactor: 'Реактор', map_ledge: 'Уступ', map_launch: 'Старт', map_canyon: 'Каньон', map_crater: 'Кратер', map_r_hub: 'База Альфа · голокарта', map_r_canyon: 'Каньон высадки · голокарта', map_r_launch: 'Стартовый комплекс · голокарта', mapQuest: 'Задание', robotHi: 'Бип-буп! Привет, капитан!', radio1: 'База Альфа: груз кристаллов принят.', radio2: 'Ровер-2 в пути к складу.', radio3: 'Буровая: новая жила найдена!', radio4: 'Орбита: шаттл заходит на посадку.', radio5: 'Странные огоньки над кратером… опять медузы?', chapter: 'Глава 1', daily: 'Ежедневные',
    chapterTitle: 'База Альфа', dailySoon: 'Ежедневные задания появятся на этапе 2.', dailySoon2: 'Кристаллы уже обновляются каждый день — собирайте их!',
    done: 'Выполнено', active: 'Текущее', locked: 'Закрыто', close: 'Закрыть', m: 'м',
    questDone: 'Задание выполнено!', levelUp: 'Новый уровень!', capHit: 'Дневной лимит ⭐ достигнут', capPart: 'лимит дня',
    chapterDone: 'Глава 1 пройдена!', chapterDoneSub: 'Скоро: Глава 2', crystalToast: 'Кристалл', tapToClose: 'нажмите, чтобы закрыть',
    activate: 'Активировать', scan: 'Сканировать', useJet: 'Используйте JET, чтобы забраться наверх', holdZone: 'Оставайтесь в зоне…',
    q_power_t: 'Реактор гаснет!', q_power_d: 'Добудьте 3 кристалла энергии рядом с базой.', powerOut: 'Реактор гаснет! Добудьте энергию', powerStep: 'Энергия в реактор', powerOn: 'Питание восстановлено!', powerOnSub: 'База снова светится',
    q_canyon_t: 'Прыжок через разлом', q_canyon_d: 'Телепорт в каньон, перелетите трещину на JET и дойдите до площадки.',
    q_crystals_t: 'Добыча кристаллов', q_crystals_d: 'Добудьте 3 рудных кристалла: удерживайте ⛏ и отпустите в зелёной зоне.',
    q_parts_t: 'Детали антенны', q_parts_d: 'Найдите 3 потерянные детали антенны в каньоне. Следуйте компасу.',
    q_dish_t: 'Ремонт антенны', q_dish_d: 'Вернитесь на базу и установите детали на большую антенну.',
    q_reactor_t: 'Пульт реактора', q_reactor_d: 'Соедините трубы на пульте, чтобы подать энергию на космодром.',
    q_launch_t: 'Спринт на космодроме', q_launch_d: 'Пробегите через все кольца с ускорителем. Чем быстрее — тем больше ★.',
    q_secret_t: 'Первый тайник', q_secret_d: 'Взлетите на смотровой уступ на JET и откройте тайник.',
    q_home_t: 'Первый робот', q_home_d: 'Вернитесь на площадку базы — Строитель построит первый модуль.',
    install: 'Установить', openConsole: 'Открыть пульт', mine: 'Добыть', startSprint: 'Старт', retrySprint: 'Ещё раз',
    toCanyon: 'В каньон', toBase: 'На базу', toLaunch: 'На космодром', gateLocked: 'Портал к космодрому откроется после настройки пульта реактора',
    crackHint: 'Трещина! Разбегитесь и прыгните, удерживая JET', crackFell: 'Упали в трещину! Прыгайте с JET', crossed: 'Отличный прыжок!', crossFirst: 'Сначала перепрыгните трещину',
    mineHead: 'Добыча кристалла', mineHint: 'Удерживайте ⛏ и отпустите в зелёной зоне', minePerfect: 'Идеально! +бонус', mineOk: 'Добыто!', mineMiss: 'Треснул! Попробуйте ещё раз', mineCracked: 'кристалл треснул',
    partFound: 'Деталь антенны', partsHot: 'Сигнал сильный — деталь рядом!', partsCold: 'Ищите по компасу', parts: 'Детали',
    installed: 'Антенна снова в эфире!', puzHead: 'Пульт реактора', puzDesc: 'Нажимайте на трубы, чтобы повернуть. Соедините ⚡ и ☢.', puzMoves: 'Ходы', reactorOn: 'Энергия идёт на космодром! Портал открыт',
    sprintGo: 'Вперёд!', sprintRing: 'Кольцо', sprintDone: 'Финиш!', sprintFail: 'Время вышло — попробуйте ещё', sprintBest: 'Лучший результат', boost: 'Ускоритель!',
    meteorWarn: 'Метеоритный дождь! Уходите от красных теней', meteorHit: 'Метеорит! −1 🐾', livesRefill: 'Жизни восстановлены — глава 1 прощает ошибки', lives: 'Жизни',
    secrets: 'Секреты', secretFound: 'Тайник найден!', secretsHint: 'Ещё тайники спрятаны за скалами, на уступах и в пещере',
    building: 'Строитель строит: Склад', built: 'Склад построен!', robotArrives: 'Прибыл робот-Строитель!', baseGrows: 'База растёт',
    },
  en: {
    level: 'Lv', points: 'Moon Points', today: 'today', quests: 'Quests', map: 'Map', mapSoon: 'Holo map coming soon', mapYou: 'YOU', mapGo: 'GO', mapNoQuest: 'Explore the Moon', map_base: 'Base', map_crystals: 'Crystal field', map_cave: 'Portal', map_antenna: 'Antenna', map_reactor: 'Reactor', map_ledge: 'Lookout', map_launch: 'Launch', map_canyon: 'Canyon', map_crater: 'Crater', map_r_hub: 'Base Alpha · holo map', map_r_canyon: 'Landing Canyon · holo map', map_r_launch: 'Launch Complex · holo map', mapQuest: 'Quest', robotHi: 'Beep-boop! Hi, captain!', radio1: 'Base Alpha: crystal cargo received.', radio2: 'Rover-2 en route to storage.', radio3: 'Drill rig: new vein found!', radio4: 'Orbit: shuttle on final approach.', radio5: 'Strange lights over the crater… jellies again?', chapter: 'Chapter 1', daily: 'Daily',
    chapterTitle: 'Base Alpha', dailySoon: 'Daily quests arrive in stage 2.', dailySoon2: 'Crystals already respawn every day — go collect them!',
    done: 'Done', active: 'Active', locked: 'Locked', close: 'Close', m: 'm',
    questDone: 'Quest complete!', levelUp: 'Level up!', capHit: 'Daily ⭐ limit reached', capPart: 'daily limit',
    chapterDone: 'Chapter 1 complete!', chapterDoneSub: 'Coming soon: Chapter 2', crystalToast: 'Crystal', tapToClose: 'tap to close',
    activate: 'Activate', scan: 'Scan', useJet: 'Use JET to get up there', holdZone: 'Stay in the zone…',
    q_power_t: 'Reactor failing!', q_power_d: 'Mine 3 energy crystals next to the base.', powerOut: 'The reactor is failing! Mine energy', powerStep: 'Energy to the reactor', powerOn: 'Power restored!', powerOnSub: 'The base lights up again',
    q_canyon_t: 'Leap the Rift', q_canyon_d: 'Beam to the canyon, cross the crack with a JET hop and reach the pad.',
    q_crystals_t: 'Crystal Mining', q_crystals_d: 'Mine 3 ore crystals: hold ⛏ and release in the green zone.',
    q_parts_t: 'Antenna Parts', q_parts_d: 'Find 3 lost antenna parts in the canyon. Follow the compass.',
    q_dish_t: 'Fix the Dish', q_dish_d: 'Head back to base and install the parts on the big dish.',
    q_reactor_t: 'Reactor Console', q_reactor_d: 'Connect the pipes on the console to route power to the launch pad.',
    q_launch_t: 'Launch Pad Sprint', q_launch_d: 'Boost through every ring. Faster = more ★.',
    q_secret_t: 'First Cache', q_secret_d: 'JET up onto the lookout ledge and open the cache.',
    q_home_t: 'First Robot', q_home_d: 'Return to the base pad — the Builder will build the first module.',
    install: 'Install', openConsole: 'Open console', mine: 'Mine', startSprint: 'Start', retrySprint: 'Retry',
    toCanyon: 'To canyon', toBase: 'To base', toLaunch: 'To launch pad', gateLocked: 'The launch-pad portal opens once the reactor console is set',
    crackHint: 'A crack! Run up and jump, holding JET', crackFell: 'Fell into the crack! Jump with JET', crossed: 'Great jump!', crossFirst: 'Hop over the crack first',
    mineHead: 'Mining a crystal', mineHint: 'Hold ⛏ and release in the green zone', minePerfect: 'Perfect! +bonus', mineOk: 'Mined!', mineMiss: 'Cracked! Try again', mineCracked: 'crystal cracked',
    partFound: 'Antenna part', partsHot: 'Strong signal — a part is close!', partsCold: 'Follow the compass', parts: 'Parts',
    installed: 'The dish is back on air!', puzHead: 'Reactor console', puzDesc: 'Tap pipes to rotate them. Connect ⚡ to ☢.', puzMoves: 'Moves', reactorOn: 'Power routed to the launch pad! Portal open',
    sprintGo: 'Go!', sprintRing: 'Ring', sprintDone: 'Finish!', sprintFail: 'Time is up — try again', sprintBest: 'Best', boost: 'Boost!',
    meteorWarn: 'Meteor shower! Stay out of the red shadows', meteorHit: 'Meteor! −1 🐾', livesRefill: 'Lives refilled — Chapter 1 is forgiving', lives: 'Lives',
    secrets: 'Secrets', secretFound: 'Cache found!', secretsHint: 'More caches hide behind rocks, on ledges and in the cave',
    building: 'Builder is building: Depot', built: 'Depot built!', robotArrives: 'The Builder robot has arrived!', baseGrows: 'Your base grows',
    },
};
for (const l of ['ru', 'en']) Object.assign(T[l], T2[l]);
export function pickLang(Q) {
  const q = Q.get('lang'); if (q && T[q]) return q;
  const tg = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code; if (tg && T[tg.slice(0, 2)]) return tg.slice(0, 2);
  return 'ru';
}
export function makeT(lang) { return (k) => (T[lang] && T[lang][k]) ?? T.en[k] ?? k; }
