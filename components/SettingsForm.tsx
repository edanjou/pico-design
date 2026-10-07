"use client";

import { useState } from "react";
import ColorPickerButton from "@/components/ColorPickerButton";
import FileDropZone from "@/components/FileDropZone";
import { SpinnerIcon } from "@/components/icons";
import { rangeFillStyle } from "@/components/ui/rangeFill";
import {
  COLOR_FIELDS,
  defaultAppSettings,
  isShopScope,
  scopeLabel,
  SETTINGS_SCOPES,
  BRAND_FONTS,
  TYPOGRAPHY_LIMITS,
  UI_FONT_CHOICES,
  assetUrl,
  type AppSettings,
  type ColorKey,
  type SettingsScope,
  type FontChoice,
  type TypographySettings,
} from "@/lib/appSettings";

type Uploads = {
  logo: File | null;
  favicon: File | null;
  share: File | null;
  fontBody: File | null;
  fontHeading: File | null;
};

const EMPTY_UPLOADS: Uploads = {
  logo: null,
  favicon: null,
  share: null,
  fontBody: null,
  fontHeading: null,
};

const IMAGE_SLOTS = [
  {
    field: "logo",
    label: "Logo de l'en-tête",
    accept: ".svg,.png,.webp,.jpg,.jpeg",
    slot: "logo",
  },
  {
    field: "favicon",
    label: "Favicon (icône d'onglet)",
    accept: ".svg,.png,.ico",
    slot: "favicon",
  },
  {
    field: "share",
    label: "Image de partage",
    accept: ".png,.jpg,.jpeg,.webp",
    slot: "share",
  },
] as const;

const FONT_SLOTS = [
  { field: "fontBody", label: "Police du texte", slot: "font-body" },
  { field: "fontHeading", label: "Police des titres", slot: "font-heading" },
] as const;

/**
 * Module Paramètres : l'identité visuelle de l'outil, en deux jeux
 * indépendants (voir lib/appSettings.ts). Chaque onglet édite un jeu et
 * s'enregistre séparément — changer l'administration ne touche pas à
 * l'Outil Shopify.
 */
// Adresse que chaque boutique appelle à chaque commande (Paramètres >
// Notifications > Webhooks, côté Shopify).
const WEBHOOK_URL = "https://pico-design.vercel.app/api/shopify/webhook";

/**
 * Secret de signature des webhooks de commande d'une boutique. La valeur est
 * envoyée au serveur, jamais relue : l'écran sait seulement si elle est
 * configurée (voir app/api/settings/webhook-secret).
 */
