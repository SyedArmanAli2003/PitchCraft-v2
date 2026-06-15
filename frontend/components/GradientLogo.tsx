import React from "react"

type LogoMarkProps = {
    size?: number
    className?: string
}

/**
 * PitchCraft gradient mark (used instead of emoji UI icons).
 * Designed as a tiny inline SVG so it stays crisp and consistent.
 */
export function LogoMark({ size = 18, className }: LogoMarkProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="pc-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="hsl(258,85%,64%)" />
                    <stop offset="1" stopColor="hsl(142,71%,45%)" />
                </linearGradient>
                <filter id="pc-softGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.2" result="blur" />
                    <feColorMatrix
                        type="matrix"
                        values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 0.6 0"
                    />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Outer ring */}
            <path
                d="M12 2.5c5.25 0 9.5 4.25 9.5 9.5s-4.25 9.5-9.5 9.5S2.5 17.25 2.5 12 6.75 2.5 12 2.5Z"
                stroke="url(#pc-grad)"
                strokeWidth="1.6"
                opacity="0.85"
            />
            {/* Core mark */}
            <g filter="url(#pc-softGlow)">
                <path
                    d="M9 7.8 17.2 12 9 16.2V7.8Z"
                    fill="url(#pc-grad)"
                    opacity="0.95"
                />
            </g>

            {/* Tiny dot */}
            <circle cx="16.9" cy="7.3" r="1.1" fill="hsl(142,71%,45%)" opacity="0.95" />
        </svg>
    )
}

type StatusDotProps = {
    variant?: "ok" | "warn" | "locked" | "info"
    size?: number
    className?: string
}

/**
 * Minimal status indicator (replaces ✓ ⚠ 🔒 emoji chips).
 */
export function StatusDot({ variant = "info", size = 10, className }: StatusDotProps) {
    const map: Record<string, { bg: string; ring: string }> = {
        ok: { bg: "rgba(34,197,94,0.18)", ring: "rgba(34,197,94,0.45)" },
        warn: { bg: "rgba(234,179,8,0.18)", ring: "rgba(234,179,8,0.45)" },
        locked: { bg: "rgba(168,85,247,0.18)", ring: "rgba(168,85,247,0.45)" },
        info: { bg: "rgba(124,58,237,0.18)", ring: "rgba(124,58,237,0.45)" },
    }
    const { bg, ring } = map[variant] ?? map.info
    return (
        <span
            className={className}
            style={{
                width: size,
                height: size,
                borderRadius: 999,
                background: bg,
                border: `1px solid ${ring}`,
                display: "inline-block",
                boxShadow: "0 0 18px rgba(124,58,237,0.12)",
            }}
            aria-hidden="true"
        />
    )
}
