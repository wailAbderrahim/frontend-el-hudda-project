import { protectPage, getUser, logout } from "../../auth/auth.js"
import { getProfile, updateProfile, changePassword } from "../../api/usersApi.js"
import { getStudentProgress } from "../../api/progressApi.js"
import { getMemorization } from "../../api/memorizationApi.js"
import { getEvaluations } from "../../api/evaluationsApi.js"
import { getAttendances } from "../../api/attendanceApi.js"
import { getAnnouncements } from "../../api/announcementsApi.js"
import { getNotifications, markAllAsRead } from "../../api/notificationsApi.js"
import { initNotificationBell } from "../../components/notificationBell.js"

// Restrict to student role
protectPage("student")

// State
let currentUser = null
let studentProgress = null
let memorizationsList = []
let evaluationsList = []
let attendancesList = []
let announcementsList = []
let notificationsList = []

// DOM Elements
const sidebar = document.getElementById("sidebar")
const sidebarOverlay = document.getElementById("sidebar-overlay")
const menuBtn = document.getElementById("menu-btn")
const logoutBtn = document.getElementById("logout-btn")
const notifBtn = document.getElementById("notif-btn")
const notifBadge = document.getElementById("notif-badge")
const statusAlert = document.getElementById("status-alert")

// Profile header elements
const studentNameEl = document.getElementById("student-name")
const studentAvatarEl = document.getElementById("student-avatar")
const welcomeNameEl = document.getElementById("welcome-name")

// Halaqa Display
const halaqaNameDisplay = document.getElementById("halaqa-name-display")
const teacherNameDisplay = document.getElementById("teacher-name-display")
const halaqaScheduleDisplay = document.getElementById("halaqa-schedule-display")

// Stats elements
const statAttendanceRateEl = document.getElementById("stat-attendance-rate")
const statAttendanceDetailEl = document.getElementById("stat-attendance-detail")
const statMemorizationCountEl = document.getElementById("stat-memorization-count")
const statLastSurahEl = document.getElementById("stat-last-surah")
const statLastVersesEl = document.getElementById("stat-last-verses")
const statAverageEvalEl = document.getElementById("stat-average-eval")
const statEvalCountEl = document.getElementById("stat-eval-count")

// Modal
const modalNotifications = document.getElementById("modal-notifications")

/* ===================================================
   HELPERS & NOTIFICATIONS
=================================================== */
function showAlert(message, type = "success") {
    if (!statusAlert) return
    statusAlert.className = `mb-6 rounded-2xl border p-4 text-sm font-medium shadow-sm transition ${
        type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
    }`
    statusAlert.textContent = message
    statusAlert.classList.remove("hidden")
    window.scrollTo({ top: 0, behavior: "smooth" })
    setTimeout(() => {
        statusAlert.classList.add("hidden")
    }, 4500)
}

function openModal(modal) {
    if (!modal) return
    modal.classList.remove("hidden")
    modal.classList.add("flex")
}

function closeModal(modal) {
    if (!modal) return
    modal.classList.add("hidden")
    modal.classList.remove("flex")
}

function formatDate(dateStr) {
    if (!dateStr) return "-"
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })
}

function getEvaluationTypeLabel(type) {
    const map = {
        hifz: "حفظ",
        murajaah: "مراجعة",
        tilawa: "تلاوة",
        tajweed: "تجويد"
    }
    return map[type] || type
}

function getAttendanceStatusBadge(status) {
    if (status === "present") {
        return '<span class="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">حاضر</span>'
    } else if (status === "late") {
        return '<span class="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">متأخر</span>'
    }
    return '<span class="inline-flex items-center rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">غائب</span>'
}

/* ===================================================
   INITIALIZATION
=================================================== */
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation()
    setupSidebar()
    initNotificationBell()
    setupModals()
    setupFormHandlers()
    await loadInitialData()
})

