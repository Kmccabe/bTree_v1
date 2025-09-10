import React from "react";
import { useParams } from "react-router-dom";

export default function DocPage(): JSX.Element {
  const { slug } = useParams();
  return (
    <main>
      <h1>Doc Page</h1>
      {/* TODO: Render doc for slug */}
      {/* slug: {slug} */}
    </main>
  );
}

