import { protectPage, getUser, logout } from "../../auth/auth.js"
import { getProfile, updateProfile, changePassword } from "../../api/usersApi.js"
import { getHalaqas } from "../../api/halaqaApi.js"
import { getAttendances, createAttendance, updateAttendance, deleteAttendance } from "../../api/attendanceApi.js"
import { getMemorization, createMemorization, deleteMemorization } from "../../api/memorizationApi.js"
import { getEvaluations, createEvaluation, deleteEvaluation } from "../../api/evaluationsApi.js"
import { getAnnouncements } from "../../api/announcementsApi.js"
import { getNotifications, markAllAsRead } from "../../api/notificationsApi.js"
import { getStudentProgress } from "../../api/progressApi.js"
import { initNotificationBell } from "../../components/notificationBell.js"

// Ensure access is restricted to teachers
protectPage("teacher")

// State
let currentUser = null
let myHalaqas = []
let myStudents = []
let myAttendances = []
let myMemorizations = []
let myEvaluations = []
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
const teacherNameEl = document.getElementById("teacher-name")
const teacherAvatarEl = document.getElementById("teacher-avatar")
const welcomeNameEl = document.getElementById("welcome-name")

// Stats elements
const statHalaqasEl = document.getElementById("stat-halaqas-count")
const statStudentsEl = document.getElementById("stat-students-count")
const statTodayAttEl = document.getElementById("stat-today-attendance")
const statTodayMemEl = document.getElementById("stat-today-memorization")

