import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const docs=path.join(root,'docs');
const html=await fs.readFile(path.join(docs,'index.html'),'utf8');

test('published HTML has every configured live link, with safe external navigation',()=>{
  const urls=[...config.science,...config.life,...config.music,...config.books].map(x=>x.url).filter(Boolean);
  for(const url of urls) assert.ok(html.includes(`href="${url}" target="_blank" rel="noopener noreferrer"`),url);
  assert.ok(html.includes('<html lang="ru">'));
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.doesNotMatch(html,/\{\{[a-z-]+\}\}/);
});
test('unfinished destinations remain honest buttons, never fabricated links',()=>{
  assert.equal(config.telegram,null,'User requested no Telegram destination until supplied');
  assert.match(html,/<button[^>]+data-soon="Telegram"/);
  assert.doesNotMatch(html,/href="https:\/\/t.me\//);
  assert.doesNotMatch(html,/href="(?:javascript:|#soon|https?:\/\/localhost)/);
  assert.equal((html.match(/data-soon="Telegram"/g)||[]).length,3);
  assert.match(html,/<dialog[^>]+aria-labelledby="soon-title"/);
});
test('all public relative assets and anchor destinations exist',async()=>{
  for(const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) await fs.access(path.join(docs,match[1]));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
  for(const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]),`missing anchor ${match[1]}`);
  await fs.access(path.join(docs,'assets/social-preview.png'));
  await fs.access(path.join(docs,'.nojekyll'));
});
test('page stays lean and self-contained',async()=>{
  assert.doesNotMatch(html,/<(?:script|iframe)[^>]+src="https?:/);
  const css=await fs.readFile(path.join(docs,'styles.css'),'utf8');
  assert.doesNotMatch(css,/@import|url\(['"]?https?:/);
  assert.match(css,/prefers-reduced-motion/);
  let weight=Buffer.byteLength(html)+Buffer.byteLength(css)+(await fs.stat(path.join(docs,'app.js'))).size;
  for(const name of ['manrope.ttf','portrait.webp','desert.webp','night-ride.webp']) weight+=(await fs.stat(path.join(docs,'assets',name))).size;
  assert.ok(weight<350_000,`initial uncompressed assets ${weight} B exceed 350 KB budget`);
});
test('contact is the selected iCloud alias and creates a draft rather than sending a message',()=>{
  assert.match(config.contact.email,/^[a-z0-9._-]+@icloud\.com$/i);
  assert.ok(html.includes(`mailto:${config.contact.email}?subject=${encodeURIComponent(config.contact.subject)}`));
  assert.ok(html.includes(`data-copy-email="${config.contact.email}"`));
  assert.doesNotMatch(html,/@gmail\.com/);
});
