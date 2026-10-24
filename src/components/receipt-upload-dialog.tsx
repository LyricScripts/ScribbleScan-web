"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearTokens, request } from "@/src/api/client";
import type { DocSchema, DocumentOut, FieldSpec, Issue } from "@/src/api/types";
import { useDemo } from "@/src/components/demo-context";
import { nice, parseAmount, title, toDMY, toISO } from "@/src/format";

type FieldKind = NonNullable<FieldSpec["x-kind"]>;
type FormData = Record<string, unknown>;
type Stage = "select" | "selected" | "uploading" | "processing" | "review";

function isReceiptFile(file: File) {
  return file.type.startsWith("image/") || file.type === "application/pdf" || /\.(?:jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|pdf)$/i.test(file.name);
}

function readField(kind: FieldKind, value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (kind === "date") return toISO(trimmed);
  if (kind === "amount" || kind === "number") return parseAmount(trimmed);
  return trimmed;
}

function hasContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasContent);
  if (typeof value === "object") return Object.values(value).some(hasContent);
  return true;
}

function issueText(issue: Issue) {
  switch (issue.rule) {
    case "empty": return "Nothing was read automatically. Enter the main details below.";
    case "missing": return `The ${nice(issue.detail).replace(/\[\d+\]/, "")} is missing.`;
    case "date_parse": return "The date isn't readable. Use DD/MM/YYYY.";
    case "total_positive": return "The total should be more than zero.";
    case "items_sum": return `The items don't add up: ${issue.detail.replace("!=", "but")}.`;
    case "total_math": return `Subtotal minus discount plus VAT doesn't match the total (${issue.detail.replace("!=", "≠")}).`;
    case "line_math": return `A line's quantity × price doesn't match its amount (${issue.detail}).`;
    default: return issue.detail;
  }
}

function fieldClass() {
  return "mt-1.5 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-ledger";
}

function Step({ number, label, state }: { number: string; label: string; state: "done" | "active" | "waiting" }) {
  return (
    <li className={`flex items-center gap-3 py-3 ${state === "done" ? "text-ledger" : state === "active" ? "text-ink" : "text-quiet"}`}>
      <span className="font-mono text-xs tabular-nums">{number}</span>
      {state === "done" ? <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg> : state === "active" ? <span className="h-2 w-2 animate-pulse rounded-full bg-ledger" /> : <span className="h-2 w-2 rounded-full border border-line" />}
      <span>{label}</span>
    </li>
  );
}

