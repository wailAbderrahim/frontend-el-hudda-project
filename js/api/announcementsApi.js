import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function createAnnouncement(announcementData) {
    const token = getToken()
    const data = await apiRequest("/announcements", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(announcementData)
    })
    return data
}

export async function getAnnouncements() {
    const token = getToken()
    const data = await apiRequest("/announcements", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function getAnnouncementById(id) {
    const token = getToken()
    const data = await apiRequest(`/announcements/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function updateAnnouncement(id, announcementData) {
    const token = getToken()
    const data = await apiRequest(`/announcements/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(announcementData)
    })
    return data
}

export async function deleteAnnouncement(id) {
    const token = getToken()
    const data = await apiRequest(`/announcements/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}
