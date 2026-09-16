import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const links = [
  {
    href: "/generate",
    title: "Générer un PDF",
    description: "Envoyer une image et obtenir un PDF prêt pour impression.",
    gradient: "from-orange-400 to-red-500",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 4.5v11m0 0 4-4m-4 4-4-4M5 16.5v1.75A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V16.5"
      />
    ),
  },
  {
    href: "/templates",
    title: "Modèles",
    description: "Voir et ajouter des formats de produits.",
    gradient: "from-teal-400 to-emerald-600",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 5.75A1.75 1.75 0 0 1 5.75 4h4.5A1.75 1.75 0 0 1 12 5.75v4.5A1.75 1.75 0 0 1 10.25 12h-4.5A1.75 1.75 0 0 1 4 10.25v-4.5ZM4 18.25A1.75 1.75 0 0 1 5.75 16.5h4.5A1.75 1.75 0 0 1 12 18.25v.5A1.75 1.75 0 0 1 10.25 20.5h-4.5A1.75 1.75 0 0 1 4 18.75v-.5ZM12 13.75A1.75 1.75 0 0 1 13.75 12h4.5A1.75 1.75 0 0 1 20 13.75v4.5A1.75 1.75 0 0 1 18.25 20h-4.5A1.75 1.75 0 0 1 12 18.25v-4.5ZM12 5.75A1.75 1.75 0 0 1 13.75 4h4.5A1.75 1.75 0 0 1 20 5.75v.5A1.75 1.75 0 0 1 18.25 8h-4.5A1.75 1.75 0 0 1 12 6.25v-.5Z"
      />
    ),
  },
  {
    href: "/history",
    title: "Historique",
    description: "Revoir les générations passées (succès et erreurs).",
    gradient: "from-purple-400 to-indigo-500",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8v4l2.5 2.5M20 12a8 8 0 1 1-8-8 8 8 0 0 1 8 8Z"
      />
    ),
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
      <div className="grid gap-4 sm:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
          >
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white ${link.gradient}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                {link.icon}
              </svg>
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
