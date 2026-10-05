import {
    getNotifications,
    getNotificationById,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from "../../api/notificationsApi.js"

import { getUser, protectPage } from "../../auth/auth.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")


/* =========================================================
   State
========================================================= */
let allNotifications = []
let filteredNotifications = []
let activeFilter = "all" // 'all' | 'unread' | 'read'
let selectedNotification = null


/* =========================================================
   DOM Helpers
========================================================= */
const $ = (id) => document.getElementById(id)

const setText = (id, value) => {
    const el = $(id)
    if (el) el.textContent = value ?? "—"
}


/* =========================================================
   Init
========================================================= */
async function initPage() {
    setupAdminInfo()
    setupSidebar()
    setupEvents()

    await loadNotifications()
}


/* =========================================================
   Admin Info
========================================================= */
function setupAdminInfo() {
    const user = getUser()
    if (!user) return

    const adminName = $("admin-name")
    const adminAvatar = $("admin-avatar")

    const name = user.name || "الإدارة"
    if (adminName) adminName.textContent = name
    if (adminAvatar) adminAvatar.textContent = name.charAt(0)
}


/* =========================================================
   Sidebar & Logout
========================================================= */
function setupSidebar() {
    const menuBtn = $("menu-btn")
    const sidebar = $("sidebar")
    const overlay = $("sidebar-overlay")

    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.remove("translate-x-full")
            overlay.classList.remove("hidden")
        })

        const closeSidebar = () => {
            sidebar.classList.add("translate-x-full")
            overlay.classList.add("hidden")
        }

        overlay.addEventListener("click", closeSidebar)
        sidebar.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", closeSidebar)
        })
    }

    const logoutBtn = $("logout-btn")
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token")
            localStorage.removeItem("user")
            window.location.href = "../auth/login.html"
        })
    }
}


/* =========================================================
   Data Loading
========================================================= */
async function loadNotifications() {
    showLoading(true)
    hideError()

    try {
        const data = await getNotifications()
        allNotifications = Array.isArray(data) ? data : []

        renderStatistics()
        filterNotifications()
    } catch (error) {
        console.error("Load notifications error:", error)
        showError(error.message || "تعذر تحميل الإشعارات. يرجى المحاولة لاحقاً.")
    } finally {
        showLoading(false)
    }
}


/* =========================================================
   Statistics
========================================================= */
function renderStatistics() {
    const total = allNotifications.length
    const unread = allNotifications.filter(n => !n.isRead).length
    const read = total - unread

    setText("total-notifs-count", total)
    setText("unread-notifs-count", unread)
    setText("read-notifs-count", read)
}


/* =========================================================
   Filtering
========================================================= */
function setStatusFilter(filter) {
    activeFilter = filter

    const btnAll = $("filter-all")
    const btnUnread = $("filter-unread")
    const btnRead = $("filter-read")

    const activeClasses = "rounded-xl px-4 py-2 text-xs font-bold transition bg-emerald-700 text-white shadow-sm"
    const inactiveClasses = "rounded-xl px-4 py-2 text-xs font-semibold transition text-slate-600 hover:bg-slate-100"

    btnAll.className = filter === "all" ? activeClasses : inactiveClasses
    btnUnread.className = filter === "unread" ? activeClasses : inactiveClasses
    btnRead.className = filter === "read" ? activeClasses : inactiveClasses

    filterNotifications()
}

function filterNotifications() {
    const typeFilter = $("notifs-type-filter")?.value || ""

    filteredNotifications = allNotifications.filter(item => {
        let matchesStatus = true
        if (activeFilter === "unread") matchesStatus = !item.isRead
        else if (activeFilter === "read") matchesStatus = item.isRead

        let matchesType = true
        if (typeFilter) matchesType = item.type === typeFilter

        return matchesStatus && matchesType
    })

    renderNotifications()
}


/* =========================================================
   Render List
========================================================= */
function renderNotifications() {
    const container = $("notifications-list")
    const emptyState = $("notifications-empty")

    if (!container) return

    container.innerHTML = ""
    setText("filtered-notifs-count", filteredNotifications.length)

    if (filteredNotifications.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden")
        return
    }

    if (emptyState) emptyState.classList.add("hidden")

    filteredNotifications.forEach(notif => {
        const itemEl = document.createElement("div")
        const typeInfo = getNotificationTypeInfo(notif.type)
        const unreadClass = !notif.isRead ? "bg-emerald-50/40" : "bg-white"
        const dateStr = formatDateTime(notif.createdAt)

        itemEl.className = `flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 transition hover:bg-slate-50 border-b border-slate-100 last:border-0 ${unreadClass}`

        itemEl.innerHTML = `
            <div class="flex items-start gap-4 flex-1">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${typeInfo.bgClass}">
                    ${typeInfo.icon}
                </div>

                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        ${!notif.isRead ? '<span class="h-2 w-2 rounded-full bg-emerald-600"></span>' : ''}
                        <h4 class="text-sm font-bold text-slate-800 ${!notif.isRead ? 'text-emerald-950 font-black' : ''}">
                            ${escapeHTML(notif.title)}
                        </h4>
                        <span class="rounded-lg px-2 py-0.5 text-xs font-semibold ${typeInfo.tagClass}">
                            ${typeInfo.label}
                        </span>
                    </div>

                    <p class="mt-1 text-xs text-slate-600 line-clamp-2">
                        ${escapeHTML(notif.message)}
                    </p>

                    <span class="mt-2 inline-block text-[11px] text-slate-400">
                        ${dateStr}
                    </span>
                </div>
            </div>

            <div class="flex items-center gap-1.5 self-end sm:self-center">
                <button
                    data-action="details"
                    data-id="${notif._id}"
                    title="عرض التفاصيل"
                    class="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                </button>

                ${!notif.isRead ? `
                    <button
                        data-action="mark-read"
                        data-id="${notif._id}"
                        title="تحديد كمقروء"
                        class="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/>
                        </svg>
                    </button>
                ` : ''}

                <button
                    data-action="delete"
                    data-id="${notif._id}"
                    title="حذف التنبيه"
                    class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700 transition">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `

        container.appendChild(itemEl)
    })
}


