const db = require("../../database/database");
const { convertTestCases } = require("./testCaseConverter");

/**
 * =====================================================
 * LOAD EXECUTION META
 * =====================================================
 */
function loadExecutionMeta(problemId, language) {

    const row = db.prepare(`
        SELECT execution_metadata
        FROM problem_code_templates
        WHERE problem_id = ?
          AND language = ?
    `).get(problemId, language);

    if (!row?.execution_metadata) {
        throw new Error("Execution metadata not found");
    }

    return JSON.parse(row.execution_metadata);
}


/**
 * =====================================================
 * SANITIZE USER CODE
 * Remove existing drivers safely
 * =====================================================
 */
function sanitizeUserCode(code = "", language) {

    if (!code) return "";

    let cleaned = code;

    /**
     * JS
     */
    if (language === "javascript") {

        cleaned = cleaned.replace(/console\.log\(.*\);?/gi, "");

        cleaned = cleaned.replace(
            /(async\s+)?function\s+main\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
            ""
        );
    }

    /**
     * PYTHON
     */
    if (language === "python") {

        cleaned = cleaned.replace(
            /if\s+__name__\s*==\s*["']__main__["']:[\s\S]*/gi,
            ""
        );
    }

    /**
     * JAVA
     */
    if (language === "java") {

        cleaned = cleaned.replace(
            /(public|private|protected)?\s*static\s+void\s+main\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
            ""
        );
    }

    /**
     * C#
     */
    if (language === "dotnet") {

        cleaned = cleaned.replace(
            /(public|private|protected)?\s*(static\s+)?void\s+Main\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
            ""
        );
    }

    return cleaned.trim();
}


/**
 * =====================================================
 * VARIABLE HELPERS
 * =====================================================
 */
function extractVariableNames(variables = []) {

    return variables
        .map(v => {

            const match =
                v.match(/([A-Za-z_][A-Za-z0-9_]*)\s*=/);

            return match ? match[1] : null;

        })
        .filter(Boolean);
}

function mapArgsFromVariables(variables = []) {

    const names = extractVariableNames(variables);

    return names.join(", ");
}


/**
 * =====================================================
 * JAVASCRIPT DRIVER
 * =====================================================
 */
function buildJS(userCode, execution, testCase) {

    const tc = convertTestCases("javascript", testCase);

    const variables = (tc.variables || []).join("\n");

    const entry = execution.entry;

    /**
     * FUNCTION MODE
     */
    if (execution.type === "function") {

        const args = mapArgsFromVariables(tc.variables);

        return `
${userCode}

(async () => {
try {

${variables}

const result = await Promise.resolve(${entry}(${args}));

if (typeof result === "object") {
    console.log(JSON.stringify(result));
} else {
    console.log(result);
}

} catch (e) {
    console.error("ERROR:", e?.message || e);
}
})();
`;
    }

    /**
     * CLASS MODE
     * (operation based like Trie / LRU)
     */
    return `
${userCode}

(async () => {
try {

${variables}

/**
 * If user defined result variable → print it
 */
if (typeof result !== "undefined") {

    if (typeof result === "object") {
        console.log(JSON.stringify(result));
    } else {
        console.log(result);
    }

} else {
    console.log("undefined");
}

} catch (e) {
    console.error("ERROR:", e?.message || e);
}
})();
`;
}


/**
 * =====================================================
 * PYTHON DRIVER
 * =====================================================
 */
function buildPython(userCode, execution, testCase) {

    const tc = convertTestCases("python", testCase);

    const variables = tc.variables.join("\n        ");

    const args = mapArgsFromVariables(tc.variables);

    const entry = execution.entry;

    if (execution.type === "class") {

        return `
${userCode}

if __name__ == "__main__":
    try:

        ${variables}

        obj = ${entry}()

        print(obj)

    except Exception as e:
        print("ERROR:", e)
`;
    }

    /**
     * FUNCTION
     */
    return `
${userCode}

if __name__ == "__main__":
    try:

        ${variables}

        result = ${entry}(${args})

        print(result)

    except Exception as e:
        print("ERROR:", e)
`;
}

/**
 * =====================================================
 * JAVA DRIVER (CLEAN + STABLE)
 * =====================================================
 */

function removeJavaMain(code = "") {
    return code.replace(
        /(public|private|protected)?\s*static\s+void\s+main\s*\([^)]*\)\s*\{[\s\S]*?\}/gi,
        ""
    );
}

function removePublicFromUserClasses(code) {
    return code.replace(/public\s+class\s+/g, "class ");
}

function validateJavaTestCase(variables = [], methodName) {

    const hasMethodCall =
        variables.some(v => v.includes(`${methodName}(`));

    if (!hasMethodCall) {
        throw new Error(
            "Invalid test case: must assign result using method call"
        );
    }
}

