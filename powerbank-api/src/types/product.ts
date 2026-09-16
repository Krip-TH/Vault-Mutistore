export interface PowerbankProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  stock: number;
  description: string;
  image: string;
  category: 'Powerbank';
  createdAt: string;
  updatedAt: string;
}

export interface PowerbankInput {
  name?: unknown;
  brand?: unknown;
  price?: unknown;
  stock?: unknown;
  description?: unknown;
  image?: unknown;
}
