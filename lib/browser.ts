const IOS_DEVICE_PATTERN = /\b(iPhone|iPad|iPod)\b/i;
const IOS_STANDALONE_BROWSER_PATTERN = /\b(Safari|CriOS|FxiOS|EdgiOS|OPiOS)\b/i;

export type EmbeddedWebViewPlatform = "android" | "ios" | null;

export function getEmbeddedWebViewPlatform(userAgent: string): EmbeddedWebViewPlatform {
  const normalized = userAgent.trim();
  if (!normalized) return null;

  const isAndroidWebView = /\bwv\b/i.test(normalized)
    || (/\bAndroid\b/i.test(normalized) && /\bVersion\/\d/i.test(normalized));
  if (isAndroidWebView) return "android";

  const isIosWebView = IOS_DEVICE_PATTERN.test(normalized)
    && /\bAppleWebKit\b/i.test(normalized)
    && !IOS_STANDALONE_BROWSER_PATTERN.test(normalized);

  return isIosWebView ? "ios" : null;
}