/* ===================================================
   NAVIGATION & TABS
=================================================== */
function setupNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab")
    const tabContents = document.querySelectorAll(".tab-content")
    const pageTitle = document.getElementById("page-title")
    const pageSubtitle = document.getElementById("page-subtitle")

    const titles = {
        overview: { title: "بوابة الطالب", sub: "متابعة الحفظ والحضور والتقييمات" },
        memorization: { title: "حفظي وتسميعي", sub: "سجل السور والآيات التي قمت بتسميعها" },
        evaluations: { title: "تقييماتي", sub: "تقييمات وتوجيهات الشيخ المعلم" },
        attendance: { title: "سجلي في الحضور", sub: "سجل الالتزام بالحضور والغياب" },
        announcements: { title: "إعلانات المدرسة", sub: "التعميمات والتنبيهات المدرسية" },
        profile: { title: "الملف الشخصي والأمان", sub: "تحديث بياناتك الشخصية وكلمة المرور" }
    }

    window.switchTab = function (targetTab) {
        navTabs.forEach((tab) => {
            const isTarget = tab.dataset.tab === targetTab
            tab.classList.toggle("bg-emerald-50", isTarget)
            tab.classList.toggle("text-emerald-700", isTarget)
            tab.classList.toggle("font-semibold", isTarget)
            tab.classList.toggle("text-slate-600", !isTarget)
        })

        tabContents.forEach((content) => {
            if (content.id === `tab-${targetTab}`) {
                content.classList.remove("hidden")
            } else {
                content.classList.add("hidden")
            }
        })

        if (titles[targetTab]) {
            if (pageTitle) pageTitle.textContent = titles[targetTab].title
            if (pageSubtitle) pageSubtitle.textContent = titles[targetTab].sub
        }

        // Close mobile sidebar
        if (sidebar && !sidebar.classList.contains("translate-x-full")) {
            sidebar.classList.add("translate-x-full")
            if (sidebarOverlay) sidebarOverlay.classList.add("hidden")
        }
    }

    navTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            switchTab(tab.dataset.tab)
        })
    })

    document.querySelectorAll("[data-switch-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
            switchTab(btn.dataset.switchTab)
        })
    })

    const initialHash = window.location.hash.replace("#", "")
    if (initialHash && document.getElementById(`tab-${initialHash}`)) {
        switchTab(initialHash)
    }
}

/* ===================================================
   SIDEBAR & MOBILE
=================================================== */
function setupSidebar() {
    if (menuBtn && sidebar && sidebarOverlay) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.remove("translate-x-full")
            sidebarOverlay.classList.remove("hidden")
        })

        sidebarOverlay.addEventListener("click", () => {
            sidebar.classList.add("translate-x-full")
            sidebarOverlay.classList.add("hidden")
        })
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
                logout()
            }
        })
    }
}

/* ===================================================
   MODALS SETUP
=================================================== */
function setupModals() {
    document.querySelectorAll(".btn-close-modal").forEach((btn) => {
        btn.addEventListener("click", () => {
            const modal = btn.closest(".fixed")
            closeModal(modal)
        })
    })

    if (modalNotifications) {
        modalNotifications.addEventListener("click", (e) => {
            if (e.target === modalNotifications) closeModal(modalNotifications)
        })
    }

    const btnMarkAllRead = document.getElementById("btn-mark-all-read")
    if (btnMarkAllRead) {
        btnMarkAllRead.addEventListener("click", async () => {
            try {
                await markAllAsRead()
                if (notifBadge) notifBadge.classList.add("hidden")
                await loadNotifications()
                renderNotificationsModal()
                showAlert("تم تحديد جميع الإشعارات كمقروءة")
            } catch (err) {
                console.error(err)
            }
        })
    }
}

/* ===================================================
   DATA LOADING
=================================================== */
async function loadInitialData() {
    try {
        currentUser = await getProfile()
        if (currentUser) {
            const displayName = currentUser.name || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "طالب"
            if (studentNameEl) studentNameEl.textContent = displayName
            if (welcomeNameEl) welcomeNameEl.textContent = displayName
            if (studentAvatarEl) studentAvatarEl.textContent = displayName.charAt(0)

            // Fill profile form
            const profName = document.getElementById("prof-name")
            const profFirstName = document.getElementById("prof-firstname")
            const profLastName = document.getElementById("prof-lastname")
            const profEmail = document.getElementById("prof-email")
            const profPhone = document.getElementById("prof-phone")

            if (profName) profName.value = currentUser.name || ""
            if (profFirstName) profFirstName.value = currentUser.firstName || ""
            if (profLastName) profLastName.value = currentUser.lastName || ""
            if (profEmail) profEmail.value = currentUser.email || ""
            if (profPhone) profPhone.value = currentUser.phone || ""
        }

        // 1. Fetch Student Progress
        try {
            const progressRes = await getStudentProgress(currentUser._id)
            studentProgress = progressRes?.data || progressRes
        } catch (progErr) {
            console.warn("Could not fetch student progress summary:", progErr)
        }

        // 2. Fetch Memorizations
        try {
            const memRes = await getMemorization()
            memorizationsList = Array.isArray(memRes) ? memRes : memRes?.data || []
        } catch (memErr) {
            console.warn(memErr)
        }

        // 3. Fetch Evaluations
        try {
            const evalRes = await getEvaluations()
            evaluationsList = Array.isArray(evalRes) ? evalRes : evalRes?.data || []
        } catch (evalErr) {
            console.warn(evalErr)
        }

        // 4. Fetch Attendances
        try {
            const attRes = await getAttendances()
            attendancesList = Array.isArray(attRes) ? attRes : attRes?.data || []
        } catch (attErr) {
            console.warn(attErr)
        }

        // 5. Fetch Announcements
        try {
            const annRes = await getAnnouncements()
            announcementsList = Array.isArray(annRes) ? annRes : annRes?.data || []
        } catch (annErr) {
            console.warn(annErr)
        }

        // 6. Notifications
        await loadNotifications()

        // Render Everything
        renderOverview()
        renderMemorizationTab()
        renderEvaluationsTab()
        renderAttendanceTab()
        renderAnnouncementsTab()

    } catch (err) {
        console.error("Error loading student data:", err)
        showAlert("حدث خطأ أثناء تحميل البيانات: " + err.message, "error")
    }
}

