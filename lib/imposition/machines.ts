// Les deux machines de découpe. La Duplo n'est pas réglée par l'outil : sa
// grille vient de son catalogue de jobs. La Graphtec l'est, par des profils de
// découpe (feuille, grille, marges, espacement, marques, gabarit).

export const MACHINES = ["duplo", "graphtec"] as const;
export type CutterMachine = (typeof MACHINES)[number];

export const MACHINE_LABELS: Record<CutterMachine, string> = {
  duplo: "Duplo DC-618",
  graphtec: "Graphtec CE8000-40",
};

export function isMachine(value: unknown): value is CutterMachine {
  return (MACHINES as readonly unknown[]).includes(value);
}
