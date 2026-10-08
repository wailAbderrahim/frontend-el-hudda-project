import { API_URL } from "../../config/config.js";

// Guaranteed API base URL with fallback
const BASE_URL = (typeof API_URL !== 'undefined' && API_URL)
    ? API_URL.replace(/\/+$/, '')
    : 'https://el-hudda-project.onrender.com/api';

// UI Elements
const loadingEl = document.getElementById('verify-loading');
const successEl = document.getElementById('verify-success');
const successMsgEl = document.getElementById('verify-success-message');
const errorEl = document.getElementById('verify-error');
const errorMsgEl = document.getElementById('verify-error-message');

const resendSection = document.getElementById('resend-section');
const resendForm = document.getElementById('resend-form');
const resendEmail = document.getElementById('resend-email');
const resendButton = document.getElementById('resend-submit-btn');

const resendSuccessBox = document.getElementById('resend-success-box');
const resendSuccessMsg = document.getElementById('resend-success-message');
const resendErrorBox = document.getElementById('resend-error-box');
const resendErrorMsg = document.getElementById('resend-error-message');

/*
|--------------------------------------------------------------------------
| UI State Management
|--------------------------------------------------------------------------
*/

function showLoading() {
    loadingEl?.classList.remove('hidden');
    successEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');
}

function hideLoading() {
    loadingEl?.classList.add('hidden');
}

function showSuccess(msg) {
    hideLoading();
    errorEl?.classList.add('hidden');
    resendSection?.classList.add('hidden');

    if (successMsgEl) {
        successMsgEl.textContent = msg || 'تم تأكيد بريدك الإلكتروني بنجاح.';
    }
    successEl?.classList.remove('hidden');
}

function showError(msg) {
    hideLoading();
    successEl?.classList.add('hidden');

    if (errorMsgEl) {
        errorMsgEl.textContent = msg || 'تعذر تأكيد البريد الإلكتروني. يرجى المحاولة مرة أخرى.';
    }
    errorEl?.classList.remove('hidden');
    resendSection?.classList.remove('hidden');
}

function showResendNotice(msg) {
    hideLoading();
    successEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');

    resendSection?.classList.remove('hidden');
    if (resendSuccessBox && resendSuccessMsg) {
        resendSuccessMsg.textContent = msg;
        resendSuccessBox.classList.remove('hidden');
    }
}

function hideResendAlerts() {
    resendSuccessBox?.classList.add('hidden');
    resendErrorBox?.classList.add('hidden');
}

function showResendSuccess(msg) {
    if (resendSuccessBox && resendSuccessMsg) {
        resendSuccessMsg.textContent = msg;
        resendSuccessBox.classList.remove('hidden');
    }
    resendErrorBox?.classList.add('hidden');
}

function showResendError(msg) {
    if (resendErrorBox && resendErrorMsg) {
        resendErrorMsg.textContent = msg;
        resendErrorBox.classList.remove('hidden');
    }
    resendSuccessBox?.classList.add('hidden');
}

/*
|--------------------------------------------------------------------------
| Arabic Error Mapper
|--------------------------------------------------------------------------
*/

function mapArabicError(rawError) {
    if (!rawError) return 'حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.';

    const msg = String(rawError).toLowerCase();

    if (msg.includes('expired') || msg.includes('منته')) {
        return 'انتهت صلاحية رابط التفعيل (صلاحية الرابط 15 دقيقة فقط). يمكنك طلب رابط جديد أدناه.';
    }
    if (msg.includes('invalid') || msg.includes('غير صالح') || msg.includes('token')) {
        return 'رابط التفعيل غير صالح أو تم استخدامه مسبقاً. يمكنك طلب رابط جديد أدناه.';
    }
    if (msg.includes('already verified') || msg.includes('مفعل مسبقاً') || msg.includes('مسبقا')) {
        return 'تم تأكيد بريدك الإلكتروني مسبقاً بنجاح. يمكنك تسجيل الدخول مباشرة.';
    }
    if (msg.includes('not found') || msg.includes('not exist') || msg.includes('غير موجود')) {
        return 'لم يتم العثور على الحساب المرتبط بهذا البريد الإلكتروني.';
    }
    if (msg.includes('rate') || msg.includes('wait') || msg.includes('انتظار') || msg.includes('429')) {
        return 'يرجى الانتظار قليلاً قبل إعادة إرسال رابط التفعيل.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
        return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو المحاولة لاحقاً.';
    }

    return 'تعذر إتمام العملية في الوقت الحالي. يمكنك طلب رابط تفعيل جديد أدناه.';
}

/*
|--------------------------------------------------------------------------
| Safe Fetch with AbortController Timeout
|--------------------------------------------------------------------------
*/

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

/*
|--------------------------------------------------------------------------
| Email Verification Execution
|--------------------------------------------------------------------------
*/

