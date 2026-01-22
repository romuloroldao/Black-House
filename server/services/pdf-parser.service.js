// PDF Parser Service
// Extrai texto e imagens de PDFs para processamento por IA

const pdfParse = require('pdf-parse');

class PDFParserService {
    /**
     * Extrai texto de um PDF
     * @param {Buffer} pdfBuffer - Buffer do PDF
     * @returns {Promise<string>} Texto extraído do PDF
     */
    async extractText(pdfBuffer) {
        try {
            const data = await pdfParse(pdfBuffer);
            return data.text || '';
        } catch (error) {
            console.error('Erro ao extrair texto do PDF:', error);
            throw new Error(`Erro ao extrair texto do PDF: ${error.message}`);
        }
    }

    /**
     * Extrai metadados do PDF
     * @param {Buffer} pdfBuffer - Buffer do PDF
     * @returns {Promise<Object>} Metadados do PDF
     */
    async extractMetadata(pdfBuffer) {
        try {
            const data = await pdfParse(pdfBuffer);
            return {
                numPages: data.numpages || 0,
                info: data.info || {},
                metadata: data.metadata || {}
            };
        } catch (error) {
            console.error('Erro ao extrair metadados do PDF:', error);
            throw new Error(`Erro ao extrair metadados do PDF: ${error.message}`);
        }
    }

    /**
     * Valida se o buffer é um PDF válido
     * @param {Buffer} pdfBuffer - Buffer a ser validado
     * @returns {boolean} True se for um PDF válido
     */
    isValidPDF(pdfBuffer) {
        // PDFs começam com %PDF-
        return pdfBuffer && pdfBuffer.length > 4 && 
               pdfBuffer.toString('ascii', 0, 4) === '%PDF';
    }

    /**
     * Valida tamanho do PDF
     * @param {Buffer} pdfBuffer - Buffer do PDF
     * @param {number} maxSizeMB - Tamanho máximo em MB (padrão: 50MB)
     * @returns {boolean} True se o tamanho for válido
     */
    isValidSize(pdfBuffer, maxSizeMB = 50) {
        const sizeMB = pdfBuffer.length / (1024 * 1024);
        return sizeMB <= maxSizeMB;
    }
}

module.exports = new PDFParserService();
