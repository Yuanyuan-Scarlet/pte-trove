"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileArchive,
  Gift,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Phase = "GENERATION_OPEN" | "DOWNLOAD_ONLY" | "EXPIRED";

interface PortalStatus {
  entry: string;
  entryMeta: { label: string; color: string; description: string };
  versionName: string;
  phase: Phase;
  generationDeadline: number;
  expiresAt: number;
  authenticated: boolean;
  phone: string | null;
  jobStatus: string | null;
  ready: boolean;
  filename: string | null;
  generatedAt: number | null;
}

function remainingText(target: number): string {
  const difference = Math.max(0, target - Date.now());
  const days = Math.floor(difference / 86_400_000);
  const hours = Math.floor((difference % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}天${hours}小时`;
  const minutes = Math.max(1, Math.ceil(difference / 60_000));
  return `${minutes}分钟`;
}

export function BuyerPortal({ token }: { token: string }) {
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [progress, setProgress] = useState(12);

  const loadStatus = useCallback(async () => {
    const response = await fetch(`/api/public/${token}/status`, { cache: "no-store" });
    const data = await response.json() as PortalStatus & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "资料链接无法打开");
    setStatus(data);
    return data;
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStatus().catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (window.location.hash !== "#auth-required") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const showTimer = window.setTimeout(() => setToast("请先验证手机号和订单号，再下载专属文件"), 0);
    const hideTimer = window.setTimeout(() => setToast(""), 5_000);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!submitting) return;
    const timer = window.setInterval(() => setProgress((value) => Math.min(92, value + Math.max(1, Math.round((94 - value) / 7)))), 480);
    return () => window.clearInterval(timer);
  }, [submitting]);

  useEffect(() => {
    if (status?.jobStatus !== "PROCESSING") return;
    const timer = window.setInterval(() => {
      loadStatus().catch(() => undefined);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [loadStatus, status?.jobStatus]);

  const phaseNote = useMemo(() => {
    if (!status) return "";
    if (status.phase === "GENERATION_OPEN") return `专属文件生成还剩 ${remainingText(status.generationDeadline)}`;
    if (status.phase === "DOWNLOAD_ONLY") return `已生成用户下载还剩 ${remainingText(status.expiresAt)}`;
    return "本期资料链接已经结束";
  }, [status]);

  async function sendCode() {
    setError("");
    setNotice("");
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的11位中国大陆手机号");
      return;
    }
    setSending(true);
    try {
      const response = await fetch(`/api/public/${token}/send-code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json() as { error?: string; message?: string; devCode?: string };
      if (!response.ok) throw new Error(data.error ?? "验证码发送失败");
      setCooldown(60);
      setNotice(data.devCode ? `开发预览验证码：${data.devCode}` : "验证码已发送，请查看短信");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "验证码发送失败");
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setProgress(12);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/public/${token}/access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, orderNumber }),
      });
      const data = await response.json() as { error?: string; state?: string };
      if (!response.ok) throw new Error(data.error ?? "专属文件生成失败");
      setProgress(100);
      const next = await loadStatus();
      if (data.state === "GENERATING" || !next.ready) setNotice("文件正在生成，页面会自动更新");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "专属文件生成失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="portal-loading"><LoaderCircle className="spin" /><p>正在打开你的宝藏资料…</p></main>;
  }

  if (!status || status.phase === "EXPIRED") {
    return (
      <main className="portal-page expired-page">
        <section className="expired-card">
          <div className="icon-orb"><Clock3 /></div>
          <span className="eyebrow">小圆 PTE 突击</span>
          <h1>这份宝藏资料已到期</h1>
          <p>{error || "链接已失效，有问题请直接联系小圆。"}</p>
        </section>
      </main>
    );
  }

  const accent = status.entryMeta.color;
  const isGenerating = status.jobStatus === "PROCESSING" || submitting;
  const ready = status.ready;

  return (
    <main className="portal-page" style={{ "--accent": accent } as React.CSSProperties}>
      {toast && <div className="portal-toast" role="status" aria-live="polite"><ShieldCheck />{toast}</div>}
      <div className="confetti confetti-one" />
      <div className="confetti confetti-two" />
      <div className="confetti confetti-three" />
      <header className="portal-nav">
        <Image src="/brand/xiaoyuan-pte.png" alt="小圆 PTE 突击" width={48} height={48} priority />
        <div><strong>小圆 PTE 突击</strong><span>专属资料提取站</span></div>
        <div className="secure-chip"><ShieldCheck size={16} /> 安全验证</div>
      </header>

      <section className="portal-layout">
        <div className="portal-hero">
          <span className="eyebrow"><Sparkles size={15} /> PURCHASE UNLOCKED</span>
          <h1>恭喜宝宝<br />解锁 <em>{status.entryMeta.label}</em> 宝藏资料</h1>
          <p className="hero-copy">{status.entryMeta.description}。完成验证后，带有你专属水印的资料就可以带走啦。</p>
          <div className="treasure-ticket">
            <div className="ticket-icon"><Gift /></div>
            <div><span>本期资料</span><strong>{status.versionName}</strong></div>
            <div className="ticket-time"><Clock3 size={17} /><span>{phaseNote}</span></div>
          </div>
          <div className="promise-row">
            <span><CheckCircle2 /> 每页专属水印</span>
            <span><CheckCircle2 /> 原文件重复下载</span>
            <span><CheckCircle2 /> 登录状态自动保存</span>
          </div>
        </div>

        <section className="claim-card">
          {ready ? (
            <div className="ready-state">
              <div className="success-mark"><PackageCheck /></div>
              <span className="step-kicker">专属文件准备好啦</span>
              <h2>宝藏已装进你的口袋</h2>
              <p>{status.phone ? `已验证手机 ${status.phone}` : "身份验证已完成"}，有效期内可以随时回来下载这份原文件。</p>
              <div className="file-tile">
                <FileArchive />
                <div><strong>{status.filename}</strong><span>生成于 {status.generatedAt ? new Date(status.generatedAt).toLocaleString("zh-CN") : "刚刚"}</span></div>
                <CheckCircle2 className="file-check" />
              </div>
              <a className="primary-button download-button" href={`/api/public/${token}/download`}>
                <Download /> 下载我的专属文件
              </a>
              <p className="fine-print"><LockKeyhole /> 文件只在当前资料链接有效期内开放下载，请及时保存。</p>
            </div>
          ) : isGenerating ? (
            <div className="generating-state">
              <div className="generation-orb"><Sparkles /><span>{progress}%</span></div>
              <span className="step-kicker">正在准备你的宝藏</span>
              <h2>{progress < 35 ? "正在验证信息" : progress < 76 ? "正在添加专属水印" : "正在整理文件"}</h2>
              <p>每一页都在认真盖上你的专属标记，请稍等一下。</p>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
              <div className="progress-steps"><span className="active">验证</span><span className={progress > 35 ? "active" : ""}>水印</span><span className={progress > 76 ? "active" : ""}>整理</span></div>
            </div>
          ) : (
            <form onSubmit={submit}>
              <span className="step-kicker">领取只差一步</span>
              <h2>{status.phase === "DOWNLOAD_ONLY" ? "登录并下载之前的文件" : "生成我的专属文件"}</h2>
              <p className="form-intro">验证购买信息后，系统会为你安全地准备资料。</p>

              <label className="field-label" htmlFor="phone">中国大陆手机号</label>
              <div className="input-shell">
                <Phone size={19} /><span className="country-code">+86</span>
                <input id="phone" inputMode="numeric" autoComplete="tel" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="请输入11位手机号" />
              </div>
              <p className="field-help">没有中国大陆手机号，请联系小圆。</p>

              <label className="field-label" htmlFor="code">短信验证码</label>
              <div className="input-shell code-shell">
                <ShieldCheck size={19} />
                <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6位验证码" />
                <button type="button" onClick={sendCode} disabled={sending || cooldown > 0}>{sending ? "发送中" : cooldown > 0 ? `${cooldown}s` : "获取验证码"}</button>
              </div>

              <label className="field-label" htmlFor="order">小红书订单号</label>
              <div className="input-shell">
                <PackageCheck size={19} />
                <input id="order" autoCapitalize="characters" autoComplete="off" maxLength={19} value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.trim().toUpperCase())} placeholder="P开头的19位订单号" />
              </div>
              <p className="field-help">请从小红书订单详情复制，首次提交后会与手机号绑定。</p>

              {notice && <div className="form-notice success-notice">{notice}</div>}
              {error && <div className="form-notice error-notice" role="alert">{error}</div>}

              <button className="primary-button" type="submit">
                {status.phase === "DOWNLOAD_ONLY" ? "登录并查看文件" : "生成我的专属文件"}<ArrowRight />
              </button>
              <p className="privacy-note"><LockKeyhole /> 为生成和保护专属资料，系统将保存手机号和订单号，并在资料每一页添加完整手机号水印。继续即表示你已了解上述用途。</p>
            </form>
          )}
        </section>
      </section>
      <footer>小圆 PTE 突击 · 认真准备的资料，也认真保护每一份信任</footer>
    </main>
  );
}
