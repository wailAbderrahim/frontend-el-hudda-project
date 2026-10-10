import { protectPage, getUser, logout } from "../../auth/auth.js"
import { getProfile, updateProfile, changePassword } from "../../api/usersApi.js"
import { getStudentProgress } from "../../api/progressApi.js"
import { getMemorization } from "../../api/memorizationApi.js"
import { getEvaluations } from "../../api/evaluationsApi.js"
import { getAttendances } from "../../api/attendanceApi.js"
import { getAnnouncements } from "../../api/announcementsApi.js"
import { getNotifications, markAllAsRead } from "../../api/notificationsApi.js"
import { initNotificationBell } from "../../components/notificationBell.js"
import { getLevels, getStudentLevelHistory } from "../../api/levelsApi.js"
import { getMatns, getStudentMatnProgress } from "../../api/matnApi.js"
import { getExams, startExamAttempt, saveExamProgress, submitExamAttempt, getStudentResults } from "../../api/examsApi.js"

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

// Level, Matn, Exams State
let currentLevel = null
let levelHistoryList = []
let matnProgressList = []
let availableExamsList = []
let examResultsList = []

// Active Exam Taking Engine State
let activeExam = null
let activeAttempt = null
let currentQuestionIndex = 0
let examTimerInterval = null
let examRemainingSeconds = 0
let userAnswers = {}
let autoSaveDebounceTimer = null
let periodicSaveInterval = null

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
        level: { title: "مستواي الدراسي وسجل الترقية", sub: "متابعة المستوى التعليمي الحالي وشروط الانتقال وسجل الترقيات" },
        matn: { title: "حفظ المتون العلمية", sub: "متابعة حفظ المتون التجويدية والعلمية وملاحظات الشيخ المعلم" },
        exams: { title: "امتحاناتي واختباراتي", sub: "الامتحانات المقررة الحضورية والإلكترونية وإجراؤها" },
        results: { title: "نتائجي وتقارير الاختبارات", sub: "النتائج الرسمية المعتمدة وتوجيهات الأساتذة في الامتحانات" },
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

        // 1. Fetch Student Progress (includes populated teacher, currentLevel, matn, exams)
        try {
            const progressRes = await getStudentProgress(currentUser._id)
            studentProgress = progressRes?.data || progressRes
            if (studentProgress?.currentLevel) {
                currentLevel = studentProgress.currentLevel
            }
            if (studentProgress?.levelHistory && studentProgress.levelHistory.length > 0) {
                levelHistoryList = studentProgress.levelHistory
            }
        } catch (progErr) {
            console.warn("Could not fetch student progress summary:", progErr)
        }

        // If level not yet loaded from progress, check currentUser
        if (!currentLevel && currentUser?.currentLevel) {
            currentLevel = currentUser.currentLevel
        }

        // Fetch level history if not populated
        if (levelHistoryList.length === 0 && currentUser?._id) {
            try {
                const histRes = await getStudentLevelHistory(currentUser._id)
                levelHistoryList = Array.isArray(histRes) ? histRes : histRes?.data || []
            } catch (hErr) {
                console.warn("Could not fetch level history:", hErr)
            }
        }

        // 2. Fetch Matn Progress
        try {
            const matnRes = await getStudentMatnProgress(currentUser._id)
            matnProgressList = Array.isArray(matnRes) ? matnRes : matnRes?.data || []
        } catch (matnErr) {
            console.warn("Could not fetch matn progress:", matnErr)
        }

        // 3. Fetch Available Exams
        try {
            const examsRes = await getExams()
            availableExamsList = Array.isArray(examsRes) ? examsRes : examsRes?.data || []
        } catch (exErr) {
            console.warn("Could not fetch exams:", exErr)
        }

        // 4. Fetch Student Exam Results
        try {
            const resRes = await getStudentResults(currentUser._id)
            examResultsList = Array.isArray(resRes) ? resRes : resRes?.data || []
        } catch (rErr) {
            console.warn("Could not fetch exam results:", rErr)
        }

        // 5. Fetch Memorizations
        try {
            const memRes = await getMemorization()
            memorizationsList = Array.isArray(memRes) ? memRes : memRes?.data || []
        } catch (memErr) {
            console.warn(memErr)
        }

        // 6. Fetch Evaluations
        try {
            const evalRes = await getEvaluations()
            evaluationsList = Array.isArray(evalRes) ? evalRes : evalRes?.data || []
        } catch (evalErr) {
            console.warn(evalErr)
        }

        // 7. Fetch Attendances
        try {
            const attRes = await getAttendances()
            attendancesList = Array.isArray(attRes) ? attRes : attRes?.data || []
        } catch (attErr) {
            console.warn(attErr)
        }

        // 8. Fetch Announcements
        try {
            const annRes = await getAnnouncements()
            announcementsList = Array.isArray(annRes) ? annRes : annRes?.data || []
        } catch (annErr) {
            console.warn(annErr)
        }

        // 9. Notifications
        await loadNotifications()

        // Render Everything
        renderOverview()
        renderLevelTab()
        renderMatnTab()
        renderExamsTab()
        renderResultsTab()
        renderMemorizationTab()
        renderEvaluationsTab()
        renderAttendanceTab()
        renderAnnouncementsTab()
        setupExamModalHandlers()

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
    // Halaqa & Teacher display with full safeguard against raw ObjectIds
    const halaqa = studentProgress?.halaqa
    if (halaqa) {
        if (halaqaNameDisplay) halaqaNameDisplay.textContent = halaqa.name || "حلقة غير مسماة"
        if (halaqaScheduleDisplay) halaqaScheduleDisplay.textContent = halaqa.schedule || "غير محدد"
        if (teacherNameDisplay) {
            const t = halaqa.teacher
            let tName = "لم يحدد"
            if (t && typeof t === "object") {
                tName = t.name || `${t.firstName || ""} ${t.lastName || ""}`.trim() || "الشيخ المعلم"
            } else if (typeof t === "string" && t.length > 0 && !/^[0-9a-fA-F]{24}$/.test(t)) {
                tName = t
            } else if (typeof t === "string" && /^[0-9a-fA-F]{24}$/.test(t)) {
                tName = "الشيخ المعلم"
            }
            teacherNameDisplay.textContent = tName
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

    // Current Level Card
    const statCurrentLevelEl = document.getElementById("stat-current-level")
    const statLevelPassingEl = document.getElementById("stat-level-passing")
    if (statCurrentLevelEl) {
        statCurrentLevelEl.textContent = currentLevel?.name || "المستوى التمهيدي"
    }
    if (statLevelPassingEl) {
        statLevelPassingEl.textContent = `نسبة النجاح المطلوبة: ${currentLevel?.passingScore || 60}%`
    }

    // Matn Card
    const statMatnCountEl = document.getElementById("stat-matn-count")
    const statMatnDetailEl = document.getElementById("stat-matn-detail")
    const activeMatnCount = matnProgressList.length
    if (statMatnCountEl) statMatnCountEl.textContent = activeMatnCount
    if (statMatnDetailEl) {
        const masteredCount = matnProgressList.filter((m) => m.status === "mastered").length
        statMatnDetailEl.textContent = `${masteredCount} متقن من ${activeMatnCount} متن`
    }

    // Available Exams Card
    const statExamsAvailableEl = document.getElementById("stat-exams-available")
    const statExamsDetailEl = document.getElementById("stat-exams-detail")
    if (statExamsAvailableEl) statExamsAvailableEl.textContent = availableExamsList.length
    if (statExamsDetailEl) {
        const onlineCount = availableExamsList.filter((e) => e.format === "online").length
        statExamsDetailEl.textContent = `${onlineCount} إلكتروني عن بُعد`
    }

    // Latest Result Card
    const statLatestResultEl = document.getElementById("stat-latest-result")
    const statLatestResultBadgeEl = document.getElementById("stat-latest-result-badge")
    if (examResultsList.length > 0) {
        const latest = examResultsList[0]
        const pct = latest.percentage ?? (latest.totalScore ? Math.round((latest.score / latest.totalScore) * 100) : 0)
        if (statLatestResultEl) statLatestResultEl.textContent = `${pct}%`
        if (statLatestResultBadgeEl) {
            statLatestResultBadgeEl.textContent = latest.isPassed ? "ناجح ومجتاز ✓" : "يحتاج إعادة وتكثيف"
            statLatestResultBadgeEl.className = `mt-1 text-xs font-semibold ${latest.isPassed ? "text-emerald-700" : "text-rose-600"}`
        }
    } else {
        if (statLatestResultEl) statLatestResultEl.textContent = "-"
        if (statLatestResultBadgeEl) {
            statLatestResultBadgeEl.textContent = "لا توجد نتائج معلنة بعد"
            statLatestResultBadgeEl.className = "mt-1 text-xs text-slate-400"
        }
    }

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

/* ===================================================
   TAB: LEVEL (مستواي الدراسي وسجل الترقية)
=================================================== */
function renderLevelTab() {
    const levelNameEl = document.getElementById("student-current-level-name")
    const levelBadgeEl = document.getElementById("student-level-order-badge")
    const levelDescEl = document.getElementById("student-current-level-desc")
    const levelPassingEl = document.getElementById("student-level-passing-score")
    const levelExamsReqEl = document.getElementById("student-level-exams-req")
    const requirementsListEl = document.getElementById("student-level-requirements-list")
    const nextLevelTitleEl = document.getElementById("student-next-level-title")
    const historyBodyEl = document.getElementById("student-level-history-body")

    if (currentLevel) {
        if (levelNameEl) levelNameEl.textContent = currentLevel.name || "المستوى التعليمي"
        if (levelBadgeEl) levelBadgeEl.textContent = `المستوى ${currentLevel.order || 1}`
        if (levelDescEl) levelDescEl.textContent = currentLevel.requirements || "مستوى تعليمي يهدف لترسيخ حفظ وتلاوة كتاب الله والمتون الأساسية."
        if (levelPassingEl) levelPassingEl.textContent = `${currentLevel.passingScore || 60}%`
        if (levelExamsReqEl) levelExamsReqEl.textContent = `امتحانات مطلوبة: ${currentLevel.requiredExamsCount || 1}`

        if (requirementsListEl) {
            requirementsListEl.innerHTML = `
                <div class="flex items-start gap-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <span>الحصول على معدل لا يقل عن ${currentLevel.passingScore || 60}% في الامتحانات المقررة.</span>
                </div>
                <div class="flex items-start gap-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <span>اجتياز عدد ${currentLevel.requiredExamsCount || 1} امتحان/امتحانات معتمدة للمستوى.</span>
                </div>
                ${currentLevel.requirements ? `
                <div class="flex items-start gap-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <span>${currentLevel.requirements}</span>
                </div>` : ""}
            `
        }

        if (nextLevelTitleEl) {
            nextLevelTitleEl.textContent = currentLevel.nextLevel?.name || "المستوى الأعلى التالي"
        }
    } else {
        if (levelNameEl) levelNameEl.textContent = "المستوى التمهيدي"
        if (levelPassingEl) levelPassingEl.textContent = "60%"
        if (nextLevelTitleEl) nextLevelTitleEl.textContent = "المستوى الأول"
    }

    if (historyBodyEl) {
        if (levelHistoryList.length === 0) {
            historyBodyEl.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-xs text-slate-400">لا توجد سجلات ترقية سابقة. أنت حالياً مسجل في مستواك الأولي.</td></tr>`
        } else {
            historyBodyEl.innerHTML = levelHistoryList.map((h) => `
                <tr class="hover:bg-slate-50/50">
                    <td class="px-4 py-3 text-xs text-slate-500">${h.previousLevel?.name || "المستوى الأولي"}</td>
                    <td class="px-4 py-3 text-xs font-bold text-emerald-700">${h.newLevel?.name || "-"}</td>
                    <td class="px-4 py-3 text-xs text-slate-500">${formatDate(h.changeDate)}</td>
                    <td class="px-4 py-3 text-xs text-slate-600">${h.reason || "اجتياز متطلبات المستوى"}</td>
                    <td class="px-4 py-3 text-xs text-slate-400">${h.notes || "-"}</td>
                </tr>
            `).join("")
        }
    }
}

/* ===================================================
   TAB: MATN (حفظ المتون العلمية)
=================================================== */
function renderMatnTab() {
    const gridEl = document.getElementById("student-matn-grid")
    if (!gridEl) return

    if (matnProgressList.length === 0) {
        gridEl.innerHTML = `
            <div class="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" />
                </svg>
                <p class="text-sm font-semibold text-slate-700">لم يتم تسجيل متون علمية لك بعد</p>
                <p class="text-xs text-slate-400 mt-1">يقوم الشيخ المعلم بتحديد المتون العلمية ومتابعة حفظك وتسميعها في الحلقة.</p>
            </div>`
        return
    }

    const statusBadgeMap = {
        mastered: { label: "متقن ومجاز", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        memorizing: { label: "قيد الحفظ", cls: "bg-blue-50 text-blue-700 border-blue-200" },
        needs_revision: { label: "يحتاج مراجعة وتكرار", cls: "bg-amber-50 text-amber-700 border-amber-200" },
        not_started: { label: "لم يبدأ بعد", cls: "bg-slate-100 text-slate-600 border-slate-200" }
    }

    gridEl.innerHTML = matnProgressList.map((m) => {
        const badge = statusBadgeMap[m.status] || statusBadgeMap.memorizing
        const pct = m.progressPercentage || 0
        const teacherName = m.teacher?.name || `${m.teacher?.firstName || ""} ${m.teacher?.lastName || ""}`.trim() || "الشيخ المعلم"

        return `
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md space-y-4">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <span class="inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold border ${badge.cls}">
                            ${badge.label}
                        </span>
                        <h4 class="mt-2 text-base font-bold text-slate-800">${m.matn?.name || "متن علمي"}</h4>
                    </div>
                    ${m.masteryGrade ? `
                        <span class="rounded-xl bg-purple-50 px-2.5 py-1 text-xs font-extrabold text-purple-700 border border-purple-100" title="درجة الإتقان">
                            ${m.masteryGrade}
                        </span>` : ""}
                </div>

                <!-- Progress Bar -->
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                        <span>نسبة الإنجاز</span>
                        <span class="font-bold text-slate-800">${pct}%</span>
                    </div>
                    <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div class="h-full rounded-full bg-emerald-600 transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                    <div>
                        <span class="text-slate-400 block">الباب / الفصل</span>
                        <span class="font-semibold text-slate-700">${m.section || "الأبواب الأولى"}</span>
                    </div>
                    <div>
                        <span class="text-slate-400 block">آخر تسميع</span>
                        <span class="font-semibold text-slate-700">${formatDate(m.recitationDate)}</span>
                    </div>
                </div>

                ${m.notes ? `
                <div class="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100">
                    <span class="font-bold text-slate-700 block mb-0.5 text-[11px]">ملاحظات الشيخ ${teacherName}:</span>
                    <p class="text-[11px] text-slate-600">${m.notes}</p>
                </div>` : ""}
            </div>
        `
    }).join("")
}

/* ===================================================
   TAB: EXAMS (امتحاناتي واختباراتي)
=================================================== */
function renderExamsTab() {
    const bodyEl = document.getElementById("student-exams-body")
    if (!bodyEl) return

    if (availableExamsList.length === 0) {
        bodyEl.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-slate-400">لا توجد امتحانات مقررة متاحة لك حالياً.</td></tr>`
        return
    }

    const typeLabels = {
        quran: "قرآن كريم",
        matn: "متن علمي",
        level: "ترقية مستوى",
        periodic: "دوري / فصلي"
    }

    bodyEl.innerHTML = availableExamsList.map((exam) => {
        const typeLabel = typeLabels[exam.type] || exam.type
        const isOnline = exam.format === "online"

        // Check if student has already submitted this exam
        const existingResult = examResultsList.find((r) => r.exam?._id === exam._id || r.exam === exam._id)
        const isSubmitted = existingResult && existingResult.status !== "in_progress" && existingResult.status !== "not_started"
        const isPublished = exam.isResultsPublished || existingResult?.status === "published"

        let actionBtn = ""
        let statusBadge = ""

        if (isPublished) {
            statusBadge = '<span class="inline-flex rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">تم إعلان النتيجة</span>'
            actionBtn = `<button type="button" data-switch-tab="results" class="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition">عرض النتيجة</button>`
        } else if (isSubmitted) {
            statusBadge = '<span class="inline-flex rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">تم التسليم - قيد التصحيح</span>'
            actionBtn = `<span class="text-xs text-slate-400">بانتظار رصد الدرجة</span>`
        } else if (isOnline) {
            statusBadge = '<span class="inline-flex rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">متاح إلكترونياً</span>'
            actionBtn = `<button type="button" class="btn-start-exam rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition" data-exam-id="${exam._id}">بدء الامتحان الآن</button>`
        } else {
            statusBadge = '<span class="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">حضوري بالمدرسة</span>'
            actionBtn = `<span class="text-xs text-slate-500">يُجرى في مقر الحلقة</span>`
        }

        return `
            <tr class="hover:bg-slate-50/50">
                <td class="px-6 py-4">
                    <p class="font-bold text-slate-800 text-sm">${exam.title}</p>
                    <p class="text-xs text-slate-400 line-clamp-1">${exam.instructions || ""}</p>
                </td>
                <td class="px-6 py-4">
                    <span class="font-medium text-xs text-slate-700">${typeLabel}</span>
                    <span class="block text-[11px] text-slate-400">${isOnline ? "إلكتروني عن بُعد" : "حضوري"}</span>
                </td>
                <td class="px-6 py-4">
                    <span class="font-bold text-xs text-slate-800">${exam.durationMinutes} دقيقة</span>
                    <span class="block text-[11px] text-slate-400">${exam.totalScore} درجة (النجاح: ${exam.passingScore})</span>
                </td>
                <td class="px-6 py-4 text-xs text-slate-500">
                    ${exam.startDate ? formatDate(exam.startDate) : "-"} إلى ${exam.endDate ? formatDate(exam.endDate) : "-"}
                </td>
                <td class="px-6 py-4">
                    ${statusBadge}
                </td>
                <td class="px-6 py-4 text-center">
                    ${actionBtn}
                </td>
            </tr>
        `
    }).join("")

    // Hook up start exam buttons
    bodyEl.querySelectorAll(".btn-start-exam").forEach((btn) => {
        btn.addEventListener("click", () => {
            const examId = btn.dataset.examId
            startOnlineExam(examId)
        })
    })

    // Hook up switch tab buttons
    bodyEl.querySelectorAll("[data-switch-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (window.switchTab) window.switchTab(btn.dataset.switchTab)
        })
    })
}

