const activePromises = new Map();

function getActive(key) {
    return activePromises.get(key);
}

function setActive(key, promise) {
    activePromises.set(key, promise);
}

function clearActive(key) {
    activePromises.delete(key);
}

module.exports = {
    getActive,
    setActive,
    clearActive
};