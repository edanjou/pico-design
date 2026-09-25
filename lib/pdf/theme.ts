import sharp from "sharp";
import { coverCropToBuffer } from "./crop";
import type { ThemeSlot, ThemeSlotAdjust } from "../types";

const DEFAULT_ADJUST: ThemeSlotAdjust = { positionX: 0.5, positionY: 0.5, scale: 1 };

/**
 * Compose le rendu d'un Thème : chaque photo du client est recadrée en
 * "cover" pour remplir exactement son emplacement (voir ThemeSlot — même
 * convention que ShapeLayer : positionX/Y = centre, widthRatio/heightRatio
 * relatifs à la page), déplacée/zoomée dans ce rectangle selon l'ajustement
 * du client (`slotAdjust[i]`, voir ThemeSlotAdjust — même mécanique que
 * positionX/positionY/scale pour un fond simple, voir coverCropToBuffer),
 * sur un fond blanc, puis le graphisme du thème (`overlayImage`, avec
 * transparence) est posé par-dessus — ses zones opaques (cadre, décor)
 * restent visibles, ses zones transparentes laissent voir les photos en
 * dessous.
 *
 * Un emplacement sans photo (`slotFiles[i]` null) reste simplement blanc à
 * cet endroit — comme un fond absent ailleurs dans l'app (voir
 * coverCropToBuffer) : permet de prévisualiser/imprimer un thème même
 * partiellement rempli.
 */
export async function composeThemeImage(
  slotFiles: (Buffer | null)[],
  slots: ThemeSlot[],
  overlayImage: Buffer,
  targetWidthPx: number,
  targetHeightPx: number,
  slotAdjust: (ThemeSlotAdjust | null | undefined)[] = []
): Promise<Buffer> {
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < slots.length; i++) {
    const file = slotFiles[i] ?? null;
    if (!file) continue;
    const slot = slots[i];
    const adjust = slotAdjust[i] ?? DEFAULT_ADJUST;
    // Bornés à la taille de la page (au cas où) : l'éditeur admin contraint
    // déjà chaque emplacement à rester dans la page, mais sharp refuse un
    // composite qui déborderait de son fond — filet de sécurité plutôt
    // qu'une confiance aveugle dans les données enregistrées.
    const widthPx = Math.min(targetWidthPx, Math.max(1, Math.round(slot.widthRatio * targetWidthPx)));
    const heightPx = Math.min(targetHeightPx, Math.max(1, Math.round(slot.heightRatio * targetHeightPx)));
    const rawLeft = Math.round(slot.positionX * targetWidthPx - widthPx / 2);
    const rawTop = Math.round(slot.positionY * targetHeightPx - heightPx / 2);
    const left = Math.min(Math.max(0, rawLeft), targetWidthPx - widthPx);
    const top = Math.min(Math.max(0, rawTop), targetHeightPx - heightPx);
    const cropped = await coverCropToBuffer(file, widthPx, heightPx, adjust.positionX, adjust.positionY, adjust.scale);
    composites.push({ input: cropped, left, top });
  }

  const overlayResized = await sharp(overlayImage)
    .resize(targetWidthPx, targetHeightPx, { fit: "fill" })
    .png()
    .toBuffer();
  composites.push({ input: overlayResized, left: 0, top: 0 });

  return sharp({
    create: { width: targetWidthPx, height: targetHeightPx, channels: 3, background: "#ffffff" },
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();
}

// Lit le champ "slots" envoyé par ThemeForm (un tableau JSON de 1 à 3
// ThemeSlot) — retourne null si absent/invalide (jamais d'erreur bloquante,
// mais un thème sans emplacement valide n'a pas de sens : les appelants
// traitent null comme une erreur de validation, contrairement aux champs
// facultatifs comme les marques de pli).
export function parseThemeSlotsField(raw: FormDataEntryValue | null): ThemeSlot[] | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 3) return null;
    const slots: ThemeSlot[] = parsed.map((s) => ({
      positionX: Number(s?.positionX),
      positionY: Number(s?.positionY),
      widthRatio: Number(s?.widthRatio),
      heightRatio: Number(s?.heightRatio),
    }));
    if (slots.some((s) => Object.values(s).some((n) => !Number.isFinite(n)))) return null;
    return slots;
  } catch {
    return null;
  }
}

// Lit le champ "themeSlotAdjust" envoyé par le client (Design Shopify) — un
// tableau JSON de ThemeSlotAdjust, un par emplacement, dans le même ordre
// que `theme.slots`. Retourne [] (= cadrage "cover" par défaut partout) si
// absent/invalide — jamais bloquant, contrairement à parseThemeSlotsField
// (les emplacements eux-mêmes, définis par l'admin).
export function parseThemeSlotAdjustField(raw: FormDataEntryValue | null): ThemeSlotAdjust[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => {
      const positionX = Number(s?.positionX);
      const positionY = Number(s?.positionY);
      const scale = Number(s?.scale);
      return {
        positionX: Number.isFinite(positionX) ? positionX : 0.5,
        positionY: Number.isFinite(positionY) ? positionY : 0.5,
        scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
      };
    });
  } catch {
    return [];
  }
}
