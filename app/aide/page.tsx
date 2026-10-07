import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import CodeBlock from "@/components/CodeBlock";

// Page Aide : intégrer Pico Design à une boutique Shopify, pas à pas. Ouverte
// par l'icône d'aide de la barre du haut (voir Nav). Les blocs de code sont
// ceux à coller dans le thème ; la clé du lien n'y figure jamais (elle se
// garde dans le gestionnaire de mots de passe), seulement son emplacement.

const SITE = "https://pico-design.vercel.app";
const WEBHOOK_URL = `${SITE}/api/shopify/webhook`;

const PRODUCT_BLOCK = String.raw`{%- comment -%}
  Pico Design : bouton « Débuter votre création », et ajout automatique au panier au
  retour de l'outil.

  Modèle Pico : métachamp custom.pico_template (id copié depuis
  Pico Design > Modèles), lu d'abord sur la VARIANTE, puis sur le PRODUIT
  à défaut. Une variante sans modèle (ni sur elle, ni sur le produit) n'est
  pas personnalisable. Si aucune ne l'est, rien ne s'affiche.
{%- endcomment -%}
{%- assign pico_default = product.metafields.custom.pico_template.value -%}
{%- assign pico_any = false -%}
{%- capture pico_map -%}{
  {%- for v in product.variants -%}
    {%- assign pico_t = v.metafields.custom.pico_template.value | default: pico_default -%}
    {%- if pico_t != blank -%}{%- assign pico_any = true -%}{%- endif -%}
    "{{ v.id }}": {{ pico_t | default: '' | json }}{% unless forloop.last %},{% endunless %}
  {%- endfor -%}
}{%- endcapture -%}
{%- if pico_any -%}
  <style>
    .pico-design { margin: 1rem 0; }
    .pico-design__link { width: 100%; }
    .pico-design__link[hidden] { display: none; }
    .pico-design__status { margin: 0 0 0.5rem; font-size: 0.9em; }
  </style>
  <div class="pico-design" data-templates="{{ pico_map | escape }}">
    <p class="pico-design__status" hidden></p>
    <button type="button" class="button pico-design__link">Débuter votre création</button>
  </div>
  <script>
    (function () {
      var TOOL = "${SITE}/design";
      var KEY = "VOTRE_DESIGN_LINK_KEY";
      var SHOP = "https://{{ shop.permanent_domain }}";
      var CART_ADD = "{{ routes.cart_add_url }}.js";
      var CART = "{{ routes.cart_url }}";
      var FIRST_VARIANT = "{{ product.selected_or_first_available_variant.id }}";

      var root = document.currentScript.previousElementSibling;
      var status = root.querySelector(".pico-design__status");
      var link = root.querySelector(".pico-design__link");

      // Même style que le bouton « Ajouter au panier » du thème : on reprend
      // ses classes, sauf celles qui le relient au panier (le script du thème
      // ne doit pas prendre ce bouton pour le sien). Sans bouton trouvé, la
      // classe « button » du thème suffit.
      var themeButton = document.querySelector('form[action*="/cart/add"] [type="submit"]');
      if (themeButton) {
        var classes = Array.prototype.filter.call(themeButton.classList, function (c) {
          return !/submit|cart|js-|loading|disabled/i.test(c);
        });
        if (classes.length) link.className = classes.concat("pico-design__link").join(" ");
      }

      var templates = {};
      try { templates = JSON.parse(root.dataset.templates); } catch (err) {}

      var forms = document.querySelectorAll('form[action*="/cart/add"]');
      function value(name, fallback) {
        for (var i = 0; i < forms.length; i++) {
          var el = forms[i].querySelector('[name="' + name + '"]');
          if (el && el.value) return el.value;
        }
        return fallback;
      }
      function say(text) {
        status.textContent = text;
        status.hidden = !text;
      }
      function currentTemplate() {
        return templates[value("id", FIRST_VARIANT)] || "";
      }

      // Le bouton suit la variante choisie : masqué si elle n'a pas de modèle.
      function refresh() {
        var ok = Boolean(currentTemplate());
        link.hidden = !ok;
        if (ok && status.dataset.kind === "variante") { say(""); status.dataset.kind = ""; }
        if (!ok) { say("Cette variante n'est pas personnalisable."); status.dataset.kind = "variante"; }
      }
      // Le thème met à jour le champ « id » après le changement de variante :
      // on relit un instant plus tard.
      for (var i = 0; i < forms.length; i++) {
        forms[i].addEventListener("change", function () { setTimeout(refresh, 50); });
      }
      document.addEventListener("variant:change", function () { setTimeout(refresh, 50); });

      // Aller : le modèle de la variante, la variante et la quantité choisies.
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var template = currentTemplate();
        if (!template) { refresh(); return; }
        var params = new URLSearchParams({
          template: template,
          cle: KEY,
          variant: value("id", FIRST_VARIANT),
          quantity: value("quantity", "1"),
          retour: SHOP + location.pathname
        });
        location.href = TOOL + "?" + params.toString();
      });

      // Retour : l'outil renvoie ?pico_design=…&variant=…&quantity=…
      var back = new URLSearchParams(location.search);
      var design = back.get("pico_design");
      if (!design || !/^[0-9a-f-]{36}$/i.test(design)) { refresh(); return; }

      // pico_design retiré de l'adresse : recharger n'ajoute pas deux fois.
      back.delete("pico_design");
      var clean = location.pathname + (back.toString() ? "?" + back.toString() : "");
      history.replaceState(null, "", clean);

      var doneKey = "pico_design_added_" + design;
      try {
        if (sessionStorage.getItem(doneKey)) return;
      } catch (err) {}

      say("Ajout de ton design au panier…");
      fetch(CART_ADD, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: [{
            id: Number(back.get("variant") || value("id", FIRST_VARIANT)),
            quantity: Math.max(1, parseInt(back.get("quantity"), 10) || 1),
            properties: { _design: design }
          }]
        })
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (data) { throw new Error(data.description || data.message); });
          try { sessionStorage.setItem(doneKey, "1"); } catch (err) {}
          location.href = CART;
        })
        .catch(function (err) {
          say("Ton design n'a pas pu être ajouté au panier" + (err && err.message ? " : " + err.message : "") + ". Réessaie ou contacte-nous.");
        });
    })();
  </script>
{%- endif -%}`;

