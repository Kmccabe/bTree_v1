import { Link } from "react-router-dom";
import { EscrowCard } from "../../features/admin/EscrowCard";

const cards = [
  {
    title: "Subject Pool",
    description: "Check registry globals and inspect per-subject boxes directly from Algod.",
    href: "/admin/subject-pool",
  },
  {
    title: "Registry Controls",
    description: "Send admin transactions (open/close, add capacity, set reward) via ATC.",
    href: "/admin/registry-controls",
  },
];

export default function AdminHome(): JSX.Element {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-neutral-600">
          Registry oversight tools for the bTree TestNet deployment.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <EscrowCard />
        </div>
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="rounded border p-4 shadow-sm transition hover:border-blue-400 hover:shadow"
          >
            <div className="text-lg font-semibold text-blue-700">{card.title}</div>
            <p className="mt-2 text-sm text-neutral-600">{card.description}</p>
            <div className="mt-3 text-sm font-medium text-blue-600">Go →</div>
          </Link>
        ))}
      </section>
    </main>
  );
}
