import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoWhite from "@/assets/logo-white.svg";
import { CHECKIN_SECTIONS, CHECKIN_SECTION_FIELD_KEYS } from "@/lib/checkin-sections";
import {
  compareCheckinField,
  deltaLabel,
  formatCheckinFieldValue,
  getFieldLabel,
  hasRelato,
  isCheckinRespondido,
} from "@/lib/checkin-display";
import { getCheckinPrioridadeSummary, isCheckinPrioridade } from "@/lib/checkin-highlights";
import type { WeeklyCheckinRecord } from "@/types/weekly-checkin";

type RGB = [number, number, number];

const brand = {
  black: [7, 7, 7] as RGB,
  gold: [212, 175, 55] as RGB,
  text: [33, 33, 33] as RGB,
  muted: [92, 92, 92] as RGB,
  border: [226, 226, 226] as RGB,
  surface: [250, 250, 250] as RGB,
};

const pageTop = 48;
const pageBottom = 22;

let cachedLogoDataUrlPromise: Promise<string | null> | null = null;

const getBrandLogoDataUrl = (): Promise<string | null> => {
  if (cachedLogoDataUrlPromise) return cachedLogoDataUrlPromise;
  cachedLogoDataUrlPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
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
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const setFill = (doc: jsPDF, color: RGB) => doc.setFillColor(color[0], color[1], color[2]);
const setDraw = (doc: jsPDF, color: RGB) => doc.setDrawColor(color[0], color[1], color[2]);
const setText = (doc: jsPDF, color: RGB) => doc.setTextColor(color[0], color[1], color[2]);

const drawHeader = (doc: jsPDF, pageWidth: number, margin: number, logoDataUrl: string | null) => {
  setFill(doc, brand.black);
  doc.rect(0, 0, pageWidth, 36, "F");
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 7, 48, 20, undefined, "FAST");
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    setText(doc, brand.gold);
    doc.text("BLACK HOUSE", margin, 20);
  }
  setFill(doc, brand.gold);
  doc.rect(0, 35, pageWidth, 1, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setText(doc, brand.gold);
  doc.text("CHECK-IN SEMANAL", pageWidth - margin, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  setText(doc, [220, 220, 220]);
  doc.text(
    new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    pageWidth - margin,
    22,
    { align: "right" },
  );
};

const drawFooters = (doc: jsPDF, pageWidth: number, margin: number) => {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    setDraw(doc, brand.border);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setText(doc, brand.muted);
    doc.text("Black House — documento confidencial", margin, pageHeight - 8);
    doc.text(`Página ${page}/${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }
};

export type ExportCheckinPdfInput = {
  checkin: WeeklyCheckinRecord;
  previousCheckin?: WeeklyCheckinRecord | null;
  studentName: string;
  coachFeedback?: string;
};

export async function exportCheckinToPdf({
  checkin,
  previousCheckin,
  studentName,
  coachFeedback,
}: ExportCheckinPdfInput): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const logoDataUrl = await getBrandLogoDataUrl();

  drawHeader(doc, pageWidth, margin, logoDataUrl);
  let y = pageTop;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - pageBottom) return;
    doc.addPage();
    drawHeader(doc, pageWidth, margin, logoDataUrl);
    y = pageTop;
  };

  const writeWrapped = (text: string, fontSize: number, bold = false, color: RGB = brand.text) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    setText(doc, color);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.45 + 2;
    for (const line of lines) {
      ensureSpace(lineHeight + 1);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  const checkinDate = format(new Date(checkin.created_at), "dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  writeWrapped(studentName, 16, true);
  y += 2;
  writeWrapped(`Check-in de ${checkinDate}`, 10, false, brand.muted);

  const statusParts: string[] = [];
  statusParts.push(isCheckinRespondido(checkin) ? "Respondido" : "Pendente");
  if (isCheckinPrioridade(checkin)) {
    statusParts.push(`Prioridade: ${getCheckinPrioridadeSummary(checkin)}`);
  }
  y += 1;
  writeWrapped(statusParts.join(" · "), 9, false, brand.muted);
  y += 4;

  if (hasRelato(checkin)) {
    ensureSpace(20);
    setFill(doc, brand.surface);
    setDraw(doc, brand.border);
    const relato = checkin.nao_cumpriu_porque?.trim() ?? "";
    const relatoLines = doc.splitTextToSize(relato, contentWidth - 12);
    const boxH = Math.max(24, 14 + relatoLines.length * 4.5);
    doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setText(doc, brand.text);
    doc.text("Relato do aluno", margin + 6, y + 8);
    doc.setFont("helvetica", "normal");
    setText(doc, brand.muted);
    let ry = y + 14;
    for (const line of relatoLines) {
      doc.text(line, margin + 6, ry);
      ry += 4.5;
    }
    y += boxH + 6;
  }

  for (const section of CHECKIN_SECTIONS) {
    ensureSpace(14);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setText(doc, brand.text);
    doc.text(section.title, margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setText(doc, brand.muted);
    doc.text(section.description, margin, y);
    y += 6;

    const keys = CHECKIN_SECTION_FIELD_KEYS[section.id].filter((k) => k !== "nao_cumpriu_porque");

    for (const key of keys) {
      const value = checkin[key as keyof WeeklyCheckinRecord];
      const formatted = formatCheckinFieldValue(key, value);
      const prevValue = previousCheckin?.[key as keyof WeeklyCheckinRecord];
      const delta =
        previousCheckin != null ? compareCheckinField(key, value, prevValue) : ("unknown" as const);
      const deltaText = deltaLabel(delta);

      const label = getFieldLabel(key);
      const valueLine = deltaText ? `${formatted} (${deltaText})` : formatted;
      const blockLines = doc.splitTextToSize(`${label}: ${valueLine}`, contentWidth - 8);
      const blockH = Math.max(12, 8 + blockLines.length * 4.2);
      ensureSpace(blockH + 2);

      setFill(doc, [255, 255, 255]);
      setDraw(doc, brand.border);
      doc.roundedRect(margin, y, contentWidth, blockH, 1.5, 1.5, "FD");
      let by = y + 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      setText(doc, brand.text);
      for (const line of blockLines) {
        doc.text(line, margin + 4, by);
        by += 4.2;
      }
      y += blockH + 3;
    }
    y += 4;
  }

  const feedbackTrimmed = coachFeedback?.trim();
  if (feedbackTrimmed) {
    ensureSpace(16);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setText(doc, brand.text);
    doc.text("Resposta do coach", margin, y);
    y += 6;
    writeWrapped(feedbackTrimmed, 9, false, brand.text);
  }

  drawFooters(doc, pageWidth, margin);

  const dateSlug = format(new Date(checkin.created_at), "yyyy-MM-dd");
  const fileName = `checkin-${toSafeFileName(studentName)}-${dateSlug}.pdf`;
  doc.save(fileName);
}
