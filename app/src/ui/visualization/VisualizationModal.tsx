import React, {useEffect, useState} from "react";
import { FaProjectDiagram, FaTimes, FaSync } from "react-icons/fa";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import ComplexityComparison from "@/ui/visualization/ComplexityComparisions.tsx";
import {
    getGenerationState,
    startGeneration,
    resetGeneration
} from "@/states/visualizationGenerationStore";
import { createPortal } from "react-dom";



type VisualizeModalProps = {
    onClose: () => void;
    problemId: string;
    problemTitle: string;
    problemMeta?: {
        pattern?: string;
        difficulty?: string;
    };
    content?: {
        problem?: string;
        solution?: {
            explanation?: string;
            java?: string;
            python?: string;
            time?: string;
            space?: string;
        };
    };
    activeLang?: string;
};

interface VisualizationData {

    pattern?: string;
    pattern_explanation?: string;
    when_to_use?: string;

    pattern_visualization?: {
        type?: string;
        states?: {
            label?: string;
            description?: string;
            data?: any;
        }[];
    };

    complexity?: {
        time?: string;
        space?: string;
    };

    chartData?: { n: number; operations: number }[];

    comparison?: {
        name?: string;
        complexity?: string;
        value?: number;
    }[];

    steps?: string[];

    execution_flow?: {
        step?: number;
        action?: string;
        state?: any;
    }[];

    diagram?: string;
    explanation?: string;
    insights?: string[];
}

type ComplexityCardProps = {
    title: string;
    value?: string;
    color?: string;
};



type StepTooltipProps = {
    active?: boolean;
    payload?: any[];
    label?: number;
    steps: string[];
};

