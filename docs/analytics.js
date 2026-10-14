import settings from './analytics-settings.mjs';
import {attribution,deviceType,trackingAllowed,reusableSession} from './analytics-model.mjs';

const optOutKey='wensday-analytics-opt-out';
const optedOut=()=>{try{return localStorage.getItem(optOutKey)==='1';}catch{return false;}};
const optOutButton=document.querySelector('[data-analytics-opt-out]');
const updatePrivacy=()=>{if(optOutButton){const off=optedOut();optOutButton.setAttribute('aria-pressed',String(off));optOutButton.textContent=off?optOutButton.dataset.disabled:optOutButton.dataset.enabled;}};
updatePrivacy();
optOutButton?.addEventListener('click',()=>{try{localStorage.setItem(optOutKey,optedOut()?'0':'1');sessionStorage.removeItem('wensday-visit-v1');}catch{}updatePrivacy();});

// No cookies, fingerprinting, identity, screen recording or arbitrary text/URLs.
// All analytics failures stay independent of the site's navigation.
if (!optedOut() && settings.endpoint && trackingAllowed(navigator,location.hostname)) {
  await window.wensdayLocaleReady;
  if (!document.documentElement.dataset.localeRedirect) {
    const storageKey='wensday-visit-v1';
    const originAttribution=attribution(location.href,document.referrer);
    const device=deviceType(navigator.userAgent,navigator.maxTouchPoints);
    let session,queue=[],timer;
    try {session=JSON.parse(sessionStorage.getItem(storageKey));} catch {}
    const save=()=>{try {sessionStorage.setItem(storageKey,JSON.stringify(session));} catch {}};
    const page=location.pathname==='/en/' ? '/en/' : '/';
    function activeSession() {
      const now=Date.now();
      if (!reusableSession(session,now)) session={id:crypto.randomUUID(),started:now,touched:now,...originAttribution};
      session.touched=now;save();return session;
    }
    function flush() {
      clearTimeout(timer);
      if (optedOut() || navigator.doNotTrack==='1' || navigator.globalPrivacyControl===true) {queue=[];return;}
      if (!queue.length) return;
      // Every event carries its own captured session; never mix after inactivity.
      const first=queue[0];
      const events=[];
      while(queue.length && queue[0].sessionId===first.sessionId && events.length<16) events.push(queue.shift().event);
      const payload={sessionId:first.sessionId,source:first.source,account:first.account,device,events};
      fetch(settings.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,signal:AbortSignal.timeout(7000)})
        .catch(()=>{});
      if(queue.length)flush();
    }
    function record(type,target) {
      if (optedOut()||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true) {queue=[];return;}
      const current=activeSession();
      const event={id:crypto.randomUUID(),type,page,...(target?{target}:{})};
      queue.push({sessionId:current.id,source:current.source,account:current.account,event});
      if(queue.length>32)queue.splice(0,queue.length-32);
      clearTimeout(timer);timer=setTimeout(flush,600);
    }
    const once=new Set();
    const actionOnce=target=>{if(!once.has(target)){once.add(target);record('action',target);}};
    const start=()=>{if(document.visibilityState==='visible'){record('pageview');document.removeEventListener('visibilitychange',start);}};
    if(document.visibilityState==='visible')start();
    else document.addEventListener('visibilitychange',start);
    document.addEventListener('click',event=>{
      const element=event.target.closest('a,button');
      if(!element)return;
      if(element.dataset.track) {record('click',element.dataset.track);flush();}
      else if(element.dataset.lang) {record('action',`language-${element.dataset.lang}`);flush();}
      else if(element.dataset.slide) record('action',element.dataset.slide==='1'?'gallery-next':'gallery-previous');
      else if(element.dataset.quickStep) actionOnce('links-scroll');
      else if(element.dataset.copyEmail) record('action','copy-email');
    },{capture:true});
    if ('IntersectionObserver' in window) {
      const sections=new IntersectionObserver(entries=>{
        for(const entry of entries) if(entry.isIntersecting && document.visibilityState==='visible') {
          actionOnce(`section-${entry.target.id==='numbers'?'stats':entry.target.id}`);sections.unobserve(entry.target);
        }
      },{threshold:.2});
      for(const id of ['science','life','music','projects','numbers']) {const node=document.getElementById(id);if(node)sections.observe(node);}
    }
    let scrollPending=false;
    window.addEventListener('scroll',()=>{
      if(scrollPending)return;scrollPending=true;
      requestAnimationFrame(()=>{
        scrollPending=false;
        const available=document.documentElement.scrollHeight-innerHeight;
        if(available<1)return;
        const percent=Math.min(100,Math.round(scrollY/available*100));
        for(const milestone of [25,50,75,100])if(percent>=milestone)actionOnce(`scroll-${milestone}`);
      });
    },{passive:true});
    window.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
  }
}
