/* Russian UI text stays in sync with dynamic mission updates and language changes. */
(() => {
 const pairs = `
MKTY // LUNAR CREW|MKTY // ЛУННЫЙ ЭКИПАЖ
9 LIVES|9 ЖИЗНЕЙ
RULES & REWARDS|ПРАВИЛА И НАГРАДЫ
MISSION PROTOCOL|ПРОТОКОЛ МИССИИ
How Moon Points, lives and future rewards work.|Как работают очки, жизни и будущие награды.
Complete LIFE #1 through LIFE #9. Global lives are limited to 9; a spent life restores after 12 hours.|Пройдите главы с 1 по 9. Запас — 9 жизней; потраченная жизнь восстанавливается через 12 часов.
Earn Moon Points from eligible story missions, verified Daily Missions and verified referral activity while your 9 LIVES journey is active.|Получайте очки за сюжетные миссии, подтверждённые ежедневные задания и подтверждённую активность приглашённых игроков, пока прохождение не завершено.
DAILY & COMMUNITY|ЗАДАНИЯ И СООБЩЕСТВО
Community rewards are granted only for actions that MOONKATTY can verify. Repeated or unverified actions do not create rewards.|Награды выдаются только за действия, которые MOONKATTY может подтвердить. Повторные и неподтверждённые действия не приносят наград.
REFERRALS|ПРИГЛАШЕНИЯ
You may invite an unlimited number of people. Eligible verified activity from your referrals can earn Moon Points, subject to daily reward limits and anti-abuse controls.|Приглашайте любое количество друзей. Подтверждённая активность приглашённых игроков приносит очки с учётом дневных лимитов и защиты от злоупотреблений.
FINAL BALANCE 🔒|ИТОГОВЫЙ БАЛАНС 🔒
After successful completion of LIFE #9, Moon Point earning ends. Your accumulated Moon Points are totaled and locked as your FINAL MOON POINTS BALANCE.|После завершения главы 9 начисление очков прекращается. Накопленные очки фиксируются как итоговый баланс.
MKTY REWARD 🚀|НАГРАДА MKTY 🚀
After the MKTY launch, the locked balance may be used to determine a reward under the official distribution rules published for the launch. Moon Points do not represent a fixed MKTY conversion rate or guaranteed monetary value.|После запуска MKTY зафиксированный баланс может использоваться для расчёта награды по официальным правилам распределения. Очки не означают фиксированный курс обмена на MKTY или гарантированную денежную стоимость.
FAIR PLAY|ЧЕСТНАЯ ИГРА
Duplicate activity, self-referrals, automation, manipulation or other abuse may be excluded from rewards. Reward limits and verification parameters may be adjusted to protect the game economy.|Повторные действия, приглашение самого себя, автоматизация и другие злоупотребления могут исключаться из наград. Лимиты и параметры проверки могут меняться для защиты игровой экономики.
BACK TO MISSION CONTROL|ВЕРНУТЬСЯ НА ГЛАВНУЮ
9 LIVES. 1 BIG MISSION.|9 ЖИЗНЕЙ. ОДНА БОЛЬШАЯ МИССИЯ.
A SMALL CAT|МАЛЕНЬКИЙ КОТ
FOR A BIG MISSION|ДЛЯ БОЛЬШОЙ МИССИИ
MOON POINTS|ЛУННЫЕ ОЧКИ
LIVES|ЖИЗНИ
FULL|ПОЛНЫЙ ЗАПАС
STORY|СЮЖЕТ
A new signal has been detected…|Обнаружен новый сигнал…
Home|Главная
Missions|Миссии
Crew|Экипаж
Leaderboard|Рейтинг
More|Ещё
THE AWAKENING|ПРОБУЖДЕНИЕ
THE SIGNAL HAS BEEN RECEIVED|СИГНАЛ ПОЛУЧЕН
SKIP|ПРОПУСТИТЬ
MOON BASE ALPHA|ЛУННАЯ БАЗА АЛЬФА
HAB|ЖИЛОЙ МОДУЛЬ
POWER|ПИТАНИЕ
COMMS|СВЯЗЬ
SCAN|СКАН
ACTION|ДЕЙСТВИЕ
COLLECT|СОБРАТЬ
REPAIR|ПОЧИНИТЬ
TUNE|НАСТРОИТЬ
ENERGY|ЭНЕРГИЯ
TERMINAL|ТЕРМИНАЛ
ANTENNA|АНТЕННА
COLLECT ENERGY|СОБЕРИТЕ ЭНЕРГИЮ
REPAIR TERMINAL|ПОЧИНИТЕ ТЕРМИНАЛ
TUNE ANTENNA|НАСТРОЙТЕ АНТЕННУ
TERMINAL OFFLINE|ТЕРМИНАЛ ОТКЛЮЧЁН
RESTORE POWER|ВОССТАНОВИТЕ ПИТАНИЕ
Memorize the power sequence, then repeat it.|Запомните последовательность питания и повторите её.
READ POWER TRACE|ПОКАЗАТЬ ПОСЛЕДОВАТЕЛЬНОСТЬ
SIGNAL CALIBRATION|КАЛИБРОВКА СИГНАЛА
TUNE THE ANTENNA|НАСТРОЙТЕ АНТЕННУ
MHz|МГц
LOCK SIGNAL 📡|ЗАФИКСИРОВАТЬ СИГНАЛ 📡
Find the carrier frequency, then hold it steady.|Найдите нужную частоту и удерживайте её.
SYNC|СИНХР.
Explore Moon Base Alpha. Use SCAN to reveal nearby energy signatures.|Исследуйте базу Альфа. Нажмите «СКАН», чтобы найти энергию поблизости.
MISSION COMPLETE|МИССИЯ ЗАВЕРШЕНА
MOON BASE ALPHA ONLINE|БАЗА АЛЬФА ВОССТАНОВЛЕНА
MISSION CONTROL|ГЛАВНАЯ
Mission|Миссия
Inventory|Инвентарь
Map|Карта
Journal|Журнал
THE CREW|ЭКИПАЖ
NO MISSION SUCCEEDS ALONE.|ДЛЯ УСПЕХА НУЖЕН ЭКИПАЖ.
CAPTAIN|КАПИТАН
YOU|ВЫ
NAVIGATOR|ШТУРМАН
PLOTS THE WAY|ПРОКЛАДЫВАЕТ ПУТЬ
ENGINEER|ИНЖЕНЕР
BUILDS THE FUTURE|СТРОИТ БУДУЩЕЕ
SCOUT|РАЗВЕДЧИК
FINDS THE UNKNOWN|НАХОДИТ НЕИЗВЕДАННОЕ
MISSION OBJECTIVE|ЦЕЛЬ МИССИИ
ASSEMBLE THE CREW|СОБЕРИТЕ ЭКИПАЖ
Recruit all three specialists for the Moon mission.|Пригласите трёх специалистов для лунной миссии.
SELECT A CREW MEMBER TO BEGIN|ВЫБЕРИТЕ УЧАСТНИКА ЭКИПАЖА
NAVIGATION TEST|ПРОВЕРКА НАВИГАЦИИ
Guide the ship through all three corridor gates without touching the hazard field.|Проведите корабль через трое ворот, не касаясь опасной зоны.
FLIGHT →|ПОЛЁТ →
LUNAR NAV|ЛУННАЯ НАВИГАЦИЯ
MOON GATE|ЛУННЫЕ ВОРОТА
FINAL VECTOR|КОНЕЧНЫЙ ВЕКТОР
▲ CLIMB|▲ ВВЕРХ
▼ DESCEND|▼ ВНИЗ
ENGINEERING TEST|ПРОВЕРКА ИНЖЕНЕРА
Route power from CORE to COMMS. Rotate all four junctions until the circuit is continuous.|Соедините ядро с модулем связи. Поворачивайте четыре узла, чтобы замкнуть цепь.
CORE|ЯДРО
TEST CIRCUIT ⚡|ПРОВЕРИТЬ ЦЕПЬ ⚡
Rotate every junction until one continuous horizontal power line reaches COMMS.|Поверните узлы так, чтобы горизонтальная линия питания достигла модуля связи.
SCOUT TEST|ПРОВЕРКА РАЗВЕДЧИКА
Track the moving anomaly. It appears briefly — tag it three times before it relocates.|Следите за аномалией. Нажмите на неё три раза до того, как она исчезнет.
CREW SYNC TEST|СИНХРОНИЗАЦИЯ ЭКИПАЖА
All specialists are aboard. Synchronize NAV → ENG → SCOUT in the transmitted order.|Экипаж на борту. Повторите переданную последовательность: штурман, инженер, разведчик.
RECEIVE SEQUENCE|ПОКАЗАТЬ ПОСЛЕДОВАТЕЛЬНОСТЬ
NAV|ШТУРМ.
ENG|ИНЖ.
Complete the final crew protocol.|Завершите протокол синхронизации экипажа.
CREW ASSEMBLED|ЭКИПАЖ СОБРАН
MISSION READY|ГОТОВЫ К МИССИИ
THE LAUNCH CODE|КОД ЗАПУСКА
THE CREW IS READY. THE SHIP IS NOT.|ЭКИПАЖ ГОТОВ. КОРАБЛЬ — ЕЩЁ НЕТ.
SECURITY // 03|ЗАЩИТА // 03
MEMORY CHECK // LIFE #1|ПРОВЕРКА ПАМЯТИ // ГЛАВА 1
ENTER THE 10-DIGIT CODE|ВВЕДИТЕ КОД ИЗ 10 ЦИФР
The code was shown for 10 seconds after LIFE #1.|Код показывался на 10 секунд после первой главы.
VERIFY CODE|ПРОВЕРИТЬ КОД
Authorization required.|Требуется проверка кода.
RETRY AVAILABLE IN|ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ
OPEN JOURNAL • LIFE #1 CODE|ОТКРЫТЬ ЖУРНАЛ • КОД ГЛАВЫ 1
JOURNAL // LIFE #1|ЖУРНАЛ // ГЛАВА 1
Recovered memory code • no LIFE cost|Сохранённый код • без расхода жизни
BUY CODE HINT • −1 LIFE|КУПИТЬ ПОДСКАЗКУ • −1 ЖИЗНЬ
• 1 life restores every 12h|• 1 жизнь восстанавливается каждые 12 часов
DECRYPTION SEQUENCE|ПОСЛЕДОВАТЕЛЬНОСТЬ РАСШИФРОВКИ
MEMORIZE THE SIGNAL|ЗАПОМНИТЕ СИГНАЛ
Watch the four-symbol sequence. Then reproduce it.|Запомните четыре символа и повторите их.
READY|ГОТОВО
SHOW SEQUENCE|ПОКАЗАТЬ ПОСЛЕДОВАТЕЛЬНОСТЬ
STAGE II // FUEL MATRIX|ЭТАП II // ТОПЛИВНАЯ МАТРИЦА
BALANCE THE REACTOR|СБАЛАНСИРУЙТЕ РЕАКТОР
Set O₂, FUEL and COOLANT so total load is exactly 100.|Настройте кислород, топливо и охлаждение так, чтобы сумма была ровно 100.
FUEL|ТОПЛИВО
COOLANT|ОХЛАЖДЕНИЕ
TOTAL|ИТОГО
LOCK FUEL MATRIX|ЗАФИКСИРОВАТЬ МАТРИЦУ
Target profile is encrypted. Watch the stability indicators.|Целевые значения зашифрованы. Следите за показателями стабильности.
STAGE III // IGNITION|ЭТАП III // ЗАЖИГАНИЕ
MANUAL LAUNCH PROTOCOL|ПРОТОКОЛ РУЧНОГО ЗАПУСКА
Arm the three systems in the transmitted order before the countdown expires.|Активируйте три системы в переданном порядке до окончания отсчёта.
RECEIVE IGNITION ORDER|ПОЛУЧИТЬ ПОРЯДОК ЗАПУСКА
Awaiting launch order.|Ожидание порядка запуска.
ACCESS GRANTED|ДОСТУП ОТКРЫТ
LAUNCH CODE DECRYPTED|КОД ЗАПУСКА РАСШИФРОВАН
THE ROCKET|РАКЕТА
IGNITION|ЗАЖИГАНИЕ
LIFTOFF|ВЗЛЁТ
ORBIT|ОРБИТА
LUNAR APPROACH|ПОДЛЁТ К ЛУНЕ
THE MOON|ЛУНА
THE DESCENT|ПОСАДКА
ALT // 2400M|ВЫСОТА // 2400 М
LANDING ZONE|ЗОНА ПОСАДКИ
LAND THE SHIP|ПОСАДИТЕ КОРАБЛЬ
Hold ▲ to rise or brake, ▼ to descend, ◀ / ▶ to steer. Land at ≤ 14 m/s with drift within ± 42.|Удерживайте ▲ для подъёма и торможения, ▼ для спуска, ◀ / ▶ для поворота. Посадка: скорость ≤ 14 м/с, смещение ± 42.
ALT|ВЫС.
VEL|СКОР.
DRIFT|СМЕЩ.
VEL ≤ 14|СКОР. ≤ 14
ZONE ± 42|ЗОНА ± 42
THRUST POWER|МОЩНОСТЬ ТЯГИ
Stabilize descent and reach the landing zone.|Стабилизируйте спуск и достигните зоны посадки.
Manual descent active. Control velocity, drift and fuel.|Ручная посадка. Следите за скоростью, смещением и топливом.
FUEL DEPLETED — ballistic descent!|ТОПЛИВО ЗАКОНЧИЛОСЬ — свободное падение!
HARD LANDING — velocity or drift outside safe limits. Retrying…|ЖЁСТКАЯ ПОСАДКА — скорость или смещение превышены. Повтор…
Touchdown confirmed ✓|Посадка подтверждена ✓
TOUCHDOWN|КАСАНИЕ ПОВЕРХНОСТИ
PERFECT LANDING|УСПЕШНАЯ ПОСАДКА
Rise or brake|Подъём или торможение
Steer left|Влево
Steer right|Вправо
Descend|Вниз
REACTOR // OFFLINE|РЕАКТОР // ОТКЛЮЧЁН
START THE REACTOR|ЗАПУСТИТЕ РЕАКТОР
Charge all three energy cells, stabilize the core, then ignite.|Зарядите три ячейки, стабилизируйте ядро и запустите реактор.
CELL A|ЯЧЕЙКА A
CELL B|ЯЧЕЙКА B
CELL C|ЯЧЕЙКА C
CORE TEMP|ТЕМП. ЯДРА
STABILITY|СТАБИЛЬНОСТЬ
CORE STABILITY|СТАБИЛЬНОСТЬ ЯДРА
CHARGE ⚡|ЗАРЯД ⚡
COOL ❄|ОХЛАЖДЕНИЕ ❄
LOCK STABILITY ⚡|ЗАФИКСИРОВАТЬ ⚡
IGNITION 🔥|ЗАПУСК 🔥
Charge the energy cells.|Зарядите энергетические ячейки.
REACTOR ONLINE|РЕАКТОР РАБОТАЕТ
IGNITION SUCCESSFUL|РЕАКТОР ЗАПУЩЕН
LAUNCH SEQUENCE|ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАПУСКА
PREPARE FOR LIFTOFF|ПОДГОТОВЬТЕСЬ К ВЗЛЁТУ
Arm systems in the correct order before the countdown reaches zero.|Включите системы в правильном порядке до окончания отсчёта.
NAVIGATION|НАВИГАЦИЯ
FUEL PRESSURE|ДАВЛЕНИЕ ТОПЛИВА
CREW LOCK|ШЛЮЗ ЭКИПАЖА
REACTOR LINK|СВЯЗЬ С РЕАКТОРОМ
⚠ FLIGHT COMPUTER ALERT|⚠ СИГНАЛ БОРТОВОГО КОМПЬЮТЕРА
SYSTEM FAULT|СБОЙ СИСТЕМЫ
VENT|СБРОС ДАВЛЕНИЯ
RESET|СБРОС
BYPASS|ОБХОД
Resolve the fault before countdown reaches zero.|Устраните неисправность до окончания отсчёта.
PROCEDURE|ПОРЯДОК
LAUNCH 🚀|ВЗЛЁТ 🚀
Complete the pre-flight checklist.|Завершите предполётную проверку.
ORBIT ACHIEVED|ВЫХОД НА ОРБИТУ
THE VOID|ПУСТОТА
HULL|КОРПУС
DEEP SPACE|ДАЛЬНИЙ КОСМОС
SURVIVE THE VOID|ПРОЙДИТЕ ОПАСНУЮ ЗОНУ
Dodge the debris, preserve the hull and reach the transmission gate.|Уклоняйтесь от обломков, берегите корпус и достигните ворот связи.
DISTANCE|РАССТОЯНИЕ
SHIELDS|ЩИТЫ
◀ EVADE|◀ ВЛЕВО
SHIELD ⚡|ЩИТ ⚡
EVADE ▶|ВПРАВО ▶
Unknown debris field ahead.|Впереди неизвестное поле обломков.
VOID CROSSED|ОПАСНАЯ ЗОНА ПРОЙДЕНА
TRANSMISSION GATE REACHED|ВОРОТА СВЯЗИ ДОСТИГНУТЫ
THE SIGNAL|СИГНАЛ
LINK|СВЯЗЬ
UNKNOWN TRANSMISSION|НЕИЗВЕСТНАЯ ПЕРЕДАЧА
DECODE THE SIGNAL|РАСШИФРУЙТЕ СИГНАЛ
Match frequency, lock phase, then repeat the alien pulse pattern.|Настройте частоту, зафиксируйте фазу и повторите последовательность импульсов.
FREQUENCY|ЧАСТОТА
SIGNAL 0%|СИГНАЛ 0%
LOCK FREQUENCY|ЗАФИКСИРОВАТЬ ЧАСТОТУ
PHASE ALIGNMENT|ВЫРАВНИВАНИЕ ФАЗЫ
BEGIN PHASE HOLD|НАЧАТЬ УДЕРЖАНИЕ ФАЗЫ
DECODE TRANSMISSION • ROUND|РАСШИФРОВКА • РАУНД
REPLAY PULSE|ПОВТОРИТЬ ИМПУЛЬС
Each round grows longer.|Каждый раунд становится длиннее.
DECODED COORDINATES|РАСШИФРОВАННЫЕ КООРДИНАТЫ
Find the transmission frequency.|Найдите частоту передачи.
SIGNAL DECODED|СИГНАЛ РАСШИФРОВАН
COORDINATES RECEIVED|КООРДИНАТЫ ПОЛУЧЕНЫ
UNLOCK FINAL LIFE 🌙|ОТКРЫТЬ ПОСЛЕДНЮЮ ГЛАВУ 🌙
LIFE #9 • FINAL LIFE|ГЛАВА 9 • ФИНАЛ
THE RETURN|ВОЗВРАЩЕНИЕ
FINAL MISSION|ФИНАЛЬНАЯ МИССИЯ
BRING MOONKATTY HOME|ВЕРНИТЕ MOONKATTY ДОМОЙ
Survive three phases: navigate the gate, synchronize the core, and transmit the final code.|Пройдите три этапа: навигация, синхронизация ядра и передача финального кода.
I • NAVIGATE|I • НАВИГАЦИЯ
II • SYNC|II • СИНХРОНИЗАЦИЯ
III • TRANSMIT|III • ПЕРЕДАЧА
Enter the coordinates recovered from LIFE #8, then stabilize the return corridor.|Введите координаты из главы 8 и стабилизируйте коридор возвращения.
VERIFY COORDINATES|ПРОВЕРИТЬ КООРДИНАТЫ
CORRIDOR VECTOR|ВЕКТОР КОРИДОРА
LOCK COURSE|ЗАФИКСИРОВАТЬ КУРС
Synchronize the damaged core through three increasingly unstable cycles.|Синхронизируйте повреждённое ядро в трёх усложняющихся циклах.
REPLAY CORE PULSE|ПОВТОРИТЬ ИМПУЛЬС ЯДРА
Cycle|Цикл
Transmit the final six-symbol return code before core power collapses.|Передайте финальный код из шести символов до отключения ядра.
REPLAY RETURN CODE|ПОВТОРИТЬ КОД ВОЗВРАЩЕНИЯ
Phase I — align the return corridor.|Этап I — настройте коридор возвращения.
9 LIVES COMPLETE|9 ГЛАВ ПРОЙДЕНО
MOONKATTY HAS RETURNED|MOONKATTY ВЕРНУЛСЯ
THE SIGNAL WAS NEVER CALLING US TO THE MOON.|СИГНАЛ НЕ ЗВАЛ НАС НА ЛУНУ.
IT WAS CALLING MOONKATTY HOME.|ОН ЗВАЛ MOONKATTY ДОМОЙ.
RETURN TO MISSION CONTROL|ВЕРНУТЬСЯ НА ГЛАВНУЮ
Moon Base Alpha is online. LIFE #1 complete.|База Альфа восстановлена. Глава 1 завершена.
CODE VERIFIED ✓|КОД ПОДТВЕРЖДЁН ✓
Retry available. Enter the LIFE #1 code or buy a hint.|Можно повторить попытку. Введите код главы 1 или купите подсказку.
No lives available. A life restores every 12 hours.|Нет жизней. Одна жизнь восстанавливается каждые 12 часов.
Energy restored. Repair the terminal 🔧|Энергия восстановлена. Почините терминал 🔧
Watch carefully…|Смотрите внимательно…
Now repeat the sequence.|Теперь повторите последовательность.
Wrong circuit. Power trace reset — read it again.|Неверная цепь. Последовательность сброшена — посмотрите её снова.
Terminal online. Reach COMMS and calibrate the antenna 📡|Терминал работает. Доберитесь до связи и настройте антенну 📡
Signal lost — reacquire the carrier.|Сигнал потерян — найдите частоту снова.
Signal synchronized. Moon Base Alpha is online!|Сигнал синхронизирован. Лунная база Альфа работает!
Carrier acquired. Hold frequency steady for synchronization.|Частота найдена. Удерживайте её для синхронизации.
Wrong code. One life lost. Retry locked for 1 hour.|Неверный код. Потрачена одна жизнь. Повторная попытка через час.
Journal entry recovered. Security lock cleared — enter the code above.|Запись журнала найдена. Блокировка снята — введите код выше.
LIFE #2 — THE CREW|ГЛАВА 2 — ЭКИПАЖ
Assemble your crew. Each specialist must pass a challenge.|Соберите экипаж. Каждый специалист должен пройти испытание.
START LIFE #2 🚀|НАЧАТЬ ГЛАВУ 2 🚀
SPECIALIST RECRUITED ✓|СПЕЦИАЛИСТ ПРИНЯТ ✓
FINAL CREW PROTOCOL|ФИНАЛЬНЫЙ ПРОТОКОЛ ЭКИПАЖА
Navigator missed a gate. Flight corridor reset.|Штурман пропустил ворота. Коридор полёта сброшен.
CORE → COMMS power route stable ✓|Цепь ЯДРО → СВЯЗЬ стабильна ✓
Open circuit detected. Every junction must show ━.|Цепь разомкнута. Каждый узел должен показывать ━.
Memorize the transmission…|Запомните передачу…
Repeat the five-role sequence.|Повторите последовательность из пяти ролей.
Sync failed. Receive a new sequence.|Синхронизация не удалась. Получите новую последовательность.
Crew synchronized. Mission ready ✓|Экипаж синхронизирован. Миссия готова ✓
LIFE #3 — THE LAUNCH CODE|ГЛАВА 3 — КОД ЗАПУСКА
Decrypt the ship launch authorization sequence.|Расшифруйте последовательность разрешения запуска.
START LIFE #3 🚀|НАЧАТЬ ГЛАВУ 3 🚀
STAGE I COMPLETE ✓|ЭТАП I ЗАВЕРШЁН ✓
Security reset. New code generated.|Проверка сброшена. Создан новый код.
Total load must equal exactly 100.|Суммарная нагрузка должна быть ровно 100.
Matrix unstable. FUEL needs the largest share; O₂ and COOLANT must remain balanced.|Матрица нестабильна. Доля топлива должна быть самой большой; кислород и охлаждение должны оставаться сбалансированными.
Fuel matrix stable ✓|Топливная матрица стабильна ✓
GO — arm all systems before time expires!|ВПЕРЁД — включите все системы до окончания отсчёта!
LAUNCH AUTHORIZED ✓|ЗАПУСК РАЗРЕШЁН ✓
Bring all cells online while controlling reactor temperature.|Зарядите все ячейки и следите за температурой реактора.
CORE SCRAM — thermal overload. Restarting reactor…|АВАРИЙНЫЙ СТОП — перегрев. Перезапуск реактора…
Core locked in stable window. IGNITION authorized.|Ядро стабилизировано. Запуск разрешён.
Reactor online. Ignition successful ✓|Реактор работает. Запуск выполнен ✓
Choose the correct emergency procedure.|Выберите правильное аварийное действие.
WARNING — resolve flight computer alert!|ВНИМАНИЕ — устраните неисправность!
Follow the transmitted procedure. Watch for flight computer alerts.|Следуйте переданному порядку. Следите за сигналами бортового компьютера.
ABORT — launch window missed. Sequence reset.|ОТМЕНА — время запуска истекло. Последовательность сброшена.
Wrong system — 3 seconds lost.|Неверная система — потеряно 3 секунды.
All systems armed. LAUNCH before T−0!|Все системы включены. Взлетайте до окончания отсчёта!
Fault cleared ✓ Continue launch procedure.|Сбой устранён ✓ Продолжайте запуск.
Incorrect response — 5 seconds lost!|Неверное действие — потеряно 5 секунд!
Liftoff confirmed — orbit achieved ✓|Взлёт подтверждён — орбита достигнута ✓
HULL FAILURE — emergency reset.|КОРПУС РАЗРУШЕН — аварийный перезапуск.
Debris field entered. Survive to the transmission gate.|Вы в поле обломков. Доберитесь до ворот связи.
Shield absorbed asteroid impact.|Щит поглотил удар астероида.
HULL IMPACT! Evade!|УДАР ПО КОРПУСУ! Уклоняйтесь!
Transmission gate reached ✓|Ворота связи достигнуты ✓
Shield armed — one impact protected.|Щит включён — защита от одного удара.
Sweep the band and locate the strongest transmission.|Настройте частоту и найдите самый сильный сигнал.
Carrier acquired. Stabilize phase.|Частота найдена. Стабилизируйте фазу.
Phase lock lost. Re-align and hold again.|Фаза потеряна. Настройте её и удерживайте снова.
Phase aligned. Hold steady…|Фаза настроена. Удерживайте…
Phase synchronized. Decode the transmission.|Фаза синхронизирована. Расшифруйте передачу.
Repeat the pulse.|Повторите импульс.
Pattern rejected. Transmission shifted — new pulse generated.|Последовательность отклонена. Передача изменилась — получен новый импульс.
Layer decoded. Signal complexity increasing…|Слой расшифрован. Сигнал усложняется…
Signal decoded. Final coordinates received ✓|Сигнал расшифрован. Финальные координаты получены ✓
Phase I — verify the coordinates from LIFE #8.|Этап I — проверьте координаты из главы 8.
Coordinates verified ✓ Stabilize the return corridor.|Координаты подтверждены ✓ Стабилизируйте коридор возвращения.
Coordinates rejected. Recheck the LIFE #8 transmission.|Координаты отклонены. Проверьте передачу из главы 8.
Phase II — damaged core synchronization.|Этап II — синхронизация повреждённого ядра.
Core desynchronized — integrity lost.|Ядро рассинхронизировано — потеря прочности.
CORE FAILURE — restarting final mission.|СБОЙ ЯДРА — перезапуск финальной миссии.
FINAL PHASE — transmit before core power collapses.|ФИНАЛ — передайте код до отключения ядра.
POWER LOST — final transmission failed.|ПИТАНИЕ ПОТЕРЯНО — передача не удалась.
Code replay costs 15% core power.|Повтор кода расходует 15% энергии ядра.
Transmission rejected — 18% power lost.|Передача отклонена — потеряно 18% энергии.
RETURN TRANSMISSION ACCEPTED ✓|КОД ВОЗВРАЩЕНИЯ ПРИНЯТ ✓
COPIED ✓|СКОПИРОВАНО ✓
COPY|КОПИРОВАТЬ
CLAIMED ✓|ПОЛУЧЕНО ✓
BALANCE LOCKED|БАЛАНС ЗАФИКСИРОВАН
VERIFYING…|ПРОВЕРКА…
10-DIGIT KEY RECOVERED|КОД ИЗ 10 ЦИФР НАЙДЕН
IDENTITY CONFIRMED|ЛИЧНОСТЬ ПОДТВЕРЖДЕНА
TRUTH UNLOCKED|ИСТИНА ОТКРЫТА
`;
 const ru = Object.fromEntries(pairs.trim().split('\n').map(line => { const i=line.indexOf('|'); return [line.slice(0,i),line.slice(i+1)]; }));
 const sources=new WeakMap(), rendered=new WeakMap(), attrs=new WeakMap();
 let language='en';
 const prefixes={
  'Energy collected • ':'Энергия собрана • ', 'VISIBLE FOR ':'ВИДЕН ЕЩЁ ',
  'Synchronized: ':'Синхронизировано: ', 'Incorrect sequence. Attempts: ':'Неверная последовательность. Попытки: ',
  'Armed: ':'Включено: ', 'Decoded: ':'Расшифровано: ', 'Repeat core pulse • cycle ':'Повторите импульс ядра • цикл ',
  'Synchronized ':'Синхронизировано ', 'Return code: ':'Код возвращения: ', 'RESET ':'СБРОС '
 };
 const dynamic=[
 [/^LIFE #(\d+)$/,(_,n)=>'ГЛАВА '+n],
 [/^UNLOCK LIFE #(\d+)(.*)$/,(_,n,end)=>'ОТКРЫТЬ ГЛАВУ '+n+end],
 [/^Story progress: (.*)$/,(_,v)=>'Прогресс сюжета: '+v],
 [/^NEXT \+1\s+(.*)$/,(_,v)=>'СЛЕД. +1 '+v],
 [/^Gates cleared: (.*)$/,(_,v)=>'Пройдено ворот: '+v.replace('Use ▲ / ▼','Используйте ▲ / ▼')],
 [/^Anomalies tagged: (.*)$/,(_,v)=>'Найдено аномалий: '+v],
 [/^Crew assembled: (.*)$/,(_,v)=>'Экипаж собран: '+v.replace('Final sync locked','Синхронизация закрыта')],
 [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/,(_,a,b,c)=>'Этап '+a+' / '+b+' • Попытки: '+c],
 [/^SIGNAL (.*)$/,(_,v)=>'СИГНАЛ '+v],
 [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/,(_,a,b)=>'ПОДСКАЗКА: первые 5 цифр — '+a+' • остальные: '+b]
 ];
 function translate(value){
  if(language!=='ru')return value;
  const text=value.trim();
  let result=ru[text];
  if(result===undefined){for(const [re,fn] of dynamic){if(re.test(text)){result=text.replace(re,fn);break;}}}
  if(result===undefined){for(const [en,translated] of Object.entries(prefixes)){if(text.startsWith(en)){result=translated+text.slice(en.length);break;}}}
  if(result===undefined && /MOON POINTS/.test(text))result=text.replaceAll('MOON POINTS','ЛУННЫХ ОЧКОВ').replace('9 LIVES COMPLETE','9 ГЛАВ ПРОЙДЕНО');
  if(result===undefined && ['CORE ⚡','📡 COMMS','LIVES:'].includes(text))result=text.replace('CORE','ЯДРО').replace('COMMS','СВЯЗЬ').replace('LIVES','ЖИЗНИ');
  return result===undefined?value:value.replace(text,result);
 }
 const observer=new MutationObserver(records=>{
  observer.disconnect();
  for(const r of records){
   if(r.type==='characterData')visit(r.target);
   else if(r.type==='attributes')visit(r.target);
   else for(const n of r.addedNodes)visit(n);
  }
  observe();
 });
 function visit(node){
  if(node.nodeType===Node.TEXT_NODE){
   if(node.parentElement?.closest('script,style,#languages'))return;
   if(node.data!==rendered.get(node))sources.set(node,node.data);
   const text=translate(sources.get(node)??node.data);
   if(node.data!==text)node.data=text;
   rendered.set(node,text);
  }else if(node.nodeType===Node.ELEMENT_NODE){
   if(node.matches('script,style,#languages'))return;
   let a=attrs.get(node);if(!a){a={};attrs.set(node,a);}
   for(const name of ['aria-label','placeholder']){
    const value=node.getAttribute(name);if(value===null)continue;
    if(!a[name] || value!==a[name].rendered)a[name]={source:value};
    const text=translate(a[name].source);a[name].rendered=text;
    if(value!==text)node.setAttribute(name,text);
   }
   for(const child of node.childNodes)visit(child);
  }
 }
 function observe(){observer.observe(document.getElementById('app'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder']});}
 window.MKTYI18n={setLanguage(code){observer.disconnect();language=code;document.body.classList.toggle('mkty-ru',code==='ru');visit(document.getElementById('app'));observe();}};
 window.MKTYI18n.setLanguage(localStorage.getItem('mkty_lang')||'en');
})();
