const {
    generateWithOpenRouter
} = require("../providers/openrouter");

const {
    generateWithHF
} = require("../providers/huggingface");

const {
    generateWithLlama
} = require("../providers/llamaLocalService");

const db = require("../database/database");

async function executeLLMDirect(userId, prompt, temp, _ollama_model) {

    const row = db.prepare(`
        SELECT ai_mode, ai_provider, ollama_model
        FROM user_ai_keys
        WHERE user_id = ?
    `).get(userId);

    if (!row) throw new Error("User not authenticated");

    const { ai_mode, ai_provider } = row;

    const model = _ollama_model || row.ollama_model;

    /* LLAMA */

    if (ai_mode === "offline" && ai_provider === "llama" && model) {

        console.log("🟢 Direct → Llama");

        return generateWithLlama(
            userId,
            prompt,
            model,
            temp
        );
    }

    /* OPENROUTER */

    if (ai_mode === "online" && ai_provider === "openrouter") {

        console.log("🟢 Direct → OpenRouter");

        return generateWithOpenRouter(
            userId,
            prompt,
            temp
        );
    }

    /* HF */

    if (ai_mode === "online" && ai_provider === "hf") {

        console.log("🟢 Direct → HF");

        return generateWithHF(
            userId,
            prompt,
            temp
        );
    }

    throw new Error("Invalid mode or provider");
}

module.exports = {
    executeLLMDirect
};
