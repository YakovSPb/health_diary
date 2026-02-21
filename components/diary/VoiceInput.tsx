'use client';

import { useEffect, useRef, useState } from 'react';

interface VoiceInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
}

// Проверяем поддержку Web Speech API
const isSpeechRecognitionSupported = () => {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

export default function VoiceInput({ onResult, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  useEffect(() => {
    if (!isSupported || typeof window === 'undefined') return;

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
      setError(null);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      
      // Обработка различных типов ошибок
      let errorMessage = 'Ошибка распознавания речи';
      
      switch (event.error) {
        case 'network':
          errorMessage = 'Нет подключения к сервису распознавания. Проверьте интернет-соединение.';
          break;
        case 'not-allowed':
        case 'permission-denied':
          errorMessage = 'Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.';
          break;
        case 'no-speech':
          errorMessage = 'Речь не обнаружена. Попробуйте ещё раз.';
          break;
        case 'audio-capture':
          errorMessage = 'Микрофон не найден или не работает.';
          break;
        case 'aborted':
          // Прерывание пользователем - не показываем ошибку
          return;
        default:
          errorMessage = `Ошибка: ${event.error}`;
      }
      
      setError(errorMessage);
      
      // Автоматически скрыть ошибку через 5 секунд
      setTimeout(() => setError(null), 5000);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isSupported, onResult]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        setError(null);
        recognitionRef.current.start();
      } catch (error) {
        // Показываем ошибку в UI вместо консоли
        setError('Не удалось запустить распознавание речи');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      onResult(textInput.trim());
      setTextInput('');
      setShowTextInput(false);
    }
  };

  if (showTextInput) {
    return (
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleTextSubmit();
            }
          }}
          placeholder="Например: 150г яблока"
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          autoFocus
        />
        <button
          onClick={handleTextSubmit}
          disabled={!textInput.trim()}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          Добавить
        </button>
        <button
          onClick={() => {
            setShowTextInput(false);
            setTextInput('');
          }}
          className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-lg transition-colors"
        >
          Отмена
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Сообщение об ошибке */}
      {error && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <svg
            className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => setShowTextInput(true)}
              className="mt-1 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
            >
              Использовать текстовый ввод
            </button>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Кнопки ввода */}
      <div className="flex items-center space-x-2">
        {isSupported && (
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={disabled}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white disabled:bg-gray-400 disabled:cursor-not-allowed`}
            title="Голосовой ввод (требуется интернет)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        )}
        
        <button
          onClick={() => setShowTextInput(true)}
          disabled={disabled}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
