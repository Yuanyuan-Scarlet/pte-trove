"use client";

import { Download, LoaderCircle, Stamp } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ENTRY_META, MANUAL_PHONE_MAX_LENGTH, MANUAL_SALUTATION_MAX_LENGTH, PRODUCT_ENTRIES } from "@/lib/constants";

interface ManualRecord {
  id: string;
  entry: string;
  salutation: string;
  phone: string;
  status: string;
  errorCode: string | null;
  downloadFilename: string | null;
  generatedAt: number | null;
  createdAt: number;
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: "生成中",
  ACTIVE: "可下载",
  FAILED: "生成失败",
  ARCHIVED: "已归档",
  MISSING: "文件缺失",
};

function entryLabel(entry: string) {
  return ENTRY_META[entry as keyof typeof ENTRY_META]?.label ?? entry;
}

function dateTime(value: number | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

export function ManualGenerationPanel({ versionId, phase }: { versionId: string; phase: string }) {
  const [entry, setEntry] = useState<string>("WFD");
  const [salutation, setSalutation] = useState("");
  const [phone, setPhone] = useState("");
  const [records, setRecords] = useState<ManualRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expired = phase === "EXPIRED";

  const loadRecords = useCallback(async () => {
    const response = await fetch(`/api/admin/versions/${versionId}/manual-generations`, { cache: "no-store" });
    const data = await response.json() as { records?: ManualRecord[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "无法读取手动生成记录");
    setRecords(data.records ?? []);
  }, [versionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadRecords().catch((reason: Error) => setError(reason.message)), 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/versions/${versionId}/manual-generations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entry, salutation, phone }),
      });
      const data = await response.json() as { record?: ManualRecord; error?: string };
      if (!response.ok || !data.record) throw new Error(data.error ?? "生成失败");
      setSalutation(""); setPhone("");
      await loadRecords();
      if (data.record.status === "ACTIVE") window.location.assign(`/api/admin/manual-generations/${data.record.id}/download`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成失败");
      await loadRecords().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="links-panel manual-panel">
      <div className="panel-title"><Stamp /><div><h2>手动水印生成</h2><p>为无法自助领取的买家（如国际手机号）输入称呼与电话，生成专属水印文件后人工发送。</p></div></div>
      {expired ? <p className="manual-disabled">该版本链接已失效，原始资料已归档，无法再手动生成；已生成的记录仍可下载。</p> : (
        <form className="manual-form" onSubmit={generate}>
          <label>入口
            <select value={entry} onChange={(event) => setEntry(event.target.value)} disabled={busy}>
              {PRODUCT_ENTRIES.map((value) => <option key={value} value={value}>{entryLabel(value)}</option>)}
            </select>
          </label>
          <label>称呼
            <input value={salutation} maxLength={MANUAL_SALUTATION_MAX_LENGTH} placeholder="例如：张同学" onChange={(event) => setSalutation(event.target.value)} disabled={busy} />
          </label>
          <label>电话
            <input value={phone} maxLength={MANUAL_PHONE_MAX_LENGTH} placeholder="例如：+61 412 345 678" onChange={(event) => setPhone(event.target.value)} disabled={busy} />
          </label>
          <button className="manual-submit" disabled={busy || !salutation.trim() || !phone.trim()}>
            {busy ? <LoaderCircle className="spin" /> : <Stamp />}{busy ? "生成中，请稍候…" : "生成并下载"}
          </button>
        </form>
      )}
      {error && <div className="form-notice error-notice">{error}</div>}
      <div className="records-scroll">
        <table className="records-table">
          <thead><tr><th>称呼</th><th>电话</th><th>入口</th><th>状态</th><th>生成时间</th><th></th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.salutation}</td>
                <td>{record.phone}</td>
                <td>{entryLabel(record.entry)}</td>
                <td><span className={`status-pill manual-${record.status.toLowerCase()}`}>{STATUS_LABELS[record.status] ?? record.status}</span></td>
                <td>{dateTime(record.generatedAt ?? record.createdAt)}</td>
                <td>{record.status === "ACTIVE" && <a className="record-download" href={`/api/admin/manual-generations/${record.id}/download`}><Download />下载</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && <p className="records-empty">还没有手动生成记录。</p>}
      </div>
    </div>
  );
}
