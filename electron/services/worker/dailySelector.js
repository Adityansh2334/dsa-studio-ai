function shuffle(arr) {
    // Fisher–Yates shuffle (true shuffle)
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * @param {Array<{pattern:string}>} allPatterns  -> patterns.js
 * @param {Object} mastery                      -> { "Arrays": 3, "DP": 1 }
 * @param {number} count
 * @param {string[]} preferredPatterns          -> from user pref (daily_patterns)
 */
function pickDailyPatterns(allPatterns, mastery = {}, count = 3, preferredPatterns = []) {

    // 1️⃣ If user selected patterns, filter only those
    let pool = allPatterns;

    if (preferredPatterns && preferredPatterns.length > 0) {
        pool = allPatterns.filter(p =>
            preferredPatterns.includes(p.pattern)
        );
    }

    // 2️⃣ Sort by mastery (weak first)
    pool = pool.sort((a, b) => {
        const ma = mastery[a.pattern] || 0;
        const mb = mastery[b.pattern] || 0;
        return ma - mb;
    });

    // 3️⃣ Shuffle AFTER mastery sort (adds randomness inside weak group)
    pool = shuffle(pool);

    // 4️⃣ If user selected fewer than count, cycle
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(pool[i % pool.length]);
    }

    return result;
}

module.exports = { pickDailyPatterns };
