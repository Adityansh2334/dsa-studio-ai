const { generateLLM } = require("../aiConfig/aiRouter");

async function predictUserProgress(userId, history) {

    if (!history || history.length < 3) {
        return {
            percent: 0,
            message: "Not enough data yet"
        };
    }

    const trend = history.map(h => ({
        date: h.date,
        score: h.score
    }));

    const prompt = `
You are an AI career coach analyzing a user's learning progress.

User score history:
${JSON.stringify(trend)}

Your task:
Predict improvement percentage in next 14 days.

STRICT OUTPUT RULES (MANDATORY):

1. Return ONLY valid JSON
2. No markdown
3. No explanation
4. No extra text
5. JSON must match schema exactly

SCHEMA:

{
  "progress_percent": number (0-100),
  "message": string (max 15 words and min 5 words)
}

If uncertain, still return best estimate.

ONLY OUTPUT JSON.
`;

    try {

        const raw = await generateLLM(userId, prompt, 0.2);

        const parsed = safeParseAIJSON(raw);

        if (parsed) return parsed;

        console.warn("⚠️ AI parse failed → fallback used");

        return fallbackPrediction(history);

    } catch (err) {

        console.error("Prediction AI failed:", err);

        return fallbackPrediction(history);
    }
}

function safeParseAIJSON(raw) {
    if (!raw) return null;

    try {
        let text = String(raw).trim();

        // Remove markdown fences
        text = text.replace(/```json/gi, "");
        text = text.replace(/```/g, "");

        // Extract JSON object
        const match = text.match(/\{[\s\S]*?\}/);

        if (!match) return null;

        const parsed = JSON.parse(match[0]);

        // ===============================
        // SCHEMA VALIDATION
        // ===============================

        if (
            typeof parsed.progress_percent !== "number" ||
            typeof parsed.message !== "string"
        ) {
            return null;
        }

        // Clamp percent
        let percent = Math.round(parsed.progress_percent);

        if (isNaN(percent)) percent = 0;

        percent = Math.max(0, Math.min(100, percent));

        // Clean message
        let message = parsed.message
            .replace(/\*\*/g, "")
            .replace(/`/g, "")
            .trim();

        if (message.length === 0) {
            message = "Keep practicing daily.";
        }

        return {
            progress_percent: percent,
            message
        };

    } catch (err) {
        console.error("Prediction parse error:", err);
        return null;
    }
}

function fallbackPrediction(history) {

    const scores = history.map(h => h.score);

    const first = scores[0] || 0;
    const last = scores[scores.length - 1] || 0;

    const diff = last - first;

    let percent = Math.max(5, Math.min(60, diff));

    if (diff <= 0) percent = 10;

    return {
        progress_percent: percent,
        message: "Consistency will improve your results. Stay focused."
    };
}


module.exports = { predictUserProgress };
