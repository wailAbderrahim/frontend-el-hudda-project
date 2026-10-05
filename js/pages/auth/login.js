import { login } from "../../api/authApi.js";
import { getProfile } from "../../api/usersApi.js";
import { getUser, redirectByRole, getToken } from "../../auth/auth.js";

// If already authenticated, redirect to appropriate dashboard
const existingToken = getToken();
const existingUser = getUser();
if (existingToken && existingUser && existingUser.role) {
    redirectByRole(existingUser.role);
}

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submitBtn = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async event => {
    event.preventDefault();

    if (errorBox) {
        errorBox.classList.add('hidden');
        errorBox.textContent = '';
    }

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري تسجيل الدخول...';
    }

    try {
        const data = await login(email, password);
        localStorage.setItem("token", data.token);

        const profile = await getProfile();
        localStorage.setItem("user", JSON.stringify(profile));

        const user = getUser();
        redirectByRole(user.role);
    } catch (error) {
        console.error('Login error:', error);
        if (errorBox) {
            errorBox.textContent = error.message || 'فشل تسجيل الدخول. يرجى التحقق من البريد وكلمة المرور.';
            errorBox.classList.remove('hidden');
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
});

