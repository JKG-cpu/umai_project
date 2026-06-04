import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

export type ScannedProduct = {
  productName: string | null;
  brands: string | null;
  quantity: string | null;
  categories: string | null;
  barcode: string;
  expirationDate: string | null;
};

type Props = {
  onScanned: (product: ScannedProduct) => void;
  onClose: () => void;
};

type Phase =
  | "product_scan"
  | "product_decoding"
  | "product_no_barcode"
  | "product_unknown"
  | "expiry_scan"
  | "expiry_decoding"
  | "expiry_no_barcode"
  | "done";

export default function BarcodeScanner({ onScanned, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("product_scan");
  const [status, setStatus] = useState("Opening camera...");
  const [torchOn, setTorchOn] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const [productData, setProductData] = useState<ScannedProduct | null>(null);

  const scanProductMutation = trpc.scanner.scanProduct.useMutation();
  const scanExpiryMutation = trpc.scanner.scanExpiry.useMutation();

  const isProductPhase = phase === "product_scan" || phase === "product_decoding" || phase === "product_no_barcode" || phase === "product_unknown";
  const isExpiryPhase = phase === "expiry_scan" || phase === "expiry_decoding" || phase === "expiry_no_barcode";
  const isLive = phase === "product_scan" || phase === "expiry_scan";

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
  }, [isProductPhase, isExpiryPhase]);

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

    if (isProductPhase) {
      setPhase("product_decoding");
      setStatus("Scanning barcode...");

      try {
        const result = await scanProductMutation.mutateAsync({ image: dataUrl });
        if (!result.success) {
          setPhase("product_no_barcode");
          setStatus("No barcode found");
          return;
        }

        const scanned: ScannedProduct = {
          productName: result.productName ?? null,
          brands: result.brands ?? null,
          quantity: result.quantity ?? null,
          categories: result.categories ?? null,
          barcode: result.barcode ?? "",
          expirationDate: result.expirationDate ?? null,
        };

        if (!scanned.productName) {
          setProductData(scanned);
          setPhase("product_unknown");
          setStatus("Product not found");
          setSnapshotUrl(null);
          setVideoReady(false);
          return;
        }

        if (scanned.expirationDate) {
          setStatus("Expiry found!");
          await new Promise((r) => setTimeout(r, 500));
          onScanned(scanned);
          setPhase("done");
          return;
        }

        setProductData(scanned);
        setPhase("expiry_scan");
        setStatus("Now scan the expiry date");
        setSnapshotUrl(null);
        setVideoReady(false);
      } catch {
        setPhase("product_no_barcode");
        setStatus("Scan failed");
      }
    } else if (isExpiryPhase) {
      setPhase("expiry_decoding");
      setStatus("Scanning expiry date...");

      try {
        const result = await scanExpiryMutation.mutateAsync({ image: dataUrl });
        if (result.success && result.expirationDate) {
          setStatus("Expiry found!");
          await new Promise((r) => setTimeout(r, 500));
          onScanned({
            ...productData!,
            expirationDate: result.expirationDate,
          });
          setPhase("done");
          return;
        }

        setPhase("expiry_no_barcode");
        setStatus("No expiry date found");
      } catch {
        setPhase("expiry_no_barcode");
        setStatus("Expiry scan failed");
      }
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

    if (phase === "product_unknown" || phase === "product_no_barcode") {
      setPhase("product_scan");
      setStatus("Opening camera...");
    } else if (isExpiryPhase) {
      setPhase("expiry_scan");
      setStatus("Scan the expiry date...");
    } else {
      setPhase("product_scan");
      setStatus("Opening camera...");
    }

    await startCamera();
  };

  const handleEnterManually = () => {
    stopCamera();
    onScanned({
      productName: null,
      brands: null,
      quantity: null,
      categories: null,
      barcode: productData?.barcode ?? "",
      expirationDate: null,
    });
    setPhase("done");
  };

  const handleSkipExpiry = () => {
    if (productData) {
      onScanned(productData);
      setPhase("done");
    }
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

  const stepLabel = isExpiryPhase ? "Step 2/2" : "Step 1/2";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 z-10">
        <button onClick={onClose} className="text-white text-sm font-semibold">
          ✕ Close
        </button>
        <span className="text-white/60 text-xs">{isExpiryPhase ? stepLabel : ""} {status}</span>
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
              setStatus(isProductPhase ? "Ready" : "Scan the expiry date");
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
        {(phase === "product_scan" || phase === "expiry_scan") && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-white/60 rounded-xl">
              {isExpiryPhase && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                  Scan Expiry
                </div>
              )}
            </div>
          </div>
        )}
        {phase === "product_unknown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-white text-center p-6">
              <p className="text-xl font-bold mb-1">Barcode recognized</p>
              <p className="text-sm text-white/60 mb-4">Product not found in database. Please enter the name manually.</p>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleEnterManually}
                  className="bg-white text-black font-semibold px-6 py-2 rounded-full"
                >
                  Enter name manually
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
        {(phase === "product_no_barcode" || phase === "expiry_no_barcode") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-white text-center p-6">
              <p className="text-xl font-bold mb-1">
                {phase === "product_no_barcode" ? "No barcode found" : "No expiry date found"}
              </p>
              <p className="text-sm text-white/60 mb-4">
                {phase === "product_no_barcode"
                  ? "Make sure the barcode is clearly visible and try again"
                  : "Try scanning a barcode or QR code with the expiry date"}
              </p>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleRetake}
                  className="bg-white text-black font-semibold px-6 py-2 rounded-full"
                >
                  Retake
                </button>
                {phase === "product_no_barcode" && (
                  <button
                    onClick={handleEnterManually}
                    className="text-white/60 text-sm underline"
                  >
                    Enter name manually
                  </button>
                )}
                {phase === "expiry_no_barcode" && (
                  <button
                    onClick={handleSkipExpiry}
                    className="text-white/60 text-sm underline"
                  >
                    Skip — enter manually
                  </button>
                )}
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
        {(phase === "product_decoding" || phase === "expiry_decoding") && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-white/60 text-sm">
              {phase === "product_decoding" ? "Scanning barcode..." : "Scanning expiry date..."}
            </span>
          </div>
        )}
        {isLive && videoReady && (
          <p className="text-white/60 text-xs">
            {isExpiryPhase
              ? "Take a photo of the barcode containing the expiry date"
              : "Take a photo of the product barcode"}
          </p>
        )}
        {isLive && !videoReady && (
          <p className="text-white/60 text-xs">Starting camera...</p>
        )}
        {isExpiryPhase && isLive && (
          <button
            onClick={handleSkipExpiry}
            className="text-white/40 text-xs underline"
          >
            Skip — enter expiry date manually
          </button>
        )}
      </div>
    </div>
  );
}
