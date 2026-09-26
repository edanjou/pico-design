"use client";

/**
 * Interrupteur (toggle) générique — utilisé pour « Afficher les guides
 * d'impression » dans DesignEditor. Un simple `<button role="switch">`
 * stylé (pas un `<input type="checkbox">` caché) : plus facile à positionner
 * pile comme le Figma (pastille qui glisse) qu'un checkbox natif redessiné.
 */
export default function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full p-0 transition-colors ${
        checked ? "bg-primary" : "bg-surface-muted"
      }`}
    >
      {/* `left-0.5` explicite (pas seulement `top-0.5` + translate) : sans
          `left`, un enfant en `absolute` se positionne selon sa "position
          statique" — qui dépend du padding par défaut du navigateur sur
          `<button>` (jamais réinitialisé sinon), pas forcément 0. Le rond
          finissait décalé/à moitié caché selon le navigateur. `left-0.5` +
          `translate-x-4` (au lieu de `translate-x-[18px]`) part d'un point
          de départ connu (2px du bord) des deux côtés une fois glissé
          (2 + 16 + 2 = 20px de piste utile sur les 36px, rond de 16px). */}
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
