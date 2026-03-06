const db = require("../database/database");

/**
 * =====================================================
 * STRIP CODE FENCES ```java ```python etc
 * =====================================================
 */
function stripCodeFences(code = "") {

    if (!code) return "";

    return code
        .replace(/```[\w]*/g, "")
        .replace(/```/g, "")
        .trim();
}


/**
 * =====================================================
 * NORMALIZE CODE
 * =====================================================
 */
function normalizeCode(code = "") {

    return code
        .replace(/\r/g, "")
        .replace(/\t/g, "    ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


/**
 * =====================================================
 * LANGUAGE SPECIFIC FIX
 * =====================================================
 */
function languageFix(language, code = "") {

    if (!code) return code;

    switch (language) {

        case "python":

            if (code.includes("List[") &&
                !code.includes("from typing import")) {

                code = "from typing import List\n\n" + code;
            }

            break;

        case "dotnet":

            if (!/using\s+System\s*;/.test(code)) {
                code = "using System;\n\n" + code;
            }

            break;
    }

    return code;
}


/**
 * =====================================================
 * DETECT EXECUTION TYPE (CRITICAL)
 * function OR class problem
 * =====================================================
 */
function detectExecutionMeta(code = "", language) {

    if (!code) {
        return {
            type: "function",
            entry: "Solution",
            method: null
        };
    }

    code = code.trim();

    /**
     * =====================================================
     * JAVASCRIPT / PYTHON
     * =====================================================
     */
    if (language === "javascript" || language === "python") {

        // Detect class
        const classMatch = code.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);

        if (classMatch) {

            const className = classMatch[1];

            return {
                type: "class",
                entry: className,
                method: null
            };
        }

        // Detect function
        const fnMatch =
            code.match(/function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/) ||
            code.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);

        if (fnMatch) {
            return {
                type: "function",
                entry: fnMatch[1],
                method: null
            };
        }

        return {
            type: "function",
            entry: null,
            method: null
        };
    }

    /**
     * =====================================================
     * JAVA
     * =====================================================
     */
    if (language === "java") {

        const classMatch =
            code.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);

        if (!classMatch) {
            throw new Error("No Java class found");
        }

        const className = classMatch[1];

        // Detect first non-main method
        const methodRegex =
            /(public|private|protected)?\s+(static\s+)?[A-Za-z0-9_<>\[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

        let match;
        let detectedMethod = null;

        while ((match = methodRegex.exec(code)) !== null) {

            const name = match[3];

            if (name !== "main") {
                detectedMethod = name;
                break;
            }
        }

        if (detectedMethod) {
            return {
                type: "function",
                entry: className,
                method: detectedMethod
            };
        }

        return {
            type: "class",
            entry: className,
            method: null
        };
    }

    /**
     * =====================================================
     * C#
     * =====================================================
     */
    if (language === "dotnet") {

        const classMatch =
            code.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);

        if (!classMatch) {
            throw new Error("No C# class found");
        }

        const className = classMatch[1];

        const methodRegex =
            /(public|private|protected)?\s+(static\s+)?[A-Za-z0-9_<>\[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

        let match;
        let detectedMethod = null;

        while ((match = methodRegex.exec(code)) !== null) {

            const name = match[3];

            if (name !== "Main") {
                detectedMethod = name;
                break;
            }
        }

        if (detectedMethod) {
            return {
                type: "function",
                entry: className,
                method: detectedMethod
            };
        }

        return {
            type: "class",
            entry: className,
            method: null
        };
    }

    throw new Error("Unsupported language");
}


/**
 * =====================================================
 * METADATA INFERENCE FROM STARTER
 * =====================================================
 */
function inferMetadataFromStarter(code = "", language, execution = null) {

    /**
     * ===============================
     * CLASS PROBLEMS
     * ===============================
     */
    if (execution?.type === "class") {

        return {
            functionName: execution.entry,
            parameters: [],
            returnType: "class"
        };
    }

    /**
     * ===============================
     * FUNCTION PROBLEMS
     * ===============================
     */

    let functionName = "solution";
    let parameters = [];
    let returnType = "void";

    if (!code) {
        return { functionName, parameters, returnType };
    }

    /**
     * JAVASCRIPT
     */
    if (language === "javascript") {

        const fnMatch =
            code.match(/function\s+(\w+)\s*\(([^)]*)\)/) ||
            code.match(/(\w+)\s*\(([^)]*)\)\s*\{/);

        if (fnMatch) {

            functionName = fnMatch[1];

            parameters = fnMatch[2]
                .split(",")
                .map(p => p.trim())
                .filter(Boolean)
                .map(name => ({
                    name,
                    type: "any",
                    category: "primitive"
                }));
        }
    }

    /**
     * PYTHON
     */
    if (language === "python") {

        const fnMatch =
            code.match(/def\s+(\w+)\s*\(([^)]*)\)/);

        if (fnMatch) {

            functionName = fnMatch[1];

            parameters = fnMatch[2]
                .split(",")
                .map(p => p.trim())
                .filter(p => p && p !== "self")
                .map(name => ({
                    name,
                    type: "any",
                    category: "primitive"
                }));
        }
    }

    /**
     * JAVA / C#
     */
    if (language === "java" || language === "dotnet") {

        const methodMatch =
            code.match(
                /(public|private|protected)?\s+\w+\s+(\w+)\s*\(([^)]*)\)/
            );

        if (methodMatch) {

            functionName = methodMatch[2];

            parameters = methodMatch[3]
                .split(",")
                .map(p => p.trim())
                .filter(Boolean)
                .map(p => {

                    const parts = p.split(" ");

                    return {
                        name: parts.pop(),
                        type: parts.join(" "),
                        category: "primitive"
                    };
                });
        }
    }

    return {
        functionName,
        parameters,
        returnType
    };
}


