// Three-second rotation; customer control always takes precedence.
export function initNeighborCarousel(root, env = window) {
  const slides = [...root.querySelectorAll('.neighbor-slide')];
  if (slides.length < 2) return;
  const controls = root.querySelector('.carousel-controls');
  const pages = [...root.querySelectorAll('[data-slide]')];
  const pause = root.querySelector('[data-carousel="pause"]');
  const live = root.querySelector('.neighbor-slides');
  const motion = env.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, paused = motion.matches, timer, touchX;
  // Layer complete figures in one grid cell. Opacity can crossfade without
  // hiding the outgoing image or shifting the caption/photo frame.
  live.classList.add('fade-ready');
  function selectSlide(slide, active) {
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
    slide.inert = !active;
    slide.hidden = false;
  }
  slides.forEach((slide, i) => selectSlide(slide, i === index));
  function syncTimer() {
    env.clearInterval(timer);
    timer = undefined;
    if (!paused && !document.hidden) timer = env.setInterval(() => show(index + 1), 5000);
    pause.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
    pause.querySelector('[data-play-symbol]').textContent = paused ? '▶' : 'Ⅱ';
    live.setAttribute('aria-live', paused ? 'polite' : 'off');
  }
  function warmNext() {
    const next = slides[(index + 1) % slides.length].querySelector('img');
    next.loading = 'eager';
    if (next.decode) void next.decode().catch(() => {});
  }
  function show(next) {
    const candidate = slides[(next + slides.length) % slides.length].querySelector('img');
    if (!candidate.complete || candidate.naturalWidth === 0) { candidate.loading = 'eager'; return; }
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => selectSlide(slide, i === index));
    pages.forEach((page, i) => page.setAttribute('aria-current', String(i === index)));
    warmNext();
  }
  function manual(next) { paused = true; show(next); syncTimer(); }
  controls.hidden = false;
  pages.forEach(page => page.addEventListener('click', () => manual(Number(page.dataset.slide))));
  root.querySelector('[data-carousel="previous"]')?.addEventListener('click', () => manual(index - 1));
  root.querySelector('[data-carousel="next"]')?.addEventListener('click', () => manual(index + 1));
  pause.addEventListener('click', () => { paused = !paused; syncTimer(); });
  root.addEventListener('focusin', event => { if (event.target !== pause) { paused = true; syncTimer(); } });
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); manual(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  root.addEventListener('touchstart', event => { touchX = event.touches[0]?.clientX; }, {passive:true});
  root.addEventListener('touchend', event => {
    const delta = event.changedTouches[0]?.clientX - touchX;
    if (Math.abs(delta) > 45) manual(index + (delta < 0 ? 1 : -1));
    touchX = undefined;
  }, {passive:true});
  document.addEventListener('visibilitychange', syncTimer);
  motion.addEventListener('change', () => { paused = motion.matches; syncTimer(); });
  warmNext(); syncTimer();
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-neighbor-carousel]').forEach(root => initNeighborCarousel(root));