// Modals
const modalAttendance = document.getElementById("modal-attendance")
const modalMemorization = document.getElementById("modal-memorization")
const modalEvaluation = document.getElementById("modal-evaluation")
const modalStudentProgress = document.getElementById("modal-student-progress")
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
        overview: { title: "لوحة تحكم المعلم", sub: "متابعة الحلقات والطلاب والتحفيظ اليومي" },
        halaqas: { title: "حلقاتي وطلابي", sub: "قائمة الحلقات المسندة إليك والطلاب المسجلين فيها" },
        attendance: { title: "سجل حضور الطلاب", sub: "تسجيل ومتابعة حضور وغياب وتأخر الطلاب" },
        memorization: { title: "جلسات التسميع والحفظ", sub: "توثيق حفظ الطلاب وسور القرآن الكريم والآيات" },
        evaluations: { title: "تقييمات الطلاب", sub: "تسجيل التقييمات في الحفظ والمراجعة والتلاوة والتجويد" },
        announcements: { title: "إعلانات المدرسة", sub: "التعميمات والتنبيهات الصادرة عن إدارة المدرسة" },
        profile: { title: "الملف الشخصي والأمان", sub: "تحديث بياناتك الشخصية وكلمة المرور الخاصة بحسابك" }
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

        // Close sidebar on mobile if open
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
    // Close modal buttons
    document.querySelectorAll(".btn-close-modal").forEach((btn) => {
        btn.addEventListener("click", () => {
            const modal = btn.closest(".fixed")
            closeModal(modal)
        })
    })

    // Click outside modal backdrop to close
    ;[modalAttendance, modalMemorization, modalEvaluation, modalStudentProgress, modalNotifications].forEach((m) => {
        if (!m) return
        m.addEventListener("click", (e) => {
            if (e.target === m) closeModal(m)
        })
    })

    // Quick action buttons
    const btnQuickAtt = document.getElementById("btn-quick-attendance")
    const btnOpenCreateAtt = document.getElementById("btn-open-create-attendance")
    if (btnQuickAtt) btnQuickAtt.addEventListener("click", () => openCreateAttendanceModal())
    if (btnOpenCreateAtt) btnOpenCreateAtt.addEventListener("click", () => openCreateAttendanceModal())

    const btnQuickMem = document.getElementById("btn-quick-memorization")
    const btnOpenCreateMem = document.getElementById("btn-open-create-memorization")
    if (btnQuickMem) btnQuickMem.addEventListener("click", () => openCreateMemorizationModal())
    if (btnOpenCreateMem) btnOpenCreateMem.addEventListener("click", () => openCreateMemorizationModal())

    const btnQuickEval = document.getElementById("btn-quick-evaluation")
    const btnOpenCreateEval = document.getElementById("btn-open-create-evaluation")
    if (btnQuickEval) btnQuickEval.addEventListener("click", () => openCreateEvaluationModal())
    if (btnOpenCreateEval) btnOpenCreateEval.addEventListener("click", () => openCreateEvaluationModal())

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
        // Load User Profile
        currentUser = await getProfile()
        if (currentUser) {
            const displayName = currentUser.name || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "المعلم"
            if (teacherNameEl) teacherNameEl.textContent = displayName
            if (welcomeNameEl) welcomeNameEl.textContent = displayName
            if (teacherAvatarEl) teacherAvatarEl.textContent = displayName.charAt(0)

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

        // Fetch Halaqas
        const halaqasResponse = await getHalaqas()
        const allHalaqas = Array.isArray(halaqasResponse) ? halaqasResponse : halaqasResponse?.data || []
        
        // Filter halaqas for this teacher
        myHalaqas = allHalaqas.filter((h) => {
            if (!h.teacher) return false
            const tId = h.teacher._id ? h.teacher._id.toString() : h.teacher.toString()
            return tId === currentUser._id.toString()
        })

        // Collect all distinct students
        const studentMap = new Map()
        myHalaqas.forEach((h) => {
            if (Array.isArray(h.students)) {
                h.students.forEach((s) => {
                    if (s && s._id) {
                        studentMap.set(s._id.toString(), { ...s, halaqaName: h.name, halaqaId: h._id })
                    }
                })
            }
        })
        myStudents = Array.from(studentMap.values())

        // Fetch Attendance
        const attResponse = await getAttendances()
        myAttendances = Array.isArray(attResponse) ? attResponse : attResponse?.data || []

        // Fetch Memorization
        const memResponse = await getMemorization()
        myMemorizations = Array.isArray(memResponse) ? memResponse : memResponse?.data || []

        // Fetch Evaluations
        const evalResponse = await getEvaluations()
        myEvaluations = Array.isArray(evalResponse) ? evalResponse : evalResponse?.data || []

        // Fetch Announcements
        const annResponse = await getAnnouncements()
        announcementsList = Array.isArray(annResponse) ? annResponse : annResponse?.data || []

        // Fetch Notifications
        await loadNotifications()

        // Render everything
        renderStats()
        renderOverview()
        renderHalaqasAndStudents()
        renderAttendanceTable()
        renderMemorizationTable()
        renderEvaluationsTable()
        renderAnnouncements()
        populateDropdowns()

    } catch (err) {
        console.error("Error loading teacher data:", err)
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
   RENDER STATS & OVERVIEW
=================================================== */
function renderStats() {
    if (statHalaqasEl) statHalaqasEl.textContent = myHalaqas.length
    if (statStudentsEl) statStudentsEl.textContent = myStudents.length

    // Today's attendance
    const todayStr = new Date().toISOString().split("T")[0]
    const todayAtt = myAttendances.filter((a) => a.date && a.date.startsWith(todayStr))
    if (statTodayAttEl) statTodayAttEl.textContent = todayAtt.length

    // Today's memorizations
    const todayMem = myMemorizations.filter((m) => m.date && m.date.startsWith(todayStr))
    if (statTodayMemEl) statTodayMemEl.textContent = todayMem.length
}

function renderOverview() {
    // Recent Memorizations (first 5)
    const memBody = document.getElementById("overview-memorization-body")
    if (memBody) {
        if (myMemorizations.length === 0) {
            memBody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-xs text-slate-400">لا توجد تسميعات مسجلة بعد</td></tr>`
        } else {
            memBody.innerHTML = myMemorizations.slice(0, 5).map((m) => `
                <tr class="hover:bg-slate-50/50">
                    <td class="py-3 font-semibold text-slate-800">${m.student?.name || "طالب"}</td>
                    <td class="py-3 text-emerald-700 font-medium">سورة ${m.surah || "-"}</td>
                    <td class="py-3 text-slate-500">${m.fromVerse} - ${m.toVerse}</td>
                    <td class="py-3 text-xs text-slate-400">${formatDate(m.date)}</td>
                </tr>
            `).join("")
        }
    }

    // Announcements column
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
   TAB 2: HALAQAS & STUDENTS
=================================================== */
function renderHalaqasAndStudents() {
    const halaqasGrid = document.getElementById("teacher-halaqas-grid")
    if (halaqasGrid) {
        if (myHalaqas.length === 0) {
            halaqasGrid.innerHTML = `
                <div class="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
                    لم يتم إسناد أي حلقة لك حتى الآن من قبل الإدارة
                </div>`
        } else {
            halaqasGrid.innerHTML = myHalaqas.map((h) => {
                const count = Array.isArray(h.students) ? h.students.length : 0
                return `
                <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                    <div class="flex items-start justify-between">
                        <div>
                            <span class="inline-block rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">حلقة قرآنية</span>
                            <h3 class="mt-2 text-base font-bold text-slate-800">${h.name}</h3>
                        </div>
                        <span class="inline-flex items-center rounded-full ${h.isActive !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"} px-2.5 py-0.5 text-xs font-medium">
                            ${h.isActive !== false ? "نشطة" : "متوقفة"}
                        </span>
                    </div>
                    <p class="mt-2 text-xs text-slate-500">
                        <span class="font-semibold text-slate-700">الموعد:</span> ${h.schedule || "غير محدد"}
                    </p>
                    <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span class="font-medium text-slate-500">عدد الطلاب المسجلين:</span>
                        <span class="font-bold text-emerald-700">${count} طالب</span>
                    </div>
                </div>`
            }).join("")
        }
    }

    renderStudentsTable()
}

function renderStudentsTable(filterHalaqaId = "", searchKeyword = "") {
    const studentsBody = document.getElementById("teacher-students-body")
    if (!studentsBody) return

    let list = myStudents
    if (filterHalaqaId) {
        list = list.filter((s) => s.halaqaId?.toString() === filterHalaqaId)
    }
    if (searchKeyword) {
        const kw = searchKeyword.toLowerCase()
        list = list.filter((s) => s.name?.toLowerCase().includes(kw) || s.email?.toLowerCase().includes(kw) || s.phone?.includes(kw))
    }

    if (list.length === 0) {
        studentsBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">لا يوجد طلاب متطابقون مع البحث</td></tr>`
        return
    }

    studentsBody.innerHTML = list.map((s) => `
        <tr class="hover:bg-slate-50/50">
            <td class="py-3.5 font-bold text-slate-800">
                <div class="flex items-center gap-2.5">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        ${(s.name || "ط").charAt(0)}
                    </span>
                    <span>${s.name || "طالب"}</span>
                </div>
            </td>
            <td class="py-3.5 text-xs text-slate-600">${s.halaqaName || "-"}</td>
            <td class="py-3.5 text-xs text-slate-500" dir="ltr">${s.phone || "-"}</td>
            <td class="py-3.5 text-xs text-slate-500">${s.email || "-"}</td>
            <td class="py-3.5 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" data-action="student-att" data-id="${s._id}" data-halaqa="${s.halaqaId}"
                        class="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
                        حضور
                    </button>
                    <button type="button" data-action="student-mem" data-id="${s._id}" data-halaqa="${s.halaqaId}"
                        class="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100">
                        تسميع
                    </button>
                    <button type="button" data-action="student-eval" data-id="${s._id}" data-halaqa="${s.halaqaId}"
                        class="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">
                        تقييم
                    </button>
                    <button type="button" data-action="student-prog" data-id="${s._id}"
                        class="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">
                        التقرير
                    </button>
                </div>
            </td>
        </tr>
    `).join("")

    // Attach student action handlers
    studentsBody.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.action
            const studentId = btn.dataset.id
            const halaqaId = btn.dataset.halaqa

            if (action === "student-att") {
                openCreateAttendanceModal(studentId, halaqaId)
            } else if (action === "student-mem") {
                openCreateMemorizationModal(studentId, halaqaId)
            } else if (action === "student-eval") {
                openCreateEvaluationModal(studentId, halaqaId)
            } else if (action === "student-prog") {
                viewStudentProgress(studentId)
            }
        })
    })
}

