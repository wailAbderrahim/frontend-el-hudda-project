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
import { getLevels, assignStudentLevel } from "../../api/levelsApi.js"
import { getMatns, getMatnProgress, createStudentMatnProgress, updateStudentMatnProgress, deleteStudentMatnProgress } from "../../api/matnApi.js"
import { getExams, createExam, deleteExam, getExamAttempts, gradeAttempt, publishExamResults } from "../../api/examsApi.js"
import { formatBirthDate, formatBirthPlaces } from "../../utils/birthUtils.js"

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
let allLevels = []
let allMatns = []
let myMatnProgress = []
let myExams = []
let activeGradingExam = null
let activeGradingAttempts = []
let activeSelectedAttemptId = null
let examBuilderQuestions = []

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
const statActiveMatnEl = document.getElementById("stat-active-matn-count")
const statPendingGradingEl = document.getElementById("stat-pending-grading-count")

// Modals
const modalAttendance = document.getElementById("modal-attendance")
const modalMemorization = document.getElementById("modal-memorization")
const modalEvaluation = document.getElementById("modal-evaluation")
const modalStudentProgress = document.getElementById("modal-student-progress")
const modalNotifications = document.getElementById("modal-notifications")
const modalMatnProgress = document.getElementById("modal-matn-progress")
const modalCreateExam = document.getElementById("modal-create-exam")
const modalGradeExam = document.getElementById("modal-grade-exam")

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
        matn: { title: "متابعة حفظ المتون", sub: "تسجيل تقدم طلاب حلقاتك في المتون التجويدية والمنظومات المعتمدة" },
        exams: { title: "إدارة وتصحيح الامتحانات", sub: "إنشاء الامتحانات وتصحيح الإجابات ورصد الدرجات وإعلان النتائج" },
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
    ;[modalAttendance, modalMemorization, modalEvaluation, modalStudentProgress, modalNotifications, modalMatnProgress, modalCreateExam, modalGradeExam].forEach((m) => {
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

    const btnQuickMatn = document.getElementById("btn-quick-matn")
    const btnOpenCreateMatn = document.getElementById("btn-open-create-matn-progress")
    if (btnQuickMatn) btnQuickMatn.addEventListener("click", () => openCreateMatnProgressModal())
    if (btnOpenCreateMatn) btnOpenCreateMatn.addEventListener("click", () => openCreateMatnProgressModal())

    const btnQuickExam = document.getElementById("btn-quick-exam")
    const btnOpenCreateExam = document.getElementById("btn-open-create-exam")
    if (btnQuickExam) btnQuickExam.addEventListener("click", () => openCreateExamModal())
    if (btnOpenCreateExam) btnOpenCreateExam.addEventListener("click", () => openCreateExamModal())

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

        // Fetch Educational Levels
        try {
            const levRes = await getLevels()
            allLevels = Array.isArray(levRes) ? levRes : levRes?.data || []
        } catch (e) {
            console.error("Error loading levels:", e)
            allLevels = []
        }

        // Fetch Matns catalog
        try {
            const matnRes = await getMatns()
            allMatns = Array.isArray(matnRes) ? matnRes : matnRes?.data || []
        } catch (e) {
            console.error("Error loading matns:", e)
            allMatns = []
        }

        // Fetch Matn Progress
        try {
            const mpRes = await getMatnProgress()
            myMatnProgress = Array.isArray(mpRes) ? mpRes : mpRes?.data || []
        } catch (e) {
            console.error("Error loading matn progress:", e)
            myMatnProgress = []
        }

        // Fetch Exams
        try {
            const exRes = await getExams()
            myExams = Array.isArray(exRes) ? exRes : exRes?.data || []
        } catch (e) {
            console.error("Error loading exams:", e)
            myExams = []
        }

        // Render everything
        renderStats()
        renderOverview()
        renderHalaqasAndStudents()
        renderAttendanceTable()
        renderMemorizationTable()
        renderEvaluationsTable()
        renderMatnTable()
        renderExamsTable()
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

    // Matn progress records
    if (statActiveMatnEl) statActiveMatnEl.textContent = myMatnProgress.length

    // Exams pending grading / publication
    let pendingGrading = 0
    myExams.forEach((ex) => {
        if (!ex.isResultsPublished) {
            pendingGrading += (ex.attemptsCount || 0)
        }
    })
    if (statPendingGradingEl) statPendingGradingEl.textContent = pendingGrading
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

    // Matn tab filters
    const matnFilterHalaqa = document.getElementById("filter-matn-halaqa")
    if (matnFilterHalaqa) {
        matnFilterHalaqa.innerHTML = `<option value="">كل الحلقات</option>` +
            myHalaqas.map((h) => `<option value="${h._id}">${h.name}</option>`).join("")
        matnFilterHalaqa.addEventListener("change", renderMatnTable)
    }
    const matnFilterStatus = document.getElementById("filter-matn-status")
    if (matnFilterStatus) matnFilterStatus.addEventListener("change", renderMatnTable)
    const matnFilterSearch = document.getElementById("filter-matn-search")
    if (matnFilterSearch) matnFilterSearch.addEventListener("input", renderMatnTable)

    // Setup Modals Halaqa/Student Cascades
    setupModalCascade("modal-att-halaqa", "modal-att-student", "modal-att-date", todayStr)
    setupModalCascade("modal-mem-halaqa", "modal-mem-student", "modal-mem-date", todayStr)
    setupModalCascade("modal-eval-halaqa", "modal-eval-student", "modal-eval-date", todayStr)
    setupModalCascade("modal-matn-halaqa", "modal-matn-student", "modal-matn-date", todayStr)

    // Populate Matn select in modal
    const modalMatnSelect = document.getElementById("modal-matn-select")
    if (modalMatnSelect) {
        modalMatnSelect.innerHTML = `<option value="">اختر المتن</option>` +
            allMatns.map((m) => `<option value="${m._id}">${m.title} (${m.category || "عام"})</option>`).join("")
    }

    // Populate Exam Target Halaqa
    const modalExamTargetHalaqa = document.getElementById("modal-exam-target-halaqa")
    if (modalExamTargetHalaqa) {
        modalExamTargetHalaqa.innerHTML = `<option value="">جميع طلاب حلقاتي</option>` +
            myHalaqas.map((h) => `<option value="${h._id}">${h.name}</option>`).join("")
    }
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
   TAB: MATN PROGRESS
=================================================== */
function renderMatnTable() {
    const tableBody = document.getElementById("teacher-matn-table-body")
    if (!tableBody) return

    const filterHalaqa = document.getElementById("filter-matn-halaqa")?.value || ""
    const filterStatus = document.getElementById("filter-matn-status")?.value || ""
    const searchKw = (document.getElementById("filter-matn-search")?.value || "").toLowerCase().trim()

    let list = [...myMatnProgress]

    if (filterHalaqa) {
        list = list.filter((p) => {
            const hId = p.halaqa?._id || p.halaqa
            return hId?.toString() === filterHalaqa
        })
    }

    if (filterStatus) {
        list = list.filter((p) => p.status === filterStatus)
    }

    if (searchKw) {
        list = list.filter((p) => {
            const sName = (p.student?.name || "").toLowerCase()
            const mTitle = (p.matn?.title || "").toLowerCase()
            const sec = (p.section || "").toLowerCase()
            return sName.includes(searchKw) || mTitle.includes(searchKw) || sec.includes(searchKw)
        })
    }

    if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-xs text-slate-400">لا توجد سجلات متون مطابقة</td></tr>`
        return
    }

    const statusBadgeMap = {
        memorizing: '<span class="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">قيد الحفظ</span>',
        needs_revision: '<span class="inline-flex items-center rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">يحتاج مراجعة</span>',
        mastered: '<span class="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">متقن ومجاز</span>',
        not_started: '<span class="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">لم يبدأ</span>'
    }

    tableBody.innerHTML = list.map((item) => {
        const studentName = item.student?.name || "طالب"
        const halaqaName = item.halaqa?.name || item.student?.halaqaName || ""
        const matnTitle = item.matn?.title || "متن علمي"
        const pct = item.completionPercentage || 0
        const statusBadge = statusBadgeMap[item.status] || item.status
        const grade = item.masteryGrade || "—"
        const dateStr = formatDate(item.recitationDate || item.updatedAt)

        return `
            <tr class="hover:bg-slate-50/50">
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-800">${studentName}</p>
                    ${halaqaName ? `<p class="text-[11px] text-slate-400">${halaqaName}</p>` : ""}
                </td>
                <td class="px-6 py-4 font-semibold text-teal-800">${matnTitle}</td>
                <td class="px-6 py-4 text-xs text-slate-600">${item.section || "—"}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <div class="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div class="h-full rounded-full bg-teal-600" style="width: ${pct}%"></div>
                        </div>
                        <span class="text-xs font-bold text-teal-700">${pct}%</span>
                    </div>
                </td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4 text-xs font-bold text-slate-700">${grade}</td>
                <td class="px-6 py-4 text-xs text-slate-400">${dateStr}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button type="button" onclick="window.editMatnProgress('${item._id}')" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-700" title="تعديل">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                        <button type="button" onclick="window.deleteMatnProgressHandler('${item._id}')" class="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="حذف">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `
    }).join("")
}

function openCreateMatnProgressModal(studentId = "", halaqaId = "") {
    const titleEl = document.getElementById("modal-matn-title")
    const idInput = document.getElementById("modal-matn-progress-id")
    const form = document.getElementById("form-matn-progress")

    if (titleEl) titleEl.textContent = "تسجيل حفظ متن لطالب"
    if (idInput) idInput.value = ""
    if (form) form.reset()

    const halaqaSelect = document.getElementById("modal-matn-halaqa")
    const studentSelect = document.getElementById("modal-matn-student")
    const dateInput = document.getElementById("modal-matn-date")

    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0]

    if (halaqaId && halaqaSelect) {
        halaqaSelect.value = halaqaId
        populateStudentOptions(studentSelect, halaqaId, studentId)
    } else if (myHalaqas.length === 1 && halaqaSelect) {
        halaqaSelect.value = myHalaqas[0]._id
        populateStudentOptions(studentSelect, myHalaqas[0]._id, studentId)
    }

    openModal(modalMatnProgress)
}

