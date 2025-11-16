export default function SubjectExperimentWaiting(): JSX.Element {
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 max-w-2xl">
      <section className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Trust Game</p>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-50">Waiting to be assigned</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Thank you for consenting to participate. You are now waiting to be assigned to an experiment session.
          </p>
        </header>
        <div className="mt-6 space-y-3 text-sm text-gray-700 dark:text-gray-200">
          <p>Please keep this page open. Once the experimenter finalizes the next round, you will be prompted to begin.</p>
          <p>If several minutes pass without any updates, you may return to the dashboard or contact the experimenter.</p>
        </div>
      </section>
    </main>
  );
}
