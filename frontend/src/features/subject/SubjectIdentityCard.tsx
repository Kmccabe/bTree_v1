import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { useSubjectIdentity } from "./useSubjectIdentity";

export default function SubjectIdentityCard(): JSX.Element {
  const { subjectId, walletShort, reputation, loading, error } = useSubjectIdentity();

  const subjectIdDisplay = loading
    ? "Loading identity..."
    : subjectId ?? "You are not registered as a bTree subject.";
  const walletDisplay = walletShort ?? "Wallet not connected";
  const reputationDisplay = `${reputation.score} (from ${reputation.completed} experiments)`;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="pb-1">
        <CardTitle className="text-base font-semibold">Subject Identity</CardTitle>
        <CardDescription>Wallet, registration, and reputation at a glance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-gray-700 dark:text-gray-100">
        <div className="space-y-1 text-sm">
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
        {error && <p className="pt-2 text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
