import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RocketIcon, SquareDashedKanbanIcon, SwatchBookIcon } from "@/components/icons";

const links = [
  {
    href: "/templates",
    title: "Modèles",
    description: "Dimensions, fond perdu et positionnement du logo.",
    gradient: "from-teal-400 to-emerald-600",
    icon: SquareDashedKanbanIcon,
  },
  {
    href: "/visuals",
    title: "Visuels",
    description: "Une banque de patterns réutilisables sur les produits.",
    gradient: "from-amber-400 to-yellow-500",
    icon: SwatchBookIcon,
  },
  {
    href: "/products",
    title: "Produits",
    description: "Créer des produits à partir d'un modèle et d'une image.",
    gradient: "from-pink-400 to-rose-500",
    icon: RocketIcon,
  },
];

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let firstName = user?.email?.split("@")[0] ?? "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single<{ full_name: string | null }>();
    if (profile?.full_name) firstName = profile.full_name.split(" ")[0];
  }
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div>
      <div
        className="-mt-8 rounded-b-2xl px-6 py-10 sm:px-10"
        style={{
          background:
            "radial-gradient(ellipse at top left, #fbe0cc 0%, #f8f1e9 55%, #f8f1e9 100%)",
        }}
      >
        <p className="text-xs font-semibold tracking-widest text-pico-accent">PICO DESIGN</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-pico-black sm:text-4xl">
          Bonjour, {firstName}.
        </h1>
        <p className="mt-2 text-neutral-600">Choisissez une page pour commencer.</p>
      </div>

      <p className="mb-3 mt-8 text-xs font-semibold tracking-widest text-neutral-500">PAGES</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white ${link.gradient}`}
            >
              <link.icon className="h-6 w-6" />
            </span>
            <span className="font-heading text-lg font-semibold text-pico-black">
              {link.title}
            </span>
            <span className="text-sm text-neutral-600">{link.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
