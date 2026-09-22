// Règle de robustesse des mots de passe, partagée entre le formulaire (retour
// immédiat + indicateur de robustesse) et les routes API (appliquée pour de
// vrai) — que ce soit un compte créé par un admin, réinitialisé par un admin,
// ou changé par l'utilisateur lui-même.
export const PASSWORD_MIN_LENGTH = 10;

// null = mot de passe accepté ; sinon le message à afficher (en français).
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (!/[a-z]/.test(password)) return "Le mot de passe doit contenir au moins une minuscule.";
  if (!/[A-Z]/.test(password)) return "Le mot de passe doit contenir au moins une majuscule.";
  if (!/[0-9]/.test(password)) return "Le mot de passe doit contenir au moins un chiffre.";
  return null;
}

// Générateur utilisé par le formulaire admin (bouton "Générer") — construit
// pour toujours satisfaire validatePassword ci-dessus (au moins une
// minuscule, une majuscule et un chiffre garantis, pas seulement probables).
// Caractères ambigus (I, O, l, o, 0, 1) exclus pour rester lisible si
// communiqué à voix haute ou recopié à la main.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALL = LOWER + UPPER + DIGITS;
const pick = (set: string) => set[Math.floor(Math.random() * set.length)];

export function generateSecurePassword(length = 14): string {
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => pick(ALL));
  const chars = [...required, ...rest];
  // Fisher-Yates : les caractères garantis ne se retrouvent pas toujours aux mêmes positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

// Indicateur affiché pendant la saisie (pas une validation à elle seule —
// un mot de passe peut être "fort" selon ce score et rester refusé par
// validatePassword, ex. sans majuscule). Longueur d'abord, variété ensuite.
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 14) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (classes >= 3) score++;
  if (classes >= 4 && password.length >= 12) score++;
  const labels = ["Très faible", "Faible", "Moyen", "Bon", "Excellent"] as const;
  return { score: score as PasswordStrength["score"], label: labels[score] };
}
