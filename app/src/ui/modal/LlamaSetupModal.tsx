import { useEffect, useState, useRef } from "react";

type Props = {
    model: string;
    onDone: () => void;
    onBack: () => void;
};

type Phase = "consent" | "installing" | "success";

/* ---------------- FAKE LLAMA LOG STAGES ---------------- */
const LOG_STAGES: { upto: number; lines: string[] }[] = [
    {
        upto: 10,
        lines: [
            "Initializing local inference engine...",
            "Checking system capabilities (CPU, AVX2, GPU)...",
            "Preparing model directories...",
            "Allocating disk space for GGUF model..."
        ]
    },
    {
        upto: 30,
        lines: [
            "Starting model download stream...",
            "Verifying model checksum...",
            "Downloading tensor blocks...",
            "Optimizing write buffers..."
        ]
    },
    {
        upto: 55,
        lines: [
            "Decompressing model layers...",
            "Mapping tensors to memory...",
            "Validating GGUF metadata...",
            "Preparing KV cache configuration..."
        ]
    },
    {
        upto: 75,
        lines: [
            "Linking model with llama.cpp runtime...",
            "Configuring GPU offload layers...",
            "Enabling Flash Attention...",
            "Allocating compute buffers..."
        ]
    },
    {
        upto: 90,
        lines: [
            "Warming up inference context...",
            "Running dry inference pass...",
            "Optimizing token pipeline...",
            "Finalizing model slots..."
        ]
    },
    {
        upto: 100,
        lines: [
            "Model successfully prepared.",
            "Local AI engine ready.",
            "Offline inference is now available."
        ]
    }
];

