"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import GeneratedQuizExperience from "@/components/GeneratedQuizExperience";
import type { GeneratedQuestion } from "@/components/GeneratedQuizExperience";
import { decodeSharePayload, type ShareQuizPayloadV1 } from "@/lib/shareQuizPayload";

function PaylasContent() {
  const searchParams = useSearchParams();
  const d = searchParams.get("d");

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShareQuizPayloadV1 | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!d) {
        if (!cancelled) {
          setError("Paylaşım linkinde veri yok (?d=…).");
          setStatus("error");
        }
        return;
      }

      const decoded = await decodeSharePayload(d);
      if (cancelled) return;

      if (!decoded.ok) {
        setError(decoded.error);
        setStatus("error");
        return;
      }

      setData(decoded.payload);
      setStatus("ready");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [d]);

  const questions: GeneratedQuestion[] | null =
    data?.questions.map((q) => ({
      ...q,
      explanation: q.explanation || "Bu soruda doğru cevap, ders metnindeki ilgili kavrama en uygun seçenektir.",
    })) ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-zinc-800/80 px-6 py-4 sm:px-10">
        <Link href="/" className="text-sm font-medium text-zinc-400 transition hover:text-white">
          ← Ana sayfa
        </Link>
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Paylaşılan quiz</span>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10 sm:py-14">
        {status === "loading" && (
          <p className="text-center text-sm text-zinc-500">Quiz yükleniyor…</p>
        )}

        {status === "error" && (
          <div className="mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-4 text-center text-sm text-red-100">
            {error ?? "Bir sorun oluştu."}
            <div className="mt-4">
              <Link href="/" className="text-amber-200 underline hover:text-amber-100">
                Ana sayfaya dön
              </Link>
            </div>
          </div>
        )}

        {status === "ready" && data && questions && (
          <>
            {data.result && (
              <div className="mx-auto mb-10 max-w-2xl rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] px-5 py-4 text-center backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                  Bu link şu sonuçla paylaşıldı
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {data.result.score} / {data.result.total} doğru
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  Puan: {data.result.points} / {data.result.maxPoints}
                </p>
                <p className="mt-3 text-xs text-zinc-500">Aynı soruları sen de çözebilirsin.</p>
              </div>
            )}
            <GeneratedQuizExperience questions={questions} />
          </>
        )}
      </main>
    </div>
  );
}

function PaylasFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-500">
      Yükleniyor…
    </div>
  );
}

export default function PaylasPage() {
  return (
    <Suspense fallback={<PaylasFallback />}>
      <PaylasContent />
    </Suspense>
  );
}
