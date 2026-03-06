export {};

declare global {
    interface Window {
        api: {
            /**
             * Fetch today's problems
             * @param mode "normal" | "interview"
             */
            getTodayProblems: (
                mode?: "normal" | "interview"
            ) => Promise<any[]>;

            regenerateSolution: (problemId: number) => Promise<any>;

            markProblemSolved: (problemId: number) => Promise<any>;
            
            checkAIKeys: () => Promise<{boolean}>;
            saveAIKeys: (keys: {openRouterKey: string, hfKey: string, ollamaModel: string, mode: "online" | "offline", provider: "openrouter" | "hf" | "llama"}) => Promise<void>;

            register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<Profile>;
            login: (data: { email: string; password: string }) => Promise<Profile>;
            logout: () => Promise<void>;
            restoreSession: () => Promise<Profile | null>;
            updateUserPreferences: (data:any) => Promise<any>;
            getUserPreferences: () => Promise<any>;
            getUserProgress: () => Promise<any>;
            restartApp: () => void;
            updateInterviewPreferences: (data:any) => Promise<any>;

            prepareOfflineAI: (model: string) => Promise<any>;
            checkSystemForOllama:() => Promise<any>;
            downloadOfflineModel: (model: string) => Promise<any>;
            onOllamaProgress: (cb: (d: any) => void) => void;
            onOllamaStatus: (cb: (d: any) => void) => void;

            downloadProblemPdf: ({problem: any, content: any}) => Promise<any>;
            listenProblemStream: () => void;
            onProblemGenerated: (cb: (problem: any) => void) => void;
            removeProblemListener: () => void;

            loadProblemChat: (problemId: number) => Promise<any[]>;
            getPatterns: () => Promise<any[]>;

            getInterviewContexts: () => Promise<any[]>;
            deleteInterviewContext: (context: string) => Promise<any>;

            logError: (msg: string) => void;
            exportErrorLogs: () => Promise<{ success: boolean; path?: string; error?: any }>;

            validateOpenRouterApiKey: (apiKey: string) => Promise<{ valid: boolean; reason?: string }>;
            validateHFKey: (apiKey: string) => Promise<{ valid: boolean; reason?: string }>;

            cancelOfflineModelDownload: (model: string) => Promise<any>;

            askProblemAIStream: (payload: any, onToken: (token: string) => void) => Promise<any>;

            getUserLimitCount: (mode: "normal" | "interview") => Promise<number>;
            getProblemsCount: (interviewContext?: string) => Promise<number>;

            resetPassword: (data: {email:string, password:string}) => Promise<any>;

            getUserAnalytics: () => Promise<any>;
            getAnalyticsAI: (data) => Promise<any>;
            getInsightHistory: () => Promise<any>;
            getUserProgression: () => Promise<any>;
            getOrGenerateVisualization: (data:any) => Promise<any>;

            listenGenerationStream: () => void;

            onGenerationStarted: (
                cb: (data: { limit: number, count:number }) => void
            ) => () => void;

            onGenerationProgress: (
                cb: (data: { count?: number }) => void
            ) => () => void;

            onGenerationFinished: (
                cb: () => void
            ) => () => void;

            codeRunner: (payload: any) => Promise<any>;
            codeSubmit: (payload: any) => Promise<any>;

            getTemplate: (data: any) => Promise<any>;

            getRuntimes: () => Promise<any>;

            getProblemById: (problemId: number) => Promise<any>;

        };
        electron: {
            ipcRenderer: {
                on: (channel: string, handler: (event: any, data: any) => void) => void;
                removeListener: (channel: string, handler: (event: any, data: any) => void) => void;
            };
        };
        logger: {
            log: (...args: any[]) => void;
            error: (...args: any[]) => void;
            warn: (...args: any[]) => void;
        };
    }
}
