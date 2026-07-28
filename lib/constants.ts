export const MATERIAL_TYPES = ["WFD", "DI", "SST", "RS", "WE"] as const;
export const PRODUCT_ENTRIES = [...MATERIAL_TYPES, "BUNDLE"] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];
export type ProductEntry = (typeof PRODUCT_ENTRIES)[number];

export const ENTRY_META: Record<ProductEntry, { label: string; color: string; description: string }> = {
  WFD: { label: "WFD", color: "#0066FF", description: "听写高频词句，一份专注冲刺的提分资料" },
  DI: { label: "DI", color: "#FF6D01", description: "图表描述框架与练习，开口更有底气" },
  SST: { label: "SST", color: "#FFA500", description: "听力总结重点整理，把得分点稳稳抓住" },
  RS: { label: "RS", color: "#FF87B8", description: "跟读复述专项训练，节奏和准确度一起提升" },
  WE: { label: "WE", color: "#8A3FFC", description: "写作结构与练习素材，快速组织高质量答案" },
  BUNDLE: { label: "五项合集", color: "#0E7C82", description: "WFD、DI、SST、RS、WE 五大题型一次集齐" },
};

export const BRAND_COLOR = "#EF4F5C";
export const GENERATION_WINDOW_MS = 240 * 60 * 60 * 1000;
export const LINK_WINDOW_MS = 720 * 60 * 60 * 1000;
export const FILE_RETENTION_MS = 720 * 60 * 60 * 1000;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_HOURLY_LIMIT = 5;
export const OTP_DAILY_LIMIT = 10;
export const OTP_IP_DAILY_LIMIT = 20;
export const OTP_MAX_ATTEMPTS = 5;
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

export const PHONE_PATTERN = /^1[3-9]\d{9}$/;
export const ORDER_PATTERN = /^P\d{18}$/;

export const DOWNLOAD_NAMES: Record<ProductEntry, string> = {
  WFD: "PTE突击宝藏资料-WFD.pdf",
  DI: "PTE突击宝藏资料-DI.pdf",
  SST: "PTE突击宝藏资料-SST.pdf",
  RS: "PTE突击宝藏资料-RS.pdf",
  WE: "PTE突击宝藏资料-WE.pdf",
  BUNDLE: "PTE突击宝藏资料-五项合集.zip",
};
