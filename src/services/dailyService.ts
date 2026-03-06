import type { Problem } from "../types/problem";

export function getTodayProblems(
    mode: "normal" | "interview" = "normal"
): Promise<Problem[]> {
    return window.api.getTodayProblems(mode);
}
