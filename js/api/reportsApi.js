import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function getStudentReport(studentId) {
    const token = getToken()
    const data = await apiRequest(`/reports/student/${studentId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function getHalaqaReport(halaqaId) {
    const token = getToken()
    const data = await apiRequest(`/reports/halaqa/${halaqaId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}
