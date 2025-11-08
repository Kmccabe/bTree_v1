import React from "react";
import { Link } from "react-router-dom";

export default function SignupPage1(): JSX.Element {
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12">
      <div className="text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">Sign up: Page 1 of 2</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          Join the bTree community, earn money and advance science
        </h1>
        <p className="mt-3 max-w-3xl mx-auto text-base sm:text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
          We are preparing a simple, privacy-conscious enrollment flow. Page one will collect a
          verification email so we can notify you when an experiment opens.
        </p>
      </div>

      <section
        style={{
          display: "grid",
          gap: "1.5rem",
          marginBottom: "2.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <article
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "1.5rem",
            background: "#ffffff",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Please enter your email.</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-200">
            This preview shows the first step of the subject sign-up process.
          </p>
          <label className="mt-4 block">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              placeholder="_Not Implemented Yet_"
              disabled
              aria-disabled="true"
              title="Email collection will be added soon."
              className="w-full h-11 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-neutral-800 text-gray-400 placeholder-gray-400 cursor-not-allowed px-4"
            />
          </label>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            When you press Send, we will send you a verification email and add you as a subject.
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gray-300 dark:bg-neutral-700 text-gray-500 cursor-not-allowed px-6"
          >
            Send Email
          </button>
        </article>

        <article
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "1.5rem",
            background: "#ffffff",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Why Your Email?</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-200">
            We will use your email to notify you about upcoming experiments or events on bTree. If you don’t want to
            submit an email, click the button below.  You can still participate by logging in and check for open experiments.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border px-6 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-purple-50 dark:hover:bg-neutral-800"
          >
            Opt Out of Email Notifications
          </button>
        </article>
      </section>

      <p className="mt-6 text-sm text-gray-600 dark:text-gray-300 text-center">
        Read more in our{" "}
        <Link to="/legal/privacy" className="text-purple-700 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
