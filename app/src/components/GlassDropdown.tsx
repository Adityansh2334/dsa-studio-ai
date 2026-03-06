import { useState, useRef, useEffect } from "react";
import { SiJavascript, SiPython, SiDotnet } from "react-icons/si";
import { FaJava } from "react-icons/fa";
import type { ReactNode } from "react";
import { FiCode } from "react-icons/fi";

type Option = {
    label: string;
    value: string | number;
    recommended?: boolean;
};

const GenericIcon = (
    <FiCode className="text-gray-400 text-lg opacity-80" />
);

/** ✅ Language Icons */
const languageIcons: Record<string | number, ReactNode> = {
    javascript: <SiJavascript className="text-yellow-400 text-lg" />,
    python: <SiPython className="text-blue-400 text-lg" />,
    java: <FaJava className="text-orange-500 text-lg" />,
    dotnet: <SiDotnet className="text-purple-400 text-lg" />
};

export default function GlassDropdown({
                                          value,
                                          options,
                                          onChange,
                                          onOpen,
                                          placeholder = "Select option",
                                          disabled = false
                                      }: {
    value: string | number;
    options: Option[];
    onChange: (v: any) => void;
    placeholder?: string;
    onOpen?: () => void;
    disabled?: boolean;
}) {

    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (!ref.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div
            ref={ref}
            className={`relative w-full ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >

            {/* ================= TRIGGER ================= */}
            <div
                onClick={() => {

                    if (disabled) return;

                    setOpen(prev => {
                        const next = !prev;
                        if (next && onOpen) onOpen();
                        return next;
                    });
                }}
                className={`
                    h-11 px-4 rounded-xl
                    flex justify-between items-center
                    border border-white/10
                    backdrop-blur-xl
                    transition-all duration-300

                    bg-gradient-to-br
                    from-white/10
                    to-white/5

                    shadow-[0_8px_30px_rgba(0,0,0,0.35)]

                    ${open ? "ring-1 ring-indigo-500/40" : ""}

                    ${disabled
                    ? "cursor-not-allowed"
                    : "cursor-pointer hover:bg-white/10 hover:border-indigo-500/30"}
                `}
            >
                <div className="flex items-center gap-3">

                    {/* ICON */}
                    <div className="
                        w-7 h-7
                        rounded-md
                        flex items-center justify-center
                        bg-white/5
                        border border-white/10
                    ">
                        {languageIcons[value] || GenericIcon}
                    </div>

                    {/* LABEL */}
                    <span className="text-sm font-medium text-gray-200">
                        {selected?.label || placeholder}
                    </span>

                    {selected?.recommended && (
                        <span className="
                            text-[10px]
                            px-2 py-0.5 rounded-md
                            bg-emerald-500/20
                            text-emerald-300
                            border border-emerald-500/30
                        ">
                            ⭐ Recommended
                        </span>
                    )}

                </div>

                {/* ARROW */}
                <span className={`
                    transition-transform duration-300
                    text-gray-400
                    ${open ? "rotate-180 text-indigo-400" : ""}
                `}>
                    ⌄
                </span>
            </div>


            {/* ================= OPTIONS ================= */}
            {open && !disabled && (
                <div className="
                    absolute z-50 mt-2 w-full
                    rounded-xl
                    border border-white/10
                    backdrop-blur-2xl
                    overflow-hidden

                    bg-gradient-to-br
                    from-[#0F172A]/95
                    to-[#020617]/95

                    shadow-[0_20px_60px_rgba(0,0,0,0.6)]

                    animate-scaleIn
                ">

                    {options.map(opt => {

                        const isActive = opt.value === value;

                        return (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    if (disabled) return;
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                className={`
                                    px-4 py-3
                                    transition-all duration-200
                                    text-sm
                                    flex items-center justify-between
                                    relative
                                    cursor-pointer

                                    ${isActive
                                    ? "bg-indigo-600/30 text-white"
                                    : "hover:bg-indigo-600/20"}
                                `}
                            >

                                {/* Animated Highlight */}
                                {isActive && (
                                    <div className="
                                        absolute inset-0
                                        bg-gradient-to-r
                                        from-indigo-500/20
                                        to-purple-500/20
                                        animate-fadeIn
                                    " />
                                )}

                                <div className="flex items-center gap-3 relative z-10">

                                    {/* ICON */}
                                    <div className="
                                        w-7 h-7
                                        rounded-md
                                        flex items-center justify-center
                                        bg-white/5
                                        border border-white/10
                                    ">
                                        {languageIcons[opt.value] || GenericIcon}
                                    </div>

                                    <span className="font-medium">
                                        {opt.label}
                                    </span>

                                </div>

                                {opt.recommended && (
                                    <span className="
                                        text-[10px]
                                        px-2 py-0.5 rounded-md
                                        bg-emerald-500/20
                                        text-emerald-300
                                        border border-emerald-500/30
                                        relative z-10
                                    ">
                                        ⭐ Recommended
                                    </span>
                                )}

                            </div>
                        );
                    })}
                </div>
            )}

        </div>
    );
}