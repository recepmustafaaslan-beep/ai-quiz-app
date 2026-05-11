"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PdfUploadDropzone from "@/components/PdfUploadDropzone";
import QuizGeneratingOverlay from "@/components/QuizGeneratingOverlay";
import GeneratedQuizExperience, {
  type GeneratedQuestion,
} from "@/components/GeneratedQuizExperience";
import { parseQuizGenerateResponse, requestGenerateQuizWithPdfFile } from "@/lib/quizClientRequest";
import {
  getQuizUserMessage,
  QuizErrorCode,
  QUIZ_UPLOAD_LIMITS,
} from "@/lib/quizErrors";
import {
  QUIZ_QUESTION_COUNT_CHOICES,
  QUIZ_QUESTION_COUNT_DEFAULT,
  type QuizDifficultyPreset,
  type QuizQuestionCountChoice,
} from "@/lib/quizGenerationOptions";

/** Ders notu / çalışma masası — Unsplash (ücretsiz kullanım) */
const LANDING_BG =
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=2400&q=80";

type Difficulty = "easy" | "medium" | "hard";

const QUESTION_VIBE: Record<
  QuizQuestionCountChoice,
  { emoji: string; line: string }
> = {
  3: { emoji: "⚡", line: "Flash tur" },
  5: { emoji: "✨", line: "Ritim modu" },
  10: { emoji: "🔥", line: "Boss seviye" },
};

const DIFFICULTY_VIBE: Record<
  QuizDifficultyPreset,
  { emoji: string; line: string; short: string }
