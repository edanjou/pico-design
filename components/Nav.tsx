"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOutIcon, MenuIcon, XIcon } from "@/components/icons";
import { DEFAULT_MENU_ORDER, MENU_ITEMS, resolveMenuOrder, type MenuKey } from "@/lib/menuItems";
import Modal from "@/components/Modal";
import ChangePasswordForm from "@/components/ChangePasswordForm";

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
  const pathname = usePathname();
  const supabase = createClient();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  // Menu burger (mobile et tablette — voir le <nav> masqué en `lg:flex`
  // ci-dessous ; le menu horizontal ne revient qu'à partir de 1024 px).
  // Fermé automatiquement dès qu'on change de page.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  // Modale « Changer mon mot de passe », ouverte depuis la pastille du nom —
  // accessible à tous les rôles (contrairement à Utilisateurs, réservé aux admins).
  const [accountOpen, setAccountOpen] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
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

        {/* Écrans étroits : remplacée par le bouton burger et le panneau ci-dessous. */}
        <nav className="hidden items-center gap-4 text-sm text-text-muted lg:flex">
          {menuOrder.map((key, i) => {
            const item = MENU_ITEMS[key];
            return (
              <Fragment key={key}>
                {i > 0 && <span className="h-4 w-px bg-border" aria-hidden="true" />}
                <Link
                  href={item.href}
                  className="group flex items-center gap-1.5 transition-colors duration-200 hover:text-primary"
                >
                  {/* Seule l'icône bouge (secousse « jello », jouée une fois au survol) : le
                      lien, lui, reste en place, donc la zone de survol ne change pas.
                      `motion-safe` désactive le mouvement pour qui a demandé moins d'animations. */}
                  <item.icon className="h-4 w-4 motion-safe:group-hover:animate-jello" />
                  {item.title}
                </Link>
              </Fragment>
            );
          })}
        </nav>

        {/* Groupe aligné à droite : menu burger (mobile/tablette), pastille du nom, déconnexion. */}
        <div className="flex items-center justify-self-end gap-1">
          <button
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            title={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text lg:hidden"
          >
            {mobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setAccountOpen(true)}
            title="Changer mon mot de passe"
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-surface-muted"
          >
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
          </button>
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <LogOutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Panneau du menu burger : liste verticale des mêmes liens, repliée par défaut. */}
      {mobileOpen && (
        <nav id="mobile-nav" className="border-t border-border px-4 py-2 lg:hidden">
          {menuOrder.map((key) => {
            const item = MENU_ITEMS[key];
            return (
              <Link
                key={key}
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-text-muted hover:bg-surface-muted hover:text-primary"
              >
                <item.icon className="h-4 w-4 motion-safe:group-hover:animate-jello" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      )}

      {accountOpen && (
        <Modal
          title="Changer mon mot de passe"
          onClose={() => {
            setAccountOpen(false);
            setPasswordChanged(false);
          }}
        >
          {passwordChanged ? (
            <p className="text-sm text-green-700">Mot de passe changé.</p>
          ) : (
            <ChangePasswordForm onSuccess={() => setPasswordChanged(true)} />
          )}
        </Modal>
      )}
    </header>
  );
}
