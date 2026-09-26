import type { createServerSupabaseClient } from "./supabase/server";
import {
  beautyShotAssetPath,
  beautyShotFolderOf,
  beautyShotXmlPath,
  mimeTypeForAsset,
  parseBeautyShotXml,
  usedAssetNames,
} from "./pdf/beautyShot";

type Storage = ReturnType<typeof createServerSupabaseClient>["storage"];

function stripExtension(filename: string): string {
  return filename.replace(/\.[^./]+$/, "").trim();
}

// Associe un fichier à un asset si son nom (sans extension) EST le nom de
// l'asset, ou se TERMINE par celui-ci séparé par un ".", "-" ou "_" — pour
// couvrir les conventions de nommage des fournisseurs (ex.
// "assets.background-bs1.png" pour l'asset "background-bs1").
function fileMatchesAsset(filename: string, assetName: string): boolean {
  const base = stripExtension(filename).toLowerCase();
  const target = assetName.toLowerCase();
  if (base === target) return true;
  if (!base.endsWith(target)) return false;
  const charBefore = base[base.length - target.length - 1];
  return charBefore !== undefined && /[._-]/.test(charBefore);
}

// Envoie le bundle mockup (XML + images qu'il référence) pour un modèle,
// sous forme d'un champ "beautyShotXml" (le fichier XML, optionnel si un
// bundle existe déjà) et d'un champ répété "beautyShotImages" (les images).
// Chaque image est associée à un asset du XML par son nom de fichier (sans
// extension, insensible à la casse) — ex. "background-bs1.png" correspond à
// <asset name="background-bs1">. `existingXmlPath` permet d'ajouter/remplacer
// des images sans re-fournir le XML (on va relire celui déjà stocké pour
// connaître les noms d'assets attendus).
// Renvoie le chemin du XML stocké, ou null si rien n'a été envoyé.
// Lève une erreur listant les assets manquants si, après cet envoi, un
// asset utilisé par le XML n'a ni image fraîchement envoyée ni image déjà
// stockée sous son chemin déterministe — pour échouer à l'enregistrement
// plutôt qu'au moment de générer le mockup.
//
// `folder` est le dossier de destination dans le bucket `overlays` : l'id
// du modèle pour le bundle hérité (un seul par modèle), ou
// `mockupFolder(mockupId)` pour un mockup de la table template_mockups (un
// dossier par mockup, donc autant de bundles qu'on veut).
export async function uploadBeautyShotBundle(
  storage: Storage,
  formData: FormData,
  folder: string,
  existingXmlPath?: string | null
): Promise<string | null> {
  const xmlFile = formData.get("beautyShotXml");
  const imageFiles = formData
    .getAll("beautyShotImages")
    .filter((f): f is File => f instanceof File && f.size > 0);

  let xmlText: string;
  let xmlPath: string;
  if (xmlFile instanceof File && xmlFile.size > 0) {
    xmlText = await xmlFile.text();
    xmlPath = beautyShotXmlPath(folder);
  } else if (imageFiles.length > 0 && existingXmlPath) {
    const { data, error } = await storage.from("overlays").download(existingXmlPath);
    if (error || !data) throw error ?? new Error("XML du bundle mockup introuvable pour y associer les images.");
    xmlText = await data.text();
    xmlPath = existingXmlPath;
  } else if (imageFiles.length > 0) {
    throw new Error("Le fichier XML du bundle mockup est requis pour associer ces images à leurs assets.");
  } else {
    return null; // rien à envoyer.
  }

  const config = parseBeautyShotXml(xmlText);
  const usedFiles = new Set<File>();

  const missing: string[] = [];
  for (const assetName of usedAssetNames(config)) {
    const file = imageFiles.find((f) => !usedFiles.has(f) && fileMatchesAsset(f.name, assetName));
    if (file) usedFiles.add(file);
    const mimeType = mimeTypeForAsset(config, assetName);
    const path = beautyShotAssetPath(folder, assetName, mimeType);
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error } = await storage
        .from("overlays")
        .upload(path, buffer, { contentType: file.type || mimeType, upsert: true });
      if (error) throw error;
    } else {
      // Pas ré-envoyée : vérifie qu'une image existe déjà sous ce chemin.
      const assetFolder = path.slice(0, path.lastIndexOf("/"));
      const filename = path.slice(path.lastIndexOf("/") + 1);
      const { data: existing } = await storage.from("overlays").list(assetFolder, { search: filename });
      if (!existing || !existing.some((f) => f.name === filename)) missing.push(assetName);
    }
  }

  if (missing.length > 0) {
    const received = imageFiles.map((f) => f.name).join(", ") || "aucune";
    throw new Error(
      `Image(s) manquante(s) pour le bundle mockup : ${missing.join(
        ", "
      )}. Le nom de fichier (sans extension) doit correspondre exactement au nom de l'asset dans le XML. Fichiers reçus : ${received}.`
    );
  }

  const { error: xmlError } = await storage
    .from("overlays")
    .upload(xmlPath, Buffer.from(xmlText), { contentType: "application/xml", upsert: true });
  if (xmlError) throw xmlError;

  return xmlPath;
}

// Copie le XML et les images d'un bundle vers un autre dossier
// (duplication d'un modèle, ou d'un mockup vers le modèle dupliqué).
// `targetFolder` suit la même convention que `uploadBeautyShotBundle` :
// l'id du modèle (bundle hérité) ou `mockupFolder(mockupId)`.
export async function copyBeautyShotBundle(
  storage: Storage,
  sourceXmlPath: string | null,
  targetFolder: string
): Promise<string | null> {
  if (!sourceXmlPath) return null;

  const { data: xmlData, error: downloadError } = await storage.from("overlays").download(sourceXmlPath);
  if (downloadError || !xmlData) throw downloadError ?? new Error("XML du bundle introuvable.");
  const xmlText = await xmlData.text();
  const config = parseBeautyShotXml(xmlText);
  // Les images sont toujours à côté du XML, quelle que soit la convention
  // du dossier source (voir beautyShotFolderOf).
  const sourceFolder = beautyShotFolderOf(sourceXmlPath);

  for (const assetName of usedAssetNames(config)) {
    const mimeType = mimeTypeForAsset(config, assetName);
    const sourcePath = beautyShotAssetPath(sourceFolder, assetName, mimeType);
    const newPath = beautyShotAssetPath(targetFolder, assetName, mimeType);
    const { error } = await storage.from("overlays").copy(sourcePath, newPath);
    if (error) throw error;
  }

  const newXmlPath = beautyShotXmlPath(targetFolder);
  const { error: xmlCopyError } = await storage.from("overlays").copy(sourceXmlPath, newXmlPath);
  if (xmlCopyError) throw xmlCopyError;

  return newXmlPath;
}
