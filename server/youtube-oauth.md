# Проверка подписки YouTube через Google OAuth (подготовлено, НЕ включено)

Код готов (`server/rewards/youtube.mjs`, действие `social.youtube.verify`), но выключен флагом.
Пока флаг выключен, подписка на YouTube **не даёт очков**; очки за YouTube — только кодовые слова из видео.

## Что нужно сделать Игорю

1. Открыть https://console.cloud.google.com/ → **Создать проект** (например `moonkatty-game`).
2. **APIs & Services → Library** → найти **YouTube Data API v3** → **Enable**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding/Audience):
   - Тип: **External**; название `MOONKATTY`; e-mail поддержки; домен `moonkattymky.github.io`.
   - **Data access / Scopes** → добавить только `https://www.googleapis.com/auth/youtube.readonly`.
   - Пока приложение в статусе *Testing*, добавить тестовых пользователей; для всех игроков — **Publish app** и пройти проверку Google (для `youtube.readonly` нужна верификация: политика конфиденциальности, видео-демо).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**.
   - Authorized redirect URI: `https://moonkattymky.github.io/moonkatty-game/youtube-callback.html`
     (страница-колбэк будет добавлена при включении).
   - Скопировать **Client ID** и **Client secret**.
5. Узнать ID канала: YouTube Studio → Настройки → Канал → Расширенные настройки → **ID канала** (`UC…`).
6. Передать значения (не в чат и не в репозиторий) — или задать самому:
   ```
   supabase secrets set --project-ref lswbmgoeinblzuqzakvi \
     GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
     YOUTUBE_CHANNEL_ID=UC... \
     YOUTUBE_REDIRECT_URI=https://moonkattymky.github.io/moonkatty-game/youtube-callback.html
   ```
7. Включение (когда страница-колбэк и UI будут готовы): `YOUTUBE_OAUTH_ENABLED=true`.

## Как работает
- `social.youtube.verify` без `code` → возвращает `auth_url` (scope `youtube.readonly`).
- С `code` → сервер меняет код на токен, вызывает `subscriptions.list?mine=true&forChannelId=…`;
  если подписка есть — +5 ⭐ один раз (`social:youtube:follow`). Токен Google нигде не сохраняется.
- Без всех четырёх секретов флаг игнорируется (функция остаётся выключенной).
