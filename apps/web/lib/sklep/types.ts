// apps/web/lib/sklep/types.ts
// Frontend product shape — anticipates future GET /api/admin/sklep/products response.
// TODO M10: wire to real Product API

export type ProductStatus = "dostępne" | "zarezerwowane" | "sprzedane";

/** Frontend product shape — anticipates future GET /api/admin/sklep/products response. */
export interface ProductDto {
  id: string;
  name: string;
  brand: string;
  size: string;
  pricePln: string;
  status: ProductStatus;
  reservationsCount: number;
  photos: string[];
  description: string | null;
}