/* =========================================================
   Event Listeners
========================================================= */
function setupEvents() {
    $("filter-all")?.addEventListener("click", () => setStatusFilter("all"))
    $("filter-unread")?.addEventListener("click", () => setStatusFilter("unread"))
    $("filter-read")?.addEventListener("click", () => setStatusFilter("read"))
    $("notifs-type-filter")?.addEventListener("change", filterNotifications)

    $("mark-all-read-btn")?.addEventListener("click", handleMarkAllAsRead)

    $("notifications-list")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return

        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "details") openDetailsModal(id)
        if (action === "mark-read") handleMarkAsRead(id)
        if (action === "delete") handleDeleteNotification(id)
    })

    $("close-details-modal")?.addEventListener("click", closeDetailsModal)
    $("details-close-btn")?.addEventListener("click", closeDetailsModal)

    $("details-mark-read-btn")?.addEventListener("click", async () => {
        if (selectedNotification) {
            await handleMarkAsRead(selectedNotification._id)
            closeDetailsModal()
        }
    })

    $("details-delete-btn")?.addEventListener("click", async () => {
        if (selectedNotification) {
            await handleDeleteNotification(selectedNotification._id)
            closeDetailsModal()
        }
    })

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDetailsModal()
    })
}


/* =========================================================
   Actions
========================================================= */
async function handleMarkAsRead(id) {
    try {
        await markAsRead(id)
        await loadNotifications()
    } catch (error) {
        console.error("Mark read error:", error)
    }
}

async function handleMarkAllAsRead() {
    const btn = $("mark-all-read-btn")
    if (btn) {
        btn.disabled = true
    }

    try {
        await markAllAsRead()
        await loadNotifications()
    } catch (error) {
        console.error("Mark all read error:", error)
        showError(error.message || "تعذر تحديد الكل كمقروء.")
    } finally {
        if (btn) btn.disabled = false
    }
}

async function handleDeleteNotification(id) {
    try {
        await deleteNotification(id)
        await loadNotifications()
    } catch (error) {
        console.error("Delete notification error:", error)
        alert(error.message || "تعذر حذف التنبيه.")
    }
}

async function openDetailsModal(id) {
    const modal = $("details-notification-modal")

    selectedNotification = allNotifications.find(n => n._id === id)
    if (!selectedNotification) {
        try {
            selectedNotification = await getNotificationById(id)
        } catch (error) {
            console.error("Fetch notification failed:", error)
            return
        }
    }

    if (!selectedNotification) return

    const typeInfo = getNotificationTypeInfo(selectedNotification.type)

    setText("details-notif-title", selectedNotification.title)
    setText("details-notif-message", selectedNotification.message)
    setText("details-notif-date", formatDateTime(selectedNotification.createdAt))

    const badge = $("details-notif-type-badge")
    if (badge) {
        badge.textContent = typeInfo.label
        badge.className = `inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${typeInfo.tagClass}`
    }

    const markBtn = $("details-mark-read-btn")
    if (markBtn) {
        if (selectedNotification.isRead) {
            markBtn.classList.add("hidden")
        } else {
            markBtn.classList.remove("hidden")
        }
    }

    modal?.classList.remove("hidden")
    modal?.classList.add("flex")

    // Automatically mark as read when opened if unread
    if (!selectedNotification.isRead) {
        handleMarkAsRead(selectedNotification._id)
    }
}

function closeDetailsModal() {
    const modal = $("details-notification-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
    selectedNotification = null
}


/* =========================================================
   Helpers
========================================================= */
function getNotificationTypeInfo(type) {
    if (type === "announcement") {
        return {
            label: "إعلان",
            bgClass: "bg-blue-50 text-blue-700",
            tagClass: "bg-blue-100 text-blue-800",
            icon: `<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>`
        }
    }
    if (type === "evaluation") {
        return {
            label: "تقييم",
            bgClass: "bg-purple-50 text-purple-700",
            tagClass: "bg-purple-100 text-purple-800",
            icon: `<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`
        }
    }
    if (type === "memorization") {
        return {
            label: "حفظ",
            bgClass: "bg-emerald-50 text-emerald-700",
            tagClass: "bg-emerald-100 text-emerald-800",
            icon: `<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332-.477-4.5 1.253"/></svg>`
        }
    }
    return {
        label: "نظام",
        bgClass: "bg-slate-100 text-slate-700",
        tagClass: "bg-slate-200 text-slate-800",
        icon: `<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    }
}

function formatDateTime(dateValue) {
    if (!dateValue) return "—"
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return "—"

    return new Intl.DateTimeFormat("ar-DZ", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(d)
}

function escapeHTML(str) {
    if (str === null || str === undefined) return ""
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

function showLoading(show) {
    const el = $("notifications-loading")
    if (el) {
        if (show) el.classList.remove("hidden"), el.classList.add("flex")
        else el.classList.add("hidden"), el.classList.remove("flex")
    }
}

function showError(msg) {
    const el = $("notifications-error")
    if (el) {
        el.textContent = msg
        el.classList.remove("hidden")
    }
}

function hideError() {
    const el = $("notifications-error")
    if (el) el.classList.add("hidden")
}


/* =========================================================
   Start
========================================================= */
initPage()
