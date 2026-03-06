/**
 * =========================================
 * Universal Test Case → Language Converter
 * Supports SINGLE or ARRAY input
 * =========================================
 */

function convertVariables(language, variables = []) {

    switch (language) {

        case "javascript":
            return variables.map(v =>
                v
                    .replace(/int\[\]/g, "let")
                    .replace(/int/g, "let")
                    .replace(/const\s+/g, "let ")

                    .replace(/;/g, "")
                    .replace(/^(\w+)\s*=/, "let $1 =")
            );

        case "python":
            return variables.map(v =>
                v
                    .replace(/int\[\]/g, "")
                    .replace(/int/g, "")
                    .replace(/let\s+/g, "")
                    .replace(/const\s+/g, "")
                    .replace(/;/g, "")
                    .replace(/\{([^}]*)}/g, "[$1]")
            );

        case "java":
            return variables.map(v =>
                v.trim().endsWith(";") ? v.trim() : v.trim() + ";"
            );

        case "dotnet":
            return variables.map(v => {

                let line = v.trim();

                // ensure semicolon
                if (!line.endsWith(";")) line += ";";

                return line;
            });

        default:
            return variables;
    }
}


/**
 * Convert function call
 */
function convertCall(language, call = "") {

    if (!call) return "";

    // JS does NOT use obj.
    if (language === "javascript") {
        return call.replace(/^obj\./, "");
    }

    // Python uses obj normally
    if (language === "python") {
        return call;
    }

    // Java / C#
    return call;
}


/**
 * Expected conversion
 */
function convertExpected(language, expected) {

    if (expected === null || expected === undefined) {
        return "";
    }

    // JS/Python stringify for comparison safety
    if (language === "javascript" || language === "python") {
        return String(expected);
    }

    return expected;
}


/**
 * Normalize ONE testcase
 */
function normalizeTestCase(language, tc) {

    return {
        variables: convertVariables(language, tc.variables || []),
        call: convertCall(language, tc.call || ""),
        expected: convertExpected(language, tc.expected)
    };
}


/**
 * =========================================
 * MAIN CONVERTER
 * Accepts:
 *  - Single object
 *  - Array of objects
 * =========================================
 */
function convertTestCases(language, cases) {

    if (!cases) return [];

    // SINGLE OBJECT
    if (!Array.isArray(cases)) {
        return normalizeTestCase(language, cases);
    }

    // ARRAY
    return cases.map(tc =>
        normalizeTestCase(language, tc)
    );
}


module.exports = {
    convertTestCases
};