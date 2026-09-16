import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = createServerSupabaseClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, created_at, error_message, templates(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-pico-700">Historique des générations</h1>
      <div className="divide-y rounded border border-neutral-200 bg-white">
        {(jobs ?? []).map((job: any) => (
          <div key={job.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{job.templates?.name ?? "Modèle supprimé"}</p>
              <p className="text-neutral-500">
                {new Date(job.created_at).toLocaleString("fr-CA")}
              </p>
              {job.error_message && <p className="text-red-600">{job.error_message}</p>}
            </div>
            <span
              className={
                "rounded-full px-2 py-1 text-xs " +
                (job.status === "done"
                  ? "bg-green-100 text-green-700"
                  : job.status === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700")
              }
            >
              {job.status}
            </span>
          </div>
        ))}
        {(!jobs || jobs.length === 0) && (
          <p className="p-4 text-sm text-neutral-500">Aucune génération pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
