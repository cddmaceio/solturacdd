export function MarcaSoltura({ escuro = true }: { escuro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#f0cd63] to-[#d9a91f] text-[#101a2a] shadow-[inset_0_-2px_6px_rgba(0,0,0,0.18)]"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <path
            d="M4 17h11l3.2-6.4A1.6 1.6 0 0 0 16.8 8H8.6L7.4 5.6A1.6 1.6 0 0 0 5.9 4.8H3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="18.4" r="1.8" fill="currentColor" />
          <circle cx="16.6" cy="18.4" r="1.8" fill="currentColor" />
        </svg>
      </span>
      <span className="leading-none">
        <span
          className={`block text-lg font-black tracking-[0.14em] ${escuro ? 'text-[#f4d97c]' : 'text-foreground'}`}
        >
          SOLTURA
        </span>
        <span
          className={`mt-1 block text-[10px] font-semibold tracking-[0.24em] uppercase ${escuro ? 'text-[#7f97b5]' : 'text-muted-foreground'}`}
        >
          CDD Maceió
        </span>
      </span>
    </div>
  )
}
