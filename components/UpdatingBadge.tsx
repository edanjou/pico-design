import { SpinnerIcon } from "@/components/icons";

export default function UpdatingBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-normal text-neutral-400">
      <SpinnerIcon className="h-3.5 w-3.5" />
      Mise à jour...
    </span>
  );
}
