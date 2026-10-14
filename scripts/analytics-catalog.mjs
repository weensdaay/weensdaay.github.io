import {createHash} from 'node:crypto';
import config from '../site.config.mjs';
import media from '../media.config.mjs';
import {accounts} from '../stats/accounts.mjs';
const entries = [];
const add = (id,name,url) => { if (url && !entries.some(item => item.url === url)) entries.push({id,name,url}); };
add('telegram','Telegram',config.telegram);
for(const account of accounts) add(account.id,account.label,account.url);
add('contact-email','Сотрудничество · email',`mailto:${config.contact.email}`);
for (const [group,items] of [['science',config.science],['life',config.life],['music',config.music],['books',config.books]]) {
  for (const [index,item] of items.entries()) add(`${group}-${item.icon || 'book'}-${index+1}`,`${item.name} · ${group}`,item.url);
}
for (const [key,url] of Object.entries(config.projects)) add(`project-${key}`,key,url);
for (const [group,items] of Object.entries(media)) {
  for (const item of items) if (item.url) add(`${group}-${createHash('sha256').update(item.url).digest('hex').slice(0,12)}`,item.title,item.url);
}
export const analyticsCatalog = entries;
export function destinationID(href) {
  if (href.startsWith('mailto:')) return entries.find(item => item.id === 'contact-email')?.id;
  return entries.find(item => item.url === href)?.id;
}