/* ===================================================
   TAB 3: ATTENDANCE TABLE
=================================================== */
function renderAttendanceTable() {
    const tableBody = document.getElementById("attendance-table-body")
    if (!tableBody) return

    const filterHalaqa = document.getElementById("attendance-filter-halaqa")?.value || ""
    const filterStatus = document.getElementById("attendance-filter-status")?.value || ""
    const filterDate = document.getElementById("attendance-filter-date")?.value || ""
    const filterSearch = document.getElementById("attendance-filter-search")?.value.toLowerCase() || ""

    let list = myAttendances

    if (filterHalaqa) {
        list = list.filter((a) => {
            const hId = a.halaqa?._id ? a.halaqa._id.toString() : a.halaqa?.toString()
            return hId === filterHalaqa
        })
    }
    if (filterStatus) {
        list = list.filter((a) => a.status === filterStatus)
    }
    if (filterDate) {
        list = list.filter((a) => a.date && a.date.startsWith(filterDate))
    }
    if (filterSearch) {
        list = list.filter((a) => a.student?.name?.toLowerCase().includes(filterSearch))
    }

    if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">لا توجد سجلات حضور مطابقة</td></tr>`
        return
    }

    tableBody.innerHTML = list.map((a) => `
        <tr class="hover:bg-slate-50/50">
            <td class="px-6 py-4 font-semibold text-slate-800">${a.student?.name || "طالب"}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${a.halaqa?.name || "-"}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${formatDate(a.date)}</td>
            <td class="px-6 py-4">${getAttendanceStatusBadge(a.status)}</td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button type="button" data-att-toggle="${a._id}" data-current="${a.status}"
                        class="text-xs font-semibold text-slate-600 hover:text-emerald-700" title="تبديل الحالة">
                        تعديل
                    </button>
                    <button type="button" data-att-del="${a._id}"
                        class="text-xs font-semibold text-red-500 hover:text-red-700" title="حذف">
                        حذف
                    </button>
                </div>
            </td>
        </tr>
    `).join("")

    // Status toggle & delete actions
    tableBody.querySelectorAll("[data-att-toggle]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.attToggle
            const current = btn.dataset.current
            const nextStatus = current === "present" ? "absent" : current === "absent" ? "late" : "present"
            try {
                await updateAttendance(id, nextStatus)
                showAlert("تم تحديث حالة الحضور إلى: " + (nextStatus === "present" ? "حاضر" : nextStatus === "absent" ? "غائب" : "متأخر"))
                const attRes = await getAttendances()
                myAttendances = Array.isArray(attRes) ? attRes : attRes?.data || []
                renderStats()
                renderAttendanceTable()
            } catch (err) {
                showAlert("فشل تحديث الحالة: " + err.message, "error")
            }
        })
    })

    tableBody.querySelectorAll("[data-att-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("هل أنت متأكد من حذف سجل الحضور هذا؟")) return
            const id = btn.dataset.attDel
            try {
                await deleteAttendance(id)
                showAlert("تم حذف سجل الحضور بنجاح")
                myAttendances = myAttendances.filter((x) => x._id !== id)
                renderStats()
                renderAttendanceTable()
            } catch (err) {
                showAlert("فشل الحذف: " + err.message, "error")
            }
        })
    })
}

