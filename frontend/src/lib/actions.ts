'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function setLocale(locale: string) {
  const supportedLocales = ['ja', 'en', 'zh'];
  
  if (!supportedLocales.includes(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1年
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  // ページをリダイレクトして言語変更を反映
  redirect('/');
}