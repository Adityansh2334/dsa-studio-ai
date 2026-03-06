import {useState, useEffect, useRef} from "react";
import GlassDropdown from "../../components/GlassDropdown.tsx";
import PatternMultiSelect from "@/components/PatternMultiSelect.tsx";
import {createPortal} from "react-dom";

type Props = {
    onSave: () => void;
    onCancel: () => void;
};

export default function InterviewSetupModal({ onSave, onCancel }: Props) {
    const [saving, setSaving] = useState(false);

    const [interviewCount, setInterviewCount] = useState(10);
    const [interviewStyle, setInterviewStyle] = useState("mixed");
    const [companyPreset, setCompanyPreset] = useState("none");
    const [customCompany, setCustomCompany] = useState("");
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("0-2");
    const [difficulty, setDifficulty] = useState("mixed");
    const [interviewPatterns, setInterviewPatterns] = useState<string[]>([]);

    const [contexts, setContexts] = useState<string[]>([]);
    const [selectedContext, setSelectedContext] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const difficultyRef = useRef<HTMLDivElement>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);


    useEffect(() => {
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);


    useEffect(() => {
        async function load() {
            const p = await window.api.getUserPreferences();
            if (p) {
                setInterviewCount(p.interview_problem_count ?? 10);
                setInterviewStyle(p.interview_style || "mixed");
                setCompanyPreset(p.interview_company || "");
                setRole(p.interview_role || "");
                setExperience(p.interview_experience || "0-2");
                setDifficulty(p.interview_difficulty || "mixed");
                setInterviewPatterns(
                    p.interview_patterns ? JSON.parse(p.interview_patterns) : []
                );
            }

            const ctx = await window.api.getInterviewContexts();
            setContexts(ctx.map((x: any) => x.interview_context));
        }
        load();
    }, []);

    function resetForm() {
        setInterviewCount(10);
        setInterviewStyle("mixed");
        setCompanyPreset("none");
        setCustomCompany("");
        setRole("");
        setExperience("0-2");
        setDifficulty("mixed");
        setInterviewPatterns([]);
        setSelectedContext(null);
    }

    function applyOldContext(ctx: string) {
        const [s, c, r, e, d] = ctx.split("|");
        setInterviewStyle(s);
        setCompanyPreset(c);
        setRole(r);
        setExperience(e);
        setDifficulty(d);
        setSelectedContext(ctx);
    }

    async function deleteContextConfirmed() {
        if (!deleteTarget) return;

        await window.api.deleteInterviewContext(deleteTarget);

        setContexts(prev => prev.filter(x => x !== deleteTarget));

        if (selectedContext === deleteTarget) {
            setSelectedContext(null);
        }

        setDeleteTarget(null);
    }


    async function save() {
        setSaving(true);

        const finalCompany =
            companyPreset === "custom"
                ? customCompany.trim()
                : companyPreset === "none"
                    ? null
                    : companyPreset;

        await window.api.updateInterviewPreferences({
            interview_problem_count: interviewCount,
            interview_style: interviewStyle,
            interview_company: finalCompany,
            interview_role: role,
            interview_experience: experience,
            interview_difficulty: difficulty,
            interview_patterns: JSON.stringify(interviewPatterns),
        });

        setSaving(false);
        onSave();
    }

    return createPortal(
        <div className="modal-root app-bg">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            {/* Centering wrapper */}
            <div className="relative z-10 flex items-center justify-center min-h-screen p-6 overflow-hidden">
                {/* Modal */}
                <div
                    className="
    relative z-10
    w-full max-w-2xl max-h-[90vh]
    bg-white/10 backdrop-blur-2xl
    border border-white/20 rounded-2xl
    shadow-2xl animate-scaleIn
    flex flex-col overflow-hidden

    gpu-layer
  "
                >

                    {/* Header */}
                    <div className="px-8 pt-8 flex items-center justify-between">

                        <div>
                            <h2 className="text-2xl font-semibold mb-2 text-emerald-400">
                                Interview Preparation Setup
                            </h2>
                        </div>

                        {/* Reset Button */}
                        <button
                            type="button"
                            onClick={resetForm}
                            className="
            px-4 py-2 rounded-xl
            bg-white/5 hover:bg-white/10
            border border-white/10
            text-sm text-gray-300
            transition-all duration-300
            hover:border-amber-400/40
            hover:text-white
            shadow-md hover:shadow-amber-500/10
        "
                        >
                            Reset
                        </button>

                    </div>

                    {/* ✅ Scrollable Body */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            save();
                        }}
                        className="flex flex-col flex-1 overflow-hidden"
                    >
                        <div
                            ref={scrollRef}
                            className="overflow-y-auto px-8 py-6 space-y-5 gpu-layer"
                        >

                            {/* ✅ Previous Contexts */}
                            {contexts.length > 0 && (
                                <div className="mb-8">

                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm tracking-wide text-gray-400">
                                            Previous Interview Contexts
                                        </p>

                                        <div className="text-xs text-gray-500">
                                            Tap to reuse
                                        </div>
                                    </div>

                                    {/* Scroll Container */}
                                    <div
                                        className="
                                            -mx-2 px-2
                                            flex gap-5 overflow-x-auto pb-3
                                            scrollbar-thin scrollbar-thumb-white/10
                                            hover:scrollbar-thumb-white/20
                                        "
                                                                >

                                        {contexts.map(ctx => {

                                            const [s, c, r, e, d] = ctx.split("|");

                                            return (
                                                <div
                                                    key={ctx}
                                                    className="
                            relative min-w-[260px]
                            group
                            flex-shrink-0
                        "
                                                >

                                                    {/* Glass Card */}
                                                    <button
                                                        onClick={() => applyOldContext(ctx)}
                                                        className="
                                w-full text-left
                                rounded-2xl p-4
                                bg-white/5 backdrop-blur-xl
                                border border-white/10
                                transition-all duration-300
                                hover:bg-white/10
                                hover:border-indigo-400/40
                                shadow-lg shadow-black/30
                                hover:shadow-indigo-500/25
                            "
                                                    >

                                                        {/* Top Row */}
                                                        <div className="flex justify-between items-start mb-2">

                                                            <div className="text-xs text-indigo-400 font-medium uppercase tracking-wider">
                                                                {s}
                                                            </div>

                                                            <div className="
                                    text-[10px] px-2 py-0.5 rounded-md
                                    bg-indigo-500/20 text-indigo-300
                                ">
                                                                {d}
                                                            </div>

                                                        </div>

                                                        {/* Company */}
                                                        <div className="text-sm font-semibold text-white mb-1">
                                                            {c}
                                                        </div>

                                                        {/* Role */}
                                                        <div className="text-xs text-gray-400 mb-2">
                                                            {r}
                                                        </div>

                                                        {/* Experience */}
                                                        <div className="
                                inline-flex items-center gap-1
                                text-[11px] text-emerald-400
                                bg-emerald-500/10
                                px-2 py-0.5 rounded-md
                            ">
                                                            {e} yrs exp
                                                        </div>

                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget(ctx)}
                                                        className="
                                absolute top-20 right-6
                                w-6 h-6 rounded-full
                                bg-red-500/90
                                text-white text-xs
                                flex items-center justify-center
                                opacity-0 group-hover:opacity-100
                                transition
                                shadow-lg
                                hover:scale-110
                            "
                                                    >
                                                        ✕
                                                    </button>

                                                </div>
                                            );
                                        })}

                                    </div>
                                </div>
                            )}

                            {/* Interview Style */}
                            <div>
                                <p className="text-sm text-indigo-400 mb-2 font-medium">
                                    Interview Style
                                </p>
                                <GlassDropdown
                                    value={interviewStyle}
                                    onChange={setInterviewStyle}
                                    options={[
                                        { label: "FAANG Style", value: "faang" },
                                        { label: "Product Company", value: "product" },
                                        { label: "Startup Style", value: "startup" },
                                        { label: "Service Company", value: "service" },
                                        { label: "System Design Focused", value: "system-design" },
                                        { label: "Mixed", value: "mixed" },
                                    ]}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Determines interview behavior and difficulty style
                                </p>
                            </div>

                            {/* Optional Company */}
                            <div>
                                <p className="text-sm text-indigo-400 mb-2 font-medium">
                                    Target Company (Optional)
                                </p>

                                <GlassDropdown
                                    value={companyPreset}
                                    onChange={setCompanyPreset}
                                    options={[
                                        { label: "None (Use Style Only)", value: "none" },
                                        { label: "FICO", value: "FICO" },
                                        { label: "Amazon", value: "Amazon" },
                                        { label: "Google", value: "Google" },
                                        { label: "Microsoft", value: "Microsoft" },
                                        { label: "Meta", value: "Meta" },
                                        { label: "Flipkart", value: "Flipkart" },
                                        { label: "Other (Custom)", value: "custom" },
                                    ]}
                                />

                                {companyPreset === "custom" && (
                                    <input
                                        placeholder="Enter company name"
                                        value={customCompany}
                                        onChange={e => setCustomCompany(e.target.value)}
                                        className="input-ui mt-3"
                                    />
                                )}

                                <p className="text-xs text-gray-500 mt-1">
                                    Used to mimic company-specific interview patterns
                                </p>
                            </div>

                            {/* Role */}
                            <div>
                                <input
                                    placeholder="Target Role (e.g. Backend Engineer, SDE-2, Fullstack)"
                                    value={role}
                                    required
                                    onChange={e => setRole(e.target.value)}
                                    className="input-ui"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Questions will be tailored for this role
                                </p>
                            </div>

                            {/* Count + Experience */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <GlassDropdown
                                        value={interviewCount}
                                        onChange={(v) => setInterviewCount(Number(v))}
                                        options={[
                                            { label: "5 problems per day", value: 5 },
                                            { label: "8 problems per day", value: 8 },
                                            { label: "10 problems per day", value: 10 },
                                            { label: "15 problems per day", value: 15 },
                                        ]}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Number of interview-style problems daily
                                    </p>
                                </div>

                                <div>
                                    <GlassDropdown
                                        value={experience}
                                        onChange={setExperience}
                                        options={[
                                            { label: "0–2 years experience", value: "0-2" },
                                            { label: "2–5 years experience", value: "2-5" },
                                            { label: "5+ years experience", value: "5+" },
                                        ]}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Difficulty adapts to your experience level
                                    </p>
                                </div>
                            </div>

                            {/* Patterns */}
                            <div>
                                <p className="text-sm text-indigo-400 mb-2 font-medium">
                                    Preferred Patterns (optional)
                                </p>

                                <PatternMultiSelect
                                    value={interviewPatterns}
                                    onChange={setInterviewPatterns}
                                />

                                <p className="text-xs text-gray-500 mt-2">
                                    AI will prioritize these patterns for your interview preparation
                                </p>
                            </div>

                            {/* Difficulty */}
                            <div ref={difficultyRef}>
                                <GlassDropdown
                                    value={difficulty}
                                    placeholder="Preferred Difficulty (optional)"
                                    onChange={setDifficulty}
                                    onOpen={() => {
                                        setTimeout(() => {
                                            difficultyRef.current?.scrollIntoView({
                                                behavior: "smooth",
                                                block: "center"
                                            });
                                        }, 100);
                                    }}
                                    options={[
                                        { label: "Easy", value: "easy" },
                                        { label: "Medium", value: "medium" },
                                        { label: "Hard", value: "hard" },
                                        { label: "Mixed", value: "mixed" },
                                    ]}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Override system difficulty if you want a specific level
                                </p>
                            </div>

                        </div>

                        {/* ✅ Sticky Footer Buttons */}
                        <div className="flex gap-4 p-6 border-t border-white/10 bg-black/20 backdrop-blur-xl">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                            >
                                {saving ? "Saving..." : "Start Interview Mode"}
                            </button>

                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                    {deleteTarget && (
                        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

                            <div className="
            relative z-10
            w-full max-w-md
            bg-white/10 backdrop-blur-2xl
            border border-white/20
            rounded-2xl
            p-8
            shadow-2xl
            animate-scaleIn
        ">
                                <h3 className="text-xl font-semibold text-red-400 mb-4">
                                    Delete Interview Context?
                                </h3>

                                {(() => {
                                    const [s, c, r, e] = deleteTarget.split("|");
                                    return (
                                        <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-6 text-sm">
                                            <div className="text-white">Style : {s}</div>
                                            <div className="font-medium text-white">Company : {c}</div>
                                            <div className="text-gray-400">Role : {r}</div>
                                            <div className="text-indigo-400">{e} yrs experience</div>
                                        </div>
                                    );
                                })()}

                                <p className="text-gray-400 text-sm mb-6">
                                    This will permanently remove this interview history and related problems.
                                </p>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setDeleteTarget(null)}
                                        className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={deleteContextConfirmed}
                                        className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.getElementById("modal-root")!
    );
}
