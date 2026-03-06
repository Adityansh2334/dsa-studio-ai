const retry = require("./aiRetry");

const {
    executeLLMDirect
} = require("../providers/llmExecutor");
const {sanitizeAIResponse, validateVisualization, normalizeVisualization, buildVisualizationPrompt} = require("../aiVisualization/aiVisualizationUtility");
const { isValidProblemSections } = require("../../utils/llmResponseValidator");
const {parseSections, sanitizeLLMOutput, buildCorrectionPrompt} = require("../../utils/aiProblemUtils");

async function processJob(job) {

    const payload = JSON.parse(job.payload);

    switch (job.type) {

        case "visualization":
            return runVisualizationJob(job, payload);

        case "problem_batch":
            return runProblemBatchJob(job, payload);

        case "llm":
            return runRawLLM(job, payload);

        case "regenerate_solution":
            return runRegenerateProblemSolution(job, payload);

        default:
            throw new Error("Unknown job type");
    }
}

async function runVisualizationJob(job, payload) {

    return retry(async (attempt) => {

        console.log(
            `AI Job ${job.id} runVisualizationJob attempt ${attempt + 1}`
        );

        /* ================= CLONE PAYLOAD ================= */

        let currentPayload = { ...payload };

        /* ================= RETRY ESCALATION ================= */

        if (attempt >= 1) {

            currentPayload.temp = attempt >= 2 ? 0.05 : 0.15;

            const newMeta = {
                ...(currentPayload.meta || {}),
                retryMode: true
            };

            currentPayload.meta = newMeta;

            currentPayload.prompt = buildVisualizationPrompt(newMeta);
        }

        /* ================= EXECUTE ================= */

        const response = await executeLLMDirect(
            currentPayload.userId,
            currentPayload.prompt,
            currentPayload.temp,
            currentPayload.ollama_model_raw
        );

        if (!response || response.length < 10) {
            throw new Error("Empty AI response");
        }

        /* ================= PARSE ================= */

        const parsed = safeParseJSON(response);

        if (!parsed || Object.keys(parsed).length === 0) {
            throw new Error("Parsing failed");
        }

        /* ================= VALIDATE ================= */

        const valid = validateVisualization(parsed);

        if (!valid) {
            throw new Error("Invalid visualization");
        }

        /* ================= NORMALIZE ================= */

        return normalizeVisualization(parsed);

    }, job.max_retries || 2);
}

async function runRawLLM(job, payload){
    return await retry(async (attempt) => {

        console.log(`AI Job ${job.id} and function name runRawLLM with attempt ${attempt + 1}`);

        const aiResponse = await executeLLMDirect(
            payload.userId,
            payload.prompt,
            payload.temp,
            payload.ollama_model_raw
        );

        if (payload.validate) {
            const ok = payload.validate(aiResponse);
            if (!ok) {
                throw new Error("Validation failed");
            }
        }

        return aiResponse;

    }, job.max_retries || 2);
}

async function runProblemBatchJob(job, payload) {

    const separatorStart = payload.separatorStart;
    const separatorEnd = payload.separatorEnd;
    const prompt = payload.prompt;

    return await retry(async (attempt) => {

        console.log(`AI Job ${job.id} and function name runProblemBatchJob with attempt ${attempt + 1}`);

        try {

            /* ================= FIRST PASS ================= */

            const result = await attemptBatch(
                separatorStart,
                separatorEnd,
                prompt,
                payload.userId
            );

            if (Array.isArray(result) && result.length > 0) {
                console.log("✅ Batch success");
                return result;
            }

            /* ================= CORRECTION PASS ================= */

            if (result?.needFix) {

                console.log("⚠️ Format issue detected. Running correction pass...");

                const correctionPrompt = buildCorrectionPrompt(
                    prompt,
                    result.badOutput
                );

                let temp = 0.1;
                if(temp >= 3){
                    temp = 0.05;
                }

                const corrected = await attemptBatch(
                    separatorStart,
                    separatorEnd,
                    correctionPrompt,
                    payload.userId,
                    temp
                );

                if (Array.isArray(corrected) && corrected.length > 0) {
                    console.log("✅ Correction success");
                    return corrected;
                }else{
                    console.log("⚠️ After Correction, still invalid response from AI...")
                }
            }

            console.log("❌ Batch invalid — triggering retry");
            throw new Error("Batch invalid");

        } catch (err) {
            console.error("❌ Batch attempt failed:", err.message);
            throw err; // IMPORTANT → retry wrapper needs this
        }

    }, job.max_retries || 8);   // your MAX_ATTEMPTS moved here
}

/* --------------------------------------------------
       TRY → SANITIZE → CORRECT (same flow as single)
    -------------------------------------------------- */
