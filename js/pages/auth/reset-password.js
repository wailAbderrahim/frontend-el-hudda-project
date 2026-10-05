import { resetPassword } from "../../api/authApi.js";
import { getArabicErrorMessage } from "../../utils/errorHandler.js";

const form = document.getElementById('reset-password-form');
const newPasswordInput = document.getElementById('new-password');
const confirmNewPasswordInput = document.getElementById('confirm-password');

const resetError = document.getElementById('reset-error');
const resetSuccess = document.getElementById('reset-success');
const resetSubmit = document.getElementById('reset-submit');

const params = new URLSearchParams(window.location.search);
const token = params.get('token');

if (!token || !token.trim()) {
    if (resetError) {
        resetError.textContent = 'رابط استعادة كلمة المرور غير صالح أو مفقود. يرجى طلب رابط جديد.';
        resetError.classList.remove('hidden');
    }
    if (form) form.classList.add('hidden');
}

if (form) {
    form.addEventListener('submit', async event => {
        event.preventDefault();

        const newPassword = newPasswordInput?.value || '';
        const confirmNewPassword = confirmNewPasswordInput?.value || '';

        if (resetError) resetError.classList.add('hidden');
        if (resetSuccess) resetSuccess.classList.add('hidden');

        if (newPassword.length < 8) {
            if (resetError) {
                resetError.textContent = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.';
                resetError.classList.remove('hidden');
            }
            return;
        }

        if (newPassword !== confirmNewPassword) {
            if (resetError) {
                resetError.textContent = 'كلمتا المرور غير متطابقتين.';
                resetError.classList.remove('hidden');
            }
            return;
        }

        const originalText = resetSubmit ? resetSubmit.textContent : 'تغيير كلمة المرور';
        if (resetSubmit) {
            resetSubmit.disabled = true;
            resetSubmit.textContent = 'جاري تغيير كلمة المرور...';
        }

        try {
            await resetPassword(token.trim(), newPassword);

            if (resetError) resetError.classList.add('hidden');
            if (resetSuccess) {
                resetSuccess.textContent = 'تم تغيير كلمة المرور بنجاح! يتم الآن توجيهك إلى تسجيل الدخول...';
                resetSuccess.classList.remove('hidden');
            }

            setTimeout(() => {
                window.location.href = './login.html';
            }, 2000);
        } catch (error) {
            console.error('Reset password error:', error);
            if (resetSuccess) resetSuccess.classList.add('hidden');
            if (resetError) {
                resetError.textContent = getArabicErrorMessage(error);
                resetError.classList.remove('hidden');
            }
        } finally {
            if (resetSubmit) {
                resetSubmit.disabled = false;
                resetSubmit.textContent = originalText;
            }
        }
    });
}