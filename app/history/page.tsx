import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = createServerSupabaseClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, created_at, error_message, templates(name), products(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = jobs ?? [];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-pico-black">Historique des générations</h1>

      {rows.length === 0 ? (
        <p className="rounded border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Aucune génération pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="p-3">Produit</th>
                <th className="p-3">Modèle</th>
                <th className="p-3">Date</th>
                <th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job: any) => (
                <tr key={job.id} className="border-t border-neutral-200">
                  <td className="p-3 font-medium">{job.products?.name ?? "—"}</td>
                  <td className="p-3 text-neutral-600">{job.templates?.name ?? "Modèle supprimé"}</td>
                  <td className="p-3 text-neutral-600">
                    {new Date(job.created_at).toLocaleString("fr-CA")}
                  </td>
                  <td className="p-3">
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
                    {job.error_message && (
                      <p className="mt-1 text-xs text-red-600">{job.error_message}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