export default function LlamaSetupModal({ model, onDone, onBack }: Props) {
    const [phase, setPhase] = useState<Phase>("consent");

    const [downloaded, setDownloaded] = useState(0);
    const [total, setTotal] = useState(1);
    const [status, setStatus] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const [isDownloaded, setIsDownloaded] = useState(false);

    const [initialStatus, setInitialStatus] = useState<string>("Checking system…");
    const [canProceed, setCanProceed] = useState(false);

    const logRef = useRef<HTMLDivElement>(null);

    const isErrorStatus =
        status?.toLowerCase().includes("❌") ||
        status?.toLowerCase().includes("error") ||
        status?.toLowerCase().includes("failed");

    const percent = Math.floor((downloaded / total) * 100);

    const [confirmCancel, setConfirmCancel] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);



    /* ---------------- AUTO SCROLL LOGS ---------------- */
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    /* ---------------- FAKE ANIMATED LOGS ---------------- */
    useEffect(() => {
        if (phase !== "installing") return;

        let i = 0;
        const interval = setInterval(() => {
            const stage = LOG_STAGES.find(s => percent <= s.upto);
            if (!stage) return;

            const line = stage.lines[i % stage.lines.length];

            setLogs(prev => {
                const next = [...prev, line];
                return next.slice(-40);
            });

            i++;
        }, 800);

        return () => clearInterval(interval);
    }, [phase, percent]);

    /* ---------------- GET REAL INFO FROM MAIN ---------------- */
    useEffect(() => {
        async function loadInfo() {
            const state = await window.api.prepareOfflineAI(model);

            if (state.status === "ready") {
                setInitialStatus("✅ llama is installed already, running and model is also present.");
                setCanProceed(true);
                setIsDownloaded(true);
            } else if (state.reason === "not-installed") {
                setInitialStatus("llama is failed to setup on this system.");
                setCanProceed(true);
            } else if (state.reason === "not-running") {
                setInitialStatus("llama is installed but not running.");
                setCanProceed(true);
            } else if (state.reason === "model-missing-or-corrupt") {
                setInitialStatus(`Model "${model}" not found installed. It will be downloaded and installed.(Download size: ~2.6GB/~4.6GB)`);
                setCanProceed(true);
            } else {
                setInitialStatus("Unknown system state.");
            }
        }
        loadInfo();
    }, [model]);

    /* ---------------- LISTEN TO MAIN PROCESS EVENTS ---------------- */
    useEffect(() => {
        window.api.onOllamaProgress((d: any) => {
            setDownloaded(d.downloaded);
            setTotal(d.total);
        });

        window.api.onOllamaStatus((msg: string) => {
            setStatus(msg);
        });
    }, []);

    /* ---------------- INSTALL ACTION ---------------- */
    async function startInstall() {
        setPhase("installing");
        if (!isDownloaded) {
            await window.api.downloadOfflineModel(model);
        }
        setPhase("success");
    }

    return (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-md flex items-center justify-center px-6">
            <div className="w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl p-8 text-white">

                {phase === "consent" && (
                    <>
                        <h2 className="text-2xl font-semibold mb-4">
                            Local AI Setup Required
                        </h2>

                        <div className="mb-4 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-indigo-300">
                            {initialStatus}
                        </div>

                        <p className="text-gray-400 mb-6 leading-relaxed">
                            To use <b>Offline Mode</b>, the required AI model must be available locally
                            for the <b>llama.cpp engine</b>.
                            <br />
                            If the model is not present, it will be downloaded and configured automatically.
                        </p>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-sm mb-6 space-y-2">
                            <div className="flex justify-between">
                                <span>Selected Model</span>
                                <span className="text-emerald-400 font-medium">{model}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                                Powered by llama.cpp (GGUF local inference)
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <button
                                onClick={onBack}
                                className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
                            >
                                ← Back
                            </button>

                            <button
                                onClick={startInstall}
                                disabled={!canProceed}
                                className={`flex-1 py-3 rounded-xl font-medium transition
                            ${canProceed
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-white/10 cursor-not-allowed opacity-40"
                                }`}
                            >
                                Prepare Local Model
                            </button>
                        </div>
                    </>
                )}

                {phase === "installing" && (
                    <>
                        <h2 className="text-xl font-semibold mb-4">
                            Preparing Local AI Environment…
                        </h2>

                        <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden mb-4">
                            <div
                                className="bg-emerald-500 h-full transition-all"
                                style={{ width: `${percent}%` }}
                            />
                        </div>

                        <p className="text-sm text-gray-400 mb-4">
                            Model setup in progress — {percent}% completed
                        </p>

                        <p className="text-emerald-400 mb-4">{status}</p>

                        <div
                            ref={logRef}
                            className="bg-black/40 rounded-xl p-4 h-44 overflow-y-auto text-xs font-mono border border-white/10 mb-4"
                        >
                            {!isErrorStatus && logs.map((l, i) => (
                                <div key={i}>{l}</div>
                            ))}
                        </div>
                        {/* ACTION BUTTONS */}
                        <div className="mt-6 flex justify-between items-center gap-4">

                            {/* LEFT SIDE — Back */}
                            <button
                                onClick={() => setConfirmCancel(true)}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/20
                   rounded-lg text-sm text-gray-300
                   transition"
                            >
                                ⬅ Back
                            </button>

                            {/* RIGHT SIDE — Cancel */}
                            {!isErrorStatus && (
                                <button
                                    onClick={() => setConfirmCancel(true)}
                                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700
                       rounded-lg text-sm font-medium
                       text-white transition shadow-lg
                       shadow-red-500/20"
                                >
                                    ❌ Cancel Download
                                </button>
                            )}
                        </div>
                    </>
                )}

                {phase === "success" && !confirmCancel && (
                    <>
                        <h2 className="text-2xl font-semibold text-emerald-400 mb-4">
                            ✅ Local AI Ready
                        </h2>

                        <p className="text-gray-400 mb-6 leading-relaxed">
                            The model is successfully configured for the llama.cpp engine.
                            <br />
                            You can now generate problems completely offline with zero internet dependency.
                        </p>

                        <button
                            onClick={onDone}
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition font-medium"
                        >
                            Continue to Dashboard
                        </button>
                    </>
                )}

                {confirmCancel && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
                        <div className="bg-[#111827] p-6 rounded-xl border border-white/10">
                            <h3 className="text-lg mb-4">Cancel Download?</h3>
                            <p className="text-sm text-gray-400 mb-6">
                                This will stop the download and remove partially downloaded files.
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setConfirmCancel(false)}
                                    disabled={isCancelling}
                                    className="px-4 py-2 bg-white/10 rounded-lg"
                                >
                                    Continue Download
                                </button>
                                <button
                                    disabled={isCancelling}
                                    onClick={async () => {
                                        try {
                                            setIsCancelling(true);

                                            setLogs(prev => [...prev, "⏳ Cancelling download..."]);

                                            await window.api.cancelOfflineModelDownload(model);

                                            setLogs(prev => [
                                                ...prev,
                                                "Cleaning temporary model files...",
                                                "Removing corrupted downloads...",
                                                "Rollback complete."
                                            ]);

                                            setTimeout(() => {
                                                setPhase("consent");
                                                setDownloaded(0);
                                                setTotal(1);
                                                setStatus("");
                                                setLogs([]);
                                                setConfirmCancel(false);
                                                setIsCancelling(false);
                                            }, 1500);

                                        } catch (err) {
                                            setLogs(prev => [...prev, "❌ Failed to cancel properly"]);
                                            setIsCancelling(false);
                                        }
                                    }}
                                    className={`px-5 py-2.5 rounded-lg flex items-center justify-center gap-2
        transition font-medium
        ${isCancelling
                                        ? "bg-red-700 cursor-not-allowed opacity-80"
                                        : "bg-red-600 hover:bg-red-700"
                                    }
    `}
                                >
                                    {isCancelling && (
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    )}

                                    {isCancelling ? "Cancelling..." : "Yes, Cancel"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
