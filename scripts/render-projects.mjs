// Public product previews only. Never import a live app's user storage here.
import config from '../site.config.mjs';
import analytics from '../analytics.config.mjs';
const shot = (name,title,alt) => ({src:`assets/products/${name}.webp`,title,alt,width:1280,height:800});
export const baliScreens = [
  shot('bali-home','01 · Найти своё направление','Главная Bali Trips: острова и выбор путешествия'),
  shot('bali-catalog','02 · Выбрать маршрут','Bali Trips: каталог маршрутов с фильтрами'),
  shot('bali-map','03 · Увидеть остановки на карте','Bali Trips: карта Бали с остановками маршрута'),
  shot('bali-route','04 · Собрать день по пути','Bali Trips: описание маршрута и план поездки'),
];
const iconScreens = [
  shot('iconbeast-mac','macOS · Редактор и живое превью','Рабочий редактор IconBeast для macOS'),
  shot('iconbeast-iphone','iPhone · Проверка на экране','Рабочий редактор IconBeast для iPhone'),
  shot('iconbeast-android','Android · Адаптивные иконки','Рабочий редактор IconBeast для Android'),
  shot('iconbeast-windows','Windows · Готовые размеры','Рабочий редактор IconBeast для Windows'),
];

export function renderProjectShowcase({gallery,project,external,icon}) {
  const frame = (name,content) => `<div class="product-window"><div class="product-window-bar" aria-hidden="true"><span class="window-dots"><i></i><i></i><i></i></span><span>${name}</span><span>↗</span></div>${content}</div>`;
  const label = (number,type,status) => `<div class="product-meta"><span>${number} / ${type}</span><span class="product-status">${status}</span></div>`;
  const action = (key,title,description,cta) => `<div class="product-info"><h3>${project(key,title)}</h3><p>${description}</p><${config.projects[key]?'a':'button'} class="product-cta" ${config.projects[key]?external(config.projects[key]):`type="button" data-soon="${title}"`}>${cta}<span aria-hidden="true">↗</span></${config.projects[key]?'a':'button'}></div>`;
  return `<div class="product-showcase">
    <article class="product-card product-bali reveal" id="bali-trips">
      ${label('01','ПУТЕШЕСТВИЯ','Готовим запуск')}
      ${frame('Bali Trips',gallery(baliScreens.map(item=>({...item,url:config.projects.bali})),{label:'Знакомство с Bali Trips',classes:'product-gallery',interval:5800}))}
      ${action('bali','Bali Trips','Твой гид по Бали и соседним островам. Выбери маршрут, посмотри остановки на карте и сохрани план поездки.','Посмотреть проект')}
      <span class="product-footnote">Превью прототипа · <a href="./assets/products/bali-credits.txt">Фото и карта: источники</a></span>
    </article>
    <article class="product-card product-iconbeast reveal" id="iconbeast">
      ${label('02','ИНСТРУМЕНТЫ ДЛЯ ТВОРЧЕСТВА','Уже можно попробовать')}
      ${frame('IconBeast',gallery(iconScreens.map(item=>({...item,url:config.projects.iconbeast})),{label:'Внутри IconBeast',classes:'product-gallery product-editor-gallery',interval:6600}))}
      ${action('iconbeast','IconBeast','Из одной картинки — иконки для macOS, iPhone, Android и Windows. Настрой, примерь в интерфейсе и экспортируй.','Открыть студию иконок')}
      <span class="product-footnote">Web-редактор · без регистрации</span>
    </article>
    <article class="product-card product-continuum reveal" id="continuum">
      ${label('03','ЦЕЛИ И ФОКУС','Mac + Web')}
      ${frame('Continuum',continuumDemo(icon))}
      ${action('continuum','Continuum','От сегодняшнего шага до большой цели. День, неделя и планы на жизнь — в одном спокойном пространстве.','Открыть Continuum')}
      <span class="product-footnote">Личное пространство · вход через ChatGPT</span>
    </article>
    <article class="product-card product-hundred reveal" id="the-hundred">
      ${label('04','ИСКУССТВО И ОБЪЕКТЫ','В процессе')}
      <div class="hundred-display"><img src="./assets/helmet.webp" width="900" height="1200" alt="Расписанный вручную шлем The Hundred 000/100: розовое и фиолетовое граффити" loading="lazy" decoding="async"><div class="hundred-editorial" aria-hidden="true"><span>THE<br>HUNDRED</span><em>Wear<br>your story.</em><small>000 — 100</small></div></div>
      ${action('hundred','The Hundred','Шлем как личное высказывание. Ручная роспись, характер и свобода быть собой.','Новая история на подходе')}
      <span class="product-footnote">Авторский проект · искусство вне экрана</span>
    </article>
  </div>`;
}

