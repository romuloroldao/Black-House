import jsPDF from 'jspdf';
import logoWhite from '@/assets/logo-white.svg';

interface Exercicio {
  nome: string;
  series: number | string;
  repeticoes: number | string;
  peso?: string;
  descanso: string;
  observacoes?: string;
  video_url?: string;
}

interface Treino {
  id: string;
  nome: string;
  descricao?: string;
  categoria: string;
  dificuldade: string;
  duracao: number;
  exercicios?: Exercicio[];
  tags?: string[];
  dataExpiracao?: string;
}

type RGB = [number, number, number];

const brand = {
  black: [7, 7, 7] as RGB,
  dark: [17, 17, 17] as RGB,
  gold: [212, 175, 55] as RGB,
  goldDark: [176, 137, 0] as RGB,
  text: [33, 33, 33] as RGB,
  muted: [92, 92, 92] as RGB,
  border: [226, 226, 226] as RGB,
  surface: [250, 250, 250] as RGB,
};

const pageTop = 52;
const pageBottom = 26;

let cachedLogoDataUrlPromise: Promise<string | null> | null = null;

const getBrandLogoDataUrl = (): Promise<string | null> => {
  if (cachedLogoDataUrlPromise) return cachedLogoDataUrlPromise;

  cachedLogoDataUrlPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = logoWhite;
  });

  return cachedLogoDataUrlPromise;
};

const toSafeFileName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const setFill = (doc: jsPDF, color: RGB) => doc.setFillColor(color[0], color[1], color[2]);
const setDraw = (doc: jsPDF, color: RGB) => doc.setDrawColor(color[0], color[1], color[2]);
const setText = (doc: jsPDF, color: RGB) => doc.setTextColor(color[0], color[1], color[2]);

const formatGeneratedAt = () =>
  `${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

const drawBrandHeader = (doc: jsPDF, pageWidth: number, margin: number, logoDataUrl: string | null) => {
  setFill(doc, brand.black);
  doc.rect(0, 0, pageWidth, 38, 'F');

  setFill(doc, [24, 24, 24]);
  doc.triangle(pageWidth * 0.58, 0, pageWidth, 0, pageWidth, 38, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, 8, 50, 22, undefined, 'FAST');
  } else {
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    setText(doc, brand.gold);
    doc.text('BLACK HOUSE', margin, 20);
  }

  setFill(doc, brand.gold);
  doc.rect(0, 37, pageWidth, 1.2, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.gold);
  doc.text('BLACK HOUSE TRAINING', pageWidth - margin, 13, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  setText(doc, [245, 245, 245]);
  doc.text('Treino personalizado', pageWidth - margin, 20, { align: 'right' });

  doc.setFontSize(7);
  setText(doc, [165, 165, 165]);
  doc.text(formatGeneratedAt(), pageWidth - margin, 27, { align: 'right' });
};

const drawFooter = (doc: jsPDF, pageWidth: number, margin: number, pageNumber: number, pageCount: number) => {
  const pageHeight = doc.internal.pageSize.getHeight();

  setDraw(doc, brand.border);
  doc.line(margin, pageHeight - 17, pageWidth - margin, pageHeight - 17);
  setDraw(doc, brand.gold);
  doc.line(margin, pageHeight - 17, margin + 32, pageHeight - 17);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.text);
  doc.text('Gerado por Black House', margin, pageHeight - 10);

  doc.setFont('helvetica', 'normal');
  setText(doc, brand.muted);
  doc.text(`Pagina ${pageNumber}/${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
};

const addDocumentFooters = (doc: jsPDF, pageWidth: number, margin: number) => {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawFooter(doc, pageWidth, margin, page, pageCount);
  }
};

