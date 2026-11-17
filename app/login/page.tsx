import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { login } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={login} className="card w-full max-w-sm space-y-4">
        <div>
          <h1>Business Cockpit</h1>
          <p className="text-sm text-slate-500">Bitte anmelden</p>
        </div>
        {error && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">Anmeldung fehlgeschlagen.</p>}
        <div>
          <label className="label" htmlFor="email">E-Mail</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Passwort</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full">Anmelden</button>
      </form>
    </main>
  );
}
