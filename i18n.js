/* Multi-language UI: MutationObserver rewrites DOM text from English source keys.
   Locale packs live in locales/<code>.js as MKTYLocales[code].{strings,prefixes}.
   English remains the source of truth; unknown keys fall back to EN.
   tr(ru,en) stays compatible — prefers locale pack for mkty_lang, else inline RU. */
(() => {
 const locales = () => (typeof MKTYLocales === 'object' && MKTYLocales) || {};
 const sources = new WeakMap(), rendered = new WeakMap(), attrs = new WeakMap();
 let language = 'en';
 const RTL_LANGS = ['he','ar'];
 const PACK_LANGS = ['ru','uk','es','pt','de','fr','it','tr','he','ar','ko','zh'];

 const dynamics = {
  ru: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Узел ' + n + ' — повернуть по часовой стрелке'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'ПРОДОЛЖИТЬ ГЛАВУ ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'ВИДЕН ЕЩЁ ' + n + ' СЕК.'],
   [/^LIFE #(\d+)$/, (_, n) => 'ГЛАВА ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'ОТКРЫТЬ ГЛАВУ ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'Прогресс сюжета: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'СЛЕД. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Пройдено ворот: ' + v.replace('Use ▲ / ▼', 'Используйте ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'Найдено аномалий: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Питание подключено: ' + n + ' / 4 узла.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Экипаж собран: ' + v.replace('Final sync locked', 'Синхронизация закрыта').replace('Final sync ready', 'Синхронизация готова')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Этап ' + a + ' / ' + b + ' • Попытки: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'СИГНАЛ ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'ПОДСКАЗКА: первые 5 цифр — ' + a + ' • остальные: ' + b]
  ],
  uk: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Вузол ' + n + ' — повернути за годинниковою стрілкою'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'ПРОДОВЖИТИ ГЛАВУ ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'ВИДНО ЩЕ ' + n + ' СЕК.'],
   [/^LIFE #(\d+)$/, (_, n) => 'ГЛАВА ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'ВІДКРИТИ ГЛАВУ ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'Прогрес сюжету: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'НАСТ. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Пройдено воріт: ' + v.replace('Use ▲ / ▼', 'Використовуйте ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'Знайдено аномалій: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Живлення підключено: ' + n + ' / 4 вузли.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Екіпаж зібрано: ' + v.replace('Final sync locked', 'Синхронізацію закрито').replace('Final sync ready', 'Синхронізація готова')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Етап ' + a + ' / ' + b + ' • Спроби: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'СИГНАЛ ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'ПІДКАЗКА: перші 5 цифр — ' + a + ' • решта: ' + b]
  ],
  es: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Nodo ' + n + ' — girar en el sentido de las agujas del reloj'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'CONTINUAR CAPÍTULO ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'VISIBLE AÚN ' + n + ' SEG.'],
   [/^LIFE #(\d+)$/, (_, n) => 'CAPÍTULO ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'DESBLOQUEAR CAPÍTULO ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'Progreso de la historia: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'SIG. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Puertas superadas: ' + v.replace('Use ▲ / ▼', 'Usa ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'Anomalías marcadas: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Energía conectada: ' + n + ' / 4 nodos.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Tripulación reunida: ' + v.replace('Final sync locked', 'Sincronización final bloqueada').replace('Final sync ready', 'Sincronización final lista')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Etapa ' + a + ' / ' + b + ' • Intentos: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'SEÑAL ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'PISTA: los primeros 5 dígitos son ' + a + ' • restantes: ' + b]
  ],
  pt: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Nó ' + n + ' — rodar no sentido dos ponteiros do relógio'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'CONTINUAR CAPÍTULO ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'VISÍVEL AINDA ' + n + ' SEG.'],
   [/^LIFE #(\d+)$/, (_, n) => 'CAPÍTULO ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'DESBLOQUEAR CAPÍTULO ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'Progresso da história: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'SEG. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Portões ultrapassados: ' + v.replace('Use ▲ / ▼', 'Usa ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'Anomalias marcadas: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Energia ligada: ' + n + ' / 4 nós.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Tripulação reunida: ' + v.replace('Final sync locked', 'Sincronização final bloqueada').replace('Final sync ready', 'Sincronização final pronta')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Etapa ' + a + ' / ' + b + ' • Tentativas: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'SINAL ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'DICA: os primeiros 5 dígitos são ' + a + ' • restantes: ' + b]
  ],
  de: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Knoten ' + n + ' — im Uhrzeigersinn drehen'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'KAPITEL ' + n + ' FORTSETZEN 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'NOCH ' + n + ' SEK. SICHTBAR'],
   [/^LIFE #(\d+)$/, (_, n) => 'KAPITEL ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'KAPITEL ' + n + ' FREISCHALTEN' + end],
   [/^Story progress: (.*)$/, (_, v) => 'Handlungsfortschritt: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'NÄCHST. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Tore passiert: ' + v.replace('Use ▲ / ▼', 'Nutze ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'Anomalien markiert: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Strom verbunden: ' + n + ' / 4 Knoten.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Crew versammelt: ' + v.replace('Final sync locked', 'Finale Sync gesperrt').replace('Final sync ready', 'Finale Sync bereit')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Stufe ' + a + ' / ' + b + ' • Versuche: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'SIGNAL ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'TIPP: die ersten 5 Ziffern sind ' + a + ' • restliche: ' + b]
  ],
  fr: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Nœud ' + n + ' — tourner dans le sens horaire'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'CONTINUER LE CHAPITRE ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'ENCORE VISIBLE ' + n + ' S'],
   [/^LIFE #(\d+)$/, (_, n) => 'CHAPITRE ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'DÉBLOQUER LE CHAPITRE ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'Progression de l’histoire : ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'SUIV. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Portes franchies : ' + v.replace('Use ▲ / ▼', 'Utilisez ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'Anomalies marquées : ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Énergie connectée : ' + n + ' / 4 nœuds.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Équipage assemblé : ' + v.replace('Final sync locked', 'Sync finale verrouillée').replace('Final sync ready', 'Sync finale prête')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Étape ' + a + ' / ' + b + ' • Tentatives : ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'SIGNAL ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'INDICE : les 5 premiers chiffres sont ' + a + ' • restants : ' + b]
  ],
  it: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Nodo ' + n + ' — ruota in senso orario'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'CONTINUA CAPITOLO ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'ANCORA VISIBILE ' + n + ' SEC.'],
   [/^LIFE #(\d+)$/, (_, n) => 'CAPITOLO ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'SBLOCCA CAPITOLO ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'Progresso storia: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'SUCC. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Cancelli superati: ' + v.replace('Use ▲ / ▼', 'Usa ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'Anomalie segnate: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Energia collegata: ' + n + ' / 4 nodi.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Equipaggio assemblato: ' + v.replace('Final sync locked', 'Sync finale bloccata').replace('Final sync ready', 'Sync finale pronta')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Fase ' + a + ' / ' + b + ' • Tentativi: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'SEGNALE ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'SUGGERIMENTO: le prime 5 cifre sono ' + a + ' • restanti: ' + b]
  ],
  tr: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'Düğüm ' + n + ' — saat yönünde çevir'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'BÖLÜM ' + n + "'E DEVAM 🚀"],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'HÂLÂ GÖRÜNÜR ' + n + ' SN.'],
   [/^LIFE #(\d+)$/, (_, n) => 'BÖLÜM ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'BÖLÜM ' + n + "'İ AÇ" + end],
   [/^Story progress: (.*)$/, (_, v) => 'Hikâye ilerlemesi: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'SONR. +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'Geçilen kapılar: ' + v.replace('Use ▲ / ▼', '▲ / ▼ kullan')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'İşaretlenen anomaliler: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'Güç bağlandı: ' + n + ' / 4 düğüm.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'Mürettebat toplandı: ' + v.replace('Final sync locked', 'Son senkron kilitli').replace('Final sync ready', 'Son senkron hazır')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'Aşama ' + a + ' / ' + b + ' • Deneme: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'SİNYAL ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'İPUCU: ilk 5 hane ' + a + ' • kalan: ' + b]
  ],
  he: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'צומת ' + n + ' — סובב עם כיוון השעון'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'המשך פרק ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'עדיין גלוי ' + n + " שנ'"],
   [/^LIFE #(\d+)$/, (_, n) => 'פרק ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'שחרר פרק ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'התקדמות הסיפור: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'הבא +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'שערים שעברו: ' + v.replace('Use ▲ / ▼', 'השתמש ב-▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'חריגות שסומנו: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'חשמל מחובר: ' + n + ' / 4 צמתים.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'צוות מורכב: ' + v.replace('Final sync locked', 'סנכרון סופי נעול').replace('Final sync ready', 'סנכרון סופי מוכן')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'שלב ' + a + ' / ' + b + ' • ניסיונות: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'אות ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'רמז: 5 הספרות הראשונות הן ' + a + ' • הנותרות: ' + b]
  ],
  ar: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => 'التقاطع ' + n + ' — أدِره باتجاه عقارب الساعة'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => 'تابع الفصل ' + n + ' 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => 'مرئي لمدة ' + n + ' ث'],
   [/^LIFE #(\d+)$/, (_, n) => 'الفصل ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => 'افتح الفصل ' + n + end],
   [/^Story progress: (.*)$/, (_, v) => 'تقدّم القصة: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => 'التالي +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => 'البوابات المُجتازة: ' + v.replace('Use ▲ / ▼', 'استخدم ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => 'الشذوذات المعلَّمة: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => 'الطاقة موصولة عبر ' + n + ' / 4 تقاطعات.'],
   [/^Crew assembled: (.*)$/, (_, v) => 'الطاقم المجتمع: ' + v.replace('Final sync locked', 'التزامن النهائي مقفل').replace('Final sync ready', 'التزامن النهائي جاهز')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => 'المرحلة ' + a + ' / ' + b + ' • المحاولات: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => 'الإشارة ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => 'تلميح: أول 5 أرقام هي ' + a + ' • الأرقام المتبقية: ' + b]
  ],
  ko: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => '정션 ' + n + ' — 시계 방향으로 회전'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => '챕터 ' + n + ' 계속 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => '남은 표시 ' + n + '초'],
   [/^LIFE #(\d+)$/, (_, n) => '챕터 ' + n],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => '챕터 ' + n + ' 잠금 해제' + end],
   [/^Story progress: (.*)$/, (_, v) => '스토리 진행: ' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => '다음 +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => '통과한 게이트: ' + v.replace('Use ▲ / ▼', '▲ / ▼ 사용')],
   [/^Anomalies tagged: (.*)$/, (_, v) => '표시된 이상: ' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => '전원 연결: ' + n + ' / 4 정션.'],
   [/^Crew assembled: (.*)$/, (_, v) => '크루 소집: ' + v.replace('Final sync locked', '최종 동기화 잠김').replace('Final sync ready', '최종 동기화 준비')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => '스테이지 ' + a + ' / ' + b + ' • 시도: ' + c],
   [/^SIGNAL (.*)$/, (_, v) => '신호 ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => '힌트: 앞 5자리 ' + a + ' • 나머지: ' + b]
  ],
  zh: [
   [/^Junction (\d+) • rotate clockwise$/, (_, n) => '节点 ' + n + ' — 顺时针旋转'],
   [/^CONTINUE LIFE #(\d+) 🚀$/, (_, n) => '继续第 ' + n + ' 章 🚀'],
   [/^VISIBLE FOR (\d+) SECONDS$/, (_, n) => '仍可见 ' + n + ' 秒'],
   [/^LIFE #(\d+)$/, (_, n) => '第 ' + n + ' 章'],
   [/^UNLOCK LIFE #(\d+)(.*)$/, (_, n, end) => '解锁第 ' + n + ' 章' + end],
   [/^Story progress: (.*)$/, (_, v) => '剧情进度：' + v],
   [/^NEXT \+1\s+(.*)$/, (_, v) => '下一项 +1 ' + v],
   [/^Gates cleared: (.*)$/, (_, v) => '已通过闸门：' + v.replace('Use ▲ / ▼', '使用 ▲ / ▼')],
   [/^Anomalies tagged: (.*)$/, (_, v) => '已标记异常：' + v],
   [/^Power connected through (\d+) \/ 4 junctions\.$/, (_, n) => '电源已连接：' + n + ' / 4 节点。'],
   [/^Crew assembled: (.*)$/, (_, v) => '船员已集结：' + v.replace('Final sync locked', '最终同步已锁定').replace('Final sync ready', '最终同步就绪')],
   [/^Stage (\d+) \/ (\d+) • Attempts: (\d+)$/, (_, a, b, c) => '阶段 ' + a + ' / ' + b + ' • 尝试：' + c],
   [/^SIGNAL (.*)$/, (_, v) => '信号 ' + v],
   [/^HINT: first 5 digits are (.*) • remaining digits: (.*)$/, (_, a, b) => '提示：前 5 位是 ' + a + ' • 其余：' + b]
  ]
 };

 const moonPointFix = {
  ru: (text) => text.replaceAll('MOON POINTS', 'ЛУННЫХ ОЧКОВ').replace('9 LIVES COMPLETE', '9 ГЛАВ ПРОЙДЕНО'),
  uk: (text) => text.replaceAll('MOON POINTS', 'МІСЯЧНИХ ОЧОК').replace('9 LIVES COMPLETE', '9 ГЛАВ ПРОЙДЕНО'),
  es: (text) => text.replaceAll('MOON POINTS', 'PUNTOS LUNARES').replace('9 LIVES COMPLETE', '9 CAPÍTULOS COMPLETADOS'),
  pt: (text) => text.replaceAll('MOON POINTS', 'PONTOS LUNARES').replace('9 LIVES COMPLETE', '9 CAPÍTULOS CONCLUÍDOS'),
  de: (text) => text.replaceAll('MOON POINTS', 'MONDPUNKTE').replace('9 LIVES COMPLETE', '9 KAPITEL GESCHAFFT'),
  fr: (text) => text.replaceAll('MOON POINTS', 'POINTS LUNAIRES').replace('9 LIVES COMPLETE', '9 CHAPITRES TERMINÉS'),
  it: (text) => text.replaceAll('MOON POINTS', 'PUNTI LUNA').replace('9 LIVES COMPLETE', '9 CAPITOLI COMPLETATI'),
  tr: (text) => text.replaceAll('MOON POINTS', 'AY PUANLARI').replace('9 LIVES COMPLETE', '9 BÖLÜM TAMAMLANDI'),
  he: (text) => text.replaceAll('MOON POINTS', 'נקודות ירח').replace('9 LIVES COMPLETE', '9 פרקים הושלמו'),
  ar: (text) => text.replaceAll('MOON POINTS', 'نقاط القمر').replace('9 LIVES COMPLETE', 'اكتملت الأرواح التسع'),
  ko: (text) => text.replaceAll('MOON POINTS', '문 포인트').replace('9 LIVES COMPLETE', '9개 챕터 완료'),
  zh: (text) => text.replaceAll('MOON POINTS', '月球点数').replace('9 LIVES COMPLETE', '已完成9章')
 };
 const tokenFix = {
  ru: (text) => text.replace('CORE', 'ЯДРО').replace('COMMS', 'СВЯЗЬ').replace('LIVES', 'ЖИЗНИ'),
  uk: (text) => text.replace('CORE', 'ЯДРО').replace('COMMS', 'ЗВʼЯЗОК').replace('LIVES', 'ЖИТТЯ'),
  es: (text) => text.replace('CORE', 'NÚCLEO').replace('COMMS', 'ENLACE').replace('LIVES', 'VIDAS'),
  pt: (text) => text.replace('CORE', 'NÚCLEO').replace('COMMS', 'COMMS').replace('LIVES', 'VIDAS'),
  de: (text) => text.replace('CORE', 'KERN').replace('COMMS', 'FUNK').replace('LIVES', 'LEBEN'),
  fr: (text) => text.replace('CORE', 'CŒUR').replace('COMMS', 'COMMS').replace('LIVES', 'VIES'),
  it: (text) => text.replace('CORE', 'NUCLEO').replace('COMMS', 'COMMS').replace('LIVES', 'VITE'),
  tr: (text) => text.replace('CORE', 'ÇEKİRDEK').replace('COMMS', 'HABER').replace('LIVES', 'CANLAR'),
  he: (text) => text.replace('CORE', 'ליבה').replace('COMMS', 'קשר').replace('LIVES', 'חיים'),
  ar: (text) => text.replace('CORE', 'النواة').replace('COMMS', 'الاتصالات').replace('LIVES', 'الأرواح'),
  ko: (text) => text.replace('CORE', '코어').replace('COMMS', '통신').replace('LIVES', '라이프'),
  zh: (text) => text.replace('CORE', '核心').replace('COMMS', '通讯').replace('LIVES', '生命')
 };

 function pack(code) {
  const loc = locales()[code];
  return loc && typeof loc === 'object' ? loc : null;
 }

 function lookup(code, text) {
  const p = pack(code);
  if (!p || !p.strings) return undefined;
  return p.strings[text];
 }

 function translate(value) {
  if (!language || language === 'en') return value;
  const text = value.trim();
  let result = lookup(language, text);
  if (result === undefined) {
   const dyn = dynamics[language] || [];
   for (const [re, fn] of dyn) {
    if (re.test(text)) { result = text.replace(re, fn); break; }
   }
  }
  if (result === undefined) {
   const prefixes = (pack(language) && pack(language).prefixes) || {};
   for (const [en, translated] of Object.entries(prefixes)) {
    if (text.startsWith(en)) { result = translated + text.slice(en.length); break; }
   }
  }
  if (result === undefined && /MOON POINTS/.test(text) && moonPointFix[language]) {
   result = moonPointFix[language](text);
  }
  if (result === undefined && ['CORE ⚡', '📡 COMMS', 'LIVES:'].includes(text) && tokenFix[language]) {
   result = tokenFix[language](text);
  }
  return result === undefined ? value : value.replace(text, result);
 }

 /** Translate an English source string for the active language. */
 function t(en, opts) {
  if (en == null) return en;
  const code = language || 'en';
  if (code === 'en') return en;
  const hit = lookup(code, en);
  if (hit !== undefined) return hit;
  if (opts && opts[code]) return opts[code];
  if (code === 'ru' && opts && opts.ru) return opts.ru;
  const via = translate(en);
  return via === en ? en : via;
 }

 /** Backward-compatible helper used across modules: tr(ru, en). */
 function tr(ru, en) {
  return t(en, { ru });
 }

 const observer = new MutationObserver(records => {
  observer.disconnect();
  for (const r of records) {
   if (r.type === 'characterData') visit(r.target);
   else if (r.type === 'attributes') visit(r.target);
   else for (const n of r.addedNodes) visit(n);
  }
  observe();
 });

 function visit(node) {
  if (node.nodeType === Node.TEXT_NODE) {
   if (node.parentElement?.closest('script,style,#languages,[translate="no"]')) return;
   if (node.data !== rendered.get(node)) sources.set(node, node.data);
   const text = translate(sources.get(node) ?? node.data);
   if (node.data !== text) node.data = text;
   rendered.set(node, text);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
   if (node.closest('script,style,#languages,[translate="no"]')) return;
   let a = attrs.get(node); if (!a) { a = {}; attrs.set(node, a); }
   for (const name of ['aria-label', 'placeholder']) {
    const value = node.getAttribute(name); if (value === null) continue;
    if (!a[name] || value !== a[name].rendered) a[name] = { source: value };
    const text = translate(a[name].source); a[name].rendered = text;
    if (value !== text) node.setAttribute(name, text);
   }
   for (const child of node.childNodes) visit(child);
  }
 }

 function observe() {
  const app = document.getElementById('app');
  if (!app) return;
  observer.observe(app, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder'] });
 }

 function setLanguage(code) {
  if(PACK_LANGS.includes(code)&&!pack(code))return window.MKTYLocaleLoader?.load(code).then(()=>setLanguage(code)).catch(()=>{});
  observer.disconnect();
  language = code || 'en';
  for (const c of PACK_LANGS) document.body.classList.toggle('mkty-' + c, language === c);
  document.documentElement.dir = RTL_LANGS.includes(language) ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  const app = document.getElementById('app');
  if (app) visit(app);
  observe();
  // Modules that compose strings with t()/tr() at render time re-render once the pack is active.
  window.dispatchEvent(new Event('mkty:language'));
 }

 window.MKTYI18n = {
  setLanguage,
  t,
  tr,
  getLanguage: () => language,
  hasLocale: (code) => !!pack(code)?.strings,
  packLangs: () => PACK_LANGS.slice(),
  isRtl: (code) => RTL_LANGS.includes(code || language)
 };
 window.MKTYI18n.setLanguage(localStorage.getItem('mkty_lang') || 'en');
})();
