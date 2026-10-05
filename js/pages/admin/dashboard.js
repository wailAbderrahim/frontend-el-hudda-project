
import { protectPage, getUser, logout } from "../../auth/auth.js"
import { getDashboardStats } from "../../api/dashboardApi.js"
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from "../../api/notificationsApi.js"


/* =========================================================
   Protect Page
========================================================= */

protectPage("admin")


/* =========================================================
   Elements
========================================================= */

let menuBtn
let sidebar
let overlay
let logoutBtn


/* =========================================================
   Sidebar State
========================================================= */

function openSidebar() {

    if (!sidebar || !overlay) return

    sidebar.classList.remove("translate-x-full")
    overlay.classList.remove("hidden")

    document.body.classList.add("overflow-hidden")
}


function closeSidebar() {

    if (!sidebar || !overlay) return

    sidebar.classList.add("translate-x-full")
    overlay.classList.add("hidden")

    document.body.classList.remove("overflow-hidden")
}


function toggleSidebar() {

    if (!sidebar) return

    const isClosed = sidebar.classList.contains("translate-x-full")

    if (isClosed) {
        openSidebar()
    } else {
        closeSidebar()
    }
}


/* =========================================================
   Setup Mobile Sidebar
========================================================= */

function setupSidebar() {

    menuBtn = document.getElementById("menu-btn")
    sidebar = document.getElementById("sidebar")
    overlay = document.getElementById("sidebar-overlay")
    logoutBtn = document.getElementById("logout-btn")


    console.log("Sidebar elements:", {
        menuBtn,
        sidebar,
        overlay,
        logoutBtn
    })


    /* -----------------------------------------------------
       Check Elements
    ----------------------------------------------------- */

    if (!menuBtn) {
        console.error("❌ menu-btn not found")
    }

    if (!sidebar) {
        console.error("❌ sidebar not found")
    }

    if (!overlay) {
        console.error("❌ sidebar-overlay not found")
    }


    /* -----------------------------------------------------
       Mobile Menu Button
    ----------------------------------------------------- */

    if (menuBtn && sidebar && overlay) {

        menuBtn.addEventListener("click", function (event) {

            event.preventDefault()
            event.stopPropagation()

            toggleSidebar()

        })

    }


    /* -----------------------------------------------------
       Overlay
    ----------------------------------------------------- */

    if (overlay) {

        overlay.addEventListener("click", function () {

            closeSidebar()

        })

    }


    /* -----------------------------------------------------
       Sidebar Links
    ----------------------------------------------------- */

    if (sidebar) {

        const links = sidebar.querySelectorAll("a")

        links.forEach(link => {

            link.addEventListener("click", function () {

                closeSidebar()

            })

        })

    }


    /* -----------------------------------------------------
       ESC Key
    ----------------------------------------------------- */

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            closeSidebar()

        }

    })


    /* -----------------------------------------------------
       Resize Protection
       Close sidebar when moving to desktop
    ----------------------------------------------------- */

    window.addEventListener("resize", function () {

        if (window.innerWidth >= 1024) {

            closeSidebar()

        }

    })


    /* -----------------------------------------------------
       Logout
    ----------------------------------------------------- */

    if (logoutBtn) {

        logoutBtn.addEventListener("click", function () {

            const confirmed = confirm(
                "هل أنت متأكد من رغبتك في تسجيل الخروج؟"
            )

            if (!confirmed) return

            try {

                logout()

            } catch (error) {

                console.error(
                    "Logout failed:",
                    error
                )

            }

        })

    }

}


/* =========================================================
   Load Dashboard Statistics
========================================================= */

async function loadDashboardStatsData() {

    const loading = document.getElementById("dashboard-loading")
    const errorBox = document.getElementById("dashboard-error")


    try {

        /* ---------------------------------------------
           Loading
        --------------------------------------------- */

        if (loading) {

            loading.classList.remove("hidden")

        }


        if (errorBox) {

            errorBox.classList.add("hidden")
            errorBox.textContent = ""

        }


        /* ---------------------------------------------
           API Request
        --------------------------------------------- */

        const stats = await getDashboardStats()


        if (!stats) {

            throw new Error(
                "لم يتم استلام بيانات من الخادم"
            )

        }


        console.log(
            "Dashboard statistics:",
            stats
        )


        /* ---------------------------------------------
           Helper
        --------------------------------------------- */

        function setValue(id, value) {

            const element =
                document.getElementById(id)

            if (!element) return


            if (
                value !== undefined &&
                value !== null
            ) {

                element.textContent = value

            } else {

                element.textContent = "0"

            }

        }


        /* ---------------------------------------------
           Main Statistics
        --------------------------------------------- */

        setValue(
            "students-count",
            stats.students
        )


        setValue(
            "teachers-count",
            stats.teachers
        )


        setValue(
            "halaqas-count",
            stats.halaqas
        )


        setValue(
            "attendance-rate",
            `${stats.attendanceRate ?? 0}%`
        )


        setValue(
            "memorizations-count",
            stats.memorizations
        )


        setValue(
            "evaluations-count",
            stats.evaluations
        )


        /* ---------------------------------------------
           Overview
        --------------------------------------------- */

        setValue(
            "overview-students",
            stats.students
        )


        setValue(
            "overview-teachers",
            stats.teachers
        )


        setValue(
            "overview-halaqas",
            stats.halaqas
        )

    } catch (error) {

        console.error(
            "Failed to load dashboard:",
            error
        )


        if (errorBox) {

            errorBox.textContent =
                "تعذر تحميل بيانات لوحة التحكم. " +
                (
                    error.message ||
                    "حاول تحديث الصفحة."
                )

            errorBox.classList.remove("hidden")

        }

    } finally {

        if (loading) {

            loading.classList.add("hidden")

        }

    }

}