/* ===================================================
   TAB: RESULTS (نتائجي وتقارير الدرجات)
=================================================== */
function renderResultsTab() {
    const bodyEl = document.getElementById("student-results-body")
    if (!bodyEl) return

    if (examResultsList.length === 0) {
        bodyEl.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-xs text-slate-400">لا توجد نتائج معلنة بعد. فور اعتماد درجات امتحاناتك ستظهر هنا بالتفصيل.</td></tr>`
        return
    }

    bodyEl.innerHTML = examResultsList.map((res) => {
        const examTitle = res.exam?.title || "امتحان"
        const examType = res.exam?.type || "عام"
        const score = res.score ?? 0
        const total = res.totalScore ?? res.exam?.totalScore ?? 100
        const pct = res.percentage ?? Math.round((score / total) * 100)
        const isPassed = res.isPassed

        return `
            <tr class="hover:bg-slate-50/50">
                <td class="px-6 py-4 font-bold text-slate-800 text-sm">
                    ${examTitle}
                </td>
                <td class="px-6 py-4 text-xs text-slate-600">
                    ${examType}
                </td>
                <td class="px-6 py-4 font-extrabold text-sm text-slate-800">
                    ${score} <span class="text-xs font-normal text-slate-400">/ ${total}</span>
                </td>
                <td class="px-6 py-4 font-bold text-sm ${isPassed ? 'text-emerald-700' : 'text-rose-600'}">
                    ${pct}%
                </td>
                <td class="px-6 py-4">
                    <span class="inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                        ${isPassed ? 'ناجح ومجتاز ✓' : 'لم يجتز'}
                    </span>
                </td>
                <td class="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                    ${res.teacherNotes || "لا توجد ملاحظات إضافية"}
                </td>
                <td class="px-6 py-4 text-center">
                    <button type="button" class="btn-view-result rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition" data-attempt-id="${res._id}">
                        عرض التفاصيل
                    </button>
                </td>
            </tr>
        `
    }).join("")

    bodyEl.querySelectorAll(".btn-view-result").forEach((btn) => {
        btn.addEventListener("click", () => {
            const attemptId = btn.dataset.attemptId
            const attempt = examResultsList.find((r) => r._id === attemptId)
            if (attempt) viewExamResultDetails(attempt)
        })
    })
}

