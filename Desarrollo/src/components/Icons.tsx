import Image from 'next/image'

/** Shared game-icon palette — for SVG accents that still need tinting. */
export const ICON = {
  wood: '#6e4a16',
  gold: '#f0b429',
  goldEdge: '#8a5a18',
  cream: '#fff1b8',
} as const

type PngIconProps = {
  className?: string
  /** Kept for API compatibility with older SVG icons. */
  tone?: 'wood' | 'inherit'
}

function UiPng({ src, className = 'h-5 w-5' }: { src: string; className?: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={40}
      height={40}
      className={`${className} shrink-0 object-contain`}
      aria-hidden
    />
  )
}

export function ClockIcon({ className = 'h-5 w-5' }: PngIconProps) {
  return <UiPng src="/art/ui/clock-v2.png" className={className} />
}

export function CoinIcon({ className = 'h-5 w-5' }: PngIconProps) {
  return <UiPng src="/art/ui/coin-v2.png" className={className} />
}

export function PodiumIcon({ className = 'h-5 w-5' }: PngIconProps) {
  return <UiPng src="/art/ui/podium-v4.png" className={className} />
}

export function UpgradeIcon({ className = 'h-5 w-5' }: PngIconProps) {
  return <UiPng src="/art/ui/upgrade-v2.png" className={className} />
}

export function WorkerIcon({ className = 'h-5 w-5' }: PngIconProps) {
  return <UiPng src="/art/ui/worker-v4.png" className={className} />
}

export function ExitIcon({ className = 'h-5 w-5' }: PngIconProps) {
  return <UiPng src="/art/ui/exit-v4.png" className={className} />
}

export function LockIcon({ className = 'h-5 w-5' }: PngIconProps) {
  return <UiPng src="/art/ui/lock-v2.png" className={className} />
}

export function CrownIcon({ className = 'h-5 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" className={className} aria-hidden>
      <path
        d="M3 17 L6 6 L12 12 L16 3 L20 12 L26 6 L29 17 Z"
        fill={ICON.gold}
        stroke={ICON.goldEdge}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="4" y="17" width="24" height="3.5" rx="1" fill={ICON.gold} stroke={ICON.goldEdge} strokeWidth="1.2" />
      <circle cx="6" cy="6" r="1.35" fill={ICON.cream} stroke={ICON.goldEdge} strokeWidth="0.8" />
      <circle cx="16" cy="3" r="1.45" fill={ICON.cream} stroke={ICON.goldEdge} strokeWidth="0.8" />
      <circle cx="26" cy="6" r="1.35" fill={ICON.cream} stroke={ICON.goldEdge} strokeWidth="0.8" />
    </svg>
  )
}

export function FirmNavIcon({ className = 'h-6 w-6', color = ICON.gold }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill={color}
        d="M4.2 17.2 5.6 9.4l3.1 3.2L12 5.8l3.3 6.8 3.1-3.2 1.4 7.8H4.2Zm.5 1.5h14.6c.4 0 .7.3.7.7v.4c0 .2-.2.4-.4.4H4.4c-.2 0-.4-.2-.4-.4v-.4c0-.4.3-.7.7-.7Z"
      />
      <circle cx="12" cy="8.2" r="1.1" fill={ICON.cream} opacity="0.9" />
    </svg>
  )
}

export function TableNavIcon({ className = 'h-6 w-6', color = ICON.gold }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M8.2 14.2h3.2V19H8.2zM4.2 16.2H7.4V19H4.2zM12.8 11.2h3.2V19h-3.2z" fill={color} />
      <path
        d="M9.8 8.2 11.5 4.8l1.7 3.4h-3.4Z"
        fill={ICON.gold}
        stroke={ICON.goldEdge}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M4 19.5h16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function ShopNavIcon({ className = 'h-6 w-6', color = ICON.gold }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="4.5" y="5.5" width="10" height="13.5" rx="1.6" stroke={color} strokeWidth="1.8" />
      <rect x="9.5" y="3.5" width="10" height="13.5" rx="1.6" stroke={color} strokeWidth="1.8" />
      <path
        d="M14.5 8.2 15.1 9.6l1.5.2-1.1 1 .3 1.5-1.3-.8-1.3.8.3-1.5-1.1-1 1.5-.2z"
        fill={ICON.gold}
        stroke={ICON.goldEdge}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}
