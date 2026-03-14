'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  /** Если передан, показывается ссылка «Ввести вручную» */
  onManualEntry?: () => void;
}

/** Модальное окно со сканером штрихкода и QR-кода через камеру (html5-qrcode). */
export default function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
  onManualEntry,
}: BarcodeScannerModalProps) {
  const scopeId = useId().replace(/:/g, '-');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void | Promise<void> } | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
      const clearResult = scanner.clear();
      if (clearResult instanceof Promise) await clearResult;
    } catch {
      // ignore
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setIsStarting(true);

    let cancelled = false;

    const run = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        const element = document.getElementById(scopeId);
        if (!element || cancelled) return;

        const html5QrCode = new Html5Qrcode(scopeId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
          useBarCodeDetectorIfSupported: false,
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.75);
          return { width: size, height: size };
        };

        const config = {
          fps: 10,
          qrbox: qrboxFunction,
          aspectRatio: 1.777778,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText: string) => {
            if (cancelled) return;
            stopScanner().then(() => {
              onDetected(decodedText.trim());
              onClose();
            });
          },
          () => {
            // Ошибки сканирования (не нашли код) — игнорируем, сканер продолжает
          }
        );

        if (cancelled) await stopScanner();
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Не удалось запустить камеру';
        setError(
          message.includes('NotAllowedError') || message.includes('Permission')
            ? 'Доступ к камере запрещён. Разрешите в настройках браузера.'
            : 'Не удалось открыть камеру. Проверьте разрешения.'
        );
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    };

    run();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, scopeId, onDetected, onClose, stopScanner]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <div className="w-full max-w-md flex flex-col gap-4">
        <h2
          id="barcode-scanner-title"
          className="text-center text-lg font-semibold text-white"
        >
          Наведите камеру на штрихкод или QR-код
        </h2>

        <div
          id={scopeId}
          className="overflow-hidden rounded-lg bg-black min-h-[280px] w-full aspect-video"
        />

        {isStarting && (
          <p className="text-center text-sm text-gray-300">
            Запуск камеры…
          </p>
        )}

        {error && (
          <p className="text-center text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="min-h-[44px] w-full rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-500 transition-colors touch-manipulation"
          >
            Отмена
          </button>
          {onManualEntry && (
            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
                onManualEntry();
              }}
              className="min-h-[44px] text-sm text-gray-300 hover:text-white underline underline-offset-2 touch-manipulation"
            >
              Ввести вручную
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
