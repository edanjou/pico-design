import { createServerSupabaseClient, requireAdmin } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";
import { SETTINGS_SCOPES, loadAppSettings, type AppSettings, type SettingsScope } from "@/lib/appSettings";

// Identité visuelle de l'outil (voir supabase/migrations/0054_app_settings.sql).
// Réservé aux administrateurs, comme Utilisateurs : un réglage ici change
// l'interface de tout le monde.
export default async function SettingsPage() {
  await requireAdmin();
  const supabase = createServerSupabaseClient();

  const loaded = await Promise.all(SETTINGS_SCOPES.map((scope) => loadAppSettings(supabase, scope)));
  const initial = Object.fromEntries(SETTINGS_SCOPES.map((scope, i) => [scope, loaded[i]])) as Record<
    SettingsScope,
    AppSettings
  >;

  return <SettingsForm initial={initial} />;
}
