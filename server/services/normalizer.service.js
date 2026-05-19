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
     * Normaliza dados do aluno (altura opcional — não impede importação)
     */
    _normalizeAluno(aluno) {
        const out = {
            nome: this._normalizeString(aluno.nome) || 'Aluno Importado',
            peso: this._normalizeNumber(aluno.peso),
            altura: this._normalizeNumber(aluno.altura),
            idade: this._normalizeNumber(aluno.idade),
            objetivo: this._normalizeString(aluno.objetivo)
        };
        const email = this._normalizeString(aluno.email);
        if (email) out.email = email;
        const cpf = this._normalizeString(aluno.cpf_cnpj);
        if (cpf) out.cpf_cnpj = cpf;
        const tel = this._normalizeString(aluno.telefone);
        if (tel) out.telefone = tel;
        return out;
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
     * Normaliza refeições preservando metadados opcionais.
     */
    _normalizeRefeicoes(refeicoes) {
        if (!Array.isArray(refeicoes)) {
            return [];
        }

        return refeicoes
            .filter(ref => ref && (ref.nome || ref.alimentos))
            .map(ref => {
                const out = {
                    nome: this._normalizeString(ref.nome) || 'Refeição',
                    alimentos: this._normalizeAlimentos(ref.alimentos || [])
                };

                const horario = this._normalizeString(ref.horario);
                if (horario) out.horario = horario;

                const observacao = this._normalizeString(ref.observacao);
                if (observacao) out.observacao = observacao;

                const diaSemana = this._normalizeString(ref.dia_semana);
                if (diaSemana) out.dia_semana = diaSemana;

                const plano = this._normalizeString(ref.plano);
                if (plano) out.plano = plano;

                if (ref.macros) {
                    const macros = this._normalizeMacros(ref.macros);
                    const hasMacros = macros && Object.values(macros).some(v => v !== null && v !== undefined);
                    if (hasMacros) out.macros = macros;
                }

                return out;
            })
            .filter(ref => ref.alimentos.length > 0);
    }

    /**
     * Normaliza alimentos preservando alternativas (substitutos).
     */
    _normalizeAlimentos(alimentos) {
        if (!Array.isArray(alimentos)) {
            return [];
        }

        return alimentos
            .filter(a => a && a.nome)
            .map(a => {
                const out = {
                    nome: this._normalizeString(a.nome).trim(),
                    quantidade: this._normalizeString(a.quantidade) || '100g'
                };
                if (Array.isArray(a.alternativas) && a.alternativas.length > 0) {
                    const alts = a.alternativas
                        .filter(alt => alt && alt.nome)
                        .map(alt => ({
                            nome: this._normalizeString(alt.nome).trim(),
                            quantidade: this._normalizeString(alt.quantidade) || out.quantidade
                        }))
                        .filter(alt => alt.nome.length > 0);
                    if (alts.length > 0) out.alternativas = alts;
                }
                return out;
            })
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
     * Normaliza suplementos preservando horário opcional.
     */
    _normalizeSuplementos(suplementos) {
        if (!Array.isArray(suplementos)) {
            return [];
        }

        return suplementos
            .filter(s => s && s.nome)
            .map(s => {
                const out = {
                    nome: this._normalizeString(s.nome).trim(),
                    dosagem: this._normalizeString(s.dosagem) || '',
                    observacao: this._normalizeString(s.observacao)
                };
                const horario = this._normalizeString(s.horario);
                if (horario) out.horario = horario;
                return out;
            })
            .filter(s => s.nome.length > 0);
    }

    /**
     * Normaliza fármacos preservando horário opcional.
     */
    _normalizeFarmacos(farmacos) {
        if (!Array.isArray(farmacos)) {
            return [];
        }

        return farmacos
            .filter(f => f && f.nome)
            .map(f => {
                const out = {
                    nome: this._normalizeString(f.nome).trim(),
                    dosagem: this._normalizeString(f.dosagem) || '',
                    observacao: this._normalizeString(f.observacao)
                };
                const horario = this._normalizeString(f.horario);
                if (horario) out.horario = horario;
                return out;
            })
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
