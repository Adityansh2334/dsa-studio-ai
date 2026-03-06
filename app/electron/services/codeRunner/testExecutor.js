
const { runNode } = require("./runners/nodeRunner");
const { runPython } = require("./runners/pythonRunner");
const { runJava } = require("./runners/javaRunner");
const { runDotnet } = require("./runners/dotnetRunner");
const {injectDriverReflection} = require("./aiWorks/driverInjector");
const db = require("../database/database");

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
 * =========================================
 * Normalize Output
 * =========================================
 */
function normalize(value) {
    if (value === null || value === undefined) return "";

    try {
        if (typeof value === "string") {
            let str = String(value).trim();

            // remove all spaces inside arrays / objects
            str = str.replace(/\s+/g, "");

            return str;
        }

        return JSON.stringify(JSON.parse(value));
    } catch {
        return String(value).trim();
    }
}

/**
 * =========================================
 * Compare Expected vs Actual
 * =========================================
 */
function compareOutput(expected, actual) {
    const e = normalize(expected);
    const a = normalize(actual);

    return e === a;
}

/**
 * =========================================
 * Run Single Test (Run Button)
 * =========================================
 */
async function runSingleTest({ language, userCode, problemId }) {

    try {

        console.log("RUNNABLE CODE :::::: ", userCode);

        db.prepare(`
            UPDATE problem_code_templates
            SET template_code = ?
            WHERE problem_id = ? AND language = ?
        `)
        .run(userCode, problemId, language);

        const result =
            await executeCode(language, userCode);

        return {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            error: result.error,
            combined: result.combined,
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
 * Run Multiple Tests (Submit Button)
 * =========================================
 */
async function runAllTests({ problemId, language, userCode, testCases }) {

    const results = [];
    let passedCount = 0;

    /**
     * 1️⃣ Build sanitized template once
     */
    const sanitizedCode = stripUserDriver(language, userCode);

    console.log("SANITIZED CODE :::::: ", sanitizedCode);

    for (let i = 0; i < testCases.length; i++) {

        const test = testCases[i];

        /**
         * 2️⃣ Inject SINGLE test case
         */
        const runnableCode = injectDriverReflection(
            problemId,
            language,
            sanitizedCode,
            test   // single object
        );

        console.log("RUNNABLE CODE :::::: ", runnableCode);

        const execution = await executeCode(language, runnableCode);

        let actualOutput = null;

        if (execution.success) {
            actualOutput = execution.stdout.trim();
        }

        const passed = execution.success &&
            compareOutput(test.expected, actualOutput);

        if (passed) passedCount++;

        results.push({
            input: test.variables,
            expected: test.expected,
            actual: actualOutput,
            passed,
            error: execution.error || execution.stderr || null
        });
    }

    return {
        passedCount,
        total: testCases.length,
        results
    };
}

/**
 * =========================================
 */
function stripUserDriver(language, code) {

    if (!code) return code;

    switch (language) {

        case "javascript": {

            const lines = code.split("\n");

            const filtered = lines.filter(line => {

                const l = line.trim();

                if (!l) return true;

                /**
                 * Remove console logs
                 */
                if (/console\.log\s*\(/i.test(l)) return false;

                /**
                 * Remove driver comments
                 */
                if (/\/\/\s*driver/i.test(l)) return false;

                return true;
            });

            return filtered.join("\n").trim();
        }

        case "python":
            return code
                .replace(/if\s+__name__\s*==\s*["']__main__["'][\s\S]*$/i, "")
                .trim();


        case "java":
            return removeMainMethod(code, language);


        case "dotnet":
            return removeMainMethod(code, language);


        default:
            return code;
    }
}

/**
 * =========================================
 * Remove Main Method (Java / C# Safe)
 * =========================================
 */

function removeMainMethod(code, language) {

    if (!code) return code;

    let mainRegex;

    switch (language) {

        case "java":
            mainRegex = /public\s+static\s+void\s+main\s*\(/i;
            break;

        case "dotnet":
        case "csharp":
            mainRegex = /\b(public\s+)?static\s+(async\s+)?(void|Task)\s+Main\s*\(/i;
            break;

        default:
            return code;
    }

    const match = code.match(mainRegex);

    if (!match) return code;

    const startIndex = match.index;

    /**
     * Find opening brace of method
     */
    const braceStart = code.indexOf("{", startIndex);

    if (braceStart === -1) return code;

    /**
     * Brace counter to find exact method end
     */
    let depth = 1;
    let i = braceStart + 1;

    while (i < code.length && depth > 0) {

        if (code[i] === "{") depth++;
        else if (code[i] === "}") depth--;

        i++;
    }

    const methodEnd = i;

    /**
     * Remove method safely
     */
    const before = code.substring(0, startIndex);
    const after = code.substring(methodEnd);

    let cleaned = before + after;

    /**
     * Cleanup extra blank lines
     */
    cleaned = cleaned
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();

    return cleaned;
}

module.exports = {
    runSingleTest,
    runAllTests,
    stripUserDriver
};