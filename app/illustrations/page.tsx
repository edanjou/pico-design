import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import IllustrationsManager from "@/components/IllustrationsManager";
import { loadIllustrations } from "@/lib/illustrationsData";

// Banque d'illustrations : ce que le client de l'Outil Shopify peut poser sur
// son design comme un calque (voir supabase/migrations/0064_illustrations.sql).
export default async function IllustrationsPage() {
  await requireUser();
  return <IllustrationsManager illustrations={await loadIllustrations(createServerSupabaseClient())} />;
}
