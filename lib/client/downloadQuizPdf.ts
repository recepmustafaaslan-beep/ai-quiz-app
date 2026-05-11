import { jsPDF } from "jspdf";

type Question = {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  difficulty: string;
  explanation?: string;
};

type UserAnswer = {
  questionIndex: number;
  selectedOptionIndex: number | null;
  correct: boolean;
};

export type DownloadQuizPdfOptions = {
  title?: string;
  questions: Question[];
  result?: {
    correctCount: number;
    questionCount: number;
    points: number;
    maxPoints: number;
  };
  userAnswers?: UserAnswer[];
};

const OPTION_LETTERS = ["A", "B", "C", "D"];
const DIFF_TR: Record<string, string> = { easy: "Kolay", medium: "Orta", hard: "Zor" };
const CHIP_COLORS: Record<string, [number, number, number]> = {
  Kolay: [34, 197, 94],
  Orta: [251, 146, 60],
  Zor: [239, 68, 68],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text, maxW) as string[];
}

function makePageState(doc: jsPDF) {
  let y = MARGIN;

  const newPage = () => {
    doc.addPage();
    y = MARGIN;
  };

  const need = (h: number) => {
    if (y + h > PAGE_H - MARGIN) newPage();
  };

  const getY = () => y;
  const setY = (v: number) => { y = v; };
  const addY = (v: number) => { y += v; };

  return { newPage, need, getY, setY, addY };
}

