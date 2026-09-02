import { mintHue } from "@/lib/avatar";

type TokenAvatarProps = {
  mint: string;
  symbol?: string;
};

export function TokenAvatar({ mint, symbol }: TokenAvatarProps) {
  const hue = mintHue(mint);
  const letter = (symbol?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-1 ring-white/10"
      style={{
        background: `linear-gradient(135deg, oklch(0.62 0.14 ${hue}), oklch(0.42 0.15 ${(hue + 45) % 360}))`,
      }}
    >
      {letter}
    </div>
  );
}
