const { generateLLM } = require("../aiConfig/aiRouter");

async function generateAnalyticsInsights(userId, stats) {

    const prompt = `
You are a DSA coach analyzing user practice statistics.

You MUST follow the exact output format below so the system can parse it.

Do NOT add extra text.
Do NOT use markdown symbols like ** or ###.
Only use plain text with bullet points starting with "- ".

USER STATS
Total Solved: ${stats.totalSolved}
Streak: ${stats.streak}
Interview Practice: ${stats.interviewCount}

Difficulty:
Easy: ${stats.difficulty.easy}
Medium: ${stats.difficulty.medium}
Hard: ${stats.difficulty.hard}

Patterns:
${JSON.stringify(stats.patterns)}

================ OUTPUT FORMAT START ================

Strengths:
- <point>
- <point>

Weak Areas:
- <point>
- <point>

Interview Readiness Score:
- <number between 0 and 100>
- <short reasoning>

Recommended Focus:
- <point>
- <point>

Motivation Message:
- <encouraging sentence>
- <optional second sentence>

================ OUTPUT FORMAT END ================

RULES:
1. Section names MUST match exactly.
2. Every line MUST start with "- ".
3. Keep sentences short and clear.
4. Score must be realistic based on stats.
5. Output ONLY these sections.

Generate now.
`;

    const res = await generateLLM(userId, prompt, 1.0);

    return res;
}

module.exports = {
    generateAnalyticsInsights
};
