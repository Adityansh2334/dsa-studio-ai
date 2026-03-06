const fs = require("fs");
const { executeSandbox } = require("../sandbox/sandbox");
const { EXECUTION_LIMITS, RUNTIMES } = require("../utils/constants");

async function runJava(code, input = "") {

    const java = RUNTIMES.java.java;
    const javac = RUNTIMES.java.javac;
    const gsonJarSource = RUNTIMES.java.gson;

    try {

        const gsonBuffer = fs.readFileSync(gsonJarSource);

        /**
         * SINGLE SANDBOX SESSION
         */
        const className = getJavaClassName(code);

        const result = await executeSandbox({

            commands: [
                { command: javac, args: [`${className}.java`] },
                { command: java, args: [className] }
            ],

            files: [
                { name: `${className}.java`, content: code },
                { name: "gson.jar", content: gsonBuffer }
            ],

            input,
            timeout: EXECUTION_LIMITS.timeout,
            memoryMB: EXECUTION_LIMITS.memory
        });

        return {
            success: !result.error && !result.stderr,
            stdout: result.stdout || "",
            stderr: result.stderr || "",
            error: result.error || null,
            combined: result.combined || null,
        };

    } catch (err) {

        return {
            success: false,
            stdout: "",
            stderr: "",
            error: err.message
        };

    }
}

/**
 * =========================================
 * GET PUBLIC CLASS NAME FROM JAVA CODE
 * =========================================
 *
 * Rules:
 * - Prefer public class
 * - Ignore comments
 * - Fallback to first class if no public class
 * - Default → Solution
 */
function getJavaClassName(code = "") {

    if (!code) return "Solution";

    /**
     * Remove comments (safe)
     */
    const cleaned = code
        .replace(/\/\/.*$/gm, "")               // single line
        .replace(/\/\*[\s\S]*?\*\//g, "");       // block

    /**
     * 1️⃣ Try public class first
     */
    const publicMatch =
        cleaned.match(/\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);

    if (publicMatch && publicMatch[1]) {
        return publicMatch[1].trim();
    }

    /**
     * 2️⃣ Fallback: any class
     */
    const classMatch =
        cleaned.match(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/);

    if (classMatch && classMatch[1]) {
        return classMatch[1].trim();
    }

    /**
     * 3️⃣ Default
     */
    return "Solution";
}

module.exports = { runJava };