> = {
  mixed: { emoji: "🔀", line: "Hepsi bir arada", short: "Mix" },
  easy: { emoji: "🌿", line: "Chill & net", short: "Kolay" },
  medium: { emoji: "⚖️", line: "Dengeli tempo", short: "Orta" },
  hard: { emoji: "🧠", line: "Pro challenge", short: "Zor" },
};

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [questionCount, setQuestionCount] = useState<QuizQuestionCountChoice>(
    QUIZ_QUESTION_COUNT_DEFAULT,
  );
  const [difficultyPreset, setDifficultyPreset] =
    useState<QuizDifficultyPreset>("mixed");

  const canGenerate = useMemo(() => !!selectedFile && !isLoading, [selectedFile, isLoading]);

  const applyQuizApiResult = (
    api: ReturnType<typeof parseQuizGenerateResponse>,
  ) => {
    setErrorMessage(null);
    if (!api.ok) {
      setErrorMessage(api.message);
      setQuestions([]);
      return;
    }
    const fallbackExplanation =
      "Bu soruda doğru cevap, ders metnindeki ilgili kavrama en uygun seçenektir.";
    const list: GeneratedQuestion[] = api.questions.map((q) => {
      const d = q.difficulty;
      const difficulty: Difficulty =
        d === "easy" || d === "medium" || d === "hard" ? d : "medium";
      const ex =
        typeof q.explanation === "string" && q.explanation.trim().length > 0
          ? q.explanation.trim()
          : fallbackExplanation;
      return { ...q, difficulty, explanation: ex };
    });
    setQuestions(list);
  };

  const handleGenerateQuiz = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);
    setQuestions([]);

    try {
      if (selectedFile.size === 0) {
        setErrorMessage(getQuizUserMessage(QuizErrorCode.FILE_EMPTY));
        return;
      }
      if (selectedFile.size > QUIZ_UPLOAD_LIMITS.maxFileBytes) {
        setErrorMessage(getQuizUserMessage(QuizErrorCode.PDF_TOO_LARGE));
        return;
      }

      const result = await requestGenerateQuizWithPdfFile(selectedFile, {
        questionCount,
        difficultyPreset,
      });
      applyQuizApiResult(result);
    } catch {
      setErrorMessage(getQuizUserMessage(QuizErrorCode.CLIENT_UNEXPECTED));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-zinc-100 antialiased">
      <QuizGeneratingOverlay open={isLoading} />

      {/* Fotoğraf */}
      <div
        className="pointer-events-none fixed inset-0 -z-30 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${LANDING_BG})` }}
        aria-hidden
      />

      {/* Okunabilirlik: koyu sıcak scrim + renkli glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-20 bg-gradient-to-b from-zinc-950/88 via-indigo-950/75 to-amber-950/55"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(251,191,36,0.12),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(ellipse_60%_50%_at_100%_30%,rgba(167,139,250,0.18),transparent_45%)]"
        aria-hidden
      />
      <div className="landing-lined pointer-events-none fixed inset-0 -z-20 opacity-90" aria-hidden />
      <div className="landing-noise pointer-events-none fixed inset-0 -z-10 opacity-70 mix-blend-overlay" aria-hidden />

      {/* Dekor: yapışkan not hissi */}
      <div
        className="landing-float pointer-events-none absolute -left-4 top-28 hidden h-24 w-28 rounded-sm bg-amber-300/25 shadow-lg shadow-amber-900/20 ring-1 ring-amber-200/30 backdrop-blur-[2px] sm:block md:left-[8%] md:top-36"
        aria-hidden
      />
      <div
        className="landing-float-delayed pointer-events-none absolute -right-6 top-48 hidden h-20 w-24 rounded-sm bg-emerald-400/20 shadow-lg shadow-emerald-900/25 ring-1 ring-emerald-200/25 backdrop-blur-[2px] sm:block md:right-[6%] md:top-52"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[18%] left-[4%] hidden h-16 w-20 rotate-[-11deg] rounded-sm bg-rose-400/15 shadow-md ring-1 ring-rose-200/20 backdrop-blur-sm md:block"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between border-b border-white/10 bg-zinc-950/30 px-6 py-5 backdrop-blur-md sm:px-10">
        <span className="bg-gradient-to-r from-amber-100 to-amber-50 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
          Quiz
        </span>
        <Link
          href="/quiz"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-amber-300/40 hover:bg-amber-500/10 hover:text-white"
        >
          Klasik mod
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-28 pt-12 sm:px-10 sm:pt-16">
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-x-8 -top-6 h-32 bg-gradient-to-b from-amber-400/10 to-transparent blur-2xl sm:-inset-x-16" aria-hidden />

          <h1 className="animate-fade-rise relative text-center text-xl font-semibold leading-snug tracking-tight sm:text-[1.65rem] sm:leading-tight">
            <span className="text-zinc-200/90">PDF yükle</span>
            <span className="mx-2 inline-block text-amber-300/90 sm:mx-2.5" aria-hidden>
              →
            </span>
            <span className="bg-gradient-to-r from-amber-200 via-yellow-200 to-lime-200 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(251,191,36,0.35)]">
              AI quiz oluşturur
            </span>
          </h1>
          <p className="sr-only">PDF yükle → AI quiz oluşturur</p>

          <div className="animate-fade-rise-delay-1 relative mt-14 overflow-hidden rounded-2xl border border-amber-400/25 bg-zinc-950/65 p-5 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/10 backdrop-blur-xl sm:p-6">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-amber-500/15 blur-3xl"
              aria-hidden
            />

            <PdfUploadDropzone
              onFileSelect={setSelectedFile}
              disabled={isLoading}
              minimal
              questionCount={questionCount}
              difficultyPreset={difficultyPreset}
              onGenerateQuizLoading={(loading) => {
                setIsLoading(loading);
                if (loading) {
                  setErrorMessage(null);
                  setQuestions([]);
                }
              }}
              onGenerateQuizResult={applyQuizApiResult}
            />

            <button
              type="button"
              onClick={handleGenerateQuiz}
              disabled={!canGenerate}
              className="relative mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_12px_40px_-8px_rgba(251,191,36,0.45)] transition hover:brightness-105 hover:shadow-[0_16px_48px_-6px_rgba(251,191,36,0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 disabled:hover:shadow-none"
            >
              Quiz oluştur
            </button>

            {errorMessage && (
              <div
                role="alert"
                className="relative mt-4 rounded-xl border border-red-500/35 bg-red-950/50 px-3 py-2.5 text-sm text-red-100 backdrop-blur-sm"
              >
                {errorMessage}
              </div>
            )}

            <div className="relative mt-7 border-t border-white/[0.08] pt-6">
              <div className="mb-5 flex items-center justify-center gap-3">
                <span className="h-px flex-1 max-w-[4rem] bg-gradient-to-r from-transparent to-amber-400/50" />
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/80">
                  Quiz vibe
                </span>
                <span className="h-px flex-1 max-w-[4rem] bg-gradient-to-l from-transparent to-violet-400/50" />
              </div>

              <p className="mb-2.5 text-center text-[11px] font-semibold text-zinc-500">Kaç soru?</p>
              <div className="flex justify-center gap-2 sm:gap-3">
                {QUIZ_QUESTION_COUNT_CHOICES.map((n) => {
                  const on = questionCount === n;
                  const v = QUESTION_VIBE[n];
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={isLoading}
                      aria-pressed={on}
                      onClick={() => setQuestionCount(n)}
                      className={`relative flex min-w-[5.25rem] flex-1 flex-col items-center rounded-2xl border px-2 py-3 transition sm:min-w-[6.5rem] sm:px-3 ${
                        on
                          ? "border-amber-400/60 bg-gradient-to-b from-amber-400/25 to-orange-500/10 shadow-[0_0_28px_-6px_rgba(251,191,36,0.45)] ring-1 ring-amber-300/30"
                          : "border-zinc-700/60 bg-zinc-900/40 hover:border-zinc-500/50 hover:bg-zinc-900/70"
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <span className="text-lg leading-none sm:text-xl" aria-hidden>
                        {v.emoji}
                      </span>
                      <span className="mt-1.5 text-lg font-black tabular-nums text-white sm:text-xl">{n}</span>
                      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:text-[10px]">
                        {v.line}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mb-2.5 mt-7 text-center text-[11px] font-semibold text-zinc-500">Zorluk vibe</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
                {(Object.keys(DIFFICULTY_VIBE) as QuizDifficultyPreset[]).map((key) => {
                  const on = difficultyPreset === key;
                  const d = DIFFICULTY_VIBE[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isLoading}
                      aria-pressed={on}
                      onClick={() => setDifficultyPreset(key)}
                      className={`rounded-2xl border px-2 py-3 text-center transition sm:py-3.5 ${
                        on
                          ? "border-violet-400/55 bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-transparent shadow-[0_0_24px_-8px_rgba(167,139,250,0.5)] ring-1 ring-violet-300/25"
                          : "border-zinc-700/60 bg-zinc-900/35 hover:border-zinc-500/45 hover:bg-zinc-900/60"
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <span className="text-base sm:text-lg" aria-hidden>
                        {d.emoji}
                      </span>
                      <p className="mt-1 text-xs font-bold text-zinc-100 sm:text-sm">{d.short}</p>
                      <p className="mt-0.5 text-[9px] leading-tight text-zinc-500 sm:text-[10px]">{d.line}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="animate-fade-rise-delay-2 relative mx-auto mt-20 w-full max-w-2xl border-t border-white/10 pt-16">
            <GeneratedQuizExperience questions={questions} />
          </div>
        )}
      </main>
    </div>
  );
}
