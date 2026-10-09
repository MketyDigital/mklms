"use client";

import { useMemo, useState } from "react";

type FileItem = {
  id: string;
  key: string;
  contentType: string;
  size: number;
  createdAt: string;
  shortUrl: string;
  assetUrl: string;
};

type Filter = "all" | "images" | "videos" | "files";
type Preview = { item: FileItem; src: string } | null;

function category(item: FileItem): Exclude<Filter, "all"> {
  if (item.contentType.startsWith("image/")) return "images";
  if (item.contentType.startsWith("video/")) return "videos";
  return "files";
}

function previewable(item: FileItem) {
  return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm", "video/ogg"].includes(item.contentType.split(";")[0].toLowerCase());
}

function displayName(key: string) {
  return key.replace(/^[0-9a-f]{8}-[0-9a-f-]{27}-/i, "") || key;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export default function FileLibrary({ files }: { files: FileItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<Preview>(null);
  const [copied, setCopied] = useState("");
  const counts = useMemo(() => ({
    all: files.length,
    images: files.filter(file => category(file) === "images").length,
    videos: files.filter(file => category(file) === "videos").length,
    files: files.filter(file => category(file) === "files").length,
  }), [files]);
  const visible = filter === "all" ? files : files.filter(file => category(file) === filter);

  async function copyUrl(item: FileItem) {
    try {
      await navigator.clipboard.writeText(item.shortUrl);
      setCopied(item.id);
      window.setTimeout(() => setCopied(current => current === item.id ? "" : current), 1800);
    } catch {
      setCopied("");
    }
  }

  return <section className="card file-library">
    <div className="file-library-heading">
      <div><h2>Files</h2><p className="muted">{files.length} {files.length === 1 ? "item" : "items"} in this bucket</p></div>
      <div className="toolbar" aria-label="Library layout">
        <button type="button" className={"btn secondary library-layout"+(layout === "grid" ? " selected" : "")} aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>Grid</button>
        <button type="button" className={"btn secondary library-layout"+(layout === "list" ? " selected" : "")} aria-pressed={layout === "list"} onClick={() => setLayout("list")}>List</button>
      </div>
    </div>
    <div className="file-library-filters" role="group" aria-label="Filter files">
      {(["all", "images", "videos", "files"] as const).map(key =>
        <button type="button" key={key} className={"library-filter"+(filter === key ? " active" : "")} aria-pressed={filter === key} onClick={() => setFilter(key)}>
          {key === "all" ? "All" : key[0].toUpperCase()+key.slice(1)} <span>{counts[key]}</span>
        </button>
      )}
    </div>
    {visible.length ? <div className={"file-grid "+(layout === "list" ? "file-list" : "")}>
      {visible.map(item => {
        const type = category(item);
        const canPreview = previewable(item);
        const image = type === "images" && canPreview;
        const video = type === "videos" && canPreview;
        const name = displayName(item.key);
        const previewUrl = item.assetUrl + "?preview=1";
        return <article className="file-card" key={item.id}>
          <button type="button" className={"file-visual "+(image ? "has-image" : "")} onClick={() => canPreview && setPreview({ item, src: previewUrl })} disabled={!canPreview} aria-label={canPreview ? "Preview "+name : name}>
            {image ? <img src={previewUrl} alt="" loading="lazy"/> : <span className="file-kind-icon" aria-hidden="true">{video ? "▶" : type === "images" ? "▧" : type === "videos" ? "▶" : "↧"}</span>}
            {video && <span className="video-badge">VIDEO</span>}
          </button>
          <div className="file-details">
            <strong className="file-name" title={name}>{name}</strong>
            <span className="muted file-meta">{formatBytes(item.size)} · {item.contentType || "Unknown type"}</span>
            <div className="file-actions">
              {canPreview && <button type="button" className="btn secondary" onClick={() => setPreview({ item, src: previewUrl })}>Preview</button>}
              <button type="button" className="btn secondary" onClick={() => void copyUrl(item)}>{copied === item.id ? "Copied" : "Copy link"}</button>
              <a className="btn secondary" href={item.assetUrl} target="_blank" rel="noreferrer">Open</a>
              <form method="post" action="/api/objects/delete" onSubmit={event => { if (!window.confirm("Delete "+name+"? This cannot be undone.")) event.preventDefault(); }}>
                <input type="hidden" name="objectId" value={item.id}/>
                <button className="btn secondary danger-button">Delete</button>
              </form>
            </div>
          </div>
        </article>;
      })}
    </div> : <p className="muted">{files.length ? "No files in this category." : "No files yet."}</p>}
    {preview && <div className="preview-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setPreview(null); }}>
      <section className="preview-dialog" role="dialog" aria-modal="true" aria-label={"Preview "+displayName(preview.item.key)}>
        <header><div><strong>{displayName(preview.item.key)}</strong><span className="muted">{formatBytes(preview.item.size)} · {preview.item.contentType}</span></div><button type="button" className="btn secondary" onClick={() => setPreview(null)} aria-label="Close preview">Close</button></header>
        {preview.item.contentType.startsWith("image/") ? <img className="preview-image" src={preview.src} alt={displayName(preview.item.key)}/> : <video className="preview-video" src={preview.src} controls autoPlay preload="metadata"/>}
        <footer><button type="button" className="btn secondary" onClick={() => void copyUrl(preview.item)}>{copied === preview.item.id ? "Copied" : "Copy link"}</button><a className="btn" href={preview.item.assetUrl} target="_blank" rel="noreferrer">Open original</a></footer>
      </section>
    </div>}
  </section>;
}
