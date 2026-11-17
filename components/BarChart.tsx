/** Einfaches Säulendiagramm (eine Serie, keine Legende nötig). Tooltip per title-Attribut. */
export function BarChart({ data, format, label }: { data: { label: string; value: number }[]; format: (n: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure aria-label={label}>
      <div className="flex h-40 items-end gap-2 border-b border-slate-200">
        {data.map((d) => (
          <div key={d.label} className="group flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}`}>
            <span className="mb-1 text-center text-[10px] text-slate-500 opacity-0 group-hover:opacity-100">{format(d.value)}</span>
            <div className="rounded-t bg-indigo-500 transition group-hover:bg-indigo-700" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {data.map((d) => <span key={d.label} className="flex-1 text-center text-[11px] text-slate-500">{d.label}</span>)}
      </div>
      <table className="sr-only"><tbody>{data.map((d) => <tr key={d.label}><th>{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </figure>
  );
}