function openEditMatnProgressModal(progressId) {
    const item = myMatnProgress.find((p) => p._id === progressId)
    if (!item) return

    const titleEl = document.getElementById("modal-matn-title")
    const idInput = document.getElementById("modal-matn-progress-id")
    if (titleEl) titleEl.textContent = "تعديل سجل حفظ متن"
    if (idInput) idInput.value = item._id

    const halaqaId = item.halaqa?._id || item.halaqa || ""
    const studentId = item.student?._id || item.student || ""

    const halaqaSelect = document.getElementById("modal-matn-halaqa")
    const studentSelect = document.getElementById("modal-matn-student")
    if (halaqaSelect) halaqaSelect.value = halaqaId
    if (halaqaSelect && studentSelect) {
        populateStudentOptions(studentSelect, halaqaId, studentId)
    }

    const matnSelect = document.getElementById("modal-matn-select")
    if (matnSelect) matnSelect.value = item.matn?._id || item.matn || ""

    const secInput = document.getElementById("modal-matn-section")
    if (secInput) secInput.value = item.section || ""

    const pctInput = document.getElementById("modal-matn-pct")
    if (pctInput) pctInput.value = item.completionPercentage || 0

    const statSelect = document.getElementById("modal-matn-status")
    if (statSelect) statSelect.value = item.status || "memorizing"

    const gradeInput = document.getElementById("modal-matn-grade")
    if (gradeInput) gradeInput.value = item.masteryGrade || ""

    const dateInput = document.getElementById("modal-matn-date")
    if (dateInput && item.recitationDate) {
        dateInput.value = item.recitationDate.split("T")[0]
    }

    const notesInput = document.getElementById("modal-matn-notes")
    if (notesInput) notesInput.value = item.teacherNotes || ""

    openModal(modalMatnProgress)
}