/* ===================================================
   ONLINE EXAM ENGINE & MODALS
=================================================== */
const modalTakeExam = document.getElementById("modal-take-exam")
const modalConfirmSubmit = document.getElementById("modal-confirm-submit")
const modalViewResult = document.getElementById("modal-view-result")

function setupExamModalHandlers() {
    const btnSubmitTrigger = document.getElementById("btn-submit-exam-trigger")
    if (btnSubmitTrigger) {
        btnSubmitTrigger.addEventListener("click", () => {
            promptConfirmSubmit()
        })
    }

    const btnCancelSubmit = document.getElementById("btn-cancel-submit")
    if (btnCancelSubmit) {
        btnCancelSubmit.addEventListener("click", () => {
            closeModal(modalConfirmSubmit)
        })
    }

    const btnFinalConfirm = document.getElementById("btn-final-confirm-submit")
    if (btnFinalConfirm) {
        btnFinalConfirm.addEventListener("click", async () => {
            await finalSubmitExam()
        })
    }

    const btnPrev = document.getElementById("btn-prev-question")
    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            if (currentQuestionIndex > 0) {
                currentQuestionIndex--
                renderActiveQuestion()
            }
        })
    }

    const btnNext = document.getElementById("btn-next-question")
    if (btnNext) {
        btnNext.addEventListener("click", () => {
            if (activeExam?.questions && currentQuestionIndex < activeExam.questions.length - 1) {
                currentQuestionIndex++
                renderActiveQuestion()
            }
        })
    }
}

