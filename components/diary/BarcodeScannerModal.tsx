'use client';

import { useEffect, useRef, useState } from 'react';

export interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void | Promise<void>;
  isSubmitting: boolean;
}

/** Модальное окно: камера (BarcodeDetector) + ручной ввод штрихкода, как в diabalance. */
export default function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
  isSubmitting,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const hasDetectedRef = useRef(false);

  const [barcodeValue, setBarcodeValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCameraSupported] = useState(
    () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  );
  const [isBarcodeDetectorSupported, setIsBarcodeDetectorSupported] = useState(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window
  );
  const [isCameraLoading, setIsCameraLoading] = useState(
    () => isCameraSupported && isBarcodeDetectorSupported
  );

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    hasDetectedRef.current = false;
    setError(null);

    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setIsCameraLoading(false);

        const globalWindow = window as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => {
            detect: (
              source: HTMLVideoElement
            ) => Promise<Array<{ rawValue?: string; raw_value?: string }>>;
          };
        };

        const DetectorCtor = globalWindow.BarcodeDetector;
        if (!DetectorCtor || typeof DetectorCtor !== 'function') {
          setIsBarcodeDetectorSupported(false);
          return;
        }
        const detector = new DetectorCtor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
        });

        const scanFrame = async () => {
          if (cancelled || hasDetectedRef.current || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const value = String(
                barcodes[0].rawValue || (barcodes[0] as { raw_value?: string }).raw_value || ''
              ).trim();
              if (value) {
                hasDetectedRef.current = true;
                setBarcodeValue(value);
                setError(null);
                await onDetected(value);
                return;
              }
            }
          } catch {
            // игнорируем разовые ошибки детектора
          }
          frameRequestRef.current = window.requestAnimationFrame(scanFrame);
        };

        frameRequestRef.current = window.requestAnimationFrame(scanFrame);
      } catch (e) {
        console.error('Barcode scanner camera error:', e);
        setIsCameraLoading(false);
        setError(
          'Не удалось получить доступ к камере. Разрешите доступ в браузере или введите штрихкод вручную.'
        );
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (frameRequestRef.current != null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameRequestRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, onDetected, isBarcodeDetectorSupported, isCameraSupported]);

  const handleSubmit = async () => {
    const code = barcodeValue.trim();
    if (!code) return;
    setError(null);
    hasDetectedRef.current = true;
    await onDetected(code);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="barcode-modal-title"
          className="text-lg font-semibold text-gray-900 dark:text-white mb-3"
        >
          Сканировать штрихкод
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Наведите камеру на штрихкод продукта. Если камера недоступна, введите номер штрихкода
          вручную.
        </p>
        <div className="mb-4 space-y-2">
          {isCameraSupported && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              {isCameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="text-sm text-white">Загрузка камеры…</span>
                </div>
              )}
              {!isBarcodeDetectorSupported && (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2">
                  <p className="text-xs text-gray-100">
                    Ваш браузер не поддерживает автоматическое распознавание штрихкодов. Введите код
                    вручную.
                  </p>
                </div>
              )}
            </div>
          )}
          {!isCameraSupported && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Камера недоступна в этом устройстве или браузере. Используйте ручной ввод штрихкода.
            </p>
          )}
        </div>
        <div className="mb-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={barcodeValue}
            onChange={(e) => setBarcodeValue(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Например: 4601234567890"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!barcodeValue.trim() || isSubmitting}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Добавление...' : 'Добавить по штрихкоду'}
          </button>
        </div>
      </div>
    </div>
  );
}
