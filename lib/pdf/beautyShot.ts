import sharp from "sharp";
import { XMLParser } from "fast-xml-parser";
import { coverCropToBuffer } from "./crop";
import { rasterizeLogoToPng } from "./logo";
import { logoOverlay } from "./logoShadow";
import { compositeLayers, type ResolvedLayer } from "./layers";
import type { LogoShadowSettings } from "../logoShadowSettings";
import type { Template } from "../types";

/**
 * Format "beauty shot" (repris du schéma Mediaclip gifting:beautyShot) :
 * un XML qui décrit un fond, un masque, la zone où vient se placer le
 * visuel du produit (imageZone/mesh) et une pile de surcouches (overlay,
 * ombre, ...) avec leur blend mode. Il remplace le duo masque + ombrage
 * dessiné à la main pour chaque modèle — le XML et les images qu'il
 * référence sont fournis ensemble par le graphiste.
 *
 * Le mesh peut en théorie décrire un maillage de déformation (perspective)
 * — pour l'instant on ne gère que le cas rectangle (le plus courant), en
 * prenant le rectangle englobant des points du mesh. Un vrai mesh de
 * déformation demanderait un moteur de warp dédié, à ajouter plus tard si
 * un modèle en a besoin.
 */

export interface BeautyShotAsset {
  name: string;
  mimeType: string;
}

export interface BeautyShotOverlay {
  assetName: string;
  blendMode: string;
}

