"use client";

import { Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ENTRY_META, PRODUCT_ENTRIES } from "@/lib/constants";

interface BindingRecord {
  id: string;
  entry: string;
  phone: string;
  orderNumber: string;
  createdAt: number;
  jobStatus: string | null;
  jobCompletedAt: number | null;
  errorCode: string | null;
  fileStatus: string | null;
  generatedAt: number | null;
}

function entryLabel(entry: string) {
  return ENTRY_META[entry as keyof typeof ENTRY_META]?.label ?? entry;
}

function dateTime(value: number | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—";
}

function generationState(record: BindingRecord): { label: string; tone: string } {
  if (record.fileStatus === "ARCHIVED") return { label: "已归档", tone: "archived" };
  if (record.jobStatus === "SUCCEEDED" && record.fileStatus === "ACTIVE") return { label: "已生成", tone: "succeeded" };
  if (record.jobStatus === "SUCCEEDED") return { label: "文件缺失", tone: "missing" };
  if (record.jobStatus === "FAILED") return { label: "生成失败", tone: "failed" };
  if (record.jobStatus === "PROCESSING") return { label: "生成中", tone: "processing" };
  if (record.jobStatus === "PENDING") return { label: "排队中", tone: "processing" };
  return { label: "未生成", tone: "none" };
}

export function BindingRecordsPanel({ versionId }: { versionId: string }) {
  const [bindings, setBindings] = useState<BindingRecord[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [error, setError] = useState("");

  const loadBindings = useCallback(async () => {
    const response = await fetch(`/api/admin/versions/${versionId}/bindings`, { cache: "no-store" });
    const data = await response.json() as { bindings?: BindingRecord[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "无法读取购买记录");
    setBindings(data.bindings ?? []);
  }, [versionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadBindings().catch((reason: Error) => setError(reason.message)), 0);
    return () => window.clearTimeout(timer);
  }, [loadBindings]);

  const counts = new Map<string, number>();
  for (const binding of bindings) counts.set(binding.entry, (counts.get(binding.entry) ?? 0) + 1);
  const visible = filter === "ALL" ? bindings : bindings.filter((binding) => binding.entry === filter);

  return (
    <div className="links-panel bindings-panel">
      <div className="panel-title"><Users /><div><h2>购买记录</h2><p>每个入口链接背后的手机号、订单号与生成状态，方便与小红书订单对账。</p></div></div>
      {error && <div className="form-notice error-notice">{error}</div>}
      <div className="entry-filter">
        <button className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>全部 {bindings.length}</button>
        {PRODUCT_ENTRIES.map((value) => (
          <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
            {entryLabel(value)} {counts.get(value) ?? 0}
          </button>
        ))}
      </div>
      <div className="records-scroll">
        <table className="records-table">
          <thead><tr><th>入口</th><th>手机号</th><th>订单号</th><th>绑定时间</th><th>生成状态</th><th>生成时间</th></tr></thead>
          <tbody>
            {visible.map((record) => {
              const state = generationState(record);
              return (
                <tr key={record.id}>
                  <td>{entryLabel(record.entry)}</td>
                  <td>{record.phone}</td>
                  <td>{record.orderNumber}</td>
                  <td>{dateTime(record.createdAt)}</td>
                  <td><span className={`status-pill manual-${state.tone}`}>{state.label}</span></td>
                  <td>{dateTime(record.generatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <p className="records-empty">{filter === "ALL" ? "该版本还没有购买记录。" : "该入口还没有购买记录。"}</p>}
      </div>
    </div>
  );
}
