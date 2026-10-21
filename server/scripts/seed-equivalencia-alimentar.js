/**
 * Importa / actualiza alimentos da planilha logicaTabela/Equivalencia_Alimentar.xlsx
 * Uso: node server/scripts/seed-equivalencia-alimentar.js
 */
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');
const { kcalFromMacros, normalizeOrigemPtn, roundNutrient } = require('../utils/nutrition-alimento-utils');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const XLSX_PATH = path.join(__dirname, '..', '..', 'logicaTabela', 'Equivalencia_Alimentar.xlsx');

const SHEET_SKIP = new Set(['Logica_App']);

/** Nomes canónicos (documento + planilha; abas podem vir truncadas no Excel). */
const GRUPOS_CANONICOS = [
    ['Carnes e Proteínas', 'Proteína', false, 10],
    ['Cereais, Raízes, Tubérculos e Frutos', 'Carboidrato', false, 20],
    ['Feijão e Leguminosas', 'Proteína/Carboidrato', false, 30],
    ['Fibras A', 'Carboidrato', false, 40],
    ['Fibras B', 'Carboidrato', false, 50],
    ['Frutas', 'Carboidrato', false, 60],
    ['Frutas Oleosas', 'Lipídio', false, 70],
    ['Leite e Derivados', 'Proteína', false, 80],
    ['Livre', 'Carboidrato', false, 90],
    ['Oleaginosas e Sementes', 'Lipídio', false, 100],
    ['Óleos e Gorduras', 'Lipídio', false, 110],
    ['Pães e Variedades', 'Carboidrato', false, 120],
    ['Personalizado - CARB', 'Carboidrato', false, 130],
    ['Personalizado - LIP', 'Lipídio', false, 140],
    ['Personalizado - PROT', 'Proteína', false, 150],
    ['Sucos Naturais e Integrais', 'Carboidrato', false, 160],
    ['Vegetais A (livres para consumo)', 'Carboidrato', true, 170],
    ['Vegetais B', 'Carboidrato', false, 180],
];

const SHEET_ALIASES = {
    'Cereais, Raízes, Tubérculos e F': 'Cereais, Raízes, Tubérculos e Frutos',
    'Vegetais A (livres para o consu': 'Vegetais A (livres para consumo)',
    'Óleos e Gorduras ': 'Óleos e Gorduras',
    'Frutas ': 'Frutas',
};

function normalizeSheetName(name) {
    const t = String(name || '').trim();
    return SHEET_ALIASES[t] || t;
}

function inferOrigemPtn(grupo, nome) {
    const g = String(grupo || '').toLowerCase();
    const n = String(nome || '').toLowerCase();
    if (g.includes('vegetais') || g.includes('frutas') || g.includes('feijão') || g.includes('leguminosas')) {
        if (/carne|frango|peixe|ovo|leite|queijo|presunto|peru|whey|bacon|atum|salmão|salmao/.test(n)) {
            return 'Animal';
        }
        return 'Vegetal';
    }
    if (
        g.includes('carnes') ||
        g.includes('leite') ||
        g.includes('prot') ||
        /carne|frango|peixe|ovo|leite|queijo|presunto|peru|whey|bacon|atum|salmão|salmao/.test(n)
    ) {
        return 'Animal';
    }
    if (g.includes('óleo') || g.includes('oleo') || g.includes('gordura')) {
        return 'N/A';
    }
    return 'Mista';
}

