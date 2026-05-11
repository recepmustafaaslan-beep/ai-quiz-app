/**
 * Production quiz pipeline: error codes + kullanıcı dostu mesajlar (TR).
 */

export const QuizErrorCode = {
  PDF_INVALID: "PDF_INVALID",
  PDF_EMPTY: "PDF_EMPTY",
  PDF_TEXT_TOO_SHORT: "PDF_TEXT_TOO_SHORT",
  PDF_READ_FAILED: "PDF_READ_FAILED",
  PDF_TOO_LARGE: "PDF_TOO_LARGE",
  QUIZ_TEXT_TOO_LONG: "QUIZ_TEXT_TOO_LONG",
  NETWORK: "NETWORK",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  API_BAD_RESPONSE: "API_BAD_RESPONSE",
  API_JSON_PARSE: "API_JSON_PARSE",
  BODY_INVALID: "BODY_INVALID",
  SERVER_CONFIG: "SERVER_CONFIG",
  OPENAI_AUTH: "OPENAI_AUTH",
  OPENAI_RATE_LIMIT: "OPENAI_RATE_LIMIT",
  OPENAI_QUOTA: "OPENAI_QUOTA",
  OPENAI_TIMEOUT: "OPENAI_TIMEOUT",
  OPENAI_SERVER: "OPENAI_SERVER",
  OPENAI_UNKNOWN: "OPENAI_UNKNOWN",
  MODEL_JSON_INVALID: "MODEL_JSON_INVALID",
  MODEL_EMPTY: "MODEL_EMPTY",
  MODEL_SHAPE_INVALID: "MODEL_SHAPE_INVALID",
  CLIENT_UNEXPECTED: "CLIENT_UNEXPECTED",
} as const;

export type QuizErrorCodeType = (typeof QuizErrorCode)[keyof typeof QuizErrorCode];

const MESSAGES: Record<QuizErrorCodeType, string> = {
  [QuizErrorCode.PDF_INVALID]:
    "Bu dosya geçerli bir PDF olarak açılamadı. Dosyanın bozuk olmadığından ve şifre korumasız olduğundan emin olun.",
  [QuizErrorCode.PDF_EMPTY]:
    "PDF içinden metin çıkarılamadı (boş veya yalnızca görüntü olabilir). Metin içeren bir ders notu deneyin.",
  [QuizErrorCode.PDF_TEXT_TOO_SHORT]:
    "Çıkarılan metin çok kısa; quiz üretmek için yeterli içerik yok. Daha zengin metinli bir PDF yükleyin.",
  [QuizErrorCode.PDF_READ_FAILED]:
    "Dosya okunurken bir sorun oluştu. Dosyayı tekrar seçmeyi veya başka bir PDF denemeyi deneyin.",
  [QuizErrorCode.PDF_TOO_LARGE]:
    "Dosya boyutu çok büyük. En fazla 25 MB boyutunda PDF yükleyebilirsiniz.",
  [QuizErrorCode.QUIZ_TEXT_TOO_LONG]:
    "Çıkarılan metin çok uzun. Daha kısa bir PDF veya tek ders notu bölümü yükleyin.",
  [QuizErrorCode.NETWORK]:
    "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  [QuizErrorCode.REQUEST_TIMEOUT]:
    "İşlem zaman aşımına uğradı. Sunucu yoğun olabilir; bir süre sonra tekrar deneyin.",
  [QuizErrorCode.API_BAD_RESPONSE]:
    "Sunucudan beklenmeyen bir yanıt alındı. Lütfen tekrar deneyin.",
  [QuizErrorCode.API_JSON_PARSE]:
    "Sunucu yanıtı işlenemedi. Lütfen tekrar deneyin.",
  [QuizErrorCode.BODY_INVALID]:
    "İstek geçersiz. Sayfayı yenileyip tekrar deneyin.",
  [QuizErrorCode.SERVER_CONFIG]:
    "Sunucu yapılandırması eksik. Yöneticiyle iletişime geçin.",
  [QuizErrorCode.OPENAI_AUTH]:
    "Yapay zeka servisi kimlik doğrulaması başarısız. API anahtarınızı kontrol edin.",
  [QuizErrorCode.OPENAI_RATE_LIMIT]:
    "Çok fazla istek gönderildi. Birkaç dakika bekleyip tekrar deneyin.",
  [QuizErrorCode.OPENAI_QUOTA]:
    "Yapay zeka kullanım kotası aşıldı veya ödeme gerekli. Hesap limitlerinizi kontrol edin.",
  [QuizErrorCode.OPENAI_TIMEOUT]:
    "Yapay zeka yanıtı zaman aşımına uğradı. Tekrar deneyin.",
  [QuizErrorCode.OPENAI_SERVER]:
    "Yapay zeka servisi geçici olarak kullanılamıyor. Daha sonra tekrar deneyin.",
  [QuizErrorCode.OPENAI_UNKNOWN]:
    "Quiz üretilirken beklenmeyen bir hata oluştu. Tekrar deneyin.",
  [QuizErrorCode.MODEL_JSON_INVALID]:
    "Model çıktısı biçim hatası verdi. Tekrar üretmeyi deneyin.",
  [QuizErrorCode.MODEL_EMPTY]:
    "Model boş yanıt döndürdü. Tekrar deneyin.",
  [QuizErrorCode.MODEL_SHAPE_INVALID]:
    "Model beklenen soru sayısı veya zorluk dağılımını üretemedi. Tekrar deneyin.",
  [QuizErrorCode.CLIENT_UNEXPECTED]:
    "Beklenmeyen bir hata oluştu. Sayfayı yenileyip tekrar deneyin.",
};

export function getQuizUserMessage(code: QuizErrorCodeType): string {
  return MESSAGES[code] ?? MESSAGES[QuizErrorCode.OPENAI_UNKNOWN];
}

export function isQuizErrorCode(value: string): value is QuizErrorCodeType {
  return Object.values(QuizErrorCode).includes(value as QuizErrorCodeType);
}

/** Sunucu ve istemci tarafinda ayni esikler */
export const QUIZ_TEXT_LIMITS = {
  minChars: 80,
  maxChars: 120_000,
} as const;

export const QUIZ_UPLOAD_LIMITS = {
  maxFileBytes: 25 * 1024 * 1024,
} as const;

/** pdf.js / tarayıcı hatalarından PDF_INVALID tahmini */
export function isLikelyInvalidPdfError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("invalid pdf") ||
    m.includes("password") ||
    m.includes("encrypted") ||
    m.includes("xref") ||
    m.includes("pdf structure") ||
    m.includes("invalidpdfexception")
  );
}

export function isLikelyTimeoutError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("timeout") || m.includes("timed out") || m.includes("aborted") || m.includes("abort");
}
