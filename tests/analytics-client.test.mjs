import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as model from '../src/analytics-model.mjs';
import {validatePayload} from '../analytics/worker.mjs';
const code=(await fs.readFile(new URL('../src/analytics.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
async function client({endpoint='https://collector.example/v1/events',privacy={},stored=[],redirect=false,visible=true}={}) {
 const listeners={},timers=new Map(),requests=[],local=new Map(),session=new Map(stored);let id=0;
 const storage=map=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const doc={documentElement:{dataset:redirect?{localeRedirect:'true'}:{},scrollHeight:1000},referrer:'https://l.instagram.com/?private=secret',visibilityState:visible?'visible':'hidden',querySelector:()=>null,getElementById:()=>null,addEventListener:(key,cb)=>(listeners[key]??=[]).push(cb),removeEventListener:(key,cb)=>{listeners[key]=(listeners[key]??[]).filter(x=>x!==cb);}};
 const env={settings:{endpoint},...model,navigator:{userAgent:'iPhone',maxTouchPoints:5,...privacy},location:{hostname:'weensdaay.github.io',href:'https://weensdaay.github.io/?utm_source=instagram&utm_content=life',pathname:'/'},document:doc,localStorage:storage(local),sessionStorage:storage(session),URL,crypto,Date,JSON,Set,Math,AbortSignal,setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:id=>timers.delete(id),fetch:async(url,options)=>{requests.push({url,...options});return {ok:true}},requestAnimationFrame:fn=>fn(),innerHeight:500,scrollY:500};
 env.window={wensdayLocaleReady:Promise.resolve(),addEventListener:doc.addEventListener};
 await vm.runInNewContext(`(async()=>{${code}})()`,env);
 const flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn()}};
 return {requests,flush,doc,local,session,listeners,click:dataset=>(listeners.click??[]).forEach(fn=>fn({target:{closest:()=>({dataset})}}))};
}
test('real client batches page + outgoing click into accepted server payload without transmitting referrer or full UA',async()=>{
 const c=await client();c.click({track:'telegram'});
 assert.equal(c.requests.length,1);const request=c.requests[0],payload=JSON.parse(request.body);validatePayload(payload);
 assert.equal(payload.source,'instagram');assert.equal(payload.account,'life');assert.equal(payload.device,'mobile');
 assert.deepEqual(payload.events.map(e=>e.type),['pageview','click']);assert.equal(payload.events[1].target,'telegram');
 assert.equal(request.credentials,'omit');assert.equal(request.referrerPolicy,'no-referrer');assert.equal(request.keepalive,true);
 assert.doesNotMatch(request.body,/secret|instagram\.com|iPhone|Authorization/);
});
test('disabled endpoint, locale redirect, DNT and GPC make no tracking requests',async()=>{
 for(const options of [{endpoint:null},{redirect:true},{privacy:{doNotTrack:'1'}},{privacy:{globalPrivacyControl:true}}]){const c=await client(options);c.flush();assert.equal(c.requests.length,0);}
});
test('opt-out prevents queued events and later clicks; hidden startup counts only once on first visibility',async()=>{
 const c=await client();c.local.set('wensday-analytics-opt-out','1');c.flush();c.click({track:'telegram'});c.flush();assert.equal(c.requests.length,0);
 const h=await client({visible:false});h.flush();assert.equal(h.requests.length,0);h.doc.visibilityState='visible';for(const fn of [...h.listeners.visibilitychange])fn();h.flush();assert.equal(JSON.parse(h.requests[0].body).events.filter(e=>e.type==='pageview').length,1);
 for(const fn of [...h.listeners.visibilitychange])fn();h.flush();assert.equal(h.requests.length,1);
});
