import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const supportedLocales = ['ja', 'en', 'zh'];
const defaultLocale = 'ja';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get('locale')?.value || defaultLocale;
  
  // サポートされている言語かチェック
  const locale = supportedLocales.includes(requestedLocale) ? requestedLocale : defaultLocale;

  try {
    const messages = (await import(`./messages/${locale}.json`)).default;
    return {
      locale,
      messages
    };
  } catch (err) {
    console.error(`Failed to load messages for locale '${locale}', falling back to '${defaultLocale}'`, err);
    // フォールバック
    const fallbackMessages = (await import(`./messages/${defaultLocale}.json`)).default;
    return {
      locale: defaultLocale,
      messages: fallbackMessages
    };
  }
});