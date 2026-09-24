"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";

/**
 * Zone de dépôt de fichier (glisser-déposer ou clic pour parcourir), à la
 * place d'un simple `<input type="file">`. Purement présentationnel : ne
 * gère aucun état de fichier lui-même, juste la sélection/le survol.
 */
export default function FileDropZone({
  file,
  onFileChange,
  accept,
  previewUrl,
  helpText,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept: string;
  // Aperçu miniature à afficher une fois un fichier choisi (image locale
  // uniquement — un PDF n'a pas d'aperçu <img> direct, voir helpText).
  previewUrl?: string | null;
  helpText?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFileChange(e.dataTransfer.files?.[0] ?? null);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? "border-primary bg-primary-subtle" : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="max-h-40 rounded-lg object-contain" />
      ) : (
        <UploadIcon className="h-8 w-8 text-text-subtle" />
      )}
      <p className="text-sm font-medium text-text">
        {file ? file.name : "Glisse un fichier ici, ou clique pour parcourir"}
      </p>
      {helpText && <p className="text-xs text-text-subtle">{helpText}</p>}
      {file && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFileChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="text-xs text-text-subtle underline hover:text-text"
        >
          Retirer
        </button>
      )}
    </div>
  );
}
