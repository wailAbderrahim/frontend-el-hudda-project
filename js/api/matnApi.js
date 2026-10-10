import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function getMatns() {
    const token = getToken()
    return await apiRequest("/matn", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getMatnById(id) {
    const token = getToken()
    return await apiRequest(`/matn/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function createMatn(matnData) {
    const token = getToken()
    return await apiRequest("/matn", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(matnData)
    })
}

export async function updateMatn(id, matnData) {
    const token = getToken()
    return await apiRequest(`/matn/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(matnData)
    })
}

export async function deleteMatn(id) {
    const token = getToken()
    return await apiRequest(`/matn/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getMatnProgress() {
    const token = getToken()
    return await apiRequest("/matn/progress", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getStudentMatnProgress(studentId) {
    const token = getToken()
    return await apiRequest(`/matn/progress/student/${studentId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function createStudentMatnProgress(data) {
    const token = getToken()
    return await apiRequest("/matn/progress", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
}

export async function updateStudentMatnProgress(id, data) {
    const token = getToken()
    return await apiRequest(`/matn/progress/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
}

export async function deleteStudentMatnProgress(id) {
    const token = getToken()
    return await apiRequest(`/matn/progress/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

