import React from "react";
import { SubjectIdentityCard } from "../../features/subject";

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: "1.5rem",
  marginBottom: "2.5rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "1.5rem",
  background: "#ffffff",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const countdownBoxClass =
  "inline-flex items-center justify-center border border-gray-300 rounded-md px-3 py-2 text-sm font-medium";

const countdownRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "1rem",
};

const countdownItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

export default function SubjectDashboard(): JSX.Element {
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12">
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
        Citizen Scientist Dashboard (Welcome)
      </h1>
      <div className="mt-4 mb-6">
        <SubjectIdentityCard />
      </div>
      <section style={gridStyle}>
        <article style={cardStyle}>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Action</h2>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0b0d16] text-white px-6 text-sm font-medium"
          >
            See bTree Reputation
          </button>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0b0d16] text-white px-6 text-sm font-medium"
          >
            Find an Experiment
          </button>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0b0d16] text-white px-6 text-sm font-medium"
          >
            Vote on Proposition
          </button>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0b0d16] text-white px-6 text-sm font-medium"
          >
            Review and Send Messages
          </button>
        </article>

        <article style={cardStyle}>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Next Experiment</h2>
          <p className="text-gray-700">Your next experiment: 19901 will start in</p>
          <div style={countdownRowStyle}>
            <div style={countdownItemStyle}>
              <div className={countdownBoxClass}>01</div>
              <span className="text-sm text-gray-600 whitespace-nowrap">Hour</span>
            </div>
            <div style={countdownItemStyle}>
              <div className={countdownBoxClass}>32</div>
              <span className="text-sm text-gray-600 whitespace-nowrap">Minutes</span>
            </div>
            <div style={countdownItemStyle}>
              <div className={countdownBoxClass}>18</div>
              <span className="text-sm text-gray-600 whitespace-nowrap">Seconds</span>
            </div>
          </div>
          <p className="mt-2 text-gray-700">
            When the countdown ends you will be able to enter the experiment room with your connected wallet. If for any
            reason you cannot be in the experiment click the Exit Experiment button.
          </p>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gray-300 text-gray-800 px-6 text-sm font-medium"
          >
            Exit Experiment
          </button>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0b0d16] text-white px-6 text-sm font-medium"
          >
            Enter Experiment
          </button>
        </article>
      </section>
    </main>
  );
}
