/* ======================================================
   DATABASE HANDLER
   Central place for ALL DB queries used by main process
====================================================== */

const db = require("../database/database");
const dayjs = require("dayjs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");


/* ======================================================
   SESSION
====================================================== */

function insertUserSession(userId) {
    db.prepare(`
        INSERT OR REPLACE INTO user_session(user_id, last_login_at)
        VALUES (?, CURRENT_TIMESTAMP)
    `).run(userId);
}

function markerUserLoginSuccess(userId){
    db.prepare(`
        UPDATE user_session
        SET is_success_login = 1
        WHERE user_id = ?
    `).run(userId);
}

function markUserLoggedIn(userId) {
    db.prepare(`
        INSERT OR REPLACE INTO user_session(user_id, last_login_at, is_logged_in, is_success_login)
        VALUES (?, CURRENT_TIMESTAMP, 1, 1)
    `).run(userId);
}

function markUserLoggedOut(userId) {
    db.prepare(`
        UPDATE user_session
        SET is_logged_in = 0
        WHERE user_id = ?
    `).run(userId);
}

function getLastLoggedInUser() {
    return db.prepare(`
        SELECT u.*
        FROM users u
        JOIN user_session s ON u.id = s.user_id AND s.is_logged_in = 1 AND s.is_success_login = 1
        ORDER BY s.created_at DESC
        LIMIT 1
    `).get();
}

/* ======================================================
   AI KEYS
====================================================== */

function getAIKeys(userId) {
    return db.prepare(`
        SELECT openrouter_key, hf_key, ollama_model
        FROM user_ai_keys
        WHERE user_id = ?
    `).get(userId);
}

function getAIMode(userId){
    return db.prepare(`
        SELECT ai_mode
        FROM user_ai_keys
        WHERE user_id = ?
    `).get(userId);
}

function saveAIKeys(userId, openRouterKey, hfKey, ollamaModel, mode, provider) {
    db.prepare(`
        INSERT INTO user_ai_keys (user_id, openrouter_key, hf_key, ollama_model, ai_mode, ai_provider)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id)
        DO UPDATE SET
            openrouter_key = excluded.openrouter_key,
            hf_key = excluded.hf_key,
            ollama_model = excluded.ollama_model,
            ai_mode = excluded.ai_mode,
            ai_provider = excluded.ai_provider,
            updated_at = CURRENT_TIMESTAMP
    `).run(userId, openRouterKey, hfKey, ollamaModel, mode, provider);

    const now = dayjs();
    const expires = now.add(15, "day");

    db.prepare(`
        UPDATE users
        SET last_login_at = ?, session_expires_at = ?
        WHERE id = ?
    `).run(now.toISOString(), expires.toISOString(), userId);
}

/* ======================================================
   PROBLEMS & PROGRESS
====================================================== */

function getUserProgress(userId) {
    const progress = db.prepare(`
        SELECT * FROM user_progress WHERE user_id = ?
    `).get(userId);

    const solvedRows = db.prepare(`
        SELECT id FROM problems WHERE solved = 1
    `).all();

    const solvedMap = {};
    solvedRows.forEach(r => solvedMap[r.id] = true);

    return {
        streak: progress?.streak || 0,
        solvedMap
    };
}

function markProblemSolved(problemId, userId) {
    const today = dayjs().format("YYYY-MM-DD");

    db.prepare(`UPDATE problems SET solved = 1 WHERE id = ?`).run(problemId);

    const progress = db.prepare(`
        SELECT * FROM user_progress WHERE user_id = ?
    `).get(userId);

    if (!progress) {
        db.prepare(`
            INSERT INTO user_progress (user_id, first_day, last_solved_day, streak)
            VALUES (?, ?, ?, 1)
        `).run(userId, today, today);
        return { streak: 1 };
    }

    if (progress.last_solved_day === today) {
        return { streak: progress.streak };
    }

    const diff = dayjs(today).diff(dayjs(progress.last_solved_day), "day");
    const newStreak = diff === 1 ? progress.streak + 1 : 1;

    db.prepare(`
        UPDATE user_progress
        SET last_solved_day = ?, streak = ?
        WHERE user_id = ?
    `).run(today, newStreak, userId);

    return { streak: newStreak };
}