/* ===================================================
   TAB 4: MEMORIZATION TABLE
=================================================== */
function renderMemorizationTable() {
    const tableBody = document.getElementById("memorization-table-body")
    if (!tableBody) return

    const filterHalaqa = document.getElementById("memorization-filter-halaqa")?.value || ""
    const filterSurah = document.getElementById("memorization-filter-surah")?.value.trim().toLowerCase() || ""
    const filterSearch = document.getElementById("memorization-filter-search")?.value.toLowerCase() || ""

    let list = myMemorizations

    if (filterHalaqa) {
        list = list.filter((m) => {
            const hId = m.halaqa?._id ? m.halaqa._id.toString() : m.halaqa?.toString()
            return hId === filterHalaqa
        })
    }
    if (filterSurah) {
        list = list.filter((m) => m.surah?.toLowerCase().includes(filterSurah))
    }
    if (filterSearch) {
        list = list.filter((m) => m.student?.name?.toLowerCase().includes(filterSearch))
    }

    if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-xs text-slate-400">لا توجد سجلات تسميع مطابقة</td></tr>`
        return
    }

    tableBody.innerHTML = list.map((m) => `
        <tr class="hover:bg-slate-50/50">
            <td class="px-6 py-4 font-semibold text-slate-800">${m.student?.name || "طالب"}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${m.halaqa?.name || "-"}</td>
            <td class="px-6 py-4 font-semibold text-emerald-700">سورة ${m.surah}</td>
            <td class="px-6 py-4 text-xs text-slate-600">${m.fromVerse}</td>
            <td class="px-6 py-4 text-xs text-slate-600">${m.toVerse}</td>
            <td class="px-6 py-4 text-xs text-slate-400">${formatDate(m.date)}</td>
            <td class="px-6 py-4 text-center">
                <button type="button" data-mem-del="${m._id}"
                    class="text-xs font-semibold text-red-500 hover:text-red-700">حذف</button>
            </td>
        </tr>
    `).join("")

    tableBody.querySelectorAll("[data-mem-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("هل أنت متأكد من حذف جلسة التسميع هذه؟")) return
            const id = btn.dataset.memDel
            try {
                await deleteMemorization(id)
                showAlert("تم حذف سجل التسميع بنجاح")
                myMemorizations = myMemorizations.filter((x) => x._id !== id)
                renderStats()
                renderOverview()
                renderMemorizationTable()
            } catch (err) {
                showAlert("فشل الحذف: " + err.message, "error")
            }
        })
    })
}

