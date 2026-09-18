"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { CopyIcon, SpinnerIcon } from "@/components/icons";

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function UserForm({
  user,
  currentUserId,
  onSuccess,
}: {
  user?: Profile & { email: string };
  currentUserId: string;
  onSuccess: () => void;
}) {
  const isEditing = Boolean(user);
  const isSelf = user?.id === currentUserId;
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<"admin" | "designer" | "gestionnaire">(user?.role ?? "designer");
  const [password, setPassword] = useState(isEditing ? "" : generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible (permissions navigateur) — sans
      // conséquence, l'admin peut toujours sélectionner/copier manuellement.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = { fullName, role, email };
    if (password) body.password = password;

    const res = await fetch(isEditing ? `/api/users/${user!.id}` : "/api/users", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nom complet</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Courriel</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Rôle</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "designer" | "gestionnaire")}
          disabled={isSelf}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
        >
          <option value="designer">Designer</option>
          <option value="gestionnaire">Gestionnaire</option>
          <option value="admin">Administrateur</option>
        </select>
        {isSelf && (
          <p className="mt-1 text-xs text-neutral-500">Vous ne pouvez pas modifier votre propre rôle.</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">
          {isEditing ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type={showPassword ? "text" : "password"}
            required={!isEditing}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEditing ? "Laisser vide pour ne pas changer" : undefined}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            {showPassword ? "Masquer" : "Afficher"}
          </button>
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Générer
          </button>
          {password && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copier"
              aria-label="Copier"
              className="shrink-0 rounded-lg border border-neutral-300 p-2 text-neutral-600 hover:bg-neutral-50"
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        {copied && <p className="mt-1 text-xs text-green-600">Copié.</p>}
        {!isEditing && (
          <p className="mt-1 text-xs text-neutral-500">
            Communiquez ce mot de passe à l&apos;employé — il ne sera plus affiché après la création.
          </p>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-pico-maroon px-4 py-2 text-sm font-medium text-white hover:bg-pico-maroon-dark disabled:opacity-50"
      >
        {saving && <SpinnerIcon className="h-4 w-4" />}
        {isEditing ? "Enregistrer" : "Créer le compte"}
      </button>
    </form>
  );
}
