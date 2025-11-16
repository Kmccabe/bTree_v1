import React from "react";
import { Card, CardContent } from "../../components/ui/card";

const waitingSubjects = [
  { id: "subj-001", walletShort: "5LHX...YD5U", reputation: "Rep 0 (0 experiments)", joined: "1 min ago" },
  { id: "subj-002", walletShort: "ABCD...1234", reputation: "Rep 5 (2 experiments)", joined: "3 min ago" },
  { id: "subj-003", walletShort: "Z9PQ...88PL", reputation: "Rep 12 (4 experiments)", joined: "5 min ago" },
];

export default function ExperimenterDashboard(): JSX.Element {
  type ExperimentSummary = {
    gameType: string;
    appId: number;
    unit: number;
    m: number;
    e1: number;
    e2: number;
    status: string;
  };

  const [selectedGame, setSelectedGame] = React.useState("trust-game");
  const [unit, setUnit] = React.useState("1000");
  const [m, setM] = React.useState("2");
  const [e1, setE1] = React.useState("1");
  const [e2, setE2] = React.useState("1");
  const [deploying, setDeploying] = React.useState(false);
  const [showFaq, setShowFaq] = React.useState(false);
  const [currentExperiment, setCurrentExperiment] = React.useState<ExperimentSummary | null>(null);
  const [deployError, setDeployError] = React.useState<string | null>(null);

  const numericUnit = Number(unit) || 0;
  const numericM = Number(m) || 0;
  const numericE1 = Number(e1) || 0;
  const numericE2 = Number(e2) || 0;
  const allPositive = numericUnit > 0 && numericM > 0 && numericE1 > 0 && numericE2 > 0;
  const isDeployDisabled = deploying || !allPositive;
  const requiredMicro = numericUnit * (numericE1 * numericM + numericE2);
  const requiredAlgos = requiredMicro / 1_000_000 + 0.2;

  const handleDeployExperiment = React.useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!allPositive) return;
      setDeploying(true);
      setDeployError(null);
      try {
        await new Promise(resolve => setTimeout(resolve, 900));
        const fakeAppId = Math.floor(500_000 + Math.random() * 500_000);
        setCurrentExperiment({
          gameType: selectedGame,
          appId: fakeAppId,
          unit: numericUnit,
          m: numericM,
          e1: numericE1,
          e2: numericE2,
          status: "Recruiting",
        });
      } catch (error) {
        console.error("Failed to deploy experiment", error);
        setDeployError("Unable to deploy experiment. Please try again.");
      } finally {
        setDeploying(false);
      }
    },
    [allPositive, numericE1, numericE2, numericM, numericUnit, selectedGame],
  );

  const formatGameLabel = (value: string) => {
    switch (value) {
      case "trust-game":
        return "Trust Game";
      default:
        return value;
    }
  };

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

      <section className="mt-8 space-y-6">
        <Card className="w-full border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Deploy New Experiment</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure a Trust Game instance, then deploy to start recruiting.
              </p>
            </header>
            <form className="mt-6 space-y-6" onSubmit={handleDeployExperiment}>
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Game type</label>
                <select
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  value={selectedGame}
                  onChange={event => setSelectedGame(event.target.value)}
                >
                  <option value="trust-game">Trust Game</option>
                  <option value="risk-game" disabled>
                    Risk Game (coming soon)
                  </option>
                </select>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    value={unit}
                    onChange={event => setUnit(event.target.value)}
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">UNIT (microAlgos)</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    value={e1}
                    onChange={event => setE1(event.target.value)}
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">E1 (S1 endowment, in UNITs)</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    value={e2}
                    onChange={event => setE2(event.target.value)}
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">E2 (S2 endowment, in UNITs)</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    value={m}
                    onChange={event => setM(event.target.value)}
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">m (multiplier)</span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowFaq(prev => !prev)}
                  className="mt-2 text-sm font-medium text-purple-700 transition hover:underline"
                >
                  {showFaq ? "Hide Trust Game FAQ" : "Show Trust Game FAQ"}
                </button>
                {showFaq && (
                  <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100">
                    <p>
                      During the experiment, S1 chooses a stake s with 0 {"<="} s {"<="} E1 and sends s · UNIT to the contract. The
                      contract computes t(s) = m × s and transfers t(s) · UNIT to S2. Then S2 chooses a return r with 0 {"<="} r {"<="} t(s)
                      to send back to S1. Payoffs reflect E1, E2, s, and r.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                {!allPositive && (
                  <p className="text-xs text-red-600">
                    Enter values greater than zero for UNIT, m, E1, and E2 before deploying.
                  </p>
                )}
                {deployError && <p className="text-xs text-red-600">{deployError}</p>}
                <p>
                  Required contract funding: {requiredAlgos.toFixed(3)} Algos (includes 0.2 Algos for transaction costs).
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Rule: required_micro = UNIT * (E1 * m + E2); displayed here in Algos.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-[#0b0d16] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#15182a] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  disabled={isDeployDisabled}
                >
                  {deploying ? "Deploying..." : "Deploy Experiment"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="w-full border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-6">
            <header className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Current Experiment</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review the parameters currently in play.</p>
            </header>
            {currentExperiment ? (
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Game</dt>
                  <dd className="text-base font-semibold text-gray-900 dark:text-gray-50">
                    {formatGameLabel(currentExperiment.gameType)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    {currentExperiment.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">App ID</dt>
                  <dd className="text-base font-semibold text-gray-900 dark:text-gray-50">
                    {currentExperiment.appId}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">UNIT</dt>
                  <dd className="text-base font-semibold text-gray-900 dark:text-gray-50">
                    {currentExperiment.unit.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">m</dt>
                  <dd className="text-base font-semibold text-gray-900 dark:text-gray-50">{currentExperiment.m}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">E1 (UNITs)</dt>
                  <dd className="text-base font-semibold text-gray-900 dark:text-gray-50">{currentExperiment.e1}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">E2 (UNITs)</dt>
                  <dd className="text-base font-semibold text-gray-900 dark:text-gray-50">{currentExperiment.e2}</dd>
                </div>
              </dl>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                No experiment deployed. Configure parameters above and click "Deploy Experiment" to start.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
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
