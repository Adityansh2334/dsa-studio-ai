const dayjs = require("dayjs");
const db = require("../database/database.js");

const patterns = require("./patterns");
const { pickDailyPatterns } = require("./dailySelector");
const { getDailyDifficulties } = require("./difficultyPlanner");
const problemStream = require("../../events/problemStream");
const queue = require("../controllers/generationQueueService");
const {startTask, endTask} = require("../controllers/generationController");
const {generateProblemBatch} = require("../aiConfig/ai");
const {refineDifficulty, refinePattern} = require("../../utils/commonUtil");
const crypto = require("crypto");

const generationStream = require("../../events/generationStream");


function shuffleArray(arr) {
    const copy = [...arr];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function normalizeText(text = "") {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\b(the|a|an|in|on|of|to|for|with|and)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function canonicalTitle(title) {
    return normalizeText(title)
        .replace(/\b(problem|question|challenge)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/* FINGERPRINT — SAME */
function fingerprint(problem, pattern, difficulty) {

    const titleKey = canonicalTitle(problem.title);
    const patternKey = normalizeText(pattern);
    const difficultyKey = normalizeText(difficulty);
    const problemKey = normalizeText(problem.problem);

    const normalized = `
        ${titleKey}
        ${problemKey}
        ${patternKey}
        ${difficultyKey}
    `;

    return crypto
        .createHash("sha256")
        .update(normalized)
        .digest("hex");
}

function fingerprintExists(fp) {
    const row = db.prepare(`
        SELECT 1 FROM problems WHERE fingerprint = ?
    `).get(fp);

    return !!row;
}

async function generateForDate(userId, mode, targetDate, contextKey, LIMIT, difficulty,
                               isBackgroundGenerate, preferredPatterns) {

    const controller = new AbortController();
    const signal = controller.signal;

    startTask(isBackgroundGenerate ? "background" : "foreground", controller);

    const job = queue.getOrCreateJob(userId, targetDate, mode, LIMIT, contextKey);

    if (job.status === 'completed') {
        console.log("✅ Queue says already completed");
        return;
    }

    if (job?.status === 'running') {
        const now = dayjs();

        const startedAgo = now.diff(dayjs(job.started_at), 'second');
        const lastBeatAgo = job.updated_at
            ? now.diff(dayjs(job.updated_at), 'second')
            : null;

        // CASE 1: app crashed before first problem
        if (!job.updated_at && startedAgo > 30) {
            console.log("⚠️ Crashed before first problem. Restarting...");
            queue.markRunning(userId, targetDate, mode, contextKey);
        }
        // CASE 2: app crashed in middle
        else if (lastBeatAgo !== null && lastBeatAgo > 30) {
            console.log("⚠️ Crashed mid generation. Resuming...");
            queue.markRunning(userId, targetDate, mode, contextKey);
        }
        // CASE 3: real running
        else {
            console.log("⏳ Active generation. Skip.");
            return;
        }
    } else {
        console.log("Starting generation...");
        queue.markRunning(userId, targetDate, mode, contextKey);
    }

    let rows;

    if (mode === "normal") {
        rows = db.prepare(`
        SELECT * FROM problems
        WHERE user_id = ?
          AND mode = 'normal'
          AND date <= ?
        ORDER BY date DESC
    `).all(userId, targetDate);

    } else {
        rows = db.prepare(`
        SELECT * FROM problems
        WHERE user_id = ?
          AND mode = 'interview'
          AND interview_context = ?
          AND date <= ?
        ORDER BY date DESC
    `).all(userId, contextKey, targetDate);
    }

    if (rows.length !== 0 && rows.length < LIMIT && !isBackgroundGenerate) {
        for (const row of rows) {
            problemStream.emit("new-problem", row);
        }
    }

    console.log("Rows/ Job length:", job.generated_count);
    console.log("LIMIT:", LIMIT);
    console.log(`Generating missing Problem for the date count: ${LIMIT-job.generated_count}`)

    const mastery = {};
    const pickedPatterns = await pickDailyPatterns(patterns, mastery, LIMIT, preferredPatterns);
    const difficulties = await getDailyDifficulties(userId, LIMIT, difficulty);

    const insert = db.prepare(`
    INSERT INTO problems
    (date, mode, title, difficulty, pattern, content, fingerprint, user_id, interview_context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const BATCH_SIZE = 2;
    let errorCounter = 0;

    let lastUsedPatterns = new Set();
    for (let i = job.generated_count; i < LIMIT; ) {

        // ------------------ PREPARE ONE BATCH ------------------
        const batchSpecs = [];

        const available = pickedPatterns.filter(p => !lastUsedPatterns.has(p.pattern));

        const source =
            available.length >= BATCH_SIZE
                ? available
                : pickedPatterns;

        const shuffledPatterns = shuffleArray(source);

        for (let b = 0; b < BATCH_SIZE && (i + b) < LIMIT; b++) {
            const p = shuffledPatterns[b % shuffledPatterns.length];
            const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

            batchSpecs.push({
                pattern: p.pattern,
                difficulty
            });
        }

        lastUsedPatterns = new Set(batchSpecs.map(x => x.pattern));

        console.log("🚀 Generating batch:", batchSpecs);

        let reGenerateForce = false;

        // ------------------ CALL LLM ONCE ------------------
        let rawProblems = [];
        try {
            rawProblems = await generateProblemBatch(userId, batchSpecs, mode, reGenerateForce);
        } catch (e) {
            errorCounter++;
            console.error("Batch generation failed : ", errorCounter, e);
            if(errorCounter > 2) {
                throw e;
            }
            continue;
        }

        // ------------------ PROCESS EACH PROBLEM EXACTLY LIKE BEFORE ------------------
        const expected = batchSpecs.length;
        const received = rawProblems.length;

        const limit = Math.min(expected, received);

        if (received !== expected) {
            console.warn(
                `⚠️ Problem count mismatch | Expected: ${expected}, Received: ${received}`
            );
        }

        let duplicateFpCount = 0;
        let attemptsForSlot = 0;

        for (let k = 0; k < limit; k++) {

            attemptsForSlot++;

            if (attemptsForSlot > 7) {
                console.log("⚠️ Slot forced skip after retries");
                i++;   // move forward anyway
                break;
            }

            if (signal.aborted) {
                console.log("🛑 Generation aborted safely");
                queue.markPending(userId, targetDate, mode, contextKey);
                endTask(controller);
                return;
            }

            const problem = rawProblems[k];
            if (!problem || !problem.title) continue;

            const spec = batchSpecs[k];
            const fp = fingerprint(problem, spec.pattern, spec.difficulty);

            if (fingerprintExists(fp)) {
                console.log("⚠️ Duplicate problem skipped (hash)");
                duplicateFpCount++;
                if(duplicateFpCount > 3){
                    reGenerateForce = true;
                }
                continue;
            }

            const dif = refineDifficulty(problem.difficulty);
            const pat = refinePattern(problem.pattern);

            insert.run(
                targetDate,
                mode,
                problem.title || "DSA Practice Problem",
                dif,
                pat,
                JSON.stringify(problem),
                fp,
                userId,
                contextKey
            );

            console.log(`✅ Generated: ${problem.title}`);

            const row = db.prepare(`
                                    SELECT * FROM problems
                                    WHERE fingerprint = ?
                                    LIMIT 1
                                `).get(fp);

            if (!isBackgroundGenerate && row) {
                problemStream.emit("new-problem", row);
            }

            queue.heartbeat(userId, targetDate, mode, contextKey);

            const progress = queue.getProgress(
                userId,
                targetDate,
                mode,
                contextKey
            );

            generationStream.emit("problem-generated", {
                count: Number(progress.generated_count),
            });

            i++; // move slot forward
        }
    }
    queue.markCompleted(userId, targetDate, mode, contextKey);
    endTask(controller);
}

async function generateTodayBlocking(userId, mode, contextKey, LIMIT, difficulty, preferred) {
    const today = dayjs().format("YYYY-MM-DD");
    await generateForDate(userId, mode, today, contextKey, LIMIT, difficulty, false, preferred);
}

module.exports = { generateTodayBlocking, generateForDate };