/**
 * =====================================================
 * EXTRACT STARTER FROM PROBLEM JSON
 * =====================================================
 */
function extractStarterTemplate(problem, language) {

    let raw = "";

    switch (language) {

        case "java":
            raw = problem.javaStarter;
            break;

        case "python":
            raw = problem.pythonStarter;
            break;

        case "javascript":
            raw = problem.javascriptStarter;
            break;

        case "dotnet":
            raw = problem.csharpStarter;
            break;

        default:
            throw new Error("Unsupported language");
    }

    if (!raw) {
        throw new Error(`Starter template not found for ${language}`);
    }

    let code = stripCodeFences(raw);

    code = normalizeCode(code);

    code = languageFix(language, code);

    /**
     * EXECUTION TYPE
     */
    const execution =
        detectExecutionMeta(code, language);

    /**
     * METADATA
     */
    const metadata =
        inferMetadataFromStarter(code, language, execution);

    return {
        template: code,
        execution,
        metadata
    };
}


/**
 * =====================================================
 * GET TEMPLATE (MAIN)
 * =====================================================
 */
async function getTemplate(userId, problemId, language, problem) {

    /**
     * 1️⃣ CHECK CACHE
     */
    const existing = db
        .prepare(`
            SELECT template_code, execution_metadata
            FROM problem_code_templates
            WHERE problem_id = ?
            AND language = ?
        `)
        .get(problemId, language);

    if (existing?.template_code && existing?.execution_metadata) {

        const parsed =
            JSON.parse(existing.execution_metadata);

        return {
            template: existing.template_code,
            metadata: parsed?.metadata,
            execution: parsed?.execution
        };
    }

    /**
     * 2️⃣ EXTRACT FROM PROBLEM JSON
     */
    const {
        template,
        metadata,
        execution
    } = extractStarterTemplate(problem, language);

    /**
     * EXECUTION SCHEMA OBJECT
     */
    const executionMetadata = {
        metadata,
        execution
    };

    /**
     * 3️⃣ STORE CACHE
     */
    db.prepare(`
        INSERT INTO problem_code_templates
            (problem_id, language, template_code, execution_metadata)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(problem_id, language)
        DO UPDATE SET
            template_code = excluded.template_code,
            execution_metadata = excluded.execution_metadata
    `).run(
        problemId,
        language,
        template,
        JSON.stringify(executionMetadata)
    );

    /**
     * 4️⃣ RETURN
     */
    return {
        template,
        metadata,
        execution
    };
}


module.exports = {
    getTemplate
};