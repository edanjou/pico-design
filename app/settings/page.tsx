import {
  createServerSupabaseClient,
  requireAdmin,
} from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";
import {
  BASE_SCOPES,
  loadAppSettings,
  type AppSettings,
  type SettingsScope,
} from "@/lib/appSettings";

// Identité visuelle de l'outil (voir supabase/migrations/0054_app_settings.sql).
// Réservé aux administrateurs, comme Utilisateurs : un réglage ici change
// l'interface de tout le monde.
export default async function SettingsPage() {
  await requireAdmin();
  const supabase = createServerSupabaseClient();

  // Boutiques connues : celles qui ont déjà des réglages, plus celles d'où
  // sont venues des commandes. Inutile de les saisir à la main.
  const [{ data: rows }, { data: orders }] = await Promise.all([
    supabase.from("app_settings").select("scope"),
    supabase.from("orders").select("shop_domain"),
  ]);
  const boutiques = Array.from(
    new Set([
      ...((rows as { scope: string }[]) ?? [])
        .map((r) => r.scope)
        .filter((s) => !BASE_SCOPES.includes(s as never)),
      ...((orders as { shop_domain: string | null }[]) ?? [])
        .map((o) => o.shop_domain)
        .filter(Boolean),
    ]),
  ).sort() as string[];

  const scopes: SettingsScope[] = [...BASE_SCOPES, ...boutiques];
  const loaded = await Promise.all(
    scopes.map((scope) => loadAppSettings(supabase, scope)),
  );
  const initial = Object.fromEntries(
    scopes.map((scope, i) => [scope, loaded[i]]),
  ) as Record<SettingsScope, AppSettings>;

  return <SettingsForm initial={initial} boutiques={boutiques} />;
}
