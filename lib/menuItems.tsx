import { ImageIcon, LayoutGridIcon, PencilRulerIcon, RocketIcon, ShopifyIcon, TagIcon, UsersIcon } from "@/components/icons";

// Liste centrale des pages de nav / tuiles du tableau de bord, pour que les
// deux restent synchronisées sur le même ordre (voir `resolveMenuOrder`) et
// utilisent les mêmes icônes/couleurs.
export type MenuKey = "templates" | "visuals" | "products" | "design" | "skus" | "imposition" | "users";

export const MENU_ITEMS: Record<
  MenuKey,
  { href: string; title: string; icon: (props: { className?: string }) => JSX.Element; gradient: string }
> = {
  templates: {
    href: "/templates",
    title: "Modèles",
    icon: PencilRulerIcon,
    gradient: "from-teal-400 to-emerald-600",
  },
  visuals: {
    href: "/visuals",
    title: "Visuels",
    icon: ImageIcon,
    gradient: "from-amber-400 to-yellow-500",
  },
  products: {
    href: "/products",
    title: "Produits",
    icon: RocketIcon,
    gradient: "from-pink-400 to-rose-500",
  },
  design: {
    href: "/design",
    title: "Outil Shopify",
    icon: ShopifyIcon,
    // Vert de la marque Shopify (#95BF47), plutôt qu'une paire Tailwind
    // générique — seule tuile de ce dégradé, pour bien l'associer à Shopify.
    gradient: "from-[#95BF47] to-[#5E8E3E]",
  },
  skus: {
    href: "/skus",
    title: "SKU",
    icon: TagIcon,
    gradient: "from-sky-400 to-blue-600",
  },
  imposition: {
    href: "/imposition",
    title: "Imposition",
    icon: LayoutGridIcon,
    gradient: "from-orange-400 to-red-500",
  },
  users: {
    href: "/users",
    title: "Utilisateurs",
    icon: UsersIcon,
    gradient: "from-violet-400 to-purple-600",
  },
};

// Ordre par défaut quand l'utilisateur n'a encore rien personnalisé.
export const DEFAULT_MENU_ORDER: MenuKey[] = [
  "templates",
  "visuals",
  "products",
  "design",
  "skus",
  "imposition",
  "users",
];

function isMenuKey(value: string): value is MenuKey {
  return Object.prototype.hasOwnProperty.call(MENU_ITEMS, value);
}

// Combine l'ordre sauvegardé (peut contenir des clés obsolètes ou en
// manquer de nouvelles) avec les clés effectivement permises pour cet
// utilisateur (ex. "users" seulement pour les admins) : garde l'ordre
// choisi pour les clés connues, puis ajoute à la fin les clés permises
// mais absentes de la sauvegarde (nouvelle page, jamais réordonnée).
export function resolveMenuOrder(saved: string[] | null | undefined, allowedKeys: MenuKey[]): MenuKey[] {
  const allowedSet = new Set(allowedKeys);
  const fromSaved = (saved ?? []).filter((key): key is MenuKey => isMenuKey(key) && allowedSet.has(key));
  const missing = DEFAULT_MENU_ORDER.filter((key) => allowedSet.has(key) && !fromSaved.includes(key));
  return [...fromSaved, ...missing];
}
