function isValidProblemSections(sections) {
    if (!sections) return false;

    const join = key => (sections[key] || []).join("\n").trim();

    const title = join("TITLE");
    const problem = join("PROBLEM");
    const explanation = join("SOLUTION_EXPLANATION");
    const java = join("JAVA");
    const python = join("PYTHON");
    const difficulty = join("DIFFICULTY");
    const pattern = join("PATTERN");

    // --- Required Content Checks ---
    const hasTitle = title.length > 5;
    const hasProblem = problem.length > 50;
    const hasExplanation = explanation.length > 40;
    const hasJava = java.length > 20;
    const hasPython = python.length > 20;
    const hasDifficulty = difficulty.length > 2;
    const hasPattern = pattern.length > 2;

    // --- Example validation inside PROBLEM ---
    const hasExample =
        problem.includes("Example:") &&
        problem.includes("Input:") &&
        problem.includes("Output:");

    return (
        hasTitle &&
        hasProblem &&
        hasExample &&
        hasExplanation &&
        hasJava &&
        hasPython &&
        hasDifficulty &&
        hasPattern
    );
}


module.exports = { isValidProblemSections };
