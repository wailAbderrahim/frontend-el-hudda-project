import { login, resendVerification } from "../../api/authApi.js";
import { getProfile } from "../../api/usersApi.js";
import { getUser, redirectByRole, getToken } from "../../auth/auth.js";
import { getArabicErrorMessage } from "../../utils/errorHandler.js";

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

        if (!email || !password) {
            if (errorBox) {
                errorBox.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
                errorBox.classList.remove('hidden');
            }
            return;
        }

        const originalBtnText = submitBtn ? submitBtn.textContent : 'تسجيل الدخول';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري تسجيل الدخول...';
        }

        try {
            const data = await login(email, password);

            const userObj = data.user || (data.data && data.data.user);
            const tokenStr = data.token || (data.data && data.data.token);

            if (userObj && userObj.isActive === false) {
                const err = new Error('Your account is deactivated');
                err.code = 'ACCOUNT_INACTIVE';
                err.statusCode = 403;
                throw err;
            }

            if (userObj && userObj.isVerified === false) {
                const err = new Error('Please verify your email before logging in');
                err.code = 'EMAIL_NOT_VERIFIED';
                err.isUnverified = true;
                err.statusCode = 403;
                throw err;
            }

            // Save token
            localStorage.setItem("token", tokenStr);

            // Attempt to load full profile with reliable fallback
            let userProfile = userObj;
            try {
                const profile = await getProfile();
                if (profile && profile.role) {
                    userProfile = profile;
                }
            } catch (profileErr) {
                console.warn("Could not fetch full profile from /user/profile, falling back to login user data:", profileErr);
            }
            localStorage.setItem("user", JSON.stringify(userProfile));

            const finalUser = getUser() || userProfile;
            redirectByRole(finalUser.role);
        } catch (error) {
            console.error('Login error:', error);
            if (errorBox) {
                const code = error.code || (error.data && error.data.code);
                const isUnverified = code === 'EMAIL_NOT_VERIFIED' || error.isUnverified;
                const isInactive = code === 'ACCOUNT_INACTIVE' || code === 'ACCOUNT_DISABLED' || error.isActive === false;

                if (isUnverified) {
                    errorBox.className = 'mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-xs';
                    errorBox.innerHTML = `
                        <div class="flex items-start gap-3">
                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="font-bold text-amber-900">لم يتم تأكيد بريدك الإلكتروني بعد</h4>
                                <p class="mt-1 text-xs text-amber-700 leading-relaxed">
                                    يرجى تأكيد بريدك الإلكتروني لتتمكن من الدخول إلى حسابك.
                                </p>
                                <div id="login-resend-feedback" class="hidden mt-2 text-xs font-semibold"></div>
                                <div class="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        id="inline-resend-btn"
                                        class="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span>إعادة إرسال رابط التحقق</span>
                                    </button>
                                    <a href="./verify-email.html?email=${encodeURIComponent(email)}" class="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-100/60 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200/70 transition">
                                        <span>صفحة التحقق</span>
                                        <span>&larr;</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    `;
                    errorBox.classList.remove('hidden');

                    // Bind inline resend button
                    const inlineBtn = document.getElementById('inline-resend-btn');
                    const feedback = document.getElementById('login-resend-feedback');
                    if (inlineBtn) {
                        inlineBtn.addEventListener('click', async () => {
                            inlineBtn.disabled = true;
                            const originalText = inlineBtn.textContent;
                            inlineBtn.textContent = 'جاري الإرسال...';
                            if (feedback) feedback.classList.add('hidden');

                            try {
                                const res = await resendVerification(email);
                                if (feedback) {
                                    feedback.className = 'mt-2 text-xs font-bold text-emerald-700';
                                    feedback.textContent = res.message || 'تم إرسال رابط تحقق جديد إلى بريدك الإلكتروني.';
                                    feedback.classList.remove('hidden');
                                }

                                // 60s cooldown
                                let cooldown = 60;
                                inlineBtn.textContent = `إعادة الإرسال بعد (${cooldown})`;
                                const interval = setInterval(() => {
                                    cooldown--;
                                    if (cooldown > 0) {
                                        inlineBtn.textContent = `إعادة الإرسال بعد (${cooldown})`;
                                    } else {
                                        clearInterval(interval);
                                        inlineBtn.disabled = false;
                                        inlineBtn.textContent = originalText;
                                    }
                                }, 1000);
                            } catch (resendErr) {
                                inlineBtn.disabled = false;
                                inlineBtn.textContent = originalText;
                                if (feedback) {
                                    feedback.className = 'mt-2 text-xs font-bold text-red-600';
                                    feedback.textContent = getArabicErrorMessage(resendErr);
                                    feedback.classList.remove('hidden');
                                }
                            }
                        });
                    }
                } else if (isInactive) {
                    errorBox.className = 'mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-xs';
                    errorBox.innerHTML = `
                        <div class="flex items-start gap-3">
                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="font-bold text-red-900">حسابك غير مفعل حاليًا</h4>
                                <p class="mt-1 text-xs text-red-700 leading-relaxed">
                                    تم تعطيل أو إيقاف تفعيل حسابك. يرجى التواصل مع إدارة المدرسة القرآنية.
                                </p>
                            </div>
                        </div>
                    `;
                    errorBox.classList.remove('hidden');
                } else {
                    errorBox.className = 'mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700';
                    errorBox.textContent = getArabicErrorMessage(error);
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
