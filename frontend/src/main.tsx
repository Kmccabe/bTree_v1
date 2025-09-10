
import "./polyfills";
import { createRoot } from "react-dom/client";
import React from "react";
import { AppRouterProvider } from "./router";

const root = createRoot(document.getElementById("root")!);

function Root() {
  return <AppRouterProvider />;
}

root.render(<Root />);

