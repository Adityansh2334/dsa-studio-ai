const { v4: uuid } = require("uuid");
const db = require("../database/database");

const {
    getActive,
    setActive,
    clearActive
} = require("./aiQueueMemory");

const { processJob } = require("./aiWorker");

class AIJobManager {

    constructor() {
        this.running = false;
        this.concurrency = {
            llama: 1,
            openrouter: 3,
            hf: 2
        };

        this.currentRunning = {
            llama: 0,
            openrouter: 0,
            hf: 0
        };

        this.startWorkerLoop();
    }

    /* =========================
       PUBLIC API
    ========================== */

    async enqueue({ key, type, provider, payload, retryCount }) {

        // Deduplicate running jobs
        const active = getActive(key);
        if (active) return active;

        // Check DB existing job
        const existing = db.prepare(`
            SELECT * FROM ai_jobs
            WHERE key = ?
            AND status IN ('pending','running','done')
            ORDER BY created_at DESC
            LIMIT 1
        `).get(key);

        if (existing && existing.status === "done") {
            return JSON.parse(existing.result);
        }

        if (existing && existing.status !== "done") {
            return this.waitForCompletion(existing.id, key);
        }

        // Create new job
        const id = uuid();

        db.prepare(`
            INSERT INTO ai_jobs
            (id, key, type, provider, payload, status, max_retries, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        `).run(
            id,
            key,
            type,
            provider,
            JSON.stringify(payload),
            retryCount,
            Date.now(),
            Date.now()
        );

        return this.waitForCompletion(id, key);
    }

    /* =========================
       WAIT PROMISE
    ========================== */

    waitForCompletion(jobId, key) {

        const promise = new Promise((resolve, reject) => {

            const interval = setInterval(() => {

                const row = db.prepare(`
                    SELECT status, result, error
                    FROM ai_jobs
                    WHERE id = ?
                `).get(jobId);

                if (!row) return;

                if (row.status === "done") {
                    clearInterval(interval);
                    clearActive(key);
                    resolve(JSON.parse(row.result));
                }

                if (row.status === "failed") {
                    clearInterval(interval);
                    clearActive(key);
                    reject(row.error);
                }

            }, 300);

        });

        setActive(key, promise);

        return promise;
    }

    /* =========================
       WORKER LOOP
    ========================== */

    startWorkerLoop() {

        if (this.running) return;
        this.running = true;

        setInterval(() => this.tick(), 200);
    }

    async tick() {

        const jobs = db.prepare(`
            SELECT *
            FROM ai_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 5
        `).all();

        for (const job of jobs) {

            const provider = job.provider || "llama";

            if (
                this.currentRunning[provider] >=
                this.concurrency[provider]
            ) continue;

            this.runJob(job);
        }
    }

    async runJob(job) {

        const provider = job.provider || "llama";

        this.currentRunning[provider]++;

        db.prepare(`
            UPDATE ai_jobs
            SET status='running', updated_at=?
            WHERE id=?
        `).run(Date.now(), job.id);

        try {

            const result = await processJob(job);

            db.prepare(`
                UPDATE ai_jobs
                SET status='done',
                    result=?,
                    updated_at=?
                WHERE id=?
            `).run(
                JSON.stringify(result),
                Date.now(),
                job.id
            );

        } catch (err) {

            db.prepare(`
                UPDATE ai_jobs
                SET status='failed',
                    error=?,
                    updated_at=?
                WHERE id=?
            `).run(
                String(err),
                Date.now(),
                job.id
            );

        } finally {
            this.currentRunning[provider]--;
        }
    }
}

module.exports = new AIJobManager();