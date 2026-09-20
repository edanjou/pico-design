"use client";

import { useState } from "react";
import MeasureField, { UnitToggle, type Unit } from "@/components/MeasureField";
import type { ImpositionCutter } from "@/lib/types";

// Réglages d'un profil de découpeuse qui influencent la grille (le nom et le
// fichier de marques sont gérés à part).
export type CutterSettings = Pick<
  ImpositionCutter,
  | "margin_top_mm"
  | "margin_right_mm"
  | "margin_bottom_mm"
  | "margin_left_mm"
  | "gutter_x_mm"
  | "gutter_y_mm"
  | "offset_x_mm"
  | "offset_y_mm"
  | "center_grid"
>;

export function cutterSettingsOf(cutter?: ImpositionCutter | null): CutterSettings {
  return {
    margin_top_mm: cutter?.margin_top_mm ?? 0,
    margin_right_mm: cutter?.margin_right_mm ?? 0,
    margin_bottom_mm: cutter?.margin_bottom_mm ?? 0,
    margin_left_mm: cutter?.margin_left_mm ?? 0,
    gutter_x_mm: cutter?.gutter_x_mm ?? 0,
    gutter_y_mm: cutter?.gutter_y_mm ?? 0,
    offset_x_mm: cutter?.offset_x_mm ?? 0,
    offset_y_mm: cutter?.offset_y_mm ?? 0,
    center_grid: cutter?.center_grid ?? true,
  };
}

type NumericKey = Exclude<keyof CutterSettings, "center_grid">;

// Champs de réglage partagés par le formulaire du profil et par le panneau
// « Ajuster » de l'écran d'imposition. Les champs gardent leur texte saisi
// localement : le parent doit changer la `key` de ce composant pour les
// réinitialiser après un changement venu de l'extérieur.
export default function CutterSettingsFields({
  value,
  onChange,
}: {
  value: CutterSettings;
  onChange: (next: CutterSettings) => void;
}) {
  const [unit, setUnit] = useState<Unit>("in");

  function measure(key: NumericKey, label: string, allowNegative?: boolean) {
    return (
      <MeasureField
        key={`${key}-${unit}`}
        label={label}
        valueMm={value[key]}
        unit={unit}
        allowNegative={allowNegative}
        onChange={(mm) => onChange({ ...value, [key]: mm })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Marges de la feuille (zone sans pièces)</span>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {measure("margin_top_mm", "Haut")}
        {measure("margin_right_mm", "Droite")}
        {measure("margin_bottom_mm", "Bas")}
        {measure("margin_left_mm", "Gauche")}
      </div>

      <div>
        <p className="text-sm font-medium">Espacement entre les pièces</p>
        <p className="text-xs text-neutral-500">Mesuré entre les bords du fond perdu de deux pièces voisines.</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {measure("gutter_x_mm", "Horizontal")}
          {measure("gutter_y_mm", "Vertical")}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Calibration</p>
        <p className="text-xs text-neutral-500">
          Décale toute la grille (positif = vers la droite / vers le bas) pour compenser la machine.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {measure("offset_x_mm", "Décalage horizontal", true)}
          {measure("offset_y_mm", "Décalage vertical", true)}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.center_grid}
            onChange={(e) => onChange({ ...value, center_grid: e.target.checked })}
          />
          Centrer la grille dans la zone utile (sinon, collée en haut à gauche)
        </label>
      </div>
    </div>
  );
}