function continuumDemo(icon) {
  const stages=[
    {title:'Сегодня — главное',period:'Сегодня',progress:'2 / 3',tasks:[['✓','Выйти на прогулку'],['✓','Прочитать новую главу'],['○','Снять новую историю']]},
    {title:'Неделя — в перспективе',period:'На неделе',progress:'1 / 3',tasks:[['✓','Собрать идеи для проекта'],['○','Спланировать путешествие'],['○','Выделить время на музыку']]},
    {title:'Большое — по шагам',period:'На год',progress:'0 / 3',tasks:[['○','Запустить свой проект'],['○','Изучить новый язык'],['○','Увидеть больше мира']]},
  ];
  return `<div class="media-gallery product-gallery continuum-demo-gallery" data-gallery data-interval="7100" role="group" aria-label="Возможности Continuum" aria-roledescription="карусель"><div class="media-stage">${stages.map((stage,index)=>`<div class="media-slide${index===0?' is-active':''}" ${index?'aria-hidden="true" inert':''} data-title="${stage.title}"><div class="continuum-demo"><div class="demo-brand"><img src="./assets/continuum-logo.webp" width="512" height="512" alt="Логотип Continuum"><span>continuum</span><small>Демо-план</small></div><div class="demo-heading"><div><small>ВСЁ ВАЖНОЕ РЯДОМ</small><strong>${stage.period}</strong></div><span class="demo-progress">${stage.progress}</span></div><div class="demo-periods"><span class="${index===0?'selected':''}">День</span><span class="${index===1?'selected':''}">Неделя</span><span>Месяц</span><span class="${index===2?'selected':''}">Год</span><span>Жизнь</span></div><div class="demo-tasks">${stage.tasks.map(([check,title])=>`<div class="demo-task ${check==='✓'?'done':''}"><i>${check}</i><span>${title}</span><b>↗</b></div>`).join('')}</div></div><span class="slide-copy"><span>${stage.title}</span></span></div>`).join('')}</div><div class="gallery-controls"><span class="gallery-count" aria-hidden="true">01 / 03</span><button type="button" data-slide="-1" aria-label="Предыдущий кадр: Возможности Continuum">←</button><button type="button" data-slide="1" aria-label="Следующий кадр: Возможности Continuum">→</button><span class="sr-only gallery-status" role="status"></span></div></div>`;
}

