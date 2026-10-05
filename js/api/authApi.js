import { apiRequest } from "./api.js";

export async function login(email, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            email: email ? email.trim() : '',
            password
        })
    });
    return data;
}

export async function register(firstNameOrData, lastName, name, phone, placeOfBirth, municipalityOfBirth, educationLevel, email, password) {
    let payload;
    if (typeof firstNameOrData === 'object' && firstNameOrData !== null) {
        payload = firstNameOrData;
    } else {
        payload = {
            firstName: firstNameOrData,
            lastName,
            name: name || `${firstNameOrData || ''} ${lastName || ''}`.trim(),
            phone,
            placeOfBirth,
            municipalityOfBirth,
            educationLevel,
            email,
            password
        };
    }

    const data = await apiRequest('/auth/register', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    return data;
}

export async function verifyEmail(token) {
    const data = await apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
        method: 'GET'
    });
    return data;
}

export async function forgotPassword(email) {
    const data = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            email: email ? email.trim() : ''
        })
    });
    return data;
}

export async function resendVerification(email) {
    const data = await apiRequest('/auth/resend-verification', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            email: email ? email.trim() : ''
        })
    });
    return data;
}

export async function resetPassword(token, newPassword) {
    const data = await apiRequest('/auth/reset-password', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            token,
            newPassword
        })
    });
    return data;
}
