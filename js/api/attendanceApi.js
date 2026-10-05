import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function createAttendance(attendanceData) {
    const token = getToken()
    const data = await apiRequest("/attendance", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(attendanceData)
    })
    return data
}

export async function getAttendances() {
    const token = getToken()
    const data = await apiRequest("/attendance", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function getAttendanceById(id) {
    const token = getToken()
    const data = await apiRequest(`/attendance/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function updateAttendance(id, status) {
    const token = getToken()
    const data = await apiRequest(`/attendance/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
    })
    return data
}

export async function deleteAttendance(id) {
    const token = getToken()
    const data = await apiRequest(`/attendance/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}
