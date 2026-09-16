import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../types";

// Client Supabase utilisé dans les Server Components / routes API,
// avec la clé "anon" — respecte les politiques RLS de l'utilisateur connecté.
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Appelé depuis un Server Component sans possibilité d'écrire
            // des cookies — ignoré, le middleware s'en charge.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem
          }
        },
      },
    }
  );
}

// Client "admin" — utilise la clé service_role, réservé aux routes API
// serveur qui doivent écrire dans Storage/DB sans contrainte RLS
// (ex: enregistrer le PDF généré). Ne jamais importer côté client.
import { createClient as createRawClient } from "@supabase/supabase-js";

export function createAdminSupabaseClient() {
  return createRawClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
