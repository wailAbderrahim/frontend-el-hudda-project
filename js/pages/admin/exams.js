import {
    getExams,
    getExamById,
    createExam,
    updateExam,
    deleteExam,
    getExamAttempts,
    getAllExamAttempts,
    gradeAttempt,
    publishExamResults
} from "../../api/examsApi.js"

import { getUsers } from "../../api/usersApi.js"
import { getHalaqas } from "../../api/halaqaApi.js"
import { getLevels } from "../../api/levelsApi.js"
import { getUser, protectPage, logout } from "../../auth/auth.js"
import { initNotificationBell } from "../../components/notificationBell.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")

/* =========================================================
   State
========================================================= */
let allExams = []
let filteredExams = []
let selectedExamForAttempts = null
let selectedExamAttempts = []
let editingExamId = null
let examBuilderQuestions = []

let allAdminAttempts = []
let filteredAdminAttempts = []

let allUsers = []
let allStudents = []
let allTeachers = []
let allHalaqas = []
let allLevels = []

let genericDeleteAction = null

/* =========================================================
   DOM Helpers
========================================================= */
const $ = (id) => document.getElementById(id)
const setText = (id, text) => {
    const el = $(id)
    if (el) el.textContent = text
}

/* =========================================================
   Initialize
========================================================= */
async function initPage() {
    setupProfile()
    setupSidebarToggle()
    setupLogout()
    initNotificationBell()

    setupExamsEvents()
    setupAttemptsEvents()

    try {
        await loadInitialDependencies()
        await Promise.all([
            loadAdminExams(),
            loadAdminAttempts()
        ])
    } catch (err) {
        console.error("Initialization error:", err)
        showError("تعذر تحميل بيانات الامتحانات بشكل كامل. يرجى إعادة المحاولة.")
    }
}

/* =========================================================
   Profile & Navigation
========================================================= */
function setupProfile() {
    const user = getUser()
    if (!user) return

    const name = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "الإدارة"
    setText("admin-name", name)
    setText("admin-avatar", name.charAt(0) || "أ")
}

function setupSidebarToggle() {
    const menuBtn = $("menu-btn")
    const sidebar = $("sidebar")
    const overlay = $("sidebar-overlay")

    if (!menuBtn || !sidebar || !overlay) return

    const openSidebar = () => {
        sidebar.classList.remove("translate-x-full")
        overlay.classList.remove("hidden")
    }

    const closeSidebar = () => {
        sidebar.classList.add("translate-x-full")
        overlay.classList.add("hidden")
    }

    menuBtn.addEventListener("click", openSidebar)
    overlay.addEventListener("click", closeSidebar)
}

function setupLogout() {
    const btn = $("logout-btn")
    if (btn) {
        btn.addEventListener("click", () => {
            logout()
            window.location.href = "../auth/login.html"
        })
    }
}

/* =========================================================
   Dependencies
========================================================= */
async function loadInitialDependencies() {
    try {
        const [usersData, halaqasData, levelsData] = await Promise.all([
            getUsers().catch(() => []),
            getHalaqas().catch(() => []),
            getLevels().catch(() => [])
        ])

        allUsers = Array.isArray(usersData) ? usersData : []
        allStudents = allUsers.filter(u => u.role === "student")
        allTeachers = allUsers.filter(u => u.role === "teacher")
        allHalaqas = Array.isArray(halaqasData) ? halaqasData : []
        allLevels = Array.isArray(levelsData) ? levelsData : []

        populateAdminExamTeacherOptions()
        populateAdminExamTargetOptions()
    } catch (err) {
        console.warn("Dependencies load failed:", err)
    }
}

/* =========================================================
   1. EXAMS MODULE
========================================================= */
async function loadAdminExams() {
    const loading = $("admin-exams-loading")
    if (loading) {
        loading.classList.remove("hidden")
        loading.classList.add("flex")
    }

    try {
        const res = await getExams()
        allExams = Array.isArray(res) ? res : []
        filteredExams = [...allExams]

        renderAdminExamsStats()
        populateAdminAttemptsExamFilter()
        filterAdminExams()
    } catch (error) {
        console.error("Load exams error:", error)
        showError("تعذر تحميل الامتحانات.")
    } finally {
        if (loading) {
            loading.classList.add("hidden")
            loading.classList.remove("flex")
        }
    }
}

function renderAdminExamsStats() {
    const total = allExams.length
    const active = allExams.filter(e => e.status === "scheduled" || e.status === "ongoing" || e.status === "published").length
    const pendingGrading = allExams.filter(e => e.status === "completed" || e.status === "submitted").length
    const published = allExams.filter(e => e.status === "published" || e.resultsPublished).length

    setText("admin-exams-total", total)
    setText("admin-exams-active", active)
    setText("admin-exams-pending-grading", pendingGrading)
    setText("admin-exams-published", published)
}

function filterAdminExams() {
    const search = ($("admin-exams-search")?.value || "").trim().toLowerCase()
    const type = $("admin-exams-type-filter")?.value || ""
    const format = $("admin-exams-format-filter")?.value || ""
    const status = $("admin-exams-status-filter")?.value || ""

    filteredExams = allExams.filter(e => {
        const matchSearch = !search ||
            (e.title && e.title.toLowerCase().includes(search)) ||
            (getTeacherName(e.teacher).toLowerCase().includes(search))

        const matchType = !type || e.type === type
        const matchFormat = !format || e.format === format
        const matchStatus = !status || e.status === status

        return matchSearch && matchType && matchFormat && matchStatus
    })

    setText("admin-exams-filtered-count", filteredExams.length)
    renderAdminExams()
}

