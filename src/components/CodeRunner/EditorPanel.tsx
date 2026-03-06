import Editor from "@monaco-editor/react";
import EditorWarning from "@/components/CodeRunner/WarningBadge.tsx";

type Props = {
    language: string;
    code: string;
    setCode: (v: string) => void;
    setHasEdited: (v: boolean) => void;
};

export default function EditorPanel({
                                        language,
                                        code,
                                        setCode,
                                        setHasEdited
                                    }: Props) {

    return (
        <div className="flex-1 min-h-0 relative">

            {/* Floating Warning */}
            <div className="absolute bottom-3 left-3 right-3 z-10">
                <EditorWarning language={language} />
            </div>

            <div
                className="
                    h-full
                    rounded-2xl
                    border border-white/10
                    bg-gradient-to-br from-[#0B1220] to-[#070B14]
                    overflow-hidden
                    shadow-[0_20px_60px_rgba(0,0,0,0.6)]
                "
            >
                <Editor
                    height="100%"
                    theme="vs-dark"
                    language={language === "dotnet" ? "csharp" : language}
                    value={code}
                    onChange={(v) => {
                        setHasEdited(true);
                        setCode(v || "");
                    }}
                    options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        smoothScrolling: true,
                        cursorSmoothCaretAnimation: "on",
                        padding: { top: 20 },
                        fontFamily: "JetBrains Mono, Fira Code, monospace",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        automaticLayout: true
                    }}
                />
            </div>

        </div>
    );
}