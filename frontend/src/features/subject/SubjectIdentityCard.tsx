import type { SVGProps } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { useSubjectIdentity } from "./useSubjectIdentity";

export default function SubjectIdentityCard(): JSX.Element {
  const { subjectId, walletShort, reputation, loading, error } = useSubjectIdentity();

  const subjectIdDisplay = loading
    ? "Loading identity..."
    : subjectId ?? "You are not registered as a bTree subject.";
  const walletDisplay = walletShort ?? "Wallet not connected";
  const reputationDisplay = `${reputation.score} (from ${reputation.completed} experiments)`;

  return (
    <Card className="w-full max-w-2xl p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
      <CardContent className="text-sm text-gray-700 dark:text-gray-100">
        <div
          className="flex flex-row items-center gap-4"
          style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "1rem" }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 text-purple-700"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "4rem",
              height: "4rem",
              borderRadius: "1rem",
              backgroundColor: "#f3e8ff",
              color: "#7c3aed",
            }}
          >
            <User
              className="h-10 w-10"
              strokeWidth={1.8}
              style={{ width: "2.5rem", height: "2.5rem" }}
            />
          </div>
          <div
            className="flex flex-col space-y-1 text-sm"
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.875rem" }}
          >
            <div>
              <span className="font-semibold">Subject ID:</span>{" "}
              {subjectIdDisplay}
            </div>
            <div>
              <span className="font-semibold">Wallet:</span> {walletDisplay}
            </div>
            <div>
              <span className="font-semibold">Reputation:</span> {reputationDisplay}
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

function User({
  strokeWidth = 1.8,
  width = 40,
  height = 40,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={width}
      height={height}
      {...props}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
