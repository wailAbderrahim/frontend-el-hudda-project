
import { register } from "../../api/authApi.js"


const form = document.getElementById('register-form')
const success = document.getElementById('register-success')
const errorBox = document.getElementById('register-error')
const passError = document.getElementById('password-error')

form.addEventListener('submit', async event=>{
    event.preventDefault()
    
    const firstName = document.getElementById('firstName').value
    const lastName = document.getElementById('lastName').value
    const name = document.getElementById('name').value
    const phone = document.getElementById('phone').value
    const placeOfBirth = document.getElementById('placeOfBirth').value
    const municipalityOfBirth = document.getElementById('municipalityOfBirth').value
    const educationLevel = document.getElementById('educationLevel').value
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const confirmedPassword = document.getElementById('confirmPassword').value

    if(password !== confirmedPassword){
        passError.classList.remove('hidden')
    }else{
        passError.classList.add('hidden')
        try{
            const data = await register(firstName,lastName,name,phone,placeOfBirth,municipalityOfBirth,educationLevel,email,password)
            
            errorBox.classList.add('hidden')

            success.textContent = data.message
            success.classList.remove('hidden')
        }catch(error){
            success.classList.add('hidden')

            errorBox.textContent = error.message
            errorBox.classList.remove('hidden')
        }

       
    }


})