async function loadNotifications() {
    try {
        const notifRes = await getNotifications()
        notificationsList = Array.isArray(notifRes) ? notifRes : notifRes?.data || []
        const unread = notificationsList.filter((n) => !n.isRead)
        if (notifBadge) {
            notifBadge.classList.toggle("hidden", unread.length === 0)
        }
    } catch (err) {
        console.error(err)
    }
}

/* ===================================================
   TAB 1: OVERVIEW RENDERING
=================================================== */
function renderOverview() {
    // Halaqa & Teacher display
    const halaqa = studentProgress?.halaqa
    if (halaqa) {
        if (halaqaNameDisplay) halaqaNameDisplay.textContent = halaqa.name || "حلقة غير مسماة"
        if (halaqaScheduleDisplay) halaqaScheduleDisplay.textContent = halaqa.schedule || "غير محدد"
        if (teacherNameDisplay) {
            const t = halaqa.teacher
            teacherNameDisplay.textContent = t ? (t.name || "الشيخ المعلم") : "لم يحدد"
        }
    } else {
        if (halaqaNameDisplay) halaqaNameDisplay.textContent = "غير ملتحق بحلقة حالياً"
        if (teacherNameDisplay) teacherNameDisplay.textContent = "-"
        if (halaqaScheduleDisplay) halaqaScheduleDisplay.textContent = "-"
    }

    // Attendance stats
    const att = studentProgress?.attendance || {}
    const totalAtt = att.total || attendancesList.length || 0
    const presentCount = att.present ?? attendancesList.filter((a) => a.status === "present").length
    const attRate = att.attendanceRate !== undefined
        ? att.attendanceRate
        : totalAtt === 0 ? 0 : Math.round((presentCount / totalAtt) * 100)

    if (statAttendanceRateEl) statAttendanceRateEl.textContent = `${attRate}%`
    if (statAttendanceDetailEl) statAttendanceDetailEl.textContent = `حاضر ${presentCount} من ${totalAtt} حصة`

    // Memorization stats
    const memTotal = studentProgress?.memorization?.total ?? memorizationsList.length
    if (statMemorizationCountEl) statMemorizationCountEl.textContent = memTotal

    const lastMem = studentProgress?.memorization?.last || (memorizationsList.length > 0 ? memorizationsList[0] : null)
    if (lastMem) {
        if (statLastSurahEl) statLastSurahEl.textContent = `سورة ${lastMem.surah}`
        if (statLastVersesEl) statLastVersesEl.textContent = `الآيات: من ${lastMem.fromVerse} إلى ${lastMem.toVerse}`
    } else {
        if (statLastSurahEl) statLastSurahEl.textContent = "لا يوجد بعد"
        if (statLastVersesEl) statLastVersesEl.textContent = "الآيات: -"
    }

    // Evaluation stats
    const evTotal = studentProgress?.evaluations?.total ?? evaluationsList.length
    const evScore = studentProgress?.evaluations?.averageScore ??
        (evTotal === 0 ? 0 : evaluationsList.reduce((s, e) => s + (e.score || 0), 0) / evTotal)

    if (statAverageEvalEl) statAverageEvalEl.textContent = `${Number(evScore).toFixed(1)} / 10`
    if (statEvalCountEl) statEvalCountEl.textContent = `${evTotal} تقييم مسجل`

    // Overview recent memorization table
    const overviewMemBody = document.getElementById("overview-memorization-body")
    if (overviewMemBody) {
        if (memorizationsList.length === 0) {
            overviewMemBody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-xs text-slate-400">لا توجد جلسات تسميع مسجلة بعد</td></tr>`
        } else {
            overviewMemBody.innerHTML = memorizationsList.slice(0, 5).map((m) => `
                <tr class="hover:bg-slate-50/50">
                    <td class="py-3 font-semibold text-emerald-700">سورة ${m.surah}</td>
                    <td class="py-3 text-xs text-slate-500">${m.fromVerse}</td>
                    <td class="py-3 text-xs text-slate-500">${m.toVerse}</td>
                    <td class="py-3 text-xs text-slate-400">${formatDate(m.date)}</td>
                </tr>
            `).join("")
        }
    }

    // Overview announcements list
    const annListEl = document.getElementById("overview-announcements-list")
    if (annListEl) {
        if (announcementsList.length === 0) {
            annListEl.innerHTML = `<p class="py-4 text-center text-xs text-slate-400">لا توجد إعلانات حالياً</p>`
        } else {
            annListEl.innerHTML = announcementsList.slice(0, 4).map((a) => `
                <div class="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                    <div class="flex items-center justify-between">
                        <h4 class="font-bold text-slate-800 text-sm">${a.title}</h4>
                        <span class="text-[10px] text-slate-400">${formatDate(a.createdAt || a.date)}</span>
                    </div>
                    <p class="mt-1 line-clamp-2 text-xs text-slate-500 leading-relaxed">${a.message || a.content || ""}</p>
                </div>
            `).join("")
        }
    }
}