/* ===================================================
   TAB 5: EVALUATIONS TABLE
=================================================== */
function renderEvaluationsTable() {
    const tableBody = document.getElementById("evaluations-table-body")
    if (!tableBody) return

    const filterType = document.getElementById("evaluations-filter-type")?.value || ""
    const filterSearch = document.getElementById("evaluations-filter-search")?.value.toLowerCase() || ""

    let list = myEvaluations

    if (filterType) {
        list = list.filter((e) => e.type === filterType)
    }
    if (filterSearch) {
        list = list.filter((e) => e.student?.name?.toLowerCase().includes(filterSearch))
    }

    if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-400">لا توجد تقييمات مطابقة</td></tr>`
        return
    }

    tableBody.innerHTML = list.map((e) => {
        const score = Number(e.score) || 0
        const scoreClass = score >= 8 ? "bg-emerald-50 text-emerald-700" : score >= 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
        return `
        <tr class="hover:bg-slate-50/50">
            <td class="px-6 py-4 font-semibold text-slate-800">${e.student?.name || "طالب"}</td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">${getEvaluationTypeLabel(e.type)}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-extrabold ${scoreClass}">
                    ${score} / 10
                </span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">${e.notes || "-"}</td>
            <td class="px-6 py-4 text-xs text-slate-400">${formatDate(e.date)}</td>
            <td class="px-6 py-4 text-center">
                <button type="button" data-eval-del="${e._id}"
                    class="text-xs font-semibold text-red-500 hover:text-red-700">حذف</button>
            </td>
        </tr>
    `}).join("")

    tableBody.querySelectorAll("[data-eval-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("هل أنت متأكد من حذف هذا التقييم؟")) return
            const id = btn.dataset.evalDel
            try {
                await deleteEvaluation(id)
                showAlert("تم حذف التقييم بنجاح")
                myEvaluations = myEvaluations.filter((x) => x._id !== id)
                renderEvaluationsTable()
            } catch (err) {
                showAlert("فشل الحذف: " + err.message, "error")
            }
        })
    })
}