function WebhookSecretSection({
  shop,
  configured,
  onChange,
}: {
  shop: string;
  configured: boolean;
  onChange: (configured: boolean) => void;
}) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/settings/webhook-secret", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, secret }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setMessage({ kind: "error", text: data.error ?? "L'enregistrement a échoué." });
      return;
    }
    setSecret("");
    onChange(true);
    setMessage({ kind: "ok", text: "Secret enregistré : les commandes de cette boutique seront acceptées." });
  }

  async function remove() {
    if (!confirm(`Retirer le secret de ${shop} ? Ses commandes ne seront plus reçues.`)) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/settings/webhook-secret?shop=${encodeURIComponent(shop)}`, { method: "DELETE" }).catch(
      () => null
    );
    setBusy(false);
    if (!res?.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      setMessage({ kind: "error", text: data.error ?? "Le retrait a échoué." });
      return;
    }
    onChange(false);
    setMessage({ kind: "ok", text: "Secret retiré." });
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Webhook des commandes</h2>
        <span className={`text-xs font-medium ${configured ? "text-success" : "text-warning"}`}>
          {configured ? "✓ Secret configuré" : "Secret non configuré : les commandes ne sont pas reçues"}
        </span>
      </div>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-text-subtle">
        <li>
          Dans Shopify : Paramètres → Notifications → Webhooks. Créez deux webhooks (« Création de commande » et
          « Mise à jour de commande », format JSON) vers{" "}
          <code className="select-all rounded bg-surface-muted px-1 text-text">{WEBHOOK_URL}</code>
        </li>
        <li>
          Copiez la clé indiquée en bas de cette page Shopify (« Vos webhooks seront signés avec… ») et collez-la
          ci-dessous.
        </li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={configured ? "Coller une nouvelle clé pour la remplacer" : "Clé de signature Shopify"}
          aria-label="Clé de signature des webhooks"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !secret.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-primary-hover disabled:opacity-50"
        >
          Enregistrer
        </button>
        {configured && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm text-danger hover:bg-surface-muted disabled:opacity-50"
          >
            Retirer
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-text-subtle">
        La clé n&apos;est jamais réaffichée, ni ici ni ailleurs : pour la changer, collez la nouvelle.
      </p>
      {message && (
        <p className={`mt-2 text-xs ${message.kind === "ok" ? "text-text" : "text-danger"}`}>{message.text}</p>
      )}
    </section>
  );
}

export default function SettingsForm({
  initial,
  boutiques,
  webhookShops = [],
}: {
  initial: Record<SettingsScope, AppSettings>;
  // Domaines des boutiques déjà connues (réglages existants ou secret de
  // webhook). Une boutique absente d'ici peut être ajoutée à la main.
  boutiques: string[];
  // Boutiques dont le secret de webhook est enregistré (domaines seulement).
  webhookShops?: string[];
}) {
  const [scope, setScope] = useState<SettingsScope>("admin");
  const [shops, setShops] = useState(boutiques);
  const [secretShops, setSecretShops] = useState(() => new Set(webhookShops));
  const [settings, setSettings] = useState(initial);
  // Une entrée par jeu — y compris les boutiques. Un objet limité à
  // « admin » et « tool » plantait dès qu'on sélectionnait une boutique, et
  // planterait encore sur une boutique ajoutée en cours de route : d'où
  // l'accès par `uploadsDe`, qui ne suppose jamais l'entrée présente.
  const [uploads, setUploads] = useState<Record<string, Uploads>>(() =>
    Object.fromEntries(Object.keys(initial).map((s) => [s, { ...EMPTY_UPLOADS }]))
  );

  const uploadsDe = (s: SettingsScope): Uploads => uploads[s] ?? EMPTY_UPLOADS;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const current = settings[scope];

  function patch(next: Partial<AppSettings>) {
    setSettings((all) => ({ ...all, [scope]: { ...all[scope], ...next } }));
  }

  function setColor(key: ColorKey, hex: string) {
    patch({ colors: { ...current.colors, [key]: hex } });
  }

  function resetColor(key: ColorKey) {
    const next = { ...current.colors };
    delete next[key];
    patch({ colors: next });
  }

  function setTypography(next: Partial<TypographySettings>) {
    patch({ typography: { ...current.typography, ...next } });
  }

  function setUpload(field: keyof Uploads, file: File | null) {
    setUploads((all) => ({
      ...all,
      [scope]: { ...(all[scope] ?? EMPTY_UPLOADS), [field]: file },
    }));
  }

  async function handleSave() {
    setBusy(true);
    setMessage(null);

    const body = new FormData();
    body.append("colors", JSON.stringify(current.colors));
    body.append("typography", JSON.stringify(current.typography));
    for (const [field, file] of Object.entries(uploadsDe(scope))) {
      if (file) body.append(field, file);
    }

    const res = await fetch(`/api/settings/${scope}`, {
      method: "PATCH",
      body,
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({
        kind: "error",
        text: data.error ?? "Erreur lors de l'enregistrement.",
      });
      return;
    }
    setUploads((all) => ({ ...all, [scope]: { ...EMPTY_UPLOADS } }));
    setMessage({
      kind: "ok",
      text: "Enregistré. Recharge la page pour voir l'interface changer.",
    });
  }

  /**
   * Retire une boutique de la liste. Action destructive : la confirmation
   * nomme la boutique, une liste d'onglets se cliquant vite.
   *
   * La boutique peut revenir au rechargement si son secret de webhook est
   * enregistré (voir app/settings/page.tsx) — elle est alors connue, mais revenue à
   * l'habillage par défaut. Le message le dit plutôt que de laisser croire à
   * un échec.
   */
  async function handleDeleteShop() {
    if (
      !confirm(
        `Supprimer les réglages de ${scope} ?\n\nLes couleurs, la typographie et les fichiers de cette boutique seront perdus. Elle reprendra l'habillage « Outil Shopify (par défaut) ».`,
      )
    )
      return;

    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/settings/${scope}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({
        kind: "error",
        text: data.error ?? "Erreur lors de la suppression.",
      });
      return;
    }

    const supprimée = scope;
    setShops((all) => all.filter((s) => s !== supprimée));
    setSettings((all) => {
      const reste = { ...all };
      delete reste[supprimée];
      return reste;
    });
    setUploads((all) => {
      const reste = { ...all };
      delete reste[supprimée];
      return reste;
    });
    setScope("tool");
    setMessage({
      kind: "ok",
      text: `${supprimée} supprimée. Si son secret de webhook est enregistré, elle restera proposée au rechargement, avec l'habillage par défaut.`,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-page-title text-text">Paramètres</h1>
        <p className="mt-1 text-sm text-text-muted">
          L&apos;identité visuelle de l&apos;outil : couleurs, typographie et
          logos. Les deux jeux sont indépendants — l&apos;écran vu par les
          clients peut différer de l&apos;administration.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[...SETTINGS_SCOPES, ...shops].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setScope(key)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              scope === key
                ? "border-primary bg-primary text-text-on-brand"
                : "border-border text-text-muted hover:bg-surface-muted"
            }`}
          >
            {scopeLabel(key)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const domaine = prompt(
              "Domaine de la boutique (ex. ma-boutique.myshopify.com)",
            )
              ?.trim()
              .toLowerCase();
            if (!domaine) return;
            if (!isShopScope(domaine)) {
              setMessage({
                kind: "error",
                text: "Ce domaine n'est pas valide.",
              });
              return;
            }
            if (!shops.includes(domaine))
              setShops((all) => [...all, domaine].sort());
            setSettings((all) => ({
              ...all,
              [domaine]: all[domaine] ?? defaultAppSettings(domaine),
            }));
            setScope(domaine);
          }}
          className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-text-subtle hover:text-text"
        >
          + Boutique
        </button>
      </div>

      {isShopScope(String(scope)) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-subtle">
            Réglages propres à cette boutique. Ce qui n&apos;est pas défini ici
            reprend « Outil Shopify (par défaut) ».
          </p>
          <button
            type="button"
            onClick={handleDeleteShop}
            disabled={busy}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-danger hover:bg-surface-muted disabled:opacity-50"
          >
            Supprimer cette boutique
          </button>
        </div>
      )}

      {isShopScope(String(scope)) && (
        <WebhookSecretSection
          key={scope}
          shop={String(scope)}
          configured={secretShops.has(String(scope))}
          onChange={(configured) =>
            setSecretShops((all) => {
              const next = new Set(all);
              if (configured) next.add(String(scope));
              else next.delete(String(scope));
              return next;
            })
          }
        />
      )}

      {message && (
        <p
          className={`rounded-lg border p-3 text-sm ${
            message.kind === "ok"
              ? "border-border bg-surface-muted text-text"
              : "border-warning bg-warning-subtle text-text"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">Couleurs</h2>
        <p className="mt-0.5 text-xs text-text-subtle">
          Huit réglages seulement : toutes les autres teintes de
          l&apos;interface en découlent.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {COLOR_FIELDS.map((field) => {
            const value = current.colors[field.key] ?? field.default;
            const custom = current.colors[field.key] !== undefined;
            return (
              <div key={field.key} className="flex items-center gap-2">
                <ColorPickerButton
                  value={value}
                  onChange={(hex) => setColor(field.key, hex)}
                  label={field.label}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  {field.label}
                </span>
                {custom && (
                  <button
                    type="button"
                    onClick={() => resetColor(field.key)}
                    className="shrink-0 text-xs text-text-subtle underline hover:text-text"
                  >
                    défaut
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">Typographie</h2>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <FontSelect
            label="Police du texte"
            value={current.typography.bodyFont}
            onChange={(bodyFont) => setTypography({ bodyFont })}
            disabled={
              Boolean(current.fontBodyPath) || Boolean(uploadsDe(scope).fontBody)
            }
          />
          <FontSelect
            label="Police des titres"
            value={current.typography.headingFont}
            onChange={(headingFont) => setTypography({ headingFont })}
            disabled={
              Boolean(current.fontHeadingPath) ||
              Boolean(uploadsDe(scope).fontHeading)
            }
          />
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium text-text">Police personnalisée</p>
          <p className="mt-0.5 text-xs text-text-subtle">
            Un fichier déposé ici prime sur le choix ci-dessus.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {FONT_SLOTS.map((slot) => (
              <div key={slot.field}>
                <label className="block text-sm font-medium text-text">
                  {slot.label}
                </label>
                <p className="mb-1 text-xs text-text-subtle">
                  .woff2, .woff, .otf ou .ttf
                </p>
                <FileDropZone
                  file={uploadsDe(scope)[slot.field]}
                  onFileChange={(file) => setUpload(slot.field, file)}
                  accept=".woff2,.woff,.otf,.ttf"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Slider
            label="Taille de référence"
            suffix=" px"
            value={current.typography.baseSizePx}
            min={TYPOGRAPHY_LIMITS.baseSizePx.min}
            max={TYPOGRAPHY_LIMITS.baseSizePx.max}
            step={1}
            onChange={(baseSizePx) => setTypography({ baseSizePx })}
            help="Met toute l'interface à l'échelle d'un seul réglage."
          />
          <Slider
            label="Graisse du texte"
            value={current.typography.bodyWeight}
            min={TYPOGRAPHY_LIMITS.weight.min}
            max={TYPOGRAPHY_LIMITS.weight.max}
            step={100}
            onChange={(bodyWeight) => setTypography({ bodyWeight })}
          />
          <Slider
            label="Graisse des titres"
            value={current.typography.headingWeight}
            min={TYPOGRAPHY_LIMITS.weight.min}
            max={TYPOGRAPHY_LIMITS.weight.max}
            step={100}
            onChange={(headingWeight) => setTypography({ headingWeight })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">Identité</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {IMAGE_SLOTS.map((slot) => (
            <div key={slot.field}>
              <label className="block text-sm font-medium text-text">
                {slot.label}
              </label>
              <div className="mt-1">
                <FileDropZone
                  file={uploadsDe(scope)[slot.field]}
                  onFileChange={(file) => setUpload(slot.field, file)}
                  accept={slot.accept}
                  previewUrl={
                    uploadsDe(scope)[slot.field]
                      ? null
                      : assetUrl(
                          scope,
                          slot.slot as "logo" | "favicon" | "share",
                          current.updatedAt,
                        )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Aperçu : les valeurs en cours d'édition appliquées à un échantillon,
          pour juger sans enregistrer. Les couleurs sont posées en style
          inline sur ce bloc seulement — elles ne touchent pas la page. */}
      <section
        className="rounded-xl border p-4"
        style={{
          backgroundColor: current.colors.background ?? COLOR_FIELDS[3].default,
          borderColor: current.colors.border ?? COLOR_FIELDS[5].default,
          fontSize: `${current.typography.baseSizePx}px`,
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: current.colors.text ?? COLOR_FIELDS[6].default }}
        >
          Aperçu
        </h2>
        <div
          className="mt-3 rounded-lg p-4"
          style={{
            backgroundColor: current.colors.surface ?? COLOR_FIELDS[4].default,
            borderColor: current.colors.border ?? COLOR_FIELDS[5].default,
            borderWidth: 1,
          }}
        >
          <p
            className="font-display"
            style={{
              color: current.colors.text ?? COLOR_FIELDS[6].default,
              fontWeight: current.typography.headingWeight,
              fontSize: "1.4em",
            }}
          >
            Un titre d&apos;exemple
          </p>
          <p
            className="mt-1"
            style={{
              color: current.colors.textMuted ?? COLOR_FIELDS[7].default,
              fontWeight: current.typography.bodyWeight,
            }}
          >
            Un paragraphe de texte courant, pour juger la lisibilité.
          </p>
          <div className="mt-3 flex gap-2">
            <span
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{
                backgroundColor:
                  current.colors.primary ?? COLOR_FIELDS[0].default,
                color: "#fff",
              }}
            >
              Bouton principal
            </span>
            <span
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{
                backgroundColor:
                  current.colors.accent ?? COLOR_FIELDS[2].default,
                color: "#fff",
              }}
            >
              Accent
            </span>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-primary-hover disabled:opacity-40"
      >
        {busy && <SpinnerIcon className="h-4 w-4" />}
        Enregistrer « {scopeLabel(scope)} »
      </button>
    </div>
  );
}

/**
 * Catalogue Google Fonts (voir UI_FONT_CHOICES). L'aperçu de chaque nom est
 * rendu dans sa propre police quand le navigateur l'a déjà, sinon dans la
 * police courante — inutile de charger 40 feuilles de style pour une liste
 * déroulante.
 */
function FontSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: FontChoice | null;
  onChange: (value: FontChoice | null) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange((e.target.value || null) as FontChoice | null)
        }
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
      >
        <option value="">Par défaut</option>
        <optgroup label="Polices de marque">
          {BRAND_FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Google Fonts">
          {UI_FONT_CHOICES.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </optgroup>
      </select>
      {disabled && (
        <p className="mt-0.5 text-[11px] text-text-subtle">
          Un fichier de police est en place : il a la priorité.
        </p>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix?: string;
  help?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-text">{label}</span>
        <span className="text-text-muted">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
        className="pico-range mt-1 w-full"
        style={rangeFillStyle(value, min, max)}
      />
      {help && <p className="mt-0.5 text-[11px] text-text-subtle">{help}</p>}
    </div>
  );
}