async function runVerification(token, email) {
    showLoading();

    try {
        let url = `${BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
        if (email) {
            url += `&email=${encodeURIComponent(email)}`;
        }

        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        }, 25000);

        let data = {};
        try {
            data = await response.json();
        } catch (_) {
            data = {};
        }

        if (response.ok && data.success !== false) {
            const isAlready = data.code === 'ALREADY_VERIFIED';
            const msg = isAlready
                ? 'تم تأكيد بريدك الإلكتروني مسبقاً بنجاح. يمكنك الانتقال إلى تسجيل الدخول.'
                : (data.message || 'تم تأكيد بريدك الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول إلى حسابك.');
            showSuccess(msg);
            return;
        }

        // Handle specific business codes
        const code = data.code || '';
        const serverMsg = data.message || '';

        if (code === 'ALREADY_VERIFIED') {
            showSuccess('تم تأكيد بريدك الإلكتروني مسبقاً بنجاح. يمكنك الانتقال إلى تسجيل الدخول.');
            return;
        }

        if (code === 'VERIFICATION_TOKEN_EXPIRED') {
            showError('انتهت صلاحية رابط التفعيل (صلاحية الرابط 15 دقيقة فقط). يمكنك طلب رابط جديد أدناه.');
            return;
        }

        if (code === 'INVALID_VERIFICATION_TOKEN') {
            showError('رابط التفعيل غير صالح أو تم استخدامه مسبقاً. يمكنك طلب رابط جديد أدناه.');
            return;
        }

        if (code === 'TOKEN_REQUIRED') {
            showError('رابط التفعيل غير مكتمل أو ناقص. يمكنك طلب رابط جديد أدناه.');
            return;
        }

        showError(mapArabicError(serverMsg || code));

    } catch (err) {
        console.error('Email verification error:', err);

        if (err.name === 'AbortError') {
            showError('استغرق الاتصال بالخادم وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى أو طلب رابط جديد.');
        } else if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
            showError('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو المحاولة لاحقاً.');
        } else {
            showError('حدث خطأ أثناء محاولة تأكيد الحساب. يرجى طلب رابط تفعيل جديد أدناه.');
        }
    } finally {
        hideLoading();
    }
}

/*
|--------------------------------------------------------------------------
| Resend Form Handler
|--------------------------------------------------------------------------
*/

if (resendForm) {
    resendForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailVal = (resendEmail?.value || '').trim().toLowerCase();
        if (!emailVal) {
            showResendError('يرجى إدخال البريد الإلكتروني.');
            return;
        }

        const originalBtnText = resendButton ? resendButton.textContent : 'إعادة إرسال رابط التفعيل';
        if (resendButton) {
            resendButton.disabled = true;
            resendButton.textContent = 'جاري الإرسال...';
        }

        hideResendAlerts();

        try {
            const url = `${BASE_URL}/auth/resend-verification`;
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email: emailVal })
            }, 25000);

            let data = {};
            try {
                data = await response.json();
            } catch (_) {
                data = {};
            }

            if (response.ok && data.success !== false) {
                if (data.isAlreadyVerified || data.code === 'ALREADY_VERIFIED') {
                    showResendSuccess('هذا البريد الإلكتروني مفعّل مسبقاً. يمكنك تسجيل الدخول مباشرة.');
                } else {
                    showResendSuccess(data.message || 'تم إرسال رابط تفعيل جديد إلى بريدك الإلكتروني. الرابط صالح لمدة 15 دقيقة.');
                }

                // Start 60-second cooldown timer
                let cooldown = 60;
                if (resendButton) {
                    resendButton.disabled = true;
                    resendButton.textContent = `إعادة الإرسال بعد (${cooldown}) ثانية`;
                    const timer = setInterval(() => {
                        cooldown--;
                        if (cooldown > 0) {
                            resendButton.textContent = `إعادة الإرسال بعد (${cooldown}) ثانية`;
                        } else {
                            clearInterval(timer);
                            resendButton.disabled = false;
                            resendButton.textContent = originalBtnText;
                        }
                    }, 1000);
                }
                return;
            }

            // Server-side error
            if (response.status === 429) {
                showResendError(data.message || 'يرجى الانتظار قليلاً قبل إعادة إرسال رابط التفعيل.');
            } else {
                showResendError(mapArabicError(data.message || data.code));
            }
        } catch (err) {
            console.error('Resend verification error:', err);
            if (err.name === 'AbortError') {
                showResendError('استغرق إرسال البريد وقتاً أطول من المتوقع. يرجى المحاولة بعد قليل.');
            } else {
                showResendError('تعذر الاتصال بالخادم لإعادة إرسال الرابط. يرجى المحاولة لاحقاً.');
            }
        } finally {
            if (resendButton && !resendButton.textContent.includes('ثانية')) {
                resendButton.disabled = false;
                resendButton.textContent = originalBtnText;
            }
        }
    });
}

/*
|--------------------------------------------------------------------------
| Initialization (Guaranteed to execute immediately)
|--------------------------------------------------------------------------
*/

function init() {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get('token') || '').trim();
    const email = (params.get('email') || '').trim();

    // Pre-fill email field in resend form if available in URL
    if (email && resendEmail) {
        resendEmail.value = email;
    }

    if (!token) {
        hideLoading();
        if (email) {
            // User arrived from registration redirect without a token
            showResendNotice('تم إرسال رابط تفعيل الحساب إلى بريدك الإلكتروني. يرجى مراجعة صندوق الوارد (أو مجلد الرسائل غير المرغوب فيها). إذا لم يصلك الرابط، يمكنك طلب رابط جديد أدناه.');
        } else {
            showError('رابط التفعيل غير مكتمل أو ناقص. يمكنك طلب رابط تفعيل جديد أدناه.');
        }
        return;
    }

    // Token exists: run verification
    runVerification(token, email);
}

// Safely execute whether DOM is already loaded or still loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}