async function startOnlineExam(examId) {
    try {
        showAlert("جاري تحضير الامتحان وتأكيد البداية...", "success")
        const startRes = await startExamAttempt(examId)
        const data = startRes?.data || startRes

        activeExam = data.exam
        activeAttempt = data.attempt
        currentQuestionIndex = 0
        userAnswers = {}

        // Populate initial answers if any from prior progress
        if (activeAttempt?.answers && Array.isArray(activeAttempt.answers)) {
            activeAttempt.answers.forEach((ans) => {
                const qId = ans.question?._id || ans.question
                if (qId) userAnswers[qId] = ans.answerText
            })
        }

        // Set titles
        const titleEl = document.getElementById("exam-modal-title")
        const instEl = document.getElementById("exam-modal-instructions")
        if (titleEl) titleEl.textContent = activeExam.title
        if (instEl) instEl.textContent = activeExam.instructions || "يرجى الإجابة بدقة وتركيز قبل انتهاء الوقت المخصص."

        // Initialize Timer
        const totalDurationSec = (activeExam.durationMinutes || 30) * 60
        const spentSec = activeAttempt?.durationSpentSeconds || 0
        examRemainingSeconds = Math.max(10, totalDurationSec - spentSec)

        startExamTimer()
        startPeriodicAutoSave()

        // Open modal
        openModal(modalTakeExam)

        // Render first question
        renderActiveQuestion()

    } catch (err) {
        console.error("Failed to start online exam:", err)
        showAlert("تعذر بدء الامتحان: " + err.message, "error")
    }
}

