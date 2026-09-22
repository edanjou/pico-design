import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient, getAuthorizedAdmin } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/passwordPolicy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const { user, isAdmin } = await getAuthorizedAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const role = body?.role === "admin" || body?.role === "gestionnaire" ? body.role : "designer";

  if (!email || !password) {
    return NextResponse.json({ error: "Courriel et mot de passe requis." }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null },
  });
  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Erreur lors de la création du compte." },
      { status: 500 }
    );
  }

  // Le profil est créé automatiquement par le trigger `on_auth_user_created`
  // (voir supabase/migrations/0001_init.sql), mais avec le rôle par défaut
  // "designer" — on l'ajuste ici si un autre rôle a été choisi.
  if (role !== "designer") {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", data.user.id);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: data.user.id, email: data.user.email, full_name: fullName, role });
}
