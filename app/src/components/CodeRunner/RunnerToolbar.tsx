import GlassDropdown from "@/components/GlassDropdown";
import { FaPlay, FaCheck, FaTimes } from "react-icons/fa";
import {ArrowsPointingInIcon, ArrowsPointingOutIcon} from "@heroicons/react/24/outline";

type Props = {
    language: string;
    setLanguage: (v: string) => void;
    handleRun: () => void;
    handleSubmit: () => void;
    loading: boolean;
    statusColor: string;
    runtimeLabels: any;
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    onClose: () => void;
};

export default function RunnerToolbar({
                                          language,
                                          setLanguage,
                                          handleRun,
                                          handleSubmit,
                                          loading,
                                          runtimeLabels,
                                          isFullscreen,
                                          toggleFullscreen,
                                          onClose
                                      }: Props) {

    const disabledClass =
        "disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div
            className="
                relative
                z-[1000]
                w-full
                px-5 py-3
                rounded-2xl
                border border-white/10
                bg-gradient-to-br from-white/10 to-white/5
                backdrop-blur-xl
                shadow-[0_8px_30px_rgba(0,0,0,0.35)]

                before:absolute before:inset-0 before:rounded-2xl
                before:bg-gradient-to-r before:from-indigo-500/10 before:to-purple-500/10
                before:blur-xl before:opacity-60
                before:-z-10
            "
        >
            <div className="flex items-center justify-between gap-4">

                {/* LEFT SECTION */}
                <div className="flex items-center gap-3 flex-wrap">

                    {/* LANGUAGE */}
                    <div className="h-11 min-w-[190px] flex items-center">
                        <GlassDropdown
                            value={language}
                            onChange={setLanguage}
                            disabled={loading}
                            options={[
                                {
                                    label: runtimeLabels?.javascript || "JavaScript",
                                    value: "javascript"
                                },
                                {
                                    label: runtimeLabels?.python || "Python",
                                    value: "python"
                                },
                                {
                                    label: runtimeLabels?.java || "Java",
                                    value: "java"
                                },
                                {
                                    label: runtimeLabels?.dotnet || "C#",
                                    value: "dotnet"
                                }
                            ]}
                        />
                    </div>

                    {/* RUN BUTTON */}
                    <button
                        onClick={handleRun}
                        disabled={loading}
                        className={`
                            h-11 px-6 rounded-xl
                            flex items-center justify-center gap-2
                            bg-gradient-to-r from-blue-600 to-indigo-600
                            hover:from-blue-700 hover:to-indigo-700
                            text-white font-medium
                            shadow-lg shadow-blue-500/20
                            transition-all duration-200
                            ${disabledClass}
                        `}
                    >
                        <FaPlay className="text-xs" />
                        Run
                    </button>

                    {/* SUBMIT BUTTON */}
                    <button
                        onClick={handleSubmit}
                        // disabled={loading}
                        disabled={true}
                        className={`
                            h-11 px-6 rounded-xl
                            flex items-center justify-center gap-2
                            bg-gradient-to-r from-emerald-600 to-green-600
                            hover:from-emerald-700 hover:to-green-700
                            text-white font-medium
                            shadow-lg shadow-emerald-500/20
                            transition-all duration-200
                            ${disabledClass}
                        `}
                    >
                        <FaCheck className="text-xs" />
                        Submit (In-Progress...)
                    </button>

                    <button
                        onClick={toggleFullscreen}
                        className="
        p-2 rounded-lg
        bg-white/5 border border-white/10
        hover:bg-indigo-500/20
        hover:border-indigo-400/40
        transition-all duration-300
    "
                    >
                        {isFullscreen ? (
                            <ArrowsPointingInIcon className="w-4 h-4 text-indigo-300" />
                        ) : (
                            <ArrowsPointingOutIcon className="w-4 h-4 text-indigo-300" />
                        )}
                    </button>

                </div>

                {/* RIGHT SECTION */}
                <div className="flex items-center gap-3">

                    {/* CLOSE */}
                    <button
                        onClick={onClose}
                        className="
                            w-11 h-11
                            rounded-xl
                            bg-white/5 hover:bg-white/10
                            border border-white/10
                            text-gray-300
                            flex items-center justify-center
                            transition
                        "
                    >
                        <FaTimes />
                    </button>

                </div>

            </div>
        </div>
    );
}