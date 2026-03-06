import { Suspense, useEffect, useRef, useState } from "react";
import * as Prism from "prismjs";
import { showToast } from "@/util/toast.ts";
import React from "react";

import "prismjs/components/prism-java";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css";
import AITutorModal from "@/ui/modal/AITutorModal.tsx";
import { FaJava } from "react-icons/fa";
import { SiPython } from "react-icons/si";
import {
    DocumentArrowDownIcon,
    ChatBubbleBottomCenterIcon,
    CommandLineIcon,
    BoltIcon,
    LightBulbIcon,
    Squares2X2Icon
} from "@heroicons/react/24/outline";
import CodeRunnerPanel from "@/components/CodeRunner/CodeRunnerPanel.tsx";

const VisualizationModal = React.lazy(
    () => import("../visualization/VisualizationModal.tsx"),
);

type SolveModalProps = {
    problem: any;
    solved: boolean;
    onClose: (shouldRefresh?: boolean) => void;
    userId: string;
};

/* ⏱ 2 MINUTE LOCK */
const SOLUTION_LOCK_TIME = 2 * 60; // seconds

function cleanCode(code = "", lang: "java" | "python") {
    return code
        .replace(new RegExp("```" + lang, "gi"), "")
        .replace(/```/g, "")
        .trim();
}

function isIncompleteSolution(code?: string) {
    if (!code) return true;
    return (
        code.includes("Your solution logic here") ||
        code.includes("Implementation goes here") ||
        code.includes("TODO") ||
        code.length < 80
    );
}

function autoCenterAsciiBlock(text: string) {
    const lines = text.split("\n");

    if (lines.length < 3) return text;

    // Detect if this looks like a tree / ASCII diagram
    const looksLikeTree = lines.some((l) => /[\/\\]/.test(l));
    if (!looksLikeTree) return text;

    // Find max left padding in all lines except first
    const paddings = lines.slice(1).map((l) => l.match(/^\s*/)?.[0].length || 0);
    const maxPad = Math.max(...paddings);

    // If first line has no padding, center it
    if ((lines[0].match(/^\s*/)?.[0].length || 0) === 0) {
        lines[0] = " ".repeat(Math.floor(maxPad / 2)) + lines[0];
    }

    return lines.join("\n");
}

function renderProblemText(text: string) {
    if (!text) return null;

    console.log("Problem Text: " + text);

    // 🔥 REMOVE AI SEPARATORS LIKE --- *** ::::
    text = text.replace(/^\s*[-:*]{3,}\s*$/gm, "");

    const sections = [
        { key: "Example:", color: "text-indigo-400" },
        { key: "Input:", color: "text-emerald-400" },
        { key: "Output:", color: "text-amber-400" },
        { key: "Explanation:", color: "text-purple-400" },
    ];

    const elements: React.ReactNode[] = [];

    let remaining = text;

    sections.forEach((section, idx) => {
        const index = remaining.indexOf(section.key);

        if (index === -1) return;

        // Text before this section
        const before = remaining.slice(0, index).trim();
        if (before) {
            elements.push(
                <p
                    key={`before-${idx}`}
                    className="text-gray-300 whitespace-pre-line mb-3"
                >
                    {before}
                </p>,
            );
        }

        // Cut from this section onward
        remaining = remaining.slice(index);

        // Find next section start
        let nextIndex = remaining.length;
        for (let s of sections) {
            if (s.key === section.key) continue;
            const i = remaining.indexOf(s.key);
            if (i > 0 && i < nextIndex) nextIndex = i;
        }

        const block = remaining.slice(0, nextIndex).trim();
        remaining = remaining.slice(nextIndex);

        let content = block.replace(section.key, "");

        // ❗ DO NOT TRIM ascii blocks (Input / Output)
        if (section.key !== "Input:" && section.key !== "Output:") {
            content = content.trim();
        }

        content = autoCenterAsciiBlock(content);

        elements.push(
            <div key={`sec-${idx}`} className="mt-5">
                <h4 className={`font-semibold mb-2 ${section.color}`}>
                    {section.key.replace(":", "")}
                </h4>

                {/* Input / Output get glass box */}
                {section.key === "Input:" || section.key === "Output:" ? (
                    <div
                        className="
                            my-4
                            w-full
                            bg-white/5 border border-white/10
                            backdrop-blur-xl rounded-2xl
                            p-5 font-mono text-sm text-emerald-300
                            whitespace-pre-wrap
                            break-words
                            leading-relaxed
                          "
                    >
                        {content}
                    </div>
                ) : (
                    <p className="text-gray-300 whitespace-pre-line">{content}</p>
                )}
            </div>,
        );
    });

    // Anything left
    if (remaining.trim()) {
        elements.push(
            <p key="end" className="text-gray-300 whitespace-pre-line mt-3">
                {remaining.trim()}
            </p>,
        );
    }

    return elements;
}

function parseProblemFields(content: any) {
    const raw = content?.problem || "";

    let problemText = raw;
    let exampleInput = "";
    let exampleOutput = "";

    // Extract Example block
    const exampleMatch = raw.match(/Example:\s*([\s\S]*)/i);

    if (exampleMatch) {
        const exampleBlock = exampleMatch[1];

        const inputMatch = exampleBlock.match(/Input:\s*(.*)/i);
        const outputMatch = exampleBlock.match(/Output:\s*(.*)/i);

        if (inputMatch) exampleInput = inputMatch[1].trim();
        if (outputMatch) exampleOutput = outputMatch[1].trim();

        // Remove example from main problem text
        problemText = raw.replace(exampleMatch[0], "").trim();
    }

    const explanation = content.solution.explanation;

    return {
        problemText,
        exampleInput,
        exampleOutput,
        explanation,
    };
}

const langIcons = {
    python: <SiPython className="text-blue-400" />,
    java: <FaJava className="text-red-400" />,
};
export default function SolveModal({
                                       problem,
                                       solved,
                                       onClose,
                                       userId,
                                   }: SolveModalProps) {
    const [content, setContent] = useState(() =>
        typeof problem.content === "string"
            ? JSON.parse(problem.content)
            : problem.content,
    );

    const isSolved = solved;
    const [showHints, setShowHints] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const [activeLang, setActiveLang] = useState<"java" | "python">("java");
    const [refreshing, setRefreshing] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [leftWidth, setLeftWidth] = useState(45); // %
    const [showVisualization, setShowVisualization] = useState(false);
    const [showRunner, setShowRunner] = useState(false);
    const prevShowSolutionRef = useRef<boolean>(false);

    const dragMode = useRef<"horizontal" | null>(null);

    const [solutionRegenerated, setSolutionRegenerated] = useState(false);

    const NORMAL_MIN = 25;
    const NORMAL_MAX = 55;

    const CODE_MIN = 45;
    const CODE_MAX = 30;

    useEffect(() => {
        if (showRunner) {
            setLeftWidth((prev) => Math.max(CODE_MIN, Math.min(CODE_MAX, prev)));
        }
    }, [showRunner]);

    /* ---------- PDF GENERATOR ---------- */
    const generatePDF = async () => {
        try {
            // Just send the data to the main process
            const result = await window.api.downloadProblemPdf({
                problem,
                content,
            });

            if (result.success) {
                console.log("PDF Saved to:", result.path);
                showToast("PDF saved successfully", "success");
            } else if (result.message !== "Save cancelled") {
                showToast(`Error saving PDF: ${result.error}`, "error");
            }
        } catch (err) {
            showToast("Failed to generate PDF", "error");
            console.error("IPC PDF Error:", err);
        }
    };

    /* ---------- STORAGE & TIMER (EXISTING) ---------- */
    const storageKey = `solution-lock-${problem.id}`;
    const sessionUnlockKey = `solution-unlocked-${problem.id}`;
    const [remaining, setRemaining] = useState<number | null>(null);

    useEffect(() => {
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "auto";
        };
    }, [showRunner]);

    useEffect(() => {
        function handleMove(e: MouseEvent) {
            if (!dragMode.current) return;

            /**
             * ===============================
             * HORIZONTAL RESIZE
             * ===============================
             */
            if (dragMode.current === "horizontal") {
                const percent = (e.clientX / window.innerWidth) * 100;

                const min = showRunner ? CODE_MIN : NORMAL_MIN;
                const max = showRunner ? CODE_MAX : NORMAL_MAX;

                const clamped = Math.max(min, Math.min(max, percent));

                setLeftWidth(clamped);
            }
        }

        function stopDrag() {
            if (!dragMode.current) return;

            dragMode.current = null;

            document.body.style.cursor = "default";
            document.body.classList.remove("no-select");
        }

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", stopDrag);

        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", stopDrag);
        };
    }, []);

    useEffect(() => {
        if (isSolved || sessionStorage.getItem(sessionUnlockKey)) {
            setShowSolution(true);
            setRemaining(null);
            return;
        }
        const unlockAt = Number(localStorage.getItem(storageKey));
        if (unlockAt && unlockAt > Date.now()) {
            setRemaining(Math.ceil((unlockAt - Date.now()) / 1000));
        }
    }, [storageKey, sessionUnlockKey, isSolved]);

    useEffect(() => {
        if (remaining === null || remaining <= 0) return;
        const timer = setInterval(() => {
            setRemaining((r) => (r ? r - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [remaining]);

    useEffect(() => {
        if (remaining === 0) {
            localStorage.removeItem(storageKey);
            sessionStorage.setItem(sessionUnlockKey, "true");
            setRemaining(null);
            setShowSolution(true);
        }
    }, [remaining, storageKey, sessionUnlockKey]);

    useEffect(() => {
        if (showSolution) Prism.highlightAll();
    }, [showSolution, activeLang, content]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose(solutionRegenerated);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    useEffect(() => {
        const scrollBarWidth =
            window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = "hidden";
        document.body.style.paddingRight = `${scrollBarWidth}px`;

        return () => {
            document.body.style.overflow = "auto";
            document.body.style.paddingRight = "0px";
        };
    }, []);

    const startSolutionTimer = () => {
        if (sessionStorage.getItem(sessionUnlockKey)) {
            setShowSolution(true);
            return;
        }
        const unlockAt = Date.now() + SOLUTION_LOCK_TIME * 1000;
        localStorage.setItem(storageKey, String(unlockAt));
        setRemaining(SOLUTION_LOCK_TIME);
    };

    async function refreshSolution() {
        if (!problem.id || refreshing) return;

        try {
            setRefreshing(true);

            // 1️⃣ Regenerate on backend
            await window.api.regenerateSolution(problem.id);

            // 2️⃣ Fetch latest problem from DB
            const updatedProblem = await window.api.getProblemById(problem.id);

            if (!updatedProblem) {
                showToast("Failed to fetch updated problem", "error");
                return;
            }

            const parsed =
                typeof updatedProblem.content === "string"
                    ? JSON.parse(updatedProblem.content)
                    : updatedProblem.content;

            // 3️⃣ Update modal state
            setContent(parsed);

            // 4️⃣ Force solution visible
            setShowSolution(true);

            setSolutionRegenerated(true);

            showToast("Solution regenerated successfully ✨", "success");
        } catch (err) {
            console.error("Refresh failed:", err);
            showToast("Failed to regenerate solution", "error");
        } finally {
            setRefreshing(false);
        }
    }

    const handleVisualizeClick = () => {
        console.log("Visualize Algorithm clicked");
        setShowVisualization(true);
    };

    const formatTime = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const javaCode = cleanCode(content.solution?.java, "java");
    const pythonCode = cleanCode(content.solution?.python, "python");

    function buildSubmissionProblem() {
        const parsed = parseProblemFields(content);

        return {
            id: problem.id,
            title: problem.title,

            problem: parsed.problemText,
            exampleInput: parsed.exampleInput,
            exampleOutput: parsed.exampleOutput,

            constraints: content.constraints || "",

            difficulty: problem.difficulty,
            pattern: problem.pattern,
            explanation: parsed.explanation,
            javaCode: javaCode,
            pythonCode: pythonCode,
            javaStarter: content.java_starter,
            pythonStarter: content.python_starter,
            javascriptStarter: content.javascript_starter,
            csharpStarter: content.csharp_starter,
        };
    }
    const submissionProblem = buildSubmissionProblem();

    return (
        <div
            className="
        fixed inset-0 z-50
        bg-black/80 backdrop-blur-xl
        flex items-center justify-center p-6 overflow-hidden

        transform-gpu translate-z-0
        will-change-transform
        [contain:layout_paint]
        backface-hidden
    "
        >
            <div
                className="
            w-full max-w-[1400px] h-[92vh]
            bg-[#0B1220] rounded-3xl border border-white/10
            shadow-[0_40px_140px_rgba(0,0,0,0.8)]
            flex flex-col overflow-hidden

            transform-gpu translate-z-0
            will-change-transform
            [contain:layout_paint]
            backface-hidden
        "
            >
                {/* ================= HEADER ================= */}
                <div
                    className="
                flex items-center justify-between px-10 py-6
                border-b border-white/10
                bg-[#0B1220]/90 backdrop-blur-xl

                transform-gpu translate-z-0
            "
                >
                    <div>
                        <h2 className="text-2xl font-semibold text-white">
                            {problem.title}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {problem.pattern} · {problem.difficulty}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={generatePDF}
                            className="
        group flex items-center gap-3
        px-4 py-2
        rounded-xl
        bg-white/[0.04]
        border border-white/10
        hover:bg-white/[0.08]
        backdrop-blur-md
        transition-all duration-200
        text-sm font-medium text-gray-200
        hover:text-white
        hover:border-white/20
        focus:outline-none focus:ring-2 focus:ring-indigo-500/40
        "
                        >
              <span
                  className="
            flex items-center justify-center
            w-7 h-7
            rounded-lg
            bg-white/5
            group-hover:bg-white/10
            transition
        "
              >
                <DocumentArrowDownIcon className="w-4 h-4 opacity-80 group-hover:opacity-100" />
              </span>
                            Download PDF
                        </button>

                        <button
                            onClick={() => setShowAI(true)}
                            className="
        group flex items-center gap-3
        px-4 py-2
        rounded-xl
        bg-gradient-to-r from-indigo-600/20 to-purple-600/20
        border border-indigo-500/30
        hover:from-indigo-600/30 hover:to-purple-600/30
        backdrop-blur-md
        transition-all duration-200
        text-sm font-medium text-indigo-300
        hover:text-indigo-200
        focus:outline-none focus:ring-2 focus:ring-indigo-500/40
        "
                        >
              <span
                  className="
            flex items-center justify-center
            w-7 h-7
            rounded-lg
            bg-indigo-500/20
            group-hover:bg-indigo-500/30
            transition
        "
              >
                <ChatBubbleBottomCenterIcon className="w-4 h-4" />
              </span>
                            Ask AI Tutor
                        </button>

                        <button
                            onClick={handleVisualizeClick}
                            title="Generate charts and visual explanation for this problem"
                            className="
        group flex items-center gap-3
        px-4 py-2
        rounded-xl
        bg-gradient-to-r from-indigo-600/20 to-purple-600/20
        border border-indigo-500/30
        hover:from-indigo-600/30 hover:to-purple-600/30
        backdrop-blur-md
        transition-all duration-200
        text-sm font-medium text-indigo-300
        hover:text-indigo-200
        focus:outline-none focus:ring-2 focus:ring-indigo-500/40
    "
                        >
    <span
        className="
            flex items-center justify-center
            w-7 h-7
            rounded-lg
            bg-indigo-500/20
            group-hover:bg-indigo-500/30
            transition
        "
    >
        <Squares2X2Icon  className="w-4 h-4" />
    </span>

                            Visualize Algorithm
                        </button>

                        <button
                            onClick={() => onClose(solutionRegenerated)}
                            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-gray-300"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ================= BODY ================= */}
                <div
                    className="
                flex flex-1 overflow-hidden relative

                transform-gpu translate-z-0
                will-change-transform
            "
                >
                    {/* LEFT PANEL */}
                    <div
                        style={{ width: `${leftWidth}%` }}
                        className="
                    border-r border-white/10
                    overflow-y-auto overscroll-contain
                    px-10 py-8 space-y-10

                    transform-gpu translate-z-0
                    will-change-scroll-position
                "
                    >
                        <section>
                            <h3 className="text-lg font-semibold mb-3 text-indigo-400">
                                Problem
                            </h3>
                            <div className="leading-relaxed">
                                {renderProblemText(content.problem)}
                            </div>
                        </section>

                        {content.constraints && (
                            <section className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
                                <h3 className="text-sm font-semibold text-red-400 mb-2">
                                    Constraints
                                </h3>
                                <p className="text-gray-300 text-sm whitespace-pre-line">
                                    {content.constraints}
                                </p>
                            </section>
                        )}

                        {content.hints?.length > 0 && (
                            <section>
                                <button
                                    onClick={() => setShowHints(true)}
                                    disabled={showHints || isSolved}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 disabled:opacity-50"
                                >
                                    {showHints || isSolved ? "See Hints" : "Show Hints"}
                                </button>

                                {(showHints || isSolved) && (
                                    <div className="mt-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5 space-y-2">
                                        {content.hints.map((h: string, i: number) => (
                                            <p key={i} className="text-gray-300 text-sm">
                                                • {h}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    {/* DRAG DIVIDER */}
                    <div
                        onMouseDown={() => {
                            dragMode.current = "horizontal";
                            document.body.style.cursor = "col-resize";
                            document.body.classList.add("no-select");
                        }}
                        className="
                    w-2 cursor-col-resize
                    bg-white/5 hover:bg-indigo-500/40
                    transition

                    transform-gpu translate-z-0
                "
                    />

                    {/* RIGHT PANEL */}

                    <div
                        style={{ width: `${100 - leftWidth}%` }}
                        className={`
        flex flex-col h-full
        overflow-hidden
        relative isolate
        ${showRunner ? "" : "px-10 py-8 overflow-y-auto overscroll-contain"}
    `}
                    >
                        {/* ================= NORMAL MODE ================= */}
                        {!showRunner && (
                            <>
                                <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                                    {/* LEFT SIDE BUTTON GROUP */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {/* SHOW SOLUTION */}
                                        <button
                                            disabled={isSolved || showSolution || remaining !== null}
                                            onClick={startSolutionTimer}
                                            className="
                                                group
                                                h-11 px-6 min-w-[260px]
                                                rounded-xl
                                                flex items-center justify-center gap-2
                                                bg-gradient-to-r from-emerald-600 to-green-600
                                                hover:from-emerald-700 hover:to-green-700
                                                text-white font-medium
                                                shadow-lg shadow-emerald-500/20
                                                transition-all duration-200
                                                disabled:opacity-60 disabled:cursor-not-allowed
                                            "
                                        >
                                            {!isSolved && !showSolution && remaining === null && (
                                                <LightBulbIcon className="w-5 h-5 opacity-90 group-hover:scale-110 transition-transform duration-200" />
                                            )}

                                            {isSolved
                                                ? "Solved"
                                                : showSolution
                                                    ? "Solution Unlocked"
                                                    : remaining !== null
                                                        ? `Solution unlocks in ${formatTime(remaining)}`
                                                        : "Show Solution"}
                                        </button>

                                        {/* CODE PLAYGROUND */}
                                        <button
                                            className="
                                                group
                                                h-11 px-6
                                                rounded-xl
                                                flex items-center justify-center gap-2
                                                bg-gradient-to-r from-purple-600 to-indigo-600
                                                hover:from-purple-700 hover:to-indigo-700
                                                text-white font-medium
                                                shadow-lg shadow-purple-500/20
                                                transition-all duration-200
                                            "
                                            onClick={() => {
                                                prevShowSolutionRef.current = showSolution;
                                                setShowRunner(true);
                                                setShowSolution(false);
                                                setLeftWidth(45);
                                            }}
                                        >
                                            <CommandLineIcon className="w-5 h-5 opacity-90 group-hover:scale-110 transition-transform duration-200" />
                                            Code Playground
                                        </button>

                                        {/* REGENERATE */}
                                        {isIncompleteSolution(content.solution?.java) && (
                                            <button
                                                onClick={refreshSolution}
                                                disabled={refreshing}
                                                className={`
                                                group
                                                relative
                                                h-11 px-6 min-w-[160px]
                                                rounded-xl
                                                flex items-center justify-center gap-2
                                                font-medium text-sm
                                                transition-all duration-300
                                                backdrop-blur-xl
                                                border
                                                ${
                                                    refreshing
                                                        ? "bg-orange-500/20 border-orange-400/40 text-orange-200"
                                                        : "bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-400/30 text-orange-300 hover:from-orange-500/30 hover:to-amber-500/30 hover:border-orange-400/50"
                                                }
                                                shadow-lg hover:shadow-orange-500/20
                                                disabled:cursor-not-allowed
    `}
                                            >
                                                {refreshing ? (
                                                    <div className="w-4 h-4 border-2 border-orange-300/40 border-t-orange-300 rounded-full animate-spin" />
                                                ) : (
                                                    <BoltIcon className="w-4 h-4 opacity-90 group-hover:rotate-180 transition-transform duration-500" />
                                                )}

                                                {refreshing ? "Regenerating..." : "Regenerate Solution"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {showSolution && (
                                    <div className="space-y-8">
                                        <section>
                                            <h3 className="text-lg font-semibold mb-3 text-white">
                                                Explanation
                                            </h3>

                                            <p className="text-gray-300 whitespace-pre-line leading-relaxed">
                                                {content.solution?.explanation}
                                            </p>
                                        </section>

                                        <div className="flex gap-3">
                                            {(["java", "python"] as const).map((lang) => (
                                                <button
                                                    key={lang}
                                                    onClick={() => setActiveLang(lang)}
                                                    className={`
        group
        flex items-center gap-2
        px-4 py-2
        rounded-xl
        text-sm font-medium
        transition-all duration-200
        border
        ${
                                                        activeLang === lang
                                                            ? "bg-indigo-600/90 text-white border-indigo-400/40 shadow-lg shadow-indigo-500/20"
                                                            : "bg-white/[0.04] text-gray-400 border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:text-gray-200"
                                                    }
    `}
                                                >
                          <span className="text-[15px] opacity-90 group-hover:scale-110 transition-transform duration-200">
                            {langIcons[lang]}
                          </span>

                                                    <span className="tracking-wide">
                            {lang.toUpperCase()}
                          </span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="bg-[#0F172A] border border-white/10 rounded-2xl overflow-hidden">
                      <pre
                          className={`language-${activeLang} p-6 text-sm overflow-x-auto`}
                      >
                        <code className={`language-${activeLang}`}>
                          {activeLang === "java" ? javaCode : pythonCode}
                        </code>
                      </pre>
                                        </div>

                                        <div className="text-sm text-gray-400 pt-2">
                                            Time: {content.solution?.time || "—"} · Space:{" "}
                                            {content.solution?.space || "—"}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ================= CODE PLAYGROUND MODE ================= */}
                        {showRunner && (
                            <CodeRunnerPanel
                                content={submissionProblem}
                                userId={userId}
                                setShowRunner={setShowRunner}
                                prevShowSolutionRef={prevShowSolutionRef}
                                setShowSolution={setShowSolution}
                            />
                        )}

                        {/* ================= AI TUTOR ================= */}
                        {showAI && (
                            <AITutorModal
                                problem={content}
                                problemId={problem.id}
                                onClose={() => setShowAI(false)}
                            />
                        )}

                        {/* ================= VISUALIZATION ================= */}
                        <Suspense
                            fallback={
                                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-xl">
                                    <div className="glass-panel glass-glow rounded-3xl px-10 py-8 flex flex-col items-center gap-6 animate-fadeIn border border-white/10">
                                        <div className="relative w-14 h-14">
                                            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30" />
                                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin" />
                                        </div>

                                        <div className="text-center space-y-2">
                                            <p className="text-indigo-300 font-semibold text-lg">
                                                Analyzing your practice patterns with AI...
                                            </p>

                                            <p className="text-gray-400 text-sm">
                                                Preparing your progress insights...
                                            </p>
                                        </div>

                                        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full w-1/2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-gradient-flow" />
                                        </div>
                                    </div>
                                </div>
                            }
                        >
                            {showVisualization && (
                                <VisualizationModal
                                    onClose={() => setShowVisualization(false)}
                                    problemId={problem.id}
                                    problemTitle={problem.title}
                                    problemMeta={{
                                        pattern: problem.pattern,
                                        difficulty: problem.difficulty,
                                    }}
                                    content={content}
                                    activeLang={activeLang}
                                />
                            )}
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
