import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';

// На сервере ТСПУ блокирует IPv4 к api.telegram.org, но IPv6 работает.
// Node/axios по умолчанию может выбрать IPv4 → запрос висит/падает.
// Поэтому к Telegram ходим принудительно через IPv6, с фоллбэком на обычный резолв.
const ipv6Agent = new https.Agent({ family: 6, keepAlive: true });

/**
 * POST к Telegram Bot API. method — например 'sendMessage'.
 * Сначала пробует IPv6, при сетевой ошибке — обычный резолв.
 */
export async function tgPost(method: string, data: any, config: AxiosRequestConfig = {}) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN не задан');
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const base: AxiosRequestConfig = { timeout: 10000, ...config };
  try {
    return await axios.post(url, data, { ...base, httpsAgent: ipv6Agent });
  } catch (e: any) {
    const code = e?.code || '';
    // Если IPv6 недоступен в этом окружении — пробуем обычный резолв
    if (['ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'EADDRNOTAVAIL'].includes(code)) {
      return await axios.post(url, data, base);
    }
    throw e;
  }
}

export async function tgGet(method: string, config: AxiosRequestConfig = {}) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN не задан');
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const base: AxiosRequestConfig = { timeout: 10000, ...config };
  try {
    return await axios.get(url, { ...base, httpsAgent: ipv6Agent });
  } catch (e: any) {
    const code = e?.code || '';
    if (['ENETUNREACH', 'EAI_AGAIN', 'ENOTFOUND', 'EADDRNOTAVAIL'].includes(code)) {
      return await axios.get(url, base);
    }
    throw e;
  }
}
