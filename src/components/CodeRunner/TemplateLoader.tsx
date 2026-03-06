import { useEffect, useState } from "react";

const TemplateLoader = () => {

    const [progress, setProgress] = useState(0);

    useEffect(() => {

        let raf: number;

        const animate = () => {
            setProgress(prev => {

                // Slowly approach 90%
                if (prev >= 90) return prev;

                const next = prev + (100 - prev) * 0.02;
                return next;
            });

            raf = requestAnimationFrame(animate);
        };

        raf = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(raf);

    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full gap-6">

            {/* Orb */}
            <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 blur-2xl opacity-30 animate-pulse" />
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 border-r-purple-500 animate-spin" />
            </div>

            {/* Text */}
            <div className="text-center space-y-2">
                <p className="text-indigo-300 font-semibold text-lg">
                    Preparing Coding Environment
                </p>

                <p className="text-gray-400 text-sm">
                    NOTE: AI can generate wrong template, if it does, please report it to us.
                </p>
            </div>

            {/* Progress Bar */}
            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className="
                        h-full
                        bg-gradient-to-r
                        from-indigo-500 via-purple-500 to-pink-500
                        transition-[width]
                        duration-200
                        ease-out
                    "
                    style={{ width: `${progress}%` }}
                />
            </div>

        </div>
    );
};

export default TemplateLoader;