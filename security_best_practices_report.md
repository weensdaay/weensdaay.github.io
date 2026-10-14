# Проверка безопасности WENSDAY — 14 октября 2026

Проверены текущие исходники, публикуемые файлы, локальное выполнение, публичные HTTPS-заголовки и новый механизм статистики. Критических или высоких подтверждённых уязвимостей в проверенной области не обнаружено. Это проверка реализации и конфигурации, а не гарантия отсутствия всех уязвимостей и не аудит безопасности личного аккаунта GitHub.

## Исправлено

### 1. Защитная политика браузера отсутствовала — низкий риск, усиление защиты

**Правило:** JS-CSP-001. **Место:** `src/index.html:5`; генератор 404 в `scripts/build.mjs`.

Ранее главные страницы не задавали CSP; фактический ответ GitHub Pages также не содержал HTTP CSP. Подтверждённого пути внедрения скрипта не было, поэтому это не объявляется найденной XSS.

Добавлена ранняя meta-CSP: `default-src 'none'`, локальные скрипты/стили/изображения/шрифты, запрет форм, фреймов, объектов, работников и смены base URL. Нет `unsafe-inline`/`unsafe-eval`. Сетевые соединения ограничены своим сайтом, существующим определением страны и конкретным публичным JSON статистики. Trusted Types включены там, где поддерживаются. RU, EN и 404 используют политику. Добавлен `no-referrer`.

### 2. Новый вход данных статистики ограничен числовой схемой — профилактическая защита

**Правила:** JS-XSS-001, JS-URL-002. **Места:** `src/stats-model.mjs:10`, `src/stats.js:9`, `stats/accounts.mjs:1`.

Удалённый JSON не может задавать ссылку, название аккаунта, HTML или код. Неизвестные поля/аккаунты, дубликаты, отрицательные/нецелые/бесконечные числа и неверные даты отклоняются. Ответ ограничен 24 KB и семью секундами, перенаправления запрещены. В DOM поступает только `textContent`. Ссылки и идентичности закреплены в исходниках. Тест с HTML-полезной нагрузкой и фишинговой ссылкой проходит отказом валидации.

### 3. Автоматизация изолирована от аккаунтов соцсетей — профилактическая защита

**Правило:** least privilege / supply chain. **Места:** `.github/workflows/public-statistics.yml:15`, `scripts/collect-stats.mjs:10`, `scripts/publish-stats.mjs:7`.

Сборщик делает анонимные GET к заранее заданным публичным адресам. Нет cookies, OAuth, социальных ключей, выполнения скачанных скриптов или обхода защиты. Задача сбора имеет только чтение репозитория. Отдельная задача публикации получает временный встроенный `GITHUB_TOKEN` с `contents: write`; это право GitHub распространяется на репозиторий, не только на ветку. Скрипт ограничивает запись двумя JSON-файлами отдельной ветки и не записывает сайт. Он проверяет репозиторий, main-ветку, тип события, давность артефакта и его схему. Не запускается от PR, issue/comment или fork. Сторонние Actions закреплены полными SHA официальных репозиториев; checkout не сохраняет credential. Токен отсутствует в веб-файлах и не относится к соцсетям.

История объединяется с актуальной веткой перед записью: сбой чтения публичного файла не стирает прежние снимки. Обновление ветки без force; конфликт не перетирает более свежую запись.

## Проверенные свойства

- Сайт статический: нет панели входа, форм отправки, загрузки файлов, пользовательских постов, CMS или публичного API записи. Посетитель не может добавить свою ссылку через функции сайта. Изменить опубликованный код можно через права записи GitHub.
- Нет стороннего исполняемого JS, iframe-виджетов и npm-зависимостей. Изображения/шрифты локальные.
- Проверены DOM-вставки и перенаправления: `src/app.js` использует текстовые вставки; `src/locale.js:11` выбирает только две локальные языковые страницы. Параметры URL не становятся внешними адресами.
- В local/sessionStorage только выбор языка/анимации. Нет сессионных ключей или аккаунтных токенов.
- В текущем отслеживаемом дереве не найдены `.env`, приватные ключи/базы и известные шаблоны GitHub/AWS credentials. Это ограниченный поиск по текущим файлам, не доказательство отсутствия любого секрета во всей истории.
- Внешние ссылки имеют `noopener noreferrer`. Публикуется только ранее выбранный контактный iCloud alias.
- HTTPS публичного сайта возвращает 200. CSP не ослабляет существующие ограничения, и браузерная проверка не выявила её нарушений в обычных сценариях.
- Тесты покрывают отсутствие исторических оснований, сбои, устаревание, округление, коррекции счётчиков, неверную идентичность источников, инъекции и сохранение истории.

