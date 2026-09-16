// Types partagés avec le schéma Supabase (voir supabase/migrations/0001_init.sql).
// À régénérer plus précisément plus tard avec `supabase gen types typescript`.

export type LogoPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export interface Template {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  bleed_mm: number;
  dpi: number;
  logo_position: LogoPosition;
  logo_width_mm: number;
  logo_margin_mm: number;
  created_at: string;
  created_by: string | null;
}

export interface Job {
  id: string;
  template_id: string;
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
