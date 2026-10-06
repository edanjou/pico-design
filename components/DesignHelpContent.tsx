// Contenu de l'aide de l'Outil Shopify, pour le CLIENT de la boutique (il
// tutoie, comme l'outil). Partagé entre la fenêtre « Aide ? » de l'éditeur
// (DesignEditor) et la page publique /design/aide : un seul texte à tenir à jour.

import {
  CopyIcon,
  ExpandIcon,
  ImageIcon,
  LayoutGridIcon,
  PaintbrushVerticalIcon,
  RotateCwIcon,
  SquareIcon,
  StickerIcon,
  TypeIcon,
} from "@/components/icons";

type Icon = (props: { className?: string }) => JSX.Element;

function Section({ title, icon: Icon, children }: { title: string; icon?: Icon; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-display text-xl text-text">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(79,10,31,0.06)] text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

function Item({ icon: Icon, title, children }: { icon: Icon; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        <strong className="text-text">{title}</strong> — {children}
      </span>
    </li>
  );
}

// Couleur d'un trait de l'aperçu, comme la légende de l'outil.
function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      className="mr-1.5 inline-block w-5 align-middle"
      style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
      aria-hidden="true"
    />
  );
}

export default function DesignHelpContent() {
  return (
    <div className="space-y-6">
      <Section title="1. Choisis ton type de design" icon={ImageIcon}>
        <p>En haut du panneau de gauche, trois choix :</p>
        <ul className="space-y-2">
          <Item icon={ImageIcon} title="Image">
            une seule photo ou un seul fichier (JPEG, PNG ou PDF) qui couvre tout le produit.
          </Item>
          <Item icon={LayoutGridIcon} title="Mosaïque">
            plusieurs photos, une par case. Choisis une disposition (2×2, 3×1…) ou « Personnalisé » pour régler
            toi-même les colonnes et les rangées.
          </Item>
          <Item icon={PaintbrushVerticalIcon} title="Thème">
            un graphisme déjà prêt, dans lequel tu places tes photos (offert sur certains produits seulement).
          </Item>
        </ul>
        <p>Tu peux changer d&apos;avis à tout moment : ce que tu as fait dans un mode est gardé si tu y reviens.</p>
      </Section>

      <Section title="2. Ajuste ta photo" icon={ExpandIcon}>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-text">Déplacer</strong> : glisse la photo directement sur l&apos;aperçu.
          </li>
          <li>
            <strong className="text-text">Zoom</strong> : le curseur du panneau de gauche agrandit ou réduit la
            photo.
          </li>
          <li>
            <strong className="text-text">Pivoter</strong> tourne la photo d&apos;un quart de tour,{" "}
            <strong className="text-text">Remplir</strong> l&apos;agrandit juste assez pour couvrir tout le
            produit, <strong className="text-text">Réinitialiser</strong> la remet au centre.
          </li>
          <li>
            <strong className="text-text">Mosaïque et thème</strong> : clique d&apos;abord sur une case (elle
            s&apos;entoure d&apos;orange), puis glisse sa photo ou règle son zoom. Chaque case se cadre
            séparément.
          </li>
        </ul>
        <p>
          Si une photo ne couvre pas toute la surface, un avertissement te le signale : il resterait une bordure
          blanche à l&apos;impression.
        </p>
      </Section>

      <Section title="3. Ajoute du texte, des images ou des illustrations" icon={TypeIcon}>
        <p>Le panneau de droite, « Calques », ajoute des éléments par-dessus ta photo :</p>
        <ul className="space-y-2">
          <Item icon={TypeIcon} title="Texte">
            écris ton message, puis choisis la police, la taille, le gras, l&apos;italique et la couleur.
          </Item>
          <Item icon={ImageIcon} title="Image">
            ajoute une autre photo ou un logo par-dessus.
          </Item>
          <Item icon={SquareIcon} title="Forme">
            un rectangle ou une ellipse, avec couleur de fond et bordure.
          </Item>
          <Item icon={StickerIcon} title="Illustration">
            choisis un dessin dans notre banque d&apos;illustrations.
          </Item>
        </ul>
        <p>
          Clique sur un calque pour le sélectionner, puis glisse-le sur l&apos;aperçu pour le placer. Dans la liste,
          les flèches le passent devant ou derrière les autres, <CopyIcon className="inline h-3.5 w-3.5" /> le
          duplique et la corbeille le supprime.
        </p>
      </Section>

      <Section title="4. Lis les guides d'impression" icon={SquareIcon}>
        <p>Sous l&apos;aperçu, l&apos;interrupteur « Guides d&apos;impression » affiche des repères :</p>
        <ul className="space-y-1.5">
          <li>
            <Swatch color="#ff00ff" />
            <strong className="text-text">Coupe</strong> : là où le produit sera découpé.
          </li>
          <li>
            <Swatch color="#60a5fa" dashed />
            <strong className="text-text">Marge de protection</strong> : garde tes textes et éléments importants à
            l&apos;intérieur, pour qu&apos;ils ne soient pas coupés.
          </li>
          <li>
            <Swatch color="#8c8172" dashed />
            <strong className="text-text">Fond perdu</strong> : la bande au-delà de la coupe. Ta photo doit la
            recouvrir, pour éviter un liseré blanc au bord.
          </li>
        </ul>
        <p>Ces repères ne sont jamais imprimés.</p>
      </Section>

      <Section title="5. Recto et verso" icon={RotateCwIcon}>
        <p>
          Pour un produit imprimé des deux côtés, les boutons <strong className="text-text">Recto</strong> et{" "}
          <strong className="text-text">Verso</strong>, en haut, passent d&apos;une face à l&apos;autre. Chaque face
          a son propre design. Un point vert indique une face prête, un point rouge une face à compléter.
        </p>
      </Section>

      <Section title="6. Vérifie, puis ajoute au panier" icon={LayoutGridIcon}>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Clique sur <strong className="text-text">Vérifier et commander</strong>, en haut à droite : tu vois ton
            produit tel qu&apos;il sera, en photo de mise en situation. Clique sur une vue pour l&apos;agrandir.
          </li>
          <li>
            Tout est bon ? <strong className="text-text">Ajouter au panier</strong> enregistre ton design et te
            ramène sur la boutique, ton article déjà dans le panier, avec l&apos;aperçu de ton design.
          </li>
          <li>
            Un détail à corriger ? <strong className="text-text">Continuer à modifier</strong> te ramène à
            l&apos;éditeur sans rien perdre.
          </li>
        </ul>
      </Section>

      <Section title="Bons conseils">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Utilise des photos de bonne qualité : plus elles sont grandes, plus l&apos;impression est nette.</li>
          <li>Garde les textes loin des bords, à l&apos;intérieur de la marge de protection bleue.</li>
          <li>Vérifie l&apos;orthographe de tes textes avant de commander : le produit est imprimé tel quel.</li>
          <li>Ton design est perdu si tu fermes l&apos;onglet de l&apos;outil avant de l&apos;ajouter au panier.</li>
        </ul>
      </Section>

      <section className="rounded-2xl bg-[rgba(79,10,31,0.06)] p-5 text-sm text-text">
        <p className="font-semibold text-primary">Toujours bloqué ?</p>
        <p className="mt-1 text-text-muted">
          Notre équipe peut finaliser ton design pour toi : écris-nous depuis la page Contact de la boutique, en
          précisant le produit choisi.
        </p>
      </section>
    </div>
  );
}
