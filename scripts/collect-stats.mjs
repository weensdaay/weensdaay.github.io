import fs from 'node:fs/promises';
import {accounts,dataOrigin} from '../stats/accounts.mjs';
import {validateHistory,addSample,makeSnapshot} from './stats-history.mjs';
import {parseYouTube,parseInstagram,parseTelegram,parseTikTok} from './public-parsers.mjs';

const parsers={youtube:parseYouTube,instagram:parseInstagram,telegram:parseTelegram,tiktok:parseTikTok};
const now=new Date().toISOString();
async function readPublic(url,maxBytes=5_000_000) {
  // Exact configured URLs only. No cookies, no auth, no redirect to login/challenge hosts.
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'en-US,en;q=0.9'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw Error(`HTTP ${response.status}`);
  if(Number(response.headers.get('content-length'))>maxBytes) throw Error('Oversized response');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes){await response.body.cancel().catch(()=>{});throw Error('Oversized response');}chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
let history=validateHistory(JSON.parse(await fs.readFile('stats/history.json','utf8')));
try { history=validateHistory(JSON.parse(await readPublic(dataOrigin+'history.json',1_000_000))); }
catch { console.log('Using checked-in baseline; remote history unavailable.'); }
const results={};
for(const account of accounts) {
  try {
    const source=account.platform==='youtube' ? account.url+'/about?hl=en' : account.url;
    const metrics=parsers[account.platform](await readPublic(source),account);
    const item=history.accounts.find(item=>item.id===account.id);
    item.samples=addSample(item.samples,{at:now,...metrics});
    results[account.id]='ok';
    console.log(`${account.id}: public counters collected`);
  } catch {results[account.id]='unavailable';console.log(`${account.id}: unavailable; retaining dated snapshot`);}
}
await fs.mkdir('.stats-output',{recursive:true});
await fs.writeFile('.stats-output/history.json',JSON.stringify(history)+'\n');
await fs.writeFile('.stats-output/stats.json',JSON.stringify(makeSnapshot(history,now,results))+'\n');
console.log(`Collected ${Object.values(results).filter(x=>x==='ok').length}/${accounts.length} public profiles.`);
