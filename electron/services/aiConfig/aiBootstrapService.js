const db = require("../database/database");
const { startLlamaServer, waitForLlamaReady} = require("./llamaService");
const { setAIReady } = require("./aiRuntimeState");

async function bootstrapAI(userId) {

    const row = db.prepare(`
        SELECT ai_mode, ollama_model
        FROM user_ai_keys
        WHERE user_id = ?
    `).get(userId);

    if (!row) {
        console.log("⚠️ No AI configured yet");
        return;
    }

    if (row.ai_mode !== "offline") {
        console.log("🌍 Using cloud provider, no local startup needed");
        setAIReady(null);
        return;
    }

    console.log("🚀 Bootstrapping local AI...");

    await startLlamaServer(row.ollama_model);

    // 🔥 CRITICAL: WAIT FOR HEALTH CHECK
    await waitForLlamaReady();

    setAIReady(row.ollama_model);

    console.log("✅ AI bootstrap complete");
}

module.exports = {
    bootstrapAI
};
