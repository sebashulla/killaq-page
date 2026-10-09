export interface Category {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_active?: boolean;
}

export interface Subcategory {
  id: number;
  category_id: number;
  slug: string;
  name: string;
}

export interface Collection {
  id: number;
  name: string;
  slug: string;
  is_active?: boolean;
}

export interface Material {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
}

export interface ProductImage {
  id?: number;
  url: string;
  alt_text?: string | null;
  sort_order?: number;
}

export type VideoPlatform = "instagram" | "tiktok" | "upload" | "external";

export interface ProductVideo {
  id?: number;
  product_id?: string;
  video_type: VideoPlatform;
  title?: string | null;
  url: string;
  poster_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface SocialVideo {
  id?: number;
  platform: Extract<VideoPlatform, "instagram" | "tiktok" | "external">;
  title: string;
  video_url: string;
  thumbnail_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  category_id?: number | null;
  subcategory_id?: number | null;
  collection_id?: number | null;
  material_id?: number | null;
  stock: number;
  sku?: string | null;
  weight_grams?: number | null;
  sizes_available?: string[] | null;
  is_featured?: boolean;
  is_active?: boolean;
  created_at?: string;
  categories?: Pick<Category, "name" | "slug"> | null;
  subcategories?: Pick<Subcategory, "name" | "slug"> | null;
  collections?: Pick<Collection, "name" | "slug" | "is_active"> | null;
  materials?: Pick<Material, "name" | "slug"> | null;
  product_images?: ProductImage[] | null;
  product_videos?: ProductVideo[] | null;
}

export interface HeroSlide {
  id: number;
  title: string;
  subtitle: string | null;
  cta_text: string;
  cta_url: string;
  image_url: string;
  image_alt?: string | null;
  jewelry_tone?: "gold" | "silver";
  background_style?: "auto" | "black" | "gold" | "white";
  image_fit?: "contain" | "cover";
}

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
  size?: string;
  stock?: number;
}
