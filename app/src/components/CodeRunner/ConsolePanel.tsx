import { useState, useRef, useEffect } from "react";

type Props = {
    setActiveTab: (v: "output" | "results") => void;
    activeTab: "output" | "results";
    consoleOutput: string;
    submitResult: any;
    loading: boolean;
};

export default function ConsolePanel({
                                         setActiveTab,
                                         activeTab,
                                         consoleOutput,
                                         submitResult,
                                         loading,
                                     }: Props) {

    const [height, setHeight] = useState(220);
    const [expanded, setExpanded] = useState(false);

    const startY = useRef(0);
    const startHeight = useRef(0);
    const dragging = useRef(false);

    const MIN = 140;
    const MAX = 500;

    useEffect(() => {

        function move(e: MouseEvent) {

            if (!dragging.current) return;

            const delta = startY.current - e.clientY;
            const newHeight = startHeight.current + delta;

            const clamped = Math.max(MIN, Math.min(MAX, newHeight));

            setHeight(clamped);
        }

        function up() {
            dragging.current = false;
            document.body.style.cursor = "default";
        }

        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);

        return () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        };

    }, []);

    const output = consoleOutput ? `[OUTPUT] : ${consoleOutput}` : "Run your code to see output";

    return (
        <div
            style={{ height: expanded ? "60%" : height }}
            className="
                relative
                rounded-2xl
                border border-white/10
                bg-gradient-to-br from-[#05070D] to-[#0B1220]
                backdrop-blur-xl
                shadow-[0_10px_40px_rgba(0,0,0,0.6)]
                flex flex-col
                overflow-hidden
                min-h-0
            "
        >

            {/* DRAG HANDLE */}
            <div
                onMouseDown={(e) => {
                    dragging.current = true;
                    startY.current = e.clientY;
                    startHeight.current = height;
                    document.body.style.cursor = "row-resize";
                }}
                className="
                    absolute top-0 left-0 right-0
                    h-2 cursor-row-resize
                    bg-white/10 hover:bg-indigo-500/40
                "
            />

            {/* HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">

                <div className="flex gap-2">

                    <button
                        onClick={() => setActiveTab("output")}
                        className={`
                            px-4 py-1.5 rounded-lg text-xs font-medium transition
                            ${activeTab === "output"
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-white/5 text-gray-400 hover:bg-white/10"}
                        `}
                    >
                        Output
                    </button>

                    <button
                        onClick={() => setActiveTab("results")}
                        className={`
                            px-4 py-1.5 rounded-lg text-xs font-medium transition
                            ${activeTab === "results"
                            ? "bg-indigo-600 text-white shadow"
                            : "bg-white/5 text-gray-400 hover:bg-white/10"}
                        `}
                    >
                        Results
                    </button>

                </div>

                {/* RIGHT SIDE */}
                <div className="flex items-center gap-3">

                    {/* EXPAND BUTTON */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="
                            text-xs px-3 py-1 rounded-lg
                            bg-white/5 hover:bg-white/10
                            border border-white/10
                            text-gray-300
                        "
                    >
                        {expanded ? "Collapse" : "Expand"}
                    </button>

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div
                            className={`
                                w-2.5 h-2.5 rounded-full animate-pulse
                                ${loading ? "bg-yellow-400" : "bg-emerald-400"}
                            `}
                        />
                        {loading ? "Running..." : "Ready"}
                    </div>

                </div>

            </div>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto p-4 text-sm">

                {loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-4">

                        <div className="relative w-10 h-10">
                            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30" />
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin" />
                        </div>

                        <p className="text-indigo-300 text-sm">
                            Preparing and running your code...
                        </p>

                    </div>
                )}

                {/* ================= OUTPUT TAB ================= */}
                {!loading && activeTab === "output" && (
                    <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed">
                        {output}
                    </pre>
                )}

                {/* ================= RESULTS TAB ================= */}
                {!loading && activeTab === "results" && submitResult && (

                    <div className="space-y-5">

                        {/* PASS SUMMARY */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">

                            <div className="flex items-center justify-between mb-2">

                                <div className="text-gray-300">
                                    Passed Test Cases
                                </div>

                                <div className="text-white font-semibold">
                                    {submitResult.testResult?.passedCount}/
                                    {submitResult.testResult?.total}
                                </div>

                            </div>

                            {/* PROGRESS BAR */}
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400"
                                    style={{
                                        width: `${(submitResult.testResult?.passedCount /
                                            submitResult.testResult?.total) * 100 || 0}%`
                                    }}
                                />
                            </div>

                        </div>


                        {/* COMPLEXITY + DECISION */}
                        <div className="grid grid-cols-2 gap-4">

                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                                <div className="text-xs text-indigo-300 mb-1">
                                    Complexity
                                </div>
                                <div className="text-white font-semibold">
                                    {submitResult.complexity || "—"}
                                </div>
                            </div>

                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                                <div className="text-xs text-purple-300 mb-1">
                                    Decision
                                </div>

                                <div className={`
                            font-semibold
                            ${submitResult.hireDecision === "Accept"
                                    ? "text-emerald-400"
                                    : "text-red-400"}
                        `}>
                                    {submitResult.hireDecision || "—"}
                                </div>
                            </div>

                        </div>


                        {/* AI FEEDBACK */}
                        {submitResult.ai && (
                            <div className="space-y-4">

                                {/* SCORE */}
                                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">

                                    <div>
                                        <div className="text-xs text-gray-400">
                                            Interview Readiness
                                        </div>
                                        <div className="text-white font-semibold">
                                            {submitResult.ai.interviewReadiness}
                                        </div>
                                    </div>

                                    <div className="
                                w-12 h-12
                                rounded-full
                                bg-gradient-to-br from-indigo-500 to-purple-600
                                flex items-center justify-center
                                text-white font-bold
                                shadow-lg
                            ">
                                        {submitResult.ai.score ?? 0}
                                    </div>

                                </div>


                                {/* STRENGTHS */}
                                {submitResult.ai.strengths?.length > 0 && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                        <div className="text-emerald-300 font-semibold mb-2">
                                            Strengths
                                        </div>

                                        <ul className="space-y-1 text-gray-300 text-sm">
                                            {submitResult.ai.strengths.map((s: string, i: number) => (
                                                <li key={i}>• {s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}


                                {/* WEAKNESSES */}
                                {submitResult.ai.weaknesses?.length > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                        <div className="text-red-300 font-semibold mb-2">
                                            Weaknesses
                                        </div>

                                        <ul className="space-y-1 text-gray-300 text-sm">
                                            {submitResult.ai.weaknesses.map((w: string, i: number) => (
                                                <li key={i}>• {w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}


                                {/* SUGGESTIONS */}
                                {submitResult.ai.suggestions?.length > 0 && (
                                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                                        <div className="text-indigo-300 font-semibold mb-2">
                                            Suggestions
                                        </div>

                                        <ul className="space-y-1 text-gray-300 text-sm">
                                            {submitResult.ai.suggestions.map((s: string, i: number) => (
                                                <li key={i}>• {s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            </div>
                        )}

                    </div>

                )}

            </div>

        </div>
    );
}