function getUserPreferences(userId){
    const user = db.prepare(`
        SELECT name, phone FROM users WHERE id = ?
    `).get(userId);

    const pref = db.prepare(`
        SELECT * FROM user_preferences WHERE user_id = ?
    `).get(userId);

    return {
        ...user,
        ...pref
    };
}

function updateUserPreferences(userId, data){
    const tx = db.transaction(() => {

        /* ================= USERS TABLE ================= */

        if (data.name || data.phone || data.newPassword) {

            const existing = db.prepare(`
                SELECT * FROM users WHERE id = ?
            `).get(userId);

            const newName = data.name ?? existing.name;
            const newPhone = data.phone ?? existing.phone;

            let newPasswordHash = existing.password_hash;

            if (data.newPassword && data.newPassword.trim()) {
                newPasswordHash = bcrypt.hashSync(data.password, 10);
            }

            db.prepare(`
                UPDATE users
                SET name = ?,
                    phone = ?,
                    password_hash = ?
                WHERE id = ?
            `).run(newName, newPhone, newPasswordHash, userId);
        }

        /* ================= PREFERENCES TABLE ================= */

        db.prepare(`
            INSERT INTO user_preferences (
                user_id,
                daily_problem_count,
                daily_difficulty,
                daily_patterns,
                interview_problem_count,
                interview_company,
                interview_role,
                interview_experience,
                interview_difficulty,
                interview_patterns,
                preferred_language,
                show_hints,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                daily_problem_count = excluded.daily_problem_count,
                daily_difficulty = excluded.daily_difficulty,
                daily_patterns = excluded.daily_patterns,
                interview_problem_count = excluded.interview_problem_count,
                interview_company = excluded.interview_company,
                interview_role = excluded.interview_role,
                interview_experience = excluded.interview_experience,
                interview_difficulty = excluded.interview_difficulty,
                interview_patterns = excluded.interview_patterns,
                preferred_language = excluded.preferred_language,
                show_hints = excluded.show_hints,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            userId,
            data.daily_problem_count,
            data.daily_difficulty,
            data.daily_patterns,
            data.interview_problem_count,
            data.interview_company,
            data.interview_role,
            data.interview_experience,
            data.interview_difficulty,
            data.interview_patterns,
            data.preferred_language,
            data.show_hints ? 1 : 0
        );
    });

    tx();
}

function updateInterviewPreferences(userId, data){
    db.prepare(`
        INSERT INTO user_preferences (
            user_id,
            interview_problem_count,
            interview_style,
            interview_company,
            interview_role,
            interview_experience,
            interview_difficulty,
            interview_patterns,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            interview_problem_count = excluded.interview_problem_count,
            interview_style = excluded.interview_style,
            interview_company = excluded.interview_company,
            interview_role = excluded.interview_role,
            interview_experience = excluded.interview_experience,
            interview_difficulty = excluded.interview_difficulty,
            interview_patterns = excluded.interview_patterns,
            updated_at = CURRENT_TIMESTAMP
    `).run(
        userId,
        data.interview_problem_count,
        data.interview_style,
        data.interview_company,
        data.interview_role,
        data.interview_experience,
        data.interview_difficulty,
        data.interview_patterns
    );
}

function getInterviewPreferences(userId){
    return db.prepare(`
        SELECT DISTINCT interview_context
        FROM problems
        WHERE user_id = ?
          AND mode = 'interview'
          AND interview_context IS NOT NULL
        ORDER BY interview_context DESC
    `).all(userId);
}

function loadAiChatProblems(userId, problemId){
    return db.prepare(`
        SELECT role, message
        FROM problem_ai_chat
        WHERE user_id = ? AND problem_id = ?
        ORDER BY id ASC
    `).all(userId, problemId);
}

function saveAiUserQuestions(userId, problemId, question){
    return db.prepare(`
        INSERT INTO problem_ai_chat (user_id, problem_id, role, message)
        VALUES (?, ?, 'user', ?)
    `).run(userId, problemId, question);
}

function saveAiResponse(userId, problemId, aiResponse){
    return db.prepare(`
        INSERT INTO problem_ai_chat (user_id, problem_id, role, message)
        VALUES (?, ?, 'assistant', ?)
    `).run(userId, problemId, aiResponse);
}

function deleteInterviewContext(userId, contextKey){
    db.prepare(`
        DELETE FROM problems
        WHERE user_id = ?
          AND mode = 'interview'
          AND interview_context = ?
    `).run(userId, contextKey);

    db.prepare(`
        DELETE FROM generation_queue
        WHERE user_id = ?
          AND mode = 'interview'
          AND interview_context = ?
    `).run(userId, contextKey);
}

function gerUserPreferenceLimit(userId, mode) {

    const row = mode === "interview"
        ? db.prepare(`
            SELECT interview_problem_count 
            FROM user_preferences 
            WHERE user_id = ?
        `).get(userId)
        : db.prepare(`
            SELECT daily_problem_count
            FROM user_preferences
            WHERE user_id = ?
        `).get(userId);

    if (!row) {
        console.log("⚠️ No user_preferences found. Returning defaults.");

        return mode === "interview"
            ? { interview_problem_count: 10 }
            : { daily_problem_count: 3 };
    }

    return row;
}

function getProblemsCountInterview(userId,interviewContext){
    return db.prepare(`
    SELECT COUNT(*) AS count
    FROM problems
    WHERE user_id = ? AND mode = 'interview' AND interview_context = ?
    `).get(userId, interviewContext);
}

function getTotalProblemsCount(userId){
    return db.prepare(`
    SELECT COUNT(*) AS count
    FROM problems
    WHERE user_id = ? AND mode = 'normal'
    `).get(userId);
}

function resetPassword(email, newPassword) {

    const user = db.prepare(`
        SELECT id FROM users WHERE email = ?
    `).get(email);

    if (!user) return false;

    const hash = bcrypt.hashSync(newPassword, 10);

    db.prepare(`
        UPDATE users
        SET password_hash = ?
        WHERE email = ?
    `).run(hash, email);

    return true;
}

function getAIVisualizationCache(problemId) {

    const row = db
        .prepare(`
            SELECT pv.visualization_json
            FROM algorithm_problem_visualizations ap
                     JOIN algorithm_pattern_visualizations pv
                          ON ap.pattern_hash = pv.pattern_hash
            WHERE ap.problem_id = ?
        `)
        .get(problemId);

    if (!row) return null;

    try {
        console.log("CACHE RESPONSE RETUNRED")
        return JSON.parse(row.visualization_json);
    } catch {
        return null;
    }
}

function storeAIVisualizationCache(problemId, payloadPattern, aiResult) {

    db.prepare(`
        DELETE FROM algorithm_problem_visualizations
        WHERE problem_id = ?
        `).run(problemId);

    const patternHash = getPatternHash(
        payloadPattern
    );


    /* =========================
       STORE PATTERN CACHE
    ========================= */

    db.prepare(
        `INSERT OR REPLACE INTO algorithm_pattern_visualizations
         (pattern, pattern_hash, visualization_json)
         VALUES (?, ?, ?)`
    ).run(
        payloadPattern,
        patternHash,
        JSON.stringify(aiResult)
    );

    /* =========================
       STORE PROBLEM MAPPING
    ========================= */

    db.prepare(
        `INSERT OR REPLACE INTO algorithm_problem_visualizations
         (problem_id, pattern_hash)
         VALUES (?, ?)`
    ).run(problemId, patternHash);

    console.log("CACHE RESPONSE STORED")
}

function getProblemById(problemId){
    return db.prepare(`
        SELECT * FROM problems WHERE id = ?
    `).get(problemId);
}


/* ================ HELPERS ============= */
function getPatternHash(pattern) {
    return crypto
        .createHash("md5")
        .update(pattern.toLowerCase().trim())
        .digest("hex");
}

module.exports = {
    insertUserSession,
    markUserLoggedIn,
    markUserLoggedOut,
    getLastLoggedInUser,
    getAIKeys,
    saveAIKeys,
    getUserProgress,
    markProblemSolved,
    getUserPreferences,
    updateUserPreferences,
    updateInterviewPreferences,
    getInterviewPreferences,
    loadAiChatProblems,
    saveAiUserQuestions,
    saveAiResponse,
    deleteInterviewContext,
    markerUserLoginSuccess,
    getAIMode,
    gerUserPreferenceLimit,
    getProblemsCountInterview,
    getTotalProblemsCount,
    resetPassword,
    storeAIVisualizationCache,
    getAIVisualizationCache,
    getProblemById
};