/* ===================================================
   TAB 2: MEMORIZATION
=================================================== */
function renderMemorizationTab() {
    const bodyEl = document.getElementById("student-memorization-body")
    const searchInput = document.getElementById("memorization-search")
    if (!bodyEl) return

    function renderFiltered() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : ""
        let list = memorizationsList
        if (query) {
            list = list.filter((m) => m.surah && m.surah.toLowerCase().includes(query))
        }

        if (list.length === 0) {
            bodyEl.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">لا توجد سجلات تسميع مطابقة للبحث</td></tr>`
            return
        }

        bodyEl.innerHTML = list.map((m) => {
            const count = (m.toVerse - m.fromVerse + 1) || 1
            return `
            <tr class="hover:bg-slate-50/50">
                <td class="px-6 py-4 font-bold text-emerald-700 text-base">سورة ${m.surah}</td>
                <td class="px-6 py-4 text-sm text-slate-700">${m.fromVerse}</td>
                <td class="px-6 py-4 text-sm text-slate-700">${m.toVerse}</td>
                <td class="px-6 py-4 text-xs font-semibold text-slate-500">${count} آيات</td>
                <td class="px-6 py-4 text-xs text-slate-400">${formatDate(m.date)}</td>
            </tr>
        `}).join("")
    }

    if (searchInput) {
        searchInput.addEventListener("input", renderFiltered)
    }

    renderFiltered()
}

/* ===================================================
   TAB 3: EVALUATIONS
=================================================== */
function renderEvaluationsTab() {
    const bodyEl = document.getElementById("student-evaluations-body")
    if (!bodyEl) return

    if (evaluationsList.length === 0) {
        bodyEl.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-xs text-slate-400">لا توجد تقييمات مسجلة لك حتى الآن</td></tr>`
        return
    }

    bodyEl.innerHTML = evaluationsList.map((e) => {
        const score = Number(e.score) || 0
        const scoreClass = score >= 8 ? "bg-emerald-50 text-emerald-700" : score >= 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
        return `
        <tr class="hover:bg-slate-50/50">
            <td class="px-6 py-4 font-semibold text-slate-800">${getEvaluationTypeLabel(e.type)}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold ${scoreClass}">
                    ${score} / 10
                </span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-600 leading-relaxed">${e.notes || "لا توجد ملاحظات"}</td>
            <td class="px-6 py-4 text-xs text-slate-400">${formatDate(e.date)}</td>
        </tr>
    `}).join("")
}

