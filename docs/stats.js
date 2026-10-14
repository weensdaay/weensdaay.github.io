import {validateSnapshot,snapshotText} from './stats-model.mjs';
const section=document.querySelector('#numbers');
const cards=section.querySelector('.stats-channels');
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('motion-paused');
const step=direction=>cards.scrollBy({left:direction*(cards.querySelector('article').getBoundingClientRect().width+14),behavior:reduced()?'instant':'smooth'});
section.querySelectorAll('[data-stats-step]').forEach(button=>button.addEventListener('click',()=>step(Number(button.dataset.statsStep))));
cards.addEventListener('keydown',event=>{if(event.target===cards && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}});
let latest='';
async function readSnapshot(url) {
  const response=await fetch(url,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(7000)});
  if(!response.ok) throw Error('Unavailable');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>24000)throw Error('Too large');chunks.push(value);}
  } finally {await reader.cancel().catch(()=>{});}
  const data=validateSnapshot(JSON.parse(await new Blob(chunks).text()));
  if(Date.parse(data.checkedAt)>Date.now()+300000 || data.checkedAt<latest) return;
  latest=data.checkedAt;
  const fields=snapshotText(data,document.documentElement.lang);
  section.querySelectorAll('[data-stat]').forEach(element=>{if(Object.hasOwn(fields,element.dataset.stat)) element.textContent=fields[element.dataset.stat];});
}
function load() {
  // Refresh only the numeric fields: remote JSON cannot supply markup or links.
  readSnapshot(new URL('./stats.json',import.meta.url)).catch(()=>{});
  readSnapshot('https://raw.githubusercontent.com/weensdaay/weensdaay.github.io/public-metrics/stats.json').catch(()=>{});
}
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();load();}},{rootMargin:'500px'});observer.observe(section);}else load();
