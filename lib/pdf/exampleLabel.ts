// Libellé « Exemple » du fond de substitution de l'aperçu d'un modèle, en image.
// Le serveur n'a aucune police système : du texte SVG dessiné par sharp y
// apparaît sous forme de petits rectangles. Cette image (PNG transparent, gris
// #9ca3af, police Apercu Regular) évite toute dépendance à une police.
// Générée une fois avec sharp à partir de public/fonts/apercu-regular.otf.
export const EXAMPLE_LABEL = {
  width: 245,
  height: 62,
  png: Buffer.from(
  "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",
    "base64"
  ),
};
