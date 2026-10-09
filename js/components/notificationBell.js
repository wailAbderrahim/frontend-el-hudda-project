import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
} from "../api/notificationsApi.js"

import { getUser, getToken } from "../auth/auth.js"
import { WS_URL } from "../config/config.js"

/* =========================================================
   Unified Notification Bell Component
   - Real titles & messages
   - Smart Arabic relative time
   - Formatted badge (9+, hides at 0)
   - Visual distinction between read & unread
   - Mark as read & delete / dismiss actions
   - User-isolated (backend JWT scoped)
   - Mobile-responsive dropdown
   - Optional WebSocket live stream
========================================================= */

let notifications = []
let isOpen = false
let socket = null

/* ---------------------------------------------------------
   Helper: Format Relative Time in Arabic
--------------------------------------------------------- */
export function formatArabicRelativeTime(dateValue) {
    if (!dateValue) return "—"
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return "—"

    const now = new Date()
    const diffSec = Math.floor((now - date) / 1000)
    if (diffSec < 60) return "الآن"

    const diffMin = Math.floor(diffSec / 60)
    if (diffMin === 1) return "منذ دقيقة"
    if (diffMin === 2) return "منذ دقيقتين"
    if (diffMin >= 3 && diffMin <= 10) return `منذ ${diffMin} دقائق`
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`

    const diffHour = Math.floor(diffMin / 60)
    if (diffHour === 1) return "منذ ساعة"
    if (diffHour === 2) return "منذ ساعتين"
    if (diffHour >= 3 && diffHour <= 10) return `منذ ${diffHour} ساعات`
    if (diffHour < 24) return `منذ ${diffHour} ساعة`

    const diffDay = Math.floor(diffHour / 24)
    if (diffDay === 1) return "أمس"
    if (diffDay === 2) return "منذ يومين"
    if (diffDay >= 3 && diffDay <= 10) return `منذ ${diffDay} أيام`
    if (diffDay < 30) return `منذ ${diffDay} يوماً`

    return new Intl.DateTimeFormat("ar-DZ", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    }).format(date)
}

/* ---------------------------------------------------------
   Helper: Notification Type Metadata
--------------------------------------------------------- */
export function getNotificationMeta(type) {
    switch (type) {
        case "announcement":
            return {
                label: "إعلان",
                tagClass: "bg-emerald-50 text-emerald-700",
                iconBg: "bg-emerald-100 text-emerald-700",
                icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>`
            }
        case "evaluation":
            return {
                label: "تقييم",
                tagClass: "bg-blue-50 text-blue-700",
                iconBg: "bg-blue-100 text-blue-700",
                icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>`
            }
        case "memorization":
            return {
                label: "حفظ وتسميع",
                tagClass: "bg-amber-50 text-amber-700",
                iconBg: "bg-amber-100 text-amber-700",
                icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332-.477-4.5 1.253"/></svg>`
            }
        case "system":
        default:
            return {
                label: "تنبيه نظام",
                tagClass: "bg-purple-50 text-purple-700",
                iconBg: "bg-purple-100 text-purple-700",
                icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.5-2V9a6.5 6.5 0 00-13 0v6L4 17h5m6 0a3 3 0 01-6 0"/></svg>`
            }
    }
}

