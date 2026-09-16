"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-neutral-200 bg-pico-cream">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/">
            <img src="/pico-noir.svg" alt="Pico Design" className="h-6 w-auto" />
          </Link>
          <nav className="flex gap-4 text-sm text-neutral-600">
            <Link href="/templates" className="hover:text-pico-accent">
              Modèles
            </Link>
            <Link href="/visuals" className="hover:text-pico-accent">
              Visuels
            </Link>
            <Link href="/products" className="hover:text-pico-accent">
              Produits
            </Link>
            <Link href="/generate" className="hover:text-pico-accent">
              Générer un PDF
            </Link>
            <Link href="/history" className="hover:text-pico-accent">
              Historique
            </Link>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-neutral-500 hover:text-neutral-800">
          Se déconnecter
        </button>
      </div>
    </header>
  );
}