const normalizeText = (value?: string | number | null, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const drawPill = (
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  fillColor: RGB = brand.dark,
  textColor: RGB = [255, 255, 255]
) => {
  const width = Math.max(24, doc.getTextWidth(text) + 10);

  setFill(doc, fillColor);
  doc.roundedRect(x, y, width, 8, 4, 4, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  setText(doc, textColor);
  doc.text(text, x + width / 2, y + 5.4, { align: 'center' });

  return width;
};

const drawSummaryCard = (doc: jsPDF, x: number, y: number, width: number, label: string, value: string) => {
  setFill(doc, [255, 255, 255]);
  setDraw(doc, brand.border);
  doc.roundedRect(x, y, width, 24, 3, 3, 'FD');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.goldDark);
  doc.text(label.toUpperCase(), x + 5, y + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.text);
  const valueLines = doc.splitTextToSize(value, width - 10);
  doc.text(valueLines.slice(0, 2), x + 5, y + 16);
};

const drawWorkoutIntro = (doc: jsPDF, treino: Treino, studentName: string | undefined, pageWidth: number, margin: number) => {
  let yPosition = pageTop;
  const contentWidth = pageWidth - margin * 2;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.text);
  const titleLines = doc.splitTextToSize(treino.nome, contentWidth - 42);
  doc.text(titleLines.slice(0, 2), margin, yPosition);

  drawPill(doc, pageWidth - margin - 35, yPosition - 6, 'PREMIUM', brand.gold, brand.black);
  yPosition += titleLines.length > 1 ? 18 : 12;

  if (studentName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    setText(doc, brand.goldDark);
    doc.text(`Aluno: ${studentName}`, margin, yPosition);
    yPosition += 7;
  }

  if (treino.descricao) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setText(doc, brand.muted);
    const descLines = doc.splitTextToSize(treino.descricao, contentWidth);
    doc.text(descLines.slice(0, 3), margin, yPosition);
    yPosition += Math.min(descLines.length, 3) * 5 + 4;
  }

  let chipX = margin;
  chipX += drawPill(doc, chipX, yPosition, normalizeText(treino.categoria), brand.dark) + 4;
  chipX += drawPill(doc, chipX, yPosition, normalizeText(treino.dificuldade), brand.gold, brand.black) + 4;
  if (treino.dataExpiracao) {
    drawPill(doc, chipX, yPosition, `Valido ate ${new Date(treino.dataExpiracao).toLocaleDateString('pt-BR')}`, [245, 245, 245], brand.text);
  }
  yPosition += 16;

  setFill(doc, brand.surface);
  setDraw(doc, [238, 238, 238]);
  doc.roundedRect(margin, yPosition, contentWidth, 34, 4, 4, 'FD');

  const gap = 4;
  const cardWidth = (contentWidth - gap * 3) / 4;
  drawSummaryCard(doc, margin + 5, yPosition + 5, cardWidth - 3, 'Categoria', normalizeText(treino.categoria));
  drawSummaryCard(doc, margin + 5 + cardWidth + gap, yPosition + 5, cardWidth - 3, 'Nivel', normalizeText(treino.dificuldade));
  drawSummaryCard(doc, margin + 5 + (cardWidth + gap) * 2, yPosition + 5, cardWidth - 3, 'Duracao', `${normalizeText(treino.duracao)} min`);
  drawSummaryCard(doc, margin + 5 + (cardWidth + gap) * 3, yPosition + 5, cardWidth - 3, 'Exercicios', `${treino.exercicios?.length || 0}`);

  return yPosition + 48;
};

const getExerciseCardHeight = (doc: jsPDF, exercicio: Exercicio, pageWidth: number, margin: number) => {
  const obsLines = exercicio.observacoes
    ? doc.splitTextToSize(`Obs: ${exercicio.observacoes}`, pageWidth - margin * 2 - 22)
    : [];

  return exercicio.observacoes ? 44 + obsLines.length * 4 : 38;
};

