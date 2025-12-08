import jsPDF from 'jspdf';

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

export const exportWorkoutToPdf = (treino: Treino, studentName?: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;

  // Helper function to add a new page if needed
  const checkNewPage = (neededHeight: number) => {
    if (yPosition + neededHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 33, 33);
  doc.text(treino.nome, margin, yPosition);
  yPosition += 12;

  // Student name if provided
  if (studentName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Aluno: ${studentName}`, margin, yPosition);
    yPosition += 8;
  }

  // Description
  if (treino.descricao) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const descLines = doc.splitTextToSize(treino.descricao, pageWidth - margin * 2);
    doc.text(descLines, margin, yPosition);
    yPosition += descLines.length * 5 + 5;
  }

  // Workout info box
  yPosition += 5;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPosition, pageWidth - margin * 2, 25, 3, 3, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 33, 33);
  
  const infoY = yPosition + 10;
  const colWidth = (pageWidth - margin * 2) / 4;
  
  doc.text('Categoria', margin + 5, infoY);
  doc.text('Dificuldade', margin + colWidth + 5, infoY);
  doc.text('Duração', margin + colWidth * 2 + 5, infoY);
  doc.text('Exercícios', margin + colWidth * 3 + 5, infoY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(treino.categoria, margin + 5, infoY + 8);
  doc.text(treino.dificuldade, margin + colWidth + 5, infoY + 8);
  doc.text(`${treino.duracao} min`, margin + colWidth * 2 + 5, infoY + 8);
  doc.text(`${treino.exercicios?.length || 0}`, margin + colWidth * 3 + 5, infoY + 8);
  
  yPosition += 35;

  // Tags
  if (treino.tags && treino.tags.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`Tags: ${treino.tags.join(', ')}`, margin, yPosition);
    yPosition += 10;
  }

  // Expiration date if available
  if (treino.dataExpiracao) {
    const dataExp = new Date(treino.dataExpiracao);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 100, 0);
    doc.text(`Válido até: ${dataExp.toLocaleDateString('pt-BR')}`, margin, yPosition);
    yPosition += 10;
  }

  // Exercises section
  yPosition += 5;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 33, 33);
  doc.text('Exercícios', margin, yPosition);
  yPosition += 10;

  // Draw exercises
  const exercicios = treino.exercicios || [];
  
  if (exercicios.length === 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('Nenhum exercício cadastrado neste treino.', margin, yPosition);
  } else {
    exercicios.forEach((exercicio, index) => {
      checkNewPage(45);

      // Exercise card background
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(margin, yPosition, pageWidth - margin * 2, 40, 2, 2, 'FD');

      // Exercise number and name
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 130, 180);
      doc.text(`#${index + 1}`, margin + 5, yPosition + 8);
      
      doc.setTextColor(33, 33, 33);
      doc.text(exercicio.nome, margin + 20, yPosition + 8);

      // Exercise details grid
      doc.setFontSize(9);
      const detailY = yPosition + 18;
      const detailCol = (pageWidth - margin * 2 - 10) / 4;

      // Séries
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Séries', margin + 5, detailY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(33, 33, 33);
      doc.text(String(exercicio.series), margin + 5, detailY + 6);

      // Repetições
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Repetições', margin + 5 + detailCol, detailY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(33, 33, 33);
      doc.text(String(exercicio.repeticoes), margin + 5 + detailCol, detailY + 6);

      // T.E.P / Peso
      if (exercicio.peso) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('T.E.P', margin + 5 + detailCol * 2, detailY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(33, 33, 33);
        doc.text(exercicio.peso, margin + 5 + detailCol * 2, detailY + 6);
      }

      // Descanso
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Descanso', margin + 5 + detailCol * 3, detailY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(33, 33, 33);
      doc.text(exercicio.descanso, margin + 5 + detailCol * 3, detailY + 6);

      // Observations
      if (exercicio.observacoes) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        const obsLines = doc.splitTextToSize(`Obs: ${exercicio.observacoes}`, pageWidth - margin * 2 - 15);
        doc.text(obsLines[0], margin + 5, yPosition + 35);
      }

      yPosition += 45;
    });
  }

  // Footer with generation date
  yPosition += 10;
  checkNewPage(20);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
    margin,
    yPosition
  );

  // Save the PDF
  const fileName = `treino-${treino.nome.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(fileName);
};

export const exportMultipleWorkoutsToPdf = (treinos: Treino[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  
  treinos.forEach((treino, treinoIndex) => {
    if (treinoIndex > 0) {
      doc.addPage();
    }

    let yPosition = 20;

    // Helper function to add a new page if needed
    const checkNewPage = (neededHeight: number) => {
      if (yPosition + neededHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPosition = 20;
      }
    };

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 33, 33);
    doc.text(treino.nome, margin, yPosition);
    yPosition += 10;

    // Description
    if (treino.descricao) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(treino.descricao, pageWidth - margin * 2);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * 5 + 5;
    }

    // Workout info
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${treino.categoria} | ${treino.dificuldade} | ${treino.duracao} min | ${treino.exercicios?.length || 0} exercícios`,
      margin,
      yPosition
    );
    yPosition += 12;

    // Exercises
    const exercicios = treino.exercicios || [];
    
    exercicios.forEach((exercicio, index) => {
      checkNewPage(25);

      doc.setFillColor(248, 248, 248);
      doc.roundedRect(margin, yPosition, pageWidth - margin * 2, 20, 2, 2, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70, 130, 180);
      doc.text(`${index + 1}.`, margin + 3, yPosition + 7);
      
      doc.setTextColor(33, 33, 33);
      doc.text(exercicio.nome, margin + 12, yPosition + 7);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const details = `${exercicio.series} séries x ${exercicio.repeticoes} reps | Descanso: ${exercicio.descanso}${exercicio.peso ? ` | T.E.P: ${exercicio.peso}` : ''}`;
      doc.text(details, margin + 12, yPosition + 14);

      yPosition += 25;
    });
  });

  // Save
  const fileName = `treinos-exportados-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