## Ограничения и остаточный риск

### 4. Запрет встраивания сайта на чужом домене — низкий риск, ограничение хостинга

Фактический ответ GitHub Pages не содержит `X-Frame-Options` или `frame-ancestors`. Последний не работает в meta-CSP, поэтому фиктивно в HTML не добавлен. Сайт можно отобразить внутри чужого фрейма; здесь нет платежей или действий с авторизованным аккаунтом, что ограничивает ущерб. При будущем собственном домене с управляемым edge можно задать `Content-Security-Policy: frame-ancestors 'none'` HTTP-заголовком. Отдельно: никакой код сайта не запрещает третьим лицам сделать внешнюю копию/фишинговый домен.

### 5. Доверие GitHub и публичным источникам — информационно

Компрометация прав записи владельца репозитория позволяет изменить сайт независимо от CSP. Настройки 2FA, владельцев и личных сессий аккаунта вне этой проверки. Изменение публичного счётчика площадкой влияет на цифры; схема предотвращает выполнение кода, но не доказывает достоверность самой площадки.

Анонимная доступность счётчиков и расписание GitHub не гарантированы. На сайте явно указаны покрытие, даты и устаревание. У недельных/годовых значений нет искусственных оценок. Внешний `api.country.is` используется только для ранее запрошенного языка; запрос без credentials/referrer, IP не сохраняется сайтом.

## Справочные источники

- [CSP и ограничения meta](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
- [frame-ancestors не поддерживается в meta](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
- [DOM XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [GitHub Actions: права и закрепление SHA](https://docs.github.com/en/actions/reference/security/secure-use)

## Итоговая проверка публикации

- 21 локальный тест прошёл; 9 тестов статистики прошли повторно на GitHub runner.
- [Первый автоматический сбор и публикация](https://github.com/weensdaay/weensdaay.github.io/actions/runs/38502959778): оба задания `success`, шесть анонимных источников обновлены, седьмой имеет сохранённый свежий снимок.
- [Публикация сайта](https://github.com/weensdaay/weensdaay.github.io/actions/runs/38502958312): `success`. Полученные по HTTPS RU/EN побайтово совпали с локальным `docs/`. Модуль статистики отдан как `text/javascript`.
- На публичной странице проверено фактическое обновление общей цифры из JSON: ≈118K в исходном снимке → ≈258K после загрузки новых счётчиков. Ссылки не изменились. Консоль не показала ошибок CSP/JS в проверенных сценариях.
- Проверены ширины 320, 390, 430 и 1280 px, стрелки карусели, RU/EN и раскрытие методики. Горизонтального переполнения страницы/карточек итогов нет. Первый набор HTML/CSS/JS/шрифтов/hero-изображений — 278,887 байт без сжатия.

## 2026-10-14 · Private visitor analytics prepared

Status: collector/client implemented and tested locally; Cloudflare publication awaiting account authorization, client endpoint disabled. Public site still has no login, CMS, writeable content or uploaded executable content.

- Public ingestion writes only validated fixed-enum events with UUIDs, a coarse source/account/device and edge country. Exact schema rejects arbitrary text, extra fields, unknown links, URLs and identifiers. Body<=12KiB/16events; IP HMAC rate limiter60requests/min/edge;256events/session; dedupe transactionally in SQLite/D1.
- Report endpoint requires independent bearer secret, constant-time comparison, no CORS, no caching, no redirects from native authenticated transport; secret stays Worker/Keychain.
- Parameterized SQL; collection time assigned by server; source attribution immutable per session; country supplied by Cloudflare edge. No raw IP/UA stored and execution logs disabled. Four-hour session cap,30min inactivity,90day retention.
- Browser client honors DNT/GPC, opt-out, excludes localhost/automation and waits for language selection to avoid counting automatic redirects twice. Campaign source survives language redirect, arbitrary query fields are stripped.
- Remaining limits: public ingestion cannot prove a human visit; a determined nonbrowser client can spoof Origin and events. Bot filters/rate limits reduce noise but do not make counts audited or exact. Country can reflect VPN. Session counts are not unique people. Blocked scripts/adblockers can undercount. Specific social accounts require distinct tagged profile links. GitHub Pages retains its documented header limitations.
- Validation includes real client→server schema integration, opt-out/locale lifecycle, SQL-backed dedupe/retention/first attribution, malformed/oversized input and authorization failure cases. No claim of a production penetration test before deployment.
