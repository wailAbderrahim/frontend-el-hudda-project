import { forgotPassword } from "../../api/authApi.js";
import { getArabicErrorMessage } from "../../utils/errorHandler.js";

const form = document.getElementById('forgot-password-form');
const emailInput = document.getElementById('email');
const forgotError = document.getElementById('forgot-error');
const forgotSuccess = document.getElementById('forgot-success');
const forgotSubmit = document.getElementById('forgot-submit');

if (form) {
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const email = (emailInput?.value || '').trim().toLowerCase();

        if (!email) {
            if (forgotError) {
                forgotError.textContent = 'يرجى إدخال البريد الإلكتروني.';
                forgotError.classList.remove('hidden');
            }
            return;
        }

        const originalText = forgotSubmit ? forgotSubmit.textContent : 'إرسال رابط الاستعادة';
        if (forgotSubmit) {
            forgotSubmit.disabled = true;
            forgotSubmit.textContent = 'جاري الإرسال...';
        }

        try {
            await forgotPassword(email);
            if (forgotError) forgotError.classList.add('hidden');
            if (forgotSuccess) {
                forgotSuccess.textContent = 'إذا كان هذا البريد مسجلاً، فقد تم إرسال رابط استعادة كلمة المرور إليه. الرابط صالح لمدة 15 دقيقة.';
                forgotSuccess.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Forgot password error:', err);
            if (forgotSuccess) forgotSuccess.classList.add('hidden');
            if (forgotError) {
                forgotError.textContent = getArabicErrorMessage(err);
                forgotError.classList.remove('hidden');
            }
        } finally {
            if (forgotSubmit) {
                forgotSubmit.disabled = false;
                forgotSubmit.textContent = originalText;
            }
        }
    });
}