// Les deux machines de découpe. L'outil ne les configure pas : il utilise les
// paramètres qu'elles fournissent (pour la Duplo, son catalogue de jobs ; ceux
// de la Graphtec seront ajoutés plus tard).

export const MACHINES = ["duplo", "graphtec"] as const;
export type CutterMachine = (typeof MACHINES)[number];

export const MACHINE_LABELS: Record<CutterMachine, string> = {
  duplo: "Duplo DC-618",
  graphtec: "Graphtec CE8000-40",
};

export function isMachine(value: unknown): value is CutterMachine {
  return (MACHINES as readonly unknown[]).includes(value);
}
