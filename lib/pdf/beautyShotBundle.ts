import type { createServerSupabaseClient } from "../supabase/server";
import {
  beautyShotAssetPath,
  beautyShotFolderOf,
  maskHorizontalBounds,
  mimeTypeForAsset,
  parseBeautyShotXml,
  usedAssetNames,
  type BeautyShotConfig,
} from "./beautyShot";

type Storage = ReturnType<typeof createServerSupabaseClient>["storage"];

/**
 * Charge un bundle mockup depuis le bucket `overlays` : son XML (parsé) et
 * les images qu'il utilise réellement. Ce bloc était dupliqué mot pour mot
 * entre /api/design/mockup et /api/products/[id]/mockup ; il est aussi ce
 * qui rend le multi-mockup trivial côté rendu, puisqu'il ne dépend que du
 * chemin du XML — pas de l'id du modèle.
 *
 * Les images sont cherchées dans le MÊME dossier que le XML (voir
 * beautyShotFolderOf) : ça vaut aussi bien pour un bundle hérité
 * (`<templateId>/beautyshot.xml`) que pour un mockup de la table
 * template_mockups (`mockups/<mockupId>/beautyshot.xml`).
 *
 * Lève une erreur nommant les assets introuvables plutôt que de laisser le
 * rendu échouer plus loin sur un Buffer manquant.
 */
export async function loadBeautyShotBundle(
  storage: Storage,
  xmlPath: string
): Promise<{ config: BeautyShotConfig; assets: Map<string, Buffer> }> {
  const xmlRes = await storage.from("overlays").download(xmlPath);
  if (!xmlRes.data) throw new Error("Impossible de charger le XML du mockup.");
  const config = parseBeautyShotXml(await xmlRes.data.text());

  const folder = beautyShotFolderOf(xmlPath);
  const entries = await Promise.all(
    usedAssetNames(config).map(async (name) => {
      const path = beautyShotAssetPath(folder, name, mimeTypeForAsset(config, name));
      const { data } = await storage.from("overlays").download(path);
      return [name, data ? Buffer.from(await data.arrayBuffer()) : null] as const;
    })
  );

  const missing = entries.filter(([, buf]) => !buf).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Fichiers manquants pour le mockup : ${missing.join(", ")}.`);
  }

  return { config, assets: new Map(entries.map(([name, buf]) => [name, buf as Buffer])) };
}

/**
 * Mesure les bords du produit dans le masque d'un bundle, sans charger le
 * reste des images. Sert à caler les marges de zone d'un mockup sur le
 * produit : la zone du mesh couvre souvent toute la scène, si bien que sans
 * marges le visuel est étalé — et donc agrandi — bien au-delà du produit.
 *
 * Retourne null quand le bundle n'a pas de masque ou qu'il est illisible :
 * l'appelant garde alors des marges nulles, c.-à-d. le comportement d'avant.
 */
export async function loadMaskBounds(
  storage: Storage,
  xmlPath: string
): Promise<{ left: number; right: number; top: number; bottom: number } | null> {
  try {
    const xmlRes = await storage.from("overlays").download(xmlPath);
    if (!xmlRes.data) return null;
    const config = parseBeautyShotXml(await xmlRes.data.text());
    if (!config.maskAssetName) return null;

    const path = beautyShotAssetPath(
      beautyShotFolderOf(xmlPath),
      config.maskAssetName,
      mimeTypeForAsset(config, config.maskAssetName)
    );
    const { data } = await storage.from("overlays").download(path);
    if (!data) return null;
    return await maskHorizontalBounds(Buffer.from(await data.arrayBuffer()));
  } catch {
    return null;
  }
}
