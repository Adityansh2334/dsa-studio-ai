type GenerationState = {
    status: "idle" | "loading" | "done";
    promise?: Promise<any>;
    data?: any;
};

const store: Record<string, GenerationState> = {};

export function getGenerationState(problemId: string) {
    if (!store[problemId]) {
        store[problemId] = { status: "idle" };
    }
    return store[problemId];
}

export function startGeneration(problemId: string, generator: () => Promise<any>) {

    const state = getGenerationState(problemId);

    if (state.status === "loading") {
        return state.promise;
    }

    state.status = "loading";

    state.promise = generator()
        .then(res => {

            const actual = res?.data || res;   // 🔥 normalize once

            state.status = "done";
            state.data = actual;

            return actual;
        })
        .catch(err => {
            state.status = "idle";
            throw err;
        });

    return state.promise;
}


export function resetGeneration(problemId: string) {
    store[problemId] = { status: "idle" };
}
