// Logo de InventX escritorio (xing.ico) en SVG.
export default function Logo({ className = "h-10 w-10", claro = false }: { className?: string; claro?: boolean }) {
  return (
    <svg viewBox="0 0 125 125" className={className} aria-hidden="true">
      <path
        d="M36 20 L58 56 L24 104"
        fill="none"
        stroke={claro ? "#ffffff" : "#0b74d6"}
        strokeWidth="21"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M102 20 L78 62 L102 104"
        fill="none"
        stroke={claro ? "rgba(255,255,255,.55)" : "#a8d0f5"}
        strokeWidth="21"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
