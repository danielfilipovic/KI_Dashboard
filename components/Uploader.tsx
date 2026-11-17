"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TOOLS = ["Higgsfield", "Kling", "Veo", "Runway", "HeyGen", "ElevenLabs", "Nano Banana", "Flux", "Midjourney", "Canva", "CapCut", "Sonstiges"];

/**
 * Datei-Upload mit Fortschritt. Ohne assetId: neue Assets; mit assetId: neue Version.
 * Für Higgsfield & Co. ohne API: extern erzeugen, hier hochladen, KI-Werkzeug angeben.
 */
export function Uploader({ orderId, clientId, assetId, defaultRole = "ROH", compact = false }: {
  orderId?: string; clientId?: string; assetId?: string; defaultRole?: string; compact?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState(defaultRole);
  const [ai, setAi] = useState(false);
  const [tool, setTool] = useState("Higgsfield");
  const [cost, setCost] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function send(file: File, i: number, n: number) {
    return new Promise<void>((resolve, reject) => {
      const q = new URLSearchParams({ name: file.name, role });
      if (orderId) q.set("orderId", orderId);
      if (clientId) q.set("clientId", clientId);
      if (assetId) q.set("assetId", assetId);
      if (ai) { q.set("ai", "1"); q.set("tool", tool); if (cost) q.set("cost", cost); }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/upload?${q}`);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(`${n > 1 ? `Datei ${i + 1}/${n}: ` : ""}${Math.round((e.loaded / e.total) * 100)} %`);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(JSON.parse(xhr.responseText || "{}").error ?? `Fehler ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Netzwerkfehler"));
      xhr.send(file);
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) await send(files[i], i, files.length);
      setProgress(null);
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setProgress(null);
      setError((e as Error).message);
    }
  }

  return (
    <div className={`space-y-2 rounded-lg border border-dashed border-slate-300 p-3 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {!assetId && (
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input w-auto py-1" aria-label="Rolle">
            <option value="ROH">Rohmaterial</option>
            <option value="GENERIERT">KI-generiert (Zwischenstand)</option>
            <option value="FINAL">Final (fertiger Schnitt)</option>
          </select>
        )}
        {!assetId && (
          <label className="flex items-center gap-1"><input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} /> KI-generiert</label>
        )}
        {ai && (
          <>
            <select value={tool} onChange={(e) => setTool(e.target.value)} className="input w-auto py-1" aria-label="KI-Werkzeug">
              {TOOLS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input value={cost} onChange={(e) => setCost(e.target.value)} type="number" step="0.01" placeholder="Kosten €" className="input w-24 py-1" aria-label="Kosten in Euro" />
          </>
        )}
      </div>
      <input ref={input} type="file" multiple={!assetId} accept="video/*,image/*,audio/*,application/pdf,text/plain"
        onChange={(e) => onFiles(e.target.files)} disabled={Boolean(progress)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white" />
      {progress && <p className="text-indigo-700">Lädt hoch … {progress}</p>}
      {error && <p className="text-rose-700">{error}</p>}
    </div>
  );
}