export function ReceiptUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { activeSpace, activeSpaceId, source, upload, refresh } = useDemo();
  const input = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const selectedActionButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const draftId = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [document, setDocument] = useState<DocumentOut | null>(null);
  const [schema, setSchema] = useState<DocSchema | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [formData, setFormData] = useState<FormData>({});
  const [photo, setPhoto] = useState<{ url: string; pdf: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [docType, setDocType] = useState<"receipt" | "bank_statement">("receipt");

  const discardDraft = useCallback(async () => {
    if (saving || discarding) return;
    const id = draftId.current;
    if (source !== "connected" || !id) {
      onClose();
      return;
    }
    setDiscarding(true);
    try {
      await api(`/v1/documents/${id}`, { method: "DELETE" });
      draftId.current = null;
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't discard this receipt. Try again.");
      setDiscarding(false);
    }
  }, [discarding, onClose, saving, source]);

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    const previousOverflow = window.document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stage !== "uploading" && !saving && !discarding) void discardDraft();
    };
    window.document.body.style.overflow = "hidden";
    window.document.addEventListener("keydown", closeOnEscape);
    (stage === "selected" ? selectedActionButton.current : chooseButton.current ?? closeButton.current)?.focus();
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.document.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [discardDraft, discarding, open, saving, stage]);

  useEffect(() => {
    if (!open || stage !== "processing" || document?.status !== "processing") return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await api<DocumentOut>(`/v1/documents/${document.id}`);
        if (cancelled) return;
        setDocument(next);
        if (next.status !== "processing") {
          setFormData(next.data ?? {});
          setCategory(next.category ?? categories[0] ?? "");
          setStage("review");
          return;
        }
      } catch {
        // Keep the progress screen open while a temporary network error clears.
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [open, stage, document?.id, document?.status, categories]);

  useEffect(() => {
    if (!open || source !== "connected" || !document?.id) return;
    let objectUrl: string | null = null;
    void request(`/v1/documents/${document.id}/file`).then(async (response) => {
      if (!response.ok) return;
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      setPhoto({ url: objectUrl, pdf: blob.type === "application/pdf" });
    }).catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPhoto(null);
    };
  }, [open, source, document?.id]);

  const fields = useMemo(() => Object.entries(schema?.properties ?? {}), [schema]);
  const extractedFieldCount = fields.filter(([name]) => hasContent(document?.data?.[name])).length;

  const collectData = () => Object.fromEntries(fields.map(([name, spec]) => {
    const kind = spec["x-kind"] ?? "text";
    if (kind !== "rows") return [name, readField(kind, formData[name] == null ? "" : String(formData[name]))];
    const columns = Object.entries(spec.items?.properties ?? {});
    const rows = Array.isArray(formData[name]) ? formData[name] as FormData[] : [];
    return [name, rows.map((row) => Object.fromEntries(columns.map(([column, columnSpec]) => {
      const columnKind = columnSpec["x-kind"] ?? "text";
      return [column, readField(columnKind, row[column] == null ? "" : String(row[column]))];
    }))).filter((row) => Object.values(row).some((value) => value != null))];
  }));
  const canConfirm = hasContent(collectData());

  const openReview = async (uploaded: DocumentOut) => {
    setDocument(uploaded);
    setStage("processing");
    setError("");
    try {
      const [latest, availableCategories] = await Promise.all([
        api<DocumentOut>(`/v1/documents/${uploaded.id}`),
        api<string[]>("/v1/categories"),
      ]);
      const loadedSchema = await api<DocSchema>(`/v1/schemas/${latest.doc_type}`);
      setDocument(latest);
      setSchema(loadedSchema);
      setCategories(availableCategories);
      setFormData(latest.data ?? {});
      setCategory(latest.category ?? availableCategories[0] ?? "");
      if (latest.status === "processing") {
        setStage("processing");
      } else {
        setStage("review");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the extracted details.");
    }
  };

  const uploadFile = async (picked: File) => {
    setFile(picked);
    setError("");
    if (source !== "connected") {
      setStage("selected");
      return;
    }
    setStage("uploading");
    try {
      const uploaded = await upload(activeSpaceId, picked, docType);
      draftId.current = uploaded.id;
      await openReview(uploaded);
    } catch (cause) {
      setStage("selected");
      setError(cause instanceof Error ? cause.message : "Couldn't upload this receipt.");
    }
  };

  const addFile = (picked: FileList | null) => {
    if (!picked?.length) return;
    const selected = [...picked];
    const valid = selected.filter(isReceiptFile);
    if (!valid.length) {
      setError("Choose an image file or PDF.");
      return;
    }
    if (selected.length > 1) {
      setError("Choose one receipt at a time.");
      return;
    }
    const selectedFile = valid[0]!;
    if (source === "connected") {
      void uploadFile(selectedFile);
    } else {
      setFile(selectedFile);
      setError("");
      setStage("selected");
    }
  };

  const save = async () => {
    if (!document) return;
    setError("");
    setSaving(true);
    try {
      await api<DocumentOut>(`/v1/documents/${document.id}`, {
        method: "PATCH",
        body: { data: collectData(), category, confirmed: true },
      });
      draftId.current = null;
      await refresh();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save these details.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isProgress = stage === "uploading" || stage === "processing";
  const canClose = stage !== "uploading" && !saving && !discarding;
  const previewUrl = photo?.url ?? localPreview;
  const isPdf = photo?.pdf ?? file?.type === "application/pdf";
  const documentLabel = docType === "bank_statement" ? "bank statement" : "receipt";
  const dialogTitle = stage === "review" ? `Review ${documentLabel}` : stage === "processing" ? `Reading ${documentLabel}` : stage === "uploading" ? `Uploading ${documentLabel}` : stage === "selected" ? `${title(documentLabel)} selected` : "Add a document";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget && canClose) void discardDraft(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-upload-title"
        className="max-h-[min(92vh,56rem)] w-full max-w-5xl overflow-y-auto rounded-xl border border-line bg-card shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => { addFile(event.currentTarget.files); event.currentTarget.value = ""; }} />
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-card px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="receipt-upload-title" className="text-lg font-semibold tracking-tight text-ink">{dialogTitle}</h2>
            <p className="mt-1 truncate text-sm text-quiet">{document?.filename ?? file?.name ?? `Upload to ${activeSpace}`}</p>
          </div>
          <button ref={closeButton} type="button" disabled={!canClose} onClick={() => void discardDraft()} aria-label="Close receipt dialog" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-quiet transition hover:bg-[var(--raised)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        {stage === "select" ? <div className="p-5 sm:p-6">
          <div
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); addFile(event.dataTransfer.files); }}
            className={`grid min-h-64 place-items-center rounded-lg border-2 border-dashed p-6 text-center transition ${dragging ? "border-ledger bg-ledger-soft" : "border-line bg-[var(--raised)]"}`}
          >
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-ledger-soft text-ledger">
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>
              </div>
              {source === "connected" ? <label className="mx-auto block max-w-xs text-left text-sm font-semibold text-ink">
                Document type
                <select aria-label="Document type" value={docType} onChange={(event) => setDocType(event.target.value as "receipt" | "bank_statement")} className={fieldClass()}>
                  <option value="receipt">Receipt or invoice</option>
                  <option value="bank_statement">Bank statement</option>
                </select>
              </label> : null}
              <p className="mt-3 font-semibold text-ink">Drop a {documentLabel} here</p>
              <p className="mt-1 text-sm text-quiet">Choose an image or PDF. You’ll review the extracted fields in this dialog.</p>
              <button ref={chooseButton} type="button" onClick={() => input.current?.click()} className="mt-4 rounded-md bg-ledger-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5948]">Choose image or PDF</button>
            </div>
          </div>

          {source === "connected" ? <p role="status" className="mt-3 text-xs text-quiet">Uploading to {activeSpace}; extraction and review stay in this popup.</p> : <div className="mt-3 rounded-md border border-amber/20 bg-amber-soft p-3 text-sm text-ink">
            <p><span className="font-semibold text-amber">Sample account.</span> The receipt will not be uploaded or processed in preview mode.</p>
            <button type="button" onClick={() => { clearTokens(); onClose(); router.push("/connect"); }} className="mt-2 font-semibold text-ledger hover:underline">Switch to a live account</button>
          </div>}
          {file && source !== "connected" ? <p className="mt-3 text-sm text-quiet">Preview only: {file.name}</p> : null}
          {error ? <p role="alert" className="mt-3 text-sm text-stamp">{error}</p> : null}
        </div> : null}

        {stage === "selected" && file ? <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(240px,0.8fr)_minmax(320px,1fr)]">
          <div className="grid min-h-64 place-items-center overflow-hidden rounded-lg border border-line bg-[var(--raised)] p-4">
            {isPdf ? <a href={previewUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ledger hover:bg-card">Open selected PDF</a> : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Selected receipt preview" className="max-h-[34rem] w-full object-contain" />
            ) : <p className="text-sm text-quiet">Preparing receipt preview…</p>}
          </div>
          <div className="self-center">
            <p className="font-mono text-xs uppercase tracking-wider text-ledger">01 / 03 · selected</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">Receipt selected</h3>
            <p className="mt-2 break-all text-sm text-quiet">{file.name}</p>
            {source === "connected" ? <p className="mt-4 text-sm leading-6 text-quiet">This receipt has not been uploaded. Try uploading it again to {activeSpace}; you’ll review the extracted details before confirming and saving.</p> : <div className="mt-4 rounded-md border border-amber/20 bg-amber-soft p-3 text-sm text-ink">
              <p><span className="font-semibold text-amber">Sample account.</span> This file is selected on your device and has not been uploaded. Connect a live account to upload and extract receipt details.</p>
            </div>}
            {error ? <p role="alert" className="mt-3 text-sm text-stamp">{error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => input.current?.click()} className="rounded-md border border-line px-3.5 py-2.5 text-sm font-semibold text-ink hover:bg-[var(--raised)]">Choose a different file</button>
              {source === "connected" ? <button ref={selectedActionButton} type="button" onClick={() => void uploadFile(file)} className="rounded-md bg-ledger-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5948]">Try upload again</button> : <button ref={selectedActionButton} type="button" onClick={() => { clearTokens(); onClose(); router.push("/connect"); }} className="rounded-md bg-ledger-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5948]">Connect account to upload</button>}
            </div>
          </div>
        </div> : null}

        {isProgress ? <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,0.8fr)_minmax(320px,1fr)]">
          <div className="grid min-h-56 place-items-center overflow-hidden rounded-lg border border-line bg-[var(--raised)] p-5">
            {isPdf ? <a href={previewUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ledger hover:bg-card">Open receipt PDF</a> : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Receipt being uploaded" className="max-h-72 w-full object-contain" />
            ) : <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ledger" />
              <p className="mt-3 text-sm text-quiet">Preparing receipt preview…</p>
            </div>}
          </div>
          <div className="self-center">
            <div role="status" aria-live="polite" className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ledger-soft">
                <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-[3px] border-ledger/20 border-t-ledger motion-reduce:animate-none" />
              </span>
              <span>
                <span className="block font-mono text-xs text-ledger">{stage === "uploading" ? "01 / 03" : "02 / 03"}</span>
                <h3 className="mt-1 text-xl font-semibold text-ink">{stage === "uploading" ? "Uploading receipt" : "Reading receipt details"}</h3>
              </span>
            </div>
            <p className="mt-2 break-all text-sm text-quiet">{file?.name ?? document?.filename}</p>
            <ol aria-label="Receipt processing steps" className="mt-6 divide-y divide-line border-y border-line">
              <Step number="01" label="Upload receipt" state={stage === "uploading" ? "active" : "done"} />
              <Step number="02" label="Read receipt details" state={stage === "processing" ? "active" : "waiting"} />
              <Step number="03" label="Review and confirm" state="waiting" />
            </ol>
            {error && document ? <div role="alert" className="mt-4 rounded-md border border-stamp/20 bg-stamp/5 p-3 text-sm text-stamp">
              <p>{error}</p>
              <button type="button" onClick={() => void openReview(document)} className="mt-2 font-semibold underline">Try loading details again</button>
            </div> : <p role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-quiet">{stage === "uploading" ? "Your receipt is uploading. It will stay visible here while we read it." : "AI is reading your receipt. This can take a little while; the extracted fields will appear here when they’re ready."}</p>}
          </div>
        </div> : null}

        {stage === "review" && document ? <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(360px,1fr)]">
          <div className="space-y-4">
            <div className="grid min-h-64 place-items-center overflow-hidden rounded-lg border border-line bg-[var(--raised)] p-4">
              {isPdf ? <a href={previewUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ledger hover:bg-card">Open receipt PDF</a> : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Uploaded receipt" className="max-h-[34rem] w-full object-contain" />
              ) : <p className="text-sm text-quiet">Receipt preview unavailable.</p>}
            </div>
            <div className="rounded-lg border border-line bg-[var(--raised)] p-4">
              <p className="font-mono text-xs uppercase tracking-wider text-ledger">03 / 03 · review</p>
              <p className="mt-2 text-sm leading-6 text-quiet">{extractedFieldCount ? `${extractedFieldCount} field${extractedFieldCount === 1 ? " was" : "s were"} read from this receipt. Review and correct the values before confirming.` : "No details were read automatically. Enter the receipt details below before confirming."}</p>
            </div>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">{extractedFieldCount ? "Details read from receipt" : "Enter receipt details"}</h3>
                <p className="mt-1 text-sm text-quiet">{document.status === "failed" ? "Automatic reading failed. Enter the receipt details to continue." : extractedFieldCount ? "Edit anything that was read incorrectly." : "Automatic reading did not return any details. Fill in the fields to continue."}</p>
              </div>
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${document.status === "failed" ? "bg-stamp/10 text-stamp" : document.issues.length || !extractedFieldCount ? "bg-amber-soft text-amber" : "bg-ledger-soft text-ledger"}`}>{document.status === "failed" ? "Needs details" : !extractedFieldCount ? "No details read" : document.issues.length ? "Check details" : "Ready to review"}</span>
            </div>

            {document.issues.length ? <div className="mt-4 rounded-md border border-amber/20 bg-amber-soft p-3">
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink">{document.issues.map((issue, index) => <li key={`${issue.rule}-${index}`}>{issueText(issue)}</li>)}</ul>
            </div> : null}

            {!schema ? <div role="alert" className="mt-4 rounded-md border border-stamp/20 bg-stamp/5 p-4 text-sm text-stamp">{error || "Receipt fields could not be loaded."}<button type="button" onClick={() => { void openReview(document); }} className="ml-2 font-semibold underline">Try again</button></div> : <fieldset disabled={saving} className="mt-4 space-y-3">
              <div>
                <label htmlFor="receipt-category" className="text-sm font-semibold text-ink">Category</label>
                <select id="receipt-category" value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass()}>
                  {categories.map((item) => <option key={item} value={item}>{title(item)}</option>)}
                </select>
              </div>
              {fields.map(([name, spec]) => {
                const kind = spec["x-kind"] ?? "text";
                const value = formData[name];
                if (kind === "rows") {
                  const columns = Object.entries(spec.items?.properties ?? {});
                  const rows = Array.isArray(value) ? value as FormData[] : [];
                  return <div key={name}>
                    <h4 className="mb-2 text-sm font-semibold text-ink">{title(name)}</h4>
                    {rows.length ? <div className="overflow-x-auto rounded-md border border-line">
                      <table className="w-full min-w-[400px] text-left text-sm">
                        <thead className="bg-[var(--raised)] text-xs text-quiet"><tr>{columns.map(([column]) => <th key={column} className="px-3 py-2 font-semibold">{title(column)}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
                        <tbody className="divide-y divide-line">{rows.map((row, rowIndex) => <tr key={`${name}-${rowIndex}`}>
                          {columns.map(([column, columnSpec]) => {
                            const columnKind = columnSpec["x-kind"] ?? "text";
                            return <td key={column} className="p-2"><input aria-label={title(column)} value={columnKind === "date" && row[column] != null ? toDMY(String(row[column])) : row[column] == null ? "" : String(row[column])} inputMode={columnKind === "amount" || columnKind === "number" ? "decimal" : undefined} placeholder={columnKind === "date" ? "DD/MM/YYYY" : undefined} onChange={(event) => { const nextRows = rows.map((entry, index) => index === rowIndex ? { ...entry, [column]: event.target.value } : entry); setFormData((current) => ({ ...current, [name]: nextRows })); }} className="w-full min-w-24 rounded border border-line bg-paper px-2 py-1.5 text-ink outline-none focus:border-ledger" /></td>;
                          })}
                          <td className="px-2 py-1.5"><button type="button" aria-label="Remove row" onClick={() => setFormData((current) => ({ ...current, [name]: rows.filter((_, index) => index !== rowIndex) }))} className="rounded px-2 py-1 text-quiet hover:bg-paper hover:text-ink">×</button></td>
                        </tr>)}</tbody>
                      </table>
                    </div> : <p className="text-sm text-quiet">No {nice(name)} added.</p>}
                    <button type="button" onClick={() => { const blank = Object.fromEntries(columns.map(([column]) => [column, ""])); setFormData((current) => ({ ...current, [name]: [...rows, blank] })); }} className="mt-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-[var(--raised)]">Add row</button>
                  </div>;
                }
                return <div key={name}>
                  <label htmlFor={`receipt-field-${name}`} className="text-sm font-semibold text-ink">{title(name)}</label>
                  <input id={`receipt-field-${name}`} type="text" inputMode={kind === "amount" || kind === "number" ? "decimal" : undefined} placeholder={kind === "date" ? "DD/MM/YYYY" : undefined} value={kind === "date" && value != null ? toDMY(String(value)) : value == null ? "" : String(value)} onChange={(event) => setFormData((current) => ({ ...current, [name]: event.target.value }))} className={fieldClass()} />
                </div>;
              })}
            </fieldset>}

            {error && schema ? <p role="alert" className="mt-3 text-sm text-stamp">{error}</p> : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
              <button type="button" disabled={!canClose} onClick={() => void discardDraft()} className="rounded-md border border-line px-3.5 py-2.5 text-sm font-semibold text-ink hover:bg-[var(--raised)] disabled:cursor-not-allowed disabled:opacity-50">{discarding ? "Discarding…" : "Cancel"}</button>
              <button type="submit" disabled={saving || !schema || !canConfirm} className="rounded-md bg-ledger-button px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5948] disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div> : null}

      </section>
    </div>
  );
}
