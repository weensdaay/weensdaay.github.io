(() => {
  'use strict';
  const root = document.documentElement;
  const motionButton = document.querySelector('.motion-toggle');
  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userMotionPreference = null;
  try { userMotionPreference = localStorage.getItem('wensday-motion'); } catch {}
  let paused = userMotionPreference === 'paused' || systemReducedMotion.matches;
  const toast = document.querySelector('.toast');
  let toastTimer;
  const announce = message => {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  };
  function applyMotion() {
    root.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    const label = paused ? 'Включить анимацию' : 'Остановить анимацию';
    motionButton.setAttribute('aria-label', label);
    motionButton.title = label;
    document.querySelector('.motion-label').textContent = paused ? 'Без суеты' : 'В движении';
  }
  applyMotion();
  motionButton.addEventListener('click', () => {
    if (systemReducedMotion.matches) {
      announce('Анимация отключена в настройках устройства.');
      return;
    }
    paused = !paused;
    userMotionPreference = paused ? 'paused' : 'play';
    try { localStorage.setItem('wensday-motion', userMotionPreference); } catch {}
    applyMotion();
    announce(paused ? 'Анимация на паузе. Без суеты.' : 'Снова в движении.');
  });
  systemReducedMotion.addEventListener('change', event => {
    paused = event.matches || userMotionPreference === 'paused';
    applyMotion();
  });

  // Nothing is hidden until an observer is successfully available.
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      }
    }, {threshold:0.08, rootMargin:'0px 0px 35px 0px'});
    document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
    root.classList.add('js-motion');
    const dock = document.querySelector('.mobile-dock');
    const dockObserver = new IntersectionObserver(([entry]) => {
      dock.classList.toggle('visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
      dock.inert = !dock.classList.contains('visible');
    }, {threshold:0});
    dock.inert = true;
    dockObserver.observe(document.querySelector('.hero-telegram'));
  }

  const heroArt = document.querySelector('.hero-art');
  const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let animationFrame = 0;
  heroArt.addEventListener('pointermove', event => {
    if (paused || systemReducedMotion.matches || !precisePointer.matches) return;
    cancelAnimationFrame(animationFrame);
    const rect = heroArt.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 11;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 9;
    animationFrame = requestAnimationFrame(() => {
      heroArt.style.setProperty('--px', `${x}px`);
      heroArt.style.setProperty('--py', `${y}px`);
    });
  }, {passive:true});
  heroArt.addEventListener('pointerleave', () => {
    cancelAnimationFrame(animationFrame);
    heroArt.style.setProperty('--px', '0px');
    heroArt.style.setProperty('--py', '0px');
  });

  const dialog = document.querySelector('#soon-dialog');
  let lastOpener;
  document.querySelectorAll('[data-soon]').forEach(button => button.addEventListener('click', () => {
    lastOpener = button;
    const name = button.dataset.soon;
    document.querySelector('#soon-title').textContent = `${name}. Скоро.`;
    document.querySelector('#soon-description').textContent = name === 'Telegram'
      ? 'Здесь будет мой основной Telegram. Пока можно заглянуть в YouTube, Instagram или TikTok.'
      : 'Эта история ещё готовится. Ссылка появится здесь, когда всё будет готово.';
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else announce(`${name} — ссылка появится скоро.`);
  }));
  document.querySelectorAll('.dialog-close,.dialog-action').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => lastOpener?.focus({preventScroll:true}));
  const copyEmail = document.querySelector('[data-copy-email]');
  copyEmail.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copyEmail.dataset.copyEmail);
      announce('Почта скопирована. Буду рад твоей идее.');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('.contact-email span'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      announce('Адрес выделен — скопируй его вручную.');
    }
  });
  // Pause decorative loops in background tabs without storing a preference.
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('motion-paused', paused || document.hidden);
  });
})();
