const { dialog  } = require("electron");

const { jsPDF } = require("jspdf");
const { default: autoTable } = require("jspdf-autotable"); // Import the autoTable function
const fs = require('fs');


async function generatePdf(problem, content) {
// 1. Show Save Dialog to the user
    const { filePath } = await dialog.showSaveDialog({
        title: 'Save Problem Solution',
        defaultPath: `${problem.title.replace(/\s+/g, '_')}_Solution.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (!filePath) return { success: false, message: "Save cancelled" };

    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Helper to clean code strings (duplicated from your UI logic)
        const cleanCode = (code = "", lang) => {
            return code
                .replace(new RegExp("```" + lang, "gi"), "")
                .replace(/```/g, "")
                .trim();
        };

        // Header Background
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 40, "F");

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text(problem.title || "DSA Problem", 15, 20);

        // Subtitle
        doc.setFontSize(10);
        doc.setTextColor(156, 163, 175);
        doc.text(`${problem.pattern} | ${problem.difficulty}`, 15, 30);

        let currentY = 50;

        const addSection = (title, body, color = [79, 70, 229]) => {
            doc.setFontSize(14);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(title, 15, currentY);
            currentY += 7;
            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            const splitBody = doc.splitTextToSize(body || "N/A", pageWidth - 30);
            doc.text(splitBody, 15, currentY);
            currentY += (splitBody.length * 5) + 10;
        };

        addSection("Problem Statement", content.problem);
        if (content.constraints) addSection("Constraints", content.constraints, [220, 38, 38]);

        // Code Table using autoTable
        autoTable(doc, {
            startY: currentY,
            head: [['Language', 'Optimal Solution']],
            body: [
                ['Java', cleanCode(content.solution?.java, "java")],
                ['Python', cleanCode(content.solution?.python, "python")]
            ],
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 8, cellPadding: 5, font: "courier" },
            columnStyles: { 0: { cellWidth: 25 } }
        });

        // Get the Y position after the table for the next section
        // 2. Access the finalY property safely
        // Using doc.lastAutoTable works at runtime, but for better safety:
        currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY + 40) + 15;

        addSection("Explanation", content.solution?.explanation, [16, 185, 129]);

        // Complexity Box
        doc.setFillColor(243, 244, 246);
        doc.rect(15, currentY, pageWidth - 30, 15, "F");
        doc.setTextColor(31, 41, 55);
        doc.text(`Time Complexity: ${content.solution?.time || "O(N)"}   |   Space Complexity: ${content.solution?.space || "O(1)"}`, 20, currentY + 10);

        // 2. Convert to Buffer and write to disk
        const pdfOutput = doc.output('arraybuffer');
        fs.writeFileSync(filePath, Buffer.from(pdfOutput));

        return { success: true, path: filePath };
    } catch (error) {
        console.error("PDF Generation Error:", error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    generatePdf
};
