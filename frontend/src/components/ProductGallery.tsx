import { useState } from 'react';
import type { Product } from '../types/product';
import Product360Viewer from './Product360Viewer';
import GalleryImage from './GalleryImage';
import { imageUrls, textValue } from '../utils/product';

export default function ProductGallery({ product }: { product: Product }) {
  const images = imageUrls([product.image_url, ...imageUrls(product.images)]);
  const frames = imageUrls([...imageUrls(product.images_360), ...imageUrls(product.view_360)]);
  const has360 = frames.length > 1;
  const [selection, setSelected] = useState<string | null>(null);
  const selected = selection === '360' && has360 ? '360' : images.includes(selection ?? '') ? selection : images[0];
  const name = textValue(product.name) || 'Product';
  return <section className="product-gallery" aria-label="Product gallery">
    {selected === '360' ? <Product360Viewer images_360={frames} image_url={images[0]} name={name} /> :
      <div className="gallery-main"><GalleryImage src={selected || undefined} alt={name} /></div>}
    {(images.length > 1 || has360) && <div className="gallery-thumbnails" role="group" aria-label="Choose product view">
      {images.map((url, index) => <button key={url} aria-label={`View image ${index + 1}`} aria-pressed={selected === url} onClick={() => setSelected(url)}><GalleryImage src={url} alt={`${name}, view ${index + 1}`} /></button>)}
      {has360 && <button className="thumbnail-360" aria-label="Open 360 degree product view" aria-pressed={selected === '360'} onClick={() => setSelected('360')}><span aria-hidden="true">↻</span><strong>360° View</strong></button>}
    </div>}
    <p className="gallery-caption">{selected === '360' ? 'Explore every angle.' : 'A closer look.'}<span>{selected === '360' ? 'Product views' : images.length ? `${images.indexOf(selected || '') + 1} / ${images.length}` : 'No image supplied'}</span></p>
  </section>;
}