function startExamTimer() {
    clearInterval(examTimerInterval)
    const timerDisplay = document.getElementById("exam-timer-display")
    const timerContainer = document.getElementById("exam-timer-container")

    function updateDisplay() {
        const mins = Math.floor(examRemainingSeconds / 60)
        const secs = examRemainingSeconds % 60
        const str = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        if (timerDisplay) timerDisplay.textContent = str

        if (examRemainingSeconds <= 300) {
            timerContainer?.classList.remove("bg-slate-800")
            timerContainer?.classList.add("bg-rose-700", "animate-pulse")
        } else {
            timerContainer?.classList.remove("bg-rose-700", "animate-pulse")
            timerContainer?.classList.add("bg-slate-800")
        }
    }

    updateDisplay()

    examTimerInterval = setInterval(async () => {
        examRemainingSeconds--
        updateDisplay()

        if (examRemainingSeconds <= 0) {
            clearInterval(examTimerInterval)
            clearInterval(periodicSaveInterval)
            alert("انتهى وقت الامتحان! سيتم تسليم إجاباتك تلقائياً الآن.")
            await finalSubmitExam(true)
        }
    }, 1000)
}

function startPeriodicAutoSave() {
    clearInterval(periodicSaveInterval)
    periodicSaveInterval = setInterval(() => {
        saveExamProgressOnServer()
    }, 30000)
}