const StepTooltip: React.FC<StepTooltipProps> = ({
                                                     active,
                                                     payload,
                                                     label,
                                                     steps
                                                 }) => {

    if (!active || !payload || label == null) return null;

    const stepIndex = label - 1;
    const description = steps[stepIndex] || "";

    return (
        <div className="
            px-4 py-3 rounded-xl
            bg-[#020617]/95
            border border-indigo-500/30
            backdrop-blur-xl
            shadow-xl
            max-w-[260px]
        ">

            <p className="text-xs text-gray-400 mb-1">
                Execution Step
            </p>

            <p className="text-sm text-indigo-300 font-semibold">
                Step {label}
            </p>

            <div className="h-px bg-white/10 my-2" />

            <p className="text-xs text-gray-400 mb-1">
                Description
            </p>

            <p className="text-sm text-gray-200">
                {description}
            </p>

        </div>
    );
};

type ChartTooltipProps = {
    active?: boolean;
    payload?: any[];
    label?: number;
};

const ChartTooltip: React.FC<ChartTooltipProps> = ({
                                                       active,
                                                       payload,
                                                       label
                                                   }) => {

    if (!active || !payload || !payload.length) return null;

    const operations = payload[0]?.value;

    return (
        <div className="
            px-4 py-3 rounded-xl
            bg-[#020617]/95
            border border-indigo-500/30
            backdrop-blur-xl
            shadow-xl
            min-w-[160px]
        ">

            <div className="space-y-1">

                {/* Input Size */}
                <p className="text-xs text-gray-400">
                    Input Size
                </p>

                <p className="text-sm text-white font-medium">
                    n = {label}
                </p>

                {/* Divider */}
                <div className="h-px bg-white/10 my-1" />

                {/* Operations */}
                <p className="text-xs text-gray-400">
                    Estimated Operations
                </p>

                <p className="text-sm text-indigo-300 font-semibold">
                    {operations?.toLocaleString()}
                </p>

            </div>

        </div>
    );
};

const ComplexityCard: React.FC<ComplexityCardProps> = ({
                                                           title,
                                                           value,
                                                           color = "indigo"
                                                       }) => (
    <div className="glass-card">
        <h3 className="section-title">{title}</h3>
        <p className={`text-lg font-semibold text-${color}-300`}>
            {value || "--"}
        </p>
    </div>
);

type TabProps = {
    data: VisualizationData;
};

type OverViewProps = {
    data: VisualizationData;
    problemMeta?: {
        pattern?: string;
        difficulty?: string;
    };
};

const OverviewTab: React.FC<OverViewProps> = ({
                                             data,
                                                  problemMeta
                                         }) => {
    const patternText =
        // data?.pattern ||
        problemMeta?.pattern ||
        "General Algorithm Pattern";

   return( <div className="space-y-6">

        <div className="glass-card">
            <h3 className="section-title">Algorithm Pattern</h3>
            <p className="text-indigo-300 font-medium text-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                {patternText}
            </p>
        </div>

        <div className="glass-card">
            <h3 className="section-title">Algorithm Explanation</h3>
            <p className="text-gray-300 leading-relaxed">
                {data?.explanation}
            </p>
        </div>


        <div className="grid grid-cols-3 gap-4">
            <ComplexityCard
                title="Time Complexity"
                value={data?.complexity?.time}
                color="indigo"
            />

            <ComplexityCard
                title="Space Complexity"
                value={data?.complexity?.space}
                color="purple"
            />

            <ComplexityCard
                title="Efficiency"
                value="Optimal"
                color="emerald"
            />
        </div>

        {data?.insights && (
            <div className="glass-card">
                <h3 className="section-title">Key Insights</h3>

                <ul className="space-y-2">
                    {data.insights.map((i, idx) => (
                        <li key={idx} className="text-gray-300">
                            • {i}
                        </li>
                    ))}
                </ul>
            </div>
        )}

    </div>)};

type PatternVizProps = {
    data?: VisualizationData["pattern_visualization"];
};

const PatternVisualization: React.FC<PatternVizProps> = ({ data }) => {

    const [index, setIndex] = useState(0);

    const states = data?.states || [];

    useEffect(() => {

        if (!states.length) return;

        const timer = setInterval(() => {
            setIndex(i =>
                i < states.length - 1 ? i + 1 : 0
            );
        }, 1800);

        return () => clearInterval(timer);

    }, [states]);

    if (!states.length) {
        return (
            <div className="text-gray-400 text-sm">
                Pattern visualization not available.
            </div>
        );
    }

    const current = states[index];

    return (
        <div className="space-y-4">

            {/* Animated Flow Timeline */}

            <div className="
        grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
        gap-4
    ">
                {states.map((s, i) => (

                    <div
                        key={i}
                        className={`
                            min-w-[140px] p-3 rounded-xl border
                            transition-all duration-500
                            ${i === index
                            ? "bg-indigo-500/20 border-indigo-500/40 scale-105"
                            : "bg-white/5 border-white/10"}
                        `}
                    >
                        <p className="text-xs text-gray-400">
                            Step {i + 1}
                        </p>

                        <p className="text-sm text-indigo-300 font-medium">
                            {s.label}
                        </p>
                    </div>

                ))}

            </div>

            {/* Description */}

            <div className="
                p-4 rounded-xl
                bg-indigo-500/10
                border border-indigo-500/30
                text-gray-200
            ">
                <p className="text-indigo-400 font-semibold mb-1">
                    {current?.label}
                </p>

                <p className="text-sm text-gray-300">
                    {current?.description}
                </p>
            </div>

        </div>
    );
};

const PatternTab: React.FC<TabProps> = ({ data }) => (

    <div className="space-y-6">

        <div className="glass-card">

            <h3 className="section-title">
                Pattern Visualization
            </h3>

            <PatternVisualization
                data={data?.pattern_visualization}
            />

        </div>

        <div className="glass-card">

            <h3 className="section-title">
                How This Pattern Works
            </h3>

            <p className="text-gray-300 whitespace-pre-line leading-relaxed">
                {data?.pattern_explanation}
            </p>

        </div>

        <div className="glass-card">

            <h3 className="section-title">
                When To Use This Pattern
            </h3>

            <p className="text-gray-300">
                {data?.when_to_use}
            </p>

        </div>

    </div>
);

const ChartsTab: React.FC<TabProps> = ({ data }) => {

    if (!data?.chartData) return null;

    return (
        <div className="space-y-6">

            <div className="glass-card">
                <h3 className="section-title mb-4">
                    Performance Growth (Input Size vs Operations)
                    <span className="
                        text-xs px-2 py-0.5 rounded
                        bg-indigo-500/20 text-indigo-300
                    ">
                        {data?.complexity?.time}
                    </span>
                </h3>

                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.chartData}>

                            <defs>
                                <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                            <XAxis
                                dataKey="n"
                                stroke="#64748b"
                                label={{
                                    value: "Input Size (n)",
                                    position: "insideBottom",
                                    offset: -5,
                                    fill: "#94a3b8"
                                }}
                            />

                            <YAxis
                                stroke="#64748b"
                                label={{
                                    value: "Operations",
                                    angle: -90,
                                    position: "insideLeft",
                                    fill: "#94a3b8"
                                }}
                            />

                            <Tooltip content={<ChartTooltip />} />

                            <Line
                                type="monotone"
                                dataKey="operations"
                                stroke="#6366f1"
                                strokeWidth={3}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />

                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {data?.comparison && (
                <div className="glass-card">

                    <h3 className="section-title mb-6">
                        Complexity Comparison
                    </h3>

                    <ComplexityComparison
                        data={(data.comparison || []).map(item => ({
                            name: item?.name || "Unknown",
                            complexity: item?.complexity || "",
                            value: Number(item?.value) || 0
                        }))}
                    />

                </div>
            )}
        </div>
    );
};

const ExecutionTab: React.FC<TabProps> = ({ data }) => {

    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!data?.steps?.length) return;

        const timer = setInterval(() => {
            setIndex(i =>
                i < data.steps!.length - 1 ? i + 1 : i
            );
        }, 1500);

        return () => clearInterval(timer);
    }, [data]);

    if (!data?.steps?.length) {
        return (
            <div className="glass-card text-gray-400">
                Step-by-step visualization unavailable.
            </div>
        );
    }

    return (
        <div className="relative space-y-4">

            {(data.steps ?? []).map((step: string, i: number) => (
                <div key={i} className="flex gap-4">

                    <div className="flex flex-col items-center">
                        <div className={`
                    w-4 h-4 rounded-full
                    ${i <= index ? "bg-indigo-400" : "bg-white/20"}
                `} />

                        {data.steps && i < data.steps.length - 1 && (
                            <div className="w-[2px] h-12 bg-white/10" />
                        )}
                    </div>

                    <div
                        className={`
                    flex-1 p-4 rounded-xl border
                    transition-all duration-500
                    ${i <= index
                            ? "bg-indigo-500/10 border-indigo-500/30"
                            : "bg-white/5 border-white/10"}
                `}
                    >
                        <p className="text-gray-300">{step}</p>
                    </div>

                </div>
            ))}

        </div>
    );
};

