"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

type PdfUploadDropzoneProps = {
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
  /** Daha sade kenarlık ve tipografi (landing) */
  minimal?: boolean;
};

export default function PdfUploadDropzone({
  onFileSelect,
  disabled = false,
  minimal = false,
}: PdfUploadDropzoneProps) {
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const pickedFile = acceptedFiles[0];
      setFileName(pickedFile ? pickedFile.name : null);
      onFileSelect(pickedFile ?? null);
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  const box = minimal
    ? `rounded-lg border border-dashed p-6 text-center transition-colors ${
        isDragActive
          ? "border-amber-400/50 bg-amber-500/10"
          : "border-zinc-600/80 bg-zinc-900/40 hover:border-amber-400/35 hover:bg-zinc-900/70"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`
    : `group relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ease-out ${
        isDragActive
          ? "scale-[1.01] border-cyan-400/50 bg-cyan-500/[0.12] shadow-[0_0_40px_-8px_rgba(34,211,238,0.35)]"
          : "border-white/[0.12] bg-white/[0.03] hover:border-indigo-400/35 hover:bg-white/[0.06] hover:shadow-[0_0_36px_-10px_rgba(99,102,241,0.25)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`;

  return (
    <div {...getRootProps()} className={box}>
      {!minimal && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-cyan-500/[0.05] opacity-0 transition duration-500 group-hover:opacity-100" />
      )}
      <input {...getInputProps()} />

      <div
        className={
          minimal
            ? "relative mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900"
            : "relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-inner transition duration-300 group-hover:border-indigo-400/30 group-hover:shadow-[0_0_20px_-4px_rgba(99,102,241,0.4)]"
        }
      >
        <svg
          className={
            minimal
              ? "h-5 w-5 text-zinc-500"
              : "h-7 w-7 text-zinc-400 transition duration-300 group-hover:text-indigo-300"
          }
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      {!minimal && (
        <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">PDF</p>
      )}
      <p
        className={
          minimal
            ? "relative text-sm text-zinc-400"
            : "relative mt-2 text-sm font-medium text-zinc-200 transition duration-300 group-hover:text-white"
        }
      >
        {isDragActive ? "Buraya bırakın…" : minimal ? "PDF sürükleyin veya seçin" : "Sürükle-bırak veya tıkla"}
      </p>
      <p className="relative mt-1 text-xs text-zinc-600">Yalnızca .pdf</p>

      <p
        className={
          minimal
            ? "relative mt-4 truncate rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-500"
            : "relative mt-5 truncate rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-xs font-medium text-zinc-400 backdrop-blur-sm transition duration-300 group-hover:border-white/10 group-hover:text-zinc-300"
        }
      >
        {fileName ? fileName : "Dosya seçilmedi"}
      </p>
    </div>
  );
}
