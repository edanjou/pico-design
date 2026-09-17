// Bloc de squelette avec effet "shimmer" (reflet qui balaie de gauche à
// droite) plutôt qu'un simple pulse d'opacité, pour mieux évoquer un
// chargement en cours.
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-neutral-200/70 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}
