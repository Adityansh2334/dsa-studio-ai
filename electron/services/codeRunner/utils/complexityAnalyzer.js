/**
 * =========================================
 * Complexity Analyzer
 * =========================================
 *
 * Provides heuristic time complexity estimation.
 * Works across JS, Python, Java, C#.
 */

/**
 * =========================================
 * Detect Loops
 * =========================================
 */
function countLoops(code) {
    const loopPatterns = [
        /for\s*\(/g,          // JS / Java / C#
        /while\s*\(/g,
        /for\s+.*in\s+/g,     // Python
        /for\s+.*:/g          // Python colon loop
    ];

    let count = 0;

    for (const pattern of loopPatterns) {
        const matches = code.match(pattern);
        if (matches) count += matches.length;
    }

    return count;
}

/**
 * =========================================
 * Detect Recursion
 * =========================================
 */
function detectRecursion(code) {
    const functionNameMatch =
        code.match(/function\s+(\w+)/) ||
        code.match(/def\s+(\w+)/) ||
        code.match(/public\s+.*\s+(\w+)\s*\(/);

    if (!functionNameMatch) return false;

    const name = functionNameMatch[1];

    const recursionRegex = new RegExp(`\\b${name}\\s*\\(`, "g");

    const matches = code.match(recursionRegex);

    return matches && matches.length > 1;
}

/**
 * =========================================
 * Detect Nested Loops
 * =========================================
 */
function detectNestedLoops(code) {
    const lines = code.split("\n");

    let depth = 0;
    let maxDepth = 0;

    for (const line of lines) {
        if (line.includes("for") || line.includes("while")) {
            depth++;
            if (depth > maxDepth) maxDepth = depth;
        }

        if (line.includes("}")) {
            depth = Math.max(0, depth - 1);
        }
    }

    return maxDepth;
}

/**
 * =========================================
 * Estimate Complexity
 * =========================================
 */
function estimateComplexity(code) {
    const loops = countLoops(code);
    const nested = detectNestedLoops(code);
    const recursion = detectRecursion(code);

    if (recursion && nested > 1) {
        return "O(2^n)";
    }

    if (recursion) {
        return "O(n)";
    }

    if (nested >= 3) {
        return "O(n³)";
    }

    if (nested === 2) {
        return "O(n²)";
    }

    if (loops === 1) {
        return "O(n)";
    }

    if (loops === 0) {
        return "O(1)";
    }

    return "O(n)";
}

/**
 * =========================================
 * Space Complexity (Basic)
 * =========================================
 */
function estimateSpace(code) {
    if (code.includes("new Array") || code.includes("[]")) {
        return "O(n)";
    }

    if (code.includes("map") || code.includes("dict")) {
        return "O(n)";
    }

    return "O(1)";
}

/**
 * =========================================
 * Full Analysis
 * =========================================
 */
function analyzeComplexity(code) {
    const time = estimateComplexity(code);
    const space = estimateSpace(code);

    return {
        time,
        space
    };
}

/**
 * =========================================
 */

module.exports = {
    analyzeComplexity
};