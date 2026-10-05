import { forgotPassword } from "../../api/authApi.js";


const form = document.getElementById('forgot-password-form')
const emailInput = document.getElementById('email')
const forgotError = document.getElementById('forgot-error')
const forgotSuccess = document.getElementById('forgot-success')
const forgotSubmit = document.getElementById('forgot-submit')

form.addEventListener('submit',async event=>{
    event.preventDefault()
    const email = emailInput.value

    try{
        const data = await forgotPassword(email)
        forgotSubmit.disabled = true
        console.log(data)
        forgotSuccess.classList.remove('hidden')
        forgotError.classList.add('hidden')
        forgotSuccess.textContent =
            data.message || 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.'
    }catch(err){
        console.log(err)
        forgotError.classList.remove('hidden')
        forgotSuccess.classList.add('hidden')
        forgotError.textContent =
                err.message
    }finally{
        forgotSubmit.disabled = false
    }
    
    
    
})