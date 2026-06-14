import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

export type ScannedReceiptItem = {
  rawToken: string;
  label: string;
  locked: boolean;
  confidence: number | null;
};

export type ScannedProduct = {
  items: ScannedReceiptItem[];
  store: { storeId: string | null; chain: string | null; locale: string } | null;
  receiptText: string | null;
};

type Props = {
  onScanned: (product: ScannedProduct) => void;
  onClose: () => void;
};

type Phase =
  | "receipt_scan"
  | "receipt_decoding"
  | "receipt_review"
  | "store_confirm"
  | "done";

export default function BarcodeScanner({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("receipt_scan");
  const [status, setStatus] = useState("Opening camera...");
  const [torchOn, setTorchOn] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const [scanResult, setScanResult] = useState<ScannedProduct | null>(null);

  const scanReceiptMutation = trpc.scanner.scanReceipt.useMutation();
  const submitVoteMutation = trpc.scanner.submitVote.useMutation();
  const confirmStoreMutation = trpc.scanner.confirmStore.useMutation();
  const knownStoresQuery = trpc.scanner.getKnownStores.useQuery(undefined, {
    enabled: phase === "store_confirm",
  });

  const isLive = phase === "receipt_scan";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setStatus("Camera access denied or unavailable");
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isLive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.5);
  };

  const handleCapture = async () => {
    const dataUrl = captureFrame();
    if (!dataUrl) {
      setStatus("Camera not ready");
      return;
    }

    setSnapshotUrl(dataUrl);
    stopCamera();
    setPhase("receipt_decoding");
    setStatus("Scanning receipt...");

    try {
      const result = await scanReceiptMutation.mutateAsync({ image: dataUrl });
      if (!result.success) {
        setStatus("Receipt scan failed");
        return;
      }

      const scanned: ScannedProduct = {
        items: result.items ?? [],
        store: result.store,
        receiptText: result.ocrText,
      };

      setScanResult(scanned);

      if (!result.store?.storeId) {
        setPhase("store_confirm");
        setStatus("Confirm the store");
        return;
      }

      setPhase("receipt_review");
      setStatus("Review items");
    } catch {
      setStatus("Scan failed");
    }
  };

  const handleConfirmStore = async (storeId: string, storeName: string, locale: string) => {
    try {
      await confirmStoreMutation.mutateAsync({ storeId, storeName, locale });
      setPhase("receipt_review");
      setStatus("Review items");
    } catch {
      setStatus("Failed to confirm store");
    }
  };

  const handleConfirmItem = async (rawToken: string, label: string) => {
    if (!scanResult?.store?.storeId) return;
    try {
      await submitVoteMutation.mutateAsync({
        storeId: scanResult.store.storeId,
        rawToken,
        label,
      });
    } catch {
      // silently fail
    }
  };

  const handleDone = () => {
    if (scanResult) {
      onScanned(scanResult);
      setPhase("done");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setStatus("Camera access denied or unavailable");
    }
  };

  const handleRetake = async () => {
    setSnapshotUrl(null);
    setVideoReady(false);
    setPhase("receipt_scan");
    setStatus("Opening camera...");
    await startCamera();
  };

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as Record<string, unknown>;
    if (capabilities.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as unknown as MediaTrackConstraints);
        setTorchOn(!torchOn);
      } catch {
        // torch not supported
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 z-10">
        <button onClick={onClose} className="text-white text-sm font-semibold">
          ✕ Close
        </button>
        <span className="text-white/60 text-xs">{status}</span>
        {isLive && (
          <button onClick={toggleTorch} className="text-white text-sm font-semibold">
            {torchOn ? "🔦 ON" : "🔦 OFF"}
          </button>
        )}
        {!isLive && <div className="w-12" />}
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {isLive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              setVideoReady(true);
              setStatus("Take a photo of the receipt");
            }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {snapshotUrl && (
          <img
            src={snapshotUrl}
            alt="Captured"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {isLive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/60 rounded-xl" />
          </div>
        )}

        {phase === "store_confirm" && scanResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 overflow-y-auto">
            <div className="text-white text-center p-6 max-w-sm w-full">
              <p className="text-xl font-bold mb-1">Store not recognized</p>
              <p className="text-sm text-white/60 mb-4">Pick or enter the store name</p>
              <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto">
                {knownStoresQuery.data?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleConfirmStore(s.id, s.name, s.locale)}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {s.name} ({s.id})
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const name = data.get("storeName") as string;
                  const locale = data.get("locale") as string;
                  const id = `${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${locale}`;
                  handleConfirmStore(id, name, locale);
                }}
                className="flex flex-col gap-2"
              >
                <input
                  name="storeName"
                  placeholder="Store name (e.g. Lidl)"
                  className="bg-white/10 text-white px-3 py-2 rounded text-sm"
                  required
                />
                <input
                  name="locale"
                  placeholder="Locale (e.g. it, us, de)"
                  className="bg-white/10 text-white px-3 py-2 rounded text-sm"
                  required
                  maxLength={8}
                />
                <button
                  type="submit"
                  className="bg-white text-black font-semibold px-6 py-2 rounded-full text-sm"
                >
                  Confirm store
                </button>
              </form>
              <button
                onClick={handleRetake}
                className="text-white/60 text-sm underline mt-4"
              >
                Retake photo
              </button>
            </div>
          </div>
        )}

        {phase === "receipt_review" && scanResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 overflow-y-auto">
            <div className="text-white p-6 max-w-sm w-full">
              <p className="text-lg font-bold mb-1">Review items</p>
              {scanResult.store && (
                <p className="text-xs text-white/40 mb-4">
                  Store: {scanResult.store.storeId ?? "Unknown"}
                </p>
              )}
              <div className="space-y-3 mb-6">
                {scanResult.items.map((item) => (
                  <div key={item.rawToken} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.rawToken}</p>
                      <p className="text-xs text-white/60 truncate">
                        {item.label}
                        {item.locked ? " 🔒" : item.confidence !== null ? ` (${Math.round(item.confidence * 100)}%)` : " (guess)"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleConfirmItem(item.rawToken, item.label)}
                      className="bg-green-600/80 hover:bg-green-600 text-white px-3 py-1 rounded text-xs shrink-0"
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleDone}
                  className="bg-white text-black font-semibold px-6 py-2 rounded-full text-sm"
                >
                  Done
                </button>
                <button
                  onClick={handleRetake}
                  className="text-white/60 text-sm underline"
                >
                  Retake photo
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "Camera access denied or unavailable" && isLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-white text-center p-6">
              <p className="text-lg font-semibold mb-2">Camera unavailable</p>
              <p className="text-sm text-white/60">Please grant camera permission or use a supported device.</p>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="p-6 flex flex-col items-center gap-3">
        {isLive && (
          <button
            onClick={handleCapture}
            disabled={!videoReady}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-40"
          >
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>
        )}
        {phase === "receipt_decoding" && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-white/60 text-sm">Scanning receipt...</span>
          </div>
        )}
        {isLive && videoReady && (
          <p className="text-white/60 text-xs">Take a photo of the full receipt</p>
        )}
        {isLive && !videoReady && (
          <p className="text-white/60 text-xs">Starting camera...</p>
        )}
      </div>
    </div>
  );
}
