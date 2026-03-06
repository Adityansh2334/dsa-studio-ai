import { useEffect, useState } from "react";

type Props = {
    value: string[];
    onChange: (v: string[]) => void;
};

export default function PatternMultiSelect({ value, onChange }: Props) {
    const [patterns, setPatterns] = useState<string[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        window.api.getPatterns().then(setPatterns);
    }, []);

    function toggle(p: string) {
        if (value.includes(p)) {
            onChange(value.filter(x => x !== p));
        } else {
            onChange([...value, p]);
        }
    }

    /* ✅ NEW */
    function selectAll() {
        onChange(patterns);
    }

    /* ✅ NEW */
    function clearAll() {
        onChange([]);
    }

    const filtered = patterns.filter(p =>
        p.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">

            {/* ✅ NEW: Actions */}
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
                >
                    Select All
                </button>

                <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30"
                >
                    Clear
                </button>
            </div>

            {/* Selected chips */}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {value.map(p => (
                        <div
                            key={p}
                            className="flex items-center gap-2 px-3 py-1.5
                rounded-xl bg-indigo-600 text-white text-xs shadow-lg"
                        >
                            {p}
                            <button
                                type="button"
                                onClick={() => toggle(p)}
                                className="text-white/70 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Search */}
            <input
                placeholder="Search patterns..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-black/40 border border-white/10
          rounded-xl px-4 py-2 text-sm outline-none
          focus:ring-2 focus:ring-indigo-500/40"
            />

            {/* Pattern list */}
            <div
                className="max-h-56 overflow-y-auto
          bg-black/30 border border-white/10
          rounded-2xl p-3 flex flex-wrap gap-2"
            >
                {filtered.map(p => {
                    const selected = value.includes(p);

                    return (
                        <button
                            type="button"
                            key={p}
                            onClick={() => toggle(p)}
                            className={`
                px-3 py-1.5 rounded-xl text-xs transition-all
                ${selected
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"}
              `}
                        >
                            {p}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