function renderAdminExams() {
    const tbody = $("admin-exams-table-body")
    const empty = $("admin-exams-empty")
    const container = $("admin-exams-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (filteredExams.length === 0) {
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        if (container) container.classList.add("hidden")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")
    if (container) container.classList.remove("hidden")

    filteredExams.forEach(exam => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50/80 transition"

        const examId = getId(exam)
        const formatLabel = exam.format === "in_person" ? "حضوري بالمدرسة" : "عن بُعد (إلكتروني)"
        const formatBadgeClass = exam.format === "in_person" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"

        const typeLabels = {
            quran: "قرآن كريم",
            matn: "متن علمي",
            level: "انتقال مستوى",
            periodic: "دوري / فصلي"
        }
        const typeLabel = typeLabels[exam.type] || "عام"

        let targetBadge = "جميع الطلاب"
        if (exam.targetType === "level") targetBadge = `مستوى: ${exam.targetLevel?.name || "محدد"}`
        else if (exam.targetType === "matn") targetBadge = `متن: ${exam.targetMatn?.name || "محدد"}`
        else if (exam.targetType === "halaqa") targetBadge = `حلقة: ${exam.targetHalaqa?.name || "محددة"}`

        const statusLabels = {
            draft: { label: "مسودة", cls: "bg-slate-100 text-slate-600" },
            scheduled: { label: "مجدول", cls: "bg-blue-50 text-blue-700" },
            ongoing: { label: "جارٍ حالياً", cls: "bg-emerald-50 text-emerald-700" },
            completed: { label: "منتهٍ", cls: "bg-amber-50 text-amber-700" },
            graded: { label: "تم التصحيح", cls: "bg-purple-50 text-purple-700" },
            published: { label: "أُعلنت النتائج", cls: "bg-emerald-100 text-emerald-800" }
        }
        const statusMeta = statusLabels[exam.status] || { label: exam.status || "—", cls: "bg-slate-100 text-slate-600" }

        const qCount = Array.isArray(exam.questions) ? exam.questions.length : 0

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(exam.title)}</div>
                <div class="text-xs text-slate-400 mt-0.5">${qCount} سؤال / محور • ${formatDate(exam.startDate)}</div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    ${escapeHTML(targetBadge)}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-semibold text-slate-700 mb-1">${escapeHTML(typeLabel)}</div>
                <span class="inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${formatBadgeClass}">
                    ${formatLabel}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-bold text-slate-700">${exam.totalScore || 20} درجة</div>
                <div class="text-[11px] text-slate-400">النجاح: ${exam.passingScore || 12} • ${exam.duration || 30} دقيقة</div>
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${escapeHTML(getTeacherName(exam.teacher))}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${statusMeta.cls}">
                    ${statusMeta.label}
                </span>
                ${exam.resultsPublished ? '<span class="block text-[10px] text-emerald-600 font-bold mt-1">النتائج معلنة للطلاب</span>' : ''}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        type="button"
                        data-action="view-attempts"
                        data-id="${examId}"
                        class="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition"
                        title="عرض محاولات وإجابات الطلاب">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        data-action="edit-exam"
                        data-id="${examId}"
                        class="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition"
                        title="تعديل بيانات الامتحان">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        data-action="publish-results"
                        data-id="${examId}"
                        class="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 transition"
                        title="إعلان ونشر النتائج">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        data-action="delete-exam"
                        data-id="${examId}"
                        class="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition"
                        title="حذف الامتحان">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `

        tbody.appendChild(tr)
    })

    // Attach row events
    tbody.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const action = btn.dataset.action
            const id = btn.dataset.id
            if (action === "view-attempts") {
                await openAdminAttemptsModal(id)
            } else if (action === "edit-exam") {
                openAdminExamModal(id)
            } else if (action === "publish-results") {
                await handleAdminPublishResults(id)
            } else if (action === "delete-exam") {
                const exam = allExams.find(ex => getId(ex) === id)
                openGenericDeleteModal({
                    title: "حذف الامتحان",
                    message: `هل أنت متأكد من حذف الامتحان "${exam?.title || ""}"؟ سيتم حذف جميع المحاولات المرتبطة به.`,
                    onConfirm: async () => {
                        await deleteExam(id)
                        await loadAdminExams()
                        await loadAdminAttempts()
                    }
                })
            }
        })
    })
}

function setupExamsEvents() {
    $("admin-exams-search")?.addEventListener("input", filterAdminExams)
    $("admin-exams-type-filter")?.addEventListener("change", filterAdminExams)
    $("admin-exams-format-filter")?.addEventListener("change", filterAdminExams)
    $("admin-exams-status-filter")?.addEventListener("change", filterAdminExams)

    $("btn-admin-add-exam")?.addEventListener("click", () => openAdminExamModal(null))
    $("btn-close-exam-modal")?.addEventListener("click", closeAdminExamModal)
    $("btn-cancel-exam-modal")?.addEventListener("click", closeAdminExamModal)

    $("btn-admin-add-question")?.addEventListener("click", addAdminExamQuestion)

    $("modal-exam-target-type")?.addEventListener("change", (e) => {
        updateAdminExamTargetSelect(e.target.value)
    })

    $("admin-exam-form")?.addEventListener("submit", handleSaveAdminExam)
}

function populateAdminExamTeacherOptions() {
    const select = $("modal-exam-teacher")
    if (!select) return
    select.innerHTML = '<option value="">إدارة المدرسة (عام)</option>'
    allTeachers.forEach(t => {
        const opt = document.createElement("option")
        opt.value = t._id
        opt.textContent = `${t.name || `${t.firstName || ""} ${t.lastName || ""}`.trim()} (معلم)`
        select.appendChild(opt)
    })
}

function populateAdminExamTargetOptions() {
    updateAdminExamTargetSelect($("modal-exam-target-type")?.value || "all")
}

function updateAdminExamTargetSelect(type, selectedVal = null) {
    const container = $("modal-exam-target-select-container")
    const label = $("modal-exam-target-label")
    const select = $("modal-exam-target-val")

    if (!container || !select) return

    if (type === "all") {
        container.classList.add("opacity-50", "pointer-events-none")
        if (label) label.textContent = "الفئة المستهدفة"
        select.innerHTML = '<option value="">جميع طلاب المدرسة</option>'
        return
    }

    container.classList.remove("opacity-50", "pointer-events-none")
    select.innerHTML = '<option value="">اختر من القائمة...</option>'

    if (type === "level") {
        if (label) label.textContent = "اختر المستوى التعليمي *"
        allLevels.forEach(lvl => {
            const opt = document.createElement("option")
            opt.value = lvl._id
            opt.textContent = lvl.name
            if (selectedVal && selectedVal === lvl._id) opt.selected = true
            select.appendChild(opt)
        })
    } else if (type === "halaqa") {
        if (label) label.textContent = "اختر الحلقة القرآنية *"
        allHalaqas.forEach(h => {
            const opt = document.createElement("option")
            opt.value = h._id
            opt.textContent = h.name
            if (selectedVal && selectedVal === h._id) opt.selected = true
            select.appendChild(opt)
        })
    } else {
        container.classList.add("opacity-50", "pointer-events-none")
        select.innerHTML = '<option value="">عام لجميع الطلاب</option>'
    }
}

function openAdminExamModal(examId = null) {
    editingExamId = examId
    const modal = $("modal-admin-create-exam")
    const form = $("admin-exam-form")
    const errBox = $("admin-exam-error")
    if (errBox) errBox.classList.add("hidden")

    if (form) form.reset()
    examBuilderQuestions = []

    if (examId) {
        setText("modal-exam-form-title", "تعديل الامتحان")
        const exam = allExams.find(e => getId(e) === examId)
        if (exam) {
            $("admin-exam-id").value = examId
            $("modal-exam-title").value = exam.title || ""
            $("modal-exam-type").value = exam.type || "quran"
            $("modal-exam-format").value = exam.format || "online"
            $("modal-exam-teacher").value = getId(exam.teacher) || ""
            $("modal-exam-target-type").value = exam.targetType || "all"
            updateAdminExamTargetSelect(exam.targetType || "all", getId(exam.targetLevel || exam.targetHalaqa))
            $("modal-exam-duration").value = exam.duration || 30
            $("modal-exam-total-score").value = exam.totalScore || 20
            $("modal-exam-passing-score").value = exam.passingScore || 12
            $("modal-exam-start-date").value = exam.startDate ? exam.startDate.substring(0, 10) : ""
            $("modal-exam-instructions").value = exam.instructions || ""
            $("modal-exam-publish-now").checked = exam.status === "scheduled" || exam.status === "ongoing" || exam.status === "published"

            if (Array.isArray(exam.questions) && exam.questions.length > 0) {
                examBuilderQuestions = exam.questions.map(q => ({
                    text: q.text || "",
                    type: q.type || "multiple_choice",
                    score: q.score || 2,
                    options: Array.isArray(q.options) ? [...q.options] : ["خيار 1", "خيار 2"],
                    correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : 0
                }))
            }
        }
    } else {
        setText("modal-exam-form-title", "إنشاء امتحان جديد")
        $("admin-exam-id").value = ""
        $("modal-exam-target-type").value = "all"
        updateAdminExamTargetSelect("all")
        $("modal-exam-duration").value = 30
        $("modal-exam-total-score").value = 20
        $("modal-exam-passing-score").value = 12
        $("modal-exam-publish-now").checked = true

        examBuilderQuestions = [
            {
                text: "ما هو حكم النون الساكنة والتنوين في قوله تعالى: (مِنْ بَعْدِ)؟",
                type: "multiple_choice",
                score: 5,
                options: ["إظهار حلقي", "إقلاب", "إدغام بغنة", "إخفاء حقيقي"],
                correctAnswer: 1
            }
        ]
    }

    renderAdminExamQuestions()

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeAdminExamModal() {
    const modal = $("modal-admin-create-exam")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    editingExamId = null
    examBuilderQuestions = []
}

function addAdminExamQuestion() {
    examBuilderQuestions.push({
        text: "",
        type: "multiple_choice",
        score: 2,
        options: ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
        correctAnswer: 0
    })
    renderAdminExamQuestions()
}

function renderAdminExamQuestions() {
    const container = $("admin-exam-questions-list")
    if (!container) return
    container.innerHTML = ""

    if (examBuilderQuestions.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">لم تتم إضافة أي أسئلة بعد. انقر على "+ إضافة سؤال" للبدء.</p>'
        return
    }

    examBuilderQuestions.forEach((q, idx) => {
        const item = document.createElement("div")
        item.className = "rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 relative text-xs"

        const qTypeOptions = `
            <option value="multiple_choice" ${q.type === "multiple_choice" ? "selected" : ""}>اختيار من متعدد</option>
            <option value="true_false" ${q.type === "true_false" ? "selected" : ""}>صح أو خطأ</option>
            <option value="essay" ${q.type === "essay" ? "selected" : ""}>سؤال مقالي / تسميع شفهي</option>
        `

        let specificInputs = ""
        if (q.type === "multiple_choice") {
            const optsHtml = (q.options || []).map((opt, optIdx) => `
                <div class="flex items-center gap-1.5">
                    <input type="radio" name="correct_opt_${idx}" value="${optIdx}" ${Number(q.correctAnswer) === optIdx ? "checked" : ""} class="text-emerald-600 focus:ring-emerald-500">
                    <input type="text" data-q-opt="${idx}" data-opt-idx="${optIdx}" value="${escapeHTML(opt)}" class="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-600 focus:outline-none" placeholder="الخيار ${optIdx + 1}">
                    <button type="button" data-remove-opt="${idx}" data-opt-idx="${optIdx}" class="text-red-400 hover:text-red-600">×</button>
                </div>
            `).join("")

            specificInputs = `
                <div class="space-y-1.5 pt-1">
                    <label class="block font-semibold text-slate-600">خيارات الإجابة (حدد الإجابة الصحيحة بالدائرة):</label>
                    <div class="space-y-1">${optsHtml}</div>
                    <button type="button" data-add-opt="${idx}" class="text-[11px] font-semibold text-emerald-700 hover:underline mt-1">+ إضافة خيار إضافي</button>
                </div>
            `
        } else if (q.type === "true_false") {
            specificInputs = `
                <div class="flex items-center gap-4 pt-1">
                    <span class="font-semibold text-slate-600">الإجابة الصحيحة:</span>
                    <label class="inline-flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="tf_correct_${idx}" value="true" ${String(q.correctAnswer) === "true" || q.correctAnswer === 0 ? "checked" : ""} class="text-emerald-600">
                        <span>صحيح</span>
                    </label>
                    <label class="inline-flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="tf_correct_${idx}" value="false" ${String(q.correctAnswer) === "false" || q.correctAnswer === 1 ? "checked" : ""} class="text-emerald-600">
                        <span>خطأ</span>
                    </label>
                </div>
            `
        } else {
            specificInputs = `
                <div class="pt-1 text-slate-400 text-[11px]">
                    سؤال شفهي أو تحريري يتم تصحيحه يدوياً من طرف الأستاذ أو الإدارة.
                </div>
            `
        }

        item.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span class="font-bold text-slate-700">السؤال رقم ${idx + 1}</span>
                <button type="button" data-remove-q="${idx}" class="text-red-500 hover:text-red-700 font-bold text-sm" title="حذف السؤال">×</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div class="sm:col-span-3">
                    <input type="text" data-q-text="${idx}" value="${escapeHTML(q.text)}" placeholder="نص السؤال المطروح..." class="w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:border-emerald-600 focus:outline-none" required>
                </div>
                <div>
                    <input type="number" min="0.5" step="0.5" data-q-score="${idx}" value="${q.score || 2}" placeholder="الدرجة" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 focus:border-emerald-600 focus:outline-none" title="درجة السؤال" required>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-slate-500">نوع السؤال:</span>
                <select data-q-type="${idx}" class="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-600 focus:outline-none">
                    ${qTypeOptions}
                </select>
            </div>
            ${specificInputs}
        `

        container.appendChild(item)
    })

    // Bind question events
    container.querySelectorAll("[data-remove-q]").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.removeQ)
            examBuilderQuestions.splice(idx, 1)
            renderAdminExamQuestions()
        })
    })

    container.querySelectorAll("[data-q-text]").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = Number(input.dataset.qText)
            if (examBuilderQuestions[idx]) examBuilderQuestions[idx].text = e.target.value
        })
    })

    container.querySelectorAll("[data-q-score]").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = Number(input.dataset.qScore)
            if (examBuilderQuestions[idx]) examBuilderQuestions[idx].score = Number(e.target.value) || 1
        })
    })

    container.querySelectorAll("[data-q-type]").forEach(select => {
        select.addEventListener("change", (e) => {
            const idx = Number(select.dataset.qType)
            if (examBuilderQuestions[idx]) {
                examBuilderQuestions[idx].type = e.target.value
                if (e.target.value === "multiple_choice") {
                    examBuilderQuestions[idx].options = ["خيار 1", "خيار 2", "خيار 3"]
                    examBuilderQuestions[idx].correctAnswer = 0
                } else if (e.target.value === "true_false") {
                    examBuilderQuestions[idx].options = ["صحيح", "خطأ"]
                    examBuilderQuestions[idx].correctAnswer = "true"
                } else {
                    examBuilderQuestions[idx].options = []
                    examBuilderQuestions[idx].correctAnswer = ""
                }
                renderAdminExamQuestions()
            }
        })
    })

    container.querySelectorAll("[data-q-opt]").forEach(input => {
        input.addEventListener("input", (e) => {
            const qIdx = Number(input.dataset.qOpt)
            const optIdx = Number(input.dataset.optIdx)
            if (examBuilderQuestions[qIdx] && examBuilderQuestions[qIdx].options) {
                examBuilderQuestions[qIdx].options[optIdx] = e.target.value
            }
        })
    })

    container.querySelectorAll("[data-add-opt]").forEach(btn => {
        btn.addEventListener("click", () => {
            const qIdx = Number(btn.dataset.addOpt)
            if (examBuilderQuestions[qIdx]) {
                if (!examBuilderQuestions[qIdx].options) examBuilderQuestions[qIdx].options = []
                examBuilderQuestions[qIdx].options.push(`خيار ${examBuilderQuestions[qIdx].options.length + 1}`)
                renderAdminExamQuestions()
            }
        })
    })

    container.querySelectorAll("[data-remove-opt]").forEach(btn => {
        btn.addEventListener("click", () => {
            const qIdx = Number(btn.dataset.removeOpt)
            const optIdx = Number(btn.dataset.optIdx)
            if (examBuilderQuestions[qIdx] && examBuilderQuestions[qIdx].options && examBuilderQuestions[qIdx].options.length > 2) {
                examBuilderQuestions[qIdx].options.splice(optIdx, 1)
                if (examBuilderQuestions[qIdx].correctAnswer >= examBuilderQuestions[qIdx].options.length) {
                    examBuilderQuestions[qIdx].correctAnswer = 0
                }
                renderAdminExamQuestions()
            }
        })
    })

    container.querySelectorAll("input[type=radio]").forEach(radio => {
        radio.addEventListener("change", (e) => {
            if (radio.name.startsWith("correct_opt_")) {
                const qIdx = Number(radio.name.replace("correct_opt_", ""))
                if (examBuilderQuestions[qIdx]) {
                    examBuilderQuestions[qIdx].correctAnswer = Number(e.target.value)
                }
            } else if (radio.name.startsWith("tf_correct_")) {
                const qIdx = Number(radio.name.replace("tf_correct_", ""))
                if (examBuilderQuestions[qIdx]) {
                    examBuilderQuestions[qIdx].correctAnswer = e.target.value
                }
            }
        })
    })
}

