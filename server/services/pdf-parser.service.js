// PDF Parser Service
// Extrai texto e imagens de PDFs para processamento por IA.
//
// IMPRECISÃO-001: extractStructured() preserva a estrutura por página usando o
// callback pagerender do pdf-parse. Em fichas multi-página, tabelas multi-coluna
// e planos com Plano A/B/C ou dias da semana, manter a fronteira entre páginas
// reduz drasticamente o "embaralhamento" do texto e melhora a precisão da IA.

const pdfParse = require('pdf-parse');

const PDF_RENDER_OPTIONS = {
    // O default do pdf-parse junta tudo em ordem de leitura sem separadores.
    // Aqui, montamos por linha respeitando coordenadas Y e separadores fortes
    // entre colunas para que tabelas (preferência | substituto, dias da semana)
    // não fiquem misturadas no texto enviado para a IA.
    normalizeWhitespace: false,
    disableCombineTextItems: false
};

function buildLayoutAwareRender() {
    return function renderPage(pageData) {
        // pageData é uma página retornada pelo pdfjs-dist embutido no pdf-parse.
        // Constrói um texto por página preservando linhas (mesmo Y) e separando
        // colunas com tab para evitar concatenação de "preferência" + "substituto".
        return pageData.getTextContent({
            normalizeWhitespace: false,
            disableCombineTextItems: false
        }).then(function (textContent) {
            const items = textContent.items || [];
            if (items.length === 0) return '';

            // pdfjs entrega itens com transform = [a, b, c, d, e, f] onde
            // e/f são X/Y. f cresce de baixo para cima; agrupamos por linha (~Y).
            const lines = [];
            const Y_TOLERANCE = 2; // tolerância de 2pt para considerar mesma linha
            const COL_GAP_PT = 24; // gap horizontal (~24pt) que separa colunas

            for (const item of items) {
                if (!item || !item.transform) continue;
                const x = item.transform[4];
                const y = item.transform[5];
                const str = (item.str || '').replace(/\s+/g, ' ');
                if (!str) continue;

                let bucket = lines.find(l => Math.abs(l.y - y) <= Y_TOLERANCE);
                if (!bucket) {
                    bucket = { y, items: [] };
                    lines.push(bucket);
                }
                bucket.items.push({ x, str });
            }

            // Ordena linhas de topo para base (y decrescente)
            lines.sort((a, b) => b.y - a.y);

            const rendered = lines.map(line => {
                line.items.sort((a, b) => a.x - b.x);
                let prevX = null;
                let buffer = '';
                for (const seg of line.items) {
                    if (prevX === null) {
                        buffer = seg.str;
                    } else {
                        const dx = seg.x - prevX;
                        if (dx >= COL_GAP_PT) {
                            buffer += '\t' + seg.str;
                        } else if (dx >= 6 && !buffer.endsWith(' ')) {
                            buffer += ' ' + seg.str;
                        } else {
                            buffer += seg.str;
                        }
                    }
                    prevX = seg.x + (seg.str.length * 4); // estimativa para próximo gap
                }
                return buffer.replace(/[ \t]+$/g, '');
            }).join('\n');

            return rendered;
        });
    };
}

class PDFParserService {
    /**
     * Extrai texto de um PDF (compatibilidade legada - retorna apenas string).
     * @param {Buffer} pdfBuffer
     * @returns {Promise<string>}
     */
    async extractText(pdfBuffer) {
        try {
            const data = await pdfParse(pdfBuffer, PDF_RENDER_OPTIONS);
            return data.text || '';
        } catch (error) {
            console.error('Erro ao extrair texto do PDF:', error);
            throw new Error(`Erro ao extrair texto do PDF: ${error.message}`);
        }
    }

    /**
     * Extrai texto preservando estrutura por página + metadados.
     * Recomendado para o pipeline de importação de fichas complexas.
     *
     * @param {Buffer} pdfBuffer
     * @returns {Promise<{text:string, perPageText:string[], numPages:number, info:object, metadata:object}>}
     */
    async extractStructured(pdfBuffer) {
        // 1) Render layout-aware (preserva colunas e ordem visual por página)
        let perPageBuffers = [];
        let layoutText = '';
        try {
            const layoutOptions = {
                ...PDF_RENDER_OPTIONS,
                pagerender: buildLayoutAwareRender()
            };

            // pdf-parse não expõe natively o texto por página; interceptamos pagerender.
            const originalRender = layoutOptions.pagerender;
            layoutOptions.pagerender = async (pageData) => {
                const rendered = await originalRender(pageData);
                perPageBuffers.push(rendered || '');
                return rendered + '\n';
            };

            const data = await pdfParse(pdfBuffer, layoutOptions);
            layoutText = data.text || '';

            return {
                text: layoutText,
                perPageText: perPageBuffers,
                numPages: data.numpages || perPageBuffers.length || 0,
                info: data.info || {},
                metadata: data.metadata || {}
            };
        } catch (error) {
            console.warn('PDF layout-aware falhou, fallback para extractText simples:', error.message);
            // 2) Fallback: extractText simples (sem páginas separadas)
            const data = await pdfParse(pdfBuffer, PDF_RENDER_OPTIONS);
            return {
                text: data.text || '',
                perPageText: data.text ? [data.text] : [],
                numPages: data.numpages || 1,
                info: data.info || {},
                metadata: data.metadata || {}
            };
        }
    }

    /**
     * Extrai metadados do PDF.
     * @param {Buffer} pdfBuffer
     * @returns {Promise<Object>}
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
     * Valida se o buffer é um PDF válido.
     */
    isValidPDF(pdfBuffer) {
        return pdfBuffer && pdfBuffer.length > 4 &&
               pdfBuffer.toString('ascii', 0, 4) === '%PDF';
    }

    /**
     * Valida tamanho do PDF.
     */
    isValidSize(pdfBuffer, maxSizeMB = 50) {
        const sizeMB = pdfBuffer.length / (1024 * 1024);
        return sizeMB <= maxSizeMB;
    }
}

module.exports = new PDFParserService();
