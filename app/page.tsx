"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PdfUploadDropzone from "@/components/PdfUploadDropzone";
import QuizGeneratingOverlay from "@/components/QuizGeneratingOverlay";
import GeneratedQuizExperience, {
  type GeneratedQuestion,
} from "@/components/GeneratedQuizExperience";
import { extractPdfTextClient } from "@/lib/extractPdfTextClient";
import { requestQuizGeneration } from "@/lib/quizClientRequest";
import {
  getQuizUserMessage,
  QuizErrorCode,
  QUIZ_UPLOAD_LIMITS,
} from "@/lib/quizErrors";

type Difficulty = "easy" | "medium" | "hard";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

  const canGenerate = useMemo(() => !!selectedFile && !isLoading, [selectedFile, isLoading]);

  const handleGenerateQuiz = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);
    setQuestions([]);

    try {
      if (selectedFile.size === 0) {
        setErrorMessage(getQuizUserMessage(QuizErrorCode.PDF_READ_FAILED));
        return;
      }
      if (selectedFile.size > QUIZ_UPLOAD_LIMITS.maxFileBytes) {
        setErrorMessage(getQuizUserMessage(QuizErrorCode.PDF_TOO_LARGE));
        return;
      }

      const extracted = await extractPdfTextClient(selectedFile);
      if (!extracted.ok) {
        setErrorMessage(extracted.message);
        return;
      }

      const api = await requestQuizGeneration(extracted.text);
      if (!api.ok) {
        setErrorMessage(api.message);
        return;
      }

      const list: GeneratedQuestion[] = api.questions.map((q) => {
        const d = q.difficulty;
        const difficulty: Difficulty =
          d === "easy" || d === "medium" || d === "hard" ? d : "medium";
        return { ...q, difficulty };
      });
      setQuestions(list);
    } catch {
      setErrorMessage(getQuizUserMessage(QuizErrorCode.CLIENT_UNEXPECTED));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-zinc-100">
      <QuizGeneratingOverlay open={isLoading} />

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
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 ring-1 ring-white/20 transition duration-300 hover:scale-105 hover:shadow-indigo-500/45">
            <span className="text-sm font-bold tracking-tighter text-white">AI</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-200">Quiz Studio</span>
        </div>
        <Link
          href="/quiz"
          className="group rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-zinc-300 shadow-sm backdrop-blur-md transition duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_24px_-4px_rgba(99,102,241,0.35)]"
        >
          <span className="transition duration-300 group-hover:tracking-wide">Klasik quiz</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 pb-24 pt-4 sm:px-10 sm:pt-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="animate-fade-rise-delay-1 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400 shadow-inner shadow-white/5 backdrop-blur-xl transition duration-300 hover:border-indigo-400/25 hover:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            PDF → Akıllı quiz
          </div>

          <h1 className="animate-fade-rise-delay-1 mt-8 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl sm:leading-[1.06]">
            <span className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent">
              PDF&apos;lerinizi dönüştürün
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-200 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
              Akıllı quizlere
            </span>
          </h1>

          <p className="animate-fade-rise-delay-2 mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
            Ders notlarınızı yükleyin; yapay zeka kavramları çıkarır, akademik çoktan seçmeli quizleri saniyeler içinde
            üretir.
          </p>
        </div>

        <section className="animate-fade-rise-delay-2 relative mx-auto mt-14 w-full max-w-xl">
          <div className="absolute -inset-px rounded-[1.35rem] bg-gradient-to-b from-white/15 via-indigo-500/20 to-transparent opacity-60 blur-sm" />
          <div className="relative rounded-3xl border border-white/[0.09] bg-white/[0.05] p-6 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:p-8">
            <PdfUploadDropzone onFileSelect={setSelectedFile} disabled={isLoading} />

            <button
              type="button"
              onClick={handleGenerateQuiz}
              disabled={!canGenerate}
              className="btn-shimmer group relative mt-7 flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold tracking-tight text-white shadow-[0_12px_40px_-12px_rgba(99,102,241,0.55)] transition duration-300 ease-out hover:scale-[1.01] hover:shadow-[0_16px_48px_-8px_rgba(99,102,241,0.65)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              <span className="relative z-10 flex items-center gap-2">
                Quiz üret
                <svg
                  className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>

            {errorMessage && (
              <div
                role="alert"
                className="animate-fade-rise mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/[0.08] px-4 py-3 text-sm leading-relaxed text-rose-100 backdrop-blur-md transition duration-300"
              >
                {errorMessage}
              </div>
            )}
          </div>
        </section>

        {questions.length > 0 && (
          <div className="animate-fade-rise relative mt-16 w-full">
            <GeneratedQuizExperience questions={questions} />
          </div>
        )}
      </main>
    </div>
  );
}
