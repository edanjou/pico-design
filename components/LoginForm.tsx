"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SpinnerIcon } from "@/components/icons";

const inputClass =
  "h-11 rounded-lg border border-border bg-surface px-3.5 text-text shadow-sm outline-none transition-all duration-150 placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_10%,transparent)]";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      // Supabase répond en anglais : on traduit le cas courant.
      setError(
        error.message === "Invalid login credentials" ? "Courriel ou mot de passe incorrect." : error.message
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh">
      {/* Panneau de marque (grands écrans seulement). */}
      <aside
        className="relative hidden w-[44%] flex-col justify-between overflow-hidden p-10 lg:flex"
        style={{ background: "linear-gradient(165deg, #4d0c1f 0%, var(--pico-bourgogne) 45%, #7a1a35 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(55% 45% at 85% 8%, rgb(255 153 204 / 0.22), transparent 65%), radial-gradient(70% 55% at 8% 95%, rgb(255 102 51 / 0.28), transparent 60%), radial-gradient(45% 40% at 60% 60%, rgb(219 189 243 / 0.10), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative">
          {/* Le logo est noir : on l'inverse en blanc sur le fond bordeaux. */}
          <img
            src="/pico-noir.svg"
            alt="Pico"
            width={120}
            className="h-auto"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>
        <div className="relative max-w-md">
          <h2 className="font-heading text-4xl leading-tight tracking-display text-white xl:text-5xl">
            Du visuel au PDF prêt à imprimer.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Modèles, visuels, produits et imposition — Pico Design prépare les fichiers d&apos;impression de
            PicoLabo.
          </p>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} PicoLabo · Plateforme interne</p>
      </aside>

      {/* Formulaire */}
      <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: "radial-gradient(50% 40% at 50% 0%, rgb(252 199 176 / 0.35), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-sm">
          <div className="auth-card-in mb-8 text-center lg:text-left">
            <img src="/pico-noir.svg" alt="Pico" width={96} className="mx-auto h-auto lg:hidden" />
            <h1 className="mt-6 font-heading text-3xl tracking-display text-text lg:mt-0">Bon retour.</h1>
            <p className="mt-1.5 text-sm text-text-muted">Connecte-toi à ton espace de travail.</p>
          </div>

          <div className="auth-card-in-late rounded-2xl bg-surface p-7 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-12px_rgb(99_16_40/0.18)]">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-text">
                  Courriel
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-text">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {error && (
                <p role="alert" className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-primary px-6 font-heading text-base font-semibold tracking-display text-text-on-brand transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading && <SpinnerIcon className="h-4 w-4" />}
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          </div>

          <p className="auth-card-in-late mt-6 text-center text-xs text-text-subtle">
            Accès sur invitation. Contactez un administrateur pour un compte.
          </p>
        </div>
      </section>
    </main>
  );
}
