/**
 * Dépôt direct des fichiers de l'outil de design dans le stockage (voir
 * supabase/migrations/0069_design_staging.sql). Partagé par le navigateur
 * (lib/design/stageUpload.ts) et le serveur (lib/design/stagedFiles.ts) :
 * même bucket, même forme de chemin, même codage dans le FormData.
 */

export const STAGING_BUCKET = "design-staging";

// <AAAA-MM-JJ>/<uuid> : rien d'autre n'est relu, ce qui interdit de faire
// lire au serveur un fichier qui n'a pas été déposé par ce mécanisme.
export const STAGED_PATH = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}$/;

// Un fichier déposé est remplacé dans le FormData par cette chaîne : le
// préfixe, puis son chemin, son nom et son type en JSON.
const PREFIX = "pico-staged:";

export interface StagedRef {
  path: string;
  name: string;
  type: string;
}

export function encodeStaged(ref: StagedRef): string {
  return PREFIX + JSON.stringify(ref);
}

export function decodeStaged(value: unknown): StagedRef | null {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return null;
  try {
    const ref = JSON.parse(value.slice(PREFIX.length));
    if (typeof ref?.path !== "string" || !STAGED_PATH.test(ref.path)) return null;
    return {
      path: ref.path,
      name: typeof ref.name === "string" ? ref.name : "fichier",
      type: typeof ref.type === "string" ? ref.type : "",
    };
  } catch {
    return null;
  }
}
