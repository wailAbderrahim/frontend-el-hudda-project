import { resetPassword } from "../../api/authApi.js";


const form = document.getElementById('reset-password-form')

const newPasswordInput = document.getElementById('new-password')
const confirmNewPasswordInput = document.getElementById('confirm-password')

const resetError = document.getElementById('reset-error')
const resetSuccess = document.getElementById('reset-success')
const resetSubmit = document.getElementById('reset-submit')


const params = new URLSearchParams(window.location.search)
const token = params.get('token')
if(!token){
    resetError.textContent = 'رابط استعادة كلمة المرور غير صالح'
    resetError.classList.remove('hidden')
    form.classList.add('hidden')
}


form.addEventListener('submit', async event => {
    event.preventDefault()

    const newPassword = newPasswordInput.value
    const confirmNewPassword = confirmNewPasswordInput.value

    resetError.classList.add('hidden')
    resetSuccess.classList.add('hidden')

    if(newPassword !== confirmNewPassword){
        resetError.textContent = 'كلمتا المرور غير متطابقتين'
        resetError.classList.remove('hidden')
        return
    }

    resetSubmit.disabled = true

    try {

        const data = await resetPassword(token, newPassword)

        resetSuccess.textContent =
            data.message || 'تم تغيير كلمة المرور بنجاح'

        resetSuccess.classList.remove('hidden')
        setTimeout(() => {
            window.location.href = './login.html'
        }, 2000)

    } catch(error) {

        resetError.textContent = error.message
        resetError.classList.remove('hidden')

    } finally {

        resetSubmit.disabled = false

    }
})