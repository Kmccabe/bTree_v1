import React from "react";
import { useParams } from "react-router-dom";

export default function Session(): JSX.Element {
  const { appId } = useParams();
  return (
    <main>
      <h1>Session</h1>
      {/* TODO: Session view for appId */}
      {/* appId: {appId} */}
    </main>
  );
}