/* =========================================================
   Load Admin Information
========================================================= */

function loadAdminInfo() {

    try {

        const user = getUser()


        if (!user) {

            console.warn(
                "No admin user found"
            )

            return

        }


        const adminName =
            document.getElementById("admin-name")


        const adminAvatar =
            document.getElementById("admin-avatar")


        /* ---------------------------------------------
           Determine Name
        --------------------------------------------- */

        const fullName =
            user.name ||
            `${user.firstName || ""} ${user.lastName || ""}`
                .trim() ||
            "المدير"


        /* ---------------------------------------------
           Name
        --------------------------------------------- */

        if (adminName) {

            adminName.textContent =
                fullName

        }


        /* ---------------------------------------------
           Avatar
        --------------------------------------------- */

        if (adminAvatar) {

            adminAvatar.textContent =
                fullName.charAt(0)

        }

    } catch (error) {

        console.error(
            "Failed to load admin info:",
            error
        )

    }

}


/* =========================================================
   Notifications Dropdown Module
========================================================= */

let dashboardNotifications = []

function getNotificationTypeMeta(type) {
    if (type === "announcement") {
        return {
            label: "إعلان",
            bgClass: "bg-blue-50 text-blue-700",
            icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>`
        }
    }
    if (type === "evaluation") {
        return {
            label: "تقييم",
            bgClass: "bg-purple-50 text-purple-700",
            icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`
        }
    }
    if (type === "memorization") {
        return {
            label: "حفظ",
            bgClass: "bg-emerald-50 text-emerald-700",
            icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332-.477-4.5 1.253"/></svg>`
        }
    }
    return {
        label: "نظام",
        bgClass: "bg-slate-100 text-slate-700",
        icon: `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    }
}

function formatNotificationTime(dateValue) {
    if (!dateValue) return "—"
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return "—"

    const now = new Date()
    const diffMs = now - d
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffMin < 1) return "الآن"
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`
    if (diffHour < 24) return `منذ ${diffHour} ساعة`
    if (diffDay < 7) return `منذ ${diffDay} يوم`

    return new Intl.DateTimeFormat("ar-DZ", {
        month: "short",
        day: "numeric"
    }).format(d)
}

function escapeHtml(str) {
    if (!str) return ""
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function updateNotificationBadges() {
    const notifBadge = document.getElementById("notif-badge")
    const notifCountBadge = document.getElementById("notif-count-badge")
    const unreadCount = dashboardNotifications.filter(n => !n.isRead).length

    if (notifBadge) {
        if (unreadCount > 0) {
            notifBadge.textContent = unreadCount > 99 ? "99+" : unreadCount
            notifBadge.classList.remove("hidden")
        } else {
            notifBadge.classList.add("hidden")
        }
    }

    if (notifCountBadge) {
        notifCountBadge.textContent = `${unreadCount} جديد`
    }
}

function renderNotificationsDropdownList() {
    const listEl = document.getElementById("notif-list")
    if (!listEl) return

    if (dashboardNotifications.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <svg class="h-8 w-8 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.5-2V9a6.5 6.5 0 00-13 0v6L4 17h5m6 0a3 3 0 01-6 0" />
                </svg>
                <p class="text-xs font-medium">لا توجد إشعارات حالياً</p>
            </div>
        `
        return
    }

    // Sort: unread first, then by date descending
    const sorted = [...dashboardNotifications].sort((a, b) => {
        if (a.isRead === b.isRead) {
            return new Date(b.createdAt) - new Date(a.createdAt)
        }
        return a.isRead ? 1 : -1
    })

    listEl.innerHTML = sorted.map(item => {
        const meta = getNotificationTypeMeta(item.type)
        const unreadClass = !item.isRead ? "bg-emerald-50/50 hover:bg-emerald-50" : "bg-white hover:bg-slate-50"
        const timeStr = formatNotificationTime(item.createdAt)

        return `
            <div
                class="group relative flex items-start gap-3 p-3.5 transition ${unreadClass} border-b border-slate-100 last:border-0"
                data-id="${item._id}">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bgClass}">
                    ${meta.icon}
                </div>
                <div class="flex-1 min-w-0 pr-0.5">
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <div class="flex items-center gap-1.5 min-w-0">
                            ${!item.isRead ? '<span class="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0"></span>' : ''}
                            <h5 class="text-xs font-bold text-slate-800 truncate ${!item.isRead ? 'text-emerald-950 font-black' : ''}">
                                ${escapeHtml(item.title)}
                            </h5>
                        </div>
                        <span class="text-[10px] text-slate-400 shrink-0">${timeStr}</span>
                    </div>
                    <p class="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        ${escapeHtml(item.message)}
                    </p>
                    <div class="mt-2 flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-500">${meta.label}</span>
                        <div class="flex items-center gap-1">
                            ${!item.isRead ? `
                                <button
                                    type="button"
                                    data-action="mark-read"
                                    data-id="${item._id}"
                                    class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline px-1.5 py-0.5 rounded transition"
                                    title="تحديد كمقروء">
                                    قراءة
                                </button>
                            ` : ''}
                            <button
                                type="button"
                                data-action="delete"
                                data-id="${item._id}"
                                class="text-slate-400 hover:text-red-600 p-1 rounded transition opacity-70 group-hover:opacity-100"
                                title="حذف التنبيه">
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

async function fetchDashboardNotifications() {
    const listEl = document.getElementById("notif-list")
    try {
        const data = await getNotifications()
        dashboardNotifications = Array.isArray(data) ? data : []
        updateNotificationBadges()
        renderNotificationsDropdownList()
    } catch (error) {
        console.error("Failed to fetch dashboard notifications:", error)
        if (listEl) {
            listEl.innerHTML = `
                <div class="p-6 text-center text-xs text-red-500">
                    تعذر تحميل الإشعارات
                </div>
            `
        }
    }
}

function setupNotifications() {
    const notifBtn = document.getElementById("notif-btn")
    const notifDropdown = document.getElementById("notif-dropdown")
    const notifContainer = document.getElementById("notif-container")
    const notifMarkAll = document.getElementById("notif-mark-all")
    const notifList = document.getElementById("notif-list")

    if (!notifBtn || !notifDropdown) return

    function toggleDropdown() {
        const isHidden = notifDropdown.classList.contains("hidden")
        if (isHidden) {
            notifDropdown.classList.remove("hidden")
            notifBtn.setAttribute("aria-expanded", "true")
            fetchDashboardNotifications()
        } else {
            notifDropdown.classList.add("hidden")
            notifBtn.setAttribute("aria-expanded", "false")
        }
    }

    function closeDropdown() {
        if (!notifDropdown.classList.contains("hidden")) {
            notifDropdown.classList.add("hidden")
            notifBtn.setAttribute("aria-expanded", "false")
        }
    }

    notifBtn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleDropdown()
    })

    // Close on click outside
    document.addEventListener("click", (e) => {
        if (notifContainer && !notifContainer.contains(e.target)) {
            closeDropdown()
        }
    })

    // Close on ESC
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeDropdown()
        }
    })

    // Mark all as read button
    if (notifMarkAll) {
        notifMarkAll.addEventListener("click", async (e) => {
            e.preventDefault()
            e.stopPropagation()
            try {
                notifMarkAll.disabled = true
                await markAllAsRead()
                dashboardNotifications.forEach(n => { n.isRead = true })
                updateNotificationBadges()
                renderNotificationsDropdownList()
            } catch (err) {
                console.error("Mark all read failed:", err)
            } finally {
                notifMarkAll.disabled = false
            }
        })
    }

    // Event delegation on list for mark-read and delete actions
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
                    const item = dashboardNotifications.find(n => n._id === id)
                    if (item) item.isRead = true
                    updateNotificationBadges()
                    renderNotificationsDropdownList()
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
                    dashboardNotifications = dashboardNotifications.filter(n => n._id !== id)
                    updateNotificationBadges()
                    renderNotificationsDropdownList()
                } catch (err) {
                    console.error("Delete notification failed:", err)
                }
                return
            }
        })
    }

    // Initial background load for badge count
    fetchDashboardNotifications()
}


/* =========================================================
   Initialize Dashboard
========================================================= */

function initializeDashboard() {

    console.log(
        "Initializing admin dashboard..."
    )


    setupSidebar()

    setupNotifications()

    loadAdminInfo()

    loadDashboardStatsData()


    console.log(
        "Admin dashboard initialized successfully"
    )

}


/* =========================================================
   Start
========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        { once: true }
    )

} else {

    initializeDashboard()

}

