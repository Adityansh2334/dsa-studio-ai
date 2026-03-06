const dayjs = require("dayjs");
const { generateForDate } = require("./firstTimeGenerator");

let running = false;

async function triggerBackgroundGeneration(userId, mode, contextKey, LIMIT, difficulty, preferred) {
    if (running) return;
    running = true;

    setTimeout(async () => {
        try {
            const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
            console.log(`🛠 Background generating for ${tomorrow}`);
            await generateForDate(userId, mode, tomorrow, contextKey, LIMIT, difficulty, true, preferred);
            console.log("✅ Background generation complete");
        } catch (e) {
            console.error("Background generation failed", e);
        } finally {
            running = false;
        }
    }, 2000);
}

module.exports = { triggerBackgroundGeneration };