const AURORA_CART_LINES = String.raw`{% assign pico_design = item.properties['_design'] %}
{% if pico_design != blank %}
  <img src='${SITE}/api/design/preview/{{ pico_design }}' alt='Aperçu de ton design' class='cart-item__image shape__target-image'>
{% elsif item.image %}`;

const GENERIC_CART_BLOCK = String.raw`{%- assign pico_design = item.properties['_design'] -%}
{%- if pico_design != blank -%}
  <img
    src="${SITE}/api/design/preview/{{ pico_design | url_encode }}"
    alt="Aperçu de ton design"
    width="150"
    loading="lazy"
  >
{%- else -%}
  {%- comment -%} Ici : le code d'origine de l'image du produit {%- endcomment -%}
{%- endif -%}`;

const SECTIONS = [
  { id: "avant", title: "Avant de commencer" },
  { id: "modeles", title: "1. Préparer les modèles" },
  { id: "metachamp", title: "2. Créer le métachamp" },
  { id: "produits", title: "3. Relier les produits" },
  { id: "bouton", title: "4. Ajouter le bouton" },
  { id: "panier", title: "5. Aperçu dans le panier" },
  { id: "commandes", title: "6. Recevoir les commandes" },
  { id: "habillage", title: "7. Habillage (facultatif)" },
  { id: "tester", title: "Tester" },
  { id: "depannage", title: "Dépannage" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="font-heading text-lg font-semibold text-text">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

// Nom de fichier, de champ ou de valeur, lisible même une fois copié ailleurs.
function K({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.85em] text-text">{children}</code>;
}

export default async function AidePage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pico-accent">AIDE</p>
        <h1 className="mt-1 font-heading text-page-title font-semibold text-text">
          Intégrer Pico Design à une boutique Shopify
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Le client clique <strong>Débuter votre création</strong> sur une fiche produit, compose son design dans l&apos;Outil
          Shopify, puis revient avec son article ajouté au panier, aperçu compris. Une fois payée, la commande arrive
          dans <Link href="/orders" className="text-primary underline">Commandes</Link> avec son PDF prêt pour
          l&apos;impression. Compter une trentaine de minutes, plus la saisie des produits.
        </p>
      </div>

      <nav aria-label="Sommaire" className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">Sommaire</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-text-muted hover:text-primary hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="avant" title="Avant de commencer">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Un accès administrateur à la boutique Shopify (thème et paramètres) et à Pico Design.</li>
          <li>
            La <strong>clé du lien</strong> (<K>DESIGN_LINK_KEY</K>), rangée dans le gestionnaire de mots de passe.
            Elle est commune à toutes les boutiques ; Vercel ne peut pas la réafficher.
          </li>
          <li>
            Le <strong>domaine Shopify</strong> de la boutique, de la forme <K>nom-boutique.myshopify.com</K>{" "}
            (Shopify : Paramètres → Domaines).
          </li>
          <li>
            Par prudence, une <strong>copie du thème</strong> : Boutique en ligne → Thèmes → ⋯ → Dupliquer.
          </li>
        </ul>
      </Section>

      <Section id="modeles" title="1. Préparer les modèles">
        <p>
          Chaque produit personnalisable correspond à un modèle de la page{" "}
          <Link href="/templates" className="text-primary underline">
            Modèles
          </Link>{" "}
          (dimensions, fond perdu, mockups).
        </p>
        <p>
          Sur la ligne du modèle, le bouton <strong>Copier l&apos;ID pour Shopify</strong> (icône Shopify) copie
          l&apos;identifiant à coller dans Shopify à l&apos;étape 3.
        </p>
      </Section>

      <Section id="metachamp" title="2. Créer le métachamp « Modèle Pico » (une seule fois)">
        <Steps>
          <li>Shopify : Paramètres → Données personnalisées → Produits → Ajouter une définition.</li>
          <li>
            Nom : <K>Modèle Pico</K>
          </li>
          <li>
            Espace de nom et clé : <K>custom.pico_template</K>
          </li>
          <li>
            Type : <strong>Texte sur une ligne</strong>, puis Enregistrer.
          </li>
          <li>
            Si le modèle change selon la variante : refaire la même définition dans Paramètres → Données
            personnalisées → <strong>Variantes</strong> (même nom, même clé <K>custom.pico_template</K>).
          </li>
        </Steps>
      </Section>

      <Section id="produits" title="3. Relier les produits">
        <p>
          Sur chaque produit personnalisable, coller l&apos;id du modèle (étape 1) dans le champ{" "}
          <strong>Modèle Pico</strong>, en bas de la fiche produit dans Shopify. Un produit sans id n&apos;affiche
          pas le bouton.
        </p>
        <p>
          Modèle différent selon la variante : coller l&apos;id dans le champ <strong>Modèle Pico</strong> de la
          variante (fiche produit → la variante). Une variante sans id reprend celui du produit. Une variante sans
          modèle, ni sur elle ni sur le produit, n&apos;est pas personnalisable : le bouton se masque quand elle est
          choisie.
        </p>
      </Section>

      <Section id="bouton" title="4. Ajouter le bouton « Débuter votre création »">
        <Steps>
          <li>Boutique en ligne → Thèmes → Personnaliser.</li>
          <li>En haut, choisir le modèle de page Produit.</li>
          <li>
            Ajouter un bloc → <strong>Liquid personnalisé</strong>, à l&apos;endroit où le bouton doit apparaître.
          </li>
          <li>Coller le code ci-dessous.</li>
          <li>
            Dans ce code, remplacer <K>VOTRE_DESIGN_LINK_KEY</K> par la clé du lien, puis Enregistrer.
          </li>
        </Steps>
        <CodeBlock label="Bloc Liquid personnalisé — fiche produit" code={PRODUCT_BLOCK} />
        <p>
          Au retour de l&apos;outil, ce même bloc ajoute l&apos;article au panier (bonne variante, bonne quantité) et
          envoie le client sur la page panier.
        </p>
      </Section>

      <Section id="panier" title="5. Afficher l'aperçu du design dans le panier">
        <p className="font-medium text-text">Thème Aurora (une seule ligne à remplacer)</p>
        <Steps>
          <li>Boutique en ligne → Thèmes → ⋯ → Modifier le code.</li>
          <li>
            Dossier <strong>Snippets</strong> → fichier <K>cart-item.liquid</K>.
          </li>
          <li>
            Cmd + F (Ctrl + F sur PC) : chercher <K>{"{% if item.image %}"}</K> et prendre la{" "}
            <strong>première</strong> ligne trouvée, juste sous <K>cart-item__image-wrapper</K>.
          </li>
          <li>Effacer cette seule ligne et coller les quatre lignes ci-dessous à sa place.</li>
          <li>Enregistrer. Le reste du bloc (photo, else, endif) ne change pas.</li>
        </Steps>
        <CodeBlock label="cart-item.liquid — remplace la ligne {% if item.image %}" code={AURORA_CART_LINES} />
        <p>Ce fichier sert au tiroir de panier comme à la page panier : les deux sont couverts.</p>

        <p className="pt-2 font-medium text-text">Autre thème</p>
        <p>
          Chercher, dans les fichiers du thème dont le nom contient « cart », la boucle{" "}
          <K>{"for item in cart.items"}</K>, puis l&apos;image du produit juste en dessous (une ligne avec{" "}
          <K>item.image</K>). L&apos;entourer comme ceci :
        </p>
        <CodeBlock label="Autre thème — autour de l'image du produit" code={GENERIC_CART_BLOCK} />
        <p>
          L&apos;aperçu n&apos;apparaît pas dans les pages de paiement : Shopify ne les rend modifiables qu&apos;avec
          Shopify Plus.
        </p>
      </Section>

      <Section id="commandes" title="6. Recevoir les commandes dans Pico Design">
        <p className="font-medium text-text">Dans Shopify : créer deux webhooks</p>
        <Steps>
          <li>Paramètres → Notifications → Webhooks → Créer un webhook.</li>
          <li>
            Événement <strong>Création de commande</strong>, format JSON, URL ci-dessous.
          </li>
          <li>
            Recommencer avec l&apos;événement <strong>Mise à jour de commande</strong>, même URL.
          </li>
          <li>
            Copier la clé affichée en bas de cette page Shopify : « Vos webhooks seront signés avec … ».
          </li>
        </Steps>
        <CodeBlock label="URL du webhook" code={WEBHOOK_URL} />
        <p className="pt-2 font-medium text-text">Dans Pico Design : enregistrer la clé</p>
        <Steps>
          <li>
            <Link href="/settings" className="text-primary underline">
              Paramètres
            </Link>{" "}
            → onglet de la boutique, ou <strong>+ Boutique</strong> avec <K>nom-boutique.myshopify.com</K>.
          </li>
          <li>
            Section <strong>Webhook des commandes</strong> : coller la clé, puis Enregistrer.
          </li>
          <li>
            L&apos;état doit passer à <strong>✓ Secret configuré</strong>.
          </li>
        </Steps>
        <p>La clé n&apos;est jamais réaffichée ; pour la changer, coller la nouvelle. Réservé aux administrateurs.</p>
      </Section>

      <Section id="habillage" title="7. Habillage de la boutique (facultatif)">
        <p>
          Dans{" "}
          <Link href="/settings" className="text-primary underline">
            Paramètres
          </Link>
          , l&apos;onglet de la boutique règle aussi le logo, le favicon, les couleurs et les polices de l&apos;Outil
          Shopify pour ses clients. Sans réglage, l&apos;outil prend l&apos;habillage par défaut.
        </p>
      </Section>

      <Section id="tester" title="Tester avant d'ouvrir aux clients">
        <p>
          Dans une <strong>fenêtre de navigation privée</strong>, sans être connecté à Pico Design :
        </p>
        <Steps>
          <li>
            Ouvrir une fiche produit : le bouton <strong>Débuter votre création</strong> apparaît.
          </li>
          <li>Cliquer : l&apos;éditeur s&apos;ouvre directement sur le bon modèle.</li>
          <li>
            Composer un design, puis <strong>Vérifier et commander</strong> → <strong>Ajouter au panier</strong>.
          </li>
          <li>De retour sur la boutique : l&apos;article est dans le panier, avec l&apos;aperçu du design.</li>
          <li>
            Passer une commande test : elle apparaît dans{" "}
            <Link href="/orders" className="text-primary underline">
              Commandes
            </Link>
            , avec le bouton PDF.
          </li>
        </Steps>
      </Section>

      <Section id="depannage" title="Dépannage">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-text-subtle">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-semibold">Ce qu&apos;on voit</th>
                <th className="py-2 font-semibold">Cause probable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Pas de bouton sur la fiche", "Le champ « Modèle Pico » du produit est vide."],
                ["Page de connexion au lieu de l'éditeur", "La clé (KEY) du bloc ne correspond pas à DESIGN_LINK_KEY."],
                ["« Modèle introuvable »", "L'id du champ « Modèle Pico » ne correspond à aucun modèle."],
                [
                  "Galerie des modèles au lieu de l'éditeur",
                  "Lien ouvert en étant connecté à Pico Design : refaire le test en navigation privée.",
                ],
                [
                  "Pas d'« Ajouter au panier » dans l'outil",
                  "Le lien n'a pas transmis la variante ou l'adresse de retour : vérifier le bloc de l'étape 4.",
                ],
                [
                  "L'article n'arrive pas dans le panier",
                  "Le message sous le bouton donne la raison (rupture de stock, variante indisponible…).",
                ],
                ["Panier sans aperçu", "L'étape 5 n'est pas en place pour ce thème."],
                [
                  "La commande n'arrive pas dans Pico Design",
                  "Webhook absent, ou clé de la boutique non enregistrée dans Paramètres (étape 6).",
                ],
              ].map(([seen, cause]) => (
                <tr key={seen}>
                  <td className="py-2 pr-4 align-top text-text">{seen}</td>
                  <td className="py-2 align-top">{cause}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          La clé du lien est visible dans le code de la fiche produit : c&apos;est voulu, elle n&apos;ouvre que
          l&apos;outil sur un modèle dont on connaît l&apos;id, jamais l&apos;administration. Pour la changer, la
          remplacer dans Vercel et dans le bloc de chaque boutique.
        </p>
      </Section>
    </div>
  );
}
