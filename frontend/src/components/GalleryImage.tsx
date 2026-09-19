import { useState } from 'react';

export default function GalleryImage({ src, alt }: { src?: string; alt: string }) {
  // Keying only this image's loading state also handles cached images and source changes.
  return <ImageState key={src || 'missing'} src={src} alt={alt} />;
}

function ImageState({ src, alt }: { src?: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(src ? 'loading' : 'failed');
  return <div className={`gallery-image-frame is-${state}`} aria-busy={state === 'loading'}>
    {state !== 'ready' && <div className="image-fallback" role={state === 'failed' ? 'img' : 'status'} aria-label={state === 'failed' ? `Image unavailable for ${alt}` : `Loading image for ${alt}`}>
      <span className="fallback-mark" aria-hidden="true">m.</span><span>{state === 'loading' ? 'Loading image…' : 'Image unavailable'}</span>
    </div>}
    {src && state !== 'failed' && <img src={src} alt={alt} draggable={false}
      ref={image => { if (state === 'loading' && image?.complete) setState(image.naturalWidth > 0 ? 'ready' : 'failed'); }}
      onLoad={() => setState('ready')} onError={() => setState('failed')} />}
  </div>;
}
