const { LANGUAGES } = require("./constants");

/**
 * =========================================
 * Detect Language Configuration
 * =========================================
 *
 * Returns language metadata from constants.
 */

function detectLanguage(language) {
    if (!language) {
        throw new Error("Language not provided");
    }

    const lang = language.toLowerCase();

    const config = LANGUAGES[lang];

    if (!config) {
        throw new Error(`Unsupported language: ${language}`);
    }

    return {
        name: lang,
        extension: config.extension,
        runner: config.runner,
    };
}

/**
 * =========================================
 * Validate Supported Language
 * =========================================
 */

function isSupported(language) {
    if (!language) return false;

    return !!LANGUAGES[language.toLowerCase()];
}

/**
 * =========================================
 * Get File Extension
 * =========================================
 */

function getExtension(language) {
    const config = detectLanguage(language);

    return config.extension;
}

/**
 * =========================================
 * Get Runner Type
 * =========================================
 */

function getRunner(language) {
    const config = detectLanguage(language);

    return config.runner;
}

/**
 * =========================================
 * Export
 * =========================================
 */

module.exports = {
    detectLanguage,
    isSupported,
    getExtension,
    getRunner,
};