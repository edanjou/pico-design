import { mmToPx } from "./units";
import type { ShapeLayer } from "../design/layers";

// Groupe SVG (`<g>`) pour un calque forme — même principe que
// textLayerToSvgGroup (lib/pdf/textLayer.ts) : un fragment prêt à composer
// (voir lib/pdf/layers.ts) sur un canevas de `targetWidthPx`×`targetHeightPx`.
// Pas de dépendance à une police ou à fontkit ici, juste du SVG natif
// (<rect>/<ellipse>) — librsvg (via sharp) le rasterise directement.
export function shapeLayerToSvgGroup(
  layer: ShapeLayer,
  targetWidthPx: number,
  targetHeightPx: number,
  dpi: number
): string {
  const widthPx = layer.widthRatio * targetWidthPx;
  const heightPx = layer.heightRatio * targetHeightPx;
  const centerX = layer.positionX * targetWidthPx;
  const centerY = layer.positionY * targetHeightPx;

  const strokeWidthPx = mmToPx(layer.strokeWidthMm ?? 0, dpi);
  const fillAttr = layer.fillEnabled ? `fill="${layer.fillColor}"` : `fill="none"`;
  const strokeAttrs = strokeWidthPx > 0 ? ` stroke="${layer.strokeColor}" stroke-width="${strokeWidthPx}"` : "";

  const shapeEl =
    layer.shape === "ellipse"
      ? `<ellipse cx="${centerX}" cy="${centerY}" rx="${widthPx / 2}" ry="${heightPx / 2}" ${fillAttr}${strokeAttrs}/>`
      : `<rect x="${centerX - widthPx / 2}" y="${centerY - heightPx / 2}" width="${widthPx}" height="${heightPx}" ${fillAttr}${strokeAttrs}/>`;

  const rotationDeg = layer.rotationDeg ?? 0;
  const transformAttr = rotationDeg ? ` transform="rotate(${rotationDeg} ${centerX} ${centerY})"` : "";

  return `<g${transformAttr} opacity="${layer.opacity ?? 1}">${shapeEl}</g>`;
}
