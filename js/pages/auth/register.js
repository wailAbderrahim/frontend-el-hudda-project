import { register } from "../../api/authApi.js";
import { getArabicErrorMessage } from "../../utils/errorHandler.js";

const form = document.getElementById('register-form');
const success = document.getElementById('register-success');
const errorBox = document.getElementById('register-error');
const passError = document.getElementById('password-error');
const submitBtn = document.getElementById('register-btn') || (form ? form.querySelector('button[type="submit"]') : null);

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const firstName = (document.getElementById('firstName')?.value || '').trim();
        const lastName = (document.getElementById('lastName')?.value || '').trim();
        const name = (document.getElementById('name')?.value || '').trim() || `${firstName} ${lastName}`.trim();
        const phone = (document.getElementById('phone')?.value || '').trim();
        const dateOfBirth = (document.getElementById('dateOfBirth')?.value || '').trim();
        const placeOfBirth = (document.getElementById('placeOfBirth')?.value || '').trim();
        const municipalityOfBirth = (document.getElementById('municipalityOfBirth')?.value || '').trim();
        const educationLevel = document.getElementById('educationLevel')?.value || '';
        const email = (document.getElementById('email')?.value || '').trim().toLowerCase();
        const password = document.getElementById('password')?.value || '';
        const confirmedPassword = document.getElementById('confirmPassword')?.value || '';

        // Reset error / success indicators
        if (passError) passError.classList.add('hidden');
        if (errorBox) {
            errorBox.classList.add('hidden');
            errorBox.textContent = '';
        }
        if (success) {
            success.classList.add('hidden');
            success.textContent = '';
        }

        // Frontend validation
        if (!firstName || !lastName || !phone || !dateOfBirth || !placeOfBirth || !municipalityOfBirth || !educationLevel || !email || !password) {
            if (errorBox) {
                errorBox.textContent = 'يرجى ملء جميع الحقول المطلوبة والتأكد من صحة البيانات.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        if (password.length < 8) {
            if (errorBox) {
                errorBox.textContent = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        if (password !== confirmedPassword) {
            if (passError) {
                passError.classList.remove('hidden');
            } else if (errorBox) {
                errorBox.textContent = 'كلمتا المرور غير متطابقتين.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        const originalBtnText = submitBtn ? submitBtn.textContent : 'إنشاء الحساب';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري إنشاء الحساب...';
        }

        try {
            await register({
                firstName,
                lastName,
                name,
                phone,
                dateOfBirth,
                placeOfBirth,
                municipalityOfBirth,
                educationLevel,
                email,
                password
            });

            if (errorBox) errorBox.classList.add('hidden');

            // Immediately redirect to the verification page per requirements
            window.location.href = `./verify-email.html?email=${encodeURIComponent(email)}`;
        } catch (error) {
            if (success) success.classList.add('hidden');
            if (errorBox) {
                errorBox.textContent = getArabicErrorMessage(error);
                errorBox.classList.remove('hidden');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
}