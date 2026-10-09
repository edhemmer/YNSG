// Four-second rotation; customer control always takes precedence.
export function initNeighborCarousel(root, env = window) {
  const slides = [...root.querySelectorAll('.neighbor-slide')];
  if (slides.length < 2) return;
  const controls = root.querySelector('.carousel-controls');
  const pages = [...root.querySelectorAll('[data-slide]')];
  const pause = root.querySelector('[data-carousel="pause"]');
  const live = root.querySelector('.neighbor-slides');
  const motion = env.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, paused = motion.matches, hovered = false, timer, touchX;
  function syncTimer() {
    env.clearInterval(timer);
    timer = undefined;
    if (!paused && !hovered && !document.hidden) timer = env.setInterval(() => show(index + 1), 4000);
    pause.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
    pause.querySelector('[data-play-symbol]').textContent = paused ? '▶' : 'Ⅱ';
    live.setAttribute('aria-live', paused ? 'polite' : 'off');
  }
  function show(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== index; });
    pages.forEach((page, i) => page.setAttribute('aria-current', String(i === index)));
  }
  function manual(next) { paused = true; show(next); syncTimer(); }
  controls.hidden = false;
  pages.forEach(page => page.addEventListener('click', () => manual(Number(page.dataset.slide))));
  root.querySelector('[data-carousel="previous"]').addEventListener('click', () => manual(index - 1));
  root.querySelector('[data-carousel="next"]').addEventListener('click', () => manual(index + 1));
  pause.addEventListener('click', () => { paused = !paused; syncTimer(); });
  root.addEventListener('focusin', event => { if (event.target !== pause) { paused = true; syncTimer(); } });
  root.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; syncTimer(); } });
  root.addEventListener('pointerleave', () => { hovered = false; syncTimer(); });
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
  show(0); syncTimer();
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-neighbor-carousel]').forEach(root => initNeighborCarousel(root));
