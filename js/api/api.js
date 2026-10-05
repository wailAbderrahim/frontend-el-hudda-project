import { API_URL } from "../config/config.js"

export async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, options)

    let data
    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
        try {
            data = await response.json()
        } catch (e) {
            data = { message: "فشل في قراءة استجابة الخادم" }
        }
    } else {
        const text = await response.text()
        data = { message: text || response.statusText }
    }

    if (!response.ok) {
        if (response.status === 401 && !endpoint.includes("/auth/")) {
            localStorage.removeItem("token")
            localStorage.removeItem("user")
            sessionStorage.clear()
            const isInsidePages = window.location.pathname.includes("/pages/")
            window.location.href = isInsidePages ? "../auth/login.html" : "pages/auth/login.html"
        }
        throw new Error(data.message || "حدث خطأ في الاتصال بالخادم")
    }

    return data
}