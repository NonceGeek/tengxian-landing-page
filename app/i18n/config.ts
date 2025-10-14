export const defaultLocale = 'en';
export const locales = ['en', 'zh'] as const;
export type Locale = typeof locales[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

// 语言检测配置
export const localeDetection = {
  cookieName: 'NEXT_LOCALE',
  defaultLocale,
  locales,
  localeDetection: true
}; 