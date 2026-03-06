import { useState , useEffect} from "react";
import { saveAIKeys } from "@/services/aiKeyService.ts";
import LlamaSetupModal from "./LlamaSetupModal.tsx";
import GlassDropdown from "@/components/GlassDropdown.tsx";
import { CloudIcon, ComputerDesktopIcon, CheckCircleIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

type Mode = "online" | "offline";
type Provider = "openrouter" | "hf" | "llama";

export default function AISetupModal({
                                         onDone,
                                         onBackToRegister
                                     }: {
    onDone: () => void;
    onBackToRegister: () => void;
}) {
    const [isLoading, setIsLoading] = useState(true); // Start as true
    const [mode, setMode] = useState<Mode>("online");
    const [provider, setProvider] = useState<Provider>("openrouter");

    const [openRouter, setOpenRouter] = useState("");
    const [hf, setHf] = useState("");
    const [ollamaModel, setOllamaModel] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [showOllamaSetupModal, setShowOllamaSetupModal] = useState(false);

    const [systemInfo, setSystemInfo] = useState<any | null>(null);
    const [offlineAllowed, setOfflineAllowed] = useState(true);
    type ModelOption = {
        modelName: string;
        recommended: boolean;
    };
    const [recommendedModels, setRecommendedModels] = useState<ModelOption[]>([]);
    const shouldShowInfo = (mode === "offline" && systemInfo && systemInfo.allowed) ||
        (mode === "online" && systemInfo && !systemInfo.allowed);

    useEffect(() => {
        async function checkSystem() {
            try {
                setIsLoading(true);
                const sys = await window.api.checkSystemForOllama();

                setOfflineAllowed(sys.allowed);
                setRecommendedModels(sys.recommendedModels);
                setSystemInfo(sys);
            } catch (error) {
                console.error("System check failed", error);
            } finally {
                // This runs regardless of success or failure
                setIsLoading(false);
            }
        }
        checkSystem();
    }, []);

    useEffect(() => {
        if (recommendedModels.length && !ollamaModel) {
            setOllamaModel(recommendedModels[0].modelName);
        }
    }, [recommendedModels]);

    async function commitSave() {
        await saveAIKeys({
            mode,
            provider,
            openRouterKey: openRouter.trim(),
            hfKey: hf.trim(),
            ollamaModel
        });
        onDone();
    }

    async function validateOnlineKeys(): Promise<boolean> {
        try {
            setIsValidating(true);

            if (provider === "openrouter") {
                const key = openRouter.trim();

                if (!key) {
                    setError("OpenRouter API key required");
                    return false;
                }

                const res = await window.api.validateOpenRouterApiKey(key);

                if (!res || res.valid !== true) {
                    setError(res?.reason || "Invalid OpenRouter API key");
                    return false;
                }
            }

            if (provider === "hf") {
                const key = hf.trim();

                if (!key) {
                    setError("HuggingFace API key required");
                    return false;
                }

                const res = await window.api.validateHFKey(key);

                if (!res || res.valid !== true) {
                    setError(res?.reason || "Invalid HuggingFace API key");
                    return false;
                }
            }

            return true;

        } catch (err) {
            setError("Validation failed. Please check internet connection.");
            return false;
        } finally {
            setIsValidating(false);
        }
    }

    async function save() {
        try {
            setError(null);
            setIsSaving(true);

            if (mode === "online") {
                if (provider === "openrouter") {
                    if (!openRouter.trim()) {
                        setError("OpenRouter API key required");
                        return;
                    }
                }

                if (provider === "hf") {
                    if (!hf.trim()) {
                        setError("HuggingFace API key required");
                        return;
                    }
                }

                const isValid = await validateOnlineKeys();

                if (!isValid) {
                    setIsSaving(false);
                    return; // 🚫 STOP here if invalid
                }
            }

            if (mode === "offline") {
                if (!ollamaModel.trim()) {
                    setError("Please select an AI model");
                    return;
                }

                // 🔥 DO NOT SAVE YET
                setShowOllamaSetupModal(true);
                return;
            }

            // ✅ Only online reaches here
            await commitSave();

        } catch (e) {
            setError("Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="modal-root app-bg">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            <div className="relative z-10 grid place-items-center min-h-screen">
                <div className="w-full max-w-lg bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-8 shadow-2xl animate-scaleIn">

                    <h2 className="text-2xl font-semibold mb-4">AI Configuration</h2>

                    {/* ================= LOADER STATE ================= */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-6">
                            <div className="relative">
                                {/* Inner Spinning Ring */}
                                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                {/* Outer Pulsing Glow */}
                                <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-500/10 rounded-full animate-pulse scale-125"></div>
                            </div>
                            <div className="text-center">
                                <p className="text-indigo-200 font-medium">Analyzing Hardware</p>
                                <p className="text-xs text-indigo-300/60 mt-1">Checking GPU and AVX2 compatibility...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ================= MODE SELECTION ================= */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <button
                                    onClick={() => { setMode("online"); setProvider("openrouter"); setError(null); }}
                                    className={`group flex items-center justify-center gap-2 py-3 rounded-xl border transition
        ${mode === "online"
                                        ? "bg-indigo-600 border-indigo-500 text-white"
                                        : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                                    }
    `}
                                >
                                    <CloudIcon className="w-5 h-5 opacity-90 group-hover:scale-110 transition" />

                                    Online Mode
                                </button>


                                <button
                                    disabled={!offlineAllowed}
                                    onClick={() => {
                                        if (!offlineAllowed) return;
                                        setMode("offline");
                                        setError(null);
                                        setProvider("llama");
                                    }}
                                    className={`group flex items-center justify-center gap-2 py-3 rounded-xl border transition
        ${mode === "offline"
                                        ? "bg-emerald-600 border-emerald-500 text-white"
                                        : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                                    }
        ${!offlineAllowed ? "opacity-40 cursor-not-allowed" : ""}
    `}
                                >
                                    <ComputerDesktopIcon className="w-5 h-5 opacity-90 group-hover:scale-110 transition" />

                                    Offline Mode
                                </button>
                            </div>

                            {systemInfo && shouldShowInfo && (
                                <div className="mt-4 mb-4 max-h-32 overflow-y-auto text-sm
                                            text-amber-300 bg-amber-500/10
                                            border border-amber-500/20
                                            rounded-xl p-4 leading-relaxed">
                                    {!systemInfo.allowed &&
                                        (<p className="font-semibold mb-2 text-amber-200">
                                            Offline mode is not recommended for your system
                                        </p>)}

                                    {systemInfo.reason && (
                                        <p className="mb-3 text-amber-300">
                                            {systemInfo.reason}
                                        </p>
                                    )}

                                    <div className="text-xs text-amber-200/80 space-y-1">
                                        <p><strong>CPU:</strong> {systemInfo.system.cpuModel}</p>
                                        <p><strong>Cores:</strong> {systemInfo.system.cpuCores}</p>
                                        <p><strong>RAM:</strong> {systemInfo.system.totalMemGB} GB</p>
                                        <p><strong>Free Disk:</strong> {systemInfo.system.freeDiskGB} GB</p>
                                        <p><strong>AVX2 Support:</strong> {systemInfo.system.hasAvx2 ? "Yes" : "No"}</p>
                                        <p><strong>GPU:</strong> {systemInfo.system.gpu}</p>
                                        <p><strong>Has Dedicated GPU:</strong> {systemInfo.system.hasDedicatedGPU ? "Yes" : "No"}</p>
                                    </div>

                                    {!systemInfo.allowed && (
                                        <p className="mt-3 text-xs text-amber-200">
                                            Please use <strong>Online Mode</strong> for faster and more reliable AI generation on this system.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* ================= NOTES ================= */}
                            <div className="text-xs text-gray-400 mb-6 leading-relaxed">
                                {mode === "online" ? (
                                    <>
                                        <p>
                                            <strong>Online Mode</strong> uses cloud AI to generate problems.
                                            Requires internet and an API key.
                                        </p>
                                        <p className="mt-1">
                                            Recommended if you want best quality generation without installing anything.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p>
                                            <strong>Offline Mode</strong> uses your local llama model.
                                            No API key, no internet, completely free.
                                        </p>
                                        <p className="mt-1 leading-relaxed text-gray-300">
                                            The required AI model will be downloaded and configured automatically if it is not already present on your system.
                                            <br />
                                            <span className="text-emerald-400 font-medium">
                                                No external installation or setup is required.
                                            </span>
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* ================= ONLINE SECTION ================= */}
                            {mode === "online" && (
                                <div className="space-y-6">
                                    <div className="text-xs text-gray-400 leading-relaxed">
                                        Choose which cloud AI provider you want to use.
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            onClick={() => setProvider("openrouter")}
                                            className={`cursor-pointer rounded-xl border p-4 transition
                                        ${provider === "openrouter"
                                                ? "border-indigo-500 bg-indigo-600/20"
                                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                            }`}
                                        >
                                            <h3 className="font-semibold text-sm mb-1">OpenRouter</h3>
                                            <p className="text-xs text-gray-400">Supports GPT, Claude, Gemini via one key.</p>
                                        </div>

                                        <div
                                            onClick={() => setProvider("hf")}
                                            className={`cursor-pointer rounded-xl border p-4 transition
                                        ${provider === "hf"
                                                ? "border-emerald-500 bg-emerald-600/20"
                                                : "border-white/10 bg-white/5 hover:bg-white/10"
                                            }`}
                                        >
                                            <h3 className="font-semibold text-sm mb-1">HuggingFace</h3>
                                            <p className="text-xs text-gray-400">Free tier models. Slightly slower.</p>
                                        </div>
                                    </div>

                                    {provider === "openrouter" && (
                                        <input
                                            type="password"
                                            placeholder="Paste your OpenRouter API key"
                                            value={openRouter}
                                            onChange={(e) => setOpenRouter(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:ring-2 focus:ring-indigo-500/40 outline-none"
                                        />
                                    )}

                                    {provider === "hf" && (
                                        <input
                                            type="password"
                                            placeholder="Paste your HuggingFace API key"
                                            value={hf}
                                            onChange={(e) => setHf(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                                        />
                                    )}
                                </div>
                            )}

                            {/* ================= OFFLINE SECTION ================= */}
                            {mode === "offline" && (
                                <div className="space-y-4">
                                    <GlassDropdown
                                        value={ollamaModel}
                                        onChange={(val: string) => setOllamaModel(val)}
                                        options={recommendedModels.map(m => ({
                                            label: m.modelName,
                                            value: m.modelName,
                                            recommended: m.recommended
                                        }))}
                                    />
                                </div>
                            )}

                            {error && (
                                <div className="text-red-400 text-sm mt-4">{error}</div>
                            )}

                            {isValidating && (
                                <div className="text-indigo-400 text-sm mt-2 animate-pulse">
                                    Validating API key...
                                </div>
                            )}

                            <div className="mt-8 space-y-3">
                                <button
                                    onClick={save}
                                    disabled={isSaving || isValidating}
                                    className="
        group w-full py-3 rounded-xl
        flex items-center justify-center gap-2
        bg-indigo-600 hover:bg-indigo-700
        text-white font-medium
        transition-all duration-200
        disabled:opacity-60 disabled:cursor-not-allowed
    "
                                >
                                    {!isSaving && !isValidating && (
                                        <CheckCircleIcon className="w-5 h-5 opacity-90 group-hover:scale-105 transition" />
                                    )}

                                    {isValidating
                                        ? "Validating..."
                                        : isSaving
                                            ? "Saving…"
                                            : "Save & Continue"}
                                </button>


                                <button
                                    onClick={onBackToRegister}
                                    className="
        group w-full py-3 rounded-xl
        flex items-center justify-center gap-2
        bg-white/5 hover:bg-white/10
        border border-white/10
        text-gray-300
        transition-all duration-200
    "
                                >
                                    <ArrowLeftIcon className="w-5 h-5 opacity-90 group-hover:-translate-x-1 transition-transform" />

                                    Back
                                </button>
                            </div>
                        </>
                    )}
                </div>
                {showOllamaSetupModal && (
                    <LlamaSetupModal
                        model={ollamaModel}
                        onBack={() => setShowOllamaSetupModal(false)}
                        onDone={async () => {
                            await commitSave();   // ✅ Save only AFTER model ready
                            setShowOllamaSetupModal(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
