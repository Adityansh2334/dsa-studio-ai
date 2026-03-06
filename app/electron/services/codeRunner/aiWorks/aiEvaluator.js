const { runAllTests } = require("../testExecutor");
const { analyzeComplexity } = require("../utils/complexityAnalyzer");
const { evaluateInterview } = require("../utils/interviewGrader");
const {generateLLM} = require("../../aiConfig/aiRouter");
const db = require("../../database/database");
const {generateTestCases} = require("./testCaseGenerator");

/**
 * =========================================
 * Optional Local AI Hook
 * =========================================
 * (You can connect your LLM later here)
 */
async function optionalAIInsights(userId, code, testResult) {

    try {

        const prompt = `
You are a senior FAANG interview engineer evaluating a candidate's coding submission.

Your task is to analyze the candidate solution and provide structured feedback.

==============================
CANDIDATE CODE
==============================
${code}

==============================
TEST RESULT
==============================
Passed: ${testResult?.passedCount || 0} / ${testResult?.total || 0}

Details:
${JSON.stringify(testResult?.details || [], null, 2)}

==============================
INSTRUCTIONS
==============================

Return STRICT JSON only.

Evaluate:

1. Strengths of the code
2. Weaknesses or mistakes
3. Suggestions for improvement
4. Code quality score (0-10)
5. Interview readiness level

Be concise but useful.

==============================
OUTPUT FORMAT
==============================

{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "score": number,
  "interviewReadiness": "Poor | Average | Good | Strong"
}

DO NOT include explanations outside JSON.
`;

        const response = await generateLLM(userId, prompt, 0.2);

        let parsed = null;

        try {
            parsed = JSON.parse(response);
        } catch (_) {
            // Attempt cleanup if model returns markdown
            const cleaned = response
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();

            parsed = JSON.parse(cleaned);
        }

        return {
            strengths: parsed?.strengths || [],
            weaknesses: parsed?.weaknesses || [],
            suggestions: parsed?.suggestions || [],
            score: parsed?.score ?? null,
            interviewReadiness: parsed?.interviewReadiness ?? null
        };

    } catch (err) {

        console.error("AI Insight Error:", err);

        return null;
    }
}

/**
 * =========================================
 * Main Evaluation Pipeline
 * =========================================
 */
async function evaluateSubmission({
                                      language,
                                      code,
                                      problem,
                                      userId
                                  }) {
    try {

        const existing = db.prepare(`
            SELECT execution_metadata
            FROM problem_code_templates
            WHERE problem_id = ?
              AND language = ?
        `).get(problem?.id, language);

        let cases = [];

        if (existing?.execution_metadata) {
            cases = JSON.parse(existing.execution_metadata)?.testCases || [];
        }
        if (cases.length === 0) {
            cases = await generateTestCases(userId, problem, code, language);
        }

        console.log("CASES IN AI EVALUATOR :::::: ", cases);

        /**
         * 1️⃣ Run All Tests
         */
        const testResult = await runAllTests({
            problemId: problem?.id,
            language,
            userCode: code,
            testCases: cases
        });

        console.log("TEST RESULT :::::: ", testResult);

        /**
         * 2️⃣ Complexity Analysis
         */
        const complexity = analyzeComplexity(code);

        console.log("COMPLEXITY :::::: ", complexity);

        /**
         * 3️⃣ Interview Grading
         */
        const grading = evaluateInterview({
            code,
            testResult
        });

        console.log("GRADING :::::: ", grading);

        /**
         * 4️⃣ Optional AI Insights
         */
        const ai = await optionalAIInsights(userId, code, testResult);

        console.log("AI INSIGHT :::::: ", ai);

        /**
         * 5️⃣ Final Response
         */
        return {
            success: true,

            testResult,

            complexity: complexity.time,

            spaceComplexity: complexity.space,

            hireDecision: grading.decision,

            score: grading.score,

            feedback: grading.feedback,

            ai
        };

    } catch (err) {

        return {
            success: false,
            error: err.message
        };

    }
}

/**
 * =========================================
 */

module.exports = {
    evaluateSubmission
};