window.editMatnProgress = openEditMatnProgressModal

window.deleteMatnProgressHandler = async function (id) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل للمتن؟")) return
    try {
        await deleteStudentMatnProgress(id)
        showAlert("تم حذف سجل المتن بنجاح")
        const mpRes = await getMatnProgress()
        myMatnProgress = Array.isArray(mpRes) ? mpRes : mpRes?.data || []
        renderStats()
        renderMatnTable()
    } catch (err) {
        showAlert("فشل حذف سجل المتن: " + err.message, "error")
    }
}

/* ===================================================
   TAB: EXAMS
=================================================== */
function renderExamsTable() {
    const tableBody = document.getElementById("teacher-exams-table-body")
    if (!tableBody) return

    if (myExams.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-xs text-slate-400">لا توجد امتحانات منشأة بعد</td></tr>`
        return
    }

    const typeBadge = {
        quran: '<span class="inline-flex rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">قرآن كريم</span>',
        matn: '<span class="inline-flex rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">متن علمي</span>',
        level: '<span class="inline-flex rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">ترقية مستوى</span>',
        periodic: '<span class="inline-flex rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">دوري / فصلي</span>'
    }

    tableBody.innerHTML = myExams.map((exam) => {
        const title = exam.title || "امتحان"
        const halaqaName = exam.targetHalaqa?.name || "جميع الحلقات"
        const formatBadge = exam.format === "online" 
            ? '<span class="inline-flex rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">إلكتروني</span>'
            : '<span class="inline-flex rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">حضوري</span>'
        const dur = `${exam.durationMinutes || 30} دقيقة`
        const score = `${exam.passingScore || 12} / ${exam.totalScore || 20}`
        const attempts = `${exam.attemptsCount || 0} مشارك`
        const pubBadge = exam.isResultsPublished
            ? '<span class="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">النتائج معلنة</span>'
            : '<span class="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">بانتظار الاعتماد</span>'

        return `
            <tr class="hover:bg-slate-50/50">
                <td class="px-6 py-4 font-bold text-slate-800">
                    <p>${title}</p>
                    <p class="text-[11px] text-slate-400 font-normal">${exam.questions?.length || 0} أسئلة</p>
                </td>
                <td class="px-6 py-4 text-xs font-semibold text-slate-600">${halaqaName}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        ${typeBadge[exam.type] || exam.type}
                        ${formatBadge}
                    </div>
                </td>
                <td class="px-6 py-4 text-xs">
                    <span class="block font-bold text-slate-800">${score}</span>
                    <span class="text-slate-400">${dur}</span>
                </td>
                <td class="px-6 py-4 text-xs font-bold text-purple-700">${attempts}</td>
                <td class="px-6 py-4">${pubBadge}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button type="button" onclick="window.gradeExamHandler('${exam._id}')" class="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100" title="تصحيح ورصد">
                            <span>تصحيح ورصد</span>
                        </button>
                        <button type="button" onclick="window.deleteExamHandler('${exam._id}')" class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="حذف">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `
    }).join("")
}

function openCreateExamModal() {
    const form = document.getElementById("form-create-exam")
    if (form) form.reset()
    examBuilderQuestions = [
        {
            text: "",
            type: "multiple_choice",
            points: 5,
            options: ["", "", "", ""],
            correctAnswer: 0
        }
    ]
    const startDateInput = document.getElementById("modal-exam-start-date")
    if (startDateInput) startDateInput.value = new Date().toISOString().split("T")[0]
    renderExamQuestionsBuilder()
    openModal(modalCreateExam)
}

