import React from "react";
import { usePrimaryWalletConnect } from "../../hooks/usePrimaryWalletConnect";

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

export default function SignupPage2(): JSX.Element {
  const { handleConnect, isConnecting } = usePrimaryWalletConnect();

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12">
      <p className="text-sm text-gray-600 dark:text-gray-300">Sign up: Page 2 of 2</p>
      <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
        Finish Signing Up and Join the bTree community.
      </h1>
      <p className="mt-3 max-w-3xl text-base sm:text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
        We care about your privacy. To make this happen you must follow this rule: You will only use one wallet account
        when you are on bTree, and you can never use this account for any other purpose outside of bTree.
      </p>
      <p className="mt-3 max-w-3xl text-base sm:text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
        This wallet address is how we will track your participation and build your Citizen Scientist Reputation. The
        address is public, and anyone can see it. If you only use your wallet address in bTree it will be very difficult
        to discover who you are in real life. By clicking the Join-Now button you are agreeing to follow this rule.
      </p>
      <p className="mt-3 max-w-3xl text-base sm:text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
        If you just got a new wallet to connect you are fine. This account has not been used before. If you connected
        with an existing wallet and account, you must get a new account. Use the Get-Account button to learn how to get
        a new account from your existing wallet and then click the Join-Now button using your new account.
      </p>

      <section style={gridStyle}>
        <article style={cardStyle}>
          <h2 className="text-2xl font-semibold text-gray-900">Join bTree</h2>
          <p className="mt-1 text-gray-700">
            The account I connected is new and I am ready to join the bTree community.
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gray-300 dark:bg-neutral-700 text-gray-500 cursor-not-allowed px-6 text-sm font-medium"
          >
            Join-Now
          </button>
        </article>

        <article style={cardStyle}>
          <h2 className="text-2xl font-semibold text-gray-900">Get New Account</h2>
          <p className="mt-1 text-gray-700">If you need a new account, click the button below to learn how.</p>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border px-6 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-purple-50 dark:hover:bg-neutral-800"
          >
            Get New Account
          </button>
          <p className="mt-2 text-gray-700">
            After you have your new account, disconnect your current account and connect your new account using the
            button below.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0b0d16] text-white px-6 text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        </article>
      </section>
    </main>
  );
}
