"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Camera, Check, RotateCcw, X } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { MAX_VIDEO_SECONDS } from "@/lib/evidence";
import { cn } from "@/lib/utils";

function cameraError(e: unknown): string {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError")
        return "Camera access is blocked. Allow it in your browser settings, then try again.";
    if (name === "NotFoundError" || name === "OverconstrainedError")
        return "No camera found on this device.";
    return "The camera couldn't start. Close other apps using it and try again.";
}

/** The first container this browser can record: iPhones give MP4, most Androids WebM. */
function recordingType(): string | null {
    if (typeof MediaRecorder === "undefined")
        return null;
    return ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

const round = cn("press grid size-12 cursor-pointer place-items-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25", focusRing);
const clock = (s: number) => `0:${String(s).padStart(2, "0")}`;

type Shot = { file: File; url: string; kind: "photo" | "video" };

/**
 * The app's own camera: the live feed is captured straight to a photo or a
 * short silent video, so no file picker (and no gallery) is ever offered.
 * The camera turns off the moment this closes.
 */
export function SiteCamera({ open, onClose, onCapture, allowVideo = false }: {
    open: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
    allowVideo?: boolean;
}) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const recorderRef = React.useRef<MediaRecorder | null>(null);
    const discardRef = React.useRef(false);
    const [shot, setShot] = React.useState<Shot | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [ready, setReady] = React.useState(false);
    const [attempt, setAttempt] = React.useState(0);
    const [mode, setMode] = React.useState<"photo" | "video">("photo");
    const [recording, setRecording] = React.useState(false);
    const [seconds, setSeconds] = React.useState(0);

    React.useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        const stop = () => {
            discardRef.current = true;
            if (recorderRef.current?.state === "recording")
                recorderRef.current.stop();
            recorderRef.current = null;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            setRecording(false);
        };
        setError(null);
        setReady(false);
        if (!navigator.mediaDevices?.getUserMedia) {
            setError(window.isSecureContext ? "This browser can't open the camera. Try Chrome or Safari." : "The camera needs a secure (https) link.");
            return;
        }
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 } }, audio: false }).then((stream) => {
            if (cancelled) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                void videoRef.current.play().catch(() => undefined);
            }
        }).catch((e) => {
            if (!cancelled)
                setError(cameraError(e));
        });
        return () => {
            cancelled = true;
            stop();
        };
    }, [open, attempt]);

    // Let the preview's object URL go with it.
    React.useEffect(() => () => {
        if (shot)
            URL.revokeObjectURL(shot.url);
    }, [shot]);

    // The clock while recording; recording stops itself at the limit.
    React.useEffect(() => {
        if (!recording)
            return;
        const started = Date.now();
        setSeconds(0);
        const t = window.setInterval(() => {
            const s = Math.floor((Date.now() - started) / 1000);
            setSeconds(Math.min(s, MAX_VIDEO_SECONDS));
            if (s >= MAX_VIDEO_SECONDS && recorderRef.current?.state === "recording")
                recorderRef.current.stop();
        }, 250);
        return () => window.clearInterval(t);
    }, [recording]);

    const close = React.useCallback(() => {
        setShot(null);
        onClose();
    }, [onClose]);

    React.useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                close();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, close]);

    function snap() {
        const video = videoRef.current;
        if (!video || !video.videoWidth)
            return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
            if (!blob)
                return setError("The camera couldn't start. Close other apps using it and try again.");
            const file = new File([blob], "site-photo.jpg", { type: "image/jpeg" });
            setShot({ file, url: URL.createObjectURL(file), kind: "photo" });
        }, "image/jpeg", 0.92);
    }

    function record() {
        const stream = streamRef.current;
        const type = recordingType();
        if (!stream || !type) {
            setError("This phone can't record video here. Take a photo instead.");
            return;
        }
        const chunks: Blob[] = [];
        // ~2.5 Mbit/s keeps 30 seconds near 10 MB, so it uploads on site signal.
        const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0)
                chunks.push(e.data);
        };
        recorder.onstop = () => {
            setRecording(false);
            if (discardRef.current || chunks.length === 0)
                return;
            const base = (recorder.mimeType || type).split(";")[0];
            const file = new File([new Blob(chunks, { type: base })], `site-video.${base === "video/mp4" ? "mp4" : "webm"}`, { type: base });
            setShot({ file, url: URL.createObjectURL(file), kind: "video" });
        };
        discardRef.current = false;
        recorderRef.current = recorder;
        recorder.start(1000);
        setRecording(true);
    }

    function stopRecording() {
        if (recorderRef.current?.state === "recording")
            recorderRef.current.stop();
    }

    function use() {
        if (!shot)
            return;
        const file = shot.file;
        close();
        onCapture(file);
    }

    if (!open)
        return null;
    return createPortal(<div role="dialog" aria-modal="true" aria-label="Take a site photo or video" className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1">
        <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} className={cn("absolute inset-0 size-full object-contain", shot && "invisible")}/>
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the photo just taken */}
        {shot?.kind === "photo" ? <img src={shot.url} alt="The photo you just took" className="absolute inset-0 size-full object-contain"/> : null}
        {shot?.kind === "video" ? <video src={shot.url} controls playsInline autoPlay muted loop aria-label="The video you just recorded" className="absolute inset-0 size-full object-contain"/> : null}
        {recording ? (<span className="absolute top-[max(1rem,env(safe-area-inset-top))] left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold tabular backdrop-blur-md" aria-live="polite">
            <span className="size-2.5 animate-pulse rounded-full bg-red-500" aria-hidden/>{clock(seconds)} / {clock(MAX_VIDEO_SECONDS)}
          </span>) : null}
        {error ? (<div className="absolute inset-0 grid place-items-center p-6">
            <div className="grid max-w-xs justify-items-center gap-4 text-center">
              <Camera className="size-8 text-white/70" aria-hidden/>
              <p role="alert" className="text-[15px] leading-relaxed">{error}</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cn("press h-11 cursor-pointer rounded-full bg-white px-5 text-sm font-semibold text-black", focusRing)}>Try again</button>
            </div>
          </div>) : null}
        <button type="button" onClick={close} aria-label="Close camera" className={cn(round, "absolute top-[max(1rem,env(safe-area-inset-top))] left-4")}><X className="size-5" aria-hidden/></button>
      </div>
      <div className="grid shrink-0 justify-items-center gap-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {allowVideo && !shot && !recording ? (<div role="radiogroup" aria-label="Capture" className="flex rounded-full bg-white/10 p-1 text-[13px] font-semibold">
            {(["photo", "video"] as const).map((m) => (<button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("cursor-pointer rounded-full px-4 py-1.5 capitalize transition-colors", mode === m ? "bg-white text-black" : "text-white/80", focusRing)}>{m}</button>))}
          </div>) : null}
        <div className="flex h-[88px] items-center justify-center gap-10">
          {shot ? (<>
              <button type="button" onClick={() => setShot(null)} className={cn("press flex h-12 cursor-pointer items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-semibold hover:bg-white/25", focusRing)}><RotateCcw className="size-4" aria-hidden/>Retake</button>
              <button type="button" onClick={use} className={cn("press flex h-12 cursor-pointer items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-hover", focusRing)}><Check className="size-4" aria-hidden/>{shot.kind === "video" ? "Use video" : "Use photo"}</button>
            </>) : mode === "video" ? (<button type="button" onClick={recording ? stopRecording : record} disabled={!ready || !!error} aria-label={recording ? "Stop recording" : "Start recording"} className={cn("press grid size-[72px] cursor-pointer place-items-center rounded-full border-4 border-white disabled:opacity-40", focusRing)}>
              <span className={cn("bg-red-500 transition-all duration-200", recording ? "size-7 rounded-md" : "size-[56px] rounded-full")}/>
            </button>) : (<button type="button" onClick={snap} disabled={!ready || !!error} aria-label="Take photo" className={cn("press grid size-[72px] cursor-pointer place-items-center rounded-full border-4 border-white disabled:opacity-40", focusRing)}>
              <span className="size-[56px] rounded-full bg-white"/>
            </button>)}
        </div>
      </div>
    </div>, document.body);
}
