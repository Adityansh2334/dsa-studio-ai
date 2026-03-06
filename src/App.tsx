import Home from "./ui/Home";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { createPortal } from "react-dom";

function GlobalToaster() {
    return createPortal(
        <Toaster
            position="top-right"
            containerStyle={{ zIndex: 9999999 }}
            toastOptions={{
                style: {
                    background: "rgba(15,23,42,0.9)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#E5E7EB",
                },
            }}
        />,
        document.body
    );
}

export default function App() {
    useEffect(() => {
        const handler = (_: any, data: any) => {
            showToast(data.message, data.type);
        };

        window.electron.ipcRenderer.on("toast", handler);

        return () => {
            window.electron.ipcRenderer.removeListener("toast", handler);
        };
    }, []);
    window.addEventListener("unhandledrejection", (e) => {
        console.error("Renderer Unhandled:", e.reason);
    });
    return (
        <>
            <GlobalToaster />
            <Home />
        </>
    );
}
