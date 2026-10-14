(() => {
  'use strict';
  const current = document.documentElement.lang;
  const choices = new Set(['ru','en']);
  const read = (storage,key) => { try { return window[storage].getItem(key); } catch { return null; } };
  const write = (storage,key,value) => { try { window[storage].setItem(key,value); } catch {} };
  const go = language => {
    if (!choices.has(language) || language === current) return;
    const target = new URL(language === 'en' ? '/en/' : '/', location.origin);
    target.hash = location.hash;
    // Only our two static pages are ever used as redirect destinations.
    location.replace(target.href);
  };
  const requested = new URL(location.href).searchParams.get('lang');
  if (choices.has(requested)) write('localStorage','wensday-language',requested);
  document.querySelectorAll('[data-lang]').forEach(link => {
    if (link.dataset.lang === current) link.setAttribute('aria-current','page');
    link.addEventListener('click',() => write('localStorage','wensday-language',link.dataset.lang));
  });
  if (choices.has(requested)) { go(requested); return; }
  // An explicit /en/ URL remains shareable even for a Russian-language visitor.
  if (current === 'en') return;
  const saved = read('localStorage','wensday-language');
  if (choices.has(saved)) { go(saved); return; }
  const cached = read('sessionStorage','wensday-auto-language');
  if (choices.has(cached)) { go(cached); return; }
  const languages = navigator.languages || [navigator.language || 'en'];
  const fallback = languages.some(language => /^(ru|be|uk|kk|ky|uz|tg|hy|az|tk|ka)(-|$)/i.test(language)) ? 'ru' : 'en';
  const russianCountries = new Set(['RU','BY','UA','KZ','KG','UZ','TJ','TM','AM','AZ','MD','GE']);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(),1800);
  fetch('https://api.country.is/',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'})
    .then(response => { if (!response.ok) throw new Error('Country unavailable'); return response.json(); })
    .then(data => /^[A-Z]{2}$/.test(data.country) ? (russianCountries.has(data.country) ? 'ru' : 'en') : fallback)
    .catch(() => fallback)
    .then(language => {
      // A manual choice made while the request was pending always wins.
      if (choices.has(read('localStorage','wensday-language'))) return;
      write('sessionStorage','wensday-auto-language',language);
      go(language);
    })
    .finally(() => clearTimeout(deadline));
})();