function drawSectionHeader(doc: jsPDF, ps: ReturnType<typeof makePageState>, text: string) {
  ps.need(14);
  doc.setFillColor(45, 45, 55);
  doc.rect(MARGIN, ps.getY() - 5, CONTENT_W, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(text, MARGIN + 4, ps.getY() + 1.5);
  ps.addY(12);
}

function drawFooters(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${p} / ${n}`, PAGE_W / 2, PAGE_H - 8, { align: "center" });
    doc.text(new Date().toLocaleDateString("tr-TR"), MARGIN, PAGE_H - 8);
  }
}

/** Bölüm 1: sadece sorular ve şıklar (cevap işareti yok) */
function drawQuestionsSection(
  doc: jsPDF,
  ps: ReturnType<typeof makePageState>,
  questions: Question[],
) {
  questions.forEach((q, idx) => {
    const diffLabel = DIFF_TR[q.difficulty] ?? q.difficulty;
    const qLines = wrap(doc, `${idx + 1}. ${q.question}`, CONTENT_W - 24);
    const estH = qLines.length * 5.5 + q.options.slice(0, 4).length * 6 + 10;
    ps.need(estH);

    // Difficulty chip
    const [cr, cg, cb] = CHIP_COLORS[diffLabel] ?? [150, 150, 150];
    doc.setFillColor(cr, cg, cb);
    doc.setDrawColor(cr, cg, cb);
    doc.roundedRect(PAGE_W - MARGIN - 18, ps.getY() - 4.5, 18, 6, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(diffLabel, PAGE_W - MARGIN - 9, ps.getY() - 0.5, { align: "center" });

    // Question text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    qLines.forEach((line, li) => {
      doc.text(line, MARGIN + 5, ps.getY() + li * 5.5);
    });
    ps.addY(qLines.length * 5.5 + 2);

    // Options — plain, no highlighting
    q.options.slice(0, 4).forEach((opt, oi) => {
      ps.need(6);
      const letter = OPTION_LETTERS[oi] ?? String(oi);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      const optLines = wrap(doc, `${letter}) ${opt}`, CONTENT_W - 14);
      optLines.forEach((line, li) => {
        doc.text(line, MARGIN + 8, ps.getY() + li * 5);
      });
      ps.addY(optLines.length * 5 + 1);
    });

    ps.addY(6);

    if (idx < questions.length - 1) {
      ps.need(2);
      doc.setDrawColor(220, 220, 220);
      doc.line(MARGIN, ps.getY() - 2, PAGE_W - MARGIN, ps.getY() - 2);
    }
  });
}

/** Bölüm 2: cevap anahtarı — tablo + açıklamalar */
function drawAnswerKeySection(
  doc: jsPDF,
  ps: ReturnType<typeof makePageState>,
  questions: Question[],
) {
  // Compact answer table: 5 columns per row
  const COLS = 5;
  const cellW = CONTENT_W / COLS;
  const cellH = 10;

  ps.need(cellH * 2 + 4);

  // Table header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  for (let c = 0; c < COLS; c++) {
    doc.setFillColor(60, 60, 80);
    doc.rect(MARGIN + c * cellW, ps.getY(), cellW, cellH, "F");
    doc.setDrawColor(100, 100, 120);
    doc.rect(MARGIN + c * cellW, ps.getY(), cellW, cellH, "S");
    doc.text("Soru / Cevap", MARGIN + c * cellW + cellW / 2, ps.getY() + 6.5, { align: "center" });
  }
  ps.addY(cellH);

  // Answer rows
  for (let i = 0; i < questions.length; i += COLS) {
    ps.need(cellH + 2);
    for (let c = 0; c < COLS; c++) {
      const qIdx = i + c;
      if (qIdx >= questions.length) break;
      const q = questions[qIdx];
      const letter = OPTION_LETTERS[q.correctAnswerIndex] ?? "?";

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(134, 239, 172);
      doc.rect(MARGIN + c * cellW, ps.getY(), cellW, cellH, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(21, 128, 70);
      doc.text(`${qIdx + 1}. → ${letter}`, MARGIN + c * cellW + cellW / 2, ps.getY() + 6.5, {
        align: "center",
      });
    }
    ps.addY(cellH);
  }

  ps.addY(8);

  // Explanations
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, ps.getY(), PAGE_W - MARGIN, ps.getY());
  ps.addY(5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text("Açıklamalar", MARGIN, ps.getY());
  ps.addY(7);

  questions.forEach((q, idx) => {
    if (!q.explanation) return;
    const letter = OPTION_LETTERS[q.correctAnswerIndex] ?? "?";
    const header = `${idx + 1}. Doğru cevap: ${letter}) ${q.options[q.correctAnswerIndex] ?? ""}`;
    const headerLines = wrap(doc, header, CONTENT_W - 4);
    const expLines = wrap(doc, q.explanation, CONTENT_W - 8);
    ps.need(headerLines.length * 5 + expLines.length * 4.8 + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(21, 128, 70);
    headerLines.forEach((line) => {
      doc.text(line, MARGIN, ps.getY());
      ps.addY(5);
    });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    expLines.forEach((line) => {
      ps.need(5);
      doc.text(line, MARGIN + 4, ps.getY());
      ps.addY(4.8);
    });

    ps.addY(5);
  });
}

/** Bölüm 3: sonuç — kullanıcı cevapları işaretli */
function drawResultSection(
  doc: jsPDF,
  ps: ReturnType<typeof makePageState>,
  questions: Question[],
  userAnswers: UserAnswer[],
  result: NonNullable<DownloadQuizPdfOptions["result"]>,
) {
  // Score box
  ps.need(18);
  doc.setFillColor(30, 30, 40);
  doc.roundedRect(MARGIN, ps.getY(), CONTENT_W, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `${result.correctCount} / ${result.questionCount} doğru   •   Puan: ${result.points} / ${result.maxPoints}`,
    PAGE_W / 2,
    ps.getY() + 9,
    { align: "center" },
  );
  ps.addY(20);

  questions.forEach((q, idx) => {
    const ua = userAnswers[idx];
    const diffLabel = DIFF_TR[q.difficulty] ?? q.difficulty;
    const isCorrect = ua?.correct ?? false;
    const userLetter =
      ua?.selectedOptionIndex != null ? (OPTION_LETTERS[ua.selectedOptionIndex] ?? "?") : "—";
    const correctLetter = OPTION_LETTERS[q.correctAnswerIndex] ?? "?";

    const qLines = wrap(doc, `${idx + 1}. ${q.question}`, CONTENT_W - 24);
    const expLines = q.explanation ? wrap(doc, q.explanation, CONTENT_W - 8) : [];
    const estH = qLines.length * 5.5 + q.options.slice(0, 4).length * 6 + expLines.length * 5 + 16;
    ps.need(estH);

    // Result badge (✓ / ✗)
    doc.setFillColor(isCorrect ? 34 : 239, isCorrect ? 197 : 68, isCorrect ? 94 : 68);
    doc.circle(MARGIN + 3.5, ps.getY() - 1.5, 3.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(isCorrect ? "✓" : "✗", MARGIN + 3.5, ps.getY() + 0, { align: "center" });

    // Difficulty chip
    const [cr, cg, cb] = CHIP_COLORS[diffLabel] ?? [150, 150, 150];
    doc.setFillColor(cr, cg, cb);
    doc.setDrawColor(cr, cg, cb);
    doc.roundedRect(PAGE_W - MARGIN - 18, ps.getY() - 4.5, 18, 6, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(diffLabel, PAGE_W - MARGIN - 9, ps.getY() - 0.5, { align: "center" });

    // Question text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    qLines.forEach((line, li) => {
      doc.text(line, MARGIN + 9, ps.getY() + li * 5.5);
    });
    ps.addY(qLines.length * 5.5 + 2);

    // Options with highlights
    q.options.slice(0, 4).forEach((opt, oi) => {
      ps.need(6);
      const letter = OPTION_LETTERS[oi] ?? String(oi);
      const isAnsCorrect = oi === q.correctAnswerIndex;
      const isUserPick = ua?.selectedOptionIndex === oi;
      const isWrong = isUserPick && !isCorrect;

      if (isAnsCorrect) {
        doc.setFillColor(220, 252, 231);
        doc.roundedRect(MARGIN + 4, ps.getY() - 4, CONTENT_W - 4, 6, 1, 1, "F");
      } else if (isWrong) {
        doc.setFillColor(254, 226, 226);
        doc.roundedRect(MARGIN + 4, ps.getY() - 4, CONTENT_W - 4, 6, 1, 1, "F");
      }

      doc.setFont("helvetica", isAnsCorrect ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor(
        isAnsCorrect ? 21 : isWrong ? 185 : 50,
        isAnsCorrect ? 128 : isWrong ? 28 : 50,
        isAnsCorrect ? 70 : isWrong ? 28 : 50,
      );
      const optLines = wrap(doc, `${letter}) ${opt}`, CONTENT_W - 16);
      optLines.forEach((line, li) => {
        doc.text(line, MARGIN + 8, ps.getY() + li * 5);
      });
      ps.addY(optLines.length * 5 + 1);
    });

    // User / correct summary line
    ps.need(6);
    ps.addY(1);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const summary = isCorrect
      ? `Cevabın: ${userLetter} ✓`
      : `Cevabın: ${userLetter}   •   Doğru: ${correctLetter}`;
    doc.text(summary, MARGIN + 8, ps.getY());
    ps.addY(5);

    // Explanation
    if (expLines.length > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      expLines.forEach((line) => {
        ps.need(5);
        doc.text(line, MARGIN + 8, ps.getY());
        ps.addY(4.8);
      });
    }

    ps.addY(6);
    if (idx < questions.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.line(MARGIN, ps.getY() - 2, PAGE_W - MARGIN, ps.getY() - 2);
    }
  });
}

export function downloadQuizPdf({
  title = "Quiz",
  questions,
  result,
  userAnswers,
}: DownloadQuizPdfOptions): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const ps = makePageState(doc);

  // ── Main title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  const titleLines = wrap(doc, title, CONTENT_W);
  titleLines.forEach((line) => {
    doc.text(line, MARGIN, ps.getY());
    ps.addY(8);
  });
  doc.setDrawColor(180, 180, 180);
  doc.line(MARGIN, ps.getY(), PAGE_W - MARGIN, ps.getY());
  ps.addY(6);

  if (result && userAnswers && userAnswers.length > 0) {
    // ── Sonuç modu: cevaplar işaretli ──
    drawSectionHeader(doc, ps, "Sonuçlarınız");
    drawResultSection(doc, ps, questions, userAnswers, result);

    // Yeni sayfa → Cevap anahtarı
    ps.newPage();
    drawSectionHeader(doc, ps, "Cevap Anahtarı");
    drawAnswerKeySection(doc, ps, questions);
  } else {
    // ── Soru modu: temiz sorular + ayrı cevap anahtarı ──
    drawSectionHeader(doc, ps, "Sorular");
    drawQuestionsSection(doc, ps, questions);

    // Yeni sayfa → Cevap anahtarı
    ps.newPage();
    drawSectionHeader(doc, ps, "Cevap Anahtarı");
    drawAnswerKeySection(doc, ps, questions);
  }

  drawFooters(doc);

  const filename = result
    ? `quiz-sonuc-${Date.now()}.pdf`
    : `quiz-sorular-${Date.now()}.pdf`;
  doc.save(filename);
}
