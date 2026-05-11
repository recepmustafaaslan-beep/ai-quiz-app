"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import questionData from "@/data/questions.json";
import { downloadQuizPdf } from "@/lib/client/downloadQuizPdf";

type Difficulty = "easy" | "medium" | "hard";

type Question = {
  id: string;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  answerIndex: number;
};

type SavedScore = {
  score: number;
  total: number;
  category: string;
  difficulty: Difficulty;
  date: string;
};

const questions = questionData as Question[];
const SCORE_HISTORY_KEY = "quiz-score-history";

function readScoreHistoryFromStorage(): SavedScore[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SCORE_HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedScore[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
const difficulties: Difficulty[] = ["easy", "medium", "hard"];
const CLASSIC_SCORE_MAX = 100;

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
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
const difficultyLabel: Record<Difficulty, string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
};

export default function QuizPage() {
  const [started, setStarted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [answerStatus, setAnswerStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [scoreHistory, setScoreHistory] = useState<SavedScore[]>(readScoreHistoryFromStorage);

  const categories = useMemo(
    () => Array.from(new Set(questions.map((question) => question.category))),
    [],
  );

  const categoryQuestions = useMemo(() => {
    if (!selectedCategory) return [];
    return questions.filter((question) => question.category === selectedCategory);
  }, [selectedCategory]);

  const filteredQuestions = useMemo(() => {
    if (!selectedDifficulty) return categoryQuestions;
    return categoryQuestions.filter((question) => question.difficulty === selectedDifficulty);
  }, [categoryQuestions, selectedDifficulty]);

  const currentQuestion = filteredQuestions[currentIndex];
  const isLastQuestion = currentIndex === filteredQuestions.length - 1;
  const isFinished = started && currentIndex >= filteredQuestions.length;

  const resultMessage = useMemo(() => {
    if (filteredQuestions.length === 0) return "";
    const ratio = score / filteredQuestions.length;
    if (ratio === 1) return "Mükemmel! Tüm sorular doğru.";
    if (ratio >= 0.6) return "Çok iyi! Bir tur daha ile tam isabet gelir.";
    return "Güzel başlangıç. Bir tur daha deneyebilirsin.";
  }, [score, filteredQuestions.length]);

  const saveScore = (newScore: number) => {
    if (!selectedCategory || !selectedDifficulty) return;
    const nextEntry: SavedScore = {
      score: newScore,
      total: filteredQuestions.length,
      category: selectedCategory,
      difficulty: selectedDifficulty,
      date: new Date().toLocaleString("tr-TR"),
    };
    const nextHistory = [nextEntry, ...scoreHistory].slice(0, 5);
    setScoreHistory(nextHistory);
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(nextHistory));
  };

  const moveToNextQuestion = () => {
    if (isLastQuestion) {
      setCurrentIndex(filteredQuestions.length);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setSelectedChoice(null);
    setAnswerStatus("idle");
  };

  const startQuiz = () => {
    if (!selectedCategory || !selectedDifficulty) return;
    setStarted(true);
    setCurrentIndex(0);
    setScore(0);
    setSelectedChoice(null);
    setAnswerStatus("idle");
  };

  const submitAnswer = () => {
    if (selectedChoice === null || answerStatus !== "idle") return;

    let nextScore = score;
    if (selectedChoice === currentQuestion.answerIndex) {
      nextScore += 1;
      setScore(nextScore);
      setAnswerStatus("correct");
    } else {
      setAnswerStatus("wrong");
    }

    if (isLastQuestion) {
      saveScore(nextScore);
    }

    window.setTimeout(() => {
      moveToNextQuestion();
    }, 900);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_-25%,rgba(99,102,241,0.35),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_10%,rgba(34,211,238,0.14),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_0%_60%,rgba(167,139,250,0.12),transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#030712]/90" />
      </div>

      <header className="animate-fade-rise relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2 transition duration-300 hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 ring-1 ring-white/20 transition duration-300 hover:scale-105 hover:shadow-indigo-500/45">
            <span className="text-sm font-bold tracking-tighter text-white">AI</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-200">Quiz Studio</span>
        </Link>
        <Link
          href="/"
          className="group rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-zinc-300 shadow-sm backdrop-blur-md transition duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_24px_-4px_rgba(99,102,241,0.35)]"
        >
          <span className="transition duration-300 group-hover:tracking-wide">PDF ile quiz</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl px-6 pb-24 pt-2 sm:px-10">
        <div className="animate-fade-rise-delay-1 mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400 shadow-inner shadow-white/5 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
            Klasik mod
          </div>
          <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            <span className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent">
              Hazır soru bankası
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-zinc-400 sm:text-base">
            Kategori ve zorluk seç, cevapla ve skorunu kaydet.
          </p>
        </div>

        <div className="animate-fade-rise-delay-2 relative">
          <div className="absolute -inset-px rounded-[1.35rem] bg-gradient-to-b from-white/12 via-indigo-500/15 to-transparent opacity-50 blur-sm" />
          <div className="relative rounded-3xl border border-white/[0.09] bg-white/[0.05] p-6 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-8">
            {!started && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6">
                <p className="text-sm text-zinc-300">Kategori ve zorluk seçerek quizi başlat.</p>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold tracking-tight transition duration-300 ease-out hover:scale-[1.02] active:scale-[0.99] ${
                        selectedCategory === category
                          ? "border-indigo-400/50 bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-[0_8px_32px_-8px_rgba(99,102,241,0.5)]"
                          : "border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08]"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {difficulties.map((difficulty) => (
                    <button
                      key={difficulty}
                      type="button"
                      onClick={() => setSelectedDifficulty(difficulty)}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold tracking-tight transition duration-300 ease-out hover:scale-[1.02] active:scale-[0.99] ${
                        selectedDifficulty === difficulty
                          ? "border-emerald-400/40 bg-emerald-500/25 text-emerald-50 shadow-[0_0_24px_-6px_rgba(16,185,129,0.45)]"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-emerald-400/25 hover:bg-emerald-500/10 hover:text-emerald-100"
                      }`}
                    >
                      {difficultyLabel[difficulty]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={startQuiz}
                  disabled={!selectedCategory || !selectedDifficulty || filteredQuestions.length === 0}
                  className="btn-shimmer group relative mt-6 flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold tracking-tight text-white shadow-[0_12px_40px_-12px_rgba(99,102,241,0.55)] transition duration-300 ease-out hover:scale-[1.01] hover:shadow-[0_16px_48px_-8px_rgba(99,102,241,0.65)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  <span className="relative z-10">Quiz Başlat</span>
                </button>

                {selectedCategory && selectedDifficulty && (
                  <p className="mt-4 text-center text-xs text-zinc-500">
                    Hazırlanan soru: <span className="font-medium text-zinc-300">{filteredQuestions.length}</span> adet
                  </p>
                )}
              </div>
            )}

            {started && !isFinished && (
              <section className="animate-fade-rise">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-zinc-400 sm:text-sm">
                  <span className="text-zinc-300">
                    {selectedCategory} · {selectedDifficulty && difficultyLabel[selectedDifficulty]} · Soru{" "}
                    {currentIndex + 1}/{filteredQuestions.length}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-zinc-200 backdrop-blur-md">
                    Skor: {score}
                  </span>
                </div>
                <h2 className="mb-6 text-balance text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">
                  {currentQuestion.prompt}
                </h2>

                <div className="mt-6 space-y-3">
                  {currentQuestion.choices.map((choice, index) => {
                    const isSelected = selectedChoice === index;
                    const isCorrectChoice = answerStatus !== "idle" && index === currentQuestion.answerIndex;
                    const isWrongSelected =
                      answerStatus === "wrong" && isSelected && index !== currentQuestion.answerIndex;

                    let buttonClass =
                      "border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08] hover:shadow-[0_0_20px_-8px_rgba(99,102,241,0.2)]";
                    if (isCorrectChoice)
                      buttonClass =
                        "border-emerald-400/50 bg-emerald-500/20 text-emerald-50 shadow-[0_0_24px_-6px_rgba(16,185,129,0.4)]";
                    if (isWrongSelected)
                      buttonClass =
                        "border-rose-400/50 bg-rose-500/20 text-rose-50 shadow-[0_0_20px_-6px_rgba(244,63,94,0.35)]";
                    if (answerStatus === "idle" && isSelected) {
                      buttonClass =
                        "border-indigo-400/40 bg-indigo-500/25 text-white shadow-[0_0_24px_-6px_rgba(99,102,241,0.45)]";
                    }

                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setSelectedChoice(index)}
                        disabled={answerStatus !== "idle"}
                        className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium tracking-tight transition duration-300 ease-out hover:scale-[1.01] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-80 ${buttonClass}`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>

                {answerStatus === "correct" && (
                  <p className="mt-4 text-sm font-semibold text-emerald-300/90">Doğru cevap!</p>
                )}
                {answerStatus === "wrong" && (
                  <p className="mt-4 text-sm font-semibold text-rose-300/90">
                    Yanlış cevap. Doğrusu: {currentQuestion.choices[currentQuestion.answerIndex]}
                  </p>
                )}

                <button
                  type="button"
                  onClick={submitAnswer}
                  disabled={selectedChoice === null || answerStatus !== "idle"}
                  className="mt-8 w-full rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-600/90 to-teal-600/90 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_12px_40px_-12px_rgba(16,185,129,0.4)] transition duration-300 ease-out hover:scale-[1.01] hover:shadow-[0_16px_48px_-8px_rgba(16,185,129,0.45)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  {isLastQuestion ? "Quiz'i bitir" : "Sonraki soru"}
                </button>
              </section>
            )}

            {isFinished && (
              <section className="animate-fade-rise rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] p-6 backdrop-blur-md sm:p-8">
                <h2 className="text-2xl font-semibold tracking-tight text-white">Quiz tamamlandı</h2>
                <p className="mt-4 text-sm text-emerald-100/90">
                  Kategori: <span className="font-semibold text-white">{selectedCategory}</span>
                </p>
                <p className="mt-1 text-sm text-emerald-100/90">
                  Zorluk:{" "}
                  <span className="font-semibold text-white">
                    {selectedDifficulty ? difficultyLabel[selectedDifficulty] : "-"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-emerald-100/90">
                  Skorun:{" "}
                  <span className="font-semibold text-white">
                    {score} / {filteredQuestions.length}
                  </span>
                </p>
                <p className="mt-1 text-sm text-emerald-100/90">
                  Puan (her soru eşit, {CLASSIC_SCORE_MAX} üzerinden):{" "}
                  <span className="font-semibold text-white">
                    {filteredQuestions.length > 0
                      ? Math.round((score / filteredQuestions.length) * CLASSIC_SCORE_MAX)
                      : 0}{" "}
                    / {CLASSIC_SCORE_MAX}
                  </span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{resultMessage}</p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const points100 =
                        filteredQuestions.length > 0
                          ? Math.round((score / filteredQuestions.length) * CLASSIC_SCORE_MAX)
                          : 0;
                      downloadQuizPdf({
                        title: `Klasik Quiz — ${selectedCategory ?? "Tüm kategoriler"}`,
                        questions: filteredQuestions.map((q) => ({
                          question: q.prompt,
                          options: q.choices,
                          correctAnswerIndex: q.answerIndex,
                          difficulty: q.difficulty,
                        })),
                        result: {
                          correctCount: score,
                          questionCount: filteredQuestions.length,
                          points: points100,
                          maxPoints: CLASSIC_SCORE_MAX,
                        },
                      });
                    }}
                    className="rounded-xl border border-rose-400/30 bg-rose-500/15 px-5 py-3 text-sm font-semibold text-rose-50 transition duration-300 hover:border-rose-300/50 hover:bg-rose-500/25"
                  >
                    Sonucu indir (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const points100 =
                        filteredQuestions.length > 0
                          ? Math.round((score / filteredQuestions.length) * CLASSIC_SCORE_MAX)
                          : 0;
                      downloadJsonFile(`klasik-quiz-${Date.now()}.json`, {
                        exportedAt: new Date().toISOString(),
                        format: "classic-quiz",
                        scoring: { maxPoints: CLASSIC_SCORE_MAX, rule: "equal_per_question" },
                        category: selectedCategory,
                        difficulty: selectedDifficulty,
                        result: {
                          correctCount: score,
                          questionCount: filteredQuestions.length,
                          points: points100,
                          maxPoints: CLASSIC_SCORE_MAX,
                        },
                        questions: filteredQuestions.map((q) => ({
                          id: q.id,
                          category: q.category,
                          difficulty: q.difficulty,
                          prompt: q.prompt,
                          choices: q.choices,
                          answerIndex: q.answerIndex,
                        })),
                      });
                    }}
                    className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-50 transition duration-300 hover:border-emerald-300/50 hover:bg-emerald-500/25"
                  >
                    Sonucu indir (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStarted(false);
                      setCurrentIndex(0);
                      setSelectedChoice(null);
                      setAnswerStatus("idle");
                    }}
                    className="rounded-xl border border-white/15 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:border-white/25 hover:bg-white/[0.12]"
                  >
                    Kategoriye dön
                  </button>
                </div>
              </section>
            )}

            {scoreHistory.length > 0 && (
              <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-md sm:p-6">
                <h3 className="text-base font-semibold tracking-tight text-white">Son skorlar</h3>
                <ul className="mt-4 space-y-2">
                  {scoreHistory.map((entry, idx) => (
                    <li
                      key={`${entry.date}-${idx}`}
                      className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-sm text-zinc-200 transition duration-300 hover:border-white/12 hover:bg-white/[0.06] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-semibold text-white">
                        {entry.score} / {entry.total}
                        <span className="ml-1.5 font-normal text-zinc-400">
                          (
                          {entry.total > 0
                            ? Math.round((entry.score / entry.total) * CLASSIC_SCORE_MAX)
                            : 0}
                          /{CLASSIC_SCORE_MAX})
                        </span>
                      </span>
                      <span className="text-xs text-zinc-500">
                        {entry.category} / {difficultyLabel[entry.difficulty]} — {entry.date}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
