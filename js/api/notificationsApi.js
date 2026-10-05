import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function getNotifications() {
    const token = getToken()
    const data = await apiRequest("/notifications", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function getNotificationById(id) {
    const token = getToken()
    const data = await apiRequest(`/notifications/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function markAsRead(id) {
    const token = getToken()
    const data = await apiRequest(`/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function markAllAsRead() {
    const token = getToken()
    const data = await apiRequest("/notifications/read-all", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function deleteNotification(id) {
    const token = getToken()
    const data = await apiRequest(`/notifications/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}
