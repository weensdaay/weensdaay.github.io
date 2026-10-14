# WENSDAY

Личный сайт Андрея Середы: научпоп, путешествия, музыка Andry Wednesday и проекты.

Публичный адрес: **https://weensdaay.github.io/**. Исходники и все используемые файлы находятся в этом репозитории. GitHub Pages публикует папку `docs/` из ветки `main`.

## Обновление ссылок

Все адреса собраны в `site.config.mjs`. `null` означает «скоро»: посетитель увидит понятную кнопку с пояснением. Для активации нужно заменить `null` настоящим публичным HTTPS-адресом и пересобрать сайт.

В `contact` указан алиас iCloud для рекламы и сотрудничества. Кнопка открывает почтовую программу с готовой темой письма; рядом есть копирование адреса. Сам сайт письма не отправляет и заявки не хранит. Основная почта и другие алиасы в репозитории отсутствуют.

Основной Telegram: https://t.me/weensdaay1 — адрес предоставлен автором. Научпоп Instagram, The Hundred, Continuum и Bali Trips пока без адресов. Существующие аккаунты разведены по направлениям: научпоп YouTube `@weensdaay`, влоги `@wensdayblog`, второй TikTok `@bed1guy`. Архивный YouTube указан в описании научпоп-канала.

## Сборка

Нужен Node.js 20+. Установка пакетов не требуется.

```sh
npm run build
npm test
npm run preview
```

Предпросмотр: `http://127.0.0.1:4173`. После правок отправляйте в GitHub и исходники, и обновлённую папку `docs/`. Опубликованный сайт не зависит от запущенного компьютера, Node.js, ChatGPT или внешних шрифтов. Сервер, учётные записи и база данных ему не нужны.

## Файлы

- `src/`: шаблон страницы, стили, маленький скрипт взаимодействий, иконки.
- `assets/`: оптимизированные изображения и локальный шрифт.
- `site.config.mjs`: ссылки и метаданные.
- `media.config.mjs`: подборка фотографий, превью и обложек с адресами оригиналов.
- `translations.mjs`: английская версия текстов; сборка создаёт `/en/`.
- `scripts/build.mjs`: генерация статической папки `docs/`.
- `docs/`: готовый сайт для GitHub Pages.
- `tests/`: проверки ссылок, ресурсов, заглушек и бюджета загрузки.

Анимацию можно выключить в шапке. Системная настройка reduced motion учитывается автоматически. Внешние ссылки и контент доступны без JavaScript. Настройка анимации сохраняется локально в браузере; аналитики, рекламных пикселей и встроенных плееров нет. Переходы на внешние площадки открываются отдельно.

## Галереи и лента ссылок

Под первым экраном — бесконечная лента ссылок в случайном порядке с ручным скроллом, перетаскиванием, клавиатурой и стрелками. Она останавливается при наведении, фокусе и взаимодействии. Фотографии, обложки и превью меняются только в видимой области, учитывают общую паузу и reduced motion. Следующее изображение загружается по мере необходимости. Превью и обложки ведут к конкретным роликам и релизам. Научпоп чередует YouTube Shorts и TikTok с подписью площадки; в путешествиях есть отдельные Instagram Reels и YouTube-влоги. На телефоне карточки занимают всю доступную ширину, внутренние галереи доходят до их краёв. Сотрудничество — текстовая ссылка в основном верхнем меню.

Это сохранённая подборка реального контента, не автоматическая синхронизация новых публикаций. Для обновления добавьте оптимизированный WebP и запись в `media.config.mjs`, затем пересоберите.

## RU / EN

Русская версия — `/`, английская — `/en/`. Ручной выбор в шапке сохраняется в браузере и имеет приоритет над VPN и географией. Ссылки `/?lang=ru` и `/en/?lang=en` задают язык явно. Прямой `/en/` открывает английскую страницу без автоматической смены.

При первом входе без предпочтения выполняется один запрос к https://api.country.is/ для определения страны IP; координаты не запрашиваются, IP сайт не сохраняет. Русский выбирается для RU, BY, UA, KZ, KG, UZ, TJ, TM, AM, AZ, MD, GE; английский — для остальных стран. Результат хранится на время сессии. При ошибке или таймауте 1,8 секунды выбирается язык браузера. Cookies и Referer в запросе отключены. Без JavaScript обе версии доступны напрямую.

## Собственный домен

Когда домен будет куплен, добавьте его в Settings → Pages → Custom domain, настройте DNS по официальной инструкции GitHub Pages, обновите `origin` в `site.config.mjs`, выполните сборку и включите HTTPS после выпуска сертификата. До этого домен покупать для работы сайта не требуется.

