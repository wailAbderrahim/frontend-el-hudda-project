import { register } from "../../api/authApi.js";

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

        if (password !== confirmedPassword) {
            if (passError) {
                passError.classList.remove('hidden');
            } else if (errorBox) {
                errorBox.textContent = 'كلمتا المرور غير متطابقتين';
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
            const data = await register({
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
                            <h4 class="font-bold text-emerald-900">تم إنشاء الحساب بنجاح</h4>
                            <p class="mt-1 text-xs text-emerald-700 leading-relaxed">
                                تم إرسال رابط تأكيد إلى بريدك الإلكتروني (<strong>${email}</strong>). يرجى فتح البريد لتأكيد الحساب قبل تسجيل الدخول.
                            </p>
                            <div class="mt-3">
                                <a href="./login.html" class="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline">
                                    الانتقال إلى تسجيل الدخول &larr;
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
                const msg = error.message || '';
                if (msg.includes('already exist') || msg.includes('موجود مسبقاً')) {
                    errorBox.textContent = 'هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول أو استخدام بريد آخر.';
                } else if (msg.includes('all fields are required')) {
                    errorBox.textContent = 'يرجى ملء جميع الحقول المطلوبة.';
                } else {
                    errorBox.textContent = msg || 'حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.';
                }
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