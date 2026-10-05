import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"


/* =========================
   Get Users
========================= */

export async function getUsers() {

    const token = getToken()

    const data = await apiRequest('/user', {

        method: 'GET',

        headers: {
            Authorization: `Bearer ${token}`
        }

    })

    return data
}


/* =========================
   Update User
========================= */

export async function updateUser(userId, updates) {

    const token = getToken()

    const data = await apiRequest(`/user/${userId}`, {

        method: 'PUT',

        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },

        body: JSON.stringify(updates)

    })

    return data
}


/* =========================
   Update User Status
========================= */

export async function updateUserStatus(userId, isActive) {

    const token = getToken()

    const data = await apiRequest(
        `/user/${userId}/status`,
        {

            method: 'PATCH',

            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify({
                isActive
            })

        }
    )

    return data
}


/* =========================
   Get Profile
========================= */

export async function getProfile() {
    const token = getToken()
    return await apiRequest('/user/profile', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}


/* =========================
   Update Profile
========================= */

export async function updateProfile(profileData) {
    const token = getToken()
    return await apiRequest('/user/profile', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
    })
}


/* =========================
   Change Password
========================= */

export async function changePassword(currentPassword, newPassword) {
    const token = getToken()
    return await apiRequest('/user/change-password', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            currentPassword,
            newPassword
        })
    })
}