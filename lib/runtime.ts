import { env } from "cloudflare:workers";

export interface AppEnv {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_PASSWORD?: string;
  APP_SECRET?: string;
  ALIBABA_CLOUD_SMS_ACCESS_KEY_ID?: string;
  ALIBABA_CLOUD_SMS_ACCESS_KEY_SECRET?: string;
  SMS_SIGN_NAME?: string;
  SMS_TEMPLATE_CODE?: string;
  SMS_TEMPLATE_VARIABLE?: string;
  SMS_REGION_ID?: string;
  SMS_MODE?: string;
  ENVIRONMENT?: string;
}

export function getEnv(): AppEnv {
  return env as unknown as AppEnv;
}

export function requireSecret(name: keyof AppEnv): string {
  const value = getEnv()[name];
  if (typeof value !== "string" || value.length < 1) throw new Error(`缺少服务器配置：${name}`);
  return value;
}
