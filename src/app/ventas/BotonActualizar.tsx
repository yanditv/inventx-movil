"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise } from "@phosphor-icons/react";

export default function BotonActualizar() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      onClick={() => iniciar(() => router.refresh())}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white"
      aria-label="Actualizar"
    >
      <ArrowClockwise size={20} weight="bold" className={pendiente ? "animate-spin" : ""} />
    </button>
  );
}
