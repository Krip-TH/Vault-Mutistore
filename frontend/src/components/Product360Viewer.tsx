import { useEffect, useMemo, useRef, useState } from 'react';
import GalleryImage from './GalleryImage';
import { imageUrls } from '../utils/product';

interface Props { images_360?: string[]; image_url?: string; name: string }

export default function Product360Viewer(props: Props) {
  const urls = useMemo(() => imageUrls(props.images_360), [props.images_360]);
  return <SequenceViewer key={JSON.stringify(urls)} {...props} urls={urls} />;
}

function SequenceViewer({ urls, image_url, name }: Props & { urls: string[] }) {
  const [frames, setFrames] = useState<string[]>([]);
  const [loading, setLoading] = useState(urls.length > 1);
  const [frame, setFrame] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; frame: number } | null>(null);
  const pendingFrame = useRef(0);
  const animation = useRef<number | null>(null);
  useEffect(() => {
    if (urls.length < 2) return;
    let cancelled = false;
    let next = 0;
    const successful = new Set<string>();
    const pending = new Set<() => void>();
    // Four concurrent requests keep a large sequence from flooding the network.
    async function worker() {
      while (!cancelled && next < urls.length) {
        const url = urls[next++];
        const ok = await new Promise<boolean>(resolve => {
          const img = new Image();
          const cancel = () => finish(false);
          const timeout = window.setTimeout(cancel, 10000);
          function finish(ok: boolean) {
            window.clearTimeout(timeout);
            img.onload = null;
            img.onerror = null;
            pending.delete(cancel);
            resolve(ok);
          }
          pending.add(cancel);
          img.onload = () => finish(img.naturalWidth > 0);
          img.onerror = cancel;
          img.src = url;
        });
        if (!cancelled && ok) successful.add(url);
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker)).then(() => {
      if (!cancelled) { setFrames(urls.filter(url => successful.has(url))); setLoading(false); }
    });
    return () => {
      cancelled = true;
      pending.forEach(cancel => cancel());
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      animation.current = null;
    };
  }, [urls]);
  const canRotate = frames.length > 1;
  const index = canRotate ? ((frame % frames.length) + frames.length) % frames.length : 0;
  const rotate = (delta: number) => setFrame(current => (current + delta + frames.length) % frames.length);
  function finishDrag() {
    if (animation.current !== null) {
      cancelAnimationFrame(animation.current);
      animation.current = null;
      setFrame(pendingFrame.current);
    }
    drag.current = null;
    setDragging(false);
  }
  return <div className="viewer-shell">
    <div className={`viewer-surface ${canRotate ? 'rotatable' : ''} ${dragging ? 'dragging' : ''}`}
      tabIndex={canRotate ? 0 : undefined} role={canRotate ? 'group' : undefined}
      aria-label={canRotate ? `${name}, 360 degree view. Use left and right arrow keys to rotate.` : undefined}
      onKeyDown={event => {
        if (canRotate && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); rotate(event.key === 'ArrowRight' ? 1 : -1); }
      }}
      onPointerDown={event => {
        if (!canRotate || !event.isPrimary || event.button !== 0) return;
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, frame: index };
        setDragging(true);
      }}
      onPointerMove={event => {
        if (drag.current?.id !== event.pointerId) return;
        const nextFrame = drag.current.frame + Math.round((event.clientX - drag.current.x) / 8);
        pendingFrame.current = ((nextFrame % frames.length) + frames.length) % frames.length;
        // Render at most once per animation frame, even on high-frequency pointers.
        if (animation.current === null) animation.current = requestAnimationFrame(() => { setFrame(pendingFrame.current); animation.current = null; });
      }}
      onPointerUp={event => { finishDrag(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
      {canRotate ? <img src={frames[index]} alt={`${name}, angle ${index + 1} of ${frames.length}`} draggable={false}
        onError={() => { setFrames(current => current.filter(url => url !== frames[index])); finishDrag(); }} /> :
        <GalleryImage src={image_url || frames[0] || (urls.length === 1 ? urls[0] : undefined)} alt={name} />}
      {canRotate && <span className="viewer-label">360° View</span>}
    </div>
    {canRotate ? <div className="rotation-controls"><button aria-label="Rotate left" onClick={() => rotate(-1)}>←</button><div><span>Drag to rotate</span><div className="rotation-track" aria-hidden="true"><i style={{ left: `${index / frames.length * 100}%` }} /></div><span className="rotation-caption">360°</span></div><button aria-label="Rotate right" onClick={() => rotate(1)}>→</button></div> :
      urls.length > 1 && <p className="viewer-feedback" role="status">{loading ? 'Loading product views…' : '360° view unavailable. Showing the product image.'}</p>}
  </div>;
}
