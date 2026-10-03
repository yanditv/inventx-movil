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
      className="flex h-9 w-9 items-center justify-center rounded-full text-marca active:bg-black/5"
      aria-label="Actualizar"
    >
      <ArrowClockwise size={22} className={pendiente ? "animate-spin" : ""} />
    </button>
  );
}
