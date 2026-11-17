import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { db } from "@/lib/db";

const NAV = [
  { href: "/", label: "Übersicht", icon: "◧" },
  { href: "/leads", label: "Lead-Finder", icon: "⌖" },
  { href: "/crm", label: "CRM", icon: "☰" },
  { href: "/freigaben", label: "Freigaben", icon: "✓" },
  { href: "/finanzen", label: "Finanzen", icon: "€" },
  { href: "/einstellungen", label: "Einstellungen", icon: "⚙" },
];
const LATER = ["Trend-Radar", "Marketing-Studio", "Social-Zentrale", "Produkt-Fabrik", "Kundenportal"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pending = await db.approval.count({ where: { status: "PENDING" } });
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="font-semibold">Business Cockpit</Link>
          <form action={logout} className="md:hidden"><button className="text-xs text-slate-500 underline">Abmelden</button></form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <span aria-hidden className="w-4 text-center text-slate-400">{n.icon}</span>
              {n.label}
              {n.href === "/freigaben" && pending > 0 && <span className="badge ml-auto bg-rose-600 text-white">{pending}</span>}
            </Link>
          ))}
        </nav>
        <div className="hidden px-4 pt-4 md:block">
          <p className="label">Phase 2/3</p>
          {LATER.map((l) => <p key={l} className="py-1 text-sm text-slate-400">{l}</p>)}
        </div>
        <form action={logout} className="hidden p-4 md:absolute md:bottom-0 md:block">
          <p className="mb-2 text-xs text-slate-500">{user.name} · {user.role}</p>
          <button className="btn-ghost">Abmelden</button>
        </form>
      </aside>
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">{children}</main>
    </div>
  );
}
