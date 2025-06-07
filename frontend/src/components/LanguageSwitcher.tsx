'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { setLocale } from '@/lib/actions';

const SUPPORTED_LOCALES = [
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' }
];

export const LanguageSwitcher: React.FC = () => {
  const t = useTranslations('languages');
  const currentLocale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ハイドレーションエラーを防ぐため、マウント前は何も表示しない
  if (!isMounted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700">
        <span className="text-lg">🇯🇵</span>
        <span>日本語</span>
      </div>
    );
  }

  const changeLanguage = (locale: string) => {
    setIsOpen(false);
    startTransition(() => {
      setLocale(locale);
    });
  };

  const currentLanguage = SUPPORTED_LOCALES.find(lang => lang.code === currentLocale) || SUPPORTED_LOCALES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        aria-label="言語を選択"
      >
        <span className="text-lg">{currentLanguage.flag}</span>
        <span>{t(currentLocale)}</span>
        {isPending ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        ) : (
          <svg 
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[160px] z-20">
            {SUPPORTED_LOCALES.map((locale) => (
              <button
                key={locale.code}
                onClick={() => changeLanguage(locale.code)}
                disabled={isPending}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors disabled:opacity-50 ${
                  locale.code === currentLocale ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span className="text-lg">{locale.flag}</span>
                <span>{t(locale.code)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};