function renderActiveQuestion() {
    if (!activeExam || !activeExam.questions || activeExam.questions.length === 0) return

    const questions = activeExam.questions
    const q = questions[currentQuestionIndex]
    const qId = q._id

    // Question Progress badge
    const qProgressEl = document.getElementById("exam-question-progress")
    if (qProgressEl) qProgressEl.textContent = `سؤال ${currentQuestionIndex + 1} من ${questions.length}`

    // Palette
    const paletteEl = document.getElementById("exam-palette-container")
    if (paletteEl) {
        paletteEl.innerHTML = questions.map((item, idx) => {
            const isAns = userAnswers[item._id] !== undefined && userAnswers[item._id] !== ""
            const isCurrent = idx === currentQuestionIndex
            let cls = "h-8 w-8 rounded-xl text-xs font-bold flex items-center justify-center transition "
            if (isCurrent) {
                cls += "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1"
            } else if (isAns) {
                cls += "bg-emerald-100 text-emerald-800 border border-emerald-300"
            } else {
                cls += "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }
            return `<button type="button" class="btn-palette-goto ${cls}" data-q-index="${idx}">${idx + 1}</button>`
        }).join("")

        paletteEl.querySelectorAll(".btn-palette-goto").forEach((btn) => {
            btn.addEventListener("click", () => {
                currentQuestionIndex = parseInt(btn.dataset.qIndex, 10)
                renderActiveQuestion()
            })
        })
    }

    // Active question card
    const cardEl = document.getElementById("exam-active-question-card")
    if (!cardEl) return

    const currentAns = userAnswers[qId] || ""

    let inputHtml = ""

    if (q.type === "mcq" && q.options && q.options.length > 0) {
        inputHtml = `
            <div class="space-y-2.5 pt-2">
                ${q.options.map((opt) => `
                    <label class="flex items-center gap-3 rounded-xl border border-slate-200 p-3.5 transition hover:bg-slate-50 cursor-pointer ${currentAns === opt ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500' : ''}">
                        <input type="radio" name="exam_q_${qId}" value="${opt}" class="h-4 w-4 text-emerald-600 focus:ring-emerald-500" ${currentAns === opt ? 'checked' : ''}>
                        <span class="text-sm font-medium text-slate-700">${opt}</span>
                    </label>
                `).join("")}
            </div>
        `
    } else if (q.type === "true_false") {
        inputHtml = `
            <div class="grid grid-cols-2 gap-3 pt-2">
                <label class="flex items-center justify-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 cursor-pointer ${currentAns === 'صح' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-500' : ''}">
                    <input type="radio" name="exam_q_${qId}" value="صح" class="h-4 w-4 text-emerald-600 focus:ring-emerald-500" ${currentAns === 'صح' ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-800">صحيح (صح)</span>
                </label>
                <label class="flex items-center justify-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 cursor-pointer ${currentAns === 'خطأ' ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-500' : ''}">
                    <input type="radio" name="exam_q_${qId}" value="خطأ" class="h-4 w-4 text-rose-600 focus:ring-rose-500" ${currentAns === 'خطأ' ? 'checked' : ''}>
                    <span class="text-sm font-bold text-slate-800">خاطئ (خطأ)</span>
                </label>
            </div>
        `
    } else if (q.type === "short_answer") {
        inputHtml = `
            <div class="pt-2">
                <input type="text" id="exam_input_${qId}" value="${currentAns}" placeholder="اكتب إجابتك هنا باختصار..." class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none">
            </div>
        `
    } else if (q.type === "essay" || q.type === "oral_recitation") {
        inputHtml = `
            <div class="pt-2 space-y-2">
                <textarea id="exam_input_${qId}" rows="4" placeholder="${q.type === 'oral_recitation' ? 'ملاحظات حول التسميع الشفوي أو استفسارات للمعلم...' : 'اكتب إجابتك بالتفصيل هنا...'}" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none">${currentAns}</textarea>
                ${q.type === 'oral_recitation' ? '<p class="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">هذا السؤال مخصص للتسميع الشفوي الحضوري أو المباشر مع الشيخ المعلم.</p>' : ''}
            </div>
        `
    }

    cardEl.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <span class="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                السؤال رقم ${currentQuestionIndex + 1}
            </span>
            <span class="text-xs font-bold text-slate-500">
                ${q.points || 1} درجة
            </span>
        </div>
        <div class="py-2">
            <h4 class="text-base font-bold text-slate-800 leading-relaxed">${q.questionText}</h4>
        </div>
        ${inputHtml}
    `

    // Hook inputs
    const radios = cardEl.querySelectorAll(`input[name="exam_q_${qId}"]`)
    radios.forEach((r) => {
        r.addEventListener("change", () => {
            userAnswers[qId] = r.value
            renderActiveQuestion()
            debounceAutoSave()
        })
    })

    const textInput = document.getElementById(`exam_input_${qId}`)
    if (textInput) {
        textInput.addEventListener("input", () => {
            userAnswers[qId] = textInput.value
            debounceAutoSave()
        })
    }

    // Prev & Next Buttons state
    const btnPrev = document.getElementById("btn-prev-question")
    const btnNext = document.getElementById("btn-next-question")
    if (btnPrev) btnPrev.disabled = currentQuestionIndex === 0
    if (btnNext) {
        if (currentQuestionIndex === questions.length - 1) {
            btnNext.textContent = "تسليم الامتحان"
            btnNext.onclick = promptConfirmSubmit
        } else {
            btnNext.textContent = "التالي"
            btnNext.onclick = () => {
                currentQuestionIndex++
                renderActiveQuestion()
            }
        }
    }
}

function debounceAutoSave() {
    clearTimeout(autoSaveDebounceTimer)
    autoSaveDebounceTimer = setTimeout(() => {
        saveExamProgressOnServer()
    }, 1500)
}

async function saveExamProgressOnServer() {
    if (!activeExam || !activeExam._id) return
    const statusEl = document.getElementById("exam-autosave-status")
    try {
        const formatted = Object.keys(userAnswers).map((qId) => ({
            questionId: qId,
            answerText: userAnswers[qId]
        }))

        await saveExamProgress(activeExam._id, formatted)
        const now = new Date()
        const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        if (statusEl) {
            statusEl.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-500"></span><span>تم الحفظ تلقائياً بنجاح (${timeStr})</span>`
        }
    } catch (err) {
        console.warn("Auto-save warning:", err)
        if (statusEl) {
            statusEl.innerHTML = `<span class="h-2 w-2 rounded-full bg-amber-500"></span><span>فشل الحفظ التلقائي، جاري إعادة المحاولة...</span>`
        }
    }
}

