import React from "react";

type State = {
    hasError: boolean;
    exporting: boolean;
    done: boolean;
};

export default class ErrorBoundary extends React.Component<any, State> {
    constructor(props: any) {
        super(props);
        this.state = {
            hasError: false,
            exporting: false,
            done: false
        };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: any) {
        console.error("RENDERER CRASH:", error);
        window.api.logError(error?.message || "Renderer crash");
    }

    async exportLogs() {
        this.setState({ exporting: true });

        const res = await window.api.exportErrorLogs();

        if (res?.success) {
            this.setState({ done: true });
        } else {
            showToast("Something wrong happened.", "error")
        }

        this.setState({ exporting: false });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="h-screen w-screen flex items-center justify-center app-bg text-white relative overflow-hidden">

                {/* Floating glow */}
                <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-indigo-500/20 blur-3xl rounded-full animate-pulse"/>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 blur-3xl rounded-full animate-pulse"/>

                <div className="
                    relative z-10
                    w-[520px]
                    bg-white/10 backdrop-blur-2xl
                    border border-white/20
                    rounded-3xl p-10
                    shadow-[0_40px_120px_rgba(0,0,0,0.7)]
                    text-center
                ">

                    <div className="text-6xl mb-6">😔</div>

                    <h1 className="text-2xl font-semibold mb-3">
                        We’re really sorry
                    </h1>

                    <p className="text-gray-400 mb-6 leading-relaxed">
                        DSA Self Prepare ran into an unexpected situation.
                        This is rare, but it can happen on complex systems.
                        <br/><br/>
                        You can restart the app, or help us improve by sending
                        anonymous log statistics.
                    </p>

                    <div className="flex gap-4 justify-center mt-8">

                        <button
                            onClick={() => window.api.restartApp()}
                            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/30"
                        >
                            🔄 Restart App
                        </button>

                        <button
                            onClick={() => this.exportLogs()}
                            disabled={this.state.exporting || this.state.done}
                            className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
                        >
                            {this.state.exporting
                                ? "Collecting logs..."
                                : this.state.done
                                    ? "Logs saved to Downloads ✓"
                                    : "📤 Send Statistics"}
                        </button>
                    </div>

                    {this.state.done && (
                        <p className="text-sm text-emerald-400 mt-6">
                            A file <b>dsa-app-error-logs.zip</b> was saved to your Downloads.
                            <br/>
                            Please send it to the developer for faster fixes.
                        </p>
                    )}

                    <p className="text-xs text-blue-600 mt-8">
                        We only collect log files from the app’s log directory.
                        No personal data is accessed.
                    </p>
                </div>
            </div>
        );
    }
}
