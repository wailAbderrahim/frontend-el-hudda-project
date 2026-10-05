import {
    getStudentReport,
    getHalaqaReport
} from "../../api/reportsApi.js"

import { getHalaqas } from "../../api/halaqaApi.js"
import { getUsers } from "../../api/usersApi.js"
import { getUser, protectPage } from "../../auth/auth.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")


/* =========================================================
   State
========================================================= */
let currentTab = "halaqa" // 'halaqa' | 'student'
let allHalaqas = []
let allStudents = []


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

    await loadInitialData()
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
async function loadInitialData() {
    try {
        const [halaqasData, usersData] = await Promise.all([
            getHalaqas(),
            getUsers()
        ])

        allHalaqas = Array.isArray(halaqasData) ? halaqasData : []

        const rawUsers = Array.isArray(usersData) ? usersData : []
        allStudents = rawUsers.filter(u => u.role === "student")

        populateHalaqas()
        populateStudents()
    } catch (error) {
        console.error("Initial data load error:", error)
        showError("تعذر تحميل الحلقات وقائمة الطلاب اللازمة للتقارير.")
    }
}

function populateHalaqas() {
    const select = $("report-halaqa-select")
    if (!select) return

    select.innerHTML = `<option value="">اختر الحلقة</option>`
    allHalaqas.forEach(h => {
        const opt = document.createElement("option")
        opt.value = h._id
        opt.textContent = h.name
        select.appendChild(opt)
    })
}

function populateStudents(halaqaId = "") {
    const select = $("report-student-select")
    if (!select) return

    select.innerHTML = `<option value="">اختر الطالب</option>`

    let studentsToDisplay = allStudents

    if (halaqaId) {
        const halaqa = allHalaqas.find(h => h._id === halaqaId)
        if (halaqa && Array.isArray(halaqa.students)) {
            const studentIds = halaqa.students.map(s => typeof s === "object" ? s._id : s)
            studentsToDisplay = allStudents.filter(s => studentIds.includes(s._id))
        }
    }

    if (studentsToDisplay.length === 0) {
        select.innerHTML = `<option value="">لا يوجد طلاب متاحون</option>`
        return
    }

    studentsToDisplay.forEach(s => {
        const opt = document.createElement("option")
        opt.value = s._id
        opt.textContent = `${s.name || s.email} (${s.email})`
        select.appendChild(opt)
    })
}


/* =========================================================
   Tab Switching
========================================================= */
function switchTab(tab) {
    currentTab = tab

    const tabHalaqa = $("tab-halaqa")
    const tabStudent = $("tab-student")
    const studentSelectContainer = $("student-select-container")

    hideViews()
    hideError()
    showEmptyState(true)

    if (tab === "halaqa") {
        tabHalaqa.className = "rounded-xl px-4 py-2 text-sm font-bold transition bg-emerald-700 text-white shadow-sm"
        tabStudent.className = "rounded-xl px-4 py-2 text-sm font-semibold transition text-slate-600 hover:bg-slate-100"
        studentSelectContainer.classList.add("hidden")
    } else {
        tabStudent.className = "rounded-xl px-4 py-2 text-sm font-bold transition bg-emerald-700 text-white shadow-sm"
        tabHalaqa.className = "rounded-xl px-4 py-2 text-sm font-semibold transition text-slate-600 hover:bg-slate-100"
        studentSelectContainer.classList.remove("hidden")

        // Refill students based on current halaqa selection
        const currentHalaqaId = $("report-halaqa-select")?.value
        populateStudents(currentHalaqaId)
    }
}


/* =========================================================
   Event Listeners
========================================================= */
function setupEvents() {
    $("tab-halaqa")?.addEventListener("click", () => switchTab("halaqa"))
    $("tab-student")?.addEventListener("click", () => switchTab("student"))

    $("report-halaqa-select")?.addEventListener("change", (e) => {
        if (currentTab === "student") {
            populateStudents(e.target.value)
        }
    })

    $("generate-report-btn")?.addEventListener("click", handleGenerateReport)
    $("print-report-btn")?.addEventListener("click", () => window.print())
}


