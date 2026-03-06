import React, { Suspense, useEffect, useState } from "react";
import { getTodayProblems } from "../services/dailyService";
import { isAIConfigured } from "../services/aiKeyService";
import type { Problem } from "../types/problem";
import SolveModal from "./modal/SolveModal.tsx";
import AISetupModal from "./modal/AISetupModal.tsx";
import EditProfileModal from "./modal/EditProfileModal.tsx";
import InterviewSetupModal from "./modal/InterviewSetupModal.tsx";
import { showToast } from "@/util/toast";
import { useRef } from "react";
import {
    UserCircleIcon,
    PencilSquareIcon,
    ChartBarIcon,
    PowerIcon,
    ArrowPathIcon,
    SparklesIcon,
    CodeBracketIcon,
    CheckCircleIcon,
    PlayIcon
} from "@heroicons/react/24/outline";
const AnalyticsModal = React.lazy(
    () => import("./analytics/AnalyticsModal.tsx"),
);

export type Profile = {
    id: number;
    name: string;
    email: string;
    phone?: string;
    createdOn: string;
};

type Mode = "normal" | "interview";
type AuthView = "choice" | "register" | "login" | "forgot";

function deriveDayNumber(createdOn?: string | Date) {
    if (!createdOn) return 1;

    const created = new Date(createdOn);
    const today = new Date();

    // Reset time to midnight for accurate day diff
    created.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(1, diffDays + 1);
}