function parseFoodSheets(workbook) {
    const rows = [];
    for (const sheetName of workbook.SheetNames) {
        if (SHEET_SKIP.has(sheetName)) continue;
        const ws = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        let headerIdx = -1;
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const first = String(row[0] || '').trim().toLowerCase();
            if (first === 'alimento') {
                headerIdx = i;
                break;
            }
        }
        if (headerIdx < 0) continue;

        for (let i = headerIdx + 1; i < data.length; i++) {
            const row = data[i];
            const nome = String(row[0] || '').trim().replace(/^'/, '');
            if (!nome) continue;
            const kcal = Number(row[1]);
            const cho = Number(row[2]) || 0;
            const ptn = Number(row[3]) || 0;
            const lip = Number(row[4]) || 0;
            if (!Number.isFinite(kcal)) continue;

            rows.push({
                nome,
                grupo: normalizeSheetName(sheetName),
                kcal: roundNutrient(kcal, 2),
                cho: roundNutrient(cho, 2),
                ptn: roundNutrient(ptn, 2),
                lip: roundNutrient(lip, 2),
            });
        }
    }
    return rows;
}

async function main() {
    const wb = XLSX.readFile(XLSX_PATH);
    const foods = parseFoodSheets(wb);
    console.log(`📋 ${foods.length} alimentos extraídos de ${XLSX_PATH}`);

    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    await client.connect();

    try {
        for (const row of GRUPOS_CANONICOS) {
            const [nome, macro, livre, ordem] = row;
            await client.query(
                `INSERT INTO public.tipos_alimentos (nome_tipo) VALUES ($1)
                 ON CONFLICT (nome_tipo) DO NOTHING`,
                [nome]
            );
            try {
                await client.query(
                    `UPDATE public.tipos_alimentos SET
                       macro_predominante = $2,
                       equiv_livre = $3,
                       ordem_exibicao = $4
                     WHERE nome_tipo = $1`,
                    [nome, macro, livre === true, ordem]
                );
            } catch {
                /* colunas opcionais se migração ainda não aplicada */
            }
        }

        const tiposRes = await client.query(
            `SELECT id, nome_tipo FROM public.tipos_alimentos`
        );
        const tipoByName = new Map(tiposRes.rows.map((r) => [r.nome_tipo, r.id]));

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const f of foods) {
            const tipoId = tipoByName.get(f.grupo);
            if (!tipoId) {
                console.warn(`⚠️ Grupo não encontrado: "${f.grupo}" — ${f.nome}`);
                skipped++;
                continue;
            }

            const origem = normalizeOrigemPtn(inferOrigemPtn(f.grupo, f.nome));
            const kcalCalc = roundNutrient(kcalFromMacros(f.ptn, f.cho, f.lip, 0), 1);
            const kcal = f.kcal > 0 ? f.kcal : kcalCalc;

            const existing = await client.query(
                `SELECT id FROM public.alimentos WHERE nome = $1`,
                [f.nome]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO public.alimentos (
                        nome, origem_ptn, tipo_id, quantidade_referencia_g,
                        kcal_por_referencia, ptn_por_referencia, cho_por_referencia, lip_por_referencia,
                        info_adicional, autor
                    ) VALUES ($1,$2,$3,100,$4,$5,$6,$7,$8,$9)`,
                    [
                        f.nome,
                        origem,
                        tipoId,
                        kcal,
                        f.ptn,
                        f.cho,
                        f.lip,
                        `fonte=Equivalencia_Alimentar.xlsx;grupo=${f.grupo}`,
                        'seed-equivalencia',
                    ]
                );
                inserted++;
            } else {
                await client.query(
                    `UPDATE public.alimentos SET
                        tipo_id = $2,
                        origem_ptn = $3,
                        kcal_por_referencia = $4,
                        ptn_por_referencia = $5,
                        cho_por_referencia = $6,
                        lip_por_referencia = $7,
                        info_adicional = $8
                     WHERE id = $1`,
                    [
                        existing.rows[0].id,
                        tipoId,
                        origem,
                        kcal,
                        f.ptn,
                        f.cho,
                        f.lip,
                        `fonte=Equivalencia_Alimentar.xlsx;grupo=${f.grupo}`,
                    ]
                );
                updated++;
            }
        }

        console.log(`✅ Seed concluído: ${inserted} inseridos, ${updated} actualizados, ${skipped} ignorados`);
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
});
