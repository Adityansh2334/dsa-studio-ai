const db = require("../database/database");

/**
 * Get or create a job.
 * Also handles LIMIT change (user preference change).
 */
function getOrCreateJob(userId, date, mode, limit, contextKey) {

    const row = db.prepare(`
        SELECT * FROM generation_queue
        WHERE user_id = ?
          AND mode = ?
            ${mode === "normal" ? "AND date = ?" : ""}
            ${mode === "interview" ? "AND interview_context = ?" : ""}
        ORDER BY started_at DESC
        LIMIT 1
    `).get(
        userId,
        mode,
        ...(mode === "normal" ? [date] : []),
        ...(mode === "interview" ? [contextKey] : [])
    );

    if (!row) {

        db.prepare(`
            INSERT INTO generation_queue
            (user_id, date, mode, interview_context, required_count, generated_count, status)
            VALUES (?, ?, ?, ?, ?, 0, 'pending')
        `).run(
            userId,
            mode === "normal" ? date : null,
            mode,
            mode === "interview" ? contextKey : null,
            limit
        );

        return {
            user_id: userId,
            date: mode === "normal" ? date : null,
            mode,
            interview_context: mode === "interview" ? contextKey : null,
            required_count: limit,
            generated_count: 0,
            status: 'pending'
        };
    }

    if (row.required_count !== limit) {
        console.log("⚠️ Preference changed. Resetting queue job...");

        db.prepare(`
            UPDATE generation_queue
            SET required_count = ?,
                status = 'pending'
            WHERE user_id = ?
              AND mode = ?
                ${mode === "normal" ? "AND date = ?" : ""}
                ${mode === "interview" ? "AND interview_context = ?" : ""}
        `).run(
            limit,
            userId,
            mode,
            ...(mode === "normal" ? [date] : []),
            ...(mode === "interview" ? [contextKey] : [])
        );

        return {
            ...row,
            required_count: limit,
            status: 'pending'
        };
    }

    return row;
}


function markRunning(userId, date, mode, contextKey) {
    db.prepare(`
        UPDATE generation_queue
        SET status = 'running',
            started_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND mode = ?
            ${mode === "normal" ? "AND date = ?" : ""}
            ${mode === "interview" ? "AND interview_context = ?" : ""}
    `).run(
        userId,
        mode,
        ...(mode === "normal" ? [date] : []),
        ...(mode === "interview" ? [contextKey] : [])
    );
}


function markCompleted(userId, date, mode, contextKey) {

    /* -----------------------------
       GET QUEUE ROW
    ----------------------------- */

    const queueRow = db.prepare(`
        SELECT *
        FROM generation_queue
        WHERE user_id = ?
          AND mode = ?
            ${mode === "normal" ? "AND date = ?" : ""}
            ${mode === "interview" ? "AND interview_context = ?" : ""}
        LIMIT 1
    `).get(
        userId,
        mode,
        ...(mode === "normal" ? [date] : []),
        ...(mode === "interview" ? [contextKey] : [])
    );

    if (!queueRow) return;

    /* -----------------------------
       COUNT ACTUAL PROBLEMS
    ----------------------------- */

    const actualCountRow = db.prepare(`
        SELECT COUNT(*) as cnt
        FROM problems
        WHERE user_id = ?
          AND mode = ?
            ${mode === "normal" ? "AND date = ?" : ""}
            ${mode === "interview" ? "AND interview_context = ?" : ""}
    `).get(
        userId,
        mode,
        ...(mode === "normal" ? [date] : []),
        ...(mode === "interview" ? [contextKey] : [])
    );

    const actualCount = Number(actualCountRow?.cnt || 0);
    const expectedLimit = Number(queueRow.required_count || 0);

    /* -----------------------------
       FIX GENERATED COUNT IF WRONG
    ----------------------------- */

    if (actualCount !== queueRow.generated_count) {

        console.log(
            `⚠️ Fixing generated_count from ${queueRow.generated_count} → ${actualCount}`
        );

        db.prepare(`
            UPDATE generation_queue
            SET generated_count = ?
            WHERE user_id = ?
        `).run(actualCount, queueRow.user_id);
    }

    /* -----------------------------
       MARK COMPLETED ONLY IF FULL
    ----------------------------- */

    if (actualCount >= expectedLimit) {

        db.prepare(`
            UPDATE generation_queue
            SET status = 'completed',
                generated_count = ?
            WHERE user_id = ?
        `).run(actualCount, queueRow.user_id);

        console.log("✅ Queue marked completed");

    } else {

        console.log(
            `⚠️ Not completed yet: ${actualCount}/${expectedLimit}`
        );

        // keep running status
        db.prepare(`
            UPDATE generation_queue
            SET generated_count = ?
            WHERE user_id = ?
        `).run(actualCount, queueRow.user_id);
    }
}

function heartbeat(userId, date, mode, contextKey) {
    db.prepare(`
        UPDATE generation_queue
        SET updated_at = CURRENT_TIMESTAMP,
            generated_count = generated_count + 1
        WHERE user_id = ?
          AND mode = ?
            ${mode === "normal" ? "AND date = ?" : ""}
            ${mode === "interview" ? "AND interview_context = ?" : ""}
    `).run(
        userId,
        mode,
        ...(mode === "normal" ? [date] : []),
        ...(mode === "interview" ? [contextKey] : [])
    );
}


function markPending(userId, date, mode, contextKey) {
    db.prepare(`
        UPDATE generation_queue
        SET status = 'pending',
            started_at = NULL,
            updated_at = NULL
        WHERE user_id = ?
          AND mode = ?
            ${mode === "normal" ? "AND date = ?" : ""}
            ${mode === "interview" ? "AND interview_context = ?" : ""}
    `).run(
        userId,
        mode,
        ...(mode === "normal" ? [date] : []),
        ...(mode === "interview" ? [contextKey] : [])
    );
}

function getProgress(userId, targetDate, mode, contextKey) {

    const row = db.prepare(`
        SELECT * FROM generation_queue
        WHERE user_id = ?
          AND mode = ?
            ${mode === "normal" ? "AND date = ?" : ""}
            ${mode === "interview" ? "AND interview_context = ?" : ""}
        LIMIT 1
    `).get(
        userId,
        mode,
        ...(mode === "normal" ? [targetDate] : []),
        ...(mode === "interview" ? [contextKey] : [])
    );

    return row || { generated_count: 0 };
}

module.exports = {
    getOrCreateJob,
    markRunning,
    markCompleted,
    heartbeat,
    markPending,
    getProgress
};
