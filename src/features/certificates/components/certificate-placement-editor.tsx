"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import type {
  CertificateFieldPlacement,
  CertificateVisualLayoutV2,
} from "../providers/certificate-layout";
import { DEFAULT_CERTIFICATE_VISUAL_LAYOUT } from "../providers/certificate-layout";

const SAMPLE = {
  name: "FERDINAND DIKE",
  completionDate: "2026-09-09",
  certificateId: "SPF-E3BCC682B455",
} as const;

type FieldKey = "name" | "completionDate" | "certificateId";

const LABELS: Record<FieldKey, string> = {
  name: "Student name",
  completionDate: "Completion date",
  certificateId: "Certificate ID",
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function CertificatePlacementEditor({
  file,
  value,
  onChange,
}: {
  file: File | null;
  value: CertificateVisualLayoutV2;
  onChange: (value: CertificateVisualLayoutV2) => void;
}) {
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const fields = useMemo(() => (["name", "completionDate", "certificateId"] as FieldKey[]), []);

  function updateField(key: FieldKey, patch: Partial<CertificateFieldPlacement>) {
    onChange({
      ...value,
      [key]: { ...value[key], ...patch },
    });
  }

  function beginDrag(key: FieldKey, event: React.PointerEvent<HTMLDivElement>) {
    if (!frameRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = frameRef.current.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + value[key].xRatio * rect.width);
    const offsetY = event.clientY - (rect.top + value[key].yRatio * rect.height);

    const move = (moveEvent: PointerEvent) => {
      const xRatio = clamp01((moveEvent.clientX - rect.left - offsetX) / rect.width);
      const yRatio = clamp01((moveEvent.clientY - rect.top - offsetY) / rect.height);
      updateField(key, {
        xRatio: Math.min(xRatio, 1 - value[key].widthRatio),
        yRatio,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Visual field placement</p>
        <p className="text-xs leading-5 text-muted-foreground">
          Drag each field directly onto the blank space where it should print. Positions are saved as percentages of the certificate, so they remain correct when the template is rendered at a different size.
        </p>
      </div>

      {!file || !objectUrl ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Choose the certificate artwork above to start positioning the fields.
        </div>
      ) : (
        <div className="space-y-3">
          <div
            ref={frameRef}
            className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-lg border bg-muted/20"
            style={{ aspectRatio }}
          >
            {file.type === "application/pdf" ? (
              <embed
                src={`${objectUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                type="application/pdf"
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt="Certificate template preview"
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                    setAspectRatio(image.naturalWidth / image.naturalHeight);
                  }
                }}
              />
            )}

            {fields.map((key) => {
              const field = value[key];
              const sample = SAMPLE[key];
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Move ${LABELS[key]}`}
                  onPointerDown={(event) => beginDrag(key, event)}
                  className="absolute flex cursor-move touch-none select-none items-center rounded border-2 border-primary bg-background/80 px-1 shadow-sm backdrop-blur-sm"
                  style={{
                    left: `${field.xRatio * 100}%`,
                    top: `${field.yRatio * 100}%`,
                    width: `${field.widthRatio * 100}%`,
                    minHeight: 28,
                    fontSize: Math.max(9, Math.min(22, field.fontSize * 0.55)),
                    justifyContent: field.align === "left" ? "flex-start" : field.align === "right" ? "flex-end" : "center",
                  }}
                >
                  <span className="truncate font-semibold">{sample}</span>
                </div>
              );
            })}
          </div>

          {file.type === "application/pdf" ? (
            <p className="text-xs text-muted-foreground">
              PDF preview uses the browser PDF renderer. For unusual PDF page sizes, use the aspect ratio control below until the artwork fills the preview exactly; saved positions remain normalized to the page.
            </p>
          ) : null}

          <label className="block max-w-xs space-y-1 text-xs">
            <span>Preview aspect ratio (width ÷ height)</span>
            <Input
              type="number"
              min="0.3"
              max="4"
              step="0.001"
              value={Number(aspectRatio.toFixed(3))}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next) && next > 0) setAspectRatio(next);
              }}
            />
          </label>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {fields.map((key) => (
          <div key={key} className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">{LABELS[key]}</p>
            <label className="space-y-1 text-xs">
              <span>Font size</span>
              <Input
                type="number"
                min="7"
                max="72"
                step="0.5"
                value={value[key].fontSize}
                onChange={(event) => updateField(key, { fontSize: Number(event.target.value) || value[key].fontSize })}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>Field width</span>
              <Input
                type="range"
                min="0.05"
                max="0.9"
                step="0.01"
                value={value[key].widthRatio}
                onChange={(event) => updateField(key, { widthRatio: Number(event.target.value) })}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>Alignment</span>
              <select
                className="h-9 w-full rounded-md border bg-background px-3"
                value={value[key].align}
                onChange={(event) => updateField(key, { align: event.target.value as CertificateFieldPlacement["align"] })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="text-xs font-medium text-primary underline underline-offset-4"
        onClick={() => onChange(DEFAULT_CERTIFICATE_VISUAL_LAYOUT)}
      >
        Reset placement
      </button>
    </div>
  );
}
