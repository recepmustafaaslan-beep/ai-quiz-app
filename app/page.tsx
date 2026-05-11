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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <QuizGeneratingOverlay open={isLoading} />

      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.06),transparent)]" />

      <header className="mx-auto flex max-w-3xl items-center justify-between border-b border-zinc-800/80 px-6 py-5 sm:px-8">
        <span className="text-sm font-medium tracking-tight text-zinc-300">Quiz</span>
        <Link
          href="/quiz"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Klasik mod
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-24 pt-16 sm:px-8 sm:pt-24">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="text-center text-[1.375rem] font-medium leading-snug tracking-tight text-zinc-100 sm:text-2xl">
            <span className="text-zinc-400">PDF yükle</span>
            <span className="mx-2 text-zinc-600 sm:mx-2.5" aria-hidden>
              →
            </span>
            <span className="text-zinc-100">AI quiz oluşturur</span>
          </h1>
          <p className="sr-only">PDF yükle → AI quiz oluşturur</p>

          <div className="mt-14 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
            <PdfUploadDropzone onFileSelect={setSelectedFile} disabled={isLoading} minimal />

            <button
              type="button"
              onClick={handleGenerateQuiz}
              disabled={!canGenerate}
              className="mt-5 w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-100"
            >
              Quiz oluştur
            </button>

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-sm text-red-200/90"
              >
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        {questions.length > 0 && (
          <div className="mx-auto mt-20 w-full max-w-2xl border-t border-zinc-800/80 pt-16">
            <GeneratedQuizExperience questions={questions} />
          </div>
        )}
      </main>
    </div>
  );
}
