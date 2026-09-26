import type { CSSProperties } from "react";

// Dégradé inline pour un <input type="range" className="pico-range"> (voir
// app/globals.css) : la portion déjà parcourue en bourgogne (--primary), le
// reste en gris clair (--surface-muted) — comme la piste du Figma de
// l'Outil Shopify. Un input natif ne sait pas colorer sa piste en deux
// couleurs autour de la poignée sans ça.
export function rangeFillStyle(value: number, min: number, max: number): CSSProperties {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const clamped = Math.min(100, Math.max(0, pct));
  return {
    background: `linear-gradient(to right, var(--primary) ${clamped}%, var(--surface-muted) ${clamped}%)`,
  };
}