async function attemptBatch(separatorStart, separatorEnd, prompt, userId, _temp) {

    const raw = await executeLLMDirect(
        userId,
        prompt,
        _temp
    );

    console.log("RAW RESPONSE :::: ", raw);

    console.log("Start count:", (raw.match(/PROBLEM_START/g) || []).length);
    console.log("End count:", (raw.match(/PROBLEM_END/g) || []).length);

    const hasOutput = raw && raw.trim().length > 20;
    if(!hasOutput){
        return {needFix:true,badOutput:raw}
    }

    const startRegex = /={3,}\s*PROBLEM_START\s*={3,}/gi;
    const endRegex = /={3,}\s*PROBLEM_END\s*={3,}/gi;

    const chunks = raw
        .split(startRegex)
        .slice(1)
        .map(part => part.split(endRegex)[0])
        .map(x => x?.trim())
        .filter(Boolean);

    // const chunks = raw
    //     .split(separatorStart)
    //     .map(x => x.split(separatorEnd)[0])
    //     .map(x => x.trim())
    //     .filter(Boolean);

    let results = [];
    let invalidChunks = [];

    console.log("TOTAL CHUNK SIZE:::::::", chunks.length)
    for (let chunk of chunks) {
        console.log("Raw Chunk ::: ", chunk);

        let sections = parseSections(chunk);

        if (!isValidProblemSections(sections)) {
            console.log("❌ Invalid chunk, trying sanitize...");

            const sanitized = sanitizeLLMOutput(chunk);
            console.log("Sanitized Chunk ::: ", sanitized);
            sections = parseSections(sanitized);

            if (!isValidProblemSections(sections)) {
                console.log("❌ Still invalid after sanitize");
                invalidChunks.push(chunk);   // ❗ collect bad ones
                continue;                   // ❗ skip, don’t kill batch
            }
        }
        console.log("INVALID CHUNKS SIZE:::::: ",invalidChunks.length)
        results.push({
            title: sections.TITLE?.join("\n").trim() || "DSA Practice Problem",
            problem: sections.PROBLEM?.join("\n").trim() || "",
            constraints: sections.CONSTRAINTS?.join("\n").trim() || "",
            hints: (sections.HINTS || [])
                .map(h => h.trim())
                .filter(h =>
                    h.startsWith("-") ||
                    h.startsWith("*") ||
                    /^\d+\./.test(h)
                )
                .map(h =>
                    h
                        .replace(/^[-*]\s*/, "")     // remove "-" or "*"
                        .replace(/^\d+\.\s*/, "")    // remove "1. "
                        .trim()
                ),
            difficulty: sections.DIFFICULTY?.join("\n").trim() || "",
            pattern: sections.PATTERN?.join("\n").trim() || "",
            solution: {
                explanation: sections.SOLUTION_EXPLANATION?.join("\n").trim() || "",
                java: sections.JAVA?.join("\n").trim() || "",
                python: sections.PYTHON?.join("\n").trim() || "",
                time: sections.TIME?.join("\n").trim() || "",
                space: sections.SPACE?.join("\n").trim() || ""
            },
            java_starter: sections.JAVA_STARTER?.join("\n").trim() || "",
            python_starter: sections.PYTHON_STARTER?.join("\n").trim() || "",
            javascript_starter: sections.JAVASCRIPT_STARTER?.join("\n").trim() || "",
            csharp_starter: sections.CSHARP_STARTER?.join("\n").trim() || ""
        });
    }

    // ✅ If we got some good problems, return them
    if (results.length > 0) {
        console.log(`✅ Batch partial/full success: ${results.length}`);
        return results;
    }

    // ❌ All chunks failed → need correction
    console.log("❌ Entire batch invalid, needs correction");
    return { needFix: true, badOutput: raw };
}


async function runRegenerateProblemSolution(job, payload) {

    return await retry(async (attempt) => {

        console.log(`AI Job ${job.id} and function name runRegenerateProblemSolution with attempt ${attempt + 1}`);

        try {
            const raw = await executeLLMDirect(
                payload.userId,
                payload.prompt,
                payload.temp
            );

            const sections = parseSections(raw);

            const java = sections.JAVA?.join("\n").trim() || "";
            const python = sections.PYTHON?.join("\n").trim() || "";

            const bad =
                !java ||
                !python ||
                java.includes("TODO") ||
                java.includes("logic here") ||
                java.length < 120 ||
                python.length < 80;

            if (!bad) {
                console.log("✅ Solution regenerated successfully");
                return {
                    solution: {
                        explanation:
                            sections.SOLUTION_EXPLANATION?.join("\n").trim() || "",
                        java,
                        python,
                        time: sections.TIME?.join("\n").trim() || "",
                        space: sections.SPACE?.join("\n").trim() || ""
                    }
                };
            } else{
                console.error("Solution Regeneration Invalid !!")
                throw new Error("Invalid Solution generated. Retrying.... "); // IMPORTANT → retry wrapper needs this
            }

        } catch (err) {
            console.error("❌ Batch attempt failed:", err.message);
            throw err; // IMPORTANT → retry wrapper needs this
        }

    }, job.max_retries || 4);   // your MAX_ATTEMPTS moved here
}

function safeParseJSON(text) {

    try {
        return JSON.parse(text);
    } catch {

        try {
            console.log("RAW RESPONSE::: ",text);
            const cleaned = sanitizeAIResponse(text);
            console.log("CLEANED RESPONSE ::::: ", cleaned);
            return JSON.parse(cleaned);
        } catch {
            console.error("JSON parse failed");
            return {};
        }
    }
}

module.exports = {
    processJob
};
