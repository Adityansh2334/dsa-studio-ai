const dayjs = require("dayjs");
const db = require("../database/database");

/* ======================================================
   USER DAY TRACKING
====================================================== */

function getStartDate() {
    let start = global.localStorage?.getItem("dsa-start-date");

    if (!start) {
        start = dayjs().format("YYYY-MM-DD");
        global.localStorage?.setItem("dsa-start-date", start);
    }

    return start;
}

function getDayNumber() {
    const start = getStartDate();
    return dayjs().diff(dayjs(start), "day") + 1;
}

/* ======================================================
   ADAPTIVE FALLBACK (AUTO-EASE)
====================================================== */

/**
 * @param {number} userId - The ID of the current user
 */
async function shouldAutoEase(userId) {
    const threeDaysAgo = dayjs().subtract(3, "day").format("YYYY-MM-DD");

    try {
        // Query to count unsolved problems in the last 3 days
        const result = db.prepare(`
            SELECT COUNT(*) as failureCount 
            FROM problems 
            WHERE user_id = ? 
            AND solved = 0 
            AND date >= ?
        `).get(userId, threeDaysAgo);

        // Return true if 2 or more failures are found
        return result.failureCount >= 2;
    } catch (error) {
        console.error("Failed to compute auto-ease:", error);
        return false; // Default to normal difficulty on error
    }
}

/* ======================================================
   CORE DIFFICULTY STRATEGY (BEGINNER → PRO)
====================================================== */
/**
 * @param {number} userId - ID of the user
 * @param {number} limitCount - How many problems to generate
 * @param {string} userPref - From pref.daily_difficulty ('easy', 'medium', 'hard', 'mixed')
 */
async function getDailyDifficulties(userId, limitCount, userPref = 'mixed') {
    let result = [];

    // 1. HANDLE SPECIFIC OVERRIDES (Easy, Medium, Hard)
    if (userPref !== 'mixed') {
        // Capitalize the first letter to match your requirement (e.g., 'easy' -> 'Easy')
        const difficultyLabel = userPref.charAt(0).toUpperCase() + userPref.slice(1);

        // Fill the array entirely with the chosen preference
        result = Array(limitCount).fill(difficultyLabel);
        return result;
    }

    // 2. HANDLE 'MIXED' PREFERENCE (Adaptive Logic)
    const day = getDayNumber();
    const needsEase = await shouldAutoEase(userId);

    let basePool = [];

    if (needsEase) {
        basePool = ["Easy", "Easy", "Medium"];
    } else if (day <= 30) {
        basePool = ["Easy", "Medium", "Medium"];
    } else if (day <= 75) {
        basePool = ["Easy", "Medium", "Hard"];
    } else {
        basePool = ["Medium", "Hard", "Hard"];
    }

    // Fill up to the limitCount by picking from the adaptive pool
    for (let i = 0; i < limitCount; i++) {
        result.push(basePool[i % basePool.length]);
    }
    // Shuffle only for 'mixed' mode to keep the variety interesting
    return result.sort(() => Math.random() - 0.5);
}

module.exports = {
    getDailyDifficulties
};