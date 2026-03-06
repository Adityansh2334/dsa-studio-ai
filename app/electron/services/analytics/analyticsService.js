const db = require("../database/database");
const crypto = require("crypto");
const {generateAnalyticsInsights} = require("./analyticsAI");
const {predictUserProgress} = require("./predictProgress");

/* ======================================================
   GET USER ANALYTICS
====================================================== */
function getUserAnalytics(userId) {

    /* ---------------- TOTAL SOLVED ---------------- */
    const solvedRow = db.prepare(`
        SELECT COUNT(*) as count
        FROM problems
        WHERE user_id = ? AND solved = 1
    `).get(userId);

    const totalSolved = solvedRow?.count || 0;

    /* ---------------- DIFFICULTY STATS ---------------- */
    const difficultyRows = db.prepare(`
        SELECT difficulty, COUNT(*) as count
        FROM problems
        WHERE user_id = ? AND solved = 1
        GROUP BY difficulty
    `).all(userId);

    const difficulty = {
        easy: 0,
        medium: 0,
        hard: 0
    };

    difficultyRows.forEach(r => {
        const key = (r.difficulty || "").toLowerCase();
        if (difficulty[key] !== undefined) {
            difficulty[key] = r.count;
        }
    });

    /* ---------------- PATTERN STATS ---------------- */
    const patternRows = db.prepare(`
        SELECT pattern, COUNT(*) as count
        FROM problems
        WHERE user_id = ? AND solved = 1
        GROUP BY pattern
        ORDER BY count DESC
    `).all(userId);

    const patterns = {};
    patternRows.forEach(r => {
        if (r.pattern) patterns[r.pattern] = r.count;
    });

    /* ---------------- DAILY ACTIVITY ---------------- */
    const activityRows = db.prepare(`
        SELECT date, COUNT(*) as count
        FROM problems
        WHERE user_id = ? AND solved = 1
        GROUP BY date
        ORDER BY date ASC
    `).all(userId);

    const dailyActivity = activityRows.map(r => ({
        date: r.date,
        count: r.count
    }));

    /* ---------------- INTERVIEW USAGE ---------------- */
    const interviewRow = db.prepare(`
        SELECT COUNT(*) as count
        FROM problems
        WHERE user_id = ? AND mode = 'interview'
    `).get(userId);

    const interviewCount = interviewRow?.count || 0;

    /* ---------------- STREAK ---------------- */
    const progressRow = db.prepare(`
        SELECT streak FROM user_progress
        WHERE user_id = ?
    `).get(userId);

    const streak = progressRow?.streak || 0;

    return {
        totalSolved,
        difficulty,
        patterns,
        dailyActivity,
        interviewCount,
        streak
    };
}

async function getDailyAnalyticsInsight(userId, stats) {

    const today = new Date().toISOString().slice(0, 10);

    const fingerprint = buildAnalyticsFingerprint(stats);

    const existing = db.prepare(`
        SELECT *
        FROM user_ai_insight_history
        WHERE user_id = ?
          AND date = ?
        ORDER BY created_at DESC
            LIMIT 1
    `).get(userId, today);

    // =========================
    // CACHE HIT
    // =========================
    if (existing && existing.fingerprint === fingerprint) {

        console.log("🟢 Using cached daily insight");

        return existing.insight;
    }

    console.log("🧠 Generating new daily insight");

    // ✅ IMPORTANT — await here
    const insight = await generateAnalyticsInsights(userId, stats);

    const score = computeScore(stats);
    const level = getLevel(score);

    db.prepare(`
        INSERT INTO user_ai_insight_history
            (user_id, date, fingerprint, insight, score, level)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        userId,
        today,
        fingerprint,
        insight,
        score,
        level
    );

    return insight;
}

function buildAnalyticsFingerprint(stats) {
    return JSON.stringify({
        solved: stats.totalSolved,
        streak: stats.streak,
        interview: stats.interviewCount,
        difficulty: stats.difficulty,
        patterns: stats.patterns
    });
}

function getInsightHistory(userId) {

    return db.prepare(`
        SELECT date, score, level, insight
        FROM user_ai_insight_history
        WHERE user_id = ?
        ORDER BY date ASC
    `).all(userId);
}

function getAnalyticHistory(userId) {

    return db.prepare(`
        SELECT
            date,
            insight,
            score,
            level,
            fingerprint
        FROM user_ai_insight_history
        WHERE user_id = ?
        ORDER BY date ASC
            LIMIT 30
    `).all(userId);
}

async function predictUserProgression(userId) {

    const history = getAnalyticHistory(userId);

    if (!history || history.length === 0) {
        return {
            progress_percent: 0,
            message: "Start solving problems to unlock AI predictions."
        };
    }

    const fingerprint = buildProgressFingerprint(history);

    // =========================
    // CACHE CHECK
    // =========================

    const cached = db.prepare(`
        SELECT *
        FROM user_progress_prediction
        WHERE user_id = ?
    `).get(userId);

    if (cached && cached.fingerprint === fingerprint) {

        const age = Date.now() - new Date(cached.created_at).getTime();

        if (age < 1000 * 60 * 60 * 12) { // 12 hours
            console.log("🟢 Using cached progress prediction");
            return cached;
        }
    }

    console.log("🧠 Generating NEW progress prediction");

    // =========================
    // CALL AI
    // =========================

    const result = await predictUserProgress(userId, history);

    const percent = Number(result.progress_percent || 0);
    const message = String(result.message || "");

    // =========================
    // UPSERT CACHE
    // =========================

    db.prepare(`
        INSERT INTO user_progress_prediction
        (user_id, fingerprint, progress_percent, message)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id)
        DO UPDATE SET
            fingerprint = excluded.fingerprint,
            progress_percent = excluded.progress_percent,
            message = excluded.message,
            created_at = CURRENT_TIMESTAMP
    `).run(
        userId,
        fingerprint,
        percent,
        message
    );

    return {
        progress_percent: percent,
        message
    };
}

function buildProgressFingerprint(history) {

    const data = history.map(h => ({
        date: h.date,
        score: h.score,
        level: h.level,
        fingerprint: h.fingerprint
    }));

    return crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
}

function computeScore(stats) {

    let score = 0;

    score += Math.min(stats.totalSolved * 0.5, 40);
    score += Math.min(stats.streak * 2, 20);
    score += Math.min(stats.interviewCount * 2, 20);

    const hard = stats.difficulty?.hard || 0;
    score += Math.min(hard * 2, 20);

    return Math.min(100, Math.round(score));
}

function getLevel(score) {
    if (score >= 85) return "Elite Candidate";
    if (score >= 70) return "Interview Ready";
    if (score >= 55) return "Advanced Solver";
    if (score >= 40) return "Consistent Learner";
    if (score >= 25) return "Growing Beginner";
    return "Starter";
}

module.exports = {
    getUserAnalytics,
    getDailyAnalyticsInsight,
    getInsightHistory,
    getAnalyticHistory,
    predictUserProgression
};
