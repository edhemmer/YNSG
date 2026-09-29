'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const slides = [
  { src: '/images/senior-neighbor.webp', alt: 'Older neighbor relaxing on a front porch beside a garden', label: 'Seniors' },
  { src: '/images/veteran-neighbor.webp', alt: 'Veteran watering flowers outside a neighborhood home', label: 'Veterans' },
  { src: '/images/single-mom-neighbor.webp', alt: 'Mother and child sitting together on their front porch', label: 'Single moms' },
  { src: '/images/disabled-neighbor.webp', alt: 'Wheelchair user tending plants at an accessible front entry', label: 'People with disabilities' },
] as const;

export function HeroGallery() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || paused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive(index => (index + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused]);

  function move(direction: number) { setActive(index => (index + direction + slides.length) % slides.length); }
  return <div className="gallery" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} aria-label="Illustrative portraits of neighbors we especially serve">
    <div className="gallery-images">{slides.map((slide, index) => <div className={`gallery-slide${index === active ? ' is-active' : ''}`} key={slide.src} aria-hidden={index !== active}><Image src={slide.src} alt={index === active ? slide.alt : ''} fill priority={index === 0} sizes="(max-width: 820px) 100vw, 52vw" /></div>)}</div>
    <div className="gallery-caption"><span>{slides[active].label}</span><div className="gallery-controls"><button type="button" onClick={() => move(-1)} aria-label="Previous picture"><ChevronLeft size={21}/></button><span aria-live="off">{active + 1} / {slides.length}</span><button type="button" onClick={() => move(1)} aria-label="Next picture"><ChevronRight size={21}/></button></div></div>
    <div className="gallery-dots" aria-label="Choose a picture">{slides.map((slide,index)=><button key={slide.src} type="button" className={index===active?'is-active':''} onClick={()=>setActive(index)} aria-label={`Show ${slide.label} picture`} aria-current={index===active?'true':undefined}/>)}</div>
    <p className="gallery-note">Illustrative images</p>
  </div>;
}
