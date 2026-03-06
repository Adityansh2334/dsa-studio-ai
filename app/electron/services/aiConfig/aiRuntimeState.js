let aiReady = false;
let currentModelKey = null;

function setAIReady(modelKey) {
    aiReady = true;
    currentModelKey = modelKey;
}

function resetAI() {
    aiReady = false;
    currentModelKey = null;
}

function isAIReady() {
    return aiReady;
}

function getCurrentModel() {
    return currentModelKey;
}

module.exports = {
    setAIReady,
    resetAI,
    isAIReady,
    getCurrentModel
};
