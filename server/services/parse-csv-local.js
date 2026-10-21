/**
 * Importação de fichas Black House em CSV (export Excel → CSV).
 */

const { parseBlackHouseGrid } = require('./parse-blackhouse-sheet');
const logger = require('../utils/logger');

function detectDelimiter(firstLine) {
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
}

/**
 * Parser CSV simples com suporte a campos entre aspas.
 */
function parseCsvText(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (!lines.length) return [];

    const delimiter = detectDelimiter(lines[0]);
    const rows = [];

    for (const line of lines) {
        const row = [];
        let cur = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === delimiter && !inQuotes) {
                row.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        row.push(cur);
        rows.push(row);
    }

    return rows;
}

function csvBufferToGrid(buffer) {
    let text = buffer.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }
    return parseCsvText(text);
}

/**
 * @param {Buffer} csvBuffer
 * @param {string} [fileName]
 */
function parseBlackHouseCSV(csvBuffer, fileName = 'ficha.csv') {
    const rows = csvBufferToGrid(csvBuffer);
    logger.info('CSV-IMPORT: grid carregado', {
        fileName,
        rows: rows.length,
        cols: rows[0]?.length || 0,
    });
    return parseBlackHouseGrid(rows, { fileName });
}

module.exports = {
    parseBlackHouseCSV,
    csvBufferToGrid,
    parseCsvText,
};
