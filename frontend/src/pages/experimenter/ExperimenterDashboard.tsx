import React from "react";
import { Card, CardContent } from "../../components/ui/card";

const waitingSubjects = [
  { id: "subj-001", walletShort: "5LHX...YD5U", reputation: "Rep 0 (0 experiments)", joined: "1 min ago" },
  { id: "subj-002", walletShort: "ABCD...1234", reputation: "Rep 5 (2 experiments)", joined: "3 min ago" },
  { id: "subj-003", walletShort: "Z9PQ...88PL", reputation: "Rep 12 (4 experiments)", joined: "5 min ago" },
];

export default function ExperimenterDashboard(): JSX.Element {
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Trust Game - Session 1</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            Experimenter Dashboard
          </h1>
        </div>
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1 text-sm font-medium text-emerald-700">
          Status: Recruiting
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="w-full border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Waiting Subjects</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Subjects who have signaled readiness to join the session.
              </p>
            </header>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-gray-700 dark:text-gray-100">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="pb-3 pr-4 font-medium">Subject ID</th>
                    <th className="pb-3 pr-4 font-medium">Wallet</th>
                    <th className="pb-3 pr-4 font-medium">Reputation</th>
                    <th className="pb-3 pr-4 font-medium">Joined</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {waitingSubjects.map(subject => (
                    <tr key={subject.id} className="align-middle">
                      <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-gray-50">{subject.id}</td>
                      <td className="py-3 pr-4 font-mono text-sm text-gray-600 dark:text-gray-300">{subject.walletShort}</td>
                      <td className="py-3 pr-4">{subject.reputation}</td>
                      <td className="py-3 pr-4">{subject.joined}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg bg-[#0b0d16] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-[#15182a]"
                          onClick={() => {}}
                        >
                          Add to Session
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Active Pairs</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monitor live trust-game sessions.</p>
            </header>
            <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
              No active pairs yet. Assign subjects from the waiting list.
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
