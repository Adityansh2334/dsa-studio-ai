const {
    generateWithOpenRouter,
    generateWithOpenRouterStream
} = require("../providers/openrouter");

const {
    generateWithHF,
    generateWithHFStream
} = require("../providers/huggingface");

const {
    generateWithLlama,
    generateWithLlamaStream
} = require("../providers/llamaLocalService");

const db = require("../database/database");
const jobManager = require("../aiQueue/aiJobManager");

const crypto = require("crypto");

/* =========================================================
   HASH KEY
========================================================= */

function getKey(userId, prompt, provider, force = false) {

    const base = `${userId}_${provider}_${prompt}`;

    if (force) {
        return crypto
            .createHash("md5")
            .update(base + "_" + Date.now())
            .digest("hex");
    }

    return crypto
        .createHash("md5")
        .update(base)
        .digest("hex");
}

/* =========================================================
   GENERIC AI JOB ENQUEUE
========================================================= */

async function enqueueAIJob(userId, config) {

    const {
        prompt,
        temp = 0.4,
        type = "llm",
        meta = {},
        forceRegenerate = false,
        retryCount = 2
    } = config;

    /* ================= USER SETTINGS ================= */

    const row = db.prepare(`
        SELECT ai_mode, ai_provider, ollama_model
        FROM user_ai_keys
        WHERE user_id = ?
    `).get(userId);

    if (!row) throw new Error("User not authenticated");

    const { ai_mode: mode, ai_provider: provider, ollama_model } = row;

    /* ================= PROVIDER RESOLUTION ================= */

    let queueProvider = "llama";
    let ollama_model_raw = ollama_model;

    if (mode === "online" && provider === "openrouter") {
        queueProvider = "openrouter";
        ollama_model_raw = "mistral-7b-instruct";
    }

    if (mode === "online" && provider === "hf") {
        queueProvider = "hf";
        ollama_model_raw = "Mistral-7B-Instruct-v0.2:featherless-ai";
    }

    /* ================= JOB KEY ================= */

    const key = getKey(userId, prompt, queueProvider, forceRegenerate);

    /* ================= PAYLOAD ================= */

    const payload = {
        userId,
        prompt,
        temp,
        ollama_model_raw,
        meta
    };

    console.log(`🟢 Queue → ${queueProvider} | type=${type}`);

    /* ================= ENQUEUE ================= */

    return jobManager.enqueue({
        key,
        type,
        provider: queueProvider,
        payload,
        retryCount: retryCount
    });
}

/* =========================================================
   LEGACY WRAPPER (OPTIONAL)
========================================================= */

async function generateLLM(userId, prompt, _temp, options = {}) {

    return enqueueAIJob(userId, {
        prompt,
        _temp,
        type: options.type || "llm",
        meta: options.meta || {},
        forceRegenerate: options.forceRegenerate || false,
        retryCount: options.retryCount || 2
    });
}

/* =========================================================
   TUTOR MODE (STREAMING NOT QUEUED)
========================================================= */

async function generateTutorLLM(userId, prompt, options = {}) {

    const row = db.prepare(`
        SELECT ai_mode, ai_provider, ollama_model
        FROM user_ai_keys
        WHERE user_id = ?
    `).get(userId);

    if (!row) throw new Error("User not authenticated");

    const { ai_mode: mode, ai_provider: provider, ollama_model } = row;
    const { stream = false, onToken = null } = options;

    let fullResponse = "";

    async function handleStreaming(generatorFn, providerType) {

        const streamOptions = {
            stream: true,
            onToken: (token) => {
                fullResponse += token;
                if (onToken) onToken(token);
            }
        };

        if (providerType === "llama") {
            await generatorFn(userId, prompt, ollama_model, streamOptions);
        } else {
            await generatorFn(userId, prompt, streamOptions);
        }

        return sanitizeTutorResponse(fullResponse);
    }

    /* OFFLINE */

    if (mode === "offline" && provider === "llama") {

        if (stream)
            return handleStreaming(generateWithLlamaStream, provider);

        const res = await generateWithLlama(
            userId,
            prompt,
            ollama_model
        );

        return sanitizeTutorResponse(res);
    }

    /* OPENROUTER */

    if (mode === "online" && provider === "openrouter") {

        if (stream)
            return handleStreaming(generateWithOpenRouterStream, provider);

        const res = await generateWithOpenRouter(
            userId,
            prompt
        );

        return sanitizeTutorResponse(res);
    }

    /* HF */

    if (mode === "online" && provider === "hf") {

        if (stream)
            return handleStreaming(generateWithHFStream, provider);

        const res = await generateWithHF(
            userId,
            prompt
        );

        return sanitizeTutorResponse(res);
    }

    throw new Error("Invalid tutor mode or provider");
}

/* =========================================================
   SANITIZER
========================================================= */

function sanitizeTutorResponse(raw) {

    if (!raw) return "";

    const parts = raw.split(/(```[\s\S]*?```)/g);

    return parts
        .map(part => {

            if (part.startsWith("```") && part.endsWith("```"))
                return part;

            let cleaned = part;

            cleaned = cleaned.replace(/^#{1,6}\s*/gm, "");
            cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1");
            cleaned = cleaned.replace(/\*(.*?)\*/g, "$1");
            cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

            return cleaned;
        })
        .join("")
        .trim();
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
    generateLLM,          // queued
    generateTutorLLM,     // direct
};