/* ===================================================
   TAB 6: ANNOUNCEMENTS
=================================================== */
function renderAnnouncements() {
    const annGrid = document.getElementById("teacher-announcements-grid")
    if (!annGrid) return

    if (announcementsList.length === 0) {
        annGrid.innerHTML = `
            <div class="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
                لا توجد إعلانات منشورة في المدرسة حالياً
            </div>`
        return
    }

    annGrid.innerHTML = announcementsList.map((a) => `
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div class="flex items-center justify-between">
                <span class="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">إعلان</span>
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
   DROPDOWNS & FILTER POPULATION
=================================================== */
function populateDropdowns() {
    const todayStr = new Date().toISOString().split("T")[0]

    // Halaqa filter in Students tab
    const studentsHalaqaSelect = document.getElementById("students-filter-halaqa")
    if (studentsHalaqaSelect) {
        studentsHalaqaSelect.innerHTML = `<option value="">كل الحلقات</option>` +
            myHalaqas.map((h) => `<option value="${h._id}">${h.name}</option>`).join("")
        studentsHalaqaSelect.addEventListener("change", () => {
            const searchKw = document.getElementById("students-search")?.value || ""
            renderStudentsTable(studentsHalaqaSelect.value, searchKw)
        })
    }

    const studentsSearch = document.getElementById("students-search")
    if (studentsSearch) {
        studentsSearch.addEventListener("input", () => {
            const hId = studentsHalaqaSelect?.value || ""
            renderStudentsTable(hId, studentsSearch.value)
        })
    }

    // Attendance tab filters
    const attFilterHalaqa = document.getElementById("attendance-filter-halaqa")
    if (attFilterHalaqa) {
        attFilterHalaqa.innerHTML = `<option value="">جميع الحلقات</option>` +
            myHalaqas.map((h) => `<option value="${h._id}">${h.name}</option>`).join("")
        attFilterHalaqa.addEventListener("change", renderAttendanceTable)
    }
    const attFilterStatus = document.getElementById("attendance-filter-status")
    if (attFilterStatus) attFilterStatus.addEventListener("change", renderAttendanceTable)
    const attFilterDate = document.getElementById("attendance-filter-date")
    if (attFilterDate) attFilterDate.addEventListener("change", renderAttendanceTable)
    const attFilterSearch = document.getElementById("attendance-filter-search")
    if (attFilterSearch) attFilterSearch.addEventListener("input", renderAttendanceTable)

    // Memorization tab filters
    const memFilterHalaqa = document.getElementById("memorization-filter-halaqa")
    if (memFilterHalaqa) {
        memFilterHalaqa.innerHTML = `<option value="">جميع الحلقات</option>` +
            myHalaqas.map((h) => `<option value="${h._id}">${h.name}</option>`).join("")
        memFilterHalaqa.addEventListener("change", renderMemorizationTable)
    }
    const memFilterSurah = document.getElementById("memorization-filter-surah")
    if (memFilterSurah) memFilterSurah.addEventListener("input", renderMemorizationTable)
    const memFilterSearch = document.getElementById("memorization-filter-search")
    if (memFilterSearch) memFilterSearch.addEventListener("input", renderMemorizationTable)

    // Evaluations tab filters
    const evalFilterType = document.getElementById("evaluations-filter-type")
    if (evalFilterType) evalFilterType.addEventListener("change", renderEvaluationsTable)
    const evalFilterSearch = document.getElementById("evaluations-filter-search")
    if (evalFilterSearch) evalFilterSearch.addEventListener("input", renderEvaluationsTable)

    // Setup Modals Halaqa/Student Cascades
    setupModalCascade("modal-att-halaqa", "modal-att-student", "modal-att-date", todayStr)
    setupModalCascade("modal-mem-halaqa", "modal-mem-student", "modal-mem-date", todayStr)
    setupModalCascade("modal-eval-halaqa", "modal-eval-student", "modal-eval-date", todayStr)
}

function setupModalCascade(halaqaSelectId, studentSelectId, dateInputId, defaultDate) {
    const halaqaSelect = document.getElementById(halaqaSelectId)
    const studentSelect = document.getElementById(studentSelectId)
    const dateInput = document.getElementById(dateInputId)

    if (dateInput && !dateInput.value) {
        dateInput.value = defaultDate
    }

    if (halaqaSelect && studentSelect) {
        halaqaSelect.innerHTML = `<option value="">اختر الحلقة</option>` +
            myHalaqas.map((h) => `<option value="${h._id}">${h.name}</option>`).join("")

        halaqaSelect.addEventListener("change", () => {
            const selectedHalaqaId = halaqaSelect.value
            populateStudentOptions(studentSelect, selectedHalaqaId)
        })
    }
}

function populateStudentOptions(studentSelect, halaqaId, preselectedStudentId = "") {
    if (!studentSelect) return
    if (!halaqaId) {
        studentSelect.innerHTML = `<option value="">اختر الحلقة أولاً</option>`
        return
    }

    const filtered = myStudents.filter((s) => s.halaqaId?.toString() === halaqaId.toString())
    if (filtered.length === 0) {
        studentSelect.innerHTML = `<option value="">لا يوجد طلاب في هذه الحلقة</option>`
        return
    }

    studentSelect.innerHTML = `<option value="">اختر الطالب</option>` +
        filtered.map((s) => `<option value="${s._id}" ${s._id.toString() === preselectedStudentId?.toString() ? "selected" : ""}>${s.name}</option>`).join("")
}

/* ===================================================
   MODAL OPENERS WITH PRE-POPULATION
=================================================== */
function openCreateAttendanceModal(studentId = "", halaqaId = "") {
    const halaqaSelect = document.getElementById("modal-att-halaqa")
    const studentSelect = document.getElementById("modal-att-student")
    const dateInput = document.getElementById("modal-att-date")

    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0]

    if (halaqaId && halaqaSelect) {
        halaqaSelect.value = halaqaId
        populateStudentOptions(studentSelect, halaqaId, studentId)
    } else if (myHalaqas.length === 1 && halaqaSelect) {
        halaqaSelect.value = myHalaqas[0]._id
        populateStudentOptions(studentSelect, myHalaqas[0]._id, studentId)
    }

    openModal(modalAttendance)
}

function openCreateMemorizationModal(studentId = "", halaqaId = "") {
    const halaqaSelect = document.getElementById("modal-mem-halaqa")
    const studentSelect = document.getElementById("modal-mem-student")
    const dateInput = document.getElementById("modal-mem-date")

    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0]

    if (halaqaId && halaqaSelect) {
        halaqaSelect.value = halaqaId
        populateStudentOptions(studentSelect, halaqaId, studentId)
    } else if (myHalaqas.length === 1 && halaqaSelect) {
        halaqaSelect.value = myHalaqas[0]._id
        populateStudentOptions(studentSelect, myHalaqas[0]._id, studentId)
    }

    openModal(modalMemorization)
}

function openCreateEvaluationModal(studentId = "", halaqaId = "") {
    const halaqaSelect = document.getElementById("modal-eval-halaqa")
    const studentSelect = document.getElementById("modal-eval-student")
    const dateInput = document.getElementById("modal-eval-date")

    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0]

    if (halaqaId && halaqaSelect) {
        halaqaSelect.value = halaqaId
        populateStudentOptions(studentSelect, halaqaId, studentId)
    } else if (myHalaqas.length === 1 && halaqaSelect) {
        halaqaSelect.value = myHalaqas[0]._id
        populateStudentOptions(studentSelect, myHalaqas[0]._id, studentId)
    }

    openModal(modalEvaluation)
}

/* ===================================================
   STUDENT PROGRESS VIEWER
=================================================== */
async function viewStudentProgress(studentId) {
    const nameEl = document.getElementById("prog-student-name")
    const contentEl = document.getElementById("prog-content")

    if (nameEl) nameEl.textContent = "جاري تحميل تقرير الطالب..."
    if (contentEl) contentEl.innerHTML = `<div class="py-8 text-center text-xs text-slate-400">جاري جلب إحصائيات الطالب...</div>`
    openModal(modalStudentProgress)

    try {
        const res = await getStudentProgress(studentId)
        const progress = res?.data || res

        const student = progress.student || {}
        const halaqa = progress.halaqa || {}
        const att = progress.attendance || {}
        const mem = progress.memorization || {}
        const ev = progress.evaluations || {}

        if (nameEl) nameEl.textContent = `تقرير تقدم الطالب: ${student.name || "طالب"}`

        if (contentEl) {
            contentEl.innerHTML = `
                <div class="grid grid-cols-2 gap-3 text-xs">
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span class="text-slate-400">الحلقة</span>
                        <p class="mt-1 font-bold text-slate-800">${halaqa.name || "غير محدد"}</p>
                    </div>
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span class="text-slate-400">نسبة الحضور</span>
                        <p class="mt-1 font-extrabold text-emerald-700">${att.attendanceRate || 0}%</p>
                    </div>
                </div>

                <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <span class="text-slate-400 font-semibold block mb-2">تفاصيل الحضور</span>
                    <div class="grid grid-cols-3 text-center">
                        <div>
                            <span class="block text-slate-400">حاضر</span>
                            <span class="font-bold text-emerald-600">${att.present || 0}</span>
                        </div>
                        <div>
                            <span class="block text-slate-400">متأخر</span>
                            <span class="font-bold text-amber-600">${att.late || 0}</span>
                        </div>
                        <div>
                            <span class="block text-slate-400">غائب</span>
                            <span class="font-bold text-red-600">${att.absent || 0}</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs">
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span class="text-slate-400">إجمالي جلسات التسميع</span>
                        <p class="mt-1 font-bold text-slate-800">${mem.total || 0} جلسة</p>
                        ${mem.last ? `<p class="mt-1 text-[11px] text-emerald-700 font-medium">آخر تسميع: سورة ${mem.last.surah} (${mem.last.fromVerse}-${mem.last.toVerse})</p>` : ""}
                    </div>
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span class="text-slate-400">معدل التقييم</span>
                        <p class="mt-1 font-bold text-indigo-700">${(ev.averageScore || 0).toFixed(1)} / 10</p>
                        <p class="mt-1 text-[11px] text-slate-500">إجمالي التقييمات: ${ev.total || 0}</p>
                    </div>
                </div>
            `
        }
    } catch (err) {
        console.error(err)
        if (contentEl) contentEl.innerHTML = `<div class="py-4 text-center text-xs text-red-600">فشل تحميل التقرير: ${err.message}</div>`
    }
}

/* ===================================================
   FORM HANDLERS
=================================================== */
function setupFormHandlers() {
    // 1. Create Attendance Form
    const formAtt = document.getElementById("form-create-attendance")
    if (formAtt) {
        formAtt.addEventListener("submit", async (e) => {
            e.preventDefault()
            const student = document.getElementById("modal-att-student").value
            const halaqa = document.getElementById("modal-att-halaqa").value
            const date = document.getElementById("modal-att-date").value
            const statusRadio = formAtt.querySelector('input[name="att-status"]:checked')
            const status = statusRadio ? statusRadio.value : "present"

            if (!student || !halaqa || !date) {
                alert("يرجى ملء جميع الحقول المطلوبة")
                return
            }

            try {
                await createAttendance({ student, halaqa, date, status })
                showAlert("تم تسجيل حضور الطالب بنجاح")
                closeModal(modalAttendance)
                formAtt.reset()

                const attRes = await getAttendances()
                myAttendances = Array.isArray(attRes) ? attRes : attRes?.data || []
                renderStats()
                renderAttendanceTable()
            } catch (err) {
                alert("خطأ أثناء تسجيل الحضور: " + err.message)
            }
        })
    }

    // 2. Create Memorization Form
    const formMem = document.getElementById("form-create-memorization")
    if (formMem) {
        formMem.addEventListener("submit", async (e) => {
            e.preventDefault()
            const student = document.getElementById("modal-mem-student").value
            const halaqa = document.getElementById("modal-mem-halaqa").value
            const surah = document.getElementById("modal-mem-surah").value.trim()
            const fromVerse = parseInt(document.getElementById("modal-mem-from").value, 10)
            const toVerse = parseInt(document.getElementById("modal-mem-to").value, 10)
            const date = document.getElementById("modal-mem-date").value

            if (!student || !halaqa || !surah || isNaN(fromVerse) || isNaN(toVerse) || !date) {
                alert("يرجى التأكد من ملء جميع الحقول بالأرقام الصحيحة")
                return
            }

            if (fromVerse > toVerse) {
                alert("رقم الآية (إلى) يجب أن يكون أكبر من أو يساوي (من)")
                return
            }

            try {
                await createMemorization(student, halaqa, surah, fromVerse, toVerse, date)
                showAlert("تم تسجيل جلسة التسميع بنجاح")
                closeModal(modalMemorization)
                formMem.reset()

                const memRes = await getMemorization()
                myMemorizations = Array.isArray(memRes) ? memRes : memRes?.data || []
                renderStats()
                renderOverview()
                renderMemorizationTable()
            } catch (err) {
                alert("خطأ أثناء حفظ التسميع: " + err.message)
            }
        })
    }

    // 3. Create Evaluation Form
    const formEval = document.getElementById("form-create-evaluation")
    if (formEval) {
        formEval.addEventListener("submit", async (e) => {
            e.preventDefault()
            const student = document.getElementById("modal-eval-student").value
            const halaqa = document.getElementById("modal-eval-halaqa").value
            const type = document.getElementById("modal-eval-type").value
            const score = parseFloat(document.getElementById("modal-eval-score").value)
            const notes = document.getElementById("modal-eval-notes").value.trim()
            const date = document.getElementById("modal-eval-date").value

            if (!student || !halaqa || !type || isNaN(score) || !date) {
                alert("يرجى ملء جميع الحقول المطلوبة")
                return
            }

            try {
                await createEvaluation(student, halaqa, type, score, notes, date)
                showAlert("تم حفظ تقييم الطالب بنجاح")
                closeModal(modalEvaluation)
                formEval.reset()

                const evalRes = await getEvaluations()
                myEvaluations = Array.isArray(evalRes) ? evalRes : evalRes?.data || []
                renderEvaluationsTable()
            } catch (err) {
                alert("خطأ أثناء حفظ التقييم: " + err.message)
            }
        })
    }

    // 4. Profile Form
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
                if (teacherNameEl) teacherNameEl.textContent = displayName
                if (welcomeNameEl) welcomeNameEl.textContent = displayName
                showAlert("تم تحديث البيانات الشخصية بنجاح")
            } catch (err) {
                showAlert("فشل تحديث البيانات: " + err.message, "error")
            }
        })
    }

    // 5. Password Form
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