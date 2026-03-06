import { useEffect, useState } from "react";
import GlassDropdown from "../../components/GlassDropdown.tsx";
import PatternMultiSelect from "@/components/PatternMultiSelect.tsx";
import { createPortal } from "react-dom";

type Props = {
    profile: {
        id: number;
        name: string;
        email: string;
        phone?: string;
    };
    onClose: () => void;
    onOpenAISetup: () => void;
};

function arraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const s1 = [...a].sort().join(",");
    const s2 = [...b].sort().join(",");
    return s1 === s2;
}

export default function EditProfileModal({ profile, onClose, onOpenAISetup }: Props) {
    const [saving, setSaving] = useState(false);

    /* ================= USER INFO ================= */
    const [name, setName] = useState(profile.name);
    const [phone, setPhone] = useState(profile.phone || "");
    const [original, setOriginal] = useState<any>(null);

    /* ================= NORMAL MODE ================= */
    const [dailyCount, setDailyCount] = useState(3);
    const [dailyDifficulty, setDailyDifficulty] = useState("mixed");
    const [dailyPatterns, setDailyPatterns] = useState<string[]>([]);

    /* ================= PASSWORD ================= */
    const [showPasswordBox, setShowPasswordBox] = useState(false);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");

    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"success" | "error" | null>(null);

    useEffect(() => {
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "auto";
        };
    }, []);

    useEffect(() => {
        async function load() {
            const data = await window.api.getUserPreferences();

            if (!data) return;

            /* ===== user table ===== */
            setName(data.name || "");
            setPhone(data.phone || "");

            /* ===== preferences ===== */
            setDailyCount(data.daily_problem_count ?? 3);
            setDailyDifficulty(data.daily_difficulty ?? "mixed");
            setDailyPatterns(
                data.daily_patterns
                    ? JSON.parse(data.daily_patterns)
                    : []
            );

            // 🔥 STORE ORIGINAL SNAPSHOT
            setOriginal({
                name: data.name || "",
                phone: data.phone || "",
                dailyCount: data.daily_problem_count ?? 3,
                dailyDifficulty: data.daily_difficulty ?? "mixed",
                dailyPatterns: data.daily_patterns
                    ? JSON.parse(data.daily_patterns)
                    : []
            });
        }
        load();
    }, []);

    async function save() {
        if (original) {
            const nothingChanged =
                name === original.name &&
                phone === original.phone &&
                dailyCount === original.dailyCount &&
                dailyDifficulty === original.dailyDifficulty &&
                arraysEqual(dailyPatterns, original.dailyPatterns) &&
                !oldPassword && !newPassword && !confirmNewPassword;

            if (nothingChanged) {
                setStatusMsg("Nothing changed");
                setStatusType("success");

                setTimeout(() => {
                    onClose();   // close modal
                }, 800);

                return;
            }
        }

        setStatusMsg(null);
        setStatusType(null);

        // 👉 Only validate if user is trying to change password
        if (showPasswordBox && (oldPassword || newPassword || confirmNewPassword)) {

            if (!oldPassword) {
                setStatusMsg("Please enter your current password");
                setStatusType("error");
                return;
            }

            if (newPassword.length < 4) {
                setStatusMsg("New password must be at least 4 characters");
                setStatusType("error");
                return;
            }

            if (newPassword !== confirmNewPassword) {
                setStatusMsg("New passwords do not match");
                setStatusType("error");
                return;
            }
        }

        try {
            setSaving(true);

            await window.api.updateUserPreferences({
                name,
                phone,
                daily_problem_count: dailyCount,
                daily_difficulty: dailyDifficulty,
                daily_patterns: JSON.stringify(dailyPatterns),

                newPassword: newPassword || null
            });

            setStatusMsg("Changes saved. Restarting app…");
            setStatusType("success");

            // ✨ Show message for a moment, then restart
            setTimeout(() => {
                window.api.restartApp();
            }, 1400);

        } catch (err: any) {
            setStatusMsg(err?.message || "Failed to save changes");
            setStatusType("error");
        } finally {
            setSaving(false);
        }
    }

    return createPortal(
        <div
            className="
        modal-root app-bg
        flex items-center justify-center p-6
        overflow-hidden

        transform-gpu translate-z-0
        will-change-transform
        [contain:layout_paint]
        backface-hidden
    "
        >
            <div
                className="
            absolute inset-0
            bg-black/70 backdrop-blur-xl

            transform-gpu translate-z-0
            will-change-transform
        "
            />

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
                className="
            relative z-10
            w-full max-w-5xl
            bg-[#0F172A]/80 backdrop-blur-xl
            border border-white/10
            rounded-3xl
            shadow-[0_60px_200px_rgba(0,0,0,0.9)]

            flex flex-col
            max-h-[94vh]
            overflow-hidden

            transform-gpu translate-z-0
            will-change-transform
            [contain:layout_paint]
            backface-hidden
        "
            >
                {/* ===== Header ===== */}
                <div
                    className="
                px-12 py-8 border-b border-white/10
                transform-gpu translate-z-0
            "
                >
                    <h2 className="text-3xl font-semibold tracking-wide text-white">
                        Profile & Practice Preferences
                    </h2>
                    <p className="text-gray-400 text-sm mt-2">
                        Customize how DSA Self Prepare works for you
                    </p>
                </div>

                {/* ===== Scroll Body ===== */}
                <div
                    className="
                overflow-y-auto overscroll-contain
                px-12 py-10 space-y-12

                transform-gpu translate-z-0
                will-change-scroll-position
            "
                >

                    {/* USER INFO */}
                    <section className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-indigo-400 font-medium text-lg">User Information</h3>

                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Full Name"
                                className="input-ui"
                            />

                            <input
                                value={profile.email}
                                disabled
                                className="input-ui opacity-50 cursor-not-allowed"
                            />

                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="Phone Number"
                                className="input-ui"
                            />
                        </div>

                        {/* PASSWORD */}
                        <div className="space-y-4">
                            <h3 className="text-rose-400 font-medium text-lg">Security</h3>

                            {!showPasswordBox ? (
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordBox(true)}
                                    className="text-sm text-indigo-400 hover:text-indigo-300 transition underline"
                                >
                                    Change Password
                                </button>
                            ) : (
                                <div
                                    className="
                                bg-white/5 border border-white/10
                                rounded-2xl p-5 space-y-3
                                animate-fadeIn

                                transform-gpu translate-z-0
                            "
                                >
                                    <input
                                        type="password"
                                        placeholder="Current password"
                                        value={oldPassword}
                                        onChange={e => setOldPassword(e.target.value)}
                                        className="input-ui"
                                    />

                                    <input
                                        type="password"
                                        placeholder="New password"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="input-ui"
                                    />

                                    <input
                                        type="password"
                                        placeholder="Confirm new password"
                                        value={confirmNewPassword}
                                        onChange={e => setConfirmNewPassword(e.target.value)}
                                        className={`input-ui ${
                                            confirmNewPassword && newPassword !== confirmNewPassword
                                                ? "border-red-500"
                                                : ""
                                        }`}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordBox(false)}
                                        className="text-xs text-gray-400 hover:text-white"
                                    >
                                        Cancel password change
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* PRACTICE SETTINGS */}
                    <section className="space-y-6">
                        <h3 className="text-indigo-400 font-medium text-lg">
                            Normal Practice Configuration
                        </h3>

                        <div className="grid grid-cols-3 gap-6">
                            <GlassDropdown
                                value={dailyCount}
                                onChange={setDailyCount}
                                options={[3, 5, 8, 10].map(n => ({
                                    label: `${n} problems per day`,
                                    value: n
                                }))}
                            />

                            <GlassDropdown
                                value={dailyDifficulty}
                                onChange={setDailyDifficulty}
                                options={[
                                    { label: "Easy", value: "easy" },
                                    { label: "Medium", value: "medium" },
                                    { label: "Hard", value: "hard" },
                                    { label: "Mixed", value: "mixed" }
                                ]}
                            />
                        </div>

                        <div>
                            <p className="text-sm text-gray-400 mb-3">
                                Preferred Patterns (multi-select)
                            </p>
                            <PatternMultiSelect
                                value={dailyPatterns}
                                onChange={setDailyPatterns}
                            />
                        </div>
                    </section>

                    {/* AI SETTINGS */}
                    <section className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6">
                        <h3 className="text-indigo-400 font-semibold mb-2">
                            AI Model Settings
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Change AI provider, API keys, or switch local models anytime.
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                setTimeout(() => onOpenAISetup(), 300);
                            }}
                            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition"
                        >
                            Open AI Settings →
                        </button>
                    </section>
                </div>

                {/* ===== Footer ===== */}
                <div
                    className="
                px-12 py-6 border-t border-white/10
                bg-black/40 backdrop-blur-xl
                flex gap-6

                transform-gpu translate-z-0
            "
                >
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-medium transition"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition"
                    >
                        Cancel
                    </button>
                </div>

                {/* STATUS */}
                {statusMsg && (
                    <div
                        className={`absolute bottom-24 left-1/2 -translate-x-1/2 px-6 py-2 rounded-xl text-sm border
                ${
                            statusType === "success"
                                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                : "text-red-400 bg-red-500/10 border-red-500/20"
                        }`}
                    >
                        {statusMsg}
                    </div>
                )}
            </form>
        </div>,
        document.getElementById("modal-root")!
    );
}
