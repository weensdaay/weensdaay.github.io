import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {attribution,deviceType,trackingAllowed,reusableSession,idleLimit,lifetimeLimit} from '../src/analytics-model.mjs';
import {analyticsCatalog} from '../scripts/analytics-catalog.mjs';

test('campaign attribution only accepts known source/account pairs and ignores private query values',()=>{
 assert.deepEqual(attribution('https://weensdaay.github.io/?utm_source=instagram&utm_content=life&email=private@example.com'),{source:'instagram',account:'life'});
 assert.deepEqual(attribution('https://weensdaay.github.io/?utm_source=instagram&utm_content=private-person'),{source:'instagram',account:null});
 assert.deepEqual(attribution('https://weensdaay.github.io/?utm_source=private-person','https://www.tiktok.com/@person?private=value'),{source:'tiktok',account:null});
 assert.deepEqual(attribution('https://weensdaay.github.io/','https://instagram.com.attacker.example/'),{source:'other',account:null});
 assert.deepEqual(attribution('https://weensdaay.github.io/','https://weensdaay.github.io/en/'),{source:'direct',account:null});
});
test('device classification is coarse and privacy signals disable tracking',()=>{
 assert.equal(deviceType('Mozilla iPhone'),'mobile');assert.equal(deviceType('Mozilla Macintosh',5),'tablet');assert.equal(deviceType('Windows'),'desktop');
 for(const n of [{doNotTrack:'1'},{globalPrivacyControl:true},{webdriver:true}])assert.equal(trackingAllowed(n,'weensdaay.github.io'),false);
 assert.equal(trackingAllowed({},'localhost'),false);assert.equal(trackingAllowed({},'other.example'),false);assert.equal(trackingAllowed({},'weensdaay.github.io'),true);
});
test('short-lived random sessions expire after inactivity and cannot live indefinitely',()=>{
 const now=Date.now(),s={id:'2e7a6946-491b-4bd0-ac3c-3c924fb5e629',started:now-1000,touched:now-100};
 assert.equal(reusableSession(s,now),true);
 assert.equal(reusableSession({...s,touched:now-idleLimit},now),false);
 assert.equal(reusableSession({...s,started:now-lifetimeLimit},now),false);
 assert.equal(reusableSession({...s,started:now+1},now),false);
 assert.equal(reusableSession({...s,id:'someone@example.com'},now),false);
});
test('every public outgoing link gets a known stable destination ID and no read secret is published',async()=>{
 const ids=new Set(analyticsCatalog.map(item=>item.id));assert.equal(ids.size,analyticsCatalog.length);
 for(const language of ['index.html','en/index.html']){
  const html=await fs.readFile(new URL(`../docs/${language}`,import.meta.url),'utf8');
  for(const link of html.matchAll(/<a\b[^>]+>/g)) {
   if(/href="(?:https?:|mailto:)/.test(link[0]))assert.ok(ids.has(link[0].match(/data-track="([^"]+)"/)?.[1]),link[0]);
  }
  assert.doesNotMatch(html,/READ_TOKEN|RATE_SALT|Bearer\s+[A-Za-z0-9]/);
 }
});
