const KNOWN_PATNS_RAW = require("../services/worker/patterns")
const KNOWN_PATTERNS = KNOWN_PATNS_RAW.map(p => p.pattern);

function normalizeWord(word) {
    if (!word) return "";
    word = String(word).trim().toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizeTitleCase(text) {
    if (!text) return "";
    return String(text)
        .split(/\s+/)
        .map(normalizeWord)
        .join(" ");
}

function refineDifficulty(difficulty) {
    if (!difficulty) return "Easy";

    const text = String(difficulty).toLowerCase();

    if (text.includes("easy")) return "Easy";
    if (text.includes("medium")) return "Medium";
    if (text.includes("hard")) return "Hard";

    return "Easy";
}

function refinePattern(pattern) {
    if (!pattern) return "Arrays";

    let text = String(pattern).trim();

    // 1️⃣ Cut anything after ---
    if (text.includes("---")) {
        text = text.split("---")[0];
    }

    // 2️⃣ Cut anything after colon
    if (text.includes(":")) {
        text = text.split(":")[0];
    }

    // 3️⃣ Remove difficulty words accidentally included
    text = text.replace(/\b(easy|medium|hard)\b/gi, "");

    // 4️⃣ Remove words like "Problem 2"
    text = text.replace(/problem\s*\d*/gi, "");

    // 5️⃣ Clean extra symbols
    text = text.replace(/[()]/g, "").trim();

    // 6️⃣ Normalize Title Case
    text = normalizeTitleCase(text);

    // 🔥 STRICT VALIDATION AGAINST YOUR PATTERN LIST
    const matched = KNOWN_PATTERNS.find(
        p => text.toLowerCase().includes(p.toLowerCase())
    );

    if (!matched) {
        return "Arrays"; // default fallback
    }

    return matched; // return exact canonical value
}

module.exports = {
    normalizeWord,
    normalizeTitleCase,
    refineDifficulty,
    refinePattern
}