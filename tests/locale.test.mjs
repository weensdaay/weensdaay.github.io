import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../src/locale.js',import.meta.url),'utf8');
async function visit({language='ru',query='',stored=null,country='US',browser=['en-US'],reject=false,manualDuringFetch=false}={}) {
  const redirects=[],local=new Map(stored?[['wensday-language',stored]]:[]),session=new Map();
  let requests=0;
  const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)});
  const env={
    document:{documentElement:{lang:language,dataset:{}},querySelectorAll:()=>[]},
    window:{localStorage:storage(local),sessionStorage:storage(session)},
    location:{href:`https://weensdaay.github.io/${language==='en'?'en/':''}${query}#music`,origin:'https://weensdaay.github.io',hash:'#music',replace:url=>redirects.push(url)},
    navigator:{languages:browser},URL,AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{requests++;assert.equal(url,'https://api.country.is/');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');if(manualDuringFetch)local.set('wensday-language','ru');if(reject)throw Error('offline');return {ok:true,json:async()=>({country})};}
  };
  vm.runInNewContext(source,env);
  await new Promise(resolve=>setTimeout(resolve,5));
  return {redirects,requests,local,session};
}
test('country outside CIS selects English and preserves the section',async()=>{
  const result=await visit();assert.deepEqual(result.redirects,['https://weensdaay.github.io/en/#music']);
});
test('country inside the configured region keeps Russian',async()=>{
  for(const country of ['RU','BY','KZ']) assert.deepEqual((await visit({country})).redirects,[]);
});
test('manual language choice takes priority over VPN and skips country requests',async()=>{
  for(const options of [{stored:'ru'},{query:'?lang=ru',stored:'en'}]) {
    const result=await visit(options);assert.equal(result.requests,0);assert.deepEqual(result.redirects,[]);
  }
  const result=await visit({stored:'en',country:'RU'});assert.equal(result.requests,0);assert.equal(result.redirects.length,1);
});
test('unavailable or malformed country response falls back to browser language',async()=>{
  assert.equal((await visit({reject:true,browser:['en-US']})).redirects.length,1);
  assert.equal((await visit({reject:true,browser:['ru-RU']})).redirects.length,0);
  assert.equal((await visit({country:'not-a-country',browser:['en']})).redirects.length,1);
});
test('explicit English links and a manual choice during lookup never get overridden',async()=>{
  const english=await visit({language:'en',stored:'ru'});assert.equal(english.requests,0);assert.deepEqual(english.redirects,[]);
  const pending=await visit({manualDuringFetch:true});assert.deepEqual(pending.redirects,[]);
});
test('automatic language choice retains account attribution but drops arbitrary query data',async()=>{
 const result=await visit({query:'?utm_source=instagram&utm_medium=social&utm_campaign=profile&utm_content=life&private=secret'});
 const url=new URL(result.redirects[0]);assert.equal(url.searchParams.get('utm_source'),'instagram');assert.equal(url.searchParams.get('utm_content'),'life');assert.equal(url.searchParams.has('private'),false);
});
