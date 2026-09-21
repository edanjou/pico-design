import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { pdfDownloadName } from "@/lib/imposition/saved";

export const runtime = "nodejs";

// PDF d'une imposition enregistrée : affiché dans le navigateur, ou téléchargé avec ?download=1.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: row } = await supabase
    .from("impositions")
    .select("name, pdf_path")
    .eq("id", params.id)
    .single<{ name: string; pdf_path: string }>();
  if (!row) return NextResponse.json({ error: "Imposition introuvable." }, { status: 404 });

  const { data: file, error } = await createAdminSupabaseClient().storage.from("imposition").download(row.pdf_path);
  if (error || !file) return NextResponse.json({ error: "PDF introuvable." }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = pdfDownloadName(row.name);
  return new NextResponse(new Uint8Array(await file.arrayBuffer()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
