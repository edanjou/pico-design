import { createServerSupabaseClient, requireUser } from "@/lib/supabase/server";
import HistoryTable, { type JobRow } from "@/components/HistoryTable";

export default async function HistoryPage() {
  await requireUser();
  const supabase = createServerSupabaseClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, created_at, error_message, templates(name), products(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows: JobRow[] = (jobs ?? []).map((job: any) => ({
    id: job.id,
    status: job.status,
    created_at: job.created_at,
    error_message: job.error_message,
    productName: job.products?.name ?? "—",
    templateName: job.templates?.name ?? "Modèle supprimé",
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-page-title font-semibold text-pico-black">Historique</h1>
        <p className="text-sm text-neutral-500">
          {rows.length} génération{rows.length > 1 ? "s" : ""}.
        </p>
      </div>

      <HistoryTable jobs={rows} />
    </div>
  );
}
