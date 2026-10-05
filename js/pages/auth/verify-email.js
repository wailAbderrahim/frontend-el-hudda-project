import { verifyEmail } from "../../api/authApi.js"

const params = new URLSearchParams(window.location.search)
const token = params.get('token')
const verifyErr = document.getElementById('verify-error')
const verifyLoading = document.getElementById('verify-loading')
const verifySuccess = document.getElementById('verify-success')
const verifySuccessMessage = document.getElementById('verify-success-message')
const verifyErrorMessage = document.getElementById('verify-error-message')

verifyLoading.classList.remove('hidden')
if(!token){
    verifyLoading.classList.add('hidden')
    verifyErr.classList.remove('hidden')
    verifyErrorMessage.textContent = 'فشل التحقق'
    
}else{
    verify(token)

    
}

async function verify(token) {

    try {

        await verifyEmail(token)

        verifyLoading.classList.add('hidden')

        verifySuccess.classList.remove('hidden')

        verifySuccessMessage.textContent =
            'تم تأكيد بريدك الإلكتروني بنجاح.'

    } catch (error) {

        verifyLoading.classList.add('hidden')

        verifyErr.classList.remove('hidden')

        verifyErrorMessage.textContent =
            error.message

    }

}