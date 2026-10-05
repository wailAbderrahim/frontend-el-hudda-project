import { apiRequest } from "./api.js";

export async function login(email, password){
    const data = await apiRequest('/auth/login',{
        method:'POST',
        headers: {'content-type':'application/json'},
        body:JSON.stringify({
            email,
            password
        })
    })
    return data
}
export async function register(firstName,lastName,name,phone,placeOfBirth,municipalityOfBirth,educationLevel,email,password){
    const data = await apiRequest('/auth/register',{
        method:'POST',
        headers:{
            'content-type':'application/json'
        },
        body:JSON.stringify({
            firstName,
            lastName,
            name,
            phone,
            placeOfBirth,
            municipalityOfBirth,
            educationLevel,
            email,
            password
        })
    })
    return data
}


export async function verifyEmail(token) {
    const data = await apiRequest(`/auth/verify-email?token=${token}`, {
        method:'GET'
    })
    return data
}


export async function forgotPassword(email) {
    
    const data = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            email
        })
    })

    return data
}




export async function resetPassword(token, newPassword){
    const data = await apiRequest('/auth/reset-password',{
        method: 'POST',
        headers:{
            'content-type': 'application/json'
        },
        body:JSON.stringify({
            token,
            email
        })
    })
    return data
}
