import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import type { ExternalBusinessType, NormalizedProduct, ProductInput } from '../types/product.js';
import { getStockStatus } from '../utils/stockStatus.js';

interface ProductRow extends RowDataPacket {
  id: number; name: string; category: string; price: number; stock: number;
  unit: string; image_url: string | null; updated_at: Date;
  business_key: ExternalBusinessType | null;
}

export interface CategorySourceRow { business_key: string; business_name: string; category: string }

export interface ProductRepository {
  list(): Promise<NormalizedProduct[]>;
  findById(id: string): Promise<NormalizedProduct | null>;
  create(input: ProductInput): Promise<NormalizedProduct>;
  update(id: string, input: ProductInput): Promise<NormalizedProduct | null>;
  delete(id: string): Promise<boolean>;
  listCategorySources(): Promise<CategorySourceRow[]>;
}

function mapProduct(row: ProductRow): NormalizedProduct {
  return {
    id: String(row.id), business: 'vault', business_name: 'VAULT', name: row.name,
    category: row.category, price: Number(row.price), stock: Number(row.stock), unit: row.unit,
    status: getStockStatus(Number(row.stock)), image_url: row.image_url || '',
    updated_at: new Date(row.updated_at).toISOString(),
    catalog_business: row.business_key,
  };
}

export const productRepository: ProductRepository = {
  async list() {
    const [rows] = await pool.query<ProductRow[]>('SELECT * FROM vault_products ORDER BY updated_at DESC, id DESC');
    return rows.map(mapProduct);
  },
  async findById(id) {
    const [rows] = await pool.execute<ProductRow[]>('SELECT * FROM vault_products WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? mapProduct(rows[0]) : null;
  },
  async create(input) {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO vault_products (business_key, name, category, price, stock, unit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input.business, input.name, input.category, input.price, input.stock, input.unit, input.image_url || null],
    );
    return (await this.findById(String(result.insertId)))!;
  },
  async update(id, input) {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE vault_products SET business_key = ?, name = ?, category = ?, price = ?, stock = ?, unit = ?, image_url = ? WHERE id = ?',
      [input.business, input.name, input.category, input.price, input.stock, input.unit, input.image_url || null, id],
    );
    return result.affectedRows ? this.findById(id) : null;
  },
  async delete(id) {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM vault_products WHERE id = ?', [id]);
    return result.affectedRows === 1;
  },
  async listCategorySources() {
    const [rows] = await pool.query<(RowDataPacket & CategorySourceRow)[]>(`SELECT b.business_type AS business_key, b.name AS business_name, pc.category
      FROM products_cache pc JOIN businesses b ON b.id = pc.business_id
      WHERE TRIM(pc.category) <> ''
      UNION ALL
      SELECT business_key, business_key AS business_name, category FROM vault_products
      WHERE business_key IS NOT NULL AND TRIM(category) <> ''`);
    return rows.map(row => ({ business_key: row.business_key, business_name: row.business_name, category: row.category }));
  },
};
