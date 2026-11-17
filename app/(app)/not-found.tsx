import Link from "next/link";
export default function NotFound() {
  return <div className="card"><h1>Nicht gefunden</h1><Link href="/" className="text-indigo-600">Zur Übersicht</Link></div>;
}
