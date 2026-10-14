import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import media from '../media.config.mjs';
import translations from '../translations.mjs';
import {renderStats} from './render-stats.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs');
const stats = JSON.parse(await fs.readFile(path.join(root,'stats/snapshot.json'),'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const validUrl = url => {
  if (url === null) return false;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(`Public links must use HTTPS: ${url}`);
  return true;
};
const external = url => `href="${esc(url)}" target="_blank" rel="noopener noreferrer"`;
const soon = name => `type="button" data-soon="${esc(name)}" aria-label="${esc(name)} — скоро"`;
const social = items => items.map(item => {
  const available = validUrl(item.url);
  const tag = available ? 'a' : 'button';
  return `<${tag} class="social-row${available ? '' : ' is-soon'}" ${available ? external(item.url) : soon(item.name)}>${icon(item.icon)}<span class="social-copy"><strong>${esc(item.name)}</strong><span>${esc(item.label)}</span></span>${available ? icon('arrow') : '<span class="soon-label">скоро</span>'}</${tag}>`;
}).join('\n');
const telegram = (label, classes='') => config.telegram
  ? `<a class="telegram-link ${classes}" ${external(config.telegram)}>${icon('telegram')}<span>${label}</span>${icon('arrow')}</a>`
  : `<button class="telegram-link ${classes}" ${soon('Telegram')}>${icon('telegram')}<span>${label}</span><span class="tg-soon">скоро</span></button>`;
const project = (key, label) => config.projects[key]
  ? `<a class="project-link" ${external(config.projects[key])}><span>${label}</span>${icon('arrow')}</a>`
  : `<button class="project-link" ${soon(label)}><span>${label}</span><span class="soon-label">скоро ${icon('arrow')}</span></button>`;

const platformInfo = {youtube:['youtube','YouTube'],shorts:['youtube','YouTube Shorts'],tiktok:['tiktok','TikTok'],instagram:['instagram','Instagram · Reels']};
const gallery = (items, {label, classes='', interval=6000, controls=true, eager=false, offset=0, captions=true}={}) => {
  if (!items.length) return '';
  const ordered = [...items.slice(offset), ...items.slice(0,offset)];
  return `<div class="media-gallery ${classes}" data-gallery data-interval="${interval}" role="group" aria-label="${esc(label)}" aria-roledescription="карусель">
    <div class="media-stage">${ordered.map((item,index) => {
      if (item.url) validUrl(item.url);
      const tag = item.url ? 'a' : 'div';
      const platform = platformInfo[item.platform];
      return `<${tag} class="media-slide${index === 0 ? ' is-active' : ''}" ${item.url ? external(item.url) : ''} ${index ? 'aria-hidden="true" inert' : ''} data-title="${esc(item.title)}">
        <img ${index ? 'data-src' : 'src'}="./${esc(item.src)}" width="${item.width || 720}" height="${item.height || 960}" alt="${esc(item.alt)}" ${index ? '' : eager ? '' : 'loading="lazy"'} decoding="async">
        ${platform ? `<span class="slide-platform">${icon(platform[0])}${platform[1]}</span>` : ''}
        ${captions ? `<span class="slide-copy"><span>${esc(item.title)}</span>${item.url ? icon('arrow') : ''}</span>` : ''}
      </${tag}>`;
    }).join('')}</div>
    ${controls ? `<div class="gallery-controls"><span class="gallery-count" aria-hidden="true">01 / ${String(items.length).padStart(2,'0')}</span><button type="button" data-slide="-1" aria-label="Предыдущий кадр: ${esc(label)}">←</button><button type="button" data-slide="1" aria-label="Следующий кадр: ${esc(label)}">→</button><span class="sr-only gallery-status" role="status"></span></div>` : ''}
  </div>`;
};
const mailto = `mailto:${config.contact.email}?subject=${encodeURIComponent(config.contact.subject)}`;
const quickLinks = [
  ...config.science.map(item => ({...item, name:`${item.name} · научпоп`, detail:'Научно-познавательный контент', soonName:item.name})),
  ...config.life.map(item => ({...item, name:`${item.name} · ${item.icon === 'youtube' ? 'влоги' : 'жизнь'}`,detail:'Путешествия и личный блог', soonName:item.name})),
  ...config.music.map(item => ({...item,detail:'Andry Wednesday · музыка'})),
  ...config.books.map(item => ({...item,icon:'book',detail:'Андрей Середа · книги'})),
  {name:'Telegram',icon:'telegram',url:config.telegram,detail:'Главное место встречи'},
  {name:'The Hundred',icon:'star',url:config.projects.hundred,detail:'Искусство на шлемах'},
  {name:'Continuum',icon:'star',url:config.projects.continuum,detail:'Пространство для целей'},
  {name:'Bali Trips',icon:'arrow',url:config.projects.bali,detail:'Путешествия по Бали'},
  {name:'Сотрудничество и реклама',icon:'mail',url:mailto,detail:config.contact.email},
  ...media.albums.map(item => ({...item,name:item.title,icon:'music',detail:'Andry Wednesday · релиз'})),
  ...media.science.map(item => ({...item,name:item.title,icon:item.platform === 'tiktok' ? 'tiktok' : 'youtube',detail:item.platform === 'tiktok' ? 'TikTok · научпоп' : 'YouTube · научпоп'})),
  ...media.reels.map(item => ({...item,name:item.title,icon:'instagram',detail:'Instagram · путешествия'})),
  ...media.vlogs.map(item => ({...item,name:item.title,icon:'youtube',detail:'Смотреть · влог'}))
];
// A mixed order without JavaScript, reshuffled once per visit in the browser.
const mixedLinks = quickLinks.map((item,index) => ({item,order:(index * 13) % quickLinks.length})).sort((a,b)=>a.order-b.order).map(({item}) => item);
const quickLink = item => {
  const available = item.url !== null;
  const tag = available ? 'a' : 'button';
  const destination = item.url === mailto ? `href="${esc(mailto)}"` : available && validUrl(item.url) ? external(item.url) : soon(item.soonName || item.name);
  return `<${tag} class="quick-chip" ${destination}>${icon(item.icon)}<span><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small></span>${available ? icon('arrow') : '<span class="soon-label">скоро</span>'}</${tag}>`;
};

for (const url of [config.origin, config.telegram, ...Object.values(config.projects)]) validUrl(url);
let html = await fs.readFile(path.join(root,'src/index.html'), 'utf8');
const tokens = {
  'public-stats': '<!--PUBLIC-STATS-->',
  title: esc(config.title), description: esc(config.description), origin: esc(config.origin),
  'contact-email': esc(config.contact.email),
  'contact-mailto': `mailto:${esc(config.contact.email)}?subject=${encodeURIComponent(config.contact.subject)}`,
  'quick-links': mixedLinks.map(quickLink).join(''),
  'hero-left': gallery(media.photos.filter((_,index)=>index%3===1),{label:'По пути',classes:'polaroid-gallery',interval:7400,controls:false,eager:true,captions:false}),
  'hero-center': gallery(media.photos.filter((_,index)=>index%3===0),{label:'Моменты моей жизни',classes:'polaroid-gallery',interval:6200,controls:false,eager:true,captions:false}),
  'hero-right': gallery(media.photos.filter((_,index)=>index%3===2),{label:'За кадром',classes:'polaroid-gallery',interval:8600,controls:false,eager:true,captions:false}),
  'science-gallery': gallery(media.science,{label:'Видео о науке',classes:'video-gallery',interval:6500}),
  'life-gallery': gallery(media.photos,{label:'Путешествия и жизнь',classes:'travel-gallery',offset:1,interval:7200,controls:false,captions:false}),
  'reel-gallery': gallery(media.reels,{label:'Instagram — путешествия и Reels',classes:'video-gallery reel-gallery',interval:7600}),
  'vlog-gallery': gallery(media.vlogs,{label:'YouTube — влоги',classes:'video-gallery vlog-gallery',interval:7000}),
  'album-gallery': gallery(media.albums,{label:'Релизы Andry Wednesday',classes:'album-gallery',interval:6700}),
  'science-links': social(config.science), 'life-links': social(config.life),
  'telegram-hero': telegram('Мой Telegram', 'hero-telegram'),
  'telegram-footer': telegram('Быть на связи', 'footer-telegram'),
  'telegram-mobile': telegram('Telegram', 'mobile-telegram'),
  'music-links': config.music.map(item => {
    const available = validUrl(item.url);
    return `<${available ? 'a' : 'button'} class="music-link" ${available ? external(item.url) : soon(item.name)}>${icon(item.icon)}<span>${esc(item.name)}</span>${available ? icon('arrow') : '<span class="soon-label">скоро</span>'}</${available ? 'a' : 'button'}>`;
  }).join('\n'),
  'book-links': config.books.map(book => `<a class="book-link" ${external(book.url)}><span>${esc(book.name)}</span>${icon('arrow')}</a>`).join('\n'),
  'project-hundred': project('hundred', 'The Hundred'),
  'project-continuum': project('continuum', 'Continuum'),
  'project-bali': project('bali', 'Bali Trips'),
};
html = html.replace(/\{\{([a-z-]+)\}\}/g, (_, key) => {
  if (!(key in tokens)) throw new Error(`Unknown template token: ${key}`);
  return tokens[key];
}).replace(/[ \t]+$/gm,'');
await fs.mkdir(output, {recursive:true});
await fs.writeFile(path.join(output,'index.html'),html.replace('<!--PUBLIC-STATS-->',renderStats(stats,'ru')));
let englishHtml = html;
for (const [ru,en] of Object.entries(translations).sort((a,b)=>b[0].length-a[0].length)) {
  englishHtml = englishHtml.replaceAll(ru.includes('<br>') ? ru : esc(ru), en.includes('<br>') ? en : esc(en));
}
englishHtml = englishHtml.replace('<html lang="ru">','<html lang="en">')
  .replace('content="ru_RU"','content="en_US"')
  .replace(`rel="canonical" href="${config.origin}/"`,`rel="canonical" href="${config.origin}/en/"`)
  .replace(`property="og:url" content="${config.origin}/"`,`property="og:url" content="${config.origin}/en/"`)
  .replaceAll(encodeURIComponent(config.contact.subject),encodeURIComponent('WENSDAY — collaborations and advertising'))
  .replaceAll('"./','"../');
await fs.mkdir(path.join(output,'en'),{recursive:true});
await fs.writeFile(path.join(output,'en/index.html'),englishHtml.replace('<!--PUBLIC-STATS-->',renderStats(stats,'en')));
await fs.writeFile(path.join(output,'stats.json'),JSON.stringify(stats)+'\n');
await Promise.all(['styles.css','app.js','locale.js','stats.js','stats-model.mjs','favicon.svg','social-preview.svg'].map(name => fs.copyFile(path.join(root,'src',name),path.join(output,name))));
await fs.cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
await fs.writeFile(path.join(output,'.nojekyll'),'');
await fs.writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${config.origin}/sitemap.xml\n`);
await fs.writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(config.origin)}/</loc></url><url><loc>${esc(config.origin)}/en/</loc></url></urlset>\n`);
const securityMeta = html.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)[0];
await fs.writeFile(path.join(output,'404.html'),`<!doctype html><html lang="ru"><meta charset="utf-8">${securityMeta}<meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена — WENSDAY</title><link rel="stylesheet" href="/styles.css"><body><main class="not-found"><span class="eyebrow">404 / НЕМНОГО НЕ ТУДА</span><h1>Свернули<br>с маршрута.</h1><p>Этой страницы нет. Всё самое интересное — на главной.</p><a class="text-link" href="/">Вернуться к WENSDAY ↗</a></main></body></html>`);
console.log('Built docs/ — static HTML, local assets, no runtime dependencies.');
