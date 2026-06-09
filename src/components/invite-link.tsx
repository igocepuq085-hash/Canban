"use client";

import { useEffect, useRef, useState } from "react";

export function InviteLink({ name, path, accepted }: { name: string; path: string; accepted: boolean }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      inputRef.current?.select();
      setCopied(document.execCommand("copy"));
    }
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="invite-card">
      <div className="invite-card-head">
        <strong>{name}</strong>
        <span>{accepted ? "Ссылка использована" : "Ожидает открытия"}</span>
      </div>
      <div className="invite-copy-row">
        <input ref={inputRef} aria-label={`Персональная ссылка для ${name}`} readOnly value={url} />
        <button type="button" onClick={copyLink}>{copied ? "Скопировано" : "Копировать"}</button>
      </div>
    </div>
  );
}
