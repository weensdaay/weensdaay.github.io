import {accountIds, count, timestamp, DAY, validateSnapshot} from '../src/stats-model.mjs';

export function validateHistory(history) {
  if (history?.version !== 1 || !Array.isArray(history.accounts) || history.accounts.length !== accountIds.length || Object.keys(history).some(k=>!['version','accounts'].includes(k))) throw Error('Invalid history');
  const ids = new Set();
  for (const item of history.accounts) {
    if (!accountIds.includes(item.id) || ids.has(item.id) || !Array.isArray(item.samples) || item.samples.length > 400 || Object.keys(item).some(k=>!['id','samples'].includes(k))) throw Error('Invalid history account');
    ids.add(item.id);
    let previous = '';
    for (const sample of item.samples) {
      if (!timestamp(sample.at) || sample.at.slice(0,10) <= previous || (sample.followers !== null && !count(sample.followers)) || (sample.views !== null && !count(sample.views)) || typeof sample.rounded !== 'boolean' || Object.keys(sample).some(k=>!['at','followers','views','rounded'].includes(k))) throw Error('Invalid historical sample');
      previous = sample.at.slice(0,10);
    }
  }
  return history;
}

export const emptyHistory = () => ({version:1,accounts:accountIds.map(id=>({id,samples:[]}))});
export function mergeHistory(previous, incoming, checkedAt) {
  validateHistory(previous);validateHistory(incoming);
  for(const account of previous.accounts) {
    for(const sample of incoming.accounts.find(item=>item.id===account.id).samples) {
      if(sample.at>checkedAt) throw Error('Future sample');
      if(!account.samples.length || sample.at>account.samples.at(-1).at) account.samples=addSample(account.samples,sample);
    }
  }
  return validateHistory(previous);
}
export function addSample(samples, sample) {
  const retained = samples.filter(item=>item.at.slice(0,10)!==sample.at.slice(0,10) && Date.parse(sample.at)-Date.parse(item.at)<400*DAY);
  return [...retained,sample].sort((a,b)=>a.at.localeCompare(b.at)).slice(-400);
}
function delta(samples, days, now) {
  const views = samples.filter(sample=>sample.views !== null);
  const last = views.at(-1);
  const result = status => ({value:null,status});
  if (!last || now-Date.parse(last.at)>DAY*2) return result('unavailable');
  const target = new Date(Date.parse(last.at)-days*DAY).toISOString().slice(0,10);
  const base = views.find(sample=>sample.at.slice(0,10)===target);
  if (!base) return result('collecting');
  const interval = views.filter(sample=>sample.at >= base.at);
  if (interval.some((sample,index)=>index && sample.views<interval[index-1].views)) return result('adjusted');
  return {value:last.views-base.views,status:'available',from:base.at,to:last.at};
}
export function makeSnapshot(history, checkedAt, results = {}) {
  validateHistory(history);
  return validateSnapshot({version:1,checkedAt,accounts:history.accounts.map(({id,samples})=>{
    const latest = key => {const item=samples.findLast(sample=>sample[key]!==null);return item ? {value:item[key],approximate:key==='followers' && item.rounded,observedAt:item.at} : null;};
    return {id,status:results[id] || 'unavailable',followers:latest('followers'),views:latest('views'),week:delta(samples,7,Date.parse(checkedAt)),year:delta(samples,365,Date.parse(checkedAt))};
  })});
}
