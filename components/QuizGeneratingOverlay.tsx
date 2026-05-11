"use client";

import { useEffect, useState } from "react";

const LOADING_MESSAGES = [
  "PDF analiz ediliyor…",
  "Akıllı sorular üretiliyor…",
  "Quiz oluşturuluyor…",
] as const;

type Props = {
  open: boolean;
};

export default function QuizGeneratingOverlay({ open }: Props) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      void Promise.resolve().then(() => setMessageIndex(0));
      return;
    }

    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);

    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="animate-fade-rise fixed inset-0 z-50 flex items-center justify-center bg-[#030712]/80 p-6 backdrop-blur-xl"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label="Quiz oluşturuluyor"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[min(90vw,520px)] w-[min(90vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/25 blur-[100px]" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-px rounded-[1.4rem] bg-gradient-to-b from-white/20 via-indigo-500/30 to-transparent opacity-50 blur" />
        <div className="relative rounded-3xl border border-white/[0.1] bg-zinc-950/75 p-10 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-28 w-28">
              <div className="absolute inset-0 rounded-full border border-white/[0.08]" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-400 border-r-cyan-400" />
              <div className="absolute inset-[10px] rounded-full border border-white/5" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan-300 to-indigo-400 shadow-[0_0_16px_rgba(99,102,241,0.8)]" />
              </div>
            </div>

            <h2 className="mt-9 text-lg font-semibold tracking-tight text-white sm:text-xl">
              Quiziniz hazırlanıyor
            </h2>

            <div className="relative mt-5 min-h-[3.75rem] w-full">
              {LOADING_MESSAGES.map((msg, i) => (
                <p
                  key={msg}
                  className={`absolute inset-x-0 top-0 text-sm font-medium transition-all duration-500 ease-out sm:text-[15px] ${
                    messageIndex === i
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-2 opacity-0"
                  }`}
                >
                  <span className="bg-gradient-to-r from-zinc-200 via-white to-indigo-200 bg-clip-text text-transparent">
                    {msg}
                  </span>
                </p>
              ))}
            </div>

            <div className="mt-11 flex gap-1.5">
              {LOADING_MESSAGES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-500 ease-out ${
                    messageIndex === i
                      ? "w-9 bg-gradient-to-r from-indigo-400 to-cyan-400 shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                      : "w-1.5 bg-white/15 hover:bg-white/25"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