export function renderBaliPreview(language,config) {
  const en=language==='en';
  const t=(ru,english)=>en?english:ru;
  const home=en?'/en/':'/';
  const base=en?'../../':'../';
  const title=t('Bali Trips — острова в твоём ритме','Bali Trips — the islands at your own pace');
  const captions=en?['Find your direction','Choose a route','See every stop on the map','Plan a day along the way']:['Найти своё направление','Выбрать маршрут','Увидеть остановки на карте','Собрать день по пути'];
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'${analytics.endpoint ? ' '+new URL(analytics.endpoint).origin : ''}; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; require-trusted-types-for 'script'; trusted-types 'none'"><meta name="referrer" content="no-referrer"><title>${title}</title><meta name="description" content="${t('Знакомство с Bali Trips: маршруты, карты и планы для самостоятельных путешествий по Бали.','Meet Bali Trips: routes, maps and plans for independent trips around Bali.')}"/><link rel="canonical" href="${config.origin}${home}bali-trips/"><link rel="alternate" hreflang="ru" href="${config.origin}/bali-trips/"><link rel="alternate" hreflang="en" href="${config.origin}/en/bali-trips/"><link rel="stylesheet" href="${base}styles.css"><link rel="icon" href="${base}favicon.svg">${analytics.endpoint ? `<script type="module" src="${base}analytics.js"></script>` : ''}</head><body class="bali-preview-page"><header class="product-page-header wrap"><a class="text-link" href="${home}#projects">← WENSDAY</a><nav aria-label="${t('Язык','Language')}"><a href="/bali-trips/" lang="ru" ${en?'':'aria-current="page"'}>RU</a><a href="/en/bali-trips/" lang="en" ${en?'aria-current="page"':''}>EN</a></nav></header><main class="wrap"><section class="bali-intro"><div><span class="eyebrow">BALI TRIPS / ${t('ГОТОВИМ ЗАПУСК','IN THE MAKING')}</span><h1>${t('Острова.<br><em>В твоём ритме.</em>','The islands.<br><em>At your own pace.</em>')}</h1><p>${t('Гид для самостоятельных поездок по Бали и соседним островам. Меньше вкладок и планирования. Больше места для приключений.','A guide for independent trips around Bali and the neighbouring islands. Fewer tabs and less planning. More room for adventure.')}</p><span class="preview-status">${t('Сейчас здесь — знакомство с рабочим прототипом. Полная версия ещё готовится.','This is a preview of the working prototype. The full version is still in the making.')}</span></div><img class="bali-intro-image" src="${base}assets/products/bali-home.webp" width="1280" height="720" alt="${captions[0]}"></section><div class="bali-feature-list"><div><span>01</span><h2>${t('Найди своё','Find your kind of trip')}</h2><p>${t('Выбор по острову, району, времени и настроению поездки.','Browse by island, area, duration and the mood of your trip.')}</p></div><div><span>02</span><h2>${t('Посмотри путь','See the whole route')}</h2><p>${t('Планы по дням, остановки и ссылки на Google Maps.','Day-by-day plans, stops and links to Google Maps.')}</p></div><div><span>03</span><h2>${t('Возьми с собой','Take it with you')}</h2><p>${t('Избранное в браузере и сохранение плана в PDF.','Browser favourites and plans you can save as a PDF.')}</p></div></div><section class="bali-preview-screens" aria-label="${t('Интерфейс Bali Trips','Bali Trips interface')}"><div class="product-page-subheading"><h2>${t('Загляни внутрь.','Take a look inside.')}</h2><span>${t('Листай экраны →','Swipe through the screens →')}</span></div><div class="preview-screen-track" tabindex="0" role="region" aria-label="${t('Экраны прототипа','Prototype screens')}">${baliScreens.slice(1).map((item,index)=>`<figure><img src="${base}${item.src}" width="1280" height="720" alt="${captions[index+1]}" loading="lazy" decoding="async"><figcaption>0${index+2} / ${captions[index+1]}</figcaption></figure>`).join('')}</div><details class="preview-credits"><summary>${t('Об изображениях и карте','Image and map credits')}</summary><p>${t('Скриншоты рабочего прототипа от 14 октября 2026. Фотографии исторические; они не подтверждают текущие условия поездки.','Working prototype screenshots, 14 October 2026. Photos are historical and do not confirm current travel conditions.')} <a href="${base}assets/products/bali-credits.txt">${t('Авторы, источники и лицензии фотографий','Photo authors, sources and licences')}</a>. ${t('Карта','Map')}: OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors (ODbL). ${t('Показан порядок остановок, а не рассчитанный автомобильный маршрут.','The map shows the order of stops, not calculated driving directions.')}</p></details></section><footer class="product-page-footer"><p>${t('Больше острова.<br><em>Скоро — здесь.</em>','More of the islands.<br><em>Coming soon.</em>')}</p><a class="text-link" href="${home}#projects">${t('Все проекты WENSDAY','All WENSDAY projects')} ↗</a></footer>${analytics.endpoint ? `<details class="preview-credits"><summary>${t('Статистика посещений','Visitor statistics')}</summary><p>${t('Считаем посещения без cookies, имён и сохранения IP. Сигналы Do Not Track и Global Privacy Control учитываются.','Visits are counted without cookies, names or stored IP addresses. Do Not Track and Global Privacy Control are respected.')}</p><button class="text-link" type="button" data-analytics-opt-out data-enabled="${t('Отключить статистику в этом браузере','Disable statistics in this browser')}" data-disabled="${t('Статистика отключена · включить со следующего открытия','Statistics disabled · enable on next visit')}" aria-pressed="false">${t('Отключить статистику в этом браузере','Disable statistics in this browser')}</button><p><a href="${home}#contact">${t('Подробнее о конфиденциальности','More about privacy')} ↗</a></p></details>` : ''}</main></body></html>`;
}
