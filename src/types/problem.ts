export interface Problem {
    id: number;

    /* DB fields */
    date?: string;              // YYYY-MM-DD
    mode?: "normal" | "interview";

    title: string;
    difficulty: string;
    pattern: string;

    /* Stored JSON from AI */
    content: string;

    /* Progress */
    solved?: number;            // 0 | 1 (from DB)

    /* Metadata */
    created_at?: string;        // ISO timestamp

    interview_context?: string;
}
