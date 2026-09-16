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
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-pico-700">Pico Design</span>
          <nav className="flex gap-4 text-sm text-neutral-600">
            <Link href="/generate" className="hover:text-pico-700">
              Générer un PDF
            </Link>
            <Link href="/templates" className="hover:text-pico-700">
              Modèles
            </Link>
            <Link href="/history" className="hover:text-pico-700">
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