function escapeHtml(str) {
    if (!str) return ""
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

/* ---------------------------------------------------------
   Update Badge UI
   - 0 unread: hidden
   - 1..9: exact number
   - > 9: "9+" (or "99+" if > 99)
--------------------------------------------------------- */
function updateBadgeUI() {
    const notifBadge = document.getElementById("notif-badge")
    const notifCountBadge = document.getElementById("notif-count-badge")

    const unreadCount = notifications.filter(n => !n.isRead).length

    if (notifBadge) {
        if (unreadCount > 0) {
            let label = String(unreadCount)
            if (unreadCount > 99) {
                label = "99+"
            } else if (unreadCount > 9) {
                label = "9+"
            }
            notifBadge.textContent = label
            notifBadge.classList.remove("hidden")
        } else {
            notifBadge.textContent = "0"
            notifBadge.classList.add("hidden")
        }
    }

    if (notifCountBadge) {
        notifCountBadge.textContent = `${unreadCount} جديد`
    }
}

/* ---------------------------------------------------------
   Render Notifications in Dropdown
--------------------------------------------------------- */
function renderListUI() {
    const listEl = document.getElementById("notif-list")
    if (!listEl) return

    if (notifications.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-2">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 17h5l-1.5-2V9a6.5 6.5 0 00-13 0v6L4 17h5m6 0a3 3 0 01-6 0" />
                    </svg>
                </div>
                <p class="text-xs font-semibold text-slate-600">لا توجد إشعارات حالياً</p>
                <p class="text-[11px] text-slate-400 mt-1">ستصلك التنبيهات والإعلانات هنا فور نشرها</p>
            </div>
        `
        return
    }

    const sorted = [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    listEl.innerHTML = sorted.map(item => {
        const meta = getNotificationMeta(item.type)
        const timeStr = formatArabicRelativeTime(item.createdAt)
        const isUnread = !item.isRead
        const bgClass = isUnread ? "bg-emerald-50/50" : "bg-white"

        return `
            <div class="group relative flex items-start gap-3 p-3.5 transition hover:bg-slate-50 ${bgClass}" data-notif-id="${item._id}">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}">
                    ${meta.icon}
                </div>

                <div class="flex-1 min-w-0 pr-0.5">
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <div class="flex items-center gap-1.5 min-w-0">
                            ${isUnread ? '<span class="h-2 w-2 rounded-full bg-emerald-600 shrink-0"></span>' : ''}
                            <h5 class="text-xs font-bold truncate ${isUnread ? 'text-emerald-950 font-black' : 'text-slate-800'}">
                                ${escapeHtml(item.title)}
                            </h5>
                        </div>
                        <span class="text-[10px] text-slate-400 shrink-0">${timeStr}</span>
                    </div>

                    <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        ${escapeHtml(item.message)}
                    </p>

                    <div class="mt-2 flex items-center justify-between">
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md ${meta.tagClass}">${meta.label}</span>

                        <div class="flex items-center gap-1">
                            ${isUnread ? `
                                <button
                                    type="button"
                                    data-action="mark-read"
                                    data-id="${item._id}"
                                    class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 px-1.5 py-0.5 rounded transition hover:bg-emerald-100/50"
                                    title="تحديد كمقروء">
                                    تحديد كمقروء
                                </button>
                            ` : ''}
                            <button
                                type="button"
                                data-action="delete"
                                data-id="${item._id}"
                                class="text-slate-400 hover:text-red-600 p-1 rounded-lg transition hover:bg-red-50"
                                title="إخفاء / حذف التنبيه">
                                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `
    }).join("")
}

/* ---------------------------------------------------------
   Fetch Notifications from Server
--------------------------------------------------------- */
export async function refreshNotifications() {
    try {
        const data = await getNotifications()
        notifications = Array.isArray(data) ? data : []
        updateBadgeUI()
        renderListUI()
    } catch (error) {
        console.warn("Failed to load notifications:", error)
    }
}

/* ---------------------------------------------------------
   Setup Real-time WebSocket
--------------------------------------------------------- */
function setupLiveSocket() {
    const token = getToken()
    if (!token) return

    try {
        const wsUrl = `${WS_URL}/?token=${encodeURIComponent(token)}`
        socket = new WebSocket(wsUrl)

        socket.onmessage = (event) => {
            try {
                const notif = JSON.parse(event.data)
                if (notif && notif._id) {
                    // Check if already present
                    const existingIdx = notifications.findIndex(n => n._id === notif._id)
                    if (existingIdx !== -1) {
                        notifications[existingIdx] = notif
                    } else {
                        notifications.unshift(notif)
                    }
                    updateBadgeUI()
                    renderListUI()
                }
            } catch (err) {
                // Ignore parse errors
            }
        }

        socket.onclose = () => {
            // Reconnect after 15 seconds
            setTimeout(setupLiveSocket, 15000)
        }

        socket.onerror = () => {
            if (socket) socket.close()
        }
    } catch (err) {
        // Fallback silently to HTTP
    }
}

/* ---------------------------------------------------------
   Mount Dropdown Structure if missing
--------------------------------------------------------- */
function ensureDropdownMarkup(container) {
    if (!container) return null

    let notifBtn = container.querySelector("#notif-btn")
    let notifDropdown = container.querySelector("#notif-dropdown")

    const user = getUser()
    const isAdmin = user?.role === "admin"
    const footerLink = isAdmin
        ? '<a href="./notifications.html" class="inline-block text-xs font-bold text-emerald-700 hover:text-emerald-800 transition">عرض جميع الإشعارات &larr;</a>'
        : '<button type="button" id="notif-refresh-btn" class="inline-block text-xs font-bold text-emerald-700 hover:text-emerald-800 transition">تحديث الإشعارات</button>'

    // If dropdown panel not present inside container, create it
    if (!notifDropdown) {
        notifDropdown = document.createElement("div")
        notifDropdown.id = "notif-dropdown"
        notifDropdown.className = "hidden absolute left-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm sm:max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden transition-all duration-200"
        notifDropdown.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/80">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-800 text-sm">الإشعارات</span>
                    <span id="notif-count-badge" class="rounded-full bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 text-xs">0 جديد</span>
                </div>
                <div class="flex items-center gap-2">
                    <button id="notif-mark-all" type="button" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition hover:underline">
                        تحديد الكل كمقروء
                    </button>
                    <span class="text-slate-300">|</span>
                    <button id="notif-clear-all" type="button" class="text-xs font-semibold text-red-600 hover:text-red-700 transition hover:underline" title="مسح جميع الإشعارات">
                        مسح الكل
                    </button>
                </div>
            </div>

            <div id="notif-list" class="max-h-80 overflow-y-auto divide-y divide-slate-100 text-right">
                <div class="flex items-center justify-center p-6 text-xs text-slate-400">
                    جاري تحميل الإشعارات...
                </div>
            </div>

            <div class="border-t border-slate-100 p-2.5 text-center bg-slate-50/50">
                ${footerLink}
            </div>
        `
        container.appendChild(notifDropdown)
    }

    // Ensure badge element exists on button
    if (notifBtn) {
        let badge = notifBtn.querySelector("#notif-badge")
        if (!badge) {
            badge = document.createElement("span")
            badge.id = "notif-badge"
            badge.className = "hidden absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white"
            badge.textContent = "0"
            notifBtn.appendChild(badge)
        }
    }

    return notifDropdown
}

