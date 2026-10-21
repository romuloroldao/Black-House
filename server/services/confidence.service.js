// Confidence Service
// Calcula uma pontuação de confiança (0–100) sobre o resultado da extração,
// para sinalizar ao coach o quanto pode confiar nos dados antes de salvar.

function pct(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Avalia a confiança da extração com base em sinais simples mas robustos:
 *  - aluno: nome plausível e presença de campos opcionais (peso/altura/idade);
 *  - dieta: nº de refeições, alimentos por refeição, presença de macros,
 *           presença de horários/dia_semana (fichas complexas);
 *  - suplementos/fármacos: dosagem preenchida;
 *  - macros: somatório aproximado dos macros declarados.
 *
 * @param {Object} data - dados sanitizados e normalizados
 * @param {Object} [extras] - { aiUsed, numPages, hasPerPage }
 * @returns {Object} { overall, sections: { aluno, dieta, ... }, warnings }
 */
function evaluate(data, extras = {}) {
    const warnings = [];

    // Aluno
    const aluno = data?.aluno || {};
    const alunoSignals = [
        !!aluno.nome && aluno.nome.length >= 3 && /\s/.test(aluno.nome.trim()) ? 1 : 0,
        aluno.peso ? 1 : 0,
        aluno.altura ? 1 : 0,
        aluno.idade ? 1 : 0,
        aluno.objetivo ? 1 : 0
    ];
    const alunoScore = pct((alunoSignals.reduce((a, b) => a + b, 0) / alunoSignals.length) * 100);
    if (!aluno.nome || aluno.nome === 'Aluno Importado') {
        warnings.push('Nome do aluno não detectado com clareza — revise antes de salvar.');
    }

    // Dieta
    const dieta = data?.dieta || null;
    const refeicoes = dieta?.refeicoes || [];
    let dietaScore = 0;
    if (dieta && refeicoes.length > 0) {
        const totalAlimentos = refeicoes.reduce((acc, r) => acc + (r.alimentos?.length || 0), 0);
        const avgAlimentos = totalAlimentos / refeicoes.length;
        const refeicoesScore = Math.min(refeicoes.length / 6, 1) * 40;  // até 6 refeições
        const alimentosScore = Math.min(avgAlimentos / 4, 1) * 30;      // ~4 alimentos por refeição
        const metaScore = ((refeicoes.filter(r => r.horario || r.dia_semana || r.plano).length / refeicoes.length) || 0) * 20;
        const macroScore = dieta.macros && Object.values(dieta.macros).some(v => v) ? 10 : 0;
        dietaScore = pct(refeicoesScore + alimentosScore + metaScore + macroScore);

        if (refeicoes.length < 3) {
            warnings.push(`Apenas ${refeicoes.length} refeição(ões) detectada(s). Fichas completas geralmente têm 4-8 refeições — revise se faltou algo.`);
        }
        const refsSemAlimento = refeicoes.filter(r => !r.alimentos || r.alimentos.length === 0).length;
        if (refsSemAlimento > 0) {
            warnings.push(`${refsSemAlimento} refeição(ões) sem alimentos — possivelmente extração incompleta.`);
        }
    } else {
        dietaScore = 0;
        warnings.push('Nenhuma refeição detectada — verifique se o PDF é uma ficha nutricional.');
    }

    // Suplementos / Fármacos
    const suplementos = data?.suplementos || [];
    const farmacos = data?.farmacos || [];
    const protocoloScore = (() => {
        if (suplementos.length === 0 && farmacos.length === 0) return null; // não aplicável
        const itens = [...suplementos, ...farmacos];
        const comDosagem = itens.filter(i => i.dosagem && String(i.dosagem).trim()).length;
        return pct((comDosagem / itens.length) * 100);
    })();

    // Páginas
    const pagesScore = (() => {
        if (!extras.numPages) return null;
        if (extras.numPages === 1) return 100;
        // multi-página com perPage funciona melhor
        return extras.hasPerPage ? 90 : 60;
    })();

    // Overall: média ponderada (dieta pesa mais que aluno)
    const components = [];
    components.push({ weight: 2, score: alunoScore });
    components.push({ weight: 5, score: dietaScore });
    if (protocoloScore !== null) components.push({ weight: 1, score: protocoloScore });
    if (pagesScore !== null) components.push({ weight: 1, score: pagesScore });
    const wSum = components.reduce((a, c) => a + c.weight, 0);
    const overall = pct(components.reduce((a, c) => a + c.weight * c.score, 0) / wSum);

    return {
        overall,
        sections: {
            aluno: alunoScore,
            dieta: dietaScore,
            protocolo: protocoloScore,
            paginas: pagesScore
        },
        warnings,
        meta: {
            refeicoes: refeicoes.length,
            alimentos: refeicoes.reduce((acc, r) => acc + (r.alimentos?.length || 0), 0),
            suplementos: suplementos.length,
            farmacos: farmacos.length,
            aiUsed: !!extras.aiUsed,
            numPages: extras.numPages || null,
            hasPerPage: !!extras.hasPerPage
        }
    };
}

module.exports = { evaluate };