/* =========================================================
   Generate Report Logic
========================================================= */
async function handleGenerateReport() {
    hideError()

    if (currentTab === "halaqa") {
        const halaqaId = $("report-halaqa-select")?.value
        if (!halaqaId) {
            showError("يرجى اختيار الحلقة أولاً لعرض تقريرها.")
            return
        }
        await loadHalaqaReport(halaqaId)
    } else {
        const studentId = $("report-student-select")?.value
        if (!studentId) {
            showError("يرجى اختيار الطالب لعرض تقريره.")
            return
        }
        await loadStudentReport(studentId)
    }
}

async function loadHalaqaReport(halaqaId) {
    showLoading(true)
    showEmptyState(false)
    hideViews()

    try {
        const report = await getHalaqaReport(halaqaId)
        renderHalaqaReport(report)
        $("print-report-btn")?.classList.remove("hidden")
        $("print-report-btn")?.classList.add("flex")
    } catch (error) {
        console.error("Halaqa report error:", error)
        showError(error.message || "فشل جلب تقرير الحلقة.")
        showEmptyState(true)
    } finally {
        showLoading(false)
    }
}

async function loadStudentReport(studentId) {
    showLoading(true)
    showEmptyState(false)
    hideViews()

    try {
        const report = await getStudentReport(studentId)
        renderStudentReport(report)
        $("print-report-btn")?.classList.remove("hidden")
        $("print-report-btn")?.classList.add("flex")
    } catch (error) {
        console.error("Student report error:", error)
        showError(error.message || "فشل جلب تقرير الطالب. قد لا يكون الطالب مسجلاً في أي حلقة حالياً.")
        showEmptyState(true)
    } finally {
        showLoading(false)
    }
}


/* =========================================================
   Rendering Halaqa Report
========================================================= */
function renderHalaqaReport(data) {
    const view = $("halaqa-report-view")
    if (!view) return

    const halaqaName = data.halaqa?.name || "حلقة غير معروفة"
    const teacherName = data.halaqa?.teacher?.name || "غير محدد"
    const teacherEmail = data.halaqa?.teacher?.email ? `(${data.halaqa.teacher.email})` : ""

    setText("hr-name", halaqaName)
    setText("hr-teacher", teacherName)
    setText("hr-teacher-email", teacherEmail)
    setText("hr-students-count", data.studentsCount || 0)

    const attRate = (Number(data.attendance?.attendanceRate) || 0).toFixed(1)
    setText("hr-attendance-rate", `${attRate}%`)
    setText("hr-attendance-total", data.attendance?.total || 0)
    setText("hr-memorization-total", data.memorization?.total || 0)

    const evalAvg = (Number(data.evaluations?.averageScore) || 0).toFixed(1)
    setText("hr-evaluation-avg", `${evalAvg} / 10`)

    setText("hr-att-present", data.attendance?.present || 0)
    setText("hr-att-absent", data.attendance?.absent || 0)
    setText("hr-att-late", data.attendance?.late || 0)

    view.classList.remove("hidden")
}