function renderExamQuestionsBuilder() {
    const container = document.getElementById("exam-questions-builder-list")
    if (!container) return

    if (examBuilderQuestions.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">لا توجد أسئلة مضافة بعد. اضغط "+ إضافة سؤال" للبدء.</div>`
        return
    }

    container.innerHTML = examBuilderQuestions.map((q, idx) => {
        return `
            <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3" data-q-idx="${idx}">
                <div class="flex items-center justify-between">
                    <span class="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">${idx + 1}</span>
                    <button type="button" onclick="window.removeBuilderQuestion(${idx})" class="text-xs text-red-500 hover:text-red-700">حذف السؤال</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div class="sm:col-span-3">
                        <label class="block text-[11px] font-semibold text-slate-600 mb-1">نص السؤال</label>
                        <input type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-600" value="${q.text || ""}" oninput="window.updateQuestionField(${idx}, 'text', this.value)" placeholder="اكتب نص السؤال هنا..." required>
                    </div>
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-600 mb-1">الدرجة</label>
                        <input type="number" min="1" max="100" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-600" value="${q.points || 5}" oninput="window.updateQuestionField(${idx}, 'points', Number(this.value))" required>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-600 mb-1">نوع السؤال</label>
                        <select class="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-600" onchange="window.updateQuestionType(${idx}, this.value)">
                            <option value="multiple_choice" ${q.type === "multiple_choice" ? "selected" : ""}>اختيار من متعدد</option>
                            <option value="true_false" ${q.type === "true_false" ? "selected" : ""}>صح أو خطأ</option>
                            <option value="short_answer" ${q.type === "short_answer" ? "selected" : ""}>إجابة قصيرة</option>
                            <option value="essay" ${q.type === "essay" ? "selected" : ""}>سؤال مقالي / شرح</option>
                            <option value="oral_recitation" ${q.type === "oral_recitation" ? "selected" : ""}>تسميع شفوي حضوري</option>
                        </select>
                    </div>
                    <div>
                        ${renderQuestionTypeDetail(q, idx)}
                    </div>
                </div>
            </div>
        `
    }).join("")
}

function renderQuestionTypeDetail(q, idx) {
    if (q.type === "multiple_choice") {
        const opts = q.options || ["", "", "", ""]
        return `
            <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">الخيارات الأربعة (حدد الإجابة الصحيحة)</label>
                <div class="space-y-1">
                    ${opts.map((opt, oIdx) => `
                        <div class="flex items-center gap-1.5">
                            <input type="radio" name="builder-correct-${idx}" value="${oIdx}" ${q.correctAnswer == oIdx ? "checked" : ""} onchange="window.updateQuestionField(${idx}, 'correctAnswer', ${oIdx})">
                            <input type="text" class="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none" value="${opt}" oninput="window.updateQuestionOption(${idx}, ${oIdx}, this.value)" placeholder="الخيار ${oIdx + 1}" required>
                        </div>
                    `).join("")}
                </div>
            </div>
        `
    } else if (q.type === "true_false") {
        return `
            <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">الإجابة الصحيحة</label>
                <select class="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none" onchange="window.updateQuestionField(${idx}, 'correctAnswer', this.value === 'true')">
                    <option value="true" ${q.correctAnswer === true || q.correctAnswer === "true" ? "selected" : ""}>صحيح (صح)</option>
                    <option value="false" ${q.correctAnswer === false || q.correctAnswer === "false" ? "selected" : ""}>خاطئ (خطأ)</option>
                </select>
            </div>
        `
    } else {
        return `
            <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">معيار الإجابة النموذجية أو توجيه التصحيح</label>
                <input type="text" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none" value="${typeof q.correctAnswer === "string" ? q.correctAnswer : ""}" oninput="window.updateQuestionField(${idx}, 'correctAnswer', this.value)" placeholder="معايير تقييم المعلم...">
            </div>
        `
    }
}

window.updateQuestionField = function(idx, field, value) {
    if (examBuilderQuestions[idx]) {
        examBuilderQuestions[idx][field] = value
    }
}

window.updateQuestionOption = function(qIdx, optIdx, value) {
    if (examBuilderQuestions[qIdx]) {
        if (!examBuilderQuestions[qIdx].options) examBuilderQuestions[qIdx].options = ["", "", "", ""]
        examBuilderQuestions[qIdx].options[optIdx] = value
    }
}

window.updateQuestionType = function(idx, newType) {
    if (examBuilderQuestions[idx]) {
        examBuilderQuestions[idx].type = newType
        if (newType === "multiple_choice") {
            examBuilderQuestions[idx].options = ["", "", "", ""]
            examBuilderQuestions[idx].correctAnswer = 0
        } else if (newType === "true_false") {
            examBuilderQuestions[idx].correctAnswer = true
        } else {
            examBuilderQuestions[idx].correctAnswer = ""
        }
        renderExamQuestionsBuilder()
    }
}

window.removeBuilderQuestion = function(idx) {
    examBuilderQuestions.splice(idx, 1)
    renderExamQuestionsBuilder()
}

window.deleteExamHandler = async function(examId) {
    if (!confirm("هل أنت متأكد من حذف هذا الامتحان ومحاولاته؟")) return
    try {
        await deleteExam(examId)
        showAlert("تم حذف الامتحان بنجاح")
        const exRes = await getExams()
        myExams = Array.isArray(exRes) ? exRes : exRes?.data || []
        renderStats()
        renderExamsTable()
    } catch (err) {
        showAlert("فشل حذف الامتحان: " + err.message, "error")
    }
}

