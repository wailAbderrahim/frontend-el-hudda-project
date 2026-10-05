import { API_URL } from "../config/config.js";

export async function apiRequest(endpoint, options = {}) {
    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, options);
    } catch (networkErr) {
        const error = new Error("تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو المحاولة لاحقاً.");
        error.status = 0;
        error.code = "NETWORK_ERROR";
        error.original = networkErr;
        throw error;
    }

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch (e) {
            data = { message: "فشل في قراءة استجابة الخادم" };
        }
    } else {
        const text = await response.text();
        data = { message: text || response.statusText };
    }

    if (!response.ok) {
        if (response.status === 401 && !endpoint.includes("/auth/")) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            sessionStorage.clear();
            const isInsidePages = window.location.pathname.includes("/pages/");
            window.location.href = isInsidePages ? "../auth/login.html" : "pages/auth/login.html";
        }
        const error = new Error(data.message || "حدث خطأ في الاتصال بالخادم");
        error.status = response.status;
        error.data = data;
        error.code = data.code || null;
        error.isUnverified = Boolean(data.isUnverified || (data.code === "EMAIL_NOT_VERIFIED"));
        error.isActive = data.isActive;
        throw error;
    }

    return data;
}