async function handleSaveAdminExam(e) {
    e.preventDefault()
    const submitBtn = $("btn-submit-exam")
    const errBox = $("admin-exam-error")
    if (errBox) errBox.classList.add("hidden")

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."

    try {
        const title = $("modal-exam-title")?.value.trim()
        const type = $("modal-exam-type")?.value
        const format = $("modal-exam-format")?.value
        const teacher = $("modal-exam-teacher")?.value || null
        const targetType = $("modal-exam-target-type")?.value || "all"
        const targetVal = $("modal-exam-target-val")?.value || null
        const duration = Number($("modal-exam-duration")?.value) || 30
        const totalScore = Number($("modal-exam-total-score")?.value) || 20
        const passingScore = Number($("modal-exam-passing-score")?.value) || 12
        const startDate = $("modal-exam-start-date")?.value || null
        const instructions = $("modal-exam-instructions")?.value.trim() || ""
        const publishNow = $("modal-exam-publish-now")?.checked

        if (!title) throw new Error("يرجى إدخال عنوان الامتحان.")

        const payload = {
            title,
            type,
            format,
            teacher,
            targetType,
            duration,
            totalScore,
            passingScore,
            startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
            instructions,
            status: publishNow ? "scheduled" : "draft",
            questions: examBuilderQuestions
        }

        if (targetType === "level") payload.targetLevel = targetVal
        else if (targetType === "halaqa") payload.targetHalaqa = targetVal

        if (editingExamId) {
            await updateExam(editingExamId, payload)
        } else {
            await createExam(payload)
        }

        closeAdminExamModal()
        await loadAdminExams()
        await loadAdminAttempts()
    } catch (error) {
        console.error("Save exam error:", error)
        showModalError(errBox, error.message || "تعذر حفظ الامتحان.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ الامتحان"
    }
}

/* =========================================================
   2. ATTEMPTS & GRADING MODULE
========================================================= */
async function loadAdminAttempts() {
    const loading = $("admin-all-attempts-loading")
    if (loading) {
        loading.classList.remove("hidden")
        loading.classList.add("flex")
    }

    try {
        const data = await getAllExamAttempts()
        allAdminAttempts = Array.isArray(data) ? data : []
        filteredAdminAttempts = [...allAdminAttempts]

        renderAdminAllAttemptsStats()
        filterAdminAttempts()
    } catch (err) {
        console.warn("Load all attempts failed:", err)
    } finally {
        if (loading) {
            loading.classList.add("hidden")
            loading.classList.remove("flex")
        }
    }
}

function renderAdminAllAttemptsStats() {
    const total = allAdminAttempts.length
    const pending = allAdminAttempts.filter(a => a.status === "submitted" || !a.isGraded).length
    const graded = allAdminAttempts.filter(a => a.status === "graded" || a.isGraded).length

    const passed = allAdminAttempts.filter(a => {
        const passing = a.exam?.passingScore || 10
        return (a.totalScore || 0) >= passing
    }).length
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

    setText("admin-all-attempts-total", total)
    setText("admin-all-attempts-pending", pending)
    setText("admin-all-attempts-graded", graded)
    setText("admin-all-attempts-pass-rate", `${passRate}%`)
}

function populateAdminAttemptsExamFilter() {
    const select = $("admin-attempts-filter-exam")
    if (!select) return
    const currentVal = select.value
    select.innerHTML = '<option value="">جميع الامتحانات</option>'

    allExams.forEach(e => {
        const opt = document.createElement("option")
        opt.value = getId(e)
        opt.textContent = e.title
        if (currentVal && currentVal === getId(e)) opt.selected = true
        select.appendChild(opt)
    })

    updatePublishSelectedExamBtnState()
}

function updatePublishSelectedExamBtnState() {
    const selectedExamId = $("admin-attempts-filter-exam")?.value
    const btn = $("btn-admin-publish-selected-exam")
    if (!btn) return

    if (!selectedExamId) {
        btn.disabled = true
        btn.classList.add("opacity-50", "cursor-not-allowed")
    } else {
        const exam = allExams.find(e => getId(e) === selectedExamId)
        btn.disabled = false
        btn.classList.remove("opacity-50", "cursor-not-allowed")
        if (exam && exam.resultsPublished) {
            btn.innerHTML = `
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>النتائج منشورة بالفعل</span>
            `
        } else {
            btn.innerHTML = `
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
                </svg>
                <span>إعلان نتائج الامتحان المختار</span>
            `
        }
    }
}

function filterAdminAttempts() {
    const search = ($("admin-attempts-search")?.value || "").trim().toLowerCase()
    const examFilter = $("admin-attempts-filter-exam")?.value || ""
    const statusFilter = $("admin-attempts-filter-status")?.value || ""

    filteredAdminAttempts = allAdminAttempts.filter(a => {
        const studentName = getStudentName(a.student).toLowerCase()
        const examTitle = (a.exam?.title || "").toLowerCase()

        const matchSearch = !search || studentName.includes(search) || examTitle.includes(search)
        const matchExam = !examFilter || getId(a.exam) === examFilter
        const matchStatus = !statusFilter || a.status === statusFilter || (statusFilter === "graded" && a.isGraded)

        return matchSearch && matchExam && matchStatus
    })

    setText("admin-all-attempts-filtered-count", filteredAdminAttempts.length)
    renderAdminAllAttemptsTable()
}

function renderAdminAllAttemptsTable() {
    const tbody = $("admin-all-attempts-table-body")
    const empty = $("admin-all-attempts-empty")
    const container = $("admin-all-attempts-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (filteredAdminAttempts.length === 0) {
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        if (container) container.classList.add("hidden")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")
    if (container) container.classList.remove("hidden")

    filteredAdminAttempts.forEach(att => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50/80 transition"

        const attId = getId(att)
        const examTitle = att.exam?.title || "امتحان"
        const maxScore = att.exam?.totalScore || 20
        const passScore = att.exam?.passingScore || 12
        const score = att.totalScore !== undefined ? att.totalScore : "—"
        const isPassed = typeof score === "number" ? score >= passScore : false

        const isGraded = att.isGraded || att.status === "graded"
        const statusBadge = isGraded
            ? '<span class="inline-block rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">تم التصحيح والاعتماد</span>'
            : '<span class="inline-block rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">بانتظار التصحيح</span>'

        const scoreBadge = typeof score === "number"
            ? `<span class="font-bold ${isPassed ? "text-emerald-700" : "text-red-600"}">${score} / ${maxScore}</span>`
            : '<span class="text-slate-400">لم ترصد</span>'

        const formatLabel = att.exam?.format === "in_person" ? "حضوري" : "عن بُعد"

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(getStudentName(att.student))}</div>
                <div class="text-xs text-slate-400">${escapeHTML(getHalaqaName(att.student?.halaqa))}</div>
            </td>
            <td class="px-6 py-4">
                <div class="font-semibold text-slate-700 text-xs">${escapeHTML(examTitle)}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">${formatLabel}</div>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500">
                ${formatDateTime(att.submittedAt || att.createdAt)}
            </td>
            <td class="px-6 py-4">
                ${statusBadge}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs">${scoreBadge}</div>
                ${att.percentage !== undefined ? `<div class="text-[11px] text-slate-400">${att.percentage}%</div>` : ''}
            </td>
            <td class="px-6 py-4 text-center">
                <button
                    type="button"
                    data-action="grade-single"
                    data-id="${attId}"
                    class="inline-flex items-center gap-1 rounded-xl ${isGraded ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-emerald-700 text-white hover:bg-emerald-800"} px-3 py-1.5 text-xs font-semibold transition">
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>${isGraded ? "مراجعة / تعديل" : "تصحيح الإجابة"}</span>
                </button>
            </td>
        `

        tbody.appendChild(tr)
    })

    // Bind grade buttons
    tbody.querySelectorAll("button[data-action=grade-single]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id
            openGradeModal(id)
        })
    })
}

function setupAttemptsEvents() {
    $("admin-attempts-search")?.addEventListener("input", filterAdminAttempts)
    $("admin-attempts-filter-status")?.addEventListener("change", filterAdminAttempts)

    $("admin-attempts-filter-exam")?.addEventListener("change", () => {
        updatePublishSelectedExamBtnState()
        filterAdminAttempts()
    })

    $("btn-admin-publish-selected-exam")?.addEventListener("click", async () => {
        const examId = $("admin-attempts-filter-exam")?.value
        if (!examId) return
        await handleAdminPublishResults(examId)
    })

    $("btn-close-attempts-modal")?.addEventListener("click", closeAdminAttemptsModal)
    $("btn-close-attempts-modal-footer")?.addEventListener("click", closeAdminAttemptsModal)

    $("btn-close-grade-modal")?.addEventListener("click", () => {
        $("modal-admin-grade-attempt")?.classList.add("hidden")
        $("modal-admin-grade-attempt")?.classList.remove("flex")
    })
    $("btn-cancel-grade-modal")?.addEventListener("click", () => {
        $("modal-admin-grade-attempt")?.classList.add("hidden")
        $("modal-admin-grade-attempt")?.classList.remove("flex")
    })

    $("admin-grade-attempt-form")?.addEventListener("submit", handleSaveGradeAttempt)
}

async function openAdminAttemptsModal(examId) {
    const modal = $("modal-admin-exam-attempts")
    selectedExamForAttempts = allExams.find(e => getId(e) === examId) || null
    if (!selectedExamForAttempts) return

    setText("attempts-modal-title", `محاولات ونتائج: ${selectedExamForAttempts.title}`)
    setText("attempts-modal-subtitle", `الدرجة الكلية: ${selectedExamForAttempts.totalScore} • النجاح: ${selectedExamForAttempts.passingScore}`)

    const publishBtn = $("btn-admin-publish-modal-results")
    if (publishBtn) {
        publishBtn.classList.remove("hidden")
        publishBtn.onclick = () => handleAdminPublishResults(examId)
        if (selectedExamForAttempts.resultsPublished) {
            publishBtn.textContent = "النتائج معلنة بالفعل (إعادة نشر)"
        } else {
            publishBtn.textContent = "إعلان ونشر النتائج للطلاب الآن"
        }
    }

    try {
        const res = await getExamAttempts(examId)
        selectedExamAttempts = Array.isArray(res) ? res : []
        renderAdminAttemptsList()
    } catch (err) {
        console.error("Load exam attempts error:", err)
        selectedExamAttempts = []
        renderAdminAttemptsList()
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeAdminAttemptsModal() {
    const modal = $("modal-admin-exam-attempts")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    selectedExamForAttempts = null
    selectedExamAttempts = []
}

function renderAdminAttemptsList() {
    const tbody = $("admin-attempts-table-body")
    const empty = $("admin-attempts-empty")
    const statsContainer = $("attempts-modal-stats")

    if (!tbody) return
    tbody.innerHTML = ""

    const total = selectedExamAttempts.length
    const graded = selectedExamAttempts.filter(a => a.isGraded || a.status === "graded").length
    const passed = selectedExamAttempts.filter(a => {
        const passing = selectedExamForAttempts?.passingScore || 10
        return (a.totalScore || 0) >= passing
    }).length
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="rounded-xl bg-slate-50 p-2.5 text-center">
                <span class="text-[11px] text-slate-400">إجمالي المحاولات</span>
                <p class="font-bold text-slate-700 text-sm">${total}</p>
            </div>
            <div class="rounded-xl bg-emerald-50 p-2.5 text-center">
                <span class="text-[11px] text-emerald-600">المكتمل والمصحح</span>
                <p class="font-bold text-emerald-800 text-sm">${graded}</p>
            </div>
            <div class="rounded-xl bg-blue-50 p-2.5 text-center">
                <span class="text-[11px] text-blue-600">الناجحون</span>
                <p class="font-bold text-blue-800 text-sm">${passed}</p>
            </div>
            <div class="rounded-xl bg-purple-50 p-2.5 text-center">
                <span class="text-[11px] text-purple-600">نسبة النجاح</span>
                <p class="font-bold text-purple-800 text-sm">${passRate}%</p>
            </div>
        `
    }

    if (selectedExamAttempts.length === 0) {
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")

    selectedExamAttempts.forEach(att => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50 transition"

        const attId = getId(att)
        const isGraded = att.isGraded || att.status === "graded"
        const score = att.totalScore !== undefined ? att.totalScore : "—"
        const maxScore = selectedExamForAttempts?.totalScore || 20
        const isPassed = typeof score === "number" && score >= (selectedExamForAttempts?.passingScore || 10)

        tr.innerHTML = `
            <td class="px-4 py-3 font-semibold text-slate-800">
                ${escapeHTML(getStudentName(att.student))}
            </td>
            <td class="px-4 py-3 text-slate-500">
                ${formatDateTime(att.submittedAt || att.createdAt)}
            </td>
            <td class="px-4 py-3">
                <span class="rounded px-2 py-0.5 font-semibold ${isGraded ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}">
                    ${isGraded ? "مصحح" : "بانتظار التصحيح"}
                </span>
            </td>
            <td class="px-4 py-3 font-bold ${isPassed ? "text-emerald-700" : "text-slate-700"}">
                ${score} / ${maxScore}
            </td>
            <td class="px-4 py-3 text-slate-600">
                ${att.percentage !== undefined ? `${att.percentage}%` : '—'}
            </td>
            <td class="px-4 py-3 text-center">
                <button
                    type="button"
                    data-grade-attempt-id="${attId}"
                    class="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 transition">
                    ${isGraded ? "مراجعة وتعديل" : "تصحيح"}
                </button>
            </td>
        `
        tbody.appendChild(tr)
    })

    tbody.querySelectorAll("[data-grade-attempt-id]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.gradeAttemptId
            openGradeModal(id)
        })
    })
}