/* ===================================================
   TAB 4: ATTENDANCE
=================================================== */
function renderAttendanceTab() {
    const bodyEl = document.getElementById("student-attendance-body")
    const presentEl = document.getElementById("att-present-count")
    const lateEl = document.getElementById("att-late-count")
    const absentEl = document.getElementById("att-absent-count")

    const present = attendancesList.filter((a) => a.status === "present").length
    const late = attendancesList.filter((a) => a.status === "late").length
    const absent = attendancesList.filter((a) => a.status === "absent").length

    if (presentEl) presentEl.textContent = present
    if (lateEl) lateEl.textContent = late
    if (absentEl) absentEl.textContent = absent

    if (!bodyEl) return

    if (attendancesList.length === 0) {
        bodyEl.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-xs text-slate-400">لا توجد سجلات حضور مسجلة</td></tr>`
        return
    }

    bodyEl.innerHTML = attendancesList.map((a) => `
        <tr class="hover:bg-slate-50/50">
            <td class="px-6 py-4 text-xs text-slate-600">${formatDate(a.date)}</td>
            <td class="px-6 py-4 text-xs font-medium text-slate-700">${a.halaqa?.name || "-"}</td>
            <td class="px-6 py-4">${getAttendanceStatusBadge(a.status)}</td>
        </tr>
    `).join("")
}

/* ===================================================
   TAB 5: ANNOUNCEMENTS
=================================================== */
function renderAnnouncementsTab() {
    const gridEl = document.getElementById("student-announcements-grid")
    if (!gridEl) return

    if (announcementsList.length === 0) {
        gridEl.innerHTML = `
            <div class="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
                لا توجد إعلانات منشورة حالياً
            </div>`
        return
    }

    gridEl.innerHTML = announcementsList.map((a) => `
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div class="flex items-center justify-between">
                <span class="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">إعلان رسمي</span>
                <span class="text-xs text-slate-400">${formatDate(a.createdAt || a.date)}</span>
            </div>
            <h3 class="mt-3 text-base font-bold text-slate-800">${a.title}</h3>
            <p class="mt-2 text-sm text-slate-600 leading-relaxed">${a.message || a.content || ""}</p>
        </div>
    `).join("")
}

/* ===================================================
   NOTIFICATIONS MODAL
=================================================== */
function renderNotificationsModal() {
    const listEl = document.getElementById("modal-notif-list")
    if (!listEl) return

    if (notificationsList.length === 0) {
        listEl.innerHTML = `<p class="py-6 text-center text-xs text-slate-400">لا توجد إشعارات</p>`
        return
    }

    listEl.innerHTML = notificationsList.map((n) => `
        <div class="rounded-xl border ${n.isRead ? "border-slate-100 bg-slate-50" : "border-emerald-100 bg-emerald-50/40"} p-3">
            <div class="flex items-center justify-between">
                <h4 class="font-bold text-xs text-slate-800">${n.title || "إشعار"}</h4>
                <span class="text-[10px] text-slate-400">${formatDate(n.createdAt)}</span>
            </div>
            <p class="mt-1 text-xs text-slate-600">${n.message || ""}</p>
        </div>
    `).join("")
}

/* ===================================================
   FORM HANDLERS
=================================================== */
function setupFormHandlers() {
    // 1. Profile Form
    const formProfile = document.getElementById("profile-form")
    if (formProfile) {
        formProfile.addEventListener("submit", async (e) => {
            e.preventDefault()
            const name = document.getElementById("prof-name").value.trim()
            const firstName = document.getElementById("prof-firstname").value.trim()
            const lastName = document.getElementById("prof-lastname").value.trim()
            const phone = document.getElementById("prof-phone").value.trim()

            try {
                const updated = await updateProfile({ name, firstName, lastName, phone })
                currentUser = updated
                const displayName = currentUser.name || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
                if (studentNameEl) studentNameEl.textContent = displayName
                if (welcomeNameEl) welcomeNameEl.textContent = displayName
                showAlert("تم تحديث البيانات الشخصية بنجاح")
            } catch (err) {
                showAlert("فشل تحديث البيانات: " + err.message, "error")
            }
        })
    }

    // 2. Password Form
    const formPass = document.getElementById("password-form")
    if (formPass) {
        formPass.addEventListener("submit", async (e) => {
            e.preventDefault()
            const currentPassword = document.getElementById("pass-current").value
            const newPassword = document.getElementById("pass-new").value
            const confirmPassword = document.getElementById("pass-confirm").value

            if (newPassword !== confirmPassword) {
                showAlert("كلمة المرور الجديدة وتأكيدها غير متطابقين", "error")
                return
            }

            try {
                await changePassword(currentPassword, newPassword)
                showAlert("تم تحديث كلمة المرور بنجاح")
                formPass.reset()
            } catch (err) {
                showAlert("فشل تحديث كلمة المرور: " + err.message, "error")
            }
        })
    }
}