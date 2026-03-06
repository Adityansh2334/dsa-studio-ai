const { getTemplate } = require("../codeRunner/templateService");

async function fetchTemplate(req) {

    try {

        const { language, problem, userId } = req;

        const template = await getTemplate(
            userId,
            problem.id,
            language,
            problem
        );

        return {
            success: true,
            code: template.template,
            metadata: template.metadata
        };

    } catch (err) {

        console.error("Template error:", err);

        return {
            success: false,
            error: err.message
        };
    }
}

module.exports = {
    fetchTemplate
};