import { useEffect, useMemo, useState } from 'react';
import { createAdminProduct, deleteAdminProduct, fetchAdminProduct, fetchAdminProductOptions, fetchAdminProducts, updateAdminProduct, uploadAdminProductImage } from '../admin/adminApi';
import type { AdminProduct, AdminProductInput, ProductOptions } from '../types/admin';

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' });
const empty: AdminProductInput = { business: '', name: '', category: '', price: 0, stock: 0, unit: 'pcs', image_url: '' };

export function productInputForBusiness(value: AdminProductInput, business: string): AdminProductInput {
  return { ...value, business, category: '' };
}

const productBusiness = (product: AdminProduct) => product.management === 'vault' ? product.catalog_business || 'vault' : product.business;
const productBusinessName = (product: AdminProduct) => product.management === 'vault' ? product.catalog_business_name || 'Unassigned' : product.business_name;

export default function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [options, setOptions] = useState<ProductOptions>({ businesses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [business, setBusiness] = useState('all');
  const [stock, setStock] = useState('all');
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { const [nextProducts, nextOptions] = await Promise.all([fetchAdminProducts(), fetchAdminProductOptions()]); setProducts(nextProducts); setOptions(nextOptions); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load products.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const businesses = useMemo(() => options.businesses.map(item => [item.id, item.name] as const), [options]);
  const filtered = useMemo(() => products.filter(product => {
    const query = search.trim().toLowerCase();
    return (!query || `${product.name} ${product.category}`.toLowerCase().includes(query))
      && (business === 'all' || productBusiness(product) === business)
      && (stock === 'all' || product.status === stock);
  }), [business, products, search, stock]);

  async function open(product: AdminProduct) {
    setError('');
    try { setSelected(await fetchAdminProduct(product.business, product.id)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load this product.'); }
  }
  async function remove(product: AdminProduct) {
    if (!product.can_delete || !window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    try { await deleteAdminProduct(product); setProducts(current => current.filter(item => !(item.business === product.business && item.id === product.id))); setSelected(null); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to delete the product.'); }
  }

  if (loading) return <div className="admin-state" role="status"><span>V.</span><h3>Loading products…</h3></div>;
  return <div className="admin-content">
    {error && <p className="admin-product-error" role="alert">{error} <button onClick={() => void load()}>Retry</button></p>}
    {selected ? <ProductDetail product={selected} onBack={() => setSelected(null)} onEdit={() => setEditing(selected)} onDelete={() => void remove(selected)} /> : <>
      <div className="admin-product-toolbar">
        <div><p className="eyebrow">CATALOG MANAGEMENT</p><h3>All products</h3><p>External products are visible but remain managed by their source business.</p></div>
        <button className="primary-button" onClick={() => setEditing('new')}>Add Product</button>
      </div>
      <div className="admin-product-filters">
        <label><span>Search</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or category" /></label>
        <label><span>Business</span><select value={business} onChange={event => setBusiness(event.target.value)}><option value="all">All businesses</option>{businesses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Stock status</span><select value={stock} onChange={event => setStock(event.target.value)}><option value="all">All stock statuses</option><option>In Stock</option><option>Low Stock</option><option>Out of Stock</option></select></label>
      </div>
      <section className="admin-section"><div className="admin-section-heading"><div><p className="eyebrow">INVENTORY</p><h3>Product list</h3></div><span>{filtered.length} products</span></div>
        {!filtered.length ? <div className="admin-empty"><span>V.</span><h4>No matching products.</h4></div> : <div className="admin-table-wrap"><table className="admin-table admin-product-table"><thead><tr><th>Product</th><th>Business</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map(product => <tr key={`${product.business}-${product.id}`}><td><div className="admin-product-name"><ProductThumb product={product} /><div><strong>{product.name}</strong><small>#{product.id}</small></div></div></td><td>{productBusinessName(product)}<small>{product.management === 'external' ? 'Externally managed' : 'VAULT managed'}</small></td><td>{product.category}</td><td>{money.format(product.price)}</td><td>{product.stock} {product.unit}</td><td><span className={`order-status ${product.status === 'Out of Stock' ? 'status-cancelled' : product.status === 'Low Stock' ? 'status-pending' : ''}`}>{product.status}</span></td><td><div className="admin-row-actions"><button onClick={() => void open(product)}>Open</button><button disabled={!product.can_edit} title={!product.can_edit ? 'Managed by the source business' : ''} onClick={() => setEditing(product)}>Edit</button><button disabled={!product.can_delete} title={!product.can_delete ? 'Managed by the source business' : ''} onClick={() => void remove(product)}>Delete</button></div></td></tr>)}</tbody></table></div>}
      </section>
    </>}
    {editing && <ProductForm product={editing === 'new' ? null : editing} options={options} onClose={() => setEditing(null)} onSaved={product => { setProducts(current => editing === 'new' ? [product, ...current] : current.map(item => item.business === product.business && item.id === product.id ? product : item)); setSelected(product); setEditing(null); }} />}
  </div>;
}

function ProductThumb({ product }: { product: AdminProduct }) {
  const [failed, setFailed] = useState(false);
  return <div className="admin-product-thumb">{product.image_url && !failed ? <img src={product.image_url} alt="" onError={() => setFailed(true)} /> : <span>V.</span>}</div>;
}

function ProductDetail({ product, onBack, onEdit, onDelete }: { product: AdminProduct; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  return <><button className="admin-back" onClick={onBack}>← All products</button><section className="admin-product-detail admin-section"><ProductThumb product={product} /><div><p className="eyebrow">{productBusinessName(product)} · {product.management === 'external' ? 'EXTERNALLY MANAGED' : 'VAULT MANAGED'}</p><h3>{product.name}</h3><p>{product.category}</p><dl><div><dt>Price</dt><dd>{money.format(product.price)}</dd></div><div><dt>Stock</dt><dd>{product.stock} {product.unit}</dd></div><div><dt>Status</dt><dd>{product.status}</dd></div></dl>{product.management === 'external' && <p className="admin-readonly-note">This product is read-only in VAULT. Update it in {product.business_name}’s source system.</p>}<div className="admin-row-actions"><button disabled={!product.can_edit} onClick={onEdit}>Edit</button><button disabled={!product.can_delete} onClick={onDelete}>Delete</button></div></div></section></>;
}

function ProductForm({ product, options, onClose, onSaved }: { product: AdminProduct | null; options: ProductOptions; onClose: () => void; onSaved: (product: AdminProduct) => void }) {
  const [value, setValue] = useState<AdminProductInput>(product ? { business: product.catalog_business || '', name: product.name, category: product.category, price: product.price, stock: product.stock, unit: product.unit, image_url: product.image_url } : empty);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>(product?.image_url.startsWith('/uploads/products/') ? 'upload' : 'url');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const categoryOptions = options.businesses.find(item => item.id === value.business)?.categories || [];
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);
  function field<K extends keyof AdminProductInput>(key: K, next: AdminProductInput[K]) { setValue(current => ({ ...current, [key]: next })); }
  function chooseFile(next: File | undefined) {
    setError(''); setPreviewFailed(false);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null); setFilePreview('');
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Choose a JPEG, PNG, or WEBP image.'); return; }
    if (next.size > 5 * 1024 * 1024) { setError('Image files must be 5 MB or smaller.'); return; }
    setFile(next); setFilePreview(URL.createObjectURL(next));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (imageMode === 'url' && value.image_url && !/^https?:\/\//i.test(value.image_url)) throw new Error('Enter a valid HTTP or HTTPS image URL.');
      const image_url = imageMode === 'upload' && file ? await uploadAdminProductImage(file) : value.image_url;
      const input = { ...value, image_url };
      onSaved(product ? await updateAdminProduct(product, input) : await createAdminProduct(input));
    }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to save the product.'); }
    finally { setSaving(false); }
  }
  const preview = filePreview || value.image_url;
  return <div className="admin-form-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form className="admin-product-form" onSubmit={event => void submit(event)}><div><p className="eyebrow">VAULT MANAGED</p><h3>{product ? 'Edit product' : 'Add product'}</h3><button type="button" onClick={onClose} aria-label="Close">×</button></div><label>Name<input required maxLength={255} value={value.name} onChange={event => field('name', event.target.value)} /></label><label>Business<select required value={value.business} onChange={event => setValue(current => productInputForBusiness(current, event.target.value))}><option value="">Select business</option>{options.businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Category<select required disabled={!value.business || !categoryOptions.length} value={value.category} onChange={event => field('category', event.target.value)}><option value="">{!value.business ? 'Select a business first' : categoryOptions.length ? 'Select category' : 'No categories available'}</option>{categoryOptions.map(category => <option key={category} value={category}>{category}</option>)}</select></label>{value.business && !categoryOptions.length && <p className="admin-form-hint">No category data is currently available for this business. Products cannot be created until its catalog or cache provides a category.</p>}<div className="admin-form-row"><label>Price<input required min="0" step="0.01" type="number" value={value.price} onChange={event => field('price', Number(event.target.value))} /></label><label>Stock<input required min="0" step="1" type="number" value={value.stock} onChange={event => field('stock', Number(event.target.value))} /></label></div><label>Unit<input required maxLength={50} value={value.unit} onChange={event => field('unit', event.target.value)} /></label>
    <fieldset className="admin-image-field"><legend>Product image</legend><div className="admin-image-modes"><button type="button" className={imageMode === 'url' ? 'is-active' : ''} onClick={() => { setImageMode('url'); if (value.image_url.startsWith('/uploads/')) field('image_url', ''); setError(''); }}>Image URL</button><button type="button" className={imageMode === 'upload' ? 'is-active' : ''} onClick={() => { setImageMode('upload'); setError(''); }}>Upload from device</button></div>
      {imageMode === 'url' ? <label>Image URL<input type="url" maxLength={2048} value={value.image_url.startsWith('/uploads/') ? '' : value.image_url} onChange={event => { field('image_url', event.target.value); setPreviewFailed(false); }} placeholder="https://example.com/image.jpg" /></label> : <div className="admin-file-input"><label className="secondary-button">Choose image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseFile(event.target.files?.[0])} /></label><span>{file?.name || (value.image_url.startsWith('/uploads/products/') ? 'Current uploaded image' : 'No file selected')}</span>{file && <button type="button" onClick={() => chooseFile(undefined)}>Remove selection</button>}<small>JPEG, PNG, or WEBP · maximum 5 MB</small></div>}
      {preview && !previewFailed ? <img className="admin-image-preview" src={preview} alt="Product preview" onError={() => setPreviewFailed(true)} /> : <div className="admin-image-preview is-fallback"><span>V.</span><small>{previewFailed ? 'Image preview unavailable' : 'No image selected'}</small></div>}
    </fieldset>{error && <p className="admin-product-error" role="alert">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? imageMode === 'upload' && file ? 'Uploading…' : 'Saving…' : product ? 'Save changes' : 'Create product'}</button></form></div>;
}
