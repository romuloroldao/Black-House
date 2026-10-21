/** Textos canónicos de lembrete de retorno (dieta e treino). */

const COPY = {
  diet: {
    D_MINUS_2: {
      title: 'Retorno da dieta',
      message: 'Faltam 2 dias para o seu retorno da dieta.',
      emailType: 'diet_return_d_minus_2',
    },
    D_MINUS_1: {
      title: 'Retorno da dieta',
      message: 'Amanhã é o dia do seu retorno da dieta.',
      emailType: 'diet_return_d_minus_1',
    },
    D_DAY: {
      title: 'Retorno da dieta',
      message: 'Hoje é o dia do seu retorno da dieta.',
      emailType: 'diet_return_d_day',
    },
  },
  workout: {
    D_MINUS_2: {
      title: 'Retorno do treino',
      message: 'Faltam 2 dias para o seu retorno do treino.',
      emailType: 'workout_return_d_minus_2',
    },
    D_MINUS_1: {
      title: 'Retorno do treino',
      message: 'Amanhã é o dia do seu retorno do treino.',
      emailType: 'workout_return_d_minus_1',
    },
    D_DAY: {
      title: 'Retorno do treino',
      message: 'Hoje é o dia do seu retorno do treino.',
      emailType: 'workout_return_d_day',
    },
  },
};

const MILESTONES = [
  { key: 'D_MINUS_2', daysBefore: 2 },
  { key: 'D_MINUS_1', daysBefore: 1 },
  { key: 'D_DAY', daysBefore: 0 },
];

const CHANNEL_IN_APP_ONLY = 'in_app_only';
const CHANNEL_IN_APP_AND_EMAIL = 'in_app_and_email';

function getCopy(domain, milestone) {
  const d = domain === 'diet' ? 'diet' : 'workout';
  return COPY[d][milestone] || null;
}

module.exports = {
  COPY,
  MILESTONES,
  CHANNEL_IN_APP_ONLY,
  CHANNEL_IN_APP_AND_EMAIL,
  getCopy,
};
