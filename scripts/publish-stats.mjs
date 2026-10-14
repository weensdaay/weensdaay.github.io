import fs from 'node:fs/promises';
import {repository,dataBranch} from '../stats/accounts.mjs';
import {validateSnapshot} from '../src/stats-model.mjs';
import {validateHistory,emptyHistory,mergeHistory,makeSnapshot} from './stats-history.mjs';

// This short-lived GitHub job token can publish repository data, never sign in to a social account.
if(process.env.GITHUB_REPOSITORY!==repository || process.env.GITHUB_REF!=='refs/heads/main' || !['push','schedule','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)) throw Error('Unexpected workflow context');
const token=process.env.GITHUB_TOKEN;
if(!token) throw Error('Missing job token');
const api=`https://api.github.com/repos/${repository}`;
async function request(route,method='GET',body=null,optional=false) {
  const response=await fetch(api+route,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(optional && response.status===404) return null;
  if(!response.ok) throw Error(`GitHub data publication failed (${response.status})`);
  return response.json();
}
const proposed=validateSnapshot(JSON.parse(await fs.readFile('.stats-output/stats.json','utf8')));
if(Math.abs(Date.now()-Date.parse(proposed.checkedAt))>3600000) throw Error('Artifact too old');
const incoming=validateHistory(JSON.parse(await fs.readFile('.stats-output/history.json','utf8')));
const ref=await request(`/git/ref/heads/${dataBranch}`,'GET',null,true);
let previous=emptyHistory();
if(ref) {
  const file=await request(`/contents/history.json?ref=${ref.object.sha}`);
  if(file.encoding!=='base64' || file.size>1_000_000) throw Error('Invalid previous history');
  previous=validateHistory(JSON.parse(Buffer.from(file.content,'base64').toString('utf8')));
}
// Always merge with the authoritative branch before writing. A failed anonymous
// history download must never erase older baselines.
const history=mergeHistory(previous,incoming,proposed.checkedAt);
const snapshot=makeSnapshot(history,proposed.checkedAt,Object.fromEntries(proposed.accounts.map(item=>[item.id,item.status])));
const tree=await request('/git/trees','POST',{tree:[
  {path:'history.json',mode:'100644',type:'blob',content:JSON.stringify(history)+'\n'},
  {path:'stats.json',mode:'100644',type:'blob',content:JSON.stringify(snapshot)+'\n'},
]});
const commit=await request('/git/commits','POST',{message:`Update public counters ${proposed.checkedAt.slice(0,10)}`,tree:tree.sha,parents:ref?[ref.object.sha]:[]});
if(ref) await request(`/git/refs/heads/${dataBranch}`,'PATCH',{sha:commit.sha,force:false});
else await request('/git/refs','POST',{ref:`refs/heads/${dataBranch}`,sha:commit.sha});
console.log('Published validated public counters. Site source and links unchanged.');
