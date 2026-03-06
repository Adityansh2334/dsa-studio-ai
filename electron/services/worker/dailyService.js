const dayjs = require("dayjs");
const db = require("../database/database.js");
const DBH = require("../controllers/databaseHandler");

const { generateTodayBlocking } = require("./firstTimeGenerator");
const { triggerBackgroundGeneration } = require("./dailyGeneratorWorker");
const { bootstrapAI } = require("../aiConfig/aiBootstrapService");
const generationStream = require("../../events/generationStream");

async function getTodayProblems(mode = "normal", userId) {

    const today = dayjs().format("YYYY-MM-DD");
    const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

    console.log(`📅 Checking problems for ${today}`);

    const pref = db.prepare(`
        SELECT * FROM user_preferences WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
    `).get(userId) || {};

    const aiRow = DBH.getAIMode(userId);

    const contextKey =
        mode === "interview"
            ? `${pref.interview_style}|${pref.interview_company}|${pref.interview_role}|${pref.interview_experience}|
            ${pref.interview_difficulty}`
                .toLowerCase()
                .replace(/\s+/g, "")
            : null;

    const LIMIT =
        mode === "interview"
            ? pref.interview_problem_count || 10
            : pref.daily_problem_count || 3;

    console.log("LIMIT", LIMIT);

    const difficulty =
        mode === "interview"
            ? pref.interview_difficulty
            : pref.daily_difficulty;

    const rawPatterns =
        mode === "interview"
            ? pref.interview_patterns
            : pref.daily_patterns;

    const preferred = rawPatterns ? JSON.parse(rawPatterns) : [];

    //Start llama server before fetching problems
    if (aiRow?.ai_mode === "offline") {
        console.log("⏳ Waiting for local AI to start...");
        await bootstrapAI(userId);
        console.log("🎉 AI ready, continuing ....");
    }

    /* =========================================================
       🔥 INTERVIEW MODE → IGNORE DATE COMPLETELY
    ========================================================= */

    if (mode === "interview") {

        console.log("🎯 Interview Mode → Fetching all problems by context only");

        let rows = db.prepare(`
            SELECT * FROM problems
            WHERE interview_context = ?
              AND user_id = ?
              AND mode = ?
            ORDER BY date DESC
        `).all(contextKey, userId, mode);

        if (rows.length >= LIMIT) {
            console.log("✅ Interview problems found");
            return rows;
        }else if (rows.length > 0 && rows.length !== LIMIT){
            generationStream.emit("generation-started", {
                count: rows.length || 0,
                limit: LIMIT
            });
            console.log("🆕 Not enough interview problems. Generating...");
            // background generation
            generateTodayBlocking(
                userId,
                mode,
                contextKey,
                LIMIT,
                difficulty,
                preferred
            );

            return rows;
        } else if(rows.length === 0){
            generationStream.emit("generation-started", {
                count: rows.length || 0,
                limit: LIMIT
            });
            await generateTodayBlocking(
                userId,
                mode,
                contextKey,
                LIMIT,
                difficulty,
                preferred
            );
            generationStream.emit("generation-finished");

                return db.prepare(`
                SELECT * FROM problems
                WHERE user_id = ?
                  AND mode = ?
                  AND interview_context = ?
                ORDER BY date DESC
            `).all(userId,mode,contextKey);
        }
    }

    /* =========================================================
       🟢 NORMAL MODE (UNCHANGED LOGIC)
    ========================================================= */

    const paramsToday = [userId, today, mode];
    const paramsYesterday = [userId, yesterday, mode];
    const paramsAll = [userId, mode, today];

    // 1️⃣ Try TODAY
    let rows = db.prepare(`
        SELECT * FROM problems
        WHERE user_id = ?
          AND date = ?
          AND mode = ?
    `).all(...paramsToday);

    if (rows.length >= LIMIT) {
        console.log("✅ Today problems found");

        console.log("Triggering background generation...");
        triggerBackgroundGeneration(
            userId,
            mode,
            contextKey,
            LIMIT,
            difficulty,
            preferred
        );

        return db.prepare(`
            SELECT * FROM problems
            WHERE user_id = ?
              AND mode = ?
              AND date <= ?
            ORDER BY date DESC
        `).all(...paramsAll);
    }

    // 2️⃣ Try YESTERDAY
    rows = db.prepare(`
        SELECT * FROM problems
        WHERE user_id = ?
          AND date = ?
          AND mode = ?
    `).all(...paramsYesterday);

    if (rows.length >= LIMIT) {
        console.log("⚡ Showing yesterday problems...");

        triggerBackgroundGeneration(
            userId,
            mode,
            contextKey,
            LIMIT,
            difficulty,
            preferred
        );

        return db.prepare(`
            SELECT * FROM problems
            WHERE user_id = ?
              AND mode = ?
              AND date <= ?
            ORDER BY date DESC
        `).all(...paramsAll);
    }

    // 3️⃣ FIRST TIME USER (blocking)
    console.log("🆕 First time user / Re-generation Case. Blocking generation...");

    generationStream.emit("generation-started", {
        count: rows.length || 0,
        limit: LIMIT
    });

    await generateTodayBlocking(
        userId,
        mode,
        contextKey,
        LIMIT,
        difficulty,
        preferred
    );

    triggerBackgroundGeneration(
        userId,
        mode,
        contextKey,
        LIMIT,
        difficulty,
        preferred
    );

    generationStream.emit("generation-finished");

    return db.prepare(`
        SELECT * FROM problems
        WHERE user_id = ?
          AND mode = ?
          AND date <= ?
        ORDER BY date DESC
    `).all(...paramsAll);
}

module.exports = { getTodayProblems };
