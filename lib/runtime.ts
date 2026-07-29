import path from "node:path";

export interface AppEnv {
  ADMIN_ROUTE?: string;
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
  APP_DATA_DIR?: string;
  DATABASE_PATH?: string;
}

export function getEnv(): AppEnv {
  return process.env as unknown as AppEnv;
}

export function requireSecret(name: keyof AppEnv): string {
  const value = getEnv()[name];
  if (typeof value !== "string" || value.length < 1) throw new Error(`缺少服务器配置：${name}`);
  return value;
}

export function dataDirectory(): string {
  const configured = getEnv().APP_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (getEnv().ENVIRONMENT === "production") throw new Error("生产环境必须配置 APP_DATA_DIR");
  return path.resolve(process.cwd(), ".data");
}

export function databasePath(): string {
  const configured = getEnv().DATABASE_PATH?.trim();
  return configured ? path.resolve(configured) : path.join(dataDirectory(), "db", "prep-trove.sqlite3");
}
