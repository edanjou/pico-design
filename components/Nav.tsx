"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOutIcon } from "@/components/icons";
import { DEFAULT_MENU_ORDER, MENU_ITEMS, resolveMenuOrder, type MenuKey } from "@/lib/menuItems";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  designer: "Designer",
  gestionnaire: "Gestionnaire",
  // Compat : anciennes lignes encore sur "employee" si la migration 0030
  // (renommage du rôle) n'a pas été exécutée en base.
  employee: "Designer",
};

const DEFAULT_ORDER_NO_ADMIN = DEFAULT_MENU_ORDER.filter((k) => k !== "users");

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  // Ordre par défaut en attendant le chargement du profil, pour éviter un
  // flash de nav vide — synchronisé avec l'ordre choisi sur le tableau de
  // bord une fois le profil chargé (voir DashboardTiles).
  const [menuOrder, setMenuOrder] = useState<MenuKey[]>(DEFAULT_ORDER_NO_ADMIN);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, menu_order")
        .eq("id", user.id)
        .single<{ full_name: string | null; role: string | null; menu_order: string[] | null }>();
      setName(profile?.full_name ?? user.email ?? null);
      setRole(profile?.role ?? null);
      const allowedKeys: MenuKey[] = profile?.role === "admin" ? DEFAULT_MENU_ORDER : DEFAULT_ORDER_NO_ADMIN;
      setMenuOrder(resolveMenuOrder(profile?.menu_order, allowedKeys));
    }
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Resynchronise immédiatement avec un glisser-déposer effectué sur le
    // tableau de bord (composant séparé) dans le même onglet.
    function onMenuOrderChanged(e: Event) {
      const detail = (e as CustomEvent<MenuKey[]>).detail;
      if (Array.isArray(detail)) setMenuOrder(detail);
    }
    window.addEventListener("pico:menu-order-changed", onMenuOrderChanged);
    return () => window.removeEventListener("pico:menu-order-changed", onMenuOrderChanged);
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
          {menuOrder.map((key, i) => {
            const item = MENU_ITEMS[key];
            return (
              <Fragment key={key}>
                {i > 0 && <span className="h-4 w-px bg-border" aria-hidden="true" />}
                <Link href={item.href} className="flex items-center gap-1.5 hover:text-primary">
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              </Fragment>
            );
          })}
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
