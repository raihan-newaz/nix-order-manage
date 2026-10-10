import { useEffect, useRef, useState } from 'react';

const Flaticon = ({ name, size = 20 }: { name: string; size?: number }) => <i aria-hidden="true" className={`fi fi-rr-${name}`} style={{ fontSize: size, lineHeight: 1 }} />;

export function LandingCarousel({ images, label, ratio }: { images: string[]; label: string; ratio?: string }) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const imageKey = images.join('\u0000');

  useEffect(() => { setIndex(0); }, [imageKey]);
  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % images.length), 4500);
    return () => window.clearInterval(timer);
  }, [imageKey, images.length]);

  const current = Math.min(index, Math.max(0, images.length - 1));
  const go = (direction: number) => setIndex((value) => (value + direction + images.length) % images.length);
  if (!images.length) return <p className="landing-carousel-empty">Images will appear here when added.</p>;

  return <div className="landing-carousel" style={{ aspectRatio: ratio || '4 / 5' }} role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}
    onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); } if (event.key === 'ArrowRight') { event.preventDefault(); go(1); } }}
    onTouchStart={(event) => { startX.current = event.touches[0]?.clientX ?? null; }}
    onTouchEnd={(event) => { if (startX.current === null) return; const distance = (event.changedTouches[0]?.clientX ?? startX.current) - startX.current; if (Math.abs(distance) > 40 && images.length > 1) go(distance < 0 ? 1 : -1); startX.current = null; }}>
    {images.map((src, imageIndex) => <img key={src + imageIndex} src={src} alt={imageIndex === current ? `${label}, image ${imageIndex + 1} of ${images.length}` : ''} aria-hidden={imageIndex !== current} className={imageIndex === current ? 'active' : ''} loading={imageIndex === 0 ? 'eager' : 'lazy'}/>)}
    {images.length > 1 && <><button type="button" className="landing-carousel-arrow previous" onClick={() => go(-1)} aria-label="Previous image"><Flaticon name="angle-small-left" size={23}/></button><button type="button" className="landing-carousel-arrow next" onClick={() => go(1)} aria-label="Next image"><Flaticon name="angle-small-right" size={23}/></button><div className="landing-carousel-dots" aria-label="Choose image">{images.map((_, imageIndex) => <button type="button" key={imageIndex} onClick={() => setIndex(imageIndex)} className={imageIndex === current ? 'active' : ''} aria-label={`Show image ${imageIndex + 1}`} aria-current={imageIndex === current ? 'true' : undefined}/>)}</div><span className="landing-carousel-count" aria-live="polite">{current + 1} / {images.length}</span></>}
  </div>;
}
