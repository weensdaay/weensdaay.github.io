export const accountPairs = Object.freeze({instagram:['science','life'],tiktok:['science','life'],youtube:['science','life','archive','music'],telegram:['main']});
export function attribution(href,referrer='') {
  const params = new URL(href).searchParams;
  const tagged = params.get('utm_source');
  if (Object.hasOwn(accountPairs,tagged)) return {source:tagged,account:accountPairs[tagged].includes(params.get('utm_content')) ? params.get('utm_content') : null};
  let host='';
  try {host=new URL(referrer).hostname.toLowerCase();} catch {}
  const matches=domain=>host===domain||host.endsWith(`.${domain}`);
  const source = matches('instagram.com') ? 'instagram' : matches('tiktok.com') ? 'tiktok' : matches('youtube.com') || matches('youtu.be') ? 'youtube' : matches('t.me') || matches('telegram.org') ? 'telegram' : matches('google.com') ? 'google' : matches('yandex.ru') || matches('yandex.com') ? 'yandex' : !host || matches('weensdaay.github.io') ? 'direct' : 'other';
  return {source,account:null};
}
export function deviceType(userAgent='',touchPoints=0) {
  if (/ipad|tablet/i.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints>1)) return 'tablet';
  if (/iphone|ipod|android.*mobile|windows phone/i.test(userAgent)) return 'mobile';
  if (/android/i.test(userAgent)) return 'tablet';
  return userAgent ? 'desktop' : 'unknown';
}
export function trackingAllowed(navigator,hostname) {
  return hostname==='weensdaay.github.io' && navigator.doNotTrack!=='1' && navigator.globalPrivacyControl!==true && !navigator.webdriver;
}
export const idleLimit=30*60*1000;
export const lifetimeLimit=4*60*60*1000;
export function reusableSession(value,now) {
  return value && /^[0-9a-f-]{36}$/i.test(value.id) && Number.isFinite(value.started) && Number.isFinite(value.touched) && value.started<=now && value.touched<=now && now-value.touched<idleLimit && now-value.started<lifetimeLimit;
}
