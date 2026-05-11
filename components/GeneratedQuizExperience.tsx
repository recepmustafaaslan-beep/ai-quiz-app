"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyTextToClipboardSync } from "@/lib/copyToClipboard";
import {
  buildPaylasUrl,
  encodeSharePayloadSync,
  type ShareQuizPayloadV1,
} from "@/lib/shareQuizPayload";

type Difficulty = "easy" | "medium" | "hard";

export type GeneratedQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
  /** Doğru cevap gerekçesi; yanlışta gösterilir */
  explanation: string;
};

const difficultyLabelTr: Record<Difficulty, string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
};

/** Toplam puan tavanı; her soru eşit ağırlık (kalan 1’er puan ilk sorulara dağıtılır) */
const QUIZ_SCORE_MAX = 100;

function buildEqualQuestionWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(QUIZ_SCORE_MAX / n);
  const rem = QUIZ_SCORE_MAX % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function triggerDownload(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Props = {
  questions: GeneratedQuestion[];
};

export default function GeneratedQuizExperience({ questions }: Props) {
  const total = questions.length;
  const scoreRef = useRef(0);
  const pointsRef = useRef(0);

  const [playMode, setPlayMode] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerPhase, setAnswerPhase] = useState<"idle" | "answered">("idle");
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [roundDone, setRoundDone] = useState<{
    score: number;
    total: number;
    points: number;
    maxPoints: number;
  } | null>(null);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>(() =>
    questions.length ? Array.from({ length: questions.length }, () => null) : [],
  );

  const questionWeights = useMemo(() => buildEqualQuestionWeights(total), [total]);

  const currentQuestion = questions[currentIdx];
  const isLast = total > 0 && currentIdx === total - 1;

  const overallProgress = useMemo(() => {
    if (total === 0) return 0;
    const completed = answerPhase === "answered" ? currentIdx + 1 : currentIdx;
    return Math.min(100, (completed / total) * 100);
  }, [total, currentIdx, answerPhase]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (!roundDone) {
      void Promise.resolve().then(() => {
        setShareUrl(null);
        setShareFeedback(null);
      });
    }
  }, [roundDone]);

  const handleShareFriend = useCallback(() => {
    if (!roundDone) return;
    setShareFeedback(null);
    setShareUrl(null);
    try {
      const payload: ShareQuizPayloadV1 = {
        v: 1,
        questions: questions.map((q) => ({
          question: q.question,
          options: [...q.options] as [string, string, string, string],
          correctAnswerIndex: q.correctAnswerIndex,
          difficulty: q.difficulty,
          explanation: q.explanation ?? "",
        })),
        result: {
          score: roundDone.score,
          total: roundDone.total,
          points: roundDone.points,
          maxPoints: roundDone.maxPoints,
        },
      };
      const token = encodeSharePayloadSync(payload);
      const url = buildPaylasUrl(window.location.origin, token);
      setShareUrl(url);
      const long = url.length > 60_000;
      if (copyTextToClipboardSync(url)) {
        setShareFeedback(
          long
            ? "Link panoya kopyalandı (uzun link; gerekirse aşağıdan tekrar kopyala)."
            : "Link panoya kopyalandı — arkadaşına gönder!",
        );
      } else {
        setShareFeedback(
          long
            ? "Panoya otomatik kopyalanamadı. Aşağıdaki «Panoya kopyala» ile dene."
            : "Panoya otomatik kopyalanamadı. Aşağıdaki «Panoya kopyala» butonuna dokun.",
        );
      }
    } catch {
      setShareFeedback("Paylaşım oluşturulamadı. Tekrar dene.");
    }
  }, [roundDone, questions]);

  const handleCopyShareUrl = useCallback(() => {
    if (!shareUrl) return;
    if (copyTextToClipboardSync(shareUrl)) {
      setShareFeedback("Panoya kopyalandı.");
    } else {
      setShareFeedback("Kopyalanamadı: linki elle seçip kopyala (veya tarayıcı iznini kontrol et).");
    }
  }, [shareUrl]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setPlayMode(false);
      setCurrentIdx(0);
      setAnswerPhase("idle");
      setPickedIndex(null);
      setScore(0);
      setPoints(0);
      setRoundDone(null);
      pointsRef.current = 0;
      setUserAnswers(Array.from({ length: questions.length }, () => null));
    });
  }, [questions]);

  const startPlayMode = () => {
    if (total === 0) return;
    setRoundDone(null);
    setPlayMode(true);
    setCurrentIdx(0);
    setAnswerPhase("idle");
    setPickedIndex(null);
    setScore(0);
    setPoints(0);
    scoreRef.current = 0;
    pointsRef.current = 0;
    setUserAnswers(Array.from({ length: total }, () => null));
  };

  const handleDownloadQuestionsJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      format: "ai-quiz-questions",
      scoring: { maxPoints: QUIZ_SCORE_MAX, rule: "equal_per_question" },
      questions: questions.map((q) => ({
        question: q.question,
        options: [...q.options],
        correctAnswerIndex: q.correctAnswerIndex,
        difficulty: q.difficulty,
        explanation: q.explanation,
      })),
    };
    triggerDownload(
      `quiz-sorular-${Date.now()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  }, [questions]);

  const handleDownloadAttemptJson = useCallback(() => {
    if (!roundDone) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      format: "ai-quiz-attempt",
      scoring: { maxPoints: QUIZ_SCORE_MAX, rule: "equal_per_question" },
      result: {
        correctCount: roundDone.score,
        questionCount: roundDone.total,
        points: roundDone.points,
        maxPoints: roundDone.maxPoints,
      },
      userAnswers: userAnswers.map((a, i) => ({
        questionIndex: i,
        selectedOptionIndex: a,
        correct: a === questions[i]?.correctAnswerIndex,
      })),
      questions: questions.map((q) => ({
        question: q.question,
        options: [...q.options],
        correctAnswerIndex: q.correctAnswerIndex,
        difficulty: q.difficulty,
        explanation: q.explanation,
      })),
    };
    triggerDownload(
      `quiz-sonuc-${Date.now()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    );
  }, [roundDone, questions, userAnswers]);

  const pickOption = (index: number) => {
    if (!playMode || answerPhase !== "idle" || !currentQuestion) return;

    setPickedIndex(index);
    setAnswerPhase("answered");
    setUserAnswers((prev) => {
      const next = prev.length === total ? [...prev] : Array.from({ length: total }, () => null);
      next[currentIdx] = index;
      return next;
    });
    if (index === currentQuestion.correctAnswerIndex) {
      const add = questionWeights[currentIdx] ?? 0;
      setScore((s) => {
        const next = s + 1;
        scoreRef.current = next;
        return next;
      });
      setPoints((p) => {
        const next = p + add;
        pointsRef.current = next;
        return next;
      });
    }
  };

  const goNext = () => {
    if (!currentQuestion) return;
    if (isLast) {
      setRoundDone({
        score: scoreRef.current,
        total,
        points: pointsRef.current,
        maxPoints: QUIZ_SCORE_MAX,
      });
      setPlayMode(false);
      setCurrentIdx(0);
      setAnswerPhase("idle");
      setPickedIndex(null);
      return;
    }
    const next = currentIdx + 1;
    setCurrentIdx(next);
    setAnswerPhase("idle");
    setPickedIndex(null);
  };

  if (total === 0) return null;

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Quiz</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            Her soru eşit puan ({QUIZ_SCORE_MAX} üzerinden); yanlışta kısa açıklama.
          </p>
          {!playMode && !roundDone && total > 0 && (
            <p className="mt-2 text-xs text-zinc-600">
              Maksimum puan:{" "}
              <span className="font-medium text-zinc-400">{QUIZ_SCORE_MAX}</span> · zorluk puanı etkilemez
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {!playMode && !roundDone && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={startPlayMode}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3 text-sm font-semibold tracking-tight text-white shadow-[0_12px_40px_-12px_rgba(99,102,241,0.5)] transition duration-300 ease-out hover:scale-[1.02] hover:shadow-[0_16px_48px_-8px_rgba(99,102,241,0.55)] active:scale-[0.98]"
              >
                <span className="relative z-10">Quizi başlat</span>
                <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-white/15 to-cyan-400/0 opacity-0 transition duration-500 group-hover:opacity-100" />
              </button>
              <button
                type="button"
                onClick={handleDownloadQuestionsJson}
                className="rounded-2xl border border-white/[0.14] bg-white/[0.06] px-5 py-3 text-sm font-semibold text-zinc-100 shadow-inner transition duration-300 hover:border-emerald-400/35 hover:bg-emerald-500/10 hover:text-emerald-50"
              >
                Quiz&apos;i indir (JSON)
              </button>
            </div>
          )}
          {playMode && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={startPlayMode}
                className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-100"
              >
                Tekrar çöz
              </button>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 shadow-inner shadow-white/5 backdrop-blur-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/25">
                  {score}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Skor</p>
                  <p className="text-sm font-semibold tabular-nums text-white">
                    {score} <span className="font-normal text-zinc-600">/</span> {total}
                  </p>
                </div>
                <div className="h-10 w-px bg-white/[0.08]" aria-hidden />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Puan</p>
                  <p className="text-sm font-semibold tabular-nums text-amber-200/95">
                    {points}
                    <span className="font-normal text-zinc-600">
                      {" "}
                      / {QUIZ_SCORE_MAX}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex justify-between text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          <span>Tamamlanan sorular</span>
          <span>
            {playMode
              ? `${Math.min(answerPhase === "answered" ? currentIdx + 1 : currentIdx, total)} / ${total}`
              : roundDone
                ? `${total} / ${total}`
                : `0 / ${total}`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/90 ring-1 ring-white/[0.04]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 shadow-[0_0_12px_rgba(99,102,241,0.35)] transition-[width] duration-700 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {playMode && currentQuestion && (
        <article
          key={currentIdx}
          className="animate-quiz-card relative mt-10 overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-950/40 p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.06] before:to-transparent before:opacity-50 sm:p-8"
        >
          <div className="relative flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-zinc-200">
              Soru {currentIdx + 1} / {total}
            </span>
            <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-200">
              {difficultyLabelTr[currentQuestion.difficulty]}
            </span>
          </div>

          <h3 className="relative mt-8 text-lg font-medium leading-snug tracking-tight text-white sm:text-xl">
            {currentQuestion.question}
          </h3>

          <ul className="relative mt-7 space-y-3">
            {currentQuestion.options.map((option, optionIndex) => {
              const isPicked = pickedIndex === optionIndex;
              const isCorrect = optionIndex === currentQuestion.correctAnswerIndex;
              const showResult = answerPhase === "answered";
              const isWrongPick = showResult && isPicked && !isCorrect;

              let btnClass =
                "group relative w-full overflow-hidden rounded-2xl border px-4 py-4 text-left text-sm text-zinc-100 transition-all duration-300 ease-out ";
              if (answerPhase === "idle") {
                btnClass +=
                  "cursor-pointer border-white/[0.08] bg-white/[0.04] hover:border-indigo-400/35 hover:bg-white/[0.07] hover:shadow-[0_8px_30px_-12px_rgba(99,102,241,0.35)] active:scale-[0.995]";
              } else {
                btnClass += "cursor-default ";
              }
              if (showResult && isCorrect) {
                btnClass +=
                  "border-emerald-400/50 bg-emerald-500/[0.15] text-emerald-50 ring-1 ring-emerald-400/40 shadow-[0_0_24px_-8px_rgba(16,185,129,0.35)]";
              }
              if (isWrongPick) {
                btnClass +=
                  "border-rose-500/50 bg-rose-500/[0.12] text-rose-50 ring-1 ring-rose-400/35 shadow-[0_0_24px_-8px_rgba(244,63,94,0.25)]";
              }
              if (showResult && !isCorrect && !isWrongPick) {
                btnClass += "border-white/[0.04] bg-zinc-950/50 text-zinc-600";
              }

              return (
                <li key={`${option}-${optionIndex}`}>
                  <button
                    type="button"
                    disabled={answerPhase !== "idle"}
                    onClick={() => pickOption(optionIndex)}
                    className={btnClass}
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.06] text-xs font-bold text-zinc-300 transition duration-300 group-hover:border-indigo-400/25 group-hover:bg-indigo-500/20 group-hover:text-white">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="ml-3 inline-block align-middle">{option}</span>
                    {showResult && isCorrect && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-300">
                        Doğru
                      </span>
                    )}
                    {isWrongPick && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-300">
                        Yanlış
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {answerPhase === "answered" && pickedIndex !== null && (
            <div className="animate-quiz-card mt-6">
              {pickedIndex === currentQuestion.correctAnswerIndex ? (
                <p className="text-sm font-semibold text-emerald-300">Harika, doğru cevap!</p>
              ) : (
                <p className="text-sm font-semibold text-rose-300">Yanlış cevap.</p>
              )}
              {pickedIndex !== currentQuestion.correctAnswerIndex && currentQuestion.explanation && (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                    Neden doğru cevap bu?
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-200/95">{currentQuestion.explanation}</p>
                </div>
              )}
              {pickedIndex !== currentQuestion.correctAnswerIndex && (
                <p className="mt-3 text-sm text-slate-400">
                  Doğru şık:{" "}
                  <span className="font-semibold text-emerald-300">
                    {String.fromCharCode(65 + currentQuestion.correctAnswerIndex)}.{" "}
                    {currentQuestion.options[currentQuestion.correctAnswerIndex]}
                  </span>
                </p>
              )}
              <button
                type="button"
                onClick={goNext}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold tracking-tight text-white shadow-[0_12px_40px_-12px_rgba(99,102,241,0.45)] transition duration-300 ease-out hover:scale-[1.01] hover:shadow-[0_16px_48px_-8px_rgba(99,102,241,0.5)] active:scale-[0.99]"
              >
                {isLast ? "Sonuçları göster" : "Sonraki soru"}
              </button>
            </div>
          )}
        </article>
      )}

      {roundDone && (
        <div className="animate-quiz-result">
          <div className="relative mt-10 overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/70 via-zinc-950/90 to-indigo-950/80 p-8 text-center shadow-[0_24px_80px_-20px_rgba(16,185,129,0.15)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

            <p className="relative text-sm font-semibold uppercase tracking-widest text-emerald-400/90">
              Quiz tamamlandı
            </p>
            <p className="relative mt-4 text-5xl font-black tabular-nums text-white">
              {roundDone.score}
              <span className="text-2xl font-semibold text-slate-500">/{roundDone.total}</span>
            </p>
            <p className="relative mt-2 text-sm text-slate-400">
              Başarı oranı:{" "}
              <span className="font-semibold text-emerald-300">
                {Math.round((roundDone.score / roundDone.total) * 100)}%
              </span>
            </p>
            <p className="relative mt-1 text-sm text-slate-400">
              Toplam puan:{" "}
              <span className="font-semibold text-amber-200">
                {roundDone.points} / {roundDone.maxPoints}
              </span>
            </p>

            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={startPlayMode}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl active:scale-95"
              >
                Tekrar çöz
              </button>
              <button
                type="button"
                onClick={handleDownloadAttemptJson}
                className="rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition duration-300 hover:border-emerald-300/50 hover:bg-emerald-500/25"
              >
                Sonucu indir (JSON)
              </button>
              <button
                type="button"
                onClick={handleShareFriend}
                className="rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition duration-300 hover:border-cyan-300/50 hover:bg-cyan-500/25"
              >
                Arkadaşına gönder
              </button>
              <button
                type="button"
                onClick={() => setRoundDone(null)}
                className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 backdrop-blur-sm transition duration-300 hover:border-white/25 hover:bg-white/[0.08]"
              >
                Kapat
              </button>
            </div>

            {shareFeedback && (
              <p className="relative mt-4 text-center text-xs leading-relaxed text-zinc-400">{shareFeedback}</p>
            )}
            {shareUrl && (
              <div className="relative mt-4 text-left">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="share-quiz-url" className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Paylaşım linki
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    className="shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-950 shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)] transition hover:brightness-110 active:scale-[0.98]"
                  >
                    Panoya kopyala
                  </button>
                </div>
                <input
                  id="share-quiz-url"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300 outline-none ring-0 focus:border-cyan-500/40"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
