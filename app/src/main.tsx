import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import ErrorBoundary from "@/ui/exception/ErrorBoundary.tsx";

const container = document.getElementById("root")!;
const root = ReactDOM.createRoot(container);

root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);