type ExecutionFlowProps = {
    flow?: VisualizationData["execution_flow"];
};

const ExecutionFlowDiagram: React.FC<ExecutionFlowProps> = ({ flow }) => {

    const steps = flow || [];

    const [index, setIndex] = useState(0);

    useEffect(() => {

        if (!steps.length) return;

        const timer = setInterval(() => {
            setIndex(i =>
                i < steps.length - 1 ? i + 1 : i
            );
        }, 1500);

        return () => clearInterval(timer);

    }, [steps]);

    if (!steps.length) {
        return (
            <div className="text-gray-400">
                Execution flow not available.
            </div>
        );
    }

    /* =========================
       CHART DATA
    ========================== */

    const chartData = steps.map((_, i) => ({
        step: i + 1,
        value: i <= index ? i + 1 : 0
    }));

    /* =========================
       TOOLTIP STEPS ARRAY
    ========================== */

    const tooltipSteps = steps.map(s => s.action || "");

    return (
        <div className="space-y-6">

            {/* ================= CHART ================= */}

            <div className="h-64">

                <ResponsiveContainer>
                    <LineChart data={chartData}>

                        <CartesianGrid stroke="#1e293b" />

                        <XAxis
                            dataKey="step"
                            stroke="#64748b"
                            label={{
                                value: "Execution Step",
                                position: "insideBottom",
                                offset: -5,
                                fill: "#94a3b8"
                            }}
                        />

                        <YAxis
                            stroke="#64748b"
                            label={{
                                value: "Progress",
                                angle: -90,
                                position: "insideLeft",
                                fill: "#94a3b8"
                            }}
                        />

                        <Tooltip
                            cursor={false}
                            content={
                                <StepTooltip
                                    steps={tooltipSteps}
                                />
                            }
                        />

                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            activeDot={{
                                r: 7,
                                stroke: "#8b5cf6",
                                strokeWidth: 2,
                                fill: "#0f172a"
                            }}
                        />

                    </LineChart>
                </ResponsiveContainer>

            </div>

            {/* ================= STEP CARDS ================= */}

            <div className="space-y-3">

                {steps.map((s, i) => (

                    <div
                        key={i}
                        className={`
                            p-4 rounded-xl border
                            transition-all duration-500
                            ${i <= index
                            ? "bg-indigo-500/10 border-indigo-500/30"
                            : "bg-white/5 border-white/10"}
                        `}
                    >
                        <p className="text-indigo-400 text-sm font-semibold">
                            Step {s.step ?? i + 1}
                        </p>

                        <p className="text-gray-300 text-sm">
                            {s.action}
                        </p>

                    </div>

                ))}

            </div>

        </div>
    );
};

