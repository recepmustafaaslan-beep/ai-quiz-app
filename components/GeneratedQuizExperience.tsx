"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Difficulty = "easy" | "medium" | "hard";

export type GeneratedQuestion = {
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: 0 | 1 | 2 | 3;
  difficulty: Difficulty;
};

const difficultySeconds: Record<Difficulty, number> = {
  easy: 25,
  medium: 18,
  hard: 12,
};

const difficultyLabelTr: Record<Difficulty, string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
};

type Props = {
  questions: GeneratedQuestion[];
};

export default function GeneratedQuizExperience({ questions }: Props) {
  const total = questions.length;
  const scoreRef = useRef(0);

  const [playMode, setPlayMode] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerPhase, setAnswerPhase] = useState<"idle" | "answered">("idle");
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [roundDone, setRoundDone] = useState<{ score: number; total: number } | null>(null);

  const currentQuestion = questions[currentIdx];
  const currentSeconds = currentQuestion ? difficultySeconds[currentQuestion.difficulty] : 0;
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
    setPlayMode(false);
    setCurrentIdx(0);
    setAnswerPhase("idle");
    setPickedIndex(null);
    setTimeLeft(0);
    setScore(0);
    setRoundDone(null);
  }, [questions]);

  useEffect(() => {
    if (!playMode || answerPhase !== "idle" || total === 0) return;
    if (timeLeft <= 0) return;

    const id = window.setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [playMode, answerPhase, timeLeft, total]);

  useEffect(() => {
    if (!playMode || answerPhase !== "idle" || total === 0) return;
    if (timeLeft > 0) return;

    setAnswerPhase("answered");
    setPickedIndex(null);
  }, [timeLeft, playMode, answerPhase, total]);

  const startPlayMode = () => {
    if (total === 0) return;
    setRoundDone(null);
    setPlayMode(true);
    setCurrentIdx(0);
    setAnswerPhase("idle");
    setPickedIndex(null);
    setScore(0);
    setTimeLeft(difficultySeconds[questions[0].difficulty]);
  };

  const pickOption = (index: number) => {
    if (!playMode || answerPhase !== "idle" || !currentQuestion) return;

    setPickedIndex(index);
    setAnswerPhase("answered");
    if (index === currentQuestion.correctAnswerIndex) {
      setScore((s) => s + 1);
    }
  };

  const goNext = () => {
    if (!currentQuestion) return;
    if (isLast) {
      setRoundDone({ score: scoreRef.current, total });
      setPlayMode(false);
      setCurrentIdx(0);
      setAnswerPhase("idle");
      setPickedIndex(null);
      setTimeLeft(0);
      return;
    }
    const next = currentIdx + 1;
    setCurrentIdx(next);
    setAnswerPhase("idle");
    setPickedIndex(null);
    setTimeLeft(difficultySeconds[questions[next].difficulty]);
  };

  if (total === 0) return null;

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Quiz</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            Şık seç, geri bildirimi gör, sonraki soruya geç.
          </p>
        </div>
        {!playMode && !roundDone && (
          <button
            type="button"
            onClick={startPlayMode}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3 text-sm font-semibold tracking-tight text-white shadow-[0_12px_40px_-12px_rgba(99,102,241,0.5)] transition duration-300 ease-out hover:scale-[1.02] hover:shadow-[0_16px_48px_-8px_rgba(99,102,241,0.55)] active:scale-[0.98]"
          >
            <span className="relative z-10">Quizi başlat</span>
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-white/15 to-cyan-400/0 opacity-0 transition duration-500 group-hover:opacity-100" />
          </button>
        )}
        {playMode && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 shadow-inner shadow-white/5 backdrop-blur-md transition duration-300 hover:border-white/15">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/25">
              {score}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Skor</p>
              <p className="text-sm font-semibold tabular-nums text-white">
                {score} <span className="font-normal text-zinc-600">/</span> {total}
              </p>
            </div>
          </div>
        )}
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
            <span
              className={`rounded-full border border-white/[0.06] px-3.5 py-1.5 font-mono text-xs font-semibold tabular-nums transition duration-300 ${
                timeLeft <= 3
                  ? "animate-pulse border-rose-500/30 bg-rose-500/15 text-rose-200"
                  : "bg-white/[0.04] text-cyan-200/95"
              }`}
            >
              {timeLeft}s
            </span>
          </div>

          <div className="relative mt-5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-white/[0.04]">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                timeLeft <= 3 ? "bg-gradient-to-r from-rose-500 to-orange-400" : "bg-gradient-to-r from-cyan-500 to-indigo-500"
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, (timeLeft / currentSeconds) * 100))}%`,
              }}
            />
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

          {answerPhase === "answered" && (
            <div className="animate-quiz-card mt-6">
              {pickedIndex === null ? (
                <p className="text-sm font-medium text-amber-200">Süre bitti. Bu soru yanlış sayıldı.</p>
              ) : pickedIndex === currentQuestion.correctAnswerIndex ? (
                <p className="text-sm font-semibold text-emerald-300">Harika, doğru cevap!</p>
              ) : (
                <p className="text-sm font-semibold text-rose-300">Yanlış cevap.</p>
              )}
              {(pickedIndex === null || pickedIndex !== currentQuestion.correctAnswerIndex) && (
                <p className="mt-2 text-sm text-slate-400">
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

            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={startPlayMode}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl active:scale-95"
              >
                Tekrar dene
              </button>
              <button
                type="button"
                onClick={() => setRoundDone(null)}
                className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 backdrop-blur-sm transition duration-300 hover:border-white/25 hover:bg-white/[0.08]"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
