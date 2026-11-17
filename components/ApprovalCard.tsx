import { decideApproval } from "@/app/actions";
import { dt } from "@/lib/constants";

type A = { id: string; title: string; content: string; channel: string | null; aiGenerated: boolean; createdAt: Date; type: string };

/** Freigabe-Karte: Text editierbar, KI-Prüfung als Pflicht-Checkbox, Freigeben/Ablehnen. */
export function ApprovalCard({ a, from, compact = false }: { a: A; from: string; compact?: boolean }) {
  return (
    <form action={decideApproval} className="card space-y-3">
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="from" value={from} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{a.title}</p>
          <p className="text-xs text-slate-500">{a.type}{a.channel ? ` · ${a.channel}` : ""} · {dt(a.createdAt)}</p>
        </div>
        {a.aiGenerated && <span className="badge bg-violet-100 text-violet-700">KI-Entwurf</span>}
      </div>
      {compact ? (
        <p className="line-clamp-3 whitespace-pre-line text-sm text-slate-600">{a.content}</p>
      ) : (
        <textarea name="content" defaultValue={a.content} rows={8} className="input font-mono text-xs" />
      )}
      {a.aiGenerated && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="aiLabelOk" className="mt-1" />
          <span>Inhalt geprüft/überarbeitet; KI-Kennzeichnung bewertet (Pflicht bei veröffentlichten KI-Bildern, -Videos, -Stimmen).</span>
        </label>
      )}
      <div className="flex gap-2">
        <button name="decision" value="APPROVED" className="btn-ok">✓ Freigeben</button>
        <button name="decision" value="REJECTED" className="btn-ghost">✕ Ablehnen</button>
      </div>
    </form>
  );
}
