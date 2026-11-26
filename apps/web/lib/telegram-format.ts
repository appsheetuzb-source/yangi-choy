// Telegram bot sozlamasi formatlari — server (lib/telegram-server.ts, /api/sheets) va forma (Foydalanuvchilar) uchun umumiy.

/** Bot token formati (BotFather beradi: "123456789:AAH..."). URL yo'liga qo'yiladi — qat'iy tekshiriladi */
export const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/;
/** Chat ID: raqam (guruh/kanal manfiy, -100...) yoki ochiq kanal nomi (@kanal) */
export const CHAT_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{3,64})$/;