const drawExerciseCard = (
  doc: jsPDF,
  exercicio: Exercicio,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  setFill(doc, [246, 246, 246]);
  doc.roundedRect(x + 1, y + 1.5, width, height, 4, 4, 'F');
  setFill(doc, [255, 255, 255]);
  setDraw(doc, brand.border);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');

  setFill(doc, brand.gold);
  doc.roundedRect(x, y, 3, height, 1.5, 1.5, 'F');
  doc.circle(x + 14, y + 14, 7, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.black);
  doc.text(String(index + 1).padStart(2, '0'), x + 14, y + 16.7, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.text);
  doc.text(exercicio.nome, x + 27, y + 12);

  const detailY = y + 23;
  const detailWidth = (width - 35) / 4;
  const details = [
    ['Series', normalizeText(exercicio.series)],
    ['Reps', normalizeText(exercicio.repeticoes)],
    ['Descanso', normalizeText(exercicio.descanso)],
    ['T.E.P', normalizeText(exercicio.peso)],
  ];

  details.forEach(([label, value], detailIndex) => {
    const detailX = x + 27 + detailWidth * detailIndex;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    setText(doc, brand.goldDark);
    doc.text(label.toUpperCase(), detailX, detailY);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    setText(doc, brand.text);
    doc.text(value, detailX, detailY + 6);
  });

  if (exercicio.observacoes) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    setText(doc, brand.muted);
    const obsLines = doc.splitTextToSize(`Obs: ${exercicio.observacoes}`, width - 27);
    doc.text(obsLines, x + 27, y + 34);
  }
};

const renderWorkout = (
  doc: jsPDF,
  treino: Treino,
  studentName: string | undefined,
  pageWidth: number,
  margin: number,
  logoDataUrl: string | null
) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let yPosition = pageTop;

  drawBrandHeader(doc, pageWidth, margin, logoDataUrl);
  yPosition = drawWorkoutIntro(doc, treino, studentName, pageWidth, margin);

  const checkNewPage = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - pageBottom) {
      doc.addPage();
      drawBrandHeader(doc, pageWidth, margin, logoDataUrl);
      yPosition = pageTop;
    }
  };

  checkNewPage(18);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  setText(doc, brand.text);
  doc.text('Exercicios do treino', margin, yPosition);
  setDraw(doc, brand.gold);
  doc.line(margin, yPosition + 3, margin + 34, yPosition + 3);
  yPosition += 12;

  const exercicios = treino.exercicios || [];

  if (exercicios.length === 0) {
    setFill(doc, brand.surface);
    setDraw(doc, brand.border);
    doc.roundedRect(margin, yPosition, contentWidth, 24, 4, 4, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    setText(doc, brand.muted);
    doc.text('Nenhum exercicio cadastrado neste treino.', margin + 6, yPosition + 14);
    return;
  }

  exercicios.forEach((exercicio, index) => {
    const cardHeight = getExerciseCardHeight(doc, exercicio, pageWidth, margin);
    checkNewPage(cardHeight + 7);
    drawExerciseCard(doc, exercicio, index, margin, yPosition, contentWidth, cardHeight);
    yPosition += cardHeight + 7;
  });
};

export const exportWorkoutToPdf = async (treino: Treino, studentName?: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const logoDataUrl = await getBrandLogoDataUrl();

  renderWorkout(doc, treino, studentName, pageWidth, margin, logoDataUrl);
  addDocumentFooters(doc, pageWidth, margin);

  // Save the PDF
  const fileName = `treino-blackhouse-${toSafeFileName(treino.nome || 'treino')}.pdf`;
  doc.save(fileName);
};

export const exportMultipleWorkoutsToPdf = async (treinos: Treino[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const logoDataUrl = await getBrandLogoDataUrl();
  
  treinos.forEach((treino, treinoIndex) => {
    if (treinoIndex > 0) {
      doc.addPage();
    }

    renderWorkout(doc, treino, undefined, pageWidth, margin, logoDataUrl);
  });

  addDocumentFooters(doc, pageWidth, margin);

  // Save
  const fileName = `treinos-blackhouse-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
