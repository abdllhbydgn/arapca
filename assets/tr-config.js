/* Çeviri servisi ayarları.
   MASRI_GEMINI.key boşken yapay zekâ çevirisi kapalıdır (yalnız hazır cümle bankası çalışır).
   Google Gemini ücretsiz kotası ile serbest cümle çevirisi ve erkek Mısır sesi için buraya aistudio.google.com anahtarı yazılır.
   Not: bu dosya herkese açıktır; anahtar yalnız bu sitenin adresinden çalışacak şekilde kısıtlanmalıdır. */
window.MASRI_TR_API = 'https://fragrant-leaf-0b86.abdllhbydgn.workers.dev';
window.MASRI_GEMINI = {
  key: '',
  models: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'],
  tts: ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'],
  voice: 'Charon'
};