export default function Home() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
    });
    const [login, setLogin] = useState({ email: "", password: "" });
    const [problems, setProblems] = useState<Problem[]>([]);
    const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [aiReady, setAIReady] = useState<boolean | null>(null);
    const [authView, setAuthView] = useState<AuthView>("choice");
    const [authError, setAuthError] = useState<string | null>(null);
    const [loadingProblems, setLoadingProblems] = useState(true);
    const [editProfile, setShowEditProfile] = useState(false);
    const [showInterviewModal, setShowInterviewModal] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(9);
    const [showAISetup, setShowAISetup] = useState(false);
    const [filterSolved, setFilterSolved] = useState<
        "all" | "solved" | "unsolved"
    >("all");
    const [filterDifficulty, setFilterDifficulty] = useState<
        "all" | "easy" | "medium" | "hard"
    >("all");
    const generationTimeoutRef = useRef<{
        t1?: NodeJS.Timeout;
        t2?: NodeJS.Timeout;
        t3?: NodeJS.Timeout;
    } | null>(null);
    const [generationPhase, setGenerationPhase] = useState<
        "normal" | "slow" | "verySlow" | "failed"
    >("normal");
    const [generationError, setGenerationError] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [pageDirection, setPageDirection] = useState<"left" | "right" | null>(
        null,
    );
    const [quotaError, setQuotaError] = useState(false);
    const [generationLimit, setGenerationLimit] = useState<number>(0);
    const [showGenerationBar, setShowGenerationBar] = useState(false);
    const [barCompleted, setBarCompleted] = useState(false);
    const [forgotForm, setForgotForm] = useState({
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [generatedNow, setGeneratedNow] = useState(0);
    const [eventDriven, setEventDriven] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    /* -------------------- MODE -------------------- */
    const [mode, setMode] = useState<Mode>("normal");

    /* -------------------- DAY + STREAK -------------------- */
    const [dayNumber, setDayNumber] = useState(1);
    const [streak, setStreak] = useState(0);

    const [scrolled, setScrolled] = useState(false);
    const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        if (!isGenerating || generationLimit === 0) {
            setEtaSeconds(null);
            return;
        }

        const remaining = generationLimit - generatedNow;

        // assume avg 15 sec per problem
        const seconds = remaining * 15;

        setEtaSeconds(seconds);
    }, [generatedNow, generationLimit, isGenerating]);


    useEffect(() => {
        window.api.listenGenerationStream();

        const offStart = window.api.onGenerationStarted((data) => {
            setGeneratedNow(data.count ?? 0);
            setGenerationLimit(data.limit ?? 0);

            setLoading(true);
            setEventDriven(true);
            setIsGenerating(true);

            setShowGenerationBar(true);
            setBarCompleted(false);
        });

        const offProgress = window.api.onGenerationProgress((data) => {
            if (data?.count !== undefined) {
                setGeneratedNow(data.count);
            } else {
                setGeneratedNow((prev) => prev + 1);
            }
        });

        const offFinish = window.api.onGenerationFinished(() => {
            if (mode === "normal") {
                setLoading(false);
            }

            setTimeout(() => {
                setBarCompleted(true);
                setIsGenerating(false);
                setShowGenerationBar(false);
                setBarCompleted(false);

                // 🔥 reset counters
                setGeneratedNow(0);
                setGenerationLimit(0);
                setEventDriven(false);
            }, 1800);
        });

        return () => {
            offStart();
            offProgress();
            offFinish();
        };
    }, [mode]);

    const generationPercent =
        generationLimit > 0 ? (generatedNow / generationLimit) * 100 : 0;

    useEffect(() => {
        if (filtersOpen && !hasAutoClosed && problems.length > 0) {
            const t = setTimeout(() => {
                setFiltersOpen(false);
                setHasAutoClosed(true);
            }, 3500); // show for 3.5s

            return () => clearTimeout(t);
        }
    }, [problems, filtersOpen, hasAutoClosed]);

    useEffect(() => {
        async function restore() {
            const user = await window.api.restoreSession();
            if (user) {
                setProfile(user);
                const dayNumber = deriveDayNumber(user.created_at);
                setDayNumber(dayNumber);
                const ready = await isAIConfigured();
                console.log("AI ready:", ready);
                setAIReady(ready);
            }
        }
        restore();
    }, []);

    useEffect(() => {
        if (profile && aiReady === false) {
            showToast(
                "AI is not configured. Please set up AI before continuing.",
                "info",
            );
        }
    }, [aiReady, profile]);

    /* -------------------- MODE PERSIST -------------------- */
    useEffect(() => {
        const stored = localStorage.getItem("dsa-mode");
        if (stored === "normal" || stored === "interview") {
            setMode(stored);
        } else {
            localStorage.setItem("dsa-mode", "normal");
        }
    }, []);

    function toggleMode() {
        const next = mode === "normal" ? "interview" : "normal";
        localStorage.setItem("dsa-mode", next);
        setMode(next);
    }

    useEffect(() => {
        setPage(1);
    }, [filterSolved, filterDifficulty, pageSize]);

    const solvedCount = problems.filter(
        (p) => p.id !== undefined && Boolean(p.solved),
    ).length;

    /* Pooling Function */
    function startPolling(limit: number, ctx: string) {
        const interval = setInterval(async () => {
            try {
                const interviewCount = await window.api.getProblemsCount(ctx);

                if (interviewCount >= limit) {
                    console.log("🎉 Interview generation completed");
                    clearInterval(interval);
                    setLoading(false);
                }
            } catch (e) {
                console.log("Polling error:", e);
                clearInterval(interval);
                setLoading(false);
            }
        }, 3000); // check every 3 sec
    }

    /* -------------------- LOAD PROBLEMS -------------------- */
    async function loadProblems() {
        if (!profile && !aiReady) return;
        if (!eventDriven) {
            setLoading(true);
        }
        setLoadingProblems(true);

        const limit = await window.api.getUserLimitCount(mode);
        console.log("Limit:", limit);

        // ⏱ phased watchdogs
        const t1 = setTimeout(() => setGenerationPhase("slow"), 60_000); // 1 min
        const t2 = setTimeout(() => setGenerationPhase("verySlow"), 180_000); // 3 min
        const t3 = setTimeout(() => setGenerationPhase("failed"), 780_000); // 13 min

        generationTimeoutRef.current = { t1, t2, t3 };

        try {
            setGenerationError(false);
            const data = await getTodayProblems(mode);

            setProblems(data);

            console.log("PROBLEMS:", data);

            const ctx = data[0]?.interview_context || "";

            // 🔥 If interview mode and not full yet → start polling
            if (mode === "interview" && data.length > 0 && data.length < limit) {
                console.log("⚡ Interview background generation running...");
                startPolling(limit, ctx); // ✅ pass directly
            }
        } catch (e: any) {
            // showToast("Failed to generate problems. Please check your AI setup.", "error");
            console.log("Failed to generate problems.", e);

            if (e?.message?.toLowerCase()?.includes("OpenRouter quota")) {
                showToast(
                    "Your OpenRouter quota is exhausted. Please update your API key.",
                    "error",
                );
                setQuotaError(true);
            } else if (e?.isQuotaError) {
                showToast(
                    "HuggingFace quota exhausted. Please update API key.",
                    "error",
                );
                setQuotaError(true);
            }

            setShowGenerationBar(false);
            setBarCompleted(false);
            // 🔥 This triggers recovery UI
            setGenerationError(true);
        } finally {
            if (!eventDriven) {
                setLoading(false);
            }
            setLoadingProblems(false);
            setGenerationPhase("normal");
            if (generationTimeoutRef.current) {
                Object.values(generationTimeoutRef.current).forEach(clearTimeout);
            }
        }
    }

    useEffect(() => {
        document.title = "DSA Self Prepare";
    }, []);

    useEffect(() => {
        window.api.listenProblemStream();

        const handler = (p: Problem) => {
            setProblems((prev) => {
                if (prev.find((x) => x.id === p.id)) return prev;

                setLoadingProblems(false);
                setGenerationPhase("normal");

                return [p, ...prev];
            });
        };

        window.api.onProblemGenerated(handler);

        return () => {
            window.api.removeProblemListener();
        };
    }, []); // ❗ no dependencies

    useEffect(() => {
        if (!profile) return;
        if (aiReady !== true) return;

        setProblems([]);
        setLoadingProblems(true);

        loadProblems();
    }, [profile, aiReady, mode]);

    /* -------------------- DAY + STREAK -------------------- */
    useEffect(() => {
        if (!profile) return;

        window.api.getUserProgress().then((data: any) => {
            setStreak(data.streak);
        });
    }, [profile, problems]);

    /* -------------------- OUTSIDE CLICK -------------------- */
    useEffect(() => {
        function handler(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-profile-menu]")) {
                setShowMenu(false);
            }
        }

        if (showMenu) {
            window.addEventListener("click", handler);
        }

        return () => window.removeEventListener("click", handler);
    }, [showMenu]);

    useEffect(() => {
        if (loadingProblems) {
            // lock scroll
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
        } else {
            // restore scroll
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
        };
    }, [loadingProblems]);

    /* -------------------- ACTIONS -------------------- */
    async function handleRegister() {
        try {
            if (!form.name || !form.email || !form.password) {
                showToast("Please fill all required fields.", "info");
                return;
            }

            if (form.password !== form.confirmPassword) {
                showToast("Passwords do not match.", "error");
                return;
            }

            const profile = await window.api.register({
                name: form.name,
                email: form.email,
                phone: form.phone,
                password: form.password,
            });

            if (!profile) {
                showToast(
                    "Registration failed. Email may already be registered.",
                    "error",
                );
                return;
            }

            showToast("Registration successful 🎉", "success");

            setProfile(profile);

            const ready = await isAIConfigured();
            setAIReady(ready);
        } catch (err: any) {
            // this catches DB unique constraint errors
            showToast(
                "This email is already registered. Please login instead.",
                "error",
            );
        }
    }

    async function handleLogin() {
        try {
            setAuthError(null);

            const profile = await window.api.login({
                email: login.email,
                password: login.password,
            });

            const day = deriveDayNumber(profile.createdOn);
            setDayNumber(day);

            if (!profile) {
                setAuthError("Invalid credentials. Please retry.");
                showToast("Please check your credentials", "error");
                return;
            }

            const ready = await isAIConfigured();

            setProfile(profile);
            setAIReady(ready);
        } catch (err) {
            setAuthError("User not found or invalid credentials");
            showToast("User not found or invalid credentials", "error");
        }
    }

    async function handleForgotPassword() {
        if (!forgotForm.email || !forgotForm.password) {
            showToast("Please fill all fields", "info");
            return;
        }

        if (forgotForm.password !== forgotForm.confirmPassword) {
            showToast("Passwords do not match", "error");
            return;
        }

        const ok = await window.api.resetPassword({
            email: forgotForm.email,
            password: forgotForm.password,
        });

        if (!ok) {
            showToast("Email not found", "error");
            return;
        }

        showToast("Password updated successfully", "success");

        setAuthView("login");
    }

    const handleLogout = () => {
        window.api.logout();
        localStorage.setItem("dsa-mode", "normal");
        setMode("normal");
        setProfile(null);
        setProblems([]);
        setActiveProblem(null);
        setShowMenu(false);
        setStreak(0);
        showToast("Logout Successfully", "success");
    };

    async function markSolved(id: number) {
        const res = await window.api.markProblemSolved(id);

        setProblems((prev) =>
            prev.map((p) => (p.id === id ? { ...p, solved: 1 } : p)),
        );

        setStreak(res.streak);
    }

    const filteredProblems = problems.filter((p) => {
        const solvedMatch =
            filterSolved === "all" ||
            (filterSolved === "solved" && p.solved) ||
            (filterSolved === "unsolved" && !p.solved);

        const difficultyMatch =
            filterDifficulty === "all" ||
            p.difficulty?.toLowerCase() === filterDifficulty;

        return solvedMatch && difficultyMatch;
    });

    const totalPages = Math.ceil(filteredProblems.length / pageSize);
    const paginatedProblems = filteredProblems.slice(
        (page - 1) * pageSize,
        page * pageSize,
    );

    /* ===================== Messages ===================== */

    const loaderMessages: Record<
        Mode,
        Record<
            typeof generationPhase,
            { title: string; desc: string; sub?: string; color: string }
        >
    > = {
        normal: {
            normal: {
                title: "Preparing today’s DSA challenges…",
                desc: "Preparing patterns that crack interviews",
                sub: "Arrays • Trees • DP • Graphs • Sliding Window • Recursion • Greedy",
                color: "text-indigo-400",
            },
            slow: {
                title: "Warming up your practice engine…",
                desc: "Loading the local AI model for smooth daily learning.",
                sub: "This happens only on first run.",
                color: "text-amber-400",
            },
            verySlow: {
                title: "Tuning problems for your learning journey",
                desc: "Adjusting difficulty and patterns for consistent growth.",
                sub: "Smaller models run faster on low-RAM systems.",
                color: "text-purple-400",
            },
            failed: {
                title: "Model too heavy for daily practice",
                desc: "Your current offline model may be slowing generation.",
                color: "text-red-400",
            },
        },

        interview: {
            normal: {
                title: "Preparing your interview challenge set…",
                desc: "Simulating real interview patterns and difficulty",
                sub: "Think like an interviewer • Solve like a candidate",
                color: "text-emerald-400",
            },
            slow: {
                title: "Setting up interview environment…",
                desc: "Loading model to generate realistic interview questions.",
                color: "text-amber-400",
            },
            verySlow: {
                title: "Calibrating pressure for interview mode",
                desc: "Generating problems that test depth, not memory.",
                sub: "Interview problems require more reasoning patterns.",
                color: "text-purple-400",
            },
            failed: {
                title: "Interview generation too heavy for this system",
                desc: "Switch to a lighter model for interview simulation.",
                color: "text-red-400",
            },
        },
    };

    const msg = loaderMessages[mode][generationPhase];

    const generationMessage = (() => {
        if (barCompleted) return "All problems generated 🎉";

        if (mode === "normal") return "Generating today’s problems. Please wait...";

        return "Preparing mock interview questions. Think fast ⚡";
    })();

    function restartApp() {
        // ✨ Show message for a moment, then restart
        setTimeout(() => {
            window.api.restartApp();
        }, 1400);
    }

    const shouldShowBar = showGenerationBar && isGenerating;

    const OwlLogo = () => (
        <div className="relative w-16 h-16 flex items-center justify-center">

            {/* Glow */}
            <div className="absolute inset-0 rounded-2xl bg-indigo-500/30 blur-xl" />

            {/* Logo Box */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">

                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">

                    <circle cx="9" cy="12" r="3" fill="white" className="owl-eye"/>
                    <circle cx="15" cy="12" r="3" fill="white" className="owl-eye"/>

                    <circle cx="9" cy="12" r="1.2" fill="#020617"/>
                    <circle cx="15" cy="12" r="1.2" fill="#020617"/>

                    <path
                        d="M10 16L12 18L14 16"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />

                </svg>

                {/* Scan line */}
                <div className="absolute inset-0 flex justify-center pointer-events-none">
                    <div className="w-10 h-[2px] bg-white/70 blur-sm scan-line" />
                </div>

            </div>
        </div>
    );

    /* =====================================================
         RENDER
      ===================================================== */
    return (
        <>
            {/* ================= FIRST TIME ================= */}
            {!profile ? (
                <div className="min-h-screen relative overflow-hidden flex items-center justify-center text-white">

                    {/* ================= CINEMATIC BACKGROUND ================= */}
                    <div className="absolute inset-0 bg-[#020617]" />

                    <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#020617] to-[#030712]" />


                    {/* ================= PARTICLE STARS ================= */}
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(40)].map((_, i) => (
                            <div
                                key={i}
                                className="star"
                                style={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 5}s`
                                }}
                            />
                        ))}
                    </div>


                    {/* ================= AMBIENT ORBS ================= */}
                    <div className="absolute inset-0 pointer-events-none">

                        <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem]
            bg-indigo-500/30 rounded-full blur-[100px]
            animate-float-slow" />

                        <div className="absolute bottom-1/4 right-1/4 w-[32rem] h-[32rem]
            bg-emerald-500/25 rounded-full blur-[110px]
            animate-float-reverse"
                             style={{ animationDelay: "2s" }} />

                        <div className="absolute top-1/3 right-1/3 w-[24rem] h-[24rem]
            bg-purple-500/20 rounded-full blur-[90px]
            animate-float-slow"
                             style={{ animationDelay: "4s" }} />

                    </div>


                    {/* ================= CENTER CARD ================= */}
                    <div className="
        relative z-10
        w-full max-w-md
        px-8 py-10
        rounded-3xl
        bg-white/10 backdrop-blur-2xl
        border border-white/20
        shadow-[0_40px_120px_rgba(0,0,0,0.85)]
    ">

                        {/* Glow ring */}
                        <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 blur-xl opacity-60" />

                        <div className="relative">

                            {/* ================= BRAND ================= */}
                            <div className="flex flex-col items-center text-center mb-8">

                                <OwlLogo />

                                <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                    <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent">
                        DSA Self Prepare
                    </span>
                                </h1>

                                {/* Typing tagline */}
                                <p className="text-gray-400 text-sm mt-3 max-w-xs typing">
                                    Your AI-powered system for mastering algorithms.
                                </p>

                            </div>


                            {/* ================= AUTH ================= */}
                            <div className="space-y-4">

                                {/* CHOICE */}
                                {authView === "choice" && (
                                    <>
                                        <button
                                            onClick={() => setAuthView("register")}
                                            className="
                                w-full py-3 rounded-xl
                                bg-gradient-to-r from-indigo-600 to-purple-600
                                hover:from-indigo-500 hover:to-purple-500
                                transition-all duration-300
                                shadow-lg shadow-indigo-500/30
                                hover:scale-[1.02]
                            "
                                        >
                                            Create Account →
                                        </button>

                                        <button
                                            onClick={() => setAuthView("login")}
                                            className="
                                w-full py-3 rounded-xl
                                bg-white/5 hover:bg-white/10
                                border border-white/10
                                transition-all duration-300
                            "
                                        >
                                            Login to Existing Account
                                        </button>
                                    </>
                                )}


                                {/* REGISTER */}
                                {authView === "register" && (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleRegister();
                                        }}
                                        className="space-y-4"
                                    >
                                        <input
                                            placeholder="Full name"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="input-ui"
                                        />

                                        <input
                                            placeholder="Email"
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            className="input-ui"
                                        />

                                        <input
                                            placeholder="Phone (optional)"
                                            value={form.phone}
                                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                            className="input-ui"
                                        />

                                        <input
                                            placeholder="Password"
                                            type="password"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="input-ui"
                                        />

                                        <input
                                            placeholder="Confirm password"
                                            type="password"
                                            value={form.confirmPassword}
                                            onChange={(e) =>
                                                setForm({ ...form, confirmPassword: e.target.value })
                                            }
                                            className="input-ui"
                                        />

                                        <button
                                            type="submit"
                                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            Register →
                                        </button>

                                        {/* Modern pill back */}
                                        <button
                                            type="button"
                                            onClick={() => setAuthView("choice")}
                                            className="
                                w-full py-2.5 rounded-xl
                                bg-white/5 border border-white/10
                                hover:bg-white/10
                                text-sm text-gray-300
                                transition-all duration-300
                            "
                                        >
                                            ← Back
                                        </button>
                                    </form>
                                )}


                                {/* LOGIN */}
                                {authView === "login" && (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleLogin();
                                        }}
                                        className="space-y-4"
                                    >
                                        <input
                                            placeholder="Email"
                                            type="email"
                                            value={login.email}
                                            onChange={(e) =>
                                                setLogin({ ...login, email: e.target.value })
                                            }
                                            className="input-ui"
                                        />

                                        <input
                                            placeholder="Password"
                                            type="password"
                                            value={login.password}
                                            onChange={(e) =>
                                                setLogin({ ...login, password: e.target.value })
                                            }
                                            className="input-ui"
                                        />

                                        <button
                                            type="submit"
                                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            Login →
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAuthView("forgot");
                                                setAuthError(null);
                                            }}
                                            className="w-full py-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-400/20"
                                        >
                                            Forgot Password
                                        </button>

                                        {authError && (
                                            <div className="text-red-400 text-sm">{authError}</div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAuthView("choice");
                                                setAuthError(null)}}
                                            className="
                                w-full py-2.5 rounded-xl
                                bg-white/5 border border-white/10
                                hover:bg-white/10
                                text-sm text-gray-300
                            "
                                        >
                                            ← Back
                                        </button>
                                    </form>
                                )}


                                {/* FORGOT */}
                                {authView === "forgot" && (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleForgotPassword();
                                        }}
                                        className="space-y-4"
                                    >
                                        <input
                                            placeholder="Registered Email"
                                            type="email"
                                            value={forgotForm.email}
                                            onChange={(e) =>
                                                setForgotForm({ ...forgotForm, email: e.target.value })
                                            }
                                            className="input-ui"
                                        />

                                        <input
                                            placeholder="New Password"
                                            type="password"
                                            value={forgotForm.password}
                                            onChange={(e) =>
                                                setForgotForm({ ...forgotForm, password: e.target.value })
                                            }
                                            className="input-ui"
                                        />

                                        <input
                                            placeholder="Confirm New Password"
                                            type="password"
                                            value={forgotForm.confirmPassword}
                                            onChange={(e) =>
                                                setForgotForm({
                                                    ...forgotForm,
                                                    confirmPassword: e.target.value,
                                                })
                                            }
                                            className="input-ui"
                                        />

                                        <button
                                            type="submit"
                                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            Reset Password →
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setAuthView("login")}
                                            className="
                                w-full py-2.5 rounded-xl
                                bg-white/5 border border-white/10
                                hover:bg-white/10
                                text-sm text-gray-300
                            "
                                        >
                                            ← Back to Login
                                        </button>
                                    </form>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            ) : aiReady ? (
                /* dashboard UI unchanged */
                <div className="min-h-screen app-bg app-bg-blur text-white relative">
                    <div className="app-content">
                        <div className="sticky top-0 z-40 overflow-visible">

                            {/* ================= HEADER ================= */}
                            <header className="relative">

                                {/* Glass Background + Scroll Shadow */}
                                <div
                                    className={`
                absolute inset-0 backdrop-blur-2xl border-b border-white/10
                transition-all duration-300
                ${scrolled
                                        ? "bg-black/70 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
                                        : "bg-black/40"}
            `}
                                />

                                <div className="relative max-w-7xl mx-auto px-10 py-5 flex items-center justify-between">

                                    {/* LEFT */}
                                    <div className="flex items-center gap-6">

                                        <div>
                                            <div className="flex flex-col leading-tight">

                                                {/* Main Title */}
                                                <div className="flex items-center gap-3">

                                                    <h1
                                                        className="
                                            text-2xl font-semibold tracking-tight
                                            bg-gradient-to-r
                                            from-indigo-300 via-purple-300 to-indigo-400
                                            bg-clip-text text-transparent
                                            drop-shadow-[0_0_18px_rgba(99,102,241,0.35)]
                                            select-none
                                        "
                                                    >
                                                        DSA Self Prepare
                                                    </h1>

                                                    {/* AI Badge */}
                                                    <span className="
                                                        text-[10px] px-2 py-0.5 rounded-md
                                                        bg-indigo-500/15 text-indigo-300
                                                        border border-indigo-500/20
                                                        tracking-wider uppercase
                                                    ">
                                                        AI Powered
                                                    </span>

                                                </div>

                                                {/* Subtitle */}
                                                <p className="text-xs text-gray-500 mt-0.5 tracking-wide">
                                                    Intelligent Algorithm Practice Platform
                                                </p>

                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">

                                                <span>Day {dayNumber}</span>

                                                <span className="opacity-40">•</span>

                                                <span className="flex items-center gap-1">
                            🔥 {streak} streak
                        </span>

                                                <span className="opacity-40">•</span>

                                                {/* Mode Badge */}
                                                <span className={`
                            px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider
                            ${mode === "normal"
                                                    ? "bg-indigo-500/20 text-indigo-300"
                                                    : "bg-emerald-500/20 text-emerald-300"}
                        `}>
                            {mode === "normal" ? "Normal Practice" : "Interview Mode"}
                        </span>

                                                {/* AI READY BADGE */}
                                                <span className="
                            flex items-center gap-1
                            px-2 py-0.5 rounded-md
                            bg-emerald-500/10 text-emerald-400
                            border border-emerald-500/20
                        ">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            AI Ready
                        </span>

                                            </div>
                                        </div>

                                    </div>


                                    {/* RIGHT ACTIONS */}
                                    <div className="flex items-center gap-4">

                                        {/* ================= MODE TOGGLE SWITCH ================= */}
                                        <button
                                            onClick={() => {
                                                if (mode === "normal") setShowInterviewModal(true);
                                                else toggleMode();
                                            }}
                                            disabled={loading}
                                            className={`
                        relative flex items-center gap-3 px-4 py-2 rounded-xl
                        bg-white/5 border border-white/10
                        hover:bg-white/10
                        transition-all duration-300
                        shadow-lg shadow-black/30
                        ${loading ? "opacity-40 cursor-not-allowed" : ""}
                    `}
                                        >

                                            {/* Toggle Track */}
                                            <div className={`
                        w-10 h-5 rounded-full relative
                        transition-colors duration-300
                        ${mode === "normal"
                                                ? "bg-indigo-500/40"
                                                : "bg-emerald-500/40"}
                    `}>

                                                {/* Toggle Knob */}
                                                <div
                                                    className={`
                                absolute top-0.5 w-4 h-4 rounded-full bg-white
                                transition-all duration-300
                                ${mode === "normal"
                                                        ? "left-0.5"
                                                        : "left-5"}
                            `}
                                                />
                                            </div>

                                            <span className="text-sm">
                        {mode === "normal" ? "Interview" : "Normal"}
                    </span>

                                        </button>


                                        {/* REFRESH */}
                                        <button
                                            onClick={() => loadProblems()}
                                            disabled={loading}
                                            className={`
                        flex items-center gap-2 px-4 py-2 rounded-xl
                        bg-white/5 border border-white/10
                        hover:bg-white/10
                        transition-all duration-300
                        shadow-lg shadow-black/30
                        hover:shadow-emerald-500/20
                        ${loading ? "opacity-40 cursor-not-allowed" : ""}
                                        `}
                                        >
                                            <ArrowPathIcon className="w-4 h-4 text-emerald-400" />
                                            <span className="text-sm">
                        {loading ? "Refreshing…" : "Refresh"}
                    </span>
                                        </button>


                                        {/* ================= PROFILE ================= */}
                                        <div className="relative z-50" data-profile-menu>

                                            <button
                                                onClick={() => setShowMenu(v => !v)}
                                                className="
                            flex items-center gap-3 px-4 py-2
                            rounded-2xl bg-white/5 border border-white/10
                            hover:bg-white/10
                            transition-all duration-300
                            shadow-lg shadow-black/30
                            hover:shadow-indigo-500/20
                        "
                                            >

                                                <div className="text-right leading-tight">
                                                    <p className="text-sm font-medium text-white">
                                                        {profile.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {profile.email}
                                                    </p>
                                                </div>

                                                {/* Avatar with Status */}
                                                <div className="
                            relative w-10 h-10 rounded-full
                            flex items-center justify-center
                            bg-gradient-to-br from-indigo-500/40 to-purple-500/40
                            border border-white/10
                            text-white font-semibold
                        ">
                                                    {profile.name?.[0]?.toUpperCase()}

                                                    {/* Glow */}
                                                    <div className="absolute inset-0 rounded-full blur-md bg-indigo-500/20" />

                                                    {/* Status Dot */}
                                                    <div className="
                                absolute bottom-0 right-0
                                w-3 h-3 rounded-full bg-emerald-400
                                border-2 border-black
                                animate-pulse
                            " />
                                                </div>
                                            </button>


                                            {/* DROPDOWN */}
                                            {showMenu && (
                                                <div className="
    absolute right-0 mt-3 w-64
    z-[9999]
    bg-[#0B1220]/95 backdrop-blur-2xl
    border border-white/10
    rounded-2xl
    shadow-[0_20px_80px_rgba(0,0,0,0.7)]
    overflow-hidden animate-scaleIn
">

                                                    <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                                                        <UserCircleIcon className="w-8 h-8 text-indigo-400" />
                                                        <div>
                                                            <p className="text-sm font-medium text-white">
                                                                {profile.name}
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                {profile.email}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="py-2">

                                                        <button
                                                            onClick={() => setShowEditProfile(true)}
                                                            disabled={loading}
                                                            className={`
                                                            flex items-center gap-3 w-full px-5 py-3 text-sm hover:bg-white/10
                                                            ${loading ? "opacity-40 cursor-not-allowed" : ""}`}
                                                        >
                                                            <PencilSquareIcon className="w-5 h-5 text-indigo-400" />
                                                            Edit Profile
                                                        </button>

                                                        <button
                                                            onClick={() => setShowAnalytics(true)}
                                                            disabled={loading}
                                                            className={`
                                                            flex items-center gap-3 w-full px-5 py-3 text-sm hover:bg-white/10
                                                            ${loading ? "opacity-40 cursor-not-allowed" : ""}`}
                                                        >
                                                            <ChartBarIcon className="w-5 h-5 text-emerald-400" />
                                                            My Progress
                                                        </button>

                                                        <div className="my-2 border-t border-white/10" />

                                                        <button
                                                            onClick={handleLogout}
                                                            className="flex items-center gap-3 w-full px-5 py-3 text-sm text-red-400 hover:bg-red-500/10"
                                                        >
                                                            <PowerIcon className="w-5 h-5" />
                                                            Logout
                                                        </button>

                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </header>


                            {/* ================= PROGRESS BAR ================= */}
                            <div
                                className={`
        relative z-30
        overflow-hidden transition-all duration-500
        ${shouldShowBar ? "max-h-32 opacity-100" : "max-h-0 opacity-0"}
    `}
                            >
                                <div className="bg-black/50 backdrop-blur-xl border-b border-white/5">

                                    <div className="max-w-7xl mx-auto px-10 py-4">

                                        {/* Top Row */}
                                        <div className="flex justify-between items-center mb-2">

                                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                                <SparklesIcon className="w-4 h-4 text-indigo-400" />
                                                {generationMessage}

                                                {/* ETA */}
                                                {etaSeconds !== null && (
                                                    <span className="text-xs text-gray-400 ml-2">
                                • ~{etaSeconds}s remaining
                            </span>
                                                )}
                                            </div>

                                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                                                <span>{generatedNow}</span>
                                                <span className="text-gray-400">/ {generationLimit}</span>

                                                {generatedNow === generationLimit && (
                                                    <span className="text-emerald-400 text-xs">
                                ✓ Complete
                            </span>
                                                )}
                                            </div>
                                        </div>


                                        {/* Track */}
                                        <div className="relative w-full h-3 rounded-full bg-white/10 overflow-hidden shadow-inner">

                                            <div className="absolute inset-0 animate-gradient-flow
                        bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500
                        opacity-20"
                                            />

                                            <div
                                                className={`
                            relative h-full rounded-full
                            transition-[width] duration-700 ease-out
                            ${mode === "normal"
                                                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400"
                                                    : "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400"}
                            ${barCompleted ? "animate-finish-pop" : ""}
                            shadow-[0_0_25px_rgba(99,102,241,0.7)]
                        `}
                                                style={{ width: `${generationPercent}%` }}
                                            />

                                            {!barCompleted && (
                                                <div className="absolute top-0 left-0 h-full w-40
                            bg-white/50 blur-md opacity-40
                            animate-shine-sweep pointer-events-none"
                                                />
                                            )}

                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                        <main
                            className={`
                                    max-w-7xl mx-auto px-10 py-10
                                    transition-all duration-700 ease-in-out
                                    ${filtersOpen ? "pb-[220px]" : "pb-32"}
                                  `}
                        >
                            {generationError ? (
                                /* ================= ERROR RECOVERY UI ================= */
                                <div className="flex flex-col items-center justify-center py-40 text-center space-y-6">
                                    <div
                                        className="w-24 h-24 rounded-full bg-red-500/10
                            flex items-center justify-center
                            border border-red-500/20"
                                    >
                                        <span className="text-5xl">⚠️</span>
                                    </div>

                                    <h2 className="text-2xl font-semibold text-red-400">
                                        Unable to generate today’s problems
                                    </h2>

                                    <p className="text-gray-400 max-w-xl">
                                        Something went wrong while preparing your problems. This
                                        usually happens when the AI engine fails to respond or the
                                        model is too heavy for this system.
                                    </p>

                                    <div className="flex gap-4 mt-4">
                                        <button
                                            onClick={restartApp}
                                            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            🔄 Restart Application
                                        </button>

                                        <button
                                            onClick={() => setShowAISetup(true)}
                                            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                                        >
                                            Change AI Model
                                        </button>
                                    </div>

                                    {generationError && quotaError && (
                                        <div>
                                            <h2>API Quota Exhausted</h2>
                                            <button onClick={() => setShowAISetup(true)}>
                                                Update API Key
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-500 mt-4">
                                        If this keeps happening, try switching to a smaller model or
                                        contact Developer Support.
                                    </p>
                                </div>
                            ) : loadingProblems ? (
                                /* ================= EXISTING LOADER ================= */
                                <div className="flex flex-col items-center justify-center py-32">
                                    <div
                                        className={`w-20 h-20 border-4 rounded-full pointer-events-none select-none animate-spin mb-10
                ${
                                            mode === "normal"
                                                ? "border-indigo-500/30 border-t-indigo-500"
                                                : "border-emerald-500/30 border-t-emerald-500"
                                        }`}
                                    />

                                    <div className="loader-animated text-center space-y-4">
                                        <h2 className={`text-2xl font-semibold ${msg.color}`}>
                                            {msg.title}
                                        </h2>

                                        <p className="text-gray-400">{msg.desc}</p>

                                        {msg.sub && (
                                            <p className="text-gray-500 text-sm">{msg.sub}</p>
                                        )}

                                        {generationPhase === "failed" && (
                                            <div className="flex justify-center gap-4 mt-4">
                                                <button
                                                    onClick={() => {
                                                        setShowAISetup(true);
                                                        setLoading(false);
                                                        setLoadingProblems(false);
                                                        setGenerationPhase("normal");
                                                    }}
                                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                                                >
                                                    Change AI Model
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* ================= HEADER ================= */}
                                    <div className="flex items-center justify-between mb-6">

                                        <p className="text-gray-400 text-sm">
                                            Progress:{" "}
                                            <span className="text-white font-semibold">
                {solvedCount}
            </span>{" "}
                                            / {problems.length} solved
                                        </p>

                                        {/* Progress Badge */}
                                        <div className="
            px-3 py-1 rounded-lg text-xs
            bg-indigo-500/10 text-indigo-300
            border border-indigo-500/20
            flex items-center gap-1
        ">
                                            <SparklesIcon className="w-4 h-4" />
                                            Daily Practice
                                        </div>

                                    </div>


                                    {/* ================= GRID ================= */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">

                                        {paginatedProblems.map((p) => {

                                            const solved = Boolean(p.solved);

                                            const difficultyColor =
                                                p.difficulty?.toLowerCase() === "easy"
                                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                                    : p.difficulty?.toLowerCase() === "medium"
                                                        ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                                                        : "text-red-400 bg-red-500/10 border-red-500/20";

                                            return (
                                                <div
                                                    key={p.id}
                                                    className={`
                        relative group
                        rounded-2xl p-6
                        bg-white/5 backdrop-blur-xl
                        border border-white/10
                        transition-all duration-300
                        hover:bg-white/10
                        hover:border-indigo-400/30
                        shadow-lg shadow-black/30
                        hover:shadow-indigo-500/10
                    `}
                                                >

                                                    {/* Glow */}
                                                    <div className="
                        absolute inset-0 rounded-2xl
                        opacity-0 group-hover:opacity-100
                        transition
                        bg-indigo-500/5
                        pointer-events-none
                    " />


                                                    {/* ================= TOP META ================= */}
                                                    <div className="flex items-center justify-between mb-4">

                                                        {/* Pattern */}
                                                        <div className="
                            flex items-center gap-2
                            text-xs text-indigo-300
                            bg-indigo-500/10
                            border border-indigo-500/20
                            px-2.5 py-1 rounded-md
                        ">
                                                            <CodeBracketIcon className="w-3.5 h-3.5" />
                                                            {p.pattern || "Pattern"}
                                                        </div>

                                                        {/* Difficulty */}
                                                        <div className={`
                            text-[11px] px-2.5 py-1 rounded-md border
                            ${difficultyColor}
                        `}>
                                                            {p.difficulty || "Mixed"}
                                                        </div>

                                                    </div>


                                                    {/* ================= TITLE ================= */}
                                                    <h3 className="
                        text-lg font-semibold mb-6
                        text-white leading-snug
                        min-h-[56px]
                    ">
                                                        {p.title || "DSA Practice Problem"}
                                                    </h3>


                                                    {/* ================= SOLVED BADGE ================= */}
                                                    {solved && (
                                                        <div className="
                            absolute top-1 right-4
                            flex items-center gap-1
                            text-emerald-400 text-xs
                        ">
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                            Solved
                                                        </div>
                                                    )}


                                                    {/* ================= ACTIONS ================= */}
                                                    <div className="flex gap-3">

                                                        {/* Solve Button */}
                                                        <button
                                                            onClick={() => {
                                                                setActiveProblem(p);}}
                                                            className="
                                flex-1 flex items-center justify-center gap-2
                                py-3 rounded-xl
                                bg-gradient-to-r from-indigo-600 to-indigo-500
                                hover:from-indigo-500 hover:to-indigo-400
                                transition-all duration-300
                                shadow-lg shadow-indigo-900/40
                                hover:shadow-indigo-500/30
                                text-sm font-medium
                            "
                                                        >
                                                            <PlayIcon className="w-4 h-4" />
                                                            Solve
                                                        </button>


                                                        {/* Mark Solved */}
                                                        {p.id !== undefined && !solved && (
                                                            <button
                                                                onClick={() => markSolved(p.id)}
                                                                className="
                                    px-4 py-3 rounded-xl
                                    bg-emerald-600 hover:bg-emerald-500
                                    transition-all duration-300
                                    shadow-lg shadow-emerald-900/30
                                    hover:shadow-emerald-500/30
                                "
                                                            >
                                                                <CheckCircleIcon className="w-5 h-5" />
                                                            </button>
                                                        )}

                                                    </div>

                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </main>
                        {/* ================= BOTTOM GLASS CONTROLS (FIXED) ================= */}
                        {!loadingProblems && !generationError && (
                            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl transition-all duration-700">
                                {/* TOP ROW — SAME GRID FOR BOTH */}
                                <div
                                    className={`
    grid gap-6 transition-all duration-500
    ${totalPages > 1 ? "grid-cols-2" : "grid-cols-1 place-items-center"}
  `}
                                >
                                    {/* Utility Toggle */}
                                    <div
                                        onClick={() => setFiltersOpen((v) => !v)}
                                        className="
        glass-panel cursor-pointer
        px-6 py-3 rounded-2xl
        text-sm tracking-wide text-gray-300
        flex items-center justify-center
        transition-all duration-500
        hover:bg-white/10
      "
                                    >
                                        ✦ Filters & Utilities
                                    </div>

                                    {/* Pagination Capsule (same size box) */}
                                    {totalPages > 1 && (
                                        <div
                                            className="
        glass-panel px-6 py-3 rounded-2xl
        flex items-center justify-center gap-6
        transition-all duration-500
      "
                                        >
                                            <button
                                                onClick={() => {
                                                    setPage((p) => Math.max(p - 1, 1));
                                                    setPageDirection("left");
                                                }}
                                                disabled={page === 1}
                                                className="filter-pill w-9 h-9 rounded-lg bg-white/5"
                                            >
                                                ◀
                                            </button>

                                            <div className="relative w-16 h-6 overflow-hidden">
                                                <div
                                                    key={page}
                                                    className={`
                                                      absolute inset-0 flex items-center justify-center
                                                      transition-all duration-500
                                                      ${pageDirection === "right" ? "animate-slide-left" : ""}
                                                      ${pageDirection === "left" ? "animate-slide-right" : ""}
                                                    `}
                                                    onAnimationEnd={() => setPageDirection(null)}
                                                >
                          <span className="text-sm text-gray-300">
                            {page} / {totalPages}
                          </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setPage((p) => Math.min(p + 1, totalPages));
                                                    setPageDirection("right");
                                                }}
                                                disabled={page === totalPages}
                                                className="filter-pill w-9 h-9 rounded-lg bg-white/5"
                                            >
                                                ▶
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* SLIDING PANEL BELOW (pushes layout, no overlap) */}
                                <div
                                    className={`
      overflow-hidden transition-all duration-700 ease-in-out
      ${filtersOpen ? "max-h-[400px] opacity-100 mt-4" : "max-h-0 opacity-0"}
    `}
                                >
                                    <div className="glass-panel glass-glow rounded-3xl px-10 py-8">
                                        <div className="flex flex-wrap items-center justify-between gap-10">
                                            {/* Page Size */}
                                            <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 uppercase tracking-widest">
                          Page
                        </span>
                                                {[9, 18, 27].map((size) => (
                                                    <button
                                                        key={size}
                                                        onClick={() => {
                                                            setPageSize(size);
                                                            setPage(1);
                                                        }}
                                                        className={`filter-pill px-5 py-2 rounded-xl text-sm
                ${pageSize === size ? "filter-active" : "bg-white/5 text-gray-400"}
              `}
                                                    >
                                                        {size}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Solved */}
                                            <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 uppercase tracking-widest">
                          Solved
                        </span>
                                                {["all", "solved", "unsolved"].map((v) => (
                                                    <button
                                                        key={v}
                                                        onClick={() => {
                                                            setFilterSolved(v as any);
                                                            setPage(1);
                                                        }}
                                                        className={`filter-pill px-5 py-2 rounded-xl text-sm capitalize
                ${filterSolved === v ? "filter-active" : "bg-white/5 text-gray-400"}
              `}
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Difficulty */}
                                            <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 uppercase tracking-widest">
                          Difficulty
                        </span>
                                                {["all", "easy", "medium", "hard"].map((v) => (
                                                    <button
                                                        key={v}
                                                        onClick={() => {
                                                            setFilterDifficulty(v as any);
                                                            setPage(1);
                                                        }}
                                                        className={`filter-pill px-5 py-2 rounded-xl text-sm capitalize
                ${filterDifficulty === v ? "filter-active" : "bg-white/5 text-gray-400"}
              `}
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    {profile && aiReady === false && (
                        <AISetupModal
                            onDone={() => {
                                setAIReady(true);
                                // loadProblems();
                            }}
                            onBackToRegister={() => {
                                setProfile(null);
                            }}
                        />
                    )}
                </div>
            )}
            {activeProblem && (
                <SolveModal
                    problem={activeProblem}
                    solved={Boolean(activeProblem.solved)}
                    userId={String(profile?.id)}
                    onClose={(shouldRefresh) => {
                        setActiveProblem(null);

                        if (shouldRefresh) {
                            loadProblems();
                        }
                    }}
                />
            )}
            {editProfile && profile && (
                <EditProfileModal
                    profile={profile}
                    onClose={() => setShowEditProfile(false)}
                    onOpenAISetup={() => setShowAISetup(true)}
                />
            )}
            {showInterviewModal && (
                <InterviewSetupModal
                    onSave={() => {
                        setShowInterviewModal(false);
                        toggleMode(); // now switch
                    }}
                    onCancel={() => setShowInterviewModal(false)}
                />
            )}
            {showAISetup && (
                <AISetupModal
                    onDone={() => {
                        setShowAISetup(false);
                        setAIReady(true);
                    }}
                    onBackToRegister={() => {
                        setShowAISetup(false);
                    }}
                />
            )}
            <Suspense
                fallback={
                    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-xl">
                        <div
                            className="
                glass-panel glass-glow
                rounded-3xl px-10 py-8
                flex flex-col items-center gap-6
                animate-fadeIn
                border border-white/10
            "
                        >
                            {/* Spinner */}
                            <div className="relative w-14 h-14">
                                <div
                                    className="
                        absolute inset-0 rounded-full
                        border-2 border-indigo-500/30
                    "
                                />

                                <div
                                    className="
                        absolute inset-0 rounded-full
                        border-2 border-transparent
                        border-t-indigo-500
                        border-r-purple-500
                        animate-spin
                    "
                                />
                            </div>

                            {/* Text */}
                            <div className="text-center space-y-2">
                                <p className="text-indigo-300 font-semibold text-lg">
                                    Analyzing your practice patterns with AI...
                                </p>

                                <p className="text-gray-400 text-sm">
                                    Preparing your progress insights...
                                </p>
                            </div>

                            {/* Animated progress shimmer */}
                            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="
                        h-full w-1/2
                        bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
                        animate-gradient-flow
                    "
                                />
                            </div>
                        </div>
                    </div>
                }
            >
                {showAnalytics && (
                    <AnalyticsModal onClose={() => setShowAnalytics(false)} />
                )}
            </Suspense>
        </>
    );
}
