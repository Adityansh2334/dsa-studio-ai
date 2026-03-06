import { useEffect, useState } from "react";

type Props = {
    language: string;
};

const STORAGE_KEY = "editor_warning_hidden";

export default function EditorWarning({ language }: Props) {

    const [visible, setVisible] = useState(true);
    const [dontShow, setDontShow] = useState(false);

    /**
     * Load preference
     */
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved === "true") {
            setVisible(false);
            setDontShow(true);
        }
    }, []);

    /**
     * Handle toggle
     */
    const handleDontShow = (value: boolean) => {

        setDontShow(value);

        if (value) {
            localStorage.setItem(STORAGE_KEY, "true");
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    /**
     * Close badge
     */
    const handleClose = () => {

        if (dontShow) {
            localStorage.setItem(STORAGE_KEY, "true");
        }

        setVisible(false);
    };

    if (!visible) return null;

    const commentExample = {
        javascript: "// NOTE: AI templates may be incorrect. Adjust as needed.",
        python: "# NOTE: AI templates may be incorrect. Adjust as needed.",
        java: "// NOTE: AI templates may be incorrect. Adjust as needed.",
        dotnet: "// NOTE: AI templates may be incorrect. Adjust as needed.",
    };

    const comment =
        commentExample[language as keyof typeof commentExample] ||
        "// NOTE: AI templates may be incorrect. Adjust as needed.";

    console.log("COMMENT:::: ", comment);

    return (
        <div
            className="
                rounded-lg
                border border-yellow-400/20
                bg-yellow-500/10
                backdrop-blur-md
                px-3 py-2
                text-xs
                flex flex-col gap-2
                shadow-lg
            "
        >

            {/* Top Row */}
            <div className="flex items-start justify-between gap-3">

                <div className="flex items-start gap-2">

                    <div className="text-yellow-400 mt-[1px]">
                        ⚠️
                    </div>

                    <div className="text-yellow-200 leading-relaxed">

                        <div className="font-medium">
                            AI generated template may not always be correct.
                        </div>

                        <div className="text-yellow-300/80 mt-1">
                            Please adjust the code if needed before running or submitting.
                        </div>

                        {/*<div className="mt-1 text-yellow-400 font-mono">*/}
                        {/*    {comment}*/}
                        {/*</div>*/}

                    </div>
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="
                        text-yellow-300/70
                        hover:text-yellow-200
                        transition
                        text-sm
                    "
                >
                    ✕
                </button>

            </div>

            {/* Bottom Row */}
            <label className="flex items-center gap-2 text-yellow-300/80 cursor-pointer select-none">

                <input
                    type="checkbox"
                    checked={dontShow}
                    onChange={(e) => handleDontShow(e.target.checked)}
                    className="accent-yellow-400 cursor-pointer"
                />

                Don’t show again

            </label>

        </div>
    );
}