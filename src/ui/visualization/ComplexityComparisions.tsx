import React, { useEffect, useState } from "react";

type ComparisonItem = {
    name: string;
    complexity?: string;
    value: number;
};

type ComplexityComparisonProps = {
    data: ComparisonItem[];
};

/* =========================
   NUMBER FORMATTER
========================= */

const formatNumber = (num: number) => {

    if (!num || isNaN(num)) return "0";

    if (num >= 1_000_000_000)
        return (num / 1_000_000_000).toFixed(1) + "B";

    if (num >= 1_000_000)
        return (num / 1_000_000).toFixed(1) + "M";

    if (num >= 1_000)
        return (num / 1_000).toFixed(1) + "K";

    return num.toString();
};

const ComplexityComparison: React.FC<ComplexityComparisonProps> = ({ data }) => {

    const [animatedValues, setAnimatedValues] = useState<number[]>([]);

    if (!data || !data.length) return null;

    /* =========================
       SAFE NUMERIC VALUES
    ========================== */

    const safeValues = data.map(d => Number(d.value) || 0);

    const maxValue = Math.max(...safeValues, 1);
    const fastestValue = Math.min(...safeValues.filter(v => v > 0)) || 0;

    /* =========================
       ANIMATION
    ========================== */

    useEffect(() => {

        setAnimatedValues(new Array(data.length).fill(0));

        const timers = data.map((item, index) => {

            return setTimeout(() => {

                setAnimatedValues(prev => {

                    const copy = [...prev];
                    copy[index] = Number(item.value) || 0;
                    return copy;

                });

            }, index * 250);

        });

        return () => timers.forEach(clearTimeout);

    }, [data]);

    /* =========================
       SPEEDUP TEXT
    ========================== */

    let speedupText: string | null = null;

    if (data.length >= 2 && fastestValue > 0) {

        const slowest = Math.max(...safeValues);
        const factor = (slowest / fastestValue).toFixed(1);

        speedupText = `${factor}× faster than slower approach`;
    }

    /* =========================
       RENDER
    ========================== */

    return (
        <div className="space-y-8">

            {data.map((item, index) => {

                const currentValue =
                    animatedValues[index] || 0;

                const percent =
                    Math.min((currentValue / maxValue) * 100, 100);

                const isBest =
                    item.value === fastestValue;

                return (
                    <div
                        key={index}
                        className="
                            space-y-3
                            transition-all duration-300
                            hover:scale-[1.01]
                        "
                    >

                        {/* HEADER */}

                        <div className="flex justify-between items-start">

                            <div className="flex flex-col gap-1">

                                <div className="flex items-center gap-2">

                                    <span className="text-gray-200 font-medium">
                                        {item.name}
                                    </span>

                                    {isBest && (
                                        <span className="
                                            text-xs px-2 py-0.5 rounded-full
                                            bg-emerald-500/20 text-emerald-300
                                            border border-emerald-400/30
                                            animate-pulse
                                        ">
                                            🚀 Most Efficient
                                        </span>
                                    )}

                                </div>

                                {item.complexity && (
                                    <span className="
                                        text-xs text-gray-400
                                        bg-white/5 px-2 py-0.5
                                        rounded-md w-fit
                                    ">
                                        {item.complexity}
                                    </span>
                                )}

                            </div>

                            <span className="text-indigo-300 font-semibold text-sm">
                                {formatNumber(item.value)}
                            </span>

                        </div>

                        {/* PROGRESS BAR */}

                        <div
                            className="
                                relative h-5 rounded-full
                                bg-white/5 border border-white/10
                                overflow-hidden group
                            "
                        >

                            {/* SHIMMER BACKGROUND */}

                            <div className="
                                absolute inset-0
                                bg-gradient-to-r
                                from-transparent via-white/5 to-transparent
                                animate-[shimmer_2s_infinite]
                            " />

                            {/* FILL */}

                            <div
                                className={`
                                    absolute left-0 top-0 h-full
                                    rounded-full
                                    transition-all duration-1000 ease-out
                                    shadow-[0_0_18px_rgba(99,102,241,0.6)]
                                    ${isBest
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                    : "bg-gradient-to-r from-purple-500 to-indigo-500"}
                                `}
                                style={{ width: `${percent}%` }}
                            />

                            {/* TOOLTIP */}

                            <div className="
                                absolute -top-10 left-1/2 -translate-x-1/2
                                px-3 py-1 text-xs
                                bg-[#020617]/90
                                border border-indigo-500/30
                                rounded-lg
                                opacity-0 group-hover:opacity-100
                                transition
                                backdrop-blur-xl
                                whitespace-nowrap
                            ">
                                {formatNumber(item.value)} operations
                            </div>

                        </div>

                        {/* FOOTER */}

                        <div className="flex justify-between text-xs">

                            <span className="text-gray-400">
                                Relative Cost
                            </span>

                            <span className="text-indigo-300 font-medium">
                                {percent.toFixed(0)}%
                            </span>

                        </div>

                    </div>
                );
            })}

            {/* SPEEDUP PANEL */}

            {speedupText && (
                <div className="
                    mt-6 p-4 rounded-xl
                    bg-indigo-500/10 border border-indigo-500/20
                    text-indigo-300 text-sm
                    backdrop-blur-xl
                    shadow-inner
                ">
                    ⚡ Optimized solution is <b>{speedupText}</b>
                </div>
            )}

        </div>
    );
};

export default ComplexityComparison;
