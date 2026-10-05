import { verifyEmail, resendVerification } from "../../api/authApi.js";
import { getArabicErrorMessage } from "../../utils/errorHandler.js";

const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const emailParam = params.get('email');

const verifyLoading = document.getElementById('verify-loading');
const verifySuccess = document.getElementById('verify-success');
const verifySuccessMessage = document.getElementById('verify-success-message');
const verifyErr = document.getElementById('verify-error');
const verifyErrorMessage = document.getElementById('verify-error-message');

const resendSection = document.getElementById('resend-section');
const resendForm = document.getElementById('resend-form');
const resendEmailInput = document.getElementById('resend-email');
const resendSubmitBtn = document.getElementById('resend-submit-btn');
const resendSuccessBox = document.getElementById('resend-success-box');
const resendSuccessMessage = document.getElementById('resend-success-message');
const resendErrorBox = document.getElementById('resend-error-box');
const resendErrorMessage = document.getElementById('resend-error-message');

// Pre-fill email input if passed in URL
if (emailParam && resendEmailInput) {
    resendEmailInput.value = emailParam.trim();
}

// Initial mode determination
if (token && token.trim()) {
    // Mode A: Token verification
    verifyLoading?.classList.remove('hidden');
    verifySuccess?.classList.add('hidden');
    verifyErr?.classList.add('hidden');
    resendSection?.classList.add('hidden');
    verify(token.trim());
} else if (emailParam) {
    // Mode B: Dedicated Resend Verification Page (email provided, no token)
    verifyLoading?.classList.add('hidden');
    verifySuccess?.classList.add('hidden');
    verifyErr?.classList.add('hidden');
    resendSection?.classList.remove('hidden');
} else {
    // Mode C: Missing token
    verifyLoading?.classList.add('hidden');
    verifySuccess?.classList.add('hidden');
    verifyErr?.classList.remove('hidden');
    if (verifyErrorMessage) {
        verifyErrorMessage.textContent = 'رابط التحقق غير صالح أو ناقص. يمكنك طلب رابط تحقق جديد أدناه.';
    }
    resendSection?.classList.remove('hidden');
}

async function verify(tokenStr) {
    try {
        const res = await verifyEmail(tokenStr);
        verifyLoading?.classList.add('hidden');
        verifyErr?.classList.add('hidden');
        resendSection?.classList.add('hidden');
        verifySuccess?.classList.remove('hidden');
        if (verifySuccessMessage) {
            verifySuccessMessage.textContent = 'تم تأكيد بريدك الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول.';
        }
    } catch (error) {
        verifyLoading?.classList.add('hidden');
        verifySuccess?.classList.add('hidden');
        verifyErr?.classList.remove('hidden');

        const code = error.code || (error.data && error.data.code);
        let message = 'رابط التحقق غير صالح. يمكنك طلب رابط تحقق جديد.';

        if (code === 'VERIFICATION_TOKEN_EXPIRED') {
            message = 'انتهت صلاحية رابط التحقق. يمكنك طلب رابط تحقق جديد.';
        } else if (code === 'ALREADY_VERIFIED') {
            message = 'تم تأكيد بريدك الإلكتروني مسبقًا. يمكنك تسجيل الدخول.';
        } else if (code === 'TOKEN_REQUIRED' || code === 'MISSING_TOKEN') {
            message = 'رابط التحقق غير صالح أو ناقص.';
        } else {
            message = getArabicErrorMessage(error);
        }

        if (verifyErrorMessage) {
            verifyErrorMessage.textContent = message;
        }

        // Show resend section so user can immediately request a new token
        resendSection?.classList.remove('hidden');
    }
}

// Setup Resend Form Handler
if (resendForm) {
    resendForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = (resendEmailInput?.value || '').trim().toLowerCase();
        if (!email) return;

        // Hide prior alerts
        resendSuccessBox?.classList.add('hidden');
        resendErrorBox?.classList.add('hidden');

        // Disable button & show loading state
        const originalText = resendSubmitBtn ? resendSubmitBtn.textContent : 'إعادة إرسال رابط التفعيل';
        if (resendSubmitBtn) {
            resendSubmitBtn.disabled = true;
            resendSubmitBtn.textContent = 'جاري إرسال رابط التفعيل...';
        }

        try {
            const data = await resendVerification(email);

            if (resendSuccessBox) {
                if (resendSuccessMessage) {
                    if (data.isAlreadyVerified || data.code === 'ALREADY_VERIFIED') {
                        resendSuccessMessage.textContent = 'تم تأكيد بريدك الإلكتروني مسبقاً. يمكنك الانتقال إلى تسجيل الدخول.';
                    } else {
                        resendSuccessMessage.textContent = 'تم إرسال رابط تحقق جديد إلى بريدك الإلكتروني. الرابط صالح لمدة 15 دقيقة.';
                    }
                }
                resendSuccessBox.classList.remove('hidden');
            }

            // Start 60-second cooldown timer
            let cooldown = 60;
            if (resendSubmitBtn) {
                resendSubmitBtn.disabled = true;
                resendSubmitBtn.textContent = `إعادة الإرسال بعد (${cooldown}) ثانية`;
                const interval = setInterval(() => {
                    cooldown--;
                    if (cooldown > 0) {
                        resendSubmitBtn.textContent = `إعادة الإرسال بعد (${cooldown}) ثانية`;
                    } else {
                        clearInterval(interval);
                        resendSubmitBtn.disabled = false;
                        resendSubmitBtn.textContent = originalText;
                    }
                }, 1000);
            }

        } catch (error) {
            console.error('Resend verification error:', error);
            if (resendErrorBox) {
                if (resendErrorMessage) {
                    resendErrorMessage.textContent = getArabicErrorMessage(error);
                }
                resendErrorBox.classList.remove('hidden');
            }
            if (resendSubmitBtn) {
                resendSubmitBtn.disabled = false;
                resendSubmitBtn.textContent = originalText;
            }
        }
    });
}