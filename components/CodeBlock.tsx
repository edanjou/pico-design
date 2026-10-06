"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

// Bloc de code à copier tel quel (page Aide) : le bouton copie le texte exact,
// sans la mise en forme qu'un copier-coller depuis l'écran emporterait.
export default function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers refusé : le texte reste sélectionnable à la main.
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-1.5">
        <span className="truncate text-xs text-text-subtle">{label ?? "Code"}</span>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface hover:text-text"
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-success" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto bg-surface p-3 text-xs leading-relaxed text-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}
