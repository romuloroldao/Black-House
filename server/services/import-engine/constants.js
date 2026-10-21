/**
 * Marcadores semânticos para segmentação de fichas (não dependem de coordenadas fixas).
 */

const SECTION_ANCHORS = [
    { id: 'dados_pessoais', patterns: [
        /\b(nome|idade|sexo|telefone|celular|whatsapp|e-?mail|altura|peso|objetivo|anamnese|dados\s+pessoais)\b/i,
        /\bPLANO\s+ALIMENTAR\b/i
    ]},
    { id: 'dieta', patterns: [
        /\b(plano\s+alimentar|refei[cç][aã]o\s*\d+|caf[eé]\s+da\s+manh[aã]|almo[cç]o|jantar|lanche|macros?|kcal\s+da\s+dieta)\b/i,
        /\b(Qtd|Alimentos\s+de\s+prefer)/i
    ]},
    { id: 'treino', patterns: [
        /\b(plano\s+de\s+treino|treino|divis[aã]o|exerc[ií]cio|s[eé]ries?|repeti[cç][õo]es|descanso|muscula[cç][aã]o)\b/i
    ]},
    { id: 'suplementacao', patterns: [
        /\b(suplementa[cç][aã]o|suplementos?|vitamina|creatina|whey|pr[eé][\s-]?treino|glutamina|ômega|omega)\b/i
    ]},
    { id: 'farmacos', patterns: [
        /\b(f[aá]rmacos?|medicamentos?|medica[cç][aã]o|fitoter[aá]picos?|protocolos?)\b/i
    ]},
    { id: 'hormonios', patterns: [
        /\b(horm[oô]nio|testosterona|durateston|nandrolona|oxandrolona|\bdura\b|trembolona|stanozolol|oximetolona|primobolan|deca\b|tpc\b|sarm)\b/i,
        /\b(GH\b|horm[oô]nio\s+do\s+crescimento|insulina)\b/i
    ]},
    { id: 'observacoes', patterns: [
        /\b(observa[cç][õo]es|orienta[cç][õo]es|notas?|recomenda[cç][õo]es)\b/i
    ]},
    { id: 'exames', patterns: [
        /\b(exames?|laborat[oó]rio|hemograma|bioqu[ií]mica)\b/i
    ]}
];

/** Nomes que nunca devem ser aluno.nome */
const INVALID_STUDENT_NAME_PATTERNS = [
    /^PLANO\s+ALIMENTAR/i,
    /^LISTA\s+DE\s+SUBSTIT/i,
    /^Refei[cç][aã]o\s+\d+/i,
    /^Grupo\s+dos?\b/i,
    /^(Nome|Objetivo|Kcal|Peso|Altura|Idade)\b/i,
    /\d{2,}/,
    /^(Whey|Protein|Creatina|Vitamina)/i
];

/** Termos que indicam item hormonal/ergogênico (→ farmacos, não suplementos) */
const HORMONE_ERGO_KEYWORDS = [
    'testosterona', 'durateston', 'duratest', 'dura', 'testo', 'nandrolona', 'deca',
    'oxandrolona', 'oxandro', 'trembolona', 'trembo', 'stanozolol', 'winstrol',
    'oximetolona', 'hemogenin', 'primobolan', 'masteron', 'boldenona', 'equipoise',
    'hgh', 'gh ', 'somatropina', 'insulina', 'clenbuterol', 'clen', 't3', 't4',
    'arimidex', 'anastrozol', 'nolvadex', 'tamoxifeno', 'proviron', 'sarm',
    'ostarine', 'ligandrol', 'rad140', 'cardarine'
];

/** Suplementos comuns (→ suplementos, não farmacos) */
const SUPPLEMENT_KEYWORDS = [
    'whey', 'creatina', 'glutamina', 'bcaa', 'beta alanina', 'cafeina',
    'vitamina', 'omega', 'ômega', 'magnesio', 'magnésio', 'zinco', 'colageno',
    'colágeno', 'pre treino', 'pré treino', 'pos treino', 'pós treino',
    'hipercalorico', 'hipercalórico', 'albumina', 'caseina'
];

/** Padrões de exercício — se aparecer em alimento, sinalizar confusão treino/dieta */
const EXERCISE_KEYWORDS = [
    'supino', 'agachamento', 'leg press', 'rosca', 'triceps', 'tríceps',
    'remada', 'desenvolvimento', 'stiff', 'afundo', 'crucifixo', 'puxada',
    'barra fixa', 'elevação lateral', 'extensora', 'flexora', 'hack squat'
];

const CONFIDENCE_THRESHOLD_REVIEW = 0.75;
const CONFIDENCE_THRESHOLD_LOW = 0.5;

module.exports = {
    SECTION_ANCHORS,
    INVALID_STUDENT_NAME_PATTERNS,
    HORMONE_ERGO_KEYWORDS,
    SUPPLEMENT_KEYWORDS,
    EXERCISE_KEYWORDS,
    CONFIDENCE_THRESHOLD_REVIEW,
    CONFIDENCE_THRESHOLD_LOW
};
