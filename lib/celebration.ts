export type CelebrationRibbonShape = "strip" | "curl" | "flutter";
export type CelebrationRibbonVisualShape = "straight" | "curve";

export function getCelebrationRibbonVisualShape(
  shape: CelebrationRibbonShape,
): CelebrationRibbonVisualShape {
  return shape === "curl" ? "curve" : "straight";
}

export const CELEBRATION_COLORS = [
  "#ff315f",
  "#ff5b45",
  "#ff8a18",
  "#ffd21f",
  "#b8e522",
  "#35d06f",
  "#17cdb6",
  "#1eb7ef",
  "#3978ff",
  "#7554e8",
  "#bd49e5",
  "#ff63ae",
] as const;

export type CelebrationColor = (typeof CELEBRATION_COLORS)[number];

export const CELEBRATION_ORIGIN_X = 50;
export const CELEBRATION_DURATION_SCALE = 0.72;
export const CELEBRATION_WEAK_RIBBON_COUNT = 6;
export const CELEBRATION_FADE_DRIFT_X_VW = 4;
export const CELEBRATION_FADE_DRIFT_Y_VH = 6;

export type CelebrationPhase = "generating" | "ready" | "none";

export interface CelebrationPhaseInput {
  jobStatus: string | null;
  progress: number;
  ready: boolean;
  submitting: boolean;
}

export function getCelebrationPhase({
  jobStatus,
  progress,
  ready,
  submitting,
}: CelebrationPhaseInput): CelebrationPhase {
  if (ready) return "ready";
  const isGenerating = jobStatus === "PROCESSING" || submitting;
  if (isGenerating && (progress >= 35 || jobStatus === "PROCESSING")) return "generating";
  return "none";
}

export interface CelebrationRibbon {
  shape: CelebrationRibbonShape;
  color: CelebrationColor;
  originX: number;
  originY: number;
  peakX: number;
  peakY: number;
  driftX: number;
  driftY: number;
  width: number;
  length: number;
  delay: number;
  duration: number;
  rotation: number;
  strength?: "weak";
}

