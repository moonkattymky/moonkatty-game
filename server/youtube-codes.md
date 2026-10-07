# YouTube code words — admin guide

Codes live in the `youtube_codes` table (Supabase → SQL Editor). Players type the
word in the game (Daily → "YouTube code word"); the `rewards` function checks it,
pays once per code per Telegram player, and rejects expired/inactive codes.
Codes are case/space-insensitive and stored in UPPER CASE (A–Z, 0–9, 3–32 chars).
Points 1–50 (keep scarce: default 10).

## Add a code
```sql
insert into youtube_codes (code, points, video_url, note, expires_at)
values ('LUNARECHO', 10, 'https://youtu.be/XXXX', 'LIFE #2 trailer', now() + interval '3 days');
```

## List / disable / extend
```sql
select code, points, active, is_test, expires_at from youtube_codes order by created_at desc;
update youtube_codes set active = false where code = 'LUNARECHO';
update youtube_codes set expires_at = now() + interval '2 days' where code = 'LUNARECHO';
```

## Who redeemed
```sql
select count(*) from reward_events where event_key = 'yt:' || (select id from youtube_codes where code='LUNARECHO');
```

`MOONTEST` (5 ⭐, until 2026-10-31) is a seeded **test** code (`is_test = true`).
Disable it before public launch: `update youtube_codes set active=false where code='MOONTEST';`

## Коротко для Игоря (RU)
1. Supabase → проект → **SQL Editor** → New query.
2. Вставь (замени слово, ссылку и срок):
   `insert into youtube_codes (code, points, video_url, note, expires_at) values ('LUNARECHO', 10, 'https://youtu.be/...', 'описание', now() + interval '3 days');`
   Код — только латиница и цифры (3–32), очки 1–50 (рекомендуем 10).
3. Run. Слово сразу работает в игре; каждый игрок получает очки за код один раз.
4. Выключить: `update youtube_codes set active=false where code='LUNARECHO';`