function promptConfirmSubmit() {
    if (!activeExam || !activeExam.questions) return
    const answeredCount = Object.keys(userAnswers).filter((k) => userAnswers[k] && userAnswers[k].trim() !== "").length
    const totalCount = activeExam.questions.length
    const unanswered = totalCount - answeredCount

    const warningEl = document.getElementById("confirm-unanswered-warning")
    if (warningEl) {
        if (unanswered > 0) {
            warningEl.innerHTML = `<span class="text-amber-700 font-bold block mb-1">تنبيه: لديك ${unanswered} أسئلة لم تجب عليها بعد!</span>هل ترغب في تسليم الامتحان الآن نهائياً؟`
        } else {
            warningEl.textContent = "لقد أجبت على جميع الأسئلة. هل أنت متأكد من تسليم الامتحان نهائياً؟"
        }
    }

    openModal(modalConfirmSubmit)
}

async function finalSubmitExam(isAuto = false) {
    if (!activeExam || !activeExam._id) return

    try {
        clearInterval(examTimerInterval)
        clearInterval(periodicSaveInterval)

        const formatted = Object.keys(userAnswers).map((qId) => ({
            questionId: qId,
            answerText: userAnswers[qId]
        }))

        showAlert("جاري رصد وتسليم إجاباتك...", "success")

        await submitExamAttempt(activeExam._id, formatted)

        closeModal(modalConfirmSubmit)
        closeModal(modalTakeExam)

        showAlert("تم تسليم الامتحان بنجاح تام! بارك الله في جهودك.", "success")

        // Reload data and switch to results tab
        await loadInitialData()
        if (window.switchTab) window.switchTab("results")

    } catch (err) {
        console.error("Submission failed:", err)
        showAlert("فشل تسليم الامتحان: " + err.message, "error")
    }
}

