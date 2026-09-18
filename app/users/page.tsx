import { requireAdmin, createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import UsersTable from "@/components/UsersTable";
import type { Profile } from "@/lib/types";

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const supabase = createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const rows = ((profiles as Profile[]) ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? "" }));

  return <UsersTable users={rows} currentUserId={currentUser.id} />;
}
