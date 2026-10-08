const API_BASE_URL = 'https://el-hudda-project.onrender.com/api'

const loading = document.getElementById('verify-loading')
const success = document.getElementById('verify-success')
const error = document.getElementById('verify-error')
const resendSection = document.getElementById('resend-section')

const successMessage = document.getElementById('verify-success-message')
const errorMessage = document.getElementById('verify-error-message')

const resendForm = document.getElementById('resend-form')
const resendEmail = document.getElementById('resend-email')
const resendButton = document.getElementById('resend-submit-btn')

const resendSuccessBox = document.getElementById('resend-success-box')
const resendErrorBox = document.getElementById('resend-error-box')
const resendSuccessMessage = document.getElementById('resend-success-message')
const resendErrorMessage = document.getElementById('resend-error-message')


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const showLoading = () => {
    loading?.classList.remove('hidden')
    success?.classList.add('hidden')
    error?.classList.add('hidden')
    resendSection?.classList.add('hidden')
}

const showSuccess = (message = 'تم تأكيد بريدك الإلكتروني بنجاح.') => {
    loading?.classList.add('hidden')
    error?.classList.add('hidden')
    resendSection?.classList.add('hidden')

    successMessage.textContent = message
    success?.classList.remove('hidden')
}

const showError = (message) => {
    loading?.classList.add('hidden')
    success?.classList.add('hidden')

    errorMessage.textContent =
        message || 'تعذر تأكيد البريد الإلكتروني. يرجى المحاولة مرة أخرى.'

    error?.classList.remove('hidden')
    resendSection?.classList.remove('hidden')
}

const getArabicErrorMessage = (error) => {
    if (!error) {
        return 'حدث خطأ أثناء تأكيد البريد الإلكتروني.'
    }

    const message = String(error.message || '').toLowerCase()

    if (message.includes('expired')) {
        return 'انتهت صلاحية رابط التفعيل. يرجى طلب رابط جديد.'
    }

    if (
        message.includes('invalid token') ||
        message.includes('invalid verification token') ||
        message.includes('invalid or expired')
    ) {
        return 'رابط التفعيل غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد.'
    }

    if (message.includes('already verified')) {
        return 'هذا البريد الإلكتروني تم تأكيده مسبقًا.'
    }

    if (
        message.includes('user not found') ||
        message.includes('user not exist')
    ) {
        return 'لم يتم العثور على الحساب المرتبط بهذا البريد الإلكتروني.'
    }

    if (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('fetch')
    ) {
        return 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.'
    }

    return 'تعذر تأكيد البريد الإلكتروني. يرجى طلب رابط تفعيل جديد.'
}


const fetchWithTimeout = async (url, options = {}, timeout = 15000) => {
    const controller = new AbortController()

    const timer = setTimeout(() => {
        controller.abort()
    }, timeout)

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        })

        return response
    } finally {
        clearTimeout(timer)
    }
}


/*
|--------------------------------------------------------------------------
| Verify Email
|--------------------------------------------------------------------------
*/

const verifyEmail = async () => {
    showLoading()

    const params = new URLSearchParams(window.location.search)

    const token = params.get('token')
    const email = params.get('email')

    /*
     * تأكد من وجود البيانات في الرابط
     */
    if (!token) {
        showError('رابط التفعيل غير صالح أو لا يحتوي على رمز التحقق.')
        return
    }

    if (!email) {
        showError('لم يتم العثور على البريد الإلكتروني المرتبط برابط التفعيل.')
        return
    }

    try {
        const response = await fetchWithTimeout(
            `${API_BASE_URL}/auth/verify-email`,
            {
                method: 'POST',
                body: JSON.stringify({
                    token,
                    email
                })
            }
        )

        let data = {}

        try {
            data = await response.json()
        } catch {
            data = {}
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                'Verification failed'
            )
        }

        showSuccess(
            data.message ||
            'تم تأكيد بريدك الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول إلى حسابك.'
        )

    } catch (error) {
        console.error('Email verification error:', error)

        if (error.name === 'AbortError') {
            showError(
                'استغرق الاتصال بالخادم وقتًا طويلاً. يرجى المحاولة مرة أخرى.'
            )
            return
        }

        showError(getArabicErrorMessage(error))
    }
}


/*
|--------------------------------------------------------------------------
| Resend Verification Email
|--------------------------------------------------------------------------
*/

const resendVerification = async (email) => {
    try {
        const response = await fetchWithTimeout(
            `${API_BASE_URL}/auth/resend-verification`,
            {
                method: 'POST',
                body: JSON.stringify({
                    email
                })
            }
        )

        let data = {}

        try {
            data = await response.json()
        } catch {
            data = {}
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                'Failed to resend verification email'
            )
        }

        return data

    } catch (error) {
        console.error('Resend verification error:', error)

        if (error.name === 'AbortError') {
            throw new Error(
                'استغرق الاتصال بالخادم وقتًا طويلاً. يرجى المحاولة مرة أخرى.'
            )
        }

        throw error
    }
}


/*
|--------------------------------------------------------------------------
| Resend Form
|--------------------------------------------------------------------------
*/

resendForm?.addEventListener('submit', async (event) => {
    event.preventDefault()

    const email = resendEmail.value.trim()

    if (!email) {
        resendErrorBox.classList.remove('hidden')
        resendSuccessBox.classList.add('hidden')
        resendErrorMessage.textContent =
            'يرجى إدخال بريدك الإلكتروني.'
        return
    }

    resendButton.disabled = true
    resendButton.textContent = 'جاري الإرسال...'

    resendSuccessBox.classList.add('hidden')
    resendErrorBox.classList.add('hidden')

    try {
        const data = await resendVerification(email)

        resendSuccessMessage.textContent =
            data.message ||
            'تم إرسال رابط تفعيل جديد إلى بريدك الإلكتروني. الرابط صالح لمدة 15 دقيقة.'

        resendSuccessBox.classList.remove('hidden')

        resendEmail.value = ''

    } catch (error) {
        resendErrorMessage.textContent =
            getArabicErrorMessage(error)

        resendErrorBox.classList.remove('hidden')
    } finally {
        resendButton.disabled = false
        resendButton.textContent = 'إعادة إرسال رابط التفعيل'
    }
})


/*
|--------------------------------------------------------------------------
| Auto Verify
|--------------------------------------------------------------------------
*/

document.addEventListener('DOMContentLoaded', () => {
    verifyEmail()
})