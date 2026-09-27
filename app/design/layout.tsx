import AppSettingsStyle from "@/components/AppSettingsStyle";

/**
 * Habillage propre à l'Outil Shopify. Le bloc de style vient plus loin dans
 * le document que celui de app/layout.tsx : il l'emporte donc sur le jeu
 * « admin », sans qu'aucun code n'ait à détecter la route.
 */
export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSettingsStyle scope="tool" />
      {children}
    </>
  );
}
