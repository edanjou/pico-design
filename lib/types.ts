// Types partagés avec le schéma Supabase (voir supabase/migrations/0001_init.sql).
// À régénérer plus précisément plus tard avec `supabase gen types typescript`.

export type LogoHAlign = "left" | "center" | "right";
export type LogoVAlign = "top" | "bottom";

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  category_id: string;
  width_mm: number;
  height_mm: number;
  bleed_mm: number;
  safety_margin_mm: number;
  dpi: number;
  logo_h_align: LogoHAlign;
  logo_v_align: LogoVAlign;
  logo_width_mm: number;
  logo_margin_x_mm: number;
  logo_margin_y_mm: number;
  overlay_path: string | null;
  two_sided: boolean;
  logo_on_front: boolean;
  logo_on_back: boolean;
  created_at: string;
  created_by: string | null;
}

export type VisualMode = "full" | "tile";
export type LogoShape = "logo" | "pastille";

export interface VisualCollection {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export interface Visual {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
  collection_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ProductCollection {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
}

export interface Product {
  id: string;
  name: string;
  template_id: string;
  image_path: string;
  visual_id: string | null;
  visual_mode: VisualMode | null;
  tile_size_mm: number | null;
  logo_shape: LogoShape;
  logo_color: string;
  logo_secondary_color: string;
  collection_id: string | null;
  pdf_path: string | null;
  image_position_x: number;
  image_position_y: number;
  back_image_path: string | null;
  back_visual_id: string | null;
  back_visual_mode: VisualMode | null;
  back_tile_size_mm: number | null;
  back_image_position_x: number;
  back_image_position_y: number;
  created_at: string;
  created_by: string | null;
}

export interface Job {
  id: string;
  template_id: string;
  product_id: string | null;
  source_image_path: string;
  output_pdf_path: string | null;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: "admin" | "employee";
  created_at: string;
}

// Placeholder minimal pour satisfaire le générique <Database> de @supabase/ssr.
// Remplace par le type généré (`supabase gen types typescript --local`) quand
// tu veux l'autocomplétion complète des tables dans les requêtes .from(...).
export type Database = any;