/* ===================================================
   EXAM GRADING MODAL
=================================================== */
async function openGradeExamModal(examId) {
    activeGradingExam = myExams.find((e) => e._id === examId)
    if (!activeGradingExam) return

    const titleEl = document.getElementById("grade-modal-exam-title")
    const subEl = document.getElementById("grade-modal-exam-subtitle")
    const container = document.getElementById("attempts-selector-container")
    const detailContainer = document.getElementById("active-attempt-grading-container")

    if (titleEl) titleEl.textContent = `تصحيح: ${activeGradingExam.title}`
    if (subEl) subEl.textContent = `علامة النجاح: ${activeGradingExam.passingScore} من ${activeGradingExam.totalScore}`

    if (container) container.innerHTML = `<span class="text-xs text-slate-400">جاري تحميل المحاولات...</span>`
    if (detailContainer) detailContainer.innerHTML = `<p class="py-8 text-center text-xs text-slate-400">اختر طالباً من القائمة لمراجعة إجاباته.</p>`

    openModal(modalGradeExam)

    try {
        const attRes = await getExamAttempts(examId)
        activeGradingAttempts = Array.isArray(attRes) ? attRes : attRes?.data || []

        if (activeGradingAttempts.length === 0) {
            if (container) container.innerHTML = `<span class="text-xs text-slate-400">لم يتقدم أي طالب لهذا الامتحان بعد.</span>`
            return
        }

        renderAttemptsList()
        if (activeGradingAttempts.length > 0) {
            window.selectAttemptForGrading(activeGradingAttempts[0]._id)
        }
    } catch (err) {
        if (container) container.innerHTML = `<span class="text-xs text-red-500">فشل تحميل المحاولات: ${err.message}</span>`
    }
}

window.gradeExamHandler = openGradeExamModal

function renderAttemptsList() {
    const container = document.getElementById("attempts-selector-container")
    if (!container) return

    container.innerHTML = activeGradingAttempts.map((att) => {
        const isSelected = att._id === activeSelectedAttemptId
        const sName = att.student?.name || "طالب"
        const isGraded = att.status === "graded"
        const badgeColor = isGraded ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
        const statusText = isGraded ? `تم الرصد (${att.totalScoreAwarded}/${activeGradingExam.totalScore})` : "بانتظار التصحيح"

        return `
            <button type="button" onclick="window.selectAttemptForGrading('${att._id}')" class="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isSelected ? "border-purple-600 bg-purple-50 text-purple-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}">
                <span>${sName}</span>
                <span class="rounded-md px-1.5 py-0.5 text-[10px] ${badgeColor}">${statusText}</span>
            </button>
        `
    }).join("")
}

window.selectAttemptForGrading = function(attemptId) {
    activeSelectedAttemptId = attemptId
    renderAttemptsList()

    const attempt = activeGradingAttempts.find((a) => a._id === attemptId)
    const detailContainer = document.getElementById("active-attempt-grading-container")
    if (!attempt || !detailContainer) return

    const studentName = attempt.student?.name || "طالب"
    const questions = activeGradingExam.questions || []
    const answers = attempt.answers || []

    detailContainer.innerHTML = `
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-slate-800 text-sm">إجابات الطالب: ${studentName}</h4>
                    <p class="text-xs text-slate-500">تاريخ الإرسال: ${formatDate(attempt.submittedAt || attempt.createdAt)}</p>
                </div>
                <div class="text-left">
                    <span class="text-xs text-slate-500 block">الدرجة الكلية المرصودة:</span>
                    <span id="current-awarded-sum" class="text-lg font-black text-purple-700">${attempt.totalScoreAwarded || 0} / ${activeGradingExam.totalScore}</span>
                </div>
            </div>
        </div>

        <div class="space-y-4">
            ${questions.map((q, qIdx) => {
                const ans = answers.find((a) => a.questionId?.toString() === q._id?.toString()) || {}
                const studentVal = ans.answer !== undefined ? ans.answer : "—"
                const scoreAwarded = ans.scoreAwarded !== undefined ? ans.scoreAwarded : (ans.isCorrect ? q.points : 0)
                const fb = ans.feedback || ""

                let displayVal = studentVal
                if (q.type === "multiple_choice" && Array.isArray(q.options)) {
                    displayVal = q.options[studentVal] !== undefined ? `${q.options[studentVal]} (الخيار ${Number(studentVal) + 1})` : studentVal
                } else if (q.type === "true_false") {
                    displayVal = studentVal === true || studentVal === "true" ? "صحيح" : (studentVal === false || studentVal === "false" ? "خاطئ" : studentVal)
                }

                return `
                    <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                        <div class="flex items-start justify-between">
                            <div class="flex items-start gap-2">
                                <span class="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">${qIdx + 1}</span>
                                <div>
                                    <p class="text-xs font-bold text-slate-800">${q.text}</p>
                                    <p class="text-[11px] text-purple-600">الدرجة المخصصة: ${q.points} نقطة</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="text-xs font-bold text-slate-600">الدرجة المستحقة:</label>
                                <input type="number" min="0" max="${q.points}" step="0.5" data-q-id="${q._id}" class="grade-score-input w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-bold text-slate-800 focus:border-purple-600 focus:outline-none" value="${scoreAwarded}">
                            </div>
                        </div>

                        <div class="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs">
                            <span class="text-slate-400 block mb-1">إجابة الطالب:</span>
                            <p class="font-bold text-slate-700">${displayVal}</p>
                        </div>

                        <div>
                            <input type="text" data-q-id="${q._id}" class="grade-feedback-input w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-purple-600 focus:outline-none" placeholder="ملاحظات وتوجيهات المعلم على هذه الإجابة (اختياري)..." value="${fb}">
                        </div>
                    </div>
                `
            }).join("")}
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <label class="block text-xs font-bold text-slate-700">ملاحظات عامة حول أداء الطالب في الامتحان</label>
            <textarea id="grade-general-notes" rows="2" class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-purple-600 focus:outline-none" placeholder="توجيه عام للمستوى...">${attempt.generalNotes || ""}</textarea>
        </div>

        <div class="flex justify-end pt-2">
            <button type="button" onclick="window.saveCurrentAttemptGrade('${attempt._id}')" class="rounded-xl bg-purple-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-purple-800">
                حفظ التصحيح والدرجة للطالب
            </button>
        </div>
    `
}

