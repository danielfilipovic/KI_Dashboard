import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readStream, stat } from "@/lib/storage";

/** Liefert eine Asset-Version aus (nur angemeldet). Unterstützt Range-Requests für Video-Vorschau. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  const v = await db.assetVersion.findUnique({ where: { id } });
  if (!v) return new Response("Nicht gefunden", { status: 404 });

  const { size } = await stat(v.storageKey);
  const download = new URL(req.url).searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Content-Type": v.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(v.fileName)}`,
  };
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(readStream(v.storageKey, { start, end }), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(readStream(v.storageKey), { headers: { ...headers, "Content-Length": String(size) } });
}
