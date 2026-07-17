import type { ScoreBand } from "@/lib/adminPipeline";

const BAND_COLORS: Record<ScoreBand, string> = {
  high: "#2e9e6e",
  mid: "#f0a93e",
  low: "#c2604a",
  unscored: "#c7d4d5",
};

export function ScoreGauge({
  score,
  band,
  size = 38,
}: {
  score: number | null;
  band: ScoreBand;
  size?: number;
}) {
  const strokeWidth = 3.5;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const fraction = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const dash = circumference * fraction;
  const color = BAND_COLORS[band];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5edee" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-bold" style={{ color }}>
        {score == null ? "—" : Math.round(score)}
      </span>
    </div>
  );
}