window.saveCurrentAttemptGrade = async function(attemptId) {
    if (!activeGradingExam) return

    const scoreInputs = document.querySelectorAll(".grade-score-input")
    const fbInputs = document.querySelectorAll(".grade-feedback-input")
    const generalNotes = document.getElementById("grade-general-notes")?.value || ""

    const scores = {}
    const feedback = {}

    scoreInputs.forEach((inp) => {
        const qId = inp.dataset.qId
        scores[qId] = parseFloat(inp.value) || 0
    })

    fbInputs.forEach((inp) => {
        const qId = inp.dataset.qId
        feedback[qId] = inp.value.trim()
    })

    try {
        await gradeAttempt(activeGradingExam._id, attemptId, {
            scores,
            feedback,
            generalNotes,
            status: "graded"
        })
        showAlert("تم حفظ رصد درجات الطالب بنجاح")
        const attRes = await getExamAttempts(activeGradingExam._id)
        activeGradingAttempts = Array.isArray(attRes) ? attRes : attRes?.data || []
        renderAttemptsList()
        window.selectAttemptForGrading(attemptId)
    } catch (err) {
        showAlert("فشل حفظ التصحيح: " + err.message, "error")
    }
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
        const currentLevel = progress.currentLevel || null
        const levelHistory = progress.levelHistory || []
        const matnProg = progress.matnProgress || []
        const examAtts = progress.examAttempts || []

        const birthDateStr = formatBirthDate(student.dateOfBirth)
        const birthPlaceStr = formatBirthPlaces(student)

        if (nameEl) nameEl.textContent = `تقرير تقدم الطالب: ${student.name || "طالب"}`

        if (contentEl) {
            contentEl.innerHTML = `
                <!-- Personal & Halaqa Info -->
                <div class="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="text-slate-400 block text-[11px]">الحلقة القرآنية</span>
                            <span class="font-bold text-slate-800">${halaqa.name || "غير محدد"}</span>
                        </div>
                        <div class="text-left">
                            <span class="text-slate-400 block text-[11px]">نسبة الحضور الإجمالية</span>
                            <span class="font-black text-emerald-700">${att.attendanceRate || 0}%</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-2 text-[11px]">
                        <div>
                            <span class="text-slate-400">تاريخ الميلاد:</span>
                            <span class="font-semibold text-slate-700 mr-1">${birthDateStr}</span>
                        </div>
                        <div>
                            <span class="text-slate-400">مكان الميلاد:</span>
                            <span class="font-semibold text-slate-700 mr-1">${birthPlaceStr}</span>
                        </div>
                    </div>
                </div>

                <!-- Current Level & Transition Manager -->
                <div class="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 space-y-3 text-xs">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="text-[11px] font-bold text-purple-600 block">المستوى التعليمي الحالي</span>
                            <h4 class="text-sm font-extrabold text-purple-900">${currentLevel ? `${currentLevel.name} (المستوى ${currentLevel.order})` : "لم يُسند إلى مستوى بعد"}</h4>
                        </div>
                        ${currentLevel?.passingScore ? `<span class="rounded-lg bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800">درجة النجاح: ${currentLevel.passingScore}</span>` : ""}
                    </div>

                    <!-- Level Assignment / Promotion UI -->
                    <div class="rounded-xl border border-purple-100 bg-white p-3 space-y-2">
                        <span class="block font-bold text-slate-700 text-[11px]">ترقية أو تعيين مستوى جديد للطالب:</span>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select id="modal-assign-level-select" class="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none">
                                <option value="">اختر المستوى الجديد</option>
                                ${allLevels.map((lvl) => `<option value="${lvl._id}" ${currentLevel?._id === lvl._id ? "selected" : ""}>${lvl.name} (المستوى ${lvl.order})</option>`).join("")}
                            </select>
                            <input type="text" id="modal-assign-level-reason" placeholder="سبب الترقية أو النقل..." class="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none">
                        </div>
                        <div class="flex justify-end pt-1">
                            <button type="button" onclick="window.assignStudentLevelAction('${student._id || studentId}')" class="rounded-xl bg-purple-700 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-purple-800 shadow-xs">
                                اعتماد الترقية / النقل
                            </button>
                        </div>
                    </div>

                    ${levelHistory.length > 0 ? `
                        <div class="border-t border-purple-100 pt-2">
                            <span class="block text-[11px] font-bold text-purple-900 mb-1">سجل الترقيات السابق:</span>
                            <div class="max-h-24 overflow-y-auto space-y-1">
                                ${levelHistory.map((h) => `
                                    <div class="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1 text-[10px] text-slate-600 border border-purple-50">
                                        <span>${h.fromLevel ? h.fromLevel.name : "البداية"} ➔ <strong class="text-purple-800">${h.toLevel?.name || "مستوى"}</strong> (${h.reason || "ترقية"})</span>
                                        <span class="text-slate-400">${formatDate(h.promotedAt || h.createdAt)}</span>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    ` : ""}
                </div>

                <!-- Attendance Breakdown -->
                <div class="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <span class="text-slate-400 font-semibold block mb-2">تفاصيل الحضور والغياب</span>
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

                <!-- Memorization & Evaluations Stats -->
                <div class="grid grid-cols-2 gap-3 text-xs">
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span class="text-slate-400">إجمالي جلسات التسميع</span>
                        <p class="mt-1 font-bold text-slate-800">${mem.total || 0} جلسة</p>
                        ${mem.last ? `<p class="mt-1 text-[11px] text-emerald-700 font-medium">آخر تسميع: سورة ${mem.last.surah} (${mem.last.fromVerse}-${mem.last.toVerse})</p>` : ""}
                    </div>
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <span class="text-slate-400">معدل التقييم القرآني</span>
                        <p class="mt-1 font-bold text-indigo-700">${(ev.averageScore || 0).toFixed(1)} / 10</p>
                        <p class="mt-1 text-[11px] text-slate-500">إجمالي التقييمات: ${ev.total || 0}</p>
                    </div>
                </div>

                <!-- Matn Memorization Progress -->
                <div class="rounded-2xl border border-teal-100 bg-teal-50/40 p-3.5 space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-teal-900">سجل المتون العلمية</span>
                        <span class="text-[11px] font-semibold text-teal-700">${matnProg.length} متن مسجل</span>
                    </div>
                    ${matnProg.length === 0 ? `
                        <p class="text-[11px] text-slate-400 text-center py-2">لم يتم تسجيل أي متن لهذا الطالب بعد</p>
                    ` : `
                        <div class="space-y-2 max-h-36 overflow-y-auto">
                            ${matnProg.map((mp) => `
                                <div class="rounded-xl border border-teal-100 bg-white p-2.5">
                                    <div class="flex items-center justify-between">
                                        <span class="font-bold text-teal-800">${mp.matn?.title || "متن"}</span>
                                        <span class="text-xs font-black text-teal-700">${mp.completionPercentage || 0}%</span>
                                    </div>
                                    <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div class="h-full rounded-full bg-teal-600" style="width: ${mp.completionPercentage || 0}%"></div>
                                    </div>
                                    <div class="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                                        <span>الباب: ${mp.section || "—"}</span>
                                        <span>الدرجة: ${mp.masteryGrade || "—"}</span>
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    `}
                </div>

                <!-- Exam Attempts -->
                <div class="rounded-2xl border border-purple-100 bg-purple-50/40 p-3.5 space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-purple-900">سجل الامتحانات</span>
                        <span class="text-[11px] font-semibold text-purple-700">${examAtts.length} امتحان</span>
                    </div>
                    ${examAtts.length === 0 ? `
                        <p class="text-[11px] text-slate-400 text-center py-2">لا توجد محاولات امتحانات سابقة</p>
                    ` : `
                        <div class="space-y-2 max-h-36 overflow-y-auto">
                            ${examAtts.map((ea) => {
                                const passed = ea.isPassed
                                const passBadge = passed
                                    ? '<span class="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">ناجح</span>'
                                    : '<span class="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">راسب</span>'
                                return `
                                    <div class="flex items-center justify-between rounded-xl border border-purple-100 bg-white p-2.5">
                                        <div>
                                            <p class="font-bold text-slate-800">${ea.exam?.title || "امتحان"}</p>
                                            <span class="text-[10px] text-slate-400">${formatDate(ea.submittedAt || ea.createdAt)}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-extrabold text-purple-700">${ea.totalScoreAwarded || 0} / ${ea.exam?.totalScore || 20}</span>
                                            ${passBadge}
                                        </div>
                                    </div>
                                `
                            }).join("")}
                        </div>
                    `}
                </div>
            `
        }
    } catch (err) {
        console.error(err)
        if (contentEl) contentEl.innerHTML = `<div class="py-4 text-center text-xs text-red-600">فشل تحميل التقرير: ${err.message}</div>`
    }
}

window.assignStudentLevelAction = async function(studentId) {
    const levelSelect = document.getElementById("modal-assign-level-select")
    const reasonInput = document.getElementById("modal-assign-level-reason")
    const newLevelId = levelSelect?.value
    const reason = reasonInput?.value.trim() || "ترقية دورية من المعلم"

    if (!newLevelId) {
        alert("يرجى اختيار المستوى التعليمي أولاً")
        return
    }

    try {
        await assignStudentLevel({
            studentId,
            newLevelId,
            reason
        })
        showAlert("تم تعيين / ترقية مستوى الطالب بنجاح")
        await viewStudentProgress(studentId)
    } catch (err) {
        alert("خطأ أثناء ترقية المستوى: " + err.message)
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

    // 4. Matn Progress Form
    const formMatn = document.getElementById("form-matn-progress")
    if (formMatn) {
        formMatn.addEventListener("submit", async (e) => {
            e.preventDefault()
            const progressId = document.getElementById("modal-matn-progress-id").value
            const halaqa = document.getElementById("modal-matn-halaqa").value
            const student = document.getElementById("modal-matn-student").value
            const matn = document.getElementById("modal-matn-select").value
            const section = document.getElementById("modal-matn-section").value.trim()
            const completionPercentage = parseFloat(document.getElementById("modal-matn-pct").value) || 0
            const status = document.getElementById("modal-matn-status").value
            const masteryGrade = document.getElementById("modal-matn-grade").value.trim()
            const recitationDate = document.getElementById("modal-matn-date").value
            const teacherNotes = document.getElementById("modal-matn-notes").value.trim()

            if (!student || !matn || !section || !recitationDate) {
                alert("يرجى ملء جميع الحقول المطلوبة للمتن")
                return
            }

            try {
                const payload = {
                    student,
                    halaqa: halaqa || undefined,
                    matn,
                    section,
                    completionPercentage,
                    status,
                    masteryGrade,
                    recitationDate,
                    teacherNotes
                }

                if (progressId) {
                    await updateStudentMatnProgress(progressId, payload)
                    showAlert("تم تحديث سجل المتن بنجاح")
                } else {
                    await createStudentMatnProgress(payload)
                    showAlert("تم تسجيل حفظ المتن للطالب بنجاح")
                }

                closeModal(modalMatnProgress)
                formMatn.reset()

                const mpRes = await getMatnProgress()
                myMatnProgress = Array.isArray(mpRes) ? mpRes : mpRes?.data || []
                renderStats()
                renderMatnTable()
            } catch (err) {
                alert("خطأ أثناء حفظ سجل المتن: " + err.message)
            }
        })
    }

    // 5. Exam Creation Form
    const formExam = document.getElementById("form-create-exam")
    if (formExam) {
        formExam.addEventListener("submit", async (e) => {
            e.preventDefault()
            const title = document.getElementById("modal-exam-title").value.trim()
            const type = document.getElementById("modal-exam-type").value
            const format = document.getElementById("modal-exam-format").value
            const targetHalaqa = document.getElementById("modal-exam-target-halaqa").value || undefined
            const durationMinutes = parseInt(document.getElementById("modal-exam-duration").value, 10) || 30
            const totalScore = parseFloat(document.getElementById("modal-exam-total-score").value) || 20
            const passingScore = parseFloat(document.getElementById("modal-exam-passing-score").value) || 12
            const startDate = document.getElementById("modal-exam-start-date").value
            const instructions = document.getElementById("modal-exam-instructions").value.trim()

            if (!title) {
                alert("يرجى إدخال عنوان الامتحان")
                return
            }

            if (examBuilderQuestions.length === 0) {
                alert("يرجى إضافة سؤال واحد على الأقل في الامتحان")
                return
            }

            // Clean up questions
            const questions = examBuilderQuestions.map((q) => {
                const cleanQ = {
                    text: q.text,
                    type: q.type,
                    points: q.points || 5,
                    correctAnswer: q.correctAnswer
                }
                if (q.type === "multiple_choice") {
                    cleanQ.options = q.options || []
                }
                return cleanQ
            })

            try {
                const payload = {
                    title,
                    type,
                    format,
                    targetHalaqa,
                    durationMinutes,
                    totalScore,
                    passingScore,
                    startDate: startDate ? new Date(startDate).toISOString() : undefined,
                    instructions,
                    questions
                }

                await createExam(payload)
                showAlert("تم إنشاء ونشر الامتحان بنجاح")
                closeModal(modalCreateExam)
                formExam.reset()

                const exRes = await getExams()
                myExams = Array.isArray(exRes) ? exRes : exRes?.data || []
                renderStats()
                renderExamsTable()
            } catch (err) {
                alert("خطأ أثناء إنشاء الامتحان: " + err.message)
            }
        })
    }

    // Exam Questions Builder Button
    const btnAddQ = document.getElementById("btn-add-question-builder")
    if (btnAddQ) {
        btnAddQ.addEventListener("click", () => {
            examBuilderQuestions.push({
                text: "",
                type: "multiple_choice",
                points: 5,
                options: ["", "", "", ""],
                correctAnswer: 0
            })
            renderExamQuestionsBuilder()
        })
    }

    // Publish Exam Results Button
    const btnPublish = document.getElementById("btn-publish-current-exam-results")
    if (btnPublish) {
        btnPublish.addEventListener("click", async () => {
            if (!activeGradingExam) return
            if (!confirm(`هل أنت متأكد من إعلان ونشر نتائج امتحان "${activeGradingExam.title}" لجميع الطلاب الآن؟`)) return

            try {
                await publishExamResults(activeGradingExam._id)
                showAlert("تم إعلان ونشر نتائج الامتحان للطلاب رسمياً بنجاح")
                closeModal(modalGradeExam)

                const exRes = await getExams()
                myExams = Array.isArray(exRes) ? exRes : exRes?.data || []
                renderStats()
                renderExamsTable()
            } catch (err) {
                showAlert("فشل نشر النتائج: " + err.message, "error")
            }
        })
    }

    // 6. Profile Form
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

    // 7. Password Form
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