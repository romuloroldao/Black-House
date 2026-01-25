// Validator Service
// Valida dados do aluno e da dieta antes de persistir

class ValidatorService {
    /**
     * Valida dados completos de importação
     * @param {Object} data - Dados a serem validados
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateImportData(data) {
        const errors = [];

        // Validar aluno
        const alunoErrors = this.validateAluno(data.aluno);
        errors.push(...alunoErrors);

        // Validar dieta (se existir)
        if (data.dieta) {
            const dietaErrors = this.validateDieta(data.dieta);
            errors.push(...dietaErrors);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valida dados do aluno
     * @param {Object} aluno - Dados do aluno
     * @returns {string[]} Array de erros encontrados
     */
    validateAluno(aluno) {
        const errors = [];

        if (!aluno) {
            errors.push('Dados do aluno são obrigatórios');
            return errors;
        }

        if (!aluno.nome || aluno.nome.trim().length === 0) {
            errors.push('Nome do aluno é obrigatório');
        }

        if (aluno.nome && aluno.nome.length > 255) {
            errors.push('Nome do aluno excede 255 caracteres');
        }

        if (aluno.peso !== null && aluno.peso !== undefined) {
            if (typeof aluno.peso !== 'number' || aluno.peso < 0 || aluno.peso > 500) {
                errors.push('Peso deve ser um número entre 0 e 500 kg');
            }
        }

        if (aluno.altura !== null && aluno.altura !== undefined) {
            if (typeof aluno.altura !== 'number' || aluno.altura < 0 || aluno.altura > 300) {
                errors.push('Altura deve ser um número entre 0 e 300 cm');
            }
        }

        if (aluno.idade !== null && aluno.idade !== undefined) {
            if (typeof aluno.idade !== 'number' || aluno.idade < 0 || aluno.idade > 150) {
                errors.push('Idade deve ser um número entre 0 e 150 anos');
            }
        }

        if (aluno.objetivo && aluno.objetivo.length > 1000) {
            errors.push('Objetivo excede 1000 caracteres');
        }

        return errors;
    }

    /**
     * Valida dados da dieta
     * @param {Object} dieta - Dados da dieta
     * @returns {string[]} Array de erros encontrados
     */
    validateDieta(dieta) {
        const errors = [];

        if (!dieta) {
            return errors; // Dieta é opcional
        }

        if (dieta.nome && dieta.nome.length > 255) {
            errors.push('Nome da dieta excede 255 caracteres');
        }

        if (dieta.objetivo && dieta.objetivo.length > 1000) {
            errors.push('Objetivo da dieta excede 1000 caracteres');
        }

        // Validar refeições
        if (dieta.refeicoes && Array.isArray(dieta.refeicoes)) {
            dieta.refeicoes.forEach((refeicao, idx) => {
                if (!refeicao.nome || refeicao.nome.trim().length === 0) {
                    errors.push(`Refeição ${idx + 1}: nome é obrigatório`);
                }

                if (refeicao.nome && refeicao.nome.length > 255) {
                    errors.push(`Refeição ${idx + 1}: nome excede 255 caracteres`);
                }

                if (refeicao.alimentos && Array.isArray(refeicao.alimentos)) {
                    refeicao.alimentos.forEach((alimento, aIdx) => {
                        if (!alimento.nome || alimento.nome.trim().length === 0) {
                            errors.push(`Refeição ${idx + 1}, Alimento ${aIdx + 1}: nome é obrigatório`);
                        }

                        if (alimento.nome && alimento.nome.length > 255) {
                            errors.push(`Refeição ${idx + 1}, Alimento ${aIdx + 1}: nome excede 255 caracteres`);
                        }

                        if (!alimento.quantidade || alimento.quantidade.trim().length === 0) {
                            errors.push(`Refeição ${idx + 1}, Alimento ${aIdx + 1}: quantidade é obrigatória`);
                        }
                    });
                }
            });
        }

        // Validar macros (se existirem)
        if (dieta.macros) {
            const macroFields = ['proteina', 'carboidrato', 'gordura', 'calorias'];
            macroFields.forEach(field => {
                if (dieta.macros[field] !== null && dieta.macros[field] !== undefined) {
                    if (typeof dieta.macros[field] !== 'number' || dieta.macros[field] < 0) {
                        errors.push(`Macro ${field} deve ser um número positivo`);
                    }
                }
            });
        }

        return errors;
    }

    /**
     * Valida suplementos
     * @param {Array} suplementos - Array de suplementos
     * @returns {string[]} Array de erros encontrados
     */
    validateSuplementos(suplementos) {
        const errors = [];

        if (!Array.isArray(suplementos)) {
            return errors;
        }

        suplementos.forEach((sup, idx) => {
            if (!sup.nome || sup.nome.trim().length === 0) {
                errors.push(`Suplemento ${idx + 1}: nome é obrigatório`);
            }
        });

        return errors;
    }

    /**
     * Valida fármacos
     * @param {Array} farmacos - Array de fármacos
     * @returns {string[]} Array de erros encontrados
     */
    validateFarmacos(farmacos) {
        const errors = [];

        if (!Array.isArray(farmacos)) {
            return errors;
        }

        farmacos.forEach((farmaco, idx) => {
            if (!farmaco.nome || farmaco.nome.trim().length === 0) {
                errors.push(`Fármaco ${idx + 1}: nome é obrigatório`);
            }
        });

        return errors;
    }
}

module.exports = new ValidatorService();
