(() => {
  'use strict';
  const root = document.documentElement;
  const english = root.lang === 'en';
  const text = (ru, en) => english ? en : ru;
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
    const label = paused ? text('Включить анимацию','Turn motion on') : text('Остановить анимацию','Pause motion');
    motionButton.setAttribute('aria-label', label);
    motionButton.title = label;
    document.querySelector('.motion-label').textContent = paused ? text('Без суеты','Motion paused') : text('В движении','In motion');
  }
  applyMotion();
  motionButton.addEventListener('click', () => {
    if (systemReducedMotion.matches) {
      announce(text('Анимация отключена в настройках устройства.','Motion is disabled in your device settings.'));
      return;
    }
    paused = !paused;
    userMotionPreference = paused ? 'paused' : 'play';
    try { localStorage.setItem('wensday-motion', userMotionPreference); } catch {}
    applyMotion();
    announce(paused ? text('Анимация на паузе. Без суеты.','Motion paused. Take your time.') : text('Снова в движении.','Back in motion.'));
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
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-soon]');
    if (!button) return;
    lastOpener = button;
    const name = button.dataset.soon;
    document.querySelector('#soon-title').textContent = `${name}. ${text('Скоро.','Coming soon.')}`;
    document.querySelector('#soon-description').textContent = name === 'Telegram'
      ? text('Здесь будет мой основной Telegram. Пока можно заглянуть в YouTube, Instagram или TikTok.','My main Telegram will be here. In the meantime, explore YouTube, Instagram or TikTok.')
      : text('Эта история ещё готовится. Ссылка появится здесь, когда всё будет готово.','This story is still taking shape. The link will appear here when it is ready.');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else announce(`${name} — ${text('ссылка появится скоро.','coming soon.')}`);
  });
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
      announce(text('Почта скопирована. Буду рад твоей идее.','Email copied. I’d love to hear your idea.'));
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('.contact-email span'));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      announce(text('Адрес выделен — скопируй его вручную.','Address selected — copy it manually.'));
    }
  });

  // Fetch just the next local picture when it is needed, never the whole gallery.
  document.querySelectorAll('[data-gallery]').forEach(gallery => {
    const slides = [...gallery.querySelectorAll('.media-slide')];
    if (slides.length < 2) return;
    const interval = Number(gallery.dataset.interval) || 6500;
    let index = 0, elapsed = 0, visible = false, busy = false, hover = false, holdUntil = 0;
    const canRun = () => !paused && !document.hidden && visible && !hover && !gallery.contains(document.activeElement) && !dialog.open;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, {threshold:.1});
      observer.observe(gallery);
    } else visible = true;
    gallery.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hover = true; });
    gallery.addEventListener('pointerleave', () => { hover = false; });
    async function show(step, manual = false) {
      if (busy || (!manual && !canRun())) return;
      busy = true;
      const next = (index + step + slides.length) % slides.length;
      const slide = slides[next];
      const img = slide.querySelector('img');
      try {
        if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
        await img.decode();
        if (!manual && !canRun()) return;
        slides[index].classList.remove('is-active');
        slides[index].setAttribute('aria-hidden','true');
        slides[index].inert = true;
        slide.classList.add('is-active');
        slide.removeAttribute('aria-hidden');
        slide.inert = false;
        index = next;
        gallery.dataset.current = String(index);
        const count = gallery.querySelector('.gallery-count');
        if (count) count.textContent = `${String(index + 1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
        if (manual) {
          holdUntil = performance.now() + interval * 2;
          gallery.querySelector('.gallery-status').textContent = `${index + 1} / ${slides.length}: ${slide.dataset.title}`;
        }
      } catch { /* Keep the current image when a new asset fails to load. */ }
      finally { busy = false; elapsed = 0; }
    }
    gallery.querySelectorAll('[data-slide]').forEach(button => button.addEventListener('click', () => show(Number(button.dataset.slide),true)));
    setInterval(() => {
      if (!canRun() || performance.now() < holdUntil) return;
      elapsed += 500;
      if (elapsed >= interval) show(1);
    },500);
  });

  const ribbon = document.querySelector('.quick-viewport');
  if (ribbon) {
    const track = ribbon.querySelector('.quick-track');
    const group = track.querySelector('.quick-group');
    const chips = [...group.children];
    for (let i = chips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chips[i], chips[j]] = [chips[j], chips[i]];
    }
    group.replaceChildren(...chips);
    for (const before of [true,false]) {
      const copy = group.cloneNode(true);
      copy.setAttribute('aria-hidden','true');
      copy.querySelectorAll('a,button').forEach(link => { link.tabIndex = -1; link.draggable = false; });
      if (before) track.prepend(copy); else track.append(copy);
    }
    group.querySelectorAll('a').forEach(link => { link.draggable = false; });
    let span = 0, hover = false, visible = false, touching = false, dragged = false;
    let floatPosition = null;
    let holdUntil = 0, last = 0, startX = 0, startScroll = 0, pointer = null;
    const measure = () => {
      const oldSpan = span;
      span = group.offsetLeft - track.firstElementChild.offsetLeft;
      floatPosition = null;
      ribbon.scrollLeft = span + (oldSpan ? ((ribbon.scrollLeft - oldSpan) % oldSpan + oldSpan) % oldSpan : 0);
    };
    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(group);
    if ('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;},{threshold:0}).observe(ribbon);
    else visible=true;
    const hold = () => { holdUntil = performance.now() + 4000; };
    ribbon.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse') hover=true;});
    ribbon.addEventListener('pointerleave',()=>{hover=false;});
    ribbon.addEventListener('pointerdown',event=>{
      hold(); dragged=false; touching=true;
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      pointer=event.pointerId; startX=event.clientX; startScroll=ribbon.scrollLeft;
    });
    ribbon.addEventListener('pointermove',event=>{
      if(pointer!==event.pointerId) return;
      const distance=event.clientX-startX;
      if(Math.abs(distance)>7 && !dragged){dragged=true;ribbon.setPointerCapture(pointer);ribbon.classList.add('is-dragging');}
      if(dragged){ribbon.scrollLeft=startScroll-distance;event.preventDefault();}
    });
    const release=()=>{touching=false;pointer=null;ribbon.classList.remove('is-dragging');hold();};
    window.addEventListener('pointerup',release);
    ribbon.addEventListener('pointercancel',release);
    ribbon.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopPropagation();dragged=false;}},true);
    ribbon.addEventListener('wheel',hold,{passive:true});
    ribbon.addEventListener('keydown',event=>{
      if(event.target !== ribbon || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault(); hold(); ribbon.scrollLeft += event.key==='ArrowRight' ? 250 : -250;
    });
    document.querySelectorAll('[data-quick-step]').forEach(button=>button.addEventListener('click',()=>{
      hold(); ribbon.scrollLeft += Number(button.dataset.quickStep) * Math.min(360,ribbon.clientWidth*.8);
    }));
    function tick(now) {
      const delta=last ? Math.min(now-last,50) : 0;
      last=now;
      const focused=ribbon.contains(document.activeElement);
      if(span && !(focused && document.activeElement !== ribbon) && !touching){
        if(ribbon.scrollLeft<span*.5) { ribbon.scrollLeft+=span; floatPosition=null; }
        else if(ribbon.scrollLeft>span*1.5) { ribbon.scrollLeft-=span; floatPosition=null; }
      }
      if(visible && !paused && !document.hidden && !hover && !focused && !touching && !dialog.open && now>holdUntil) {
        floatPosition = (floatPosition ?? ribbon.scrollLeft) + delta*.027;
        ribbon.scrollLeft=floatPosition;
      } else floatPosition=null;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Pause decorative loops in background tabs without storing a preference.
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('motion-paused', paused || document.hidden);
  });
})();