function buildJava(userCode, execution, testCase) {

    if (!execution?.entry) {
        throw new Error("Execution entry missing");
    }

    if (execution.type === "function" && !execution.method) {
        throw new Error("Execution method missing");
    }

    // Clean user code safely
    userCode = removeJavaMain(userCode);
    userCode = removePublicFromUserClasses(userCode);

    const tc = convertTestCases("java", testCase);

    const rawVariables = tc.variables || [];
    const variablesBlock = rawVariables.join("\n            ");

    const entryClass = execution.entry;
    const methodName = execution.method;
    const isClassType = execution.type === "class";

    if (!isClassType) {
        validateJavaTestCase(rawVariables, methodName);
    }

    /**
     * -------------------------------------------------
     * CLASS TYPE (Trie, LRU etc)
     * Expect result already assigned inside variables
     * -------------------------------------------------
     */
    if (isClassType) {
        return `
${userCode}

public class __Driver__ {

    public static void main(String[] args) {

        try {

            ${variablesBlock}

            try {
                System.out.println(result);
            } catch (Exception e) {
                System.out.println("undefined");
            }

        } catch (Throwable t) {
            t.printStackTrace();
        }
    }
}
`;
    }

    /**
     * -------------------------------------------------
     * FUNCTION TYPE
     * Deterministic reflection (safe)
     * -------------------------------------------------
     */
    const argNames = extractVariableNames(rawVariables);

    const paramList =
        argNames.length > 0
            ? ", " + argNames.join(", ")
            : "";

    return `
${userCode}

public class __Driver__ {

    public static void main(String[] args) {

        try {

            ${variablesBlock}

            Class<?> clazz = Class.forName("${entryClass}");
            Object obj = clazz.getDeclaredConstructor().newInstance();

            java.lang.reflect.Method target = null;

            for (java.lang.reflect.Method m : clazz.getDeclaredMethods()) {
                if (m.getName().equals("${methodName}")) {
                    target = m;
                    break;
                }
            }

            if (target == null) {
                throw new RuntimeException("Method not found");
            }

            Object result = java.lang.reflect.Modifier.isStatic(target.getModifiers())
                ? target.invoke(null${paramList})
                : target.invoke(obj${paramList});

            if (result instanceof int[]) {
                System.out.println(java.util.Arrays.toString((int[]) result));
            } else if (result instanceof long[]) {
                System.out.println(java.util.Arrays.toString((long[]) result));
            } else if (result instanceof double[]) {
                System.out.println(java.util.Arrays.toString((double[]) result));
            } else if (result instanceof Object[]) {
                System.out.println(java.util.Arrays.deepToString((Object[]) result));
            } else {
                System.out.println(result);
            }

        } catch (Throwable t) {
            t.printStackTrace();
        }
    }
}
`;
}


/**
 * =====================================================
 * C# DRIVER
 * =====================================================
 */
function buildCsharp(userCode, execution, testCase) {

    const tc = convertTestCases("dotnet", testCase);

    const variables = tc.variables.join("\n        ");

    const args = mapArgsFromVariables(tc.variables);

    const entry = execution.entry;

    /**
     * CLASS
     */
    if (execution.type === "class") {

        return `
${userCode}

public class Program
{
    public static void Main(string[] args)
    {
        try
        {
            ${variables}

            var obj = new ${entry}();

            Console.WriteLine(obj);
        }
        catch (Exception e)
        {
            Console.WriteLine(e.Message);
        }
    }
}
`;
    }

    /**
     * FUNCTION
     */
    return `
${userCode}

public class Program
{
    public static void Main(string[] args)
    {
        try
        {
            ${variables}

            var obj = new Program();

            var result = obj.${entry}(${args});

            Console.WriteLine(result);
        }
        catch (Exception e)
        {
            Console.WriteLine(e.Message);
        }
    }
}
`;
}

/**
 * =====================================================
 * EXECUTION ENTRY
 * =====================================================
 */
function injectDriverReflection(
    problemId,
    language,
    userCode,
    testCase
) {

    /**
     * -------------------------------------------------
     * NORMAL MODE (WITH DRIVER + TEST CASE)
     * -------------------------------------------------
     */

    const meta =
        loadExecutionMeta(problemId, language);

    const execution = meta.execution;

    const cleanCode =
        sanitizeUserCode(userCode, language);

    switch (language) {

        case "javascript":
            return buildJS(cleanCode, execution, testCase);

        case "python":
            return buildPython(cleanCode, execution, testCase);

        case "java":
            return buildJava(cleanCode, execution, testCase);

        case "dotnet":
            return buildCsharp(cleanCode, execution, testCase);

        default:
            throw new Error("Unsupported language");
    }
}

module.exports = {
    injectDriverReflection
};