/* ---------------------------------------------------------
   Initialize Notification Bell
--------------------------------------------------------- */
export function initNotificationBell() {
    let container = document.getElementById("notif-container")

    // If no #notif-container exists, try to wrap #notif-btn or notification anchor in header
    if (!container) {
        const notifBtn = document.getElementById("notif-btn")
        if (notifBtn && notifBtn.parentElement) {
            const parent = notifBtn.parentElement
            container = document.createElement("div")
            container.id = "notif-container"
            container.className = "relative"
            parent.insertBefore(container, notifBtn)
            container.appendChild(notifBtn)
        } else {
            // Check for notifications link in header actions
            const notifLink = document.querySelector('header a[href*="notifications.html"]')
            if (notifLink && notifLink.parentElement) {
                const parent = notifLink.parentElement
                container = document.createElement("div")
                container.id = "notif-container"
                container.className = "relative"

                const btn = document.createElement("button")
                btn.id = "notif-btn"
                btn.type = "button"
                btn.className = "relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                btn.setAttribute("aria-label", "الإشعارات")
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.5-2V9a6.5 6.5 0 00-13 0v6L4 17h5m6 0a3 3 0 01-6 0" />
                    </svg>
                    <span id="notif-badge" class="hidden absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">0</span>
                `

                parent.replaceChild(container, notifLink)
                container.appendChild(btn)
            }
        }
    }

    if (!container) return

    const notifDropdown = ensureDropdownMarkup(container)
    const notifBtn = container.querySelector("#notif-btn")
    const notifMarkAll = document.getElementById("notif-mark-all")
    const notifClearAll = document.getElementById("notif-clear-all")
    const notifList = document.getElementById("notif-list")
    const notifRefreshBtn = document.getElementById("notif-refresh-btn")

    function toggleDropdown() {
        if (!notifDropdown) return
        const isHidden = notifDropdown.classList.contains("hidden")
        if (isHidden) {
            notifDropdown.classList.remove("hidden")
            notifBtn?.setAttribute("aria-expanded", "true")
            refreshNotifications()
        } else {
            notifDropdown.classList.add("hidden")
            notifBtn?.setAttribute("aria-expanded", "false")
        }
    }

    function closeDropdown() {
        if (notifDropdown && !notifDropdown.classList.contains("hidden")) {
            notifDropdown.classList.add("hidden")
            notifBtn?.setAttribute("aria-expanded", "false")
        }
    }

    if (notifBtn) {
        notifBtn.addEventListener("click", (e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleDropdown()
        })
    }

    // Close on click outside
    document.addEventListener("click", (e) => {
        if (container && !container.contains(e.target)) {
            closeDropdown()
        }
    })

    // Close on ESC
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeDropdown()
        }
    })

    // Mark all as read
    if (notifMarkAll) {
        notifMarkAll.addEventListener("click", async (e) => {
            e.preventDefault()
            e.stopPropagation()
            try {
                notifMarkAll.disabled = true
                await markAllAsRead()
                notifications.forEach(n => { n.isRead = true })
                updateBadgeUI()
                renderListUI()
            } catch (err) {
                console.error("Mark all as read failed:", err)
            } finally {
                notifMarkAll.disabled = false
            }
        })
    }

    // Clear all notifications
    if (notifClearAll) {
        notifClearAll.addEventListener("click", async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (notifications.length === 0) return
            const confirmed = window.confirm("هل أنت متأكد من رغبتك في مسح جميع الإشعارات؟")
            if (!confirmed) return

            try {
                notifClearAll.disabled = true
                await deleteAllNotifications()
                notifications = []
                updateBadgeUI()
                renderListUI()
            } catch (err) {
                console.error("Clear all notifications failed:", err)
            } finally {
                notifClearAll.disabled = false
            }
        })
    }

    // Refresh button (if present for non-admins)
    if (notifRefreshBtn) {
        notifRefreshBtn.addEventListener("click", (e) => {
            e.preventDefault()
            refreshNotifications()
        })
    }

    // Event delegation on list for mark-read and delete buttons
    if (notifList) {
        notifList.addEventListener("click", async (e) => {
            const markBtn = e.target.closest('[data-action="mark-read"]')
            if (markBtn) {
                e.preventDefault()
                e.stopPropagation()
                const id = markBtn.dataset.id
                try {
                    markBtn.disabled = true
                    await markAsRead(id)
                    const item = notifications.find(n => n._id === id)
                    if (item) item.isRead = true
                    updateBadgeUI()
                    renderListUI()
                } catch (err) {
                    console.error("Mark as read failed:", err)
                }
                return
            }

            const delBtn = e.target.closest('[data-action="delete"]')
            if (delBtn) {
                e.preventDefault()
                e.stopPropagation()
                const id = delBtn.dataset.id
                try {
                    delBtn.disabled = true
                    await deleteNotification(id)
                    notifications = notifications.filter(n => n._id !== id)
                    updateBadgeUI()
                    renderListUI()
                } catch (err) {
                    console.error("Delete notification failed:", err)
                }
                return
            }
        })
    }

    // Initial background fetch
    refreshNotifications()

    // Live socket
    setupLiveSocket()
}