const DiagramTab: React.FC<TabProps> = ({ data }) => {

    return (
        <div className="space-y-6">

            <div className="glass-card">

                <h3 className="section-title mb-4">
                    Execution Visualization
                </h3>

                <ExecutionFlowDiagram
                    flow={data.execution_flow}
                />

            </div>

            {data.diagram && (

                <div className="glass-card">

                    <h3 className="section-title mb-3">
                        Structure Diagram
                    </h3>

                    <pre className="
                        text-emerald-300
                        font-mono
                        text-sm
                        whitespace-pre-wrap
                    ">
                        {data.diagram}
                    </pre>

                </div>

            )}

        </div>
    );
};


export default function VisualizationModal({
                                               onClose,
                                               problemId,
                                               problemTitle,
                                               problemMeta,
                                               content,
                                               activeLang
                                           }: VisualizeModalProps) {


    const [loading, setLoading] = useState(false);
    const [vizData, setVizData] = useState<VisualizationData | null>(null);
    const [activeTab, setActiveTab] = useState("overview");

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "pattern", label: "Pattern" },
        { id: "charts", label: "Charts" },
        { id: "execution", label: "Execution" },
        { id: "diagram", label: "Diagram" }
    ];

    useEffect(() => {

        const state = getGenerationState(problemId);

        if (state.status === "done" && state.data) {
            setVizData(state.data);
            return;
        }

        generateVisualization();

    }, []);

    const generateVisualization = async (force = false) => {

        try {

            if (force) {
                resetGeneration(problemId);
            }

            const state = getGenerationState(problemId);

            if (state.status === "done" && state.data && !force) {
                setVizData(state.data);
                return;
            }

            if (state.status === "loading") {
                setLoading(true);

                const res = await state.promise;

                setVizData(res);
                setLoading(false);

                return;
            }

            setLoading(true);

            const payload = {
                problemId,
                title: problemTitle,
                pattern: problemMeta?.pattern,
                difficulty: problemMeta?.difficulty,
                problemText: content?.problem,
                solutionExplanation: content?.solution?.explanation,
                code:
                    activeLang === "java"
                        ? content?.solution?.java
                        : content?.solution?.python,
                timeComplexity: content?.solution?.time,
                spaceComplexity: content?.solution?.space,
                forceRegenerate: force
            };

            const promise = startGeneration(problemId, () =>
                window.api.getOrGenerateVisualization(payload)
            );

            const result = await promise;

            setVizData(result);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const LoadingSkeleton = () => (
        <div className="
    flex flex-col items-center justify-center
    h-[60vh] text-indigo-300
">

            <FaSync className="animate-spin text-3xl mb-4" />

            <p className="text-lg font-medium">
                Generating Visualization...
            </p>

            <p className="text-sm text-gray-400 mt-1">
                Analyzing algorithm pattern and complexity
            </p>

        </div>

    );

    return createPortal(
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="
                relative w-[92%] max-w-7xl h-[88vh]
                rounded-2xl
                bg-gradient-to-br from-[#0f172a]/95 to-[#020617]/95
                border border-indigo-500/20
                shadow-2xl
                backdrop-blur-xl
                overflow-hidden
                flex flex-col
            ">

                {/* HEADER */}
                <div className="
                    flex items-center justify-between
                    px-6 py-4
                    border-b border-indigo-500/20
                    bg-gradient-to-r from-indigo-500/10 to-purple-500/10
                ">
                    <div className="flex items-center gap-3">
                        <FaProjectDiagram className="text-indigo-400 text-xl" />
                        <div>
                            <h2 className="text-lg font-semibold text-indigo-200">
                                Algorithm Visualization
                            </h2>
                            <p className="text-xs text-gray-400">
                                {problemTitle}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">

                        <button
                            disabled={loading}
                            onClick={() => {
                                generateVisualization(true);
                            }}
                            className="
        px-4 py-2 rounded-xl
        bg-gradient-to-r from-indigo-500/20 to-purple-500/20
        border border-indigo-400/30
        text-indigo-200
        hover:from-indigo-500/30 hover:to-purple-500/30
        flex items-center gap-2
        transition-all duration-300
        shadow-lg hover:shadow-indigo-500/20
        disabled:opacity-50
    "
                        >
                            <FaSync className={loading ? "animate-spin" : ""} />
                            Regenerate
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/10"
                        >
                            <FaTimes />
                        </button>

                    </div>
                </div>

                {/* TABS */}
                <div className="px-6 pt-2 pb-2 border-b border-white/10">

                    <div className="max-w-5xl mx-auto">

                        <div className="
            flex justify-center
        ">

                            <div className="
                inline-flex
                bg-white/5
                border border-white/10
                rounded-2xl
                p-1
                backdrop-blur-xl
                shadow-inner
            ">

                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                            relative px-6 py-2.5 text-sm rounded-xl
                            transition-all duration-300
                            font-medium min-w-[110px]

                            ${activeTab === tab.id
                                            ? "text-white"
                                            : "text-gray-400 hover:text-gray-200"}
                        `}
                                    >

                                        {activeTab === tab.id && (
                                            <span className="
                                absolute inset-0
                                rounded-xl
                                bg-gradient-to-r
                                from-indigo-500/30
                                to-purple-500/30
                                border border-indigo-400/30
                                shadow-lg
                                animate-fadeIn
                            " />
                                        )}

                                        <span className="relative z-10">
                            {tab.label}
                        </span>

                                    </button>
                                ))}

                            </div>

                        </div>

                    </div>

                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    <div className="max-w-5xl mx-auto space-y-6">

                        {loading && <LoadingSkeleton />}

                        {!loading && vizData && (
                            <>
                                {activeTab === "overview" && (
                                    <OverviewTab
                                        data={vizData}
                                        problemMeta={problemMeta}
                                    />
                                )}

                                {activeTab === "pattern" && (
                                    <PatternTab data={vizData} />
                                )}

                                {activeTab === "charts" && (
                                    <ChartsTab data={vizData} />
                                )}

                                {activeTab === "execution" && (
                                    <ExecutionTab data={vizData} />
                                )}

                                {activeTab === "diagram" && (
                                    <DiagramTab data={vizData} />
                                )}
                            </>
                        )}

                    </div>
                </div>
            </div>
        </div>,
        document.getElementById("modal-root")!
    );
};
