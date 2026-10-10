import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function getLevels() {
    const token = getToken()
    return await apiRequest("/levels", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getLevelById(id) {
    const token = getToken()
    return await apiRequest(`/levels/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function createLevel(levelData) {
    const token = getToken()
    return await apiRequest("/levels", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(levelData)
    })
}

export async function updateLevel(id, levelData) {
    const token = getToken()
    return await apiRequest(`/levels/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(levelData)
    })
}

export async function deleteLevel(id) {
    const token = getToken()
    return await apiRequest(`/levels/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getStudentsByLevel(id) {
    const token = getToken()
    return await apiRequest(`/levels/${id}/students`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function assignStudentLevel(data) {
    const token = getToken()
    return await apiRequest("/levels/assign", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
    })
}

export async function getStudentLevelHistory(studentId) {
    const token = getToken()
    return await apiRequest(`/levels/history/${studentId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

