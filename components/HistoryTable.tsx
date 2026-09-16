"use client";

import { useMemo, useState } from "react";

export interface JobRow {
  id: string;
  status: "pending" | "processing" | "done" | "error";
  created_at: string;
  error_message: string | null;
  productName: string;
  templateName: string;
}

const STATUS_LABELS: Record<JobRow["status"], string> = {
  pending: "En attente",
  processing: "En cours",
  done: "Terminé",
  error: "Erreur",
};

const STATUS_STYLES: Record<JobRow["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
  error: "bg-red-50 text-red-700",
};

function StatusIcon({ status }: { status: JobRow["status"] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3 w-3">
      {status === "done" ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      ) : status === "error" ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5M20 12a8 8 0 1 1-8-8 8 8 0 0 1 8 8Z" />
      )}
    </svg>
  );
}

export default function HistoryTable({ jobs }: { jobs: JobRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<JobRow["status"] | "">("");

  const filtered = useMemo(() => {
    return jobs
      .filter((j) => (status ? j.status === status : true))
      .filter((j) =>
        `${j.productName} ${j.templateName}`.toLowerCase().includes(search.trim().toLowerCase())
      );
  }, [jobs, search, status]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (produit, modèle)..."
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500">Statut</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as JobRow["status"] | "")}
            className="mt-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Tous —</option>
            {(Object.keys(STATUS_LABELS) as JobRow["status"][]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          Aucune génération ne correspond.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-sm font-semibold text-neutral-700">
                <th className="p-4">Produit</th>
                <th className="p-4">Modèle</th>
                <th className="p-4">Date</th>
                <th className="p-4">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="p-4 font-semibold text-pico-black">{job.productName}</td>
                  <td className="p-4 text-neutral-700">{job.templateName}</td>
                  <td className="p-4 text-neutral-500">
                    {new Date(job.created_at).toLocaleString("fr-CA")}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[job.status]}`}
                    >
                      <StatusIcon status={job.status} />
                      {STATUS_LABELS[job.status]}
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
