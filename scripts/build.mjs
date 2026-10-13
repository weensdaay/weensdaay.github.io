import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs');
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const validUrl = url => {
  if (url === null) return false;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error(`Public links must use HTTPS: ${url}`);
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

for (const url of [config.origin, config.telegram, ...Object.values(config.projects)]) validUrl(url);
let html = await fs.readFile(path.join(root,'src/index.html'), 'utf8');
const tokens = {
  title: esc(config.title), description: esc(config.description), origin: esc(config.origin),
  'contact-email': esc(config.contact.email),
  'contact-mailto': `mailto:${esc(config.contact.email)}?subject=${encodeURIComponent(config.contact.subject)}`,
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
});
await fs.mkdir(output, {recursive:true});
await fs.writeFile(path.join(output,'index.html'),html);
await Promise.all(['styles.css','app.js','favicon.svg','social-preview.svg'].map(name => fs.copyFile(path.join(root,'src',name),path.join(output,name))));
await fs.cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
await fs.writeFile(path.join(output,'.nojekyll'),'');
await fs.writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${config.origin}/sitemap.xml\n`);
await fs.writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(config.origin)}/</loc></url></urlset>\n`);
await fs.writeFile(path.join(output,'404.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена — WENSDAY</title><link rel="stylesheet" href="/styles.css"><body><main class="not-found"><span class="eyebrow">404 / НЕМНОГО НЕ ТУДА</span><h1>Свернули<br>с маршрута.</h1><p>Этой страницы нет. Всё самое интересное — на главной.</p><a class="text-link" href="/">Вернуться к WENSDAY ↗</a></main></body></html>`);
console.log('Built docs/ — static HTML, local assets, no runtime dependencies.');
