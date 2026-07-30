"use client";

import { Check, Clipboard, FileCheck2, FileUp, Link2, LoaderCircle, LogOut, Plus, Rocket, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MATERIAL_TYPES, MATERIAL_UPLOAD_LIMIT_MIB } from "@/lib/constants";

const TYPES = MATERIAL_TYPES;

interface Asset { material_type: string; original_filename: string; file_size: number; page_count: number; }
interface Version {
  id: string; displayName: string; status: string; createdAt: number; publishedAt: number | null;
  generationDeadline: number | null; expiresAt: number | null; assetCount: number; generationCount: number;
  links: Array<{ entry: string; url: string }>;
}

function dateTime(value: number | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function statusLabel(status: string) {
  return ({ DRAFT: "草稿", GENERATION_OPEN: "开放生成", DOWNLOAD_ONLY: "仅限下载", EXPIRED: "已失效" } as Record<string, string>)[status] ?? status;
}

export function AdminDashboard({ routeKey }: { routeKey: string }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [copied, setCopied] = useState("");

  const loadVersions = useCallback(async () => {
    const response = await fetch("/api/admin/versions", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    const data = await response.json() as { versions?: Version[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "无法读取资料版本");
    setAuthenticated(true);
    setVersions(data.versions ?? []);
    setActiveId((current) => current ?? data.versions?.find((version) => version.status === "DRAFT")?.id ?? null);
  }, []);

  const loadAssets = useCallback(async (versionId: string) => {
    const response = await fetch(`/api/admin/versions/${versionId}/assets`, { cache: "no-store" });
    const data = await response.json() as { assets?: Asset[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "无法读取文件");
    setAssets(data.assets ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadVersions().catch((reason: Error) => setError(reason.message)), 0);
    return () => window.clearTimeout(timer);
  }, [loadVersions]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeId) loadAssets(activeId).catch((reason: Error) => setError(reason.message));
      else setAssets([]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeId, loadAssets]);

  const active = versions.find((version) => version.id === activeId) ?? null;
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.material_type, asset])), [assets]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy("login"); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ routeKey, username, password }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? (response.status === 429 ? "登录尝试次数过多，请稍后再试" : "登录失败"));
      await loadVersions();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登录失败"); }
    finally { setBusy(""); }
  }

  async function createDraft() {
    setBusy("create"); setError("");
    try {
      const response = await fetch("/api/admin/versions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      const data = await response.json() as { version?: Version; error?: string };
      if (!response.ok || !data.version) throw new Error(data.error ?? "创建失败");
      setName(""); await loadVersions(); setActiveId(data.version.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "创建失败"); }
    finally { setBusy(""); }
  }

  async function upload(type: string, file: File) {
    if (!activeId) return;
    setBusy(`upload-${type}`); setError("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/admin/versions/${activeId}/assets/${type}`, { method: "POST", body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "上传失败");
      await Promise.all([loadAssets(activeId), loadVersions()]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "上传失败"); }
    finally { setBusy(""); }
  }

  async function publish() {
    if (!activeId || !window.confirm("发布后会立即生成6个新链接并开始计时，确认发布吗？")) return;
    setBusy("publish"); setError("");
    try {
      const response = await fetch(`/api/admin/versions/${activeId}/publish`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "发布失败");
      await loadVersions();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "发布失败"); }
    finally { setBusy(""); }
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url); setCopied(url); window.setTimeout(() => setCopied(""), 1800);
  }

  if (authenticated === null) return <main className="admin-loading"><LoaderCircle className="spin" /></main>;
  if (!authenticated) return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={login}>
        <Image src="/brand/xiaoyuan-pte-round.png" alt="小圆 PTE 突击" width={58} height={58} priority />
        <span className="eyebrow"><ShieldCheck size={15} /> INTERNAL CONSOLE</span>
        <h1>资料发布后台</h1><p>管理员登录后上传资料并生成本期链接。</p>
        <label>管理员账号<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
        <label>管理员密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error && <div className="form-notice error-notice">{error}</div>}
        <button className="primary-button" disabled={busy === "login"}>{busy === "login" ? <LoaderCircle className="spin" /> : <ShieldCheck />} 登录后台</button>
      </form>
    </main>
  );

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="admin-brand"><Image src="/brand/xiaoyuan-pte-round.png" alt="" width={44} height={44} /><div><strong>小圆 PTE 突击</strong><span>资料发布后台</span></div></div>
        <button className="quiet-button" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setAuthenticated(false); }}><LogOut /> 退出</button>
      </header>
      <div className="admin-grid">
        <aside className="version-sidebar">
          <div className="sidebar-heading"><div><span>资料版本</span><strong>{versions.length} 个</strong></div></div>
          <div className="create-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：8月第一批" /><button onClick={createDraft} disabled={busy === "create"}><Plus /></button></div>
          <div className="version-list">
            {versions.map((version) => <button key={version.id} className={version.id === activeId ? "active" : ""} onClick={() => setActiveId(version.id)}><span>{version.displayName}</span><small>{statusLabel(version.status)} · {version.assetCount}/5 文件</small></button>)}
            {!versions.length && <p className="empty-copy">创建第一个资料版本开始上传。</p>}
          </div>
        </aside>

        <section className="admin-content">
          {error && <div className="admin-alert">{error}</div>}
          {!active ? <div className="admin-empty"><Rocket /><h2>准备发布新的宝藏资料</h2><p>在左侧创建资料版本，然后上传五个题型 PDF。</p></div> : (
            <>
              <div className="content-heading"><div><span className={`status-pill ${active.status.toLowerCase()}`}>{statusLabel(active.status)}</span><h1>{active.displayName}</h1><p>创建于 {dateTime(active.createdAt)} · 已成功生成 {active.generationCount} 份</p></div>{active.status === "DRAFT" && <button className="publish-button" onClick={publish} disabled={assets.length !== 5 || busy === "publish"}>{busy === "publish" ? <LoaderCircle className="spin" /> : <Rocket />} 发布并生成链接</button>}</div>

              {active.status === "DRAFT" ? (
                <div className="upload-grid">
                  {TYPES.map((type) => { const asset = assetMap.get(type); const uploading = busy === `upload-${type}`; return (
                    <label className={`upload-card ${asset ? "complete" : ""}`} key={type}>
                      <input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(type, file); event.target.value = ""; }} />
                      <div className="upload-icon">{uploading ? <LoaderCircle className="spin" /> : asset ? <FileCheck2 /> : <FileUp />}</div>
                      <div><span>{type}</span><strong>{asset ? asset.original_filename : `上传 ${type}.pdf`}</strong><small>{asset ? `${asset.page_count}页 · ${(asset.file_size / 1024 / 1024).toFixed(1)}MB` : `点击选择 PDF，最大 ${MATERIAL_UPLOAD_LIMIT_MIB[type]}MB`}</small></div>
                      {asset && <Check className="upload-check" />}
                    </label>
                  ); })}
                </div>
              ) : (
                <>
                  <div className="timeline-strip"><div><span>发布时间</span><strong>{dateTime(active.publishedAt)}</strong></div><div><span>停止新增生成</span><strong>{dateTime(active.generationDeadline)}</strong></div><div><span>链接失效</span><strong>{dateTime(active.expiresAt)}</strong></div></div>
                  <div className="links-panel"><div className="panel-title"><Link2 /><div><h2>6 个商品发货链接</h2><p>复制后分别填入小红书商品自动发货信息。</p></div></div><div className="link-list">{active.links.map((link) => <div className="link-row" key={link.entry}><span>{link.entry === "BUNDLE" ? "五项合集" : link.entry}</span><code>{link.url}</code><button onClick={() => copy(link.url)}>{copied === link.url ? <Check /> : <Clipboard />}{copied === link.url ? "已复制" : "复制"}</button></div>)}</div></div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