const CELEBRATION_RIBBON_PATHS: readonly CelebrationRibbon[] = [
  { shape: "curl", color: CELEBRATION_COLORS[0], originX: 5, originY: 102, peakX: 7, peakY: -92, driftX: 14, driftY: -60, width: 7, length: 34, delay: 0, duration: 5.8, rotation: 620 },
  { shape: "strip", color: CELEBRATION_COLORS[3], originX: 5, originY: 102, peakX: 24, peakY: -78, driftX: 31, driftY: -48, width: 6, length: 29, delay: 0.12, duration: 5.2, rotation: 540 },
  { shape: "flutter", color: CELEBRATION_COLORS[7], originX: 5, originY: 102, peakX: 37, peakY: -66, driftX: 43, driftY: -38, width: 8, length: 24, delay: 0.34, duration: 5.5, rotation: 680 },
  { shape: "strip", color: CELEBRATION_COLORS[5], originX: 17, originY: 102, peakX: -12, peakY: -88, driftX: -18, driftY: -56, width: 5, length: 33, delay: 0.06, duration: 5.7, rotation: -590 },
  { shape: "curl", color: CELEBRATION_COLORS[10], originX: 17, originY: 102, peakX: 6, peakY: -104, driftX: 12, driftY: -72, width: 7, length: 36, delay: 0.24, duration: 6.2, rotation: 720 },
  { shape: "flutter", color: CELEBRATION_COLORS[2], originX: 17, originY: 102, peakX: 22, peakY: -76, driftX: 29, driftY: -44, width: 8, length: 23, delay: 0.46, duration: 5.4, rotation: 610 },
  { shape: "strip", color: CELEBRATION_COLORS[8], originX: 31, originY: 102, peakX: -25, peakY: -82, driftX: -32, driftY: -50, width: 6, length: 31, delay: 0.02, duration: 5.9, rotation: -640 },
  { shape: "flutter", color: CELEBRATION_COLORS[11], originX: 31, originY: 102, peakX: -9, peakY: -68, driftX: -15, driftY: -36, width: 8, length: 25, delay: 0.3, duration: 5.3, rotation: -520 },
  { shape: "curl", color: CELEBRATION_COLORS[4], originX: 31, originY: 102, peakX: 8, peakY: -106, driftX: 14, driftY: -74, width: 7, length: 35, delay: 0.48, duration: 6.3, rotation: 760 },
  { shape: "strip", color: CELEBRATION_COLORS[1], originX: 31, originY: 102, peakX: 28, peakY: -72, driftX: 35, driftY: -42, width: 5, length: 28, delay: 0.66, duration: 5.5, rotation: 580 },
  { shape: "curl", color: CELEBRATION_COLORS[6], originX: 50, originY: 102, peakX: -38, peakY: -94, driftX: -45, driftY: -62, width: 7, length: 36, delay: 0.08, duration: 6.1, rotation: -730 },
  { shape: "flutter", color: CELEBRATION_COLORS[9], originX: 50, originY: 102, peakX: -24, peakY: -72, driftX: -31, driftY: -40, width: 8, length: 24, delay: 0.2, duration: 5.4, rotation: -600 },
  { shape: "strip", color: CELEBRATION_COLORS[0], originX: 50, originY: 102, peakX: -10, peakY: -108, driftX: -15, driftY: -76, width: 5, length: 34, delay: 0.4, duration: 6.4, rotation: -780 },
  { shape: "curl", color: CELEBRATION_COLORS[3], originX: 50, originY: 102, peakX: 12, peakY: -102, driftX: 18, driftY: -70, width: 7, length: 37, delay: 0.14, duration: 6.2, rotation: 740 },
  { shape: "flutter", color: CELEBRATION_COLORS[7], originX: 50, originY: 102, peakX: 27, peakY: -76, driftX: 34, driftY: -44, width: 8, length: 25, delay: 0.54, duration: 5.6, rotation: 630 },
  { shape: "strip", color: CELEBRATION_COLORS[5], originX: 50, originY: 102, peakX: 41, peakY: -90, driftX: 48, driftY: -58, width: 6, length: 32, delay: 0.72, duration: 6, rotation: 690 },
  { shape: "flutter", color: CELEBRATION_COLORS[2], originX: 69, originY: 102, peakX: -30, peakY: -70, driftX: -37, driftY: -38, width: 8, length: 23, delay: 0.04, duration: 5.3, rotation: -560 },
  { shape: "curl", color: CELEBRATION_COLORS[8], originX: 69, originY: 102, peakX: -12, peakY: -105, driftX: -18, driftY: -73, width: 7, length: 36, delay: 0.22, duration: 6.3, rotation: -750 },
  { shape: "strip", color: CELEBRATION_COLORS[11], originX: 69, originY: 102, peakX: 10, peakY: -86, driftX: 17, driftY: -54, width: 6, length: 30, delay: 0.42, duration: 5.8, rotation: 650 },
  { shape: "flutter", color: CELEBRATION_COLORS[4], originX: 69, originY: 102, peakX: 27, peakY: -66, driftX: 34, driftY: -34, width: 8, length: 24, delay: 0.7, duration: 5.2, rotation: 530 },
  { shape: "strip", color: CELEBRATION_COLORS[1], originX: 83, originY: 102, peakX: -28, peakY: -74, driftX: -35, driftY: -42, width: 5, length: 29, delay: 0.1, duration: 5.5, rotation: -580 },
  { shape: "curl", color: CELEBRATION_COLORS[6], originX: 83, originY: 102, peakX: -8, peakY: -100, driftX: -14, driftY: -68, width: 7, length: 35, delay: 0.34, duration: 6.1, rotation: -710 },
  { shape: "flutter", color: CELEBRATION_COLORS[10], originX: 83, originY: 102, peakX: 13, peakY: -84, driftX: 20, driftY: -52, width: 8, length: 25, delay: 0.56, duration: 5.7, rotation: 620 },
  { shape: "strip", color: CELEBRATION_COLORS[0], originX: 95, originY: 102, peakX: -38, peakY: -68, driftX: -45, driftY: -36, width: 6, length: 28, delay: 0.04, duration: 5.3, rotation: -550 },
  { shape: "curl", color: CELEBRATION_COLORS[3], originX: 95, originY: 102, peakX: -22, peakY: -96, driftX: -29, driftY: -64, width: 7, length: 37, delay: 0.18, duration: 6, rotation: -700 },
  { shape: "flutter", color: CELEBRATION_COLORS[7], originX: 95, originY: 102, peakX: -7, peakY: -80, driftX: -13, driftY: -48, width: 8, length: 24, delay: 0.5, duration: 5.6, rotation: -610 },
  { shape: "strip", color: CELEBRATION_COLORS[9], originX: 10, originY: 102, peakX: 48, peakY: -98, driftX: 55, driftY: -66, width: 5, length: 32, delay: 0.76, duration: 6.2, rotation: 760 },
  { shape: "curl", color: CELEBRATION_COLORS[2], originX: 90, originY: 102, peakX: -48, peakY: -102, driftX: -55, driftY: -70, width: 7, length: 36, delay: 0.82, duration: 6.3, rotation: -770 },
  { shape: "flutter", color: CELEBRATION_COLORS[5], originX: 39, originY: 102, peakX: -3, peakY: -88, driftX: -9, driftY: -56, width: 8, length: 25, delay: 0.88, duration: 5.9, rotation: -670 },
  { shape: "strip", color: CELEBRATION_COLORS[11], originX: 61, originY: 102, peakX: 4, peakY: -92, driftX: 10, driftY: -60, width: 6, length: 31, delay: 0.94, duration: 6, rotation: 680 },
  { shape: "strip", color: CELEBRATION_COLORS[0], originX: 50, originY: 102, peakX: -43, peakY: -82, driftX: -49, driftY: -50, width: 6, length: 30, delay: 0.16, duration: 5.4, rotation: -620 },
  { shape: "curl", color: CELEBRATION_COLORS[4], originX: 50, originY: 102, peakX: -19, peakY: -98, driftX: -25, driftY: -66, width: 7, length: 34, delay: 0.38, duration: 5.9, rotation: -690 },
  { shape: "flutter", color: CELEBRATION_COLORS[8], originX: 50, originY: 102, peakX: -6, peakY: -72, driftX: -11, driftY: -40, width: 8, length: 24, delay: 0.6, duration: 5.2, rotation: -560 },
  { shape: "strip", color: CELEBRATION_COLORS[2], originX: 50, originY: 102, peakX: 16, peakY: -106, driftX: 22, driftY: -74, width: 6, length: 33, delay: 0.28, duration: 6.1, rotation: 730 },
  { shape: "curl", color: CELEBRATION_COLORS[6], originX: 50, originY: 102, peakX: 31, peakY: -88, driftX: 37, driftY: -56, width: 7, length: 35, delay: 0.52, duration: 5.7, rotation: 660 },
  { shape: "flutter", color: CELEBRATION_COLORS[10], originX: 50, originY: 102, peakX: 46, peakY: -76, driftX: 52, driftY: -44, width: 8, length: 25, delay: 0.74, duration: 5.3, rotation: 590 },
  { shape: "strip", color: CELEBRATION_COLORS[1], originX: 50, originY: 102, peakX: -30, peakY: -55, driftX: -35, driftY: -49, width: 6, length: 29, delay: 0.08, duration: 5.5, rotation: -430, strength: "weak" },
  { shape: "curl", color: CELEBRATION_COLORS[5], originX: 50, originY: 102, peakX: -18, peakY: -48, driftX: -22, driftY: -42, width: 7, length: 33, delay: 0.18, duration: 5.8, rotation: -390, strength: "weak" },
  { shape: "flutter", color: CELEBRATION_COLORS[9], originX: 50, originY: 102, peakX: -8, peakY: -42, driftX: -11, driftY: -36, width: 8, length: 24, delay: 0.28, duration: 5.2, rotation: -350, strength: "weak" },
  { shape: "strip", color: CELEBRATION_COLORS[3], originX: 50, originY: 102, peakX: 10, peakY: -36, driftX: 14, driftY: -30, width: 6, length: 30, delay: 0.38, duration: 5.4, rotation: 360, strength: "weak" },
  { shape: "curl", color: CELEBRATION_COLORS[7], originX: 50, originY: 102, peakX: 20, peakY: -50, driftX: 24, driftY: -44, width: 7, length: 34, delay: 0.48, duration: 5.7, rotation: 410, strength: "weak" },
  { shape: "flutter", color: CELEBRATION_COLORS[11], originX: 50, originY: 102, peakX: 32, peakY: -40, driftX: 37, driftY: -34, width: 8, length: 25, delay: 0.58, duration: 5.3, rotation: 450, strength: "weak" },
] as const;

export const CELEBRATION_RIBBONS: readonly CelebrationRibbon[] = CELEBRATION_RIBBON_PATHS.map(
  (ribbon) => ({
    ...ribbon,
    originX: CELEBRATION_ORIGIN_X,
    duration: Number((ribbon.duration * CELEBRATION_DURATION_SCALE).toFixed(2)),
  }),
);
