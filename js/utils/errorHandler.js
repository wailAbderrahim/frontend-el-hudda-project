/**
 * Centralized Arabic Error Mapping System for El-Hudda Quran School
 * Prevents raw technical messages, database errors, or stack traces from reaching users.
 */

export const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    EMAIL_NOT_VERIFIED: "لم يتم تأكيد بريدك الإلكتروني بعد.",
    ACCOUNT_INACTIVE: "حسابك غير مفعل حاليًا. يرجى التواصل مع الإدارة.",
    ACCOUNT_DISABLED: "حسابك غير مفعل حاليًا. يرجى التواصل مع الإدارة.",
    EMAIL_ALREADY_EXISTS: "هذا البريد الإلكتروني مستخدم بالفعل.",
    INVALID_VERIFICATION_TOKEN: "رابط التحقق غير صالح. يمكنك طلب رابط تحقق جديد.",
    VERIFICATION_TOKEN_EXPIRED: "انتهت صلاحية رابط التحقق. يمكنك طلب رابط تحقق جديد.",
    ALREADY_VERIFIED: "تم تأكيد بريدك الإلكتروني مسبقًا. يمكنك تسجيل الدخول.",
    INVALID_INPUT: "يرجى التأكد من صحة البيانات المدخلة ومطابقتها للشروط.",
    TOKEN_REQUIRED: "رابط التحقق غير صالح أو ناقص.",
    MISSING_TOKEN: "رابط التحقق غير صالح أو ناقص.",
    INVALID_TOKEN: "رابط الاستعادة غير صالح أو منتهي الصلاحية.",
    TOKEN_EXPIRED: "انتهت صلاحية الرابط. يرجى طلب رابط جديد.",
    NETWORK_ERROR: "تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو المحاولة لاحقاً.",
    SERVER_ERROR: "حدث خطأ غير متوقع في الخادم. حاول مرة أخرى لاحقاً.",
    RATE_LIMITED: "يرجى الانتظار قليلاً قبل إعادة إرسال الرابط.",
    PASSWORD_TOO_SHORT: "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
    PASSWORDS_DONT_MATCH: "كلمتا المرور غير متطابقتين.",
    UNKNOWN_ERROR: "حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى."
};

/**
 * Translates any error object, code, or technical message into a friendly Arabic message.
 * @param {Error|Object|string} error 
 * @returns {string} User-facing Arabic message
 */
export function getArabicErrorMessage(error) {
    if (!error) return ERROR_MESSAGES.UNKNOWN_ERROR;

    // If a direct string error code was passed
    if (typeof error === 'string') {
        return ERROR_MESSAGES[error] || ERROR_MESSAGES.UNKNOWN_ERROR;
    }

    // 1. Direct code lookup on the error object
    const code = error.code || (error.data && error.data.code);
    if (code && ERROR_MESSAGES[code]) {
        return ERROR_MESSAGES[code];
    }

    // 2. Specific HTTP status code mappings
    if (error.status === 0 || error.code === 'NETWORK_ERROR') {
        return ERROR_MESSAGES.NETWORK_ERROR;
    }

    if (error.status === 429) {
        if (error.message && error.message.includes('ثانية')) {
            return error.message;
        }
        return ERROR_MESSAGES.RATE_LIMITED;
    }

    if (error.status === 403) {
        if (error.isUnverified || code === 'EMAIL_NOT_VERIFIED') {
            return ERROR_MESSAGES.EMAIL_NOT_VERIFIED;
        }
        return ERROR_MESSAGES.ACCOUNT_INACTIVE;
    }

    // 3. Fallback matching against known technical message patterns
    const msg = (error.message || '').toLowerCase();

    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to connect')) {
        return ERROR_MESSAGES.NETWORK_ERROR;
    }

    if (msg.includes('invalid email or password') || msg.includes('credentials') || msg.includes('غير صحيحة') || msg.includes('not exist')) {
        return ERROR_MESSAGES.INVALID_CREDENTIALS;
    }

    if (msg.includes('verify') || msg.includes('تفعيل') || msg.includes('unverified')) {
        return ERROR_MESSAGES.EMAIL_NOT_VERIFIED;
    }

    if (msg.includes('disabled') || msg.includes('deactivated') || msg.includes('معطّل') || msg.includes('غير مفعل')) {
        return ERROR_MESSAGES.ACCOUNT_INACTIVE;
    }

    if (msg.includes('already exist') || msg.includes('duplicate key') || msg.includes('e11000') || msg.includes('موجود مسبقاً') || msg.includes('مستخدم بالفعل')) {
        return ERROR_MESSAGES.EMAIL_ALREADY_EXISTS;
    }

    if (msg.includes('expired') || msg.includes('منتهي')) {
        return ERROR_MESSAGES.VERIFICATION_TOKEN_EXPIRED;
    }

    if (msg.includes('token') && (msg.includes('invalid') || msg.includes('غير صالح'))) {
        return ERROR_MESSAGES.INVALID_VERIFICATION_TOKEN;
    }

    if (msg.includes('already verified') || msg.includes('مفعّل مسبقاً')) {
        return ERROR_MESSAGES.ALREADY_VERIFIED;
    }

    if (msg.includes('required') || msg.includes('all fields') || msg.includes('مطلوب')) {
        return ERROR_MESSAGES.INVALID_INPUT;
    }

    if (error.status >= 500) {
        return ERROR_MESSAGES.SERVER_ERROR;
    }

    // Default safe message - NEVER expose raw technical error/stack
    return ERROR_MESSAGES.UNKNOWN_ERROR;
}
