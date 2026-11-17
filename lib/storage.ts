/**
 * Dateispeicher. Phase 2: lokales Verzeichnis (STORAGE_DIR, Standard ./storage).
 * Später austauschbar gegen S3-kompatiblen Speicher (Hetzner Object Storage) – nur diese Datei ändern.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_DIR || "storage");

function safe(key: string) {
  const full = path.resolve(/* turbopackIgnore: true */ ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Ungültiger Speicherpfad");
  return full;
}

export function newKey(fileName: string) {
  const ext = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}${ext}`;
}

/** Schreibt einen Web-Stream direkt auf die Platte (kein Puffern großer Videos im Speicher). */
export async function saveStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number) {
  const full = safe(key);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  let size = 0;
  const counter = async function* (src: AsyncIterable<Uint8Array>) {
    for await (const chunk of src) {
      size += chunk.length;
      if (size > maxBytes) throw new Error(`Datei zu groß (max. ${Math.round(maxBytes / 1e6)} MB)`);
      yield chunk;
    }
  };
  try {
    await pipeline(Readable.fromWeb(body as never), counter, fs.createWriteStream(full));
  } catch (e) {
    await fs.promises.rm(full, { force: true });
    throw e;
  }
  return size;
}

export async function stat(key: string) {
  return fs.promises.stat(safe(key));
}

export function readStream(key: string, range?: { start: number; end: number }) {
  return Readable.toWeb(fs.createReadStream(safe(key), range)) as ReadableStream<Uint8Array>;
}

export async function remove(key: string) {
  await fs.promises.rm(safe(key), { force: true });
}

export function kindFromMime(mime: string) {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("image/")) return "BILD";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime === "application/pdf" || mime.startsWith("text/")) return "DOKUMENT";
  return "SONSTIGES";
}
