const {generateLLM} = require("../aiConfig/aiRouter");
const {buildVisualizationPrompt} = require("./aiVisualizationUtility");

async function generateVisualizationAI(userId, payload) {

    try {

        /* ================= BUILD PROMPT ================= */

        const prompt = buildVisualizationPrompt(payload);

        /* ================= CALL GENERIC LLM ================= */

        return await generateLLM(
            userId,
            prompt,
            0.5,
            {
                type: "visualization",            // important for worker routing
                forceRegenerate: payload.forceRegenerate || false,
                meta: payload,                    // send full payload to worker if needed
                retryCount: 2                     // worker retry attempts
            }
        );

    } catch (err) {

        console.error("Visualization AI error:", err);

        return {};
    }
}

module.exports = {
    generateVisualizationAI
};