/* =========================================================
   Rendering Student Report
========================================================= */
function renderStudentReport(data) {
    const view = $("student-report-view")
    if (!view) return

    const studentName = data.student?.name || "طالب غير معروف"
    const studentEmail = data.student?.email || ""
    const halaqaName = data.halaqa?.name || "غير محددة"
    const teacherName = data.halaqa?.teacher?.name || "غير محدد"

    setText("sr-name", studentName)
    setText("sr-email", studentEmail)
    setText("sr-halaqa", halaqaName)
    setText("sr-teacher", teacherName)

    const attRate = (Number(data.attendance?.attendanceRate) || 0).toFixed(1)
    setText("sr-attendance-rate", `${attRate}%`)
    setText("sr-attendance-total", data.attendance?.total || 0)
    setText("sr-att-present", data.attendance?.present || 0)
    setText("sr-att-absent", data.attendance?.absent || 0)
    setText("sr-att-late", data.attendance?.late || 0)

    setText("sr-memorization-total", data.memorization?.total || 0)

    const evalAvg = (Number(data.evaluations?.averageScore) || 0).toFixed(1)
    setText("sr-evaluation-avg", `${evalAvg} / 10`)
    setText("sr-eval-total", data.evaluations?.total || 0)

    // Render Last Memorization Card
    const memContainer = $("sr-last-memorization")
    if (memContainer) {
        if (data.memorization?.last) {
            const lastMem = data.memorization.last
            const dateStr = formatDate(lastMem.date || lastMem.createdAt)
            memContainer.innerHTML = `
                <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span class="font-bold text-emerald-800">سورة ${escapeHTML(lastMem.surah || "—")}</span>
                    <span class="text-xs text-slate-400">${dateStr}</span>
                </div>
                <div class="text-xs text-slate-600 mt-2">
                    الآيات: من <strong>${lastMem.fromVerse}</strong> إلى <strong>${lastMem.toVerse}</strong>
                </div>
            `
        } else {
            memContainer.innerHTML = `<p class="text-xs text-slate-400">لا يوجد تسميع مسجل لهذا الطالب بعد.</p>`
        }
    }

    // Render Last Evaluation Card
    const evalContainer = $("sr-last-evaluation")
    if (evalContainer) {
        if (data.evaluations?.last) {
            const lastEval = data.evaluations.last
            const typeLabel = lastEval.type === "memorization" ? "حفظ" : lastEval.type === "recitation" ? "تلاوة" : "تجويد"
            const dateStr = formatDate(lastEval.date || lastEval.createdAt)
            evalContainer.innerHTML = `
                <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span class="font-bold text-slate-800">تقييم ${typeLabel}</span>
                    <span class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">${lastEval.score} / 10</span>
                </div>
                <div class="text-xs text-slate-500 mt-2">
                    التاريخ: ${dateStr}
                </div>
                ${lastEval.notes ? `<p class="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100 mt-1 italic">"${escapeHTML(lastEval.notes)}"</p>` : ""}
            `
        } else {
            evalContainer.innerHTML = `<p class="text-xs text-slate-400">لا يوجد تقييم مسجل لهذا الطالب بعد.</p>`
        }
    }

    view.classList.remove("hidden")
}


/* =========================================================
   UI Helpers
========================================================= */
function showLoading(show) {
    const el = $("reports-loading")
    if (el) {
        if (show) el.classList.remove("hidden"), el.classList.add("flex")
        else el.classList.add("hidden"), el.classList.remove("flex")
    }
}

function showEmptyState(show) {
    const el = $("reports-empty")
    if (el) {
        if (show) el.classList.remove("hidden"), el.classList.add("flex")
        else el.classList.add("hidden"), el.classList.remove("flex")
    }
}

function hideViews() {
    $("halaqa-report-view")?.classList.add("hidden")
    $("student-report-view")?.classList.add("hidden")
    $("print-report-btn")?.classList.add("hidden")
    $("print-report-btn")?.classList.remove("flex")
}

function showError(msg) {
    const el = $("reports-error")
    if (el) {
        el.textContent = msg
        el.classList.remove("hidden")
    }
}

function hideError() {
    const el = $("reports-error")
    if (el) el.classList.add("hidden")
}

function formatDate(dateValue) {
    if (!dateValue) return "—"
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return "—"

    return new Intl.DateTimeFormat("ar-DZ", {
        year: "numeric",
        month: "short",
        day: "numeric"
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


/* =========================================================
   Start
========================================================= */
initPage()
