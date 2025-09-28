
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";


const root = document.getElementById("root");
if (!root) throw new Error("Missing <div id=\"root\"> in index.html");


ReactDOM.createRoot(root).render(
<React.StrictMode>
<RouterProvider router={router} />
</React.StrictMode>
);