function openGradeModal(attemptId) {
    const modal = $("modal-admin-grade-attempt")
    const form = $("admin-grade-attempt-form")
    const errBox = $("admin-grade-error")
    if (errBox) errBox.classList.add("hidden")

    if (form) form.reset()

    let attempt = allAdminAttempts.find(a => getId(a) === attemptId)
    if (!attempt) {
        attempt = selectedExamAttempts.find(a => getId(a) === attemptId)
    }

    if (!attempt) return

    $("grade-attempt-id").value = attemptId
    setText("grade-student-display", `الطالب: ${getStudentName(attempt.student)} • الامتحان: ${attempt.exam?.title || "امتحان"}`)
    $("grade-feedback").value = attempt.feedback || ""

    const questionsContainer = $("grade-questions-container")
    if (!questionsContainer) return
    questionsContainer.innerHTML = ""

    const answers = Array.isArray(attempt.answers) ? attempt.answers : []
    const examQuestions = attempt.exam?.questions || []

    if (answers.length === 0 && examQuestions.length === 0) {
        questionsContainer.innerHTML = `
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p class="text-xs text-slate-500 mb-2">لا توجد تفاصيل إجابات إلكترونية مسجلة (امتحان حضوري أو تسميع).</p>
                <div class="flex items-center justify-center gap-2">
                    <label class="text-xs font-bold text-slate-700">الدرجة الممنوحة:</label>
                    <input type="number" id="grade-direct-score" min="0" max="${attempt.exam?.totalScore || 20}" step="0.5" value="${attempt.totalScore || 0}" class="w-24 rounded-lg border border-slate-200 p-1.5 text-center font-bold text-emerald-700 text-sm focus:border-emerald-600 focus:outline-none" required>
                    <span class="text-xs text-slate-400">/ ${attempt.exam?.totalScore || 20}</span>
                </div>
            </div>
        `
    } else {
        const itemsToRender = examQuestions.length > 0 ? examQuestions : answers
        itemsToRender.forEach((q, idx) => {
            const studentAns = answers.find(a => (a.questionId && a.questionId === q._id) || a.questionIndex === idx) || answers[idx]
            const studentVal = studentAns ? (studentAns.answer !== undefined ? studentAns.answer : studentAns.selectedOption) : "—"
            const awardedScore = studentAns?.score !== undefined ? studentAns.score : (q.score || 2)

            const qBox = document.createElement("div")
            qBox.className = "rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs"

            let studentDisplay = escapeHTML(String(studentVal))
            if (q.type === "multiple_choice" && Array.isArray(q.options) && typeof studentVal === "number") {
                studentDisplay = escapeHTML(q.options[studentVal] || studentVal)
            } else if (q.type === "true_false") {
                studentDisplay = studentVal === true || studentVal === "true" ? "صحيح" : "خطأ"
            }

            qBox.innerHTML = `
                <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span class="font-bold text-slate-700">س ${idx + 1}: ${escapeHTML(q.text || `سؤال ${idx + 1}`)}</span>
                    <span class="text-slate-400">الدرجة القصوى: ${q.score || 2}</span>
                </div>
                <div class="bg-white rounded-lg p-2 border border-slate-100">
                    <span class="text-slate-400 block text-[11px] mb-0.5">إجابة الطالب:</span>
                    <p class="font-semibold text-slate-800">${studentDisplay}</p>
                </div>
                <div class="flex items-center justify-between pt-1">
                    <label class="font-semibold text-slate-600">درجة هذا السؤال:</label>
                    <div class="flex items-center gap-1">
                        <input type="number" min="0" max="${q.score || 10}" step="0.5" data-question-score-idx="${idx}" data-question-id="${q._id || ''}" value="${awardedScore}" class="w-20 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-emerald-700 focus:border-emerald-600 focus:outline-none" required>
                        <span class="text-slate-400">/ ${q.score || 2}</span>
                    </div>
                </div>
            `
            questionsContainer.appendChild(qBox)
        })
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

async function handleSaveGradeAttempt(e) {
    e.preventDefault()
    const submitBtn = $("btn-save-grade")
    const errBox = $("admin-grade-error")
    if (errBox) errBox.classList.add("hidden")

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الاعتماد..."

    const attemptId = $("grade-attempt-id")?.value
    const feedback = $("grade-feedback")?.value.trim()

    try {
        const directScoreInput = $("grade-direct-score")
        let totalScore = 0
        let questionScores = []

        if (directScoreInput) {
            totalScore = Number(directScoreInput.value) || 0
        } else {
            const scoreInputs = document.querySelectorAll("[data-question-score-idx]")
            scoreInputs.forEach(input => {
                const s = Number(input.value) || 0
                totalScore += s
                questionScores.push({
                    questionIndex: Number(input.dataset.questionScoreIdx),
                    questionId: input.dataset.questionId || null,
                    score: s
                })
            })
        }

        await gradeAttempt(attemptId, {
            totalScore,
            questionScores,
            feedback,
            isGraded: true,
            status: "graded"
        })

        $("modal-admin-grade-attempt")?.classList.add("hidden")
        $("modal-admin-grade-attempt")?.classList.remove("flex")

        await Promise.all([
            loadAdminAttempts(),
            loadAdminExams()
        ])

        if (selectedExamForAttempts) {
            await openAdminAttemptsModal(getId(selectedExamForAttempts))
        }
    } catch (err) {
        console.error("Save grade error:", err)
        showModalError(errBox, err.message || "تعذر اعتماد الدرجة والتصحيح.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "اعتماد الدرجة والتصحيح"
    }
}

async function handleAdminPublishResults(examId) {
    if (!confirm("هل أنت متأكد من رغبتك في إعلان ونشر نتائج هذا الامتحان لجميع الطلاب المسجلين؟")) return

    try {
        await publishExamResults(examId)
        alert("تم إعلان النتائج ونشرها للطلاب بنجاح!")
        await loadAdminExams()
        await loadAdminAttempts()
        updatePublishSelectedExamBtnState()
    } catch (err) {
        console.error("Publish results error:", err)
        alert(err.message || "تعذر نشر النتائج.")
    }
}

/* =========================================================
   GENERIC DELETE MODAL
========================================================= */
function openGenericDeleteModal({ title, message, onConfirm }) {
    const modal = $("modal-admin-generic-delete")
    const errBox = $("generic-delete-error")
    if (errBox) errBox.classList.add("hidden")

    setText("generic-delete-title", title || "تأكيد الحذف")
    setText("generic-delete-message", message || "هل أنت متأكد من رغبتك في الحذف؟")

    genericDeleteAction = onConfirm

    const cancelBtn = $("generic-delete-cancel-btn")
    const confirmBtn = $("generic-delete-confirm-btn")

    if (cancelBtn) {
        cancelBtn.onclick = closeGenericDeleteModal
    }

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            if (!genericDeleteAction) return
            confirmBtn.disabled = true
            confirmBtn.textContent = "جاري الحذف..."
            try {
                await genericDeleteAction()
                closeGenericDeleteModal()
            } catch (err) {
                console.error("Delete action error:", err)
                showModalError(errBox, err.message || "تعذر إتمام الحذف.")
            } finally {
                confirmBtn.disabled = false
                confirmBtn.textContent = "تأكيد الحذف"
            }
        }
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeGenericDeleteModal() {
    const modal = $("modal-admin-generic-delete")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    genericDeleteAction = null
}

/* =========================================================
   Badges & Formatters
========================================================= */
function getId(item) {
    if (!item) return ""
    return typeof item === "object" ? (item._id || "") : String(item)
}

function getStudentName(student) {
    if (!student) return "طالب غير معروف"
    if (typeof student === "object") {
        return student.name || `${student.firstName || ""} ${student.lastName || ""}`.trim() || "طالب غير معروف"
    }
    return "طالب غير معروف"
}

function getHalaqaName(halaqa) {
    if (!halaqa) return "حلقة غير معروفة"
    if (typeof halaqa === "object") return halaqa.name || "حلقة غير معروفة"
    return "حلقة غير معروفة"
}

function getTeacherName(teacher) {
    if (!teacher) return "إدارة المدرسة"
    if (typeof teacher === "string") {
        if (/^[0-9a-fA-F]{24}$/.test(teacher)) return "المعلم المشرف"
        return teacher
    }
    if (typeof teacher === "object") {
        return teacher.name || `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "المعلم المشرف"
    }
    return "إدارة المدرسة"
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

function showError(msg) {
    const el = $("exams-error")
    if (el) {
        el.textContent = msg
        el.classList.remove("hidden")
    }
}

function showModalError(el, msg) {
    if (el) {
        el.textContent = msg
        el.classList.remove("hidden")
    }
}

/* =========================================================
   Start
========================================================= */
initPage()

