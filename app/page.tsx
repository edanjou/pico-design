import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import DashboardTiles from "@/components/DashboardTiles";
import { DEFAULT_MENU_ORDER, resolveMenuOrder, type MenuKey } from "@/lib/menuItems";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createServerSupabaseClient();

  let firstName = user.email?.split("@")[0] ?? "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, menu_order")
    .eq("id", user.id)
    .single<{ full_name: string | null; role: string | null; menu_order: string[] | null }>();
  if (profile?.full_name) firstName = profile.full_name.split(" ")[0];
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const allowedKeys: MenuKey[] =
    profile?.role === "admin" ? DEFAULT_MENU_ORDER : DEFAULT_MENU_ORDER.filter((k) => k !== "users");
  const order = resolveMenuOrder(profile?.menu_order, allowedKeys);

  return (
    <div>
      {/* Le halo dégradé vient de la mise en page commune (.page-glow). */}
      <div className="full-bleed -mt-8">
        <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
          <p className="text-xs font-semibold tracking-widest text-pico-accent">PICO DESIGN</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-pico-black sm:text-4xl">
            Bonjour, {firstName}.
          </h1>
          <p className="mt-2 text-neutral-600">Choisissez une page pour commencer.</p>
        </div>
      </div>

      <p className="mb-3 mt-8 text-xs font-semibold tracking-widest text-neutral-500">PAGES</p>
      <DashboardTiles initialOrder={order} />
    </div>
  );
}
