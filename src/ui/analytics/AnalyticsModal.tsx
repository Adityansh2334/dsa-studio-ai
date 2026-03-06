import { useEffect, useRef, useState } from "react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    AreaChart,
    Area,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    Radar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";
import { createPortal } from "react-dom";

function sanitizeAI(text: string) {
    if (!text) return "";

    return text
        .replace(/=+/g, "")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .replace(/^#+\s*/gm, "")
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function computeScore(stats: any) {
    let score = 0;

    score += Math.min(stats.totalSolved * 0.5, 40);
    score += Math.min(stats.streak * 2, 20);
    score += Math.min(stats.interviewCount * 2, 20);

    const hard = stats.difficulty.hard || 0;
    score += Math.min(hard * 2, 20);

    return Math.min(100, Math.round(score));
}

function getLevel(score: number) {
    if (score >= 85) return "Elite Candidate";
    if (score >= 70) return "Interview Ready";
    if (score >= 55) return "Advanced Solver";
    if (score >= 40) return "Consistent Learner";
    if (score >= 25) return "Growing Beginner";
    return "Starter";
}

function getBadges(stats: any) {
    const badges = [];

    if (stats.totalSolved >= 10) badges.push("First 10 Solved");
    if (stats.totalSolved >= 50) badges.push("Half Century");
    if (stats.streak >= 5) badges.push("5 Day Streak");
    if (stats.interviewCount >= 5) badges.push("Interview Explorer");

    return badges;
}

function Heatmap({ data }: any) {
    const days = Array.from({ length: 30 });

    function getColor(count: number) {
        if (count === 0) return "bg-white/5 border-white/10";
        if (count < 2) return "bg-indigo-500/30 border-indigo-400/30";
        if (count < 4) return "bg-indigo-500/60 border-indigo-400/40";
        return "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-indigo-300/50";
    }

    return (
        <div className="space-y-4">
            {/* Grid */}
            <div className="grid grid-cols-10 gap-2">
                {days.map((_, i) => {
                    const count = data?.[i]?.count || 0;
                    const date = data?.[i]?.date || "";

                    return (
                        <div
                            key={i}
                            title={`${date || "Day"} • ${count} solved`}
                            className={`
                                relative group
                                w-7 h-7 rounded-lg
                                border
                                ${getColor(count)}

                                transition-all duration-300
                                hover:scale-110
                                hover:-translate-y-1
                                hover:shadow-lg
                                hover:shadow-indigo-500/30
                                cursor-pointer
                            `}
                        >
                            {/* Glow pulse for active days */}
                            {count > 0 && (
                                <div
                                    className="
                                    absolute inset-0 rounded-lg
                                    bg-indigo-500/20 blur-md
                                    opacity-0 group-hover:opacity-100
                                    transition
                                "
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Less</span>

                <div className="flex gap-1">
                    <div className="w-4 h-4 rounded bg-white/5 border border-white/10" />
                    <div className="w-4 h-4 rounded bg-indigo-500/30 border border-indigo-400/30" />
                    <div className="w-4 h-4 rounded bg-indigo-500/60 border border-indigo-400/40" />
                    <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border border-indigo-300/50" />
                </div>

                <span>More</span>
            </div>
        </div>
    );
}

function StatCard({ title, value, gradient }: any) {
    return (
        <div
            className={`rounded-2xl p-6 text-center
            bg-gradient-to-br ${gradient}
            shadow-lg border border-white/10`}
        >
            <div className="text-3xl font-bold text-white">{value}</div>

            <div className="text-sm text-white/70 mt-1">{title}</div>
        </div>
    );
}

function parseAI(text: string) {
    if (!text) return null;

    const sections: any = {
        strengths: [],
        weak: [],
        focus: [],
        motivation: [],
        score: [],
    };

    const lines = text
        .replace(/=+/g, "") // remove separators
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    let current: keyof typeof sections | null = null;

    for (let raw of lines) {
        let line = raw
            .replace(/^[-•]\s*/, "") // remove bullets
            .trim();

        if (!line) continue;

        const l = line.toLowerCase();

        // ---------------- SECTION DETECTION ----------------

        if (l.startsWith("strength")) {
            current = "strengths";
            continue;
        }

        if (l.startsWith("weak")) {
            current = "weak";
            continue;
        }

        if (l.startsWith("recommended")) {
            current = "focus";
            continue;
        }

        if (l.startsWith("motivation")) {
            current = "motivation";
            continue;
        }

        if (l.startsWith("interview readiness score") || l.startsWith("score")) {
            current = "score";
            continue;
        }

        if (!current) continue;

        // ---------------- SCORE SPECIAL HANDLING ----------------

        if (current === "score") {
            // number line
            if (/^\d+$/.test(line)) {
                sections.score.push(`Score: ${line}`);
                continue;
            }

            // reasoning
            sections.score.push(line);
            continue;
        }

        // ---------------- MOTIVATION SPLIT SENTENCES ----------------

        if (current === "motivation") {
            const sentences = line
                .split(/(?<=[.!?])\s+/)
                .map((s) => s.trim())
                .filter(Boolean);

            sections[current].push(...sentences);
            continue;
        }

        // ---------------- NORMAL PUSH ----------------

        sections[current].push(line);
    }

    return sections;
}

function AIInsights({ data, loading }: any) {
    if (loading || !data) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InsightCard
                    title="💪 Strengths"
                    color="from-emerald-500/20 to-teal-500/10"
                    loading
                />
                <InsightCard
                    title="⚠️ Weak Areas"
                    color="from-red-500/20 to-orange-500/10"
                    loading
                />
                <InsightCard
                    title="🎯 Recommended Focus"
                    color="from-indigo-500/20 to-purple-500/10"
                    loading
                />
                <InsightCard
                    title="🔥 Motivation"
                    color="from-pink-500/20 to-indigo-500/10"
                    loading
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InsightCard
                title="💪 Strengths"
                color="from-emerald-500/20 to-teal-500/10"
                content={data.strengths}
            />

            <InsightCard
                title="⚠️ Weak Areas"
                color="from-red-500/20 to-orange-500/10"
                content={data.weak}
            />

            <InsightCard
                title="🎯 Recommended Focus"
                color="from-indigo-500/20 to-purple-500/10"
                content={data.focus}
            />

            <InsightCard
                title="🔥 Motivation"
                color="from-pink-500/20 to-indigo-500/10"
                content={data.motivation}
            />
            {data?.score?.length > 0 && (
                <InsightCard
                    title="📊 Interview Readiness"
                    color="from-yellow-500/20 to-orange-500/10"
                    content={data.score}
                />
            )}
        </div>
    );
}

function InsightCard({ title, content, color, loading }: any) {
    const hasContent = Array.isArray(content) && content.length > 0;

    return (
        <div
            className={`
                rounded-2xl p-5 border border-white/10
                bg-gradient-to-br ${color}

                shadow-lg shadow-black/30
                transform transition-all duration-300

                hover:-translate-y-1
                hover:shadow-xl hover:shadow-indigo-500/20
            `}
        >
            <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>

            {/* ---------------- LOADING STATE ---------------- */}
            {loading ? (
                <div className="space-y-2 animate-pulse">
                    <div className="h-3 w-3/4 bg-white/10 rounded"></div>
                    <div className="h-3 w-2/3 bg-white/10 rounded"></div>
                    <div className="h-3 w-1/2 bg-white/10 rounded"></div>
                </div>
            ) : hasContent ? (
                <ul className="space-y-2 text-sm text-gray-300">
                    {content.map((line: string, i: number) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-indigo-400">•</span>
                            <span>{line}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="flex items-center gap-3 text-gray-400 text-sm opacity-80">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>

                    <span>Insights will appear as you practice more problems.</span>
                </div>
            )}
        </div>
    );
}

function InsightHistory({ history }: any) {

    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">

                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                    <span className="text-2xl">📈</span>
                </div>

                <p className="text-gray-400 text-sm">
                    No insights yet. Keep practicing to unlock your progress story.
                </p>
            </div>
        );
    }

    return (
        <div
            className="
                relative
                h-[420px]
                overflow-y-auto
                pr-3
                space-y-6
                scrollbar-thin
                scrollbar-thumb-indigo-500/30
                scrollbar-track-transparent
            "
        >
            {/* Timeline vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />

            {history.map((item: any, i: number) => {

                const parsed = parseAI(sanitizeAI(item.insight)) || {};

                const preview =
                    parsed?.motivation?.[0] ||
                    parsed?.focus?.[0] ||
                    parsed?.strengths?.[0] ||
                    "No insight available";

                return (
                    <div
                        key={i}
                        className="relative pl-12 group animate-fadeIn"
                    >
                        {/* Timeline node */}
                        <div
                            className="
                                absolute left-[6px] top-5
                                w-4 h-4 rounded-full
                                bg-gradient-to-br from-indigo-500 to-purple-500
                                shadow-[0_0_12px_rgba(99,102,241,0.8)]
                            "
                        />

                        {/* Card */}
                        <div
                            className="
                                rounded-2xl p-5
                                border border-white/10
                                bg-white/5 backdrop-blur-xl
                                transition-all duration-300
                                group-hover:bg-white/10
                                group-hover:scale-[1.01]
                                shadow-lg
                            "
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">

                                <div className="space-y-1">
                                    <div className="text-indigo-400 text-sm font-semibold">
                                        {item.date}
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        <span className="px-2 py-1 rounded-lg text-xs bg-indigo-500/20 text-indigo-300">
                                            Score {item.score}
                                        </span>

                                        <span className="px-2 py-1 rounded-lg text-xs bg-emerald-500/20 text-emerald-300">
                                            {item.level}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500">
                                    #{history.length - i}
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="text-sm text-gray-300 leading-relaxed">
                                {preview}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function PredictionBar({ data, loading }: any) {
    const percent = data?.progress_percent || 0;
    const message = data?.message || "";

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex justify-between mb-2">
                <div className="text-indigo-400 text-sm font-semibold">
                    🔮 AI Progress Prediction
                </div>

                {!loading && (
                    <div className="text-sm text-white font-semibold">+{percent}%</div>
                )}
            </div>

            {/* ================= LOADING ================= */}
            {loading ? (
                <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="
                        absolute inset-0
                        bg-gradient-to-r
                        from-indigo-500 via-purple-500 to-pink-500
                        opacity-40
                        animate-gradient-flow
                    "
                    />

                    <div
                        className="
                        absolute top-0 left-0 h-full w-40
                        bg-white/60 blur-md opacity-60
                        animate-shine-sweep
                    "
                    />
                </div>
            ) : (
                <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="
                            h-full bg-gradient-to-r
                            from-indigo-500 via-purple-500 to-pink-500
                            transition-all duration-700 ease-out
                        "
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}

            {!loading && message && (
                <div className="text-xs text-gray-400 mt-2">{message}</div>
            )}
        </div>
    );
}

function LegendItem({ color, label }: any) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />

            <span className="text-gray-300">{label}</span>
        </div>
    );
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];

    return (
        <div
            className="
                bg-[#0F172A]/90 backdrop-blur-xl
                border border-indigo-500/30
                rounded-xl px-4 py-2
                shadow-2xl
            "
        >
            <div className="text-indigo-300 text-xs font-semibold mb-1">
                {data.name || label}
            </div>

            <div className="flex items-center gap-2 text-sm text-white">
                <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: data.color }}
                />

                <span className="font-medium">{data.value}</span>
            </div>
        </div>
    );
}

type Props = {
    onClose: () => void;
};

export default function AnalyticsModal({ onClose }: Props) {
    const [stats, setStats] = useState<any>(null);
    const [aiLoading, setAILoading] = useState(true);
    const [parsedAI, setParsedAI] = useState<any>(null);
    const loadedRef = useRef(false);
    const [tab, setTab] = useState<"today" | "history">("today");
    const [history, setHistory] = useState<any[]>([]);

    const [prediction, setPrediction] = useState<any>(null);
    const [predictionLoading, setPredictionLoading] = useState(true);

    useEffect(() => {
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);


    useEffect(() => {
        async function load() {
            if (loadedRef.current) return;
            loadedRef.current = true;

            // start loading indicator immediately
            setPredictionLoading(true);

            // DO NOT await here
            window.api
                .getUserProgression()
                .then((pred) => {
                    setPrediction(pred);
                })
                .catch(() => {
                    setPrediction(null);
                })
                .finally(() => {
                    setPredictionLoading(false);
                });

            const h = await window.api.getInsightHistory();
            setHistory(h || []);

            const s = await window.api.getUserAnalytics();
            setStats(s);

            setAILoading(true);

            const aiText = await window.api.getAnalyticsAI(s);

            const clean = sanitizeAI(aiText);
            const parsed = parseAI(clean);

            setTimeout(() => {
                setParsedAI(parsed);
                setAILoading(false);
            }, 150);
        }

        load();
    }, []);

    if (!stats) return null;

    const score = computeScore(stats);
    const level = getLevel(score);
    const badges = getBadges(stats);

    const difficultyData = [
        { name: "Easy", value: stats.difficulty.easy },
        { name: "Medium", value: stats.difficulty.medium },
        { name: "Hard", value: stats.difficulty.hard },
    ];

    const patternData = Object.entries(stats.patterns).map(([k, v]) => ({
        name: k,
        value: v,
    }));

    return createPortal(
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden">
            <div
                className="w-full max-w-7xl h-[90vh]
                bg-[#0B1220] rounded-3xl border border-white/10
                shadow-2xl flex flex-col overflow-hidden gpu-layer"
            >
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-5 border-b border-white/10">
                    <h2 className="text-xl text-indigo-400 font-semibold">
                        📊 Your Practice Analytics
                    </h2>
                    <button onClick={onClose}>✕</button>
                </div>

                <div
                    id="analytics-scroll-root"
                    className="flex-1 overflow-y-auto p-8 space-y-10"
                >
                    <PredictionBar data={prediction} loading={predictionLoading} />

                    {/* HERO */}
                    <div className="grid grid-cols-4 gap-6">
                        <StatCard
                            title="Solved"
                            value={stats.totalSolved}
                            gradient="from-indigo-600/40 to-purple-600/30"
                        />

                        <StatCard
                            title="Streak 🔥"
                            value={stats.streak}
                            gradient="from-orange-500/40 to-red-500/30"
                        />

                        <StatCard
                            title="Interview"
                            value={stats.interviewCount}
                            gradient="from-emerald-500/40 to-teal-500/30"
                        />

                        <StatCard
                            title={`Score ${score}`}
                            value={level}
                            gradient="from-pink-500/40 to-indigo-500/30"
                        />
                    </div>

                    {/* HEATMAP */}
                    <div
                        className="
                        bg-white/5 rounded-2xl p-6 border border-white/10
                        relative overflow-hidden
                    "
                    >
                        {/* background glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 pointer-events-none" />

                        <h3 className="text-indigo-400 mb-4 font-semibold tracking-wide">
                            Activity
                        </h3>

                        <Heatmap data={stats.dailyActivity} />
                    </div>

                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 relative overflow-hidden">
                        {" "}
                        {/* Glow Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 pointer-events-none" />
                        <h3 className="text-indigo-400 mb-4 font-semibold tracking-wide">
                            {" "}
                            Practice Trend{" "}
                        </h3>
                        <ResponsiveContainer width="100%" height={260}>
                            {" "}
                            <AreaChart
                                data={stats.dailyActivity}
                                margin={{
                                    top: 10,
                                    right: 20,
                                    left: -10,
                                    bottom: 0,
                                }}
                            >
                                {" "}
                                {/* Gradient */}
                                <defs>
                                    <linearGradient
                                        id="practiceGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.8} />
                                        <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.4} />
                                        <stop
                                            offset="100%"
                                            stopColor="#6366F1"
                                            stopOpacity={0.05}
                                        />
                                    </linearGradient>
                                </defs>
                                {/* Grid */}{" "}
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(255,255,255,0.06)"
                                    vertical={false}
                                />{" "}
                                {/* X Axis */}{" "}
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    tick={{ fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />{" "}
                                {/* Y Axis */}
                                <YAxis
                                    stroke="#9CA3AF"
                                    tick={{ fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={30}
                                />{" "}
                                {/* Tooltip */}{" "}
                                <Tooltip
                                    cursor={{
                                        stroke: "#6366F1",
                                        strokeWidth: 1,
                                        strokeDasharray: "3 3",
                                    }}
                                    contentStyle={{
                                        background: "rgba(11,18,32,0.9)",
                                        border: "1px solid rgba(99,102,241,0.3)",
                                        borderRadius: "12px",
                                        backdropFilter: "blur(12px)",
                                        color: "#fff",
                                        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                                    }}
                                    labelStyle={{ color: "#a5b4fc", fontWeight: 600 }}
                                />{" "}
                                {/* Area */}{" "}
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#6366F1"
                                    strokeWidth={3}
                                    fill="url(#practiceGradient)"
                                    dot={{
                                        r: 3,
                                        fill: "#6366F1",
                                        strokeWidth: 2,
                                        stroke: "#fff",
                                    }}
                                    activeDot={{
                                        r: 6,
                                        fill: "#8B5CF6",
                                        stroke: "#fff",
                                        strokeWidth: 2,
                                    }}
                                    isAnimationActive={true}
                                    animationDuration={900}
                                />{" "}
                            </AreaChart>{" "}
                        </ResponsiveContainer>
                    </div>

                    {/* CHARTS */}
                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <h3 className="text-indigo-400 mb-4">Difficulty</h3>

                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={difficultyData}
                                        dataKey="value"
                                        outerRadius={90}
                                        innerRadius={50}
                                        paddingAngle={4}
                                        isAnimationActive
                                        animationDuration={800}
                                    >
                                        <Cell fill="#22C55E" /> {/* Easy */}
                                        <Cell fill="#6366F1" /> {/* Medium */}
                                        <Cell fill="#EF4444" /> {/* Hard */}
                                    </Pie>

                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* ===== Custom Legend ===== */}
                            <div className="flex justify-center gap-6 mt-4 text-sm">
                                <LegendItem color="bg-green-500" label="Easy" />
                                <LegendItem color="bg-indigo-500" label="Medium" />
                                <LegendItem color="bg-red-500" label="Hard" />
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 relative overflow-hidden">
                            {/* Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 pointer-events-none" />

                            <h3 className="text-indigo-400 mb-4 font-semibold tracking-wide">
                                Pattern Mastery
                            </h3>

                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart
                                    data={patternData}
                                    margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
                                >
                                    {/* Gradient */}
                                    <defs>
                                        <linearGradient
                                            id="barGradient"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop offset="0%" stopColor="#818CF8" />
                                            <stop offset="50%" stopColor="#6366F1" />
                                            <stop offset="100%" stopColor="#8B5CF6" />
                                        </linearGradient>
                                    </defs>

                                    {/* Grid */}
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(255,255,255,0.06)"
                                        vertical={false}
                                    />

                                    {/* X Axis */}
                                    <XAxis
                                        dataKey="name"
                                        stroke="#9CA3AF"
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />

                                    {/* Y Axis */}
                                    <YAxis
                                        stroke="#9CA3AF"
                                        tick={{ fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={30}
                                    />

                                    {/* Tooltip */}
                                    <Tooltip
                                        cursor={{
                                            fill: "rgba(99,102,241,0.08)",
                                        }}
                                        contentStyle={{
                                            background: "rgba(11,18,32,0.9)",
                                            border: "1px solid rgba(99,102,241,0.3)",
                                            borderRadius: "12px",
                                            backdropFilter: "blur(12px)",
                                            color: "#fff",
                                            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                                        }}
                                        labelStyle={{
                                            color: "#a5b4fc",
                                            fontWeight: 600,
                                        }}
                                    />

                                    {/* Bars */}
                                    <Bar
                                        dataKey="value"
                                        fill="url(#barGradient)"
                                        radius={[8, 8, 0, 0]}
                                        barSize={28}
                                        isAnimationActive={true}
                                        animationDuration={900}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 relative overflow-hidden">
                        {/* Glow Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 pointer-events-none" />

                        <h3 className="text-indigo-400 mb-4 font-semibold tracking-wide">
                            Pattern Mastery Radar
                        </h3>

                        <ResponsiveContainer width="100%" height={320}>
                            <RadarChart data={patternData}>
                                {/* GRID */}
                                <PolarGrid stroke="rgba(255,255,255,0.08)" radialLines={true} />

                                {/* COLORED LABELS */}
                                <PolarAngleAxis
                                    dataKey="name"
                                    tick={({ payload, x, y, textAnchor }: any) => {
                                        const colors = [
                                            "#6366F1",
                                            "#22C55E",
                                            "#F59E0B",
                                            "#EF4444",
                                            "#06B6D4",
                                            "#A855F7",
                                            "#EC4899",
                                        ];

                                        const index = patternData.findIndex(
                                            (p: any) => p.name === payload.value,
                                        );

                                        const color = colors[index % colors.length];

                                        return (
                                            <text
                                                x={x}
                                                y={y}
                                                textAnchor={textAnchor}
                                                fill={color}
                                                fontSize={12}
                                                fontWeight={600}
                                            >
                                                {payload.value}
                                            </text>
                                        );
                                    }}
                                />

                                {/* TOOLTIP */}
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(11,18,32,0.9)",
                                        border: "1px solid rgba(99,102,241,0.3)",
                                        borderRadius: "12px",
                                        backdropFilter: "blur(10px)",
                                        color: "#fff",
                                        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                                    }}
                                    labelStyle={{
                                        color: "#a5b4fc",
                                        fontWeight: 600,
                                    }}
                                />

                                {/* RADAR */}
                                <Radar
                                    name="Mastery"
                                    dataKey="value"
                                    stroke="#6366F1"
                                    fill="url(#radarGradient)"
                                    fillOpacity={0.7}
                                    dot={{
                                        r: 4,
                                        fill: "#6366F1",
                                        strokeWidth: 2,
                                        stroke: "#fff",
                                    }}
                                    isAnimationActive={true}
                                    animationDuration={800}
                                />

                                {/* GRADIENT */}
                                <defs>
                                    <linearGradient
                                        id="radarGradient"
                                        x1="0"
                                        y1="0"
                                        x2="1"
                                        y2="1"
                                    >
                                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.9} />
                                        <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.7} />
                                        <stop offset="100%" stopColor="#EC4899" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* BADGES */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <h3 className="text-indigo-400 mb-3">🏆 Achievements</h3>

                        <div className="flex flex-wrap gap-3">
                            {badges.length === 0 && (
                                <div className="text-gray-400 text-sm">
                                    Start solving problems to unlock achievements.
                                </div>
                            )}

                            {badges.map((b: string, i: number) => (
                                <div
                                    key={i}
                                    className="px-4 py-2 rounded-xl bg-indigo-600/30 border border-indigo-500/20"
                                >
                                    {b}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI INSIGHTS */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="text-indigo-400 mb-4">🤖 AI Coach Insights</h3>
                        <div className="flex gap-3 mb-6">
                            <button
                                onClick={() => setTab("today")}
                                className={`px-4 py-2 rounded-lg text-sm transition ${
                                    tab === "today"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                                }`}
                            >
                                Today
                            </button>

                            <button
                                onClick={() => setTab("history")}
                                className={`px-4 py-2 rounded-lg text-sm transition ${
                                    tab === "history"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                                }`}
                            >
                                History
                            </button>
                        </div>
                        {tab === "today" ? (
                            <AIInsights data={parsedAI} loading={aiLoading} />
                        ) : (
                            <InsightHistory history={history} />
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.getElementById("modal-root")!
    );
}