function viewExamResultDetails(attempt) {
    if (!attempt) return

    const titleEl = document.getElementById("result-modal-title")
    const bannerEl = document.getElementById("result-modal-score-banner")
    const breakdownEl = document.getElementById("result-modal-breakdown")

    const examTitle = attempt.exam?.title || "امتحان"
    if (titleEl) titleEl.textContent = `نتيجة: ${examTitle}`

    const score = attempt.score ?? 0
    const total = attempt.totalScore ?? attempt.exam?.totalScore ?? 100
    const pct = attempt.percentage ?? Math.round((score / total) * 100)
    const isPassed = attempt.isPassed

    if (bannerEl) {
        bannerEl.className = `rounded-2xl border p-5 text-center ${isPassed ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`
        bannerEl.innerHTML = `
            <span class="inline-block rounded-xl px-3 py-1 text-xs font-extrabold ${isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                ${isPassed ? 'ناجح ومجتاز ✓' : 'لم يحقق نسبة النجاح'}
            </span>
            <h3 class="mt-2 text-3xl font-black ${isPassed ? 'text-emerald-800' : 'text-rose-800'}">${score} <span class="text-sm font-semibold text-slate-500">/ ${total}</span></h3>
            <p class="text-xs font-bold text-slate-600 mt-1">النسبة المئوية: ${pct}%</p>
            ${attempt.teacherNotes ? `
                <div class="mt-3 rounded-xl bg-white p-3 text-xs text-slate-700 border border-slate-100 text-right">
                    <span class="font-bold block text-slate-800 mb-0.5">توجيهات وملاحظات المصحح:</span>
                    <p>${attempt.teacherNotes}</p>
                </div>` : ''}
        `
    }

    if (breakdownEl) {
        if (!attempt.answers || attempt.answers.length === 0) {
            breakdownEl.innerHTML = `<p class="py-4 text-center text-xs text-slate-400">لا توجد تفاصيل إجابات متاحة لهذا الامتحان.</p>`
        } else {
            breakdownEl.innerHTML = attempt.answers.map((ans, idx) => {
                const qText = ans.question?.questionText || `السؤال رقم ${idx + 1}`
                const qPoints = ans.question?.points || 1
                const awarded = ans.awardedScore ?? (ans.isCorrect ? qPoints : 0)

                return `
                    <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-slate-800 text-sm">سؤال ${idx + 1}: ${qText}</span>
                            <span class="font-extrabold text-xs ${awarded > 0 ? 'text-emerald-700' : 'text-rose-600'}">
                                ${awarded} / ${qPoints} درجة
                            </span>
                        </div>
                        <div class="rounded-xl bg-white p-2.5 border border-slate-100 text-slate-700">
                            <span class="text-slate-400 block text-[11px]">إجابتك:</span>
                            <p class="font-medium mt-0.5">${ans.answerText || "(لم تجب)"}</p>
                        </div>
                        ${ans.teacherFeedback ? `
                            <div class="rounded-xl bg-indigo-50/60 p-2 text-indigo-900 border border-indigo-100">
                                <span class="font-bold block text-[11px]">ملاحظة المصحح:</span>
                                <p>${ans.teacherFeedback}</p>
                            </div>` : ''}
                    </div>
                `
            }).join("")
        }
    }

    openModal(modalViewResult)
}