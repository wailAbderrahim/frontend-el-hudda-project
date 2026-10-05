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
        if (!firstName || !lastName || !phone || !placeOfBirth || !municipalityOfBirth || !educationLevel || !email || !password) {
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
                placeOfBirth,
                municipalityOfBirth,
                educationLevel,
                email,
                password
            });

            if (errorBox) errorBox.classList.add('hidden');

            if (success) {
                success.innerHTML = `
                    <div class="flex items-start gap-3">
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div class="flex-1">
                            <h4 class="font-bold text-emerald-900">تم إنشاء حسابك بنجاح</h4>
                            <p class="mt-1 text-xs text-emerald-700 leading-relaxed">
                                تم إرسال رابط التحقق إلى بريدك الإلكتروني (<strong>${email}</strong>). يرجى فتح البريد والضغط على الرابط لتأكيد الحساب قبل تسجيل الدخول.
                            </p>
                            <div class="mt-4 flex flex-wrap gap-2">
                                <a href="./verify-email.html?email=${encodeURIComponent(email)}" class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition">
                                    <span>الانتقال إلى صفحة التحقق</span>
                                    <span>&larr;</span>
                                </a>
                                <a href="./login.html" class="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition">
                                    تسجيل الدخول
                                </a>
                            </div>
                        </div>
                    </div>
                `;
                success.classList.remove('hidden');
            }

            form.reset();
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