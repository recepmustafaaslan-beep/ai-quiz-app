"use client";

import { useEffect, useMemo, useState } from "react";

const PHASES = [
  { title: "Metin taranıyor", sub: "PDF’ten kavramlar ayrıştırılıyor" },
  { title: "Şıklar dengeleniyor", sub: "A · B · C · D için adil dağılım" },
  { title: "Soru kalitesi", sub: "Tuzak şıklar ve açıklamalar işleniyor" },
  { title: "Son rötuş", sub: "Quiz paketin hazırlanıyor" },
] as const;

type Props = {
  open: boolean;
};

export default function QuizGeneratingOverlay({ open }: Props) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  const letters = useMemo(() => ["A", "B", "C", "D"] as const, []);

  useEffect(() => {
    if (!open) {
      void Promise.resolve().then(() => setPhaseIndex(0));
      return;
    }

    const id = window.setInterval(() => {
      setPhaseIndex((i) => (i + 1) % PHASES.length);
    }, 2000);

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

  const phase = PHASES[phaseIndex];

  return (
    <div
      className="animate-fade-rise fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#030712]/88 p-4 backdrop-blur-2xl sm:p-6"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label="Quiz oluşturuluyor"
    >
      <div className="quiz-gen-mesh-bg pointer-events-none absolute inset-0 opacity-90" aria-hidden />
      <div
        className="pointer-events-none absolute -left-1/4 top-0 h-[120%] w-[70%] rounded-full bg-violet-600/20 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-0 h-[90%] w-[60%] rounded-full bg-amber-500/15 blur-[100px]"
        aria-hidden
      />

      <div className="relative w-full max-w-lg">
        <div className="absolute -inset-[2px] rounded-[1.75rem] bg-gradient-to-br from-white/25 via-fuchsia-500/20 to-cyan-400/25 opacity-60 blur-md" />

        <div className="relative overflow-hidden rounded-[1.65rem] border border-white/[0.12] bg-zinc-950/80 shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-2xl">
          <div
            className="animate-quiz-gen-scan pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-cyan-400/10 via-transparent to-transparent"
            aria-hidden
          />

          <div className="relative px-6 pb-8 pt-7 sm:px-10 sm:pb-10 sm:pt-9">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Canlı üretim
              </p>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200/90">
                ~60 sn içinde
              </span>
            </div>

            <div className="mt-6 flex justify-center gap-2 sm:gap-3">
              {letters.map((L, i) => (
                <div
                  key={L}
                  className="quiz-gen-pulse-dot flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-sm font-black text-white shadow-inner sm:h-12 sm:w-12 sm:text-base"
                  style={{ animationDelay: `${i * 0.18}s` }}
                >
                  {L}
                </div>
              ))}
            </div>

            <div className="relative mx-auto mt-8 flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40">
              <div className="animate-quiz-gen-orbit absolute inset-0 rounded-full border border-dashed border-violet-400/25" />
              <div className="absolute inset-2 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-5 rounded-full border-2 border-transparent border-t-cyan-400 border-r-fuchsia-400 opacity-90" />
              <div className="relative flex flex-col items-center gap-1">
                <span className="text-2xl font-black tabular-nums tracking-tight text-white sm:text-3xl">AI</span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">quiz</span>
              </div>
            </div>

            <div className="relative mt-8 min-h-[4.5rem] text-center">
              <h2 className="text-lg font-bold tracking-tight text-white transition duration-500 sm:text-xl">
                {phase.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400 transition duration-500 sm:text-[15px]">{phase.sub}</p>
            </div>

            <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
              <div className="animate-quiz-gen-bar h-full w-2/5 rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 shadow-[0_0_20px_rgba(167,139,250,0.45)]" />
            </div>

            <div className="mt-5 flex justify-center gap-1.5">
              {PHASES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-500 ease-out ${
                    phaseIndex === i
                      ? "w-10 bg-gradient-to-r from-violet-400 to-cyan-400 shadow-[0_0_12px_rgba(99,102,241,0.45)]"
                      : "w-1.5 bg-white/12"
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
