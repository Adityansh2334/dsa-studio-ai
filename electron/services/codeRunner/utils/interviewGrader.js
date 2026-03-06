const { analyzeComplexity } = require("./complexityAnalyzer");

/**
 * =========================================
 * Score Based on Test Results
 * =========================================
 */
function scoreTests(testResult) {
    if (!testResult || !testResult.total) return 0;

    const ratio = testResult.passedCount / testResult.total;

    if (ratio === 1) return 100;
    if (ratio >= 0.75) return 80;
    if (ratio >= 0.5) return 60;
    if (ratio >= 0.25) return 40;

    return 20;
}

/**
 * =========================================
 * Score Code Quality (Heuristic)
 * =========================================
 */
function scoreCodeQuality(code) {
    let score = 50;

    if (code.length > 120) score += 10;
    if (code.includes("for") || code.includes("while")) score += 10;
    if (code.includes("if")) score += 5;
    if (code.includes("return")) score += 5;

    if (code.includes("console.log")) score -= 5;
    if (code.includes("TODO")) score -= 10;

    return Math.min(100, Math.max(0, score));
}

/**
 * =========================================
 * Complexity Score
 * =========================================
 */
function scoreComplexity(complexity) {
    if (!complexity) return 50;

    const time = complexity.time || "";

    if (time.includes("O(1)")) return 90;
    if (time.includes("O(n)")) return 85;
    if (time.includes("O(n log")) return 80;
    if (time.includes("O(n²)")) return 60;
    if (time.includes("O(2")) return 40;

    return 70;
}

/**
 * =========================================
 * Final Decision
 * =========================================
 */
function decideHire(totalScore) {
    if (totalScore >= 85) return "Strong Hire";
    if (totalScore >= 70) return "Hire";
    if (totalScore >= 55) return "Borderline";
    return "Prone to fail";
}

/**
 * =========================================
 * Generate Feedback
 * =========================================
 */
function generateFeedback({ testScore, qualityScore, complexityScore }) {
    const feedback = [];

    if (testScore < 80) {
        feedback.push("Improve correctness — some test cases are failing.");
    } else {
        feedback.push("Good correctness across test cases.");
    }

    if (qualityScore < 60) {
        feedback.push("Code readability can be improved.");
    } else {
        feedback.push("Code structure is reasonably clear.");
    }

    if (complexityScore < 70) {
        feedback.push("Consider optimizing time complexity.");
    } else {
        feedback.push("Time complexity looks efficient.");
    }

    return feedback.join(" ");
}

/**
 * =========================================
 * Main Interview Evaluation
 * =========================================
 */
function evaluateInterview({ code, testResult }) {

    const complexity = analyzeComplexity(code);

    const testScore = scoreTests(testResult);
    const qualityScore = scoreCodeQuality(code);
    const complexityScore = scoreComplexity(complexity);

    const totalScore =
        Math.round(
            (testScore * 0.5) +
            (qualityScore * 0.25) +
            (complexityScore * 0.25)
        );

    const decision = decideHire(totalScore);

    const feedback = generateFeedback({
        testScore,
        qualityScore,
        complexityScore
    });

    return {
        score: totalScore,
        decision,
        feedback,
        complexity
    };
}

/**
 * =========================================
 */

module.exports = {
    evaluateInterview
};