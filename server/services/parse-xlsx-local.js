/**
 * Importação de fichas Black House em XLSX (modelo Excel nativo).
 */

const XLSX = require('xlsx');
const { parseBlackHouseGrid, isBlackHousePlanGrid } = require('./parse-blackhouse-sheet');
const logger = require('../utils/logger');

function sheetToGrid(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    return rows.map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : [],
    );
}

function findPlanSheets(workbook) {
    const found = [];
    for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (!sheet) continue;
        const rows = sheetToGrid(sheet);
        if (isBlackHousePlanGrid(rows)) {
            found.push({ name, rows });
        }
    }
    return found;
}

/**
 * @param {Buffer} xlsxBuffer
 * @param {string} [fileName]
 */
function parseBlackHouseXLSX(xlsxBuffer, fileName = 'ficha.xlsx') {
    let workbook;
    try {
        workbook = XLSX.read(xlsxBuffer, { type: 'buffer', cellDates: true });
    } catch (err) {
        const e = new Error('Arquivo XLSX inválido ou corrompido');
        e.code = 'XLSX_READ_FAILED';
        throw e;
    }

    const planSheets = findPlanSheets(workbook);
    if (!planSheets.length) {
        throw new Error(
            'Nenhuma aba de plano alimentar encontrada no XLSX. O ficheiro deve conter abas como A ou B com o layout Black House.'
        );
    }

    const selected = planSheets[0];
    if (planSheets.length > 1) {
        logger.info('XLSX-IMPORT: várias abas de plano; a usar a primeira', {
            fileName,
            sheet: selected.name,
            allPlanSheets: planSheets.map((s) => s.name),
        });
    }

    logger.info('XLSX-IMPORT: grid carregado', {
        fileName,
        sheet: selected.name,
        rows: selected.rows.length,
        cols: selected.rows[0]?.length || 0,
    });

    return parseBlackHouseGrid(selected.rows, { fileName, sheetName: selected.name });
}

module.exports = {
    parseBlackHouseXLSX,
    sheetToGrid,
    findPlanSheets,
};
