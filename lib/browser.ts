const IOS_DEVICE_PATTERN = /\b(iPhone|iPad|iPod)\b/i;
const IOS_STANDALONE_BROWSER_PATTERN = /\b(Safari|CriOS|FxiOS|EdgiOS|OPiOS)\b/i;

export function isEmbeddedWebView(userAgent: string): boolean {
  const normalized = userAgent.trim();
  if (!normalized) return false;

  const isAndroidWebView = /\bwv\b/i.test(normalized)
    || (/\bAndroid\b/i.test(normalized) && /\bVersion\/\d/i.test(normalized));
  const isIosWebView = IOS_DEVICE_PATTERN.test(normalized)
    && /\bAppleWebKit\b/i.test(normalized)
    && !IOS_STANDALONE_BROWSER_PATTERN.test(normalized);

  return isAndroidWebView || isIosWebView;
}
