import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
            // des cookies — sans effet ici, le client navigateur
            // (createBrowserClient) gère lui-même le rafraîchissement et
            // l'écriture du cookie de session.
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

// Protège une page (Server Component) contre l'accès sans connexion —
// remplace la vérification qui se faisait avant dans middleware.ts (retiré
// : le Routing Middleware de Vercel s'est révélé instable avec ce projet,
// sur les deux runtimes disponibles — voir l'historique de commits).
// À appeler en tout début de chaque page protégée.
export async function requireUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
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
