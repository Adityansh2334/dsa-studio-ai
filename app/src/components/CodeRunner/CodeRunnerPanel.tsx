import React, { useEffect, useRef, useState } from "react";
import RunnerToolbar from "./RunnerToolbar";
import EditorPanel from "./EditorPanel";
import ConsolePanel from "./ConsolePanel";
import TemplateLoader from "@/components/CodeRunner/TemplateLoader.tsx";

type Props = {
    content: any;
    userId: string;
    setShowRunner: (v: boolean) => void;
    prevShowSolutionRef: React.MutableRefObject<boolean>;
    setShowSolution: (v: boolean) => void;
};

export default function CodeRunnerPanel({
                                            content,
                                            userId,
                                            setShowRunner,
                                            prevShowSolutionRef,
                                            setShowSolution,
                                        }: Props) {

    const problemId = content?.id || content?.problemId || "default";

    const [language, setLanguage] = useState("javascript");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [consoleOutput, setConsoleOutput] = useState("");
    const [submitResult, setSubmitResult] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"output" | "results">("output");
    const [hasEdited, setHasEdited] = useState(false);
    const [templateLoading, setTemplateLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    /** ✅ Per language memory */
    const codeMemoryRef = useRef<Record<string, string>>({});
    const editedMemoryRef = useRef<Record<string, boolean>>({});

    const [runtimeLabels, setRuntimeLabels] = useState<any>(null);

    /**
     * ✅ NEW: Session memory per problem + language
     */
    const sessionMemoryRef = useRef<
        Record<
            string,
            Record<
                string,
                {
                    code: string;
                    edited: boolean;
                }
            >
        >
    >({});

    const saveToSessionMemory = (
        pid: string,
        lang: string,
        value: string,
        edited: boolean
    ) => {
        if (!sessionMemoryRef.current[pid]) {
            sessionMemoryRef.current[pid] = {};
        }

        sessionMemoryRef.current[pid][lang] = {
            code: value,
            edited,
        };
    };

    const loadFromSessionMemory = (pid: string, lang: string) => {
        return sessionMemoryRef.current?.[pid]?.[lang] || null;
    };

    const loadTemplate = async (lang: string) => {

        try {

            const sessionData = loadFromSessionMemory(problemId, lang);

            /**
             * If session memory exists → restore instantly
             */
            if (sessionData) {
                setCode(sessionData.code);
                setHasEdited(sessionData.edited);
                return;
            }

            setTemplateLoading(true);

            const res = await (window as any).api.getTemplate({
                userId,
                language: lang,
                problem: content
            });

            if (res?.code && res?.success) {

                setCode(res.code);

                codeMemoryRef.current[lang] = res.code;
                editedMemoryRef.current[lang] = false;

                saveToSessionMemory(problemId, lang, res.code, false);
            }else{
                setConsoleOutput(res?.error);
            }

            try {
                const res = await (window as any).api.getRuntimes();
                console.log(res);
                setRuntimeLabels(res);
            } catch (err) {
                console.error(err);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setTemplateLoading(false);
        }
    };

    /** Language change */
    useEffect(() => {

        const sessionData = loadFromSessionMemory(problemId, language);

        if (sessionData) {
            setCode(sessionData.code);
            setHasEdited(sessionData.edited);
        }

        const existingCode = codeMemoryRef.current[language];
        const wasEdited = editedMemoryRef.current[language];

        setConsoleOutput("");
        setSubmitResult(null);

        if (existingCode) {
            setCode(existingCode);
            setHasEdited(!!wasEdited);
        }

        loadTemplate(language);

    }, [language]);

    /** Sync memory when code changes */
    useEffect(() => {

        codeMemoryRef.current[language] = code;
        editedMemoryRef.current[language] = hasEdited;

        /**
         * Save to session memory
         */
        saveToSessionMemory(problemId, language, code, hasEdited);

    }, [code, hasEdited, language]);

    /**
     * Clear session memory when component unmounts
     */
    useEffect(() => {
        return () => {
            delete sessionMemoryRef.current[problemId];
        };
    }, []);

    const handleRun = async () => {

        try {
            setLoading(true);
            setConsoleOutput("");
            setActiveTab("output");

            const res = await (window as any).api.codeRunner({
                language,
                code,
                problemId
            });

            setConsoleOutput(
                res?.combined || res?.stdout || res?.stderr || res?.error || "No output"
            );

        } catch (err: any) {
            setConsoleOutput(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {

        try {
            setLoading(true);
            setSubmitResult(null);
            setActiveTab("results");

            const res = await (window as any).api.codeSubmit({
                language,
                code,
                problem: content,
                userId
            });

            setSubmitResult(res);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const statusColor =
        loading ? "bg-yellow-400"
            : submitResult ? "bg-green-400"
                : "bg-gray-500";

    const disabled = loading || templateLoading;

    return (
        <div
            className={`
        w-full h-full flex flex-col gap-3
        ${isFullscreen
                ? "fixed inset-0 z-[300] bg-[#05070D] p-6"
                : "px-4 pt-4 pb-4"}
    `}
        >

            <RunnerToolbar
                language={language}
                setLanguage={setLanguage}
                handleRun={handleRun}
                handleSubmit={handleSubmit}
                loading={disabled}
                statusColor={statusColor}
                runtimeLabels={runtimeLabels}
                isFullscreen={isFullscreen}
                toggleFullscreen={() => setIsFullscreen(v => !v)}
                onClose={() => {
                    setShowRunner(false);
                    setShowSolution(prevShowSolutionRef.current);
                }}
            />

            <div className="relative flex flex-col flex-1 min-h-0 gap-3">

                {/* Editor + Console ALWAYS mounted */}
                <EditorPanel
                    language={language}
                    code={code}
                    setCode={(v) => {
                        setHasEdited(true);
                        setCode(v);
                    }}
                    setHasEdited={setHasEdited}
                />

                <ConsolePanel
                    setActiveTab={setActiveTab}
                    activeTab={activeTab}
                    consoleOutput={consoleOutput}
                    submitResult={submitResult}
                    loading={loading}
                />

                {/* Overlay Loader */}
                {templateLoading && (
                    <div className="
                        absolute inset-0
                        rounded-2xl
                        border border-white/10
                        bg-[#05070D]/80
                        backdrop-blur-md
                        flex items-center justify-center
                        z-20
                    ">
                        <TemplateLoader />
                    </div>
                )}

            </div>

        </div>
    );
}