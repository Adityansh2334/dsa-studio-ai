
const { runNode } = require("../runners/nodeRunner");
const { runPython } = require("../runners/pythonRunner");
const { runJava } = require("../runners/javaRunner");
const { runDotnet } = require("../runners/dotnetRunner");
const {generateLLM} = require("../../aiConfig/aiRouter");
const {getPrompt} = require("./testCaseGeneratorPrompts");
const {injectDriverReflection} = require("./driverInjector");
const {stripUserDriver} = require("../testExecutor");



/**
 * =========================================
 * Runner Router
 * =========================================
 */
async function executeCode(language, code) {
    switch (language) {
        case "javascript":
            return runNode(code);

        case "python":
            return runPython(code);

        case "java":
            return runJava(code);

        case "dotnet":
            return runDotnet(code);

        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}

/**
 * =====================================================
 * VALIDATE AI TEST CASE STRUCTURE
 * =====================================================
 */
function validateTestCases(testCases, language) {

    if (!Array.isArray(testCases)) {
        return { valid: false, error: "Not an array" };
    }

    if (testCases.length === 0) {
        return { valid: false, error: "Empty test cases" };
    }

    for (let i = 0; i < testCases.length; i++) {

        const tc = testCases[i];

        if (!tc || typeof tc !== "object") {
            return { valid: false, error: `Invalid test case at index ${i}` };
        }

        if (!Array.isArray(tc.variables)) {
            return { valid: false, error: `Missing variables at index ${i}` };
        }

        if (tc.variables.length === 0) {
            return { valid: false, error: `Empty variables at index ${i}` };
        }

        /**
         * Expected MUST exist
         */
        if (tc.expected === undefined || tc.expected === null) {
            return { valid: false, error: `Missing expected at index ${i}` };
        }

        /**
         * Expected MUST be stringifiable
         */
        try {
            String(tc.expected);
        } catch {
            return { valid: false, error: `Invalid expected value at index ${i}` };
        }

        /**
         * Language syntax sanity check
         */
        for (const v of tc.variables) {

            if (typeof v !== "string") {
                return { valid: false, error: `Variable not string at index ${i}` };
            }

            if (language === "java" || language === "dotnet") {
                if (!/;/.test(v)) {
                    return { valid: false, error: `Missing semicolon in ${language} variable` };
                }
            }
        }
    }

    return { valid: true };
}

/**
 * =====================================================
 * BUILD RETRY PROMPT
 * =====================================================
 */
function buildRetryPrompt(previousOutput, error) {

    return `
Your previous test case generation FAILED validation.

ERROR:
${error}

You MUST FIX the response.

STRICT RULES:

1. RETURN ONLY VALID JSON ARRAY
2. DO NOT include explanations
3. DO NOT include markdown
4. DO NOT include comments
5. DO NOT include driver code
6. KEEP SAME FUNCTION PARAMETERS
7. GENERATE EXACTLY 10 TEST CASES
8. EXPECTED VALUES MUST EXIST

BROKEN OUTPUT:
${previousOutput}

Return corrected JSON only.
`;
}


/**
 * =====================================================
 * PARSE AI RESPONSE SAFELY
 * =====================================================
 */
function safeParse(jsonText) {

    try {

        const cleaned = cleanAIResponse(jsonText);

        return JSON.parse(cleaned);

    } catch (err) {

        console.warn("AI JSON parse failed:", err.message);

        return null;
    }
}

/**
 * =====================================================
 * CLEAN AI RESPONSE (remove ``` and json tags)
 * =====================================================
 */
function cleanAIResponse(text = "") {

    if (!text) return "";

    let cleaned = text.trim();

    // remove markdown blocks
    cleaned = cleaned.replace(/```json/gi, "");
    cleaned = cleaned.replace(/```/g, "");

    // extract JSON array/object only
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

    if (match) {
        cleaned = match[0];
    }

    return cleaned.trim();
}


/**
 * =====================================================
 * FALLBACK TEST CASES
 * =====================================================
 */
function fallbackCases(problem) {

    return [
        { input: [1, 2, 3], expected: 6 },
        { input: [5], expected: 5 },
        { input: [], expected: 0 }
    ];
}

async function validateAndFixTestCases({
                                           userId,
                                           problemId,
                                           language,
                                           userCode,
                                           aiCases
                                       }) {

    const verified = [];

    for (const tc of aiCases) {

        try {

            console.log("User Code:", userCode);

            // const templateCode = buildTemplate(language, userCode);
            //
            // console.log("Template Code:", templateCode);

            const sanitizedCode = stripUserDriver(language, userCode);

            console.log("Sanitized Code:", sanitizedCode);

            const runnable = injectDriverReflection(
                problemId,
                language,
                sanitizedCode,
                tc,
                false
            );

            console.log("Runnable Code:", runnable);

            const result = await executeCode(language, runnable);

            if (!result.success) continue;

            const output =
                String(result.stdout || "")
                    .trim();

            verified.push({
                variables: tc.variables,
                expected: output
            });

        } catch (err) {
            console.warn("Validation failed:", err.message);
        }
    }

    return verified;
}

async function generateVerifiedTestCases({
                                             userId,
                                             problem,
                                             language,
                                             userCode,
                                             maxRetries = 2
                                         }) {

    let attempt = 0;

    while (attempt <= maxRetries) {

        const aiResponse = await generateLLM(
            userId,
            buildSeededPrompt(language, problem, userCode),
            0.15,
            { retryCount: 2, forceRegenerate: true }
        );

        console.log("AI Response:", aiResponse);

        const parsed = safeParse(aiResponse);

        if (!Array.isArray(parsed)) {
            attempt++;
            continue;
        }

        const verified =
            await validateAndFixTestCases({
                userId,
                problemId: problem.id,
                language,
                userCode,
                aiCases: parsed
            });

        if (verified.length >= 5) {
            return verified.slice(0, 10);
        }

        attempt++;
    }

    throw new Error("Unable to generate reliable test cases");
}

function buildSeededPrompt(language, problem, userCode) {

    const seed = hashCode(
        problem.title + language + userCode
    );

    return `
RandomSeed: ${seed}

${getPrompt(language, problem, userCode)}
`;
}

function hashCode(str = "") {

    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash);
}

/**
 * =====================================================
 * GENERATE TEST CASES USING AI
 * =====================================================
 */
async function generateTestCases(userId, problem, userCode, language) {

    try {
        /**
         * ============================
         * VALIDATION + RETRY LOOP
         * ============================
         */
        const MAX_RETRY = 2;

        return generateVerifiedTestCases({userId, problem, language, userCode, maxRetries:MAX_RETRY});

    } catch (err) {

        console.error("Test case generation failed:", err);

        return fallbackCases(problem);
    }
}


/**
 * =====================================================
 */

module.exports = {
    generateTestCases
};