Инструкция: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

## Права на материалы

Публичный репозиторий не передаёт права на фотографии, произведения, музыку или бренд. См. `SOURCES.md`. Шрифт Manrope распространяется по SIL Open Font License, лицензия включена в `assets/Manrope-OFL.txt`.

## Public statistics

The `#numbers` section shows public follower counts, lifetime YouTube views, and changes over 7/365 days when historical baselines exist. It is available in Russian and English. It never labels subscriptions as unique people. Counts missing from public pages are unavailable, not zero. Public rounding remains marked `≈`.

- `stats/accounts.mjs`: reviewed identities and source links (remote data cannot change these).
- `stats/history.json` / `stats/snapshot.json`: checked-in starting snapshot and static fallback.
- `scripts/collect-stats.mjs`: anonymous, bounded HTTPS GETs; no social logins, keys, cookies, JavaScript challenges or authenticated fallback. One request per profile per run. Public HTML formats and anonymous availability can change.
- `.github/workflows/public-statistics.yml`: daily at 03:41 UTC (11:41 Bali), also on relevant main-branch updates and manual dispatch. Collection has read permission; a separate publication job gets GitHub's short-lived repository job token. No personal access token or social-account secret is configured.
- `scripts/publish-stats.mjs`: validates the artifact and merges with authoritative history before atomically writing only `stats.json` and `history.json` on the `public-metrics` branch. It never edits `main` or site links. GitHub's `contents: write` permission is repository-wide; the script restricts its own destinations, and no untrusted PR/event can launch it.
- The site reads the public JSON from that branch when the section nears the viewport. Only validated numbers and timestamps reach `textContent`; no remote labels, links, scripts or markup are accepted. The section is usable without JavaScript from the dated fallback.
- Records older than 48 hours are excluded from totals; their last-known per-account values retain the observation date and stale label. Failure does not erase historical baselines. At most 400 daily observations per account are retained.
- A 7/365-day result is a change in a public cumulative counter on matching UTC dates, not private Analytics. Missing baselines, counter decreases and unavailable/stale sources produce a dash. Do not backfill or extrapolate historical views from today's lifetime total. Streaming listeners/likes are not added to video views.

Development: `node scripts/collect-stats.mjs` writes ignored `.stats-output/` files; it never publishes. `node scripts/publish-stats.mjs` is restricted to this repository's trusted main-branch workflow context. The public data branch is separate from the existing GitHub Pages `/docs` deployment.

GitHub scheduling is best effort, can be delayed, and may be disabled after 60 days without repository activity. The dates/stale states expose this; the website does not promise real-time or uninterrupted statistics. See [scheduled workflow limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Private website analytics · 67 Control

The public site and public social-account counters remain static and separate from private website analytics. `analytics/` contains a Cloudflare Worker + D1 collector; `analytics.config.mjs` enables the tiny local browser client only after a real endpoint is deployed. The deployed collector is enabled at `https://wensday-analytics.zendard78.workers.dev/v1/events`.

67 Control 0.5.0 adds WENSDAY overview, source/account attribution, countries, coarse devices, outgoing destinations, section/scroll actions, and nine profile links to copy. Use a different tagged link in each bio to identify the specific account. Referrers alone often disappear in social apps. No names, raw IPs, full user agents, full referrer URLs, screen recording, social credentials or persistent visitor IDs are stored. Session IDs expire after30min idle/4h total. Events expire after90days. DNT/GPC and the optional footer opt-out stop collection.

See `analytics/README.md` for deployment, API contract and security limits. Read secrets belong only in the Worker and native Keychain; never put them in this repository, Pages, URL query parameters or client JavaScript. New deployments require an authorized Cloudflare connection. The collector and native 67 Control connection were verified live on 2026-10-14.

Validation: `node --test tests/*.test.mjs analytics/worker.test.mjs`. Worker bundling can be checked with `wrangler deploy --dry-run --config analytics/wrangler.json`; this does not deploy.

## Product previews

`/bali-trips/` and `/en/bali-trips/` introduce the existing unpublished Bali Trips prototype. They contain screenshots and product copy, not the private application source or any account data. `scripts/render-projects.mjs` renders this page and the main product showcase. Destinations remain in `site.config.mjs`. IconBeast uses genuine published editor screenshots. Continuum uses clearly labelled, fictional demo tasks in HTML. Main-page previews reuse the accessible gallery controls, lazy image loading, visibility pause and reduced-motion preferences. Photo and map credits accompany the screenshots in `assets/products/bali-credits.txt`.
