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

/** Ders notu / çalışma masası — Unsplash (ücretsiz kullanım) */
const LANDING_BG =
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=2400&q=80";

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

            <PdfUploadDropzone onFileSelect={setSelectedFile} disabled={isLoading} minimal />

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
