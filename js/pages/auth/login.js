import { login } from "../../api/authApi.js";
import { getProfile } from "../../api/usersApi.js";
import { getUser, redirectByRole, getToken } from "../../auth/auth.js";

// If already authenticated, redirect to appropriate dashboard
const existingToken = getToken();
const existingUser = getUser();
if (existingToken && existingUser && existingUser.role) {
    if (existingUser.isVerified === false || existingUser.isActive === false) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    } else {
        redirectByRole(existingUser.role);
    }
}

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

if (form) {
    form.addEventListener('submit', async event => {
        event.preventDefault();

        if (errorBox) {
            errorBox.classList.add('hidden');
            errorBox.innerHTML = '';
            errorBox.className = 'hidden mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700';
        }

        const email = (document.getElementById("email")?.value || '').trim().toLowerCase();
        const password = document.getElementById("password")?.value || '';

        const originalBtnText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري تسجيل الدخول...';
        }

        try {
            const data = await login(email, password);

            if (data.user && data.user.isActive === false) {
                const err = new Error('Your account has been disabled. Please contact the administrator.');
                err.code = 'ACCOUNT_DISABLED';
                err.isActive = false;
                throw err;
            }

            if (data.user && data.user.isVerified === false) {
                const err = new Error('Your email address has not been verified yet. Please verify your email to continue.');
                err.code = 'EMAIL_NOT_VERIFIED';
                err.isUnverified = true;
                throw err;
            }

            localStorage.setItem("token", data.token);

            let userProfile = data.user;
            try {
                const profile = await getProfile();
                if (profile && profile.role) {
                    userProfile = profile;
                }
            } catch (profileErr) {
                console.warn("Could not fetch full profile from /user/profile, falling back to login user data:", profileErr);
            }
            localStorage.setItem("user", JSON.stringify(userProfile));

            const user = getUser();
            redirectByRole(user.role);
        } catch (error) {
            console.error('Login error:', error);
            if (errorBox) {
                const msg = (error.message || '').toLowerCase();
                const isUnverified = error.code === 'EMAIL_NOT_VERIFIED' || error.isUnverified || msg.includes('verify') || msg.includes('تفعيل');
                const isDisabled = error.code === 'ACCOUNT_DISABLED' || error.isActive === false || msg.includes('disabled') || msg.includes('deactivated') || msg.includes('تعطيل');

                if (isUnverified) {
                    errorBox.className = 'mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm';
                    errorBox.innerHTML = `
                        <div class="flex items-start gap-3">
                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="font-bold text-amber-900">البريد الإلكتروني غير مفعّل</h4>
                                <p class="mt-1 text-xs text-amber-700 leading-relaxed">
                                    لم يتم تأكيد بريدك الإلكتروني بعد. يرجى تأكيد بريدك الإلكتروني للمتابعة.
                                </p>
                                <div class="mt-3">
                                    <a href="./verify-email.html?email=${encodeURIComponent(email)}" class="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition">
                                        <span>تأكيد البريد الإلكتروني</span>
                                        <span>&larr;</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    `;
                    errorBox.classList.remove('hidden');
                } else if (isDisabled) {
                    errorBox.className = 'mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm';
                    errorBox.innerHTML = `
                        <div class="flex items-start gap-3">
                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="font-bold text-red-900">الحساب معطّل</h4>
                                <p class="mt-1 text-xs text-red-700 leading-relaxed">
                                    تم تعطيل حسابك. يرجى التواصل مع إدارة المدرسة.
                                </p>
                            </div>
                        </div>
                    `;
                    errorBox.classList.remove('hidden');
                } else {
                    errorBox.className = 'mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700';
                    if (msg.includes('invalid') || msg.includes('password') || msg.includes('email') || msg.includes('exist') || msg.includes('غير صحيحة')) {
                        errorBox.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
                    } else {
                        errorBox.textContent = error.message || 'حدث خطأ أثناء تسجيل الدخول.';
                    }
                    errorBox.classList.remove('hidden');
                }
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
}
