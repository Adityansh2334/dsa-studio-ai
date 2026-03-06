let currentTask = null;

function startTask(type, controller) {
    // If a background task is running, cancel it
    if (currentTask && currentTask.type === "background" && type === "foreground") {
        console.log("⛔ Cancelling background generation for foreground task");
        currentTask.controller.abort();
        currentTask = null;
    }

    currentTask = { type, controller };
}

function endTask(controller) {
    if (currentTask?.controller === controller) {
        currentTask = null;
    }
}

module.exports = { startTask, endTask };