export interface BeautyShotZone {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BeautyShotConfig {
  assets: BeautyShotAsset[];
  backgroundAssetName: string | null;
  maskAssetName: string | null;
  transparency: boolean;
  width: number;
  height: number;
  zones: BeautyShotZone[];
  overlays: BeautyShotOverlay[];
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// Le XML déclare des tags préfixés (gifting:beautyShot) sans forcément
// garder le même préfixe partout — on cherche par suffixe plutôt que par
// clé exacte pour rester tolérant.
function findKey(obj: Record<string, unknown>, suffix: string): string | undefined {
  return Object.keys(obj).find((k) => k === suffix || k.endsWith(`:${suffix}`));
}

function assetNameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("asset:") ? url.slice("asset:".length) : url;
}

function parseMeshBounds(meshText: string): { left: number; top: number; width: number; height: number } {
  const points = Array.from(meshText.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)).map((m) => ({
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
  }));
  if (points.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  return { left, top, width, height };
}

export function parseBeautyShotXml(xml: string): BeautyShotConfig {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const rootKey = findKey(doc, "beautyShots") ?? "beautyShots";
  const root = (doc[rootKey] ?? doc) as Record<string, unknown>;

  const assetsKey = findKey(root, "assets");
  const assetsNode = assetsKey ? (root[assetsKey] as Record<string, unknown>) : {};
  const assets: BeautyShotAsset[] = asArray(assetsNode?.["asset"] as Record<string, unknown> | Record<string, unknown>[]).map(
    (a) => {
      const imageKey = findKey(a, "image");
      const image = imageKey ? (a[imageKey] as Record<string, unknown>) : {};
      return {
        name: String(a["@_name"] ?? ""),
        mimeType: String(image?.["@_mimeType"] ?? "image/png"),
      };
    }
  );

  const beautyShotKey = findKey(root, "beautyShot");
  const beautyShot = (beautyShotKey ? root[beautyShotKey] : undefined) as Record<string, unknown> | undefined;
  if (!beautyShot) {
    return {
      assets,
      backgroundAssetName: null,
      maskAssetName: null,
      transparency: true,
      width: 0,
      height: 0,
      zones: [],
      overlays: [],
    };
  }

  const zoneKey = findKey(beautyShot, "imageZone");
  const zones: BeautyShotZone[] = asArray(
    beautyShot[zoneKey ?? "imageZone"] as Record<string, unknown> | Record<string, unknown>[]
  ).map((z) => {
    const meshKey = findKey(z, "mesh");
    const meshText = meshKey ? String(z[meshKey] ?? "") : "";
    const bounds = parseMeshBounds(meshText);
    return { id: String(z["@_id"] ?? ""), ...bounds };
  });

  const overlayKey = findKey(beautyShot, "overlay");
  const overlays: BeautyShotOverlay[] = asArray(
    beautyShot[overlayKey ?? "overlay"] as Record<string, unknown> | Record<string, unknown>[]
  ).map((o) => ({
    assetName: assetNameFromUrl(String(o["@_url"] ?? "")) ?? "",
    blendMode: String(o["@_blendMode"] ?? "over"),
  }));

  return {
    assets,
    backgroundAssetName: assetNameFromUrl(beautyShot["@_backgroundUrl"] as string | undefined),
    maskAssetName: assetNameFromUrl(beautyShot["@_maskUrl"] as string | undefined),
    transparency: String(beautyShot["@_transparency"] ?? "true") === "true",
    width: parseInt(String(beautyShot["@_width"] ?? "0"), 10),
    height: parseInt(String(beautyShot["@_height"] ?? "0"), 10),
    zones,
    overlays,
  };
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

// Chemin de stockage déterministe pour un asset donné : le nom de fichier
// original importe peu, seul le nom de l'asset (déclaré dans le XML) sert
// de clé, pour que ré-uploader un bundle sans changer tel ou tel visuel
// n'oblige pas à tout renvoyer.
export function beautyShotAssetPath(templateId: string, assetName: string, mimeType: string): string {
  return `${templateId}/beautyshot-${assetName}.${extensionForMimeType(mimeType)}`;
}

export function beautyShotXmlPath(templateId: string): string {
  return `${templateId}/beautyshot.xml`;
}

// Noms d'assets réellement utilisés par le rendu (fond, masque, overlays) —
// les autres entrées de <assets> peuvent être ignorées.
export function usedAssetNames(config: BeautyShotConfig): string[] {
  const names = new Set<string>();
  if (config.backgroundAssetName) names.add(config.backgroundAssetName);
  if (config.maskAssetName) names.add(config.maskAssetName);
  for (const overlay of config.overlays) names.add(overlay.assetName);
  return Array.from(names);
}

export function mimeTypeForAsset(config: BeautyShotConfig, assetName: string): string {
  return config.assets.find((a) => a.name === assetName)?.mimeType ?? "image/png";
}

// Lit le champ "beautyShotOverlayOpacities" envoyé par TemplateForm (un
// tableau de nombres 0-100, JSON, un par surcouche du XML). Retourne null
// (= 100 % partout) si absent ou invalide — jamais d'erreur bloquante pour
// ce réglage facultatif.
export function parseOverlayOpacitiesField(raw: FormDataEntryValue | null): number[] | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const values = parsed.map((v) => Number(v));
    if (values.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return null;
    return values;
  } catch {
    return null;
  }
}

async function buildDesignForZone(
  template: Template,
  // null = pas de visuel de fond choisi (voir coverCropToBuffer) — un
  // montage fait seulement de calques reste possible.
  sourceImage: Buffer | null,
  logoImage: Buffer | null,
  zoneWidthPx: number,
  zoneHeightPx: number,
  effectiveDpi: number,
  positionX: number,
  positionY: number,
  logoShadow: LogoShadowSettings | null,
  zoom = 1,
  imageRotation = 0,
  layers: ResolvedLayer[] = []
): Promise<Buffer> {
  const covered = await coverCropToBuffer(
    sourceImage,
    zoneWidthPx,
    zoneHeightPx,
    positionX,
    positionY,
    zoom,
    imageRotation
  );
  const withLayers = await compositeLayers(covered, layers, zoneWidthPx, zoneHeightPx, effectiveDpi);

  const composites: sharp.OverlayOptions[] = [];
  if (logoImage && template.logo_width_mm > 0) {
    const mmToPx = (mm: number) => Math.round((mm / 25.4) * effectiveDpi);
    const logoWidthPx = Math.max(1, mmToPx(template.logo_width_mm));
    const rawLogoPng = await rasterizeLogoToPng(logoImage, logoWidthPx);
    const meta = await sharp(rawLogoPng).metadata();
    const nativeW = meta.width ?? logoWidthPx;
    const nativeH = meta.height ?? logoWidthPx;
    const logoHeightPx = Math.max(1, Math.round(nativeH * (logoWidthPx / nativeW)));
    const logoPng = await sharp(rawLogoPng).resize(logoWidthPx, logoHeightPx).png().toBuffer();

    const marginXPx = mmToPx(template.logo_margin_x_mm);
    const marginYPx = mmToPx(template.logo_margin_y_mm);
    const left =
      template.logo_h_align === "left"
        ? marginXPx
        : template.logo_h_align === "right"
        ? zoneWidthPx - marginXPx - logoWidthPx
        : (zoneWidthPx - logoWidthPx) / 2;
    const top = template.logo_v_align === "top" ? marginYPx : zoneHeightPx - marginYPx - logoHeightPx;

    composites.push(
      await logoOverlay(
        logoPng,
        logoShadow,
        Math.round(Math.min(Math.max(left, 0), Math.max(zoneWidthPx - logoWidthPx, 0))),
        Math.round(Math.min(Math.max(top, 0), Math.max(zoneHeightPx - logoHeightPx, 0))),
        zoneWidthPx,
        zoneHeightPx
      )
    );
  }

  return sharp(withLayers)
    .flatten({ background: "#ffffff" })
    .composite(composites)
    .ensureAlpha()
    .png()
    .toBuffer();
}

export async function generateBeautyShotMockupPng(
  template: Template,
  config: BeautyShotConfig,
  assets: Map<string, Buffer>,
  // null = pas de visuel de fond choisi (voir coverCropToBuffer) — un
  // montage fait seulement de calques reste possible.
  sourceImage: Buffer | null,
  logoImage: Buffer | null,
  positionX = 0.5,
  positionY = 0.5,
  logoShadow: LogoShadowSettings | null = null,
  // Intensité (0-100) de chaque surcouche, dans l'ordre de config.overlays —
  // le XML ne décrit qu'un mode de fusion, jamais d'opacité ; c'est ce qui
  // rendait les mockups tout ou rien (souvent trop sombres avec "multiply").
  // null/manquant/hors de 0-100 = 100 (comportement d'origine, inchangé).
  overlayOpacities: (number | null | undefined)[] | null = null,
  // Zoom (recadrage) au-delà du minimum "cover" — voir coverCropToBuffer.
  // 1 = comportement d'origine (aucun appelant existant n'en envoie).
  zoom = 1,
  // Rotation du visuel lui-même (0/90/180/270) — voir coverCropToBuffer.
  imageRotation = 0,
  layers: ResolvedLayer[] = []
): Promise<Buffer> {
  const canvasWidth = Math.max(1, config.width);
  const canvasHeight = Math.max(1, config.height);
  const zone = config.zones.find((z) => z.id === "front") ?? config.zones[0];
  if (!zone || zone.width <= 0 || zone.height <= 0) {
    throw new Error("Le XML du beauty shot ne définit pas de zone d'image exploitable.");
  }

  const effectiveDpi = template.width_mm > 0 ? zone.width / (template.width_mm / 25.4) : template.dpi;
  const design = await buildDesignForZone(
    template,
    sourceImage,
    logoImage,
    Math.round(zone.width),
    Math.round(zone.height),
    effectiveDpi,
    positionX,
    positionY,
    logoShadow,
    zoom,
    imageRotation,
    layers
  );

  const maskBuffer = config.maskAssetName ? assets.get(config.maskAssetName) : null;
  const maskedDesign = maskBuffer
    ? await sharp(design)
        .composite([
          {
            input: await sharp(maskBuffer)
              .resize(Math.round(zone.width), Math.round(zone.height), { fit: "fill" })
              .ensureAlpha()
              .png()
              .toBuffer(),
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer()
    : design;

  const backgroundBuffer = config.backgroundAssetName ? assets.get(config.backgroundAssetName) : null;
  const base = backgroundBuffer
    ? await sharp(backgroundBuffer).resize(canvasWidth, canvasHeight, { fit: "cover" }).ensureAlpha().png().toBuffer()
    : await sharp({
        create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
      })
        .png()
        .toBuffer();

  let composed = await sharp(base)
    .composite([{ input: maskedDesign, left: Math.round(zone.left), top: Math.round(zone.top) }])
    .png()
    .toBuffer();

  for (let index = 0; index < config.overlays.length; index++) {
    const overlay = config.overlays[index];
    const overlayBuffer = assets.get(overlay.assetName);
    if (!overlayBuffer) continue;
    const rawOpacity = overlayOpacities?.[index];
    const opacity = typeof rawOpacity === "number" && rawOpacity >= 0 && rawOpacity <= 100 ? rawOpacity : 100;
    let overlayResized = await sharp(overlayBuffer)
      .resize(canvasWidth, canvasHeight, { fit: "fill" })
      .ensureAlpha()
      .png()
      .toBuffer();
    if (opacity < 100) {
      // Ne touche qu'au canal alpha (RGB inchangés) : réduit la présence de
      // la couche sans en délaver les teintes.
      overlayResized = await sharp(overlayResized)
        .linear([1, 1, 1, opacity / 100], [0, 0, 0, 0])
        .png()
        .toBuffer();
    }
    composed = await sharp(composed)
      .composite([{ input: overlayResized, blend: overlay.blendMode as sharp.Blend }])
      .png()
      .toBuffer();
  }

  if (!config.transparency) {
    composed = await sharp(composed).flatten({ background: "#ffffff" }).png().toBuffer();
  }

  return composed;
}
