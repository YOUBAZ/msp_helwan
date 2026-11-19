"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";

/**
 * Reads QR codes from the phone's back camera (works on iPhone Safari and
 * Android Chrome). Calls `onScan` once per code; the same code is ignored for
 * a few seconds so one ticket isn't processed twice.
 */
export default function QrScanner({ onScan, paused }: { onScan: (text: string) => void; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const handler = useRef(onScan);
  const pausedRef = useRef(paused);
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [problem, setProblem] = useState("");

  handler.current = onScan;
  pausedRef.current = paused;

  useEffect(() => {
    let scanner: { start(): Promise<void>; stop(): void; destroy(): void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { default: QrScannerLib } = await import("qr-scanner");
        if (cancelled || !video.current) return;
        if (!(await QrScannerLib.hasCamera())) {
          setProblem("No camera found on this device. Use the search box instead.");
          return;
        }
        const s = new QrScannerLib(
          video.current,
          (result) => {
            const now = Date.now();
            if (pausedRef.current) return;
            if (result.data === last.current.text && now - last.current.at < 4000) return;
            last.current = { text: result.data, at: now };
            handler.current(result.data);
          },
          { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true },
        );
        scanner = s;
        await s.start();
      } catch {
        if (!cancelled) {
          setProblem(
            "The camera couldn't be started. Allow camera access in your browser settings, or use the search box.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, []);

  return (
    <div className="relative rounded-[2rem] overflow-hidden bg-black aspect-square max-h-[60vh] w-full">
      <video ref={video} className="w-full h-full object-cover" muted playsInline />
      {problem && (
        <div
          role="status"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-900 text-slate-200"
        >
          <CameraOff size={40} className="text-orange-500" />
          <p className="text-sm font-bold">{problem}</p>
        </div>
      )}
    </div>
  );
}
