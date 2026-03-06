import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypePrism from "rehype-prism-plus";
import remarkGfm from "remark-gfm";
import "prismjs/themes/prism-okaidia.css";
import type { Components } from "react-markdown";
import { createPortal } from "react-dom";

const markdownComponents: Components = {
    code({ node, className, children, ...props }) {
        const isInline = !className;
        const match = /language-(\w+)/.exec(className || "");
        const language = match ? match[1] : "";

        if (isInline) {
            return (
                <code className="bg-white/10 px-1 py-0.5 rounded text-sm">
                    {children}
                </code>
            );
        }
        return (
            <pre className="rounded-xl my-3 overflow-auto">
                <div className="text-xs text-gray-400 mb-1">{language}</div>
                <code className={className} {...props}>
                  {children}
                </code>
            </pre>
        );
    },
};


type Props = {
    problem: any;
    problemId: number;
    onClose: () => void;
};

function validateQuestion(q: string): string | null {
    const text = q.trim();

    if (text.length < 3) return "Please ask a meaningful question.";
    if (text.length > 400) return "Question is too long.";
    if (/^[0-9\s]+$/.test(text)) return "Question cannot be only numbers.";
    if (/^[^a-zA-Z]+$/.test(text)) return "Use valid words in your question.";
    if (/^(.)\1+$/.test(text)) return "Invalid repeated characters.";
    if (!/[a-zA-Z]/.test(text)) return "Question must contain letters.";

    return null;
}

function getWelcomeMessage(_problem: any) {
    return {
        role: "ai" as const,
        text: `Hi 👋 I'm your AI Tutor for this problem.

You can ask me:
• Clarification about the problem
• Hints to approach
• Edge cases to think about
• Help understanding constraints

I will only guide you — 🙂

Go ahead and ask your doubt!`
    };
}

function sanitizeTutorResponseUI(text: string): string {
    if (!text) return "";

    let cleaned = text;

    // Remove markdown headers only
    cleaned = cleaned.replace(/^#{1,6}\s*/gm, "");

    // Remove bold markers but KEEP spacing
    cleaned = cleaned.replace(/\*\*/g, "");
    cleaned = cleaned.replace(/\*/g, "");

    // Normalize excessive blank lines
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    return cleaned.trim();
}

export default function AITutorModal({ problem, problemId, onClose }: Props) {
    const [chat, setChat] = useState<{ role: "user" | "ai"; text: string }[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);

    useEffect(() => {
        async function loadHistory() {
            const history = await window.api.loadProblemChat(problemId);

            // 🔥 MAP DB shape → UI shape
            const mapped = history.map((h: any) => ({
                role: h.role,
                text: h.message
            }));

            if (mapped.length > 0) {
                setChat(mapped);
            } else {
                setChat([getWelcomeMessage(problem)]);
            }
        }
        loadHistory();
    }, [problemId]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat, loading]);

    async function ask() {
        const error = validateQuestion(input);
        if (error) {
            setChat(c => [...c, { role: "ai", text: error }]);
            return;
        }

        const q = input.trim();
        setInput("");
        setLoading(true);

        let fullResponse = "";

        // Add user + AI placeholder
        setChat(prev => [
            ...prev,
            { role: "user", text: q },
            { role: "ai", text: "" }
        ]);

        try {
            await window.api.askProblemAIStream(
                { problem, problemId, question: q },
                (token: string) => {

                    // Append RAW token (DO NOT sanitize here)
                    fullResponse += token;

                    setChat(prev => {
                        const updated = [...prev];
                        const lastIndex = updated.length - 1;

                        if (updated[lastIndex]?.role === "ai") {
                            updated[lastIndex] = {
                                ...updated[lastIndex],
                                text: fullResponse
                            };
                        }

                        return updated;
                    });
                }
            );

            // ✅ After stream completes → sanitize once
            const cleaned = sanitizeTutorResponseUI(fullResponse);

            setChat(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;

                if (updated[lastIndex]?.role === "ai") {
                    updated[lastIndex] = {
                        ...updated[lastIndex],
                        text: cleaned
                    };
                }

                return updated;
            });

        } catch {
            setChat(prev => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;

                if (updated[lastIndex]?.role === "ai") {
                    updated[lastIndex] = {
                        role: "ai",
                        text: "AI not responding. Try again."
                    };
                }

                return updated;
            });
        } finally {
            setLoading(false);
        }
    }

    return createPortal(
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden">
            <div className="w-full max-w-4xl h-[80vh]
                bg-[#0B1220] rounded-3xl border border-white/10
                shadow-[0_40px_140px_rgba(0,0,0,0.8)]
                flex flex-col overflow-hidden">

                <div className="flex justify-between items-center px-8 py-5 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-indigo-400">
                        AI Tutor — Ask about this problem
                    </h2>
                    <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chat.map((m, i) => (
                        <div
                            key={i}
                            className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-line
                            ${m.role === "user"
                                ? "ml-auto bg-indigo-600 text-white"
                                : "bg-white/5 text-gray-300 border border-white/10"}`}
                        >
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypePrism]}
                                components={markdownComponents}
                            >
                                {m.text}
                            </ReactMarkdown>

                            {m.role === "ai" && loading && i === chat.length - 1 && (
                                <span className="animate-pulse">▌ AI is thinking ...</span>
                            )}
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>

                <div className="p-5 border-t border-white/10 flex gap-3">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ask your doubt..."
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                        onKeyDown={(e) => e.key === "Enter" && ask()}
                    />
                    <button
                        onClick={ask}
                        disabled={loading}
                        className="px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm">
                        Send
                    </button>
                </div>
            </div>
        </div>,
        document.getElementById("modal-root")!
    );
}
