"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LogOutIcon,
  RocketIcon,
  SquareDashedKanbanIcon,
  SwatchBookIcon,
  TagIcon,
  UsersIcon,
} from "@/components/icons";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  designer: "Designer",
  gestionnaire: "Gestionnaire",
  // Compat : anciennes lignes encore sur "employee" si la migration 0030
  // (renommage du rôle) n'a pas été exécutée en base.
  employee: "Designer",
};

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single<{ full_name: string | null; role: string | null }>();
      setName(profile?.full_name ?? user.email ?? null);
      setRole(profile?.role ?? null);
    }
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = name
    ? name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 py-3">
        <div className="flex items-center">
          <Link href="/">
            <img src="/pico-noir.svg" alt="Pico Design" className="h-6 w-auto" />
          </Link>
        </div>

        <nav className="flex items-center gap-4 text-sm text-text-muted">
          <Link href="/templates" className="flex items-center gap-1.5 hover:text-primary">
            <SquareDashedKanbanIcon className="h-4 w-4" />
            Modèles
          </Link>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <Link href="/visuals" className="flex items-center gap-1.5 hover:text-primary">
            <SwatchBookIcon className="h-4 w-4" />
            Visuels
          </Link>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <Link href="/products" className="flex items-center gap-1.5 hover:text-primary">
            <RocketIcon className="h-4 w-4" />
            Produits
          </Link>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <Link href="/skus" className="flex items-center gap-1.5 hover:text-primary">
            <TagIcon className="h-4 w-4" />
            SKU
          </Link>
          {role === "admin" && (
            <>
              <span className="h-4 w-px bg-border" aria-hidden="true" />
              <Link href="/users" className="flex items-center gap-1.5 hover:text-primary">
                <UsersIcon className="h-4 w-4" />
                Utilisateurs
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center justify-self-end gap-1">
          <div className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-text-on-brand">
              {initials || "?"}
            </span>
            {name && (
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-text">{name}</span>
                {role && (
                  <span className="block text-xs text-text-subtle">
                    {ROLE_LABELS[role] ?? role}
                  </span>
                )}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
