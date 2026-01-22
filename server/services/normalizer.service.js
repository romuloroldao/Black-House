// Normalizer Service
// Padroniza e normaliza o JSON retornado pela IA

class NormalizerService {
    /**
     * Normaliza os dados extraídos pela IA para o formato esperado
     * @param {Object} rawData - Dados brutos retornados pela IA
     * @returns {Object} Dados normalizados
     */
    normalize(rawData) {
        const normalized = {
            aluno: this._normalizeAluno(rawData.aluno || {}),
            dieta: this._normalizeDieta(rawData.dieta || {}),
            suplementos: this._normalizeSuplementos(rawData.suplementos || []),
            farmacos: this._normalizeFarmacos(rawData.farmacos || []),
            orientacoes: this._normalizeOrientacoes(rawData.orientacoes)
        };

        return normalized;
    }

    /**
     * Normaliza dados do aluno
     * Nota: altura não é persistida no banco (conforme especificação)
     */
    _normalizeAluno(aluno) {
        return {
            nome: this._normalizeString(aluno.nome) || 'Aluno Importado',
            peso: this._normalizeNumber(aluno.peso),
            // altura: removido - não é persistido no banco conforme especificação
            idade: this._normalizeNumber(aluno.idade),
            objetivo: this._normalizeString(aluno.objetivo)
        };
    }

    /**
     * Normaliza dados da dieta
     */
    _normalizeDieta(dieta) {
        return {
            nome: this._normalizeString(dieta.nome) || 'Plano Alimentar Importado',
            objetivo: this._normalizeString(dieta.objetivo),
            refeicoes: this._normalizeRefeicoes(dieta.refeicoes || []),
            macros: this._normalizeMacros(dieta.macros || {})
        };
    }

    /**
     * Normaliza refeições
     */
    _normalizeRefeicoes(refeicoes) {
        if (!Array.isArray(refeicoes)) {
            return [];
        }

        return refeicoes
            .filter(ref => ref && (ref.nome || ref.alimentos))
            .map(ref => ({
                nome: this._normalizeString(ref.nome) || 'Refeição',
                alimentos: this._normalizeAlimentos(ref.alimentos || [])
            }))
            .filter(ref => ref.alimentos.length > 0); // Remove refeições sem alimentos
    }

    /**
     * Normaliza alimentos
     */
    _normalizeAlimentos(alimentos) {
        if (!Array.isArray(alimentos)) {
            return [];
        }

        return alimentos
            .filter(a => a && a.nome)
            .map(a => ({
                nome: this._normalizeString(a.nome).trim(),
                quantidade: this._normalizeString(a.quantidade) || '100g'
            }))
            .filter(a => a.nome.length > 0);
    }

    /**
     * Normaliza macros
     */
    _normalizeMacros(macros) {
        return {
            proteina: this._normalizeNumber(macros.proteina),
            carboidrato: this._normalizeNumber(macros.carboidrato),
            gordura: this._normalizeNumber(macros.gordura),
            calorias: this._normalizeNumber(macros.calorias)
        };
    }

    /**
     * Normaliza suplementos
     */
    _normalizeSuplementos(suplementos) {
        if (!Array.isArray(suplementos)) {
            return [];
        }

        return suplementos
            .filter(s => s && s.nome)
            .map(s => ({
                nome: this._normalizeString(s.nome).trim(),
                dosagem: this._normalizeString(s.dosagem) || '',
                observacao: this._normalizeString(s.observacao)
            }))
            .filter(s => s.nome.length > 0);
    }

    /**
     * Normaliza fármacos
     */
    _normalizeFarmacos(farmacos) {
        if (!Array.isArray(farmacos)) {
            return [];
        }

        return farmacos
            .filter(f => f && f.nome)
            .map(f => ({
                nome: this._normalizeString(f.nome).trim(),
                dosagem: this._normalizeString(f.dosagem) || '',
                observacao: this._normalizeString(f.observacao)
            }))
            .filter(f => f.nome.length > 0);
    }

    /**
     * Normaliza orientações
     */
    _normalizeOrientacoes(orientacoes) {
        const normalized = this._normalizeString(orientacoes);
        return normalized && normalized.length > 0 ? normalized : null;
    }

    /**
     * Normaliza string (remove espaços, trata null/undefined)
     */
    _normalizeString(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value !== 'string') {
            return String(value).trim();
        }
        return value.trim() || null;
    }

    /**
     * Normaliza número (converte string para number, trata null/undefined)
     */
    _normalizeNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        if (typeof value === 'number') {
            return isNaN(value) ? null : value;
        }
        const parsed = parseFloat(String(value).replace(',', '.'));
        return isNaN(parsed) ? null : parsed;
    }
}

module.exports = new NormalizerService();
