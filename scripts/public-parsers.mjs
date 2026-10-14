import {count} from '../src/stats-model.mjs';

export function publicNumber(text) {
  const match = String(text).trim().match(/^(\d[\d,]*(?:\.\d+)?)([KMB])?$/i);
  if (!match) return null;
  if (match[1].includes(',') && !/^\d{1,3}(?:,\d{3})+$/.test(match[1])) return null;
  if (!match[2] && match[1].includes('.')) return null;
  const value = Math.round(Number(match[1].replaceAll(',','')) * ({K:1e3,M:1e6,B:1e9}[match[2]?.toUpperCase()] || 1));
  return count(value) ? {value,rounded:Boolean(match[2])} : null;
}

// Extract just JSON, never execute a remote script (including anti-bot challenges).
export function assignedJson(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) throw Error('Public JSON missing');
  const open = html.indexOf('{',start+marker.length);
  let depth = 0, quoted = false, escaped = false;
  for (let i=open;i<html.length && i>=0;i++) {
    const char=html[i];
    if (quoted) {if(escaped) escaped=false; else if(char==='\\') escaped=true; else if(char==='"') quoted=false;}
    else if(char==='"') quoted=true;
    else if(char==='{') depth++;
    else if(char==='}' && --depth===0) return JSON.parse(html.slice(open,i+1));
  }
  throw Error('Incomplete public JSON');
}
function findAbout(data, channelId) {
  const pending=[data]; let nodes=0;
  while(pending.length && nodes++<100000) {
    const item=pending.pop();
    if(!item || typeof item!=='object') continue;
    if(item.aboutChannelViewModel?.channelId===channelId) return item.aboutChannelViewModel;
    pending.push(...Object.values(item).filter(value=>value && typeof value==='object'));
  }
  return null;
}
export function parseYouTube(html, account) {
  if(!account.channelId) throw Error('Channel identity not verified');
  const data=assignedJson(html,'var ytInitialData =');
  if(data.metadata?.channelMetadataRenderer?.externalId!==account.channelId) throw Error('Channel identity mismatch');
  const about=findAbout(data,account.channelId);
  if(!about) throw Error('Public channel counters missing');
  const subscribers=about.subscriberCountText?.match(/^([\d,.]+[KMB]?) subscribers?$/i);
  const views=about.viewCountText?.match(/^([\d,]+) views?$/i);
  const followers=subscribers ? publicNumber(subscribers[1]) : null;
  const total=views ? publicNumber(views[1]) : null;
  if(!followers && !total) throw Error('Public counters missing');
  return {followers:followers?.value ?? null,rounded:followers?.rounded ?? false,views:total?.value ?? null};
}
const decode = text => text.replace(/&#(x[\da-f]+|\d+);/gi,(_,entity)=>{const value=entity[0].toLowerCase()==='x'?parseInt(entity.slice(1),16):Number(entity);return value<=0x10ffff?String.fromCodePoint(value):'';}).replaceAll('&quot;','"').replaceAll('&amp;','&');
export function metaContent(html, property) {
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]) {
    const attrs=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3])]));
    if(attrs.property===property) return attrs.content || '';
  }
  return '';
}
export function parseInstagram(html, account) {
  const description=metaContent(html,'og:description');
  if(!description.includes(`(${account.handle})`)) throw Error('Profile identity mismatch');
  const match=description.match(/^([\d,.]+[KMB]?) Followers\b/i);
  const followers=match && publicNumber(match[1]);
  if(!followers) throw Error('Public followers missing');
  return {followers:followers.value,rounded:followers.rounded,views:null};
}
export function parseTelegram(html, account) {
  if(metaContent(html,'al:ios:url')!==`tg://resolve?domain=${account.handle.slice(1)}`) throw Error('Channel identity mismatch');
  const match=html.match(/class="tgme_page_extra"[^>]*>\s*([\d ,]+) subscribers?\s*</);
  const followers=match && publicNumber(match[1].replaceAll(' ',''));
  if(!followers) throw Error('Public subscribers missing');
  return {followers:followers.value,rounded:followers.rounded,views:null};
}
export function parseTikTok(html, account) {
  const match=html.match(/<script\b[^>]*\bid="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if(!match) throw Error('Public profile unavailable');
  const profile=JSON.parse(match[1])?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
  if(profile?.user?.uniqueId!==account.handle.slice(1) || !count(profile?.stats?.followerCount)) throw Error('Public identity or counters missing');
  return {followers:profile.stats.followerCount,rounded:false,views:null};
}
