const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

async function buildExcelBuffer({ sheetName, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = Math.max(column.header.length + 4, 18);
  });
  return workbook.xlsx.writeBuffer();
}

function buildPdfBuffer({ title, lines }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(title, { underline: true });
    doc.moveDown();
    lines.forEach((line) => doc.fontSize(11).text(line));
    doc.end();
  });
}

module.exports = { buildExcelBuffer, buildPdfBuffer };
