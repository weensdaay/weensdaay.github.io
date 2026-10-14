import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {accounts} from '../stats/accounts.mjs';
import {emptyHistory,addSample,mergeHistory,validateHistory,makeSnapshot} from '../scripts/stats-history.mjs';
import {validateSnapshot,summary,snapshotText,DAY} from '../src/stats-model.mjs';
import {publicNumber,parseYouTube,parseInstagram,parseTelegram,parseTikTok} from '../scripts/public-parsers.mjs';
const now='2026-10-14T03:00:00.000Z';
const ago=days=>new Date(Date.parse(now)-days*DAY).toISOString();
const sample=(days,views,followers=100)=>({at:ago(days),views,followers,rounded:false});
const historyWith=samples=>{const history=emptyHistory();history.accounts[0].samples=samples;return history;};

test('abbreviated public counters remain approximate and malformed counts fail closed',()=>{
  assert.deepEqual(publicNumber('115K'),{value:115000,rounded:true});
  assert.deepEqual(publicNumber('75,701,116'),{value:75701116,rounded:false});
  assert.deepEqual(publicNumber('0'),{value:0,rounded:false});
  for(const invalid of ['1,2','-20','NaN','1e8','23 views','<img src=x>','0.1','99999999999999999'])assert.equal(publicNumber(invalid),null);
});
test('YouTube extraction validates channel identity and never executes page JavaScript',()=>{
  const account=accounts[0];
  const data={metadata:{channelMetadataRenderer:{externalId:account.channelId}},nested:[{aboutChannelViewModel:{channelId:account.channelId,subscriberCountText:'115K subscribers',viewCountText:'75,701,116 views'}}]};
  const html=`<script>var ytInitialData = ${JSON.stringify(data)};throw Error('not data');</script>`;
  assert.deepEqual(parseYouTube(html,account),{followers:115000,rounded:true,views:75701116});
  assert.throws(()=>parseYouTube(html,{...account,channelId:'different'}));
  assert.throws(()=>parseYouTube('<script>var ytInitialData = (function(){return {}})()</script>',account));
});
test('profile parsers require the configured account and reject login or WAF pages',()=>{
  assert.deepEqual(parseInstagram('<meta content="1,713 Followers, 107 Posts - WENSDAY (&#064;weensdaay)" property="og:description">',accounts[2]),{followers:1713,rounded:false,views:null});
  assert.throws(()=>parseInstagram('<meta property="og:description" content="9,000 Followers - (@other)">',accounts[2]));
  assert.deepEqual(parseTelegram('<meta property="al:ios:url" content="tg://resolve?domain=weensdaay1"><div class="tgme_page_extra">1 subscriber</div>',accounts[5]),{followers:1,rounded:false,views:null});
  assert.throws(()=>parseTelegram('<div class="tgme_page_extra">9 members</div>',accounts[5]));
  assert.throws(()=>parseTikTok('<script>SlardarWAF</script>',accounts[1]));
});
test('missing historical baselines stay null, never become extrapolated weekly or yearly views',()=>{
  const data=makeSnapshot(historyWith([sample(0,500)]),now);
  assert.equal(data.accounts[0].week.value,null);assert.equal(data.accounts[0].week.status,'collecting');
  assert.equal(data.accounts[0].year.value,null);
  assert.equal(data.accounts[1].followers,null);assert.equal(data.accounts[1].week.status,'unavailable');
});
test('period growth uses matching UTC dates and suppresses counter corrections',()=>{
  const data=makeSnapshot(historyWith([sample(365,10),sample(7,100),sample(0,500)]),now);
  assert.equal(data.accounts[0].week.value,400);assert.equal(data.accounts[0].year.value,490);
  assert.equal(makeSnapshot(historyWith([sample(8,100),sample(0,500)]),now).accounts[0].week.value,null);
  assert.equal(makeSnapshot(historyWith([sample(7,500),sample(3,200),sample(0,900)]),now).accounts[0].week.status,'adjusted');
});
test('compact growth labels distinguish collecting, unavailable and measured zero',()=>{
  const collecting=makeSnapshot(historyWith([sample(0,500)]),now);
  assert.equal(snapshotText(collecting,'ru',Date.parse(now))['week-display'],'Копим историю');
  assert.equal(snapshotText(collecting,'en',Date.parse(now))['year-display'],'Building history');
  assert.equal(snapshotText(collecting,'en',Date.parse(now)+3*DAY)['week-display'],'Unavailable');
  const measured=makeSnapshot(historyWith([sample(7,500),sample(0,500)]),now);
  assert.equal(snapshotText(measured,'en',Date.parse(now))['week-display'],'+0');
  assert.equal(snapshotText(makeSnapshot(emptyHistory(),now),'ru',Date.parse(now))['week-display'],'Нет данных');
});
test('failed refreshes retain the observation date, with old numbers excluded from totals',()=>{
  const data=makeSnapshot(historyWith([sample(7,100),sample(0,500)]),now);
  assert.equal(summary(data,'views',Date.parse(now)).value,500);
  assert.equal(summary(data,'views',Date.parse(now)+3*DAY).value,null);
  assert.equal(summary(data,'week',Date.parse(now)+3*DAY).value,null);
  assert.equal(snapshotText(data,'en',Date.parse(now)+3*DAY)['youtube-science-week'],'—');
  assert.match(snapshotText(data,'en',Date.parse(now)+3*DAY)['youtube-science-date'],/older snapshot/);
});
test('an unavailable history download cannot erase authoritative baselines during publication',()=>{
  const previous=historyWith([sample(365,100),sample(7,200)]);
  const incoming=historyWith([sample(0,300)]);
  const merged=mergeHistory(previous,incoming,now);
  assert.equal(merged.accounts[0].samples.length,3);
  assert.equal(makeSnapshot(merged,now).accounts[0].year.value,200);
  assert.equal(addSample([sample(1,9),sample(0,10)],sample(0,11)).length,2);
});
test('remote JSON cannot inject links, account names, markup or negative/infinite numbers',()=>{
  const data=makeSnapshot(historyWith([sample(0,500)]),now);
  for(const value of ['<img src=x onerror=alert(1)>',-1,Infinity,1.5]){
    const copy=structuredClone(data);copy.accounts[0].views.value=value;assert.throws(()=>validateSnapshot(copy));
  }
  const copy=structuredClone(data);copy.accounts[0].url='https://phishing.invalid';assert.throws(()=>validateSnapshot(copy));
  const duplicate=structuredClone(data);duplicate.accounts[1]=duplicate.accounts[0];assert.throws(()=>validateSnapshot(duplicate));
  const future=historyWith([sample(-1,999)]);assert.throws(()=>mergeHistory(emptyHistory(),future,now));
  const arbitrary=historyWith([sample(0,99)]);arbitrary.accounts[0].samples[0].code='alert(1)';assert.throws(()=>validateHistory(arbitrary));
});
test('public pages enforce CSP and contain no editing surfaces or remote executable code',async()=>{
  for(const file of ['docs/index.html','docs/en/index.html']){
    const html=await fs.readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.match(html,/script-src 'self'/);assert.match(html,/form-action 'none'/);assert.match(html,/base-uri 'none'/);
    assert.doesNotMatch(html,/<(?:form|iframe)\b|contenteditable|on(?:click|load|error)=|<script[^>]+src="https?:/i);
    assert.doesNotMatch(html,/unsafe-inline|unsafe-eval|ghp_[a-zA-Z0-9]{20}|github_pat_/);
    assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('<script'));
  }
});
