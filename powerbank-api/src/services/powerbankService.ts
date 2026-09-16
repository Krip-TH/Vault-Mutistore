import type { PowerbankInput, PowerbankProduct } from '../types/product.js';

export class ValidationError extends Error {}

const CATEGORY = 'Powerbank' as const;

function now(): string {
  return new Date().toISOString();
}

function seedProduct(
  id: string,
  name: string,
  brand: string,
  price: number,
  stock: number,
  description: string,
  image: string,
): PowerbankProduct {
  const timestamp = now();

  return { id, name, brand, price, stock, description, image, category: CATEGORY, createdAt: timestamp, updatedAt: timestamp };
}

const products: PowerbankProduct[] = [
  seedProduct(
    'PB-001', 'Anker PowerCore 10000', 'Anker', 990, 25,
    'Compact 10,000mAh power bank with PowerIQ fast charging.',
    '/images/powerbank/anker-powercore-10000.jpg',
  ),
  seedProduct(
    'PB-002', 'Xiaomi 10000mAh Power Bank', 'Xiaomi', 590, 40,
    'Slim 10,000mAh power bank with dual USB output.',
    '/images/powerbank/xiaomi-10000.jpg',
  ),
  seedProduct(
    'PB-003', 'Baseus 20000mAh Power Bank', 'Baseus', 1290, 18,
    'High-capacity 20,000mAh power bank with 22.5W two-way fast charging.',
    '/images/powerbank/baseus-20000.jpg',
  ),
  seedProduct(
    'PB-004', 'UGREEN 10000mAh Power Bank', 'UGREEN', 890, 32,
    '10,000mAh power bank with USB-C power delivery fast charging.',
    '/images/powerbank/ugreen-10000.jpg',
  ),
  seedProduct(
    'PB-005', 'Remax 20000mAh Power Bank', 'Remax', 750, 22,
    '20,000mAh power bank with dual USB output and LED battery indicator.',
    '/images/powerbank/remax-20000.jpg',
  ),
];

let nextId = products.length + 1;

function generateId(): string {
  const id = `PB-${String(nextId).padStart(3, '0')}`;
  nextId += 1;

  return id;
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}

function validateName(value: unknown, required: boolean): string | undefined {
  const name = toTrimmedString(value);

  if (!name) {
    if (required) {
      throw new ValidationError('name is required and must be a non-empty string');
    }

    return undefined;
  }

  return name;
}

function validatePrice(value: unknown, required: boolean): number | undefined {
  if (value === undefined) {
    if (required) {
      throw new ValidationError('price is required and must be a positive number');
    }

    return undefined;
  }

  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) {
    throw new ValidationError('price must be a positive number');
  }

  return price;
}

function validateStock(value: unknown, required: boolean): number | undefined {
  if (value === undefined) {
    if (required) {
      throw new ValidationError('stock is required and must be a non-negative integer');
    }

    return undefined;
  }

  const stock = Number(value);
  if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) {
    throw new ValidationError('stock must be a non-negative integer');
  }

  return stock;
}

function validateOptionalText(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return toTrimmedString(value) ?? '';
}

export const powerbankService = {
  getAll(): PowerbankProduct[] {
    return products;
  },

  getById(id: string): PowerbankProduct | undefined {
    return products.find((product) => product.id === id);
  },

  create(input: PowerbankInput): PowerbankProduct {
    const body = input ?? {};
    const name = validateName(body.name, true)!;
    const price = validatePrice(body.price, true)!;
    const stock = validateStock(body.stock, true)!;
    const brand = validateOptionalText(body.brand) ?? '';
    const description = validateOptionalText(body.description) ?? '';
    const image = validateOptionalText(body.image) ?? '';

    const product: PowerbankProduct = {
      id: generateId(),
      name,
      brand,
      price,
      stock,
      description,
      image,
      category: CATEGORY,
      createdAt: now(),
      updatedAt: now(),
    };

    products.push(product);

    return product;
  },

  update(id: string, input: PowerbankInput): PowerbankProduct | undefined {
    const product = products.find((item) => item.id === id);
    if (!product) {
      return undefined;
    }

    const body = input ?? {};
    const name = validateName(body.name, false);
    const price = validatePrice(body.price, false);
    const stock = validateStock(body.stock, false);
    const brand = validateOptionalText(body.brand);
    const description = validateOptionalText(body.description);
    const image = validateOptionalText(body.image);

    if (name !== undefined) product.name = name;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (brand !== undefined) product.brand = brand;
    if (description !== undefined) product.description = description;
    if (image !== undefined) product.image = image;
    product.updatedAt = now();

    return product;
  },

  remove(id: string): PowerbankProduct | undefined {
    const index = products.findIndex((product) => product.id === id);
    if (index === -1) {
      return undefined;
    }

    const [deleted] = products.splice(index, 1);

    return deleted;
  },
};
