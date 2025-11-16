import React from "react";
import { useNavigate } from "react-router-dom";

export default function SubjectExperimentConsent(): JSX.Element {
  const navigate = useNavigate();
  const [agreed, setAgreed] = React.useState(false);

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 max-w-3xl">
      <section className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Trust Game</p>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-50">Consent</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Please read the consent information below before deciding whether to participate in this experiment.
          </p>
        </header>

        <div className="mt-6 space-y-4 text-sm text-gray-700 dark:text-gray-200">
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Purpose</h2>
            <p>
              This session studies how participants make decisions in the Trust Game. You will be paired with another
              participant to make a series of decisions about sending and returning value.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Procedures</h2>
            <p>
              You will read instructions, make choices as the first mover (S1) or the second mover (S2), and respond to
              prompts on-screen. You may be asked to keep this window open and follow directions from the experimenter.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Risks</h2>
            <p>
              The risks of participating are minimal and comparable to other online research tasks. You may experience
              mild discomfort or frustration when making decisions under time pressure.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Benefits</h2>
            <p>
              You may learn about decentralized experiments and how the Trust Game works. Compensation (if any) is set by
              the experimenter; this demo does not transfer funds.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Confidentiality</h2>
            <p>
              Your wallet address may be visible to the experimenter but will not be shared publicly. Decisions are
              recorded for research purposes only.
            </p>
          </section>
        </div>

        <div className="mt-6 flex items-start gap-3">
          <input
            id="consent-agree"
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-gray-300 text-indigo-600"
            checked={agreed}
            onChange={event => setAgreed(event.target.checked)}
          />
          <label htmlFor="consent-agree" className="text-sm text-gray-700 dark:text-gray-200">
            I have read and understood the consent information and I agree to participate.
          </label>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
            onClick={() => navigate("/subject/dashboard")}
          >
            I do not agree
          </button>
          <button
            type="button"
            disabled={!agreed}
            className="inline-flex items-center justify-center rounded-lg bg-[#0b0d16] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15182a] disabled:cursor-not-allowed disabled:bg-gray-400"
            onClick={() => navigate("/subject/experiment/waiting")}
          >
            Agree & Continue
          </button>
        </div>
      </section>
    </main>
  );
}
