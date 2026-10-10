import {
    getEvaluations,
    getEvaluationById,
    createEvaluation,
    updateEvaluation,
    deleteEvaluation
} from "../../api/evaluationsApi.js"

import { getHalaqas } from "../../api/halaqaApi.js"
import { getUser, protectPage } from "../../auth/auth.js"
import { initNotificationBell } from "../../components/notificationBell.js"

import {
    getLevels,
    getLevelById,
    createLevel,
    updateLevel,
    deleteLevel,
    getStudentLevelHistory
} from "../../api/levelsApi.js"

import {
    getMatns,
    getMatnById,
    createMatn,
    updateMatn,
    deleteMatn,
    getMatnProgress,
    createStudentMatnProgress,
    updateStudentMatnProgress,
    deleteStudentMatnProgress
} from "../../api/matnApi.js"

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

/* =========================================================
   Protection
========================================================= */
protectPage("admin")

/* =========================================================
   State
========================================================= */
// 1. Daily Evaluations State
let allEvaluations = []
let filteredEvaluations = []
let allHalaqas = []
let selectedEvaluation = null
let evaluationToDeleteId = null

// 2. Exams State
let allExams = []
let filteredExams = []
let selectedExamForAttempts = null
let selectedExamAttempts = []
let editingExamId = null
let examBuilderQuestions = []

// 3. Student Exam Attempts State (Dedicated section)
let allAdminAttempts = []
let filteredAdminAttempts = []

// 3. Matn State
let allMatns = []
let allMatnProgress = []
let filteredMatnProgress = []
let editingMatnId = null
let editingMatnProgressId = null

// Users & Teachers State
let allUsers = []
let allStudents = []
let allTeachers = []

// 4. Levels State
let allLevels = []
let allLevelPromotions = []
let filteredLevelPromotions = []
let editingLevelId = null

// Generic Delete State
let genericDeleteAction = null

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
    setupExamsEvents()
    setupAttemptsEvents()
    setupMatnEvents()
    setupLevelsEvents()
    initNotificationBell()
    setupQuickNavigation()

    await loadHalaqas()
    await loadUsers()

    // Concurrently load all unified admin sections
    await Promise.allSettled([
        loadEvaluations(),
        loadAdminExams(),
        loadAdminAttempts(),
        loadAdminMatns(),
        loadAdminLevels()
    ])

    handleInitialScroll()
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
   Quick Anchor Navigation & Scroll
========================================================= */
function setupQuickNavigation() {
    document.querySelectorAll("a[href^='#section-']").forEach(anchor => {
        anchor.addEventListener("click", (e) => {
            const targetId = anchor.getAttribute("href")?.replace("#", "")
            const targetEl = targetId ? $(targetId) : null
            if (targetEl) {
                e.preventDefault()
                targetEl.scrollIntoView({ behavior: "smooth", block: "start" })
                try {
                    window.history.replaceState({}, "", `#${targetId}`)
                } catch (_) {}
            }
        })
    })
}

function handleInitialScroll() {
    const urlParams = new URLSearchParams(window.location.search)
    const tabParam = urlParams.get("tab")
    const hash = window.location.hash.replace("#", "")

    let targetId = hash || (tabParam ? `section-${tabParam}` : null)
    if (targetId && $(targetId)) {
        setTimeout(() => {
            $(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 150)
    }
}

/* =========================================================
   1. DAILY EVALUATIONS
========================================================= */
async function loadEvaluations() {
    showLoading(true)
    hideError()

    try {
        const data = await getEvaluations()
        allEvaluations = Array.isArray(data) ? data : []
        filteredEvaluations = [...allEvaluations]

        renderStatistics()
        renderEvaluations()
    } catch (error) {
        console.error("Load evaluations error:", error)
        showError(error.message || "تعذر تحميل التقييمات. يرجى المحاولة مرة أخرى.")
    } finally {
        showLoading(false)
    }
}

async function loadHalaqas() {
    try {
        const data = await getHalaqas()
        allHalaqas = Array.isArray(data) ? data : []
        populateHalaqaFilters()
        populateCreateHalaqaOptions()
    } catch (error) {
        console.error("Load halaqas error:", error)
    }
}

async function loadUsers() {
    try {
        const data = await getUsers()
        allUsers = Array.isArray(data) ? data : (data?.data || [])

        const studentMap = new Map()
        allUsers.forEach(u => {
            if (u.role === "student") {
                studentMap.set(String(u._id), u)
            }
        })
        allHalaqas.forEach(h => {
            if (Array.isArray(h.students)) {
                h.students.forEach(st => {
                    if (st && st._id && !studentMap.has(String(st._id))) {
                        studentMap.set(String(st._id), st)
                    }
                })
            }
        })
        allStudents = Array.from(studentMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"))

        const teacherMap = new Map()
        allUsers.forEach(u => {
            if (u.role === "teacher") {
                teacherMap.set(String(u._id), u)
            }
        })
        allHalaqas.forEach(h => {
            if (h.teacher && h.teacher._id && !teacherMap.has(String(h.teacher._id))) {
                teacherMap.set(String(h.teacher._id), h.teacher)
            }
        })
        allTeachers = Array.from(teacherMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"))

        populateAdminExamTeacherOptions()
        populateAdminMatnProgressStudentOptions()
        populateAdminMatnProgressTeacherOptions()
    } catch (error) {
        console.error("Load users error:", error)
    }
}

function populateHalaqaFilters() {
    const filterSelect = $("evaluations-halaqa-filter")
    if (!filterSelect) return

    filterSelect.innerHTML = `<option value="">جميع الحلقات</option>`
    allHalaqas.forEach(h => {
        const opt = document.createElement("option")
        opt.value = h._id
        opt.textContent = h.name
        filterSelect.appendChild(opt)
    })
}

function populateCreateHalaqaOptions() {
    const createSelect = $("create-eval-halaqa")
    if (!createSelect) return

    createSelect.innerHTML = `<option value="">اختر الحلقة</option>`
    allHalaqas.forEach(h => {
        const opt = document.createElement("option")
        opt.value = h._id
        opt.textContent = h.name
        createSelect.appendChild(opt)
    })
}

function populateCreateStudentOptions(halaqaId) {
    const studentSelect = $("create-eval-student")
    if (!studentSelect) return

    studentSelect.innerHTML = `<option value="">اختر الطالب</option>`

    if (!halaqaId) {
        studentSelect.innerHTML = `<option value="">اختر الحلقة أولاً</option>`
        return
    }

    const halaqa = allHalaqas.find(h => h._id === halaqaId)
    if (!halaqa || !Array.isArray(halaqa.students) || halaqa.students.length === 0) {
        studentSelect.innerHTML = `<option value="">لا يوجد طلاب مسجلون في هذه الحلقة</option>`
        return
    }

    halaqa.students.forEach(student => {
        const id = getId(student)
        const name = getStudentName(student)
        if (id) {
            const opt = document.createElement("option")
            opt.value = id
            opt.textContent = name
            studentSelect.appendChild(opt)
        }
    })
}

function renderStatistics() {
    const total = allEvaluations.length
    const today = allEvaluations.filter(item => isToday(item.date)).length
    const totalScore = allEvaluations.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0)
    const avgScore = total > 0 ? (totalScore / total).toFixed(1) : "0"

    const evaluatedStudents = new Set()
    allEvaluations.forEach(item => {
        const sId = getId(item.student)
        if (sId) evaluatedStudents.add(sId)
    })

    setText("total-evaluations-count", total)
    setText("today-evaluations-count", today)
    setText("average-score", `${avgScore} / 10`)
    setText("students-evaluated-count", evaluatedStudents.size)
}

function filterEvaluations() {
    const searchQuery = ($("evaluations-search")?.value || "").trim().toLowerCase()
    const typeFilter = $("evaluations-type-filter")?.value || ""
    const halaqaFilter = $("evaluations-halaqa-filter")?.value || ""

    filteredEvaluations = allEvaluations.filter(item => {
        const sName = getStudentName(item.student).toLowerCase()
        const hName = getHalaqaName(item.halaqa).toLowerCase()
        const notes = (item.notes || "").toLowerCase()

        const matchesSearch = !searchQuery ||
            sName.includes(searchQuery) ||
            hName.includes(searchQuery) ||
            notes.includes(searchQuery)

        const matchesType = !typeFilter || item.type === typeFilter
        const itemHalaqaId = getId(item.halaqa)
        const matchesHalaqa = !halaqaFilter || itemHalaqaId === halaqaFilter

        return matchesSearch && matchesType && matchesHalaqa
    })

    renderEvaluations()
}

function renderEvaluations() {
    const tbody = $("evaluations-table-body")
    const emptyState = $("evaluations-empty")
    const tableContainer = $("evaluations-table-container")

    if (!tbody) return

    tbody.innerHTML = ""
    setText("filtered-evaluations-count", filteredEvaluations.length)

    if (filteredEvaluations.length === 0) {
        if (tableContainer) tableContainer.classList.add("hidden")
        if (emptyState) emptyState.classList.remove("hidden")
        return
    }

    if (tableContainer) tableContainer.classList.remove("hidden")
    if (emptyState) emptyState.classList.add("hidden")

    filteredEvaluations.forEach(evaluation => {
        const tr = document.createElement("tr")
        tr.className = "transition hover:bg-slate-50 border-b border-slate-100 last:border-0"

        const studentName = getStudentName(evaluation.student)
        const studentEmail = evaluation.student?.email || ""
        const halaqaName = getHalaqaName(evaluation.halaqa)
        const teacherName = getTeacherName(evaluation.teacher)
        const typeInfo = getTypeBadge(evaluation.type)
        const scoreInfo = getScoreBadge(evaluation.score)
        const dateStr = formatDate(evaluation.date)

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(studentName)}</div>
                ${studentEmail ? `<div class="text-xs text-slate-400">${escapeHTML(studentEmail)}</div>` : ""}
            </td>
            <td class="px-6 py-4 font-medium text-slate-700">
                ${escapeHTML(halaqaName)}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${typeInfo.bgClass}">
                    ${typeInfo.label}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <span class="text-base font-bold text-slate-800">${evaluation.score}</span>
                    <span class="text-xs text-slate-400">/ 10</span>
                    <span class="rounded px-1.5 py-0.5 text-xs font-semibold ${scoreInfo.badgeClass}">
                        ${scoreInfo.label}
                    </span>
                </div>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                ${dateStr}
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${escapeHTML(teacherName)}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        data-action="details"
                        data-id="${evaluation._id}"
                        title="عرض التفاصيل"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                    </button>
                    <button
                        data-action="edit"
                        data-id="${evaluation._id}"
                        title="تعديل"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button
                        data-action="delete"
                        data-id="${evaluation._id}"
                        title="حذف"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </td>
        `

        tbody.appendChild(tr)
    })
}

function setupEvents() {
    $("evaluations-search")?.addEventListener("input", filterEvaluations)
    $("evaluations-type-filter")?.addEventListener("change", filterEvaluations)
    $("evaluations-halaqa-filter")?.addEventListener("change", filterEvaluations)

    $("create-eval-halaqa")?.addEventListener("change", (e) => {
        populateCreateStudentOptions(e.target.value)
    })

    $("open-create-evaluation-btn")?.addEventListener("click", () => {
        openCreateModal()
    })

    $("close-create-modal")?.addEventListener("click", closeCreateModal)
    $("cancel-create-modal")?.addEventListener("click", closeCreateModal)
    $("create-evaluation-form")?.addEventListener("submit", handleCreateEvaluation)

    $("evaluations-table-body")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return

        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "details") openDetailsModal(id)
        if (action === "edit") openEditModal(id)
        if (action === "delete") openDeleteModal(id)
    })

    $("close-details-modal")?.addEventListener("click", closeDetailsModal)
    $("details-close-btn")?.addEventListener("click", closeDetailsModal)
    $("details-edit-btn")?.addEventListener("click", () => {
        if (selectedEvaluation) {
            const id = selectedEvaluation._id
            closeDetailsModal()
            openEditModal(id)
        }
    })

    $("close-edit-modal")?.addEventListener("click", closeEditModal)
    $("cancel-edit-modal")?.addEventListener("click", closeEditModal)
    $("edit-evaluation-form")?.addEventListener("submit", handleEditEvaluation)

    $("cancel-delete-modal")?.addEventListener("click", closeDeleteModal)
    $("confirm-delete-eval-btn")?.addEventListener("click", handleConfirmDelete)
}

function openCreateModal() {
    const modal = $("create-evaluation-modal")
    const form = $("create-evaluation-form")
    const errBox = $("create-evaluation-error")

    if (form) form.reset()
    if (errBox) errBox.classList.add("hidden")

    const dateInput = $("create-eval-date")
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0]

    populateCreateStudentOptions("")

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeCreateModal() {
    const modal = $("create-evaluation-modal")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
}

async function handleCreateEvaluation(e) {
    e.preventDefault()
    const errBox = $("create-evaluation-error")
    const submitBtn = $("submit-create-eval-btn")

    const student = $("create-eval-student")?.value
    const halaqa = $("create-eval-halaqa")?.value
    const type = $("create-eval-type")?.value
    const score = Number($("create-eval-score")?.value)
    const date = $("create-eval-date")?.value
    const notes = ($("create-eval-notes")?.value || "").trim()

    if (!student || !halaqa || !type || isNaN(score) || !date) {
        showModalError(errBox, "يرجى ملء جميع الحقول المطلوبة بشكل صحيح.")
        return
    }

    if (score < 0 || score > 10) {
        showModalError(errBox, "يجب أن تكون الدرجة بين 0 و 10.")
        return
    }

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."
    if (errBox) errBox.classList.add("hidden")

    try {
        await createEvaluation({ student, halaqa, type, score, date, notes })
        closeCreateModal()
        await loadEvaluations()
    } catch (error) {
        console.error("Create evaluation error:", error)
        showModalError(errBox, error.message || "تعذر إضافة التقييم.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ التقييم"
    }
}

async function openDetailsModal(id) {
    const modal = $("details-evaluation-modal")
    try {
        const evaluation = await getEvaluationById(id)
        selectedEvaluation = evaluation

        setText("details-eval-student", getStudentName(evaluation.student))
        setText("details-eval-halaqa", getHalaqaName(evaluation.halaqa))
        setText("details-eval-teacher", getTeacherName(evaluation.teacher))

        const typeInfo = getTypeBadge(evaluation.type)
        const typeEl = $("details-eval-type")
        if (typeEl) {
            typeEl.textContent = typeInfo.label
            typeEl.className = `inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${typeInfo.bgClass}`
        }

        const scoreInfo = getScoreBadge(evaluation.score)
        setText("details-eval-score", evaluation.score)
        const scoreBadge = $("details-eval-score-badge")
        if (scoreBadge) {
            scoreBadge.textContent = scoreInfo.label
            scoreBadge.className = `rounded px-2 py-0.5 text-xs font-semibold ${scoreInfo.badgeClass}`
        }

        setText("details-eval-date", formatDate(evaluation.date))
        setText("details-eval-created", formatDateTime(evaluation.createdAt))
        setText("details-eval-notes", evaluation.notes || "لا توجد ملاحظات")

        if (modal) {
            modal.classList.remove("hidden")
            modal.classList.add("flex")
        }
    } catch (error) {
        console.error("Get evaluation details error:", error)
        alert(error.message || "تعذر تحميل تفاصيل التقييم.")
    }
}

function closeDetailsModal() {
    const modal = $("details-evaluation-modal")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    selectedEvaluation = null
}

async function openEditModal(id) {
    const modal = $("edit-evaluation-modal")
    const errBox = $("edit-evaluation-error")
    if (errBox) errBox.classList.add("hidden")

    try {
        const evaluation = await getEvaluationById(id)
        selectedEvaluation = evaluation

        setText("edit-eval-student-name", getStudentName(evaluation.student))
        setText("edit-eval-halaqa-name", getHalaqaName(evaluation.halaqa))

        const typeSelect = $("edit-eval-type")
        if (typeSelect) typeSelect.value = evaluation.type || "memorization"

        const scoreInput = $("edit-eval-score")
        if (scoreInput) scoreInput.value = evaluation.score ?? ""

        const dateInput = $("edit-eval-date")
        if (dateInput && evaluation.date) {
            dateInput.value = new Date(evaluation.date).toISOString().split("T")[0]
        }

        const notesInput = $("edit-eval-notes")
        if (notesInput) notesInput.value = evaluation.notes || ""

        if (modal) {
            modal.classList.remove("hidden")
            modal.classList.add("flex")
        }
    } catch (error) {
        console.error("Open edit modal error:", error)
        alert(error.message || "تعذر تحميل بيانات التقييم للتعديل.")
    }
}

function closeEditModal() {
    const modal = $("edit-evaluation-modal")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
}

async function handleEditEvaluation(e) {
    e.preventDefault()
    if (!selectedEvaluation) return

    const errBox = $("edit-evaluation-error")
    const submitBtn = $("submit-edit-eval-btn")

    const type = $("edit-eval-type")?.value
    const score = Number($("edit-eval-score")?.value)
    const date = $("edit-eval-date")?.value
    const notes = ($("edit-eval-notes")?.value || "").trim()

    if (!type || isNaN(score) || !date) {
        showModalError(errBox, "يرجى ملء جميع الحقول المطلوبة بشكل صحيح.")
        return
    }

    if (score < 0 || score > 10) {
        showModalError(errBox, "يجب أن تكون الدرجة بين 0 و 10.")
        return
    }

    submitBtn.disabled = true
    submitBtn.textContent = "جاري التحديث..."
    if (errBox) errBox.classList.add("hidden")

    try {
        await updateEvaluation(selectedEvaluation._id, { type, score, date, notes })
        closeEditModal()
        await loadEvaluations()
    } catch (error) {
        console.error("Update evaluation error:", error)
        showModalError(errBox, error.message || "تعذر تحديث التقييم.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ التعديلات"
    }
}

function openDeleteModal(id) {
    const modal = $("delete-evaluation-modal")
    const errBox = $("delete-evaluation-error")
    if (errBox) errBox.classList.add("hidden")

    evaluationToDeleteId = id
    const evaluation = allEvaluations.find(item => item._id === id)
    const studentName = evaluation ? getStudentName(evaluation.student) : "الطالب"
    setText("delete-eval-student-name", studentName)

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeDeleteModal() {
    const modal = $("delete-evaluation-modal")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    evaluationToDeleteId = null
}

async function handleConfirmDelete() {
    if (!evaluationToDeleteId) return

    const errBox = $("delete-evaluation-error")
    const deleteBtn = $("confirm-delete-eval-btn")

    deleteBtn.disabled = true
    deleteBtn.textContent = "جاري الحذف..."
    if (errBox) errBox.classList.add("hidden")

    try {
        await deleteEvaluation(evaluationToDeleteId)
        closeDeleteModal()
        await loadEvaluations()
    } catch (error) {
        console.error("Delete evaluation error:", error)
        showModalError(errBox, error.message || "تعذر حذف التقييم.")
    } finally {
        deleteBtn.disabled = false
        deleteBtn.textContent = "حذف التقييم"
    }
}

/* =========================================================
   2. EXAMS & TESTS MANAGEMENT
========================================================= */
async function loadAdminExams() {
    const loading = $("admin-exams-loading")
    if (loading) {
        loading.classList.remove("hidden")
        loading.classList.add("flex")
    }

    try {
        const data = await getExams()
        allExams = Array.isArray(data) ? data : []
        filteredExams = [...allExams]
        renderAdminExamsStats()
        renderAdminExams()
        populateAdminAttemptsExamFilter()
    } catch (error) {
        console.error("Load admin exams error:", error)
        alert(error.message || "تعذر تحميل الامتحانات.")
    } finally {
        if (loading) {
            loading.classList.add("hidden")
            loading.classList.remove("flex")
        }
    }
}

function renderAdminExamsStats() {
    const total = allExams.length
    const active = allExams.filter(e => e.status === "ongoing" || e.status === "scheduled").length
    const pendingGrading = allExams.filter(e => e.status === "completed" || (e.attempts && e.attempts.some(a => a.status === "submitted"))).length
    const published = allExams.filter(e => e.isResultsPublished).length

    setText("admin-exams-total", total)
    setText("admin-exams-active", active)
    setText("admin-exams-pending-grading", pendingGrading)
    setText("admin-exams-published", published)
}

function filterAdminExams() {
    const search = ($("admin-exams-search")?.value || "").trim().toLowerCase()
    const typeFilter = $("admin-exams-type-filter")?.value || ""
    const formatFilter = $("admin-exams-format-filter")?.value || ""
    const statusFilter = $("admin-exams-status-filter")?.value || ""

    filteredExams = allExams.filter(exam => {
        const title = (exam.title || "").toLowerCase()
        const teacherName = getTeacherName(exam.teacher).toLowerCase()
        const matchesSearch = !search || title.includes(search) || teacherName.includes(search)
        const matchesType = !typeFilter || exam.type === typeFilter
        const matchesFormat = !formatFilter || exam.format === formatFilter
        const matchesStatus = !statusFilter || exam.status === statusFilter
        return matchesSearch && matchesType && matchesFormat && matchesStatus
    })

    renderAdminExams()
}

function renderAdminExams() {
    const tbody = $("admin-exams-table-body")
    const empty = $("admin-exams-empty")
    const container = $("admin-exams-table-container")

    if (!tbody) return
    tbody.innerHTML = ""
    setText("admin-exams-filtered-count", filteredExams.length)

    if (filteredExams.length === 0) {
        if (container) container.classList.add("hidden")
        if (empty) empty.classList.remove("hidden")
        return
    }

    if (container) container.classList.remove("hidden")
    if (empty) empty.classList.add("hidden")

    filteredExams.forEach(exam => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0"

        const examTypeLabels = {
            quran: "قرآن كريم",
            matn: "متن علمي",
            level: "انتقال مستوى",
            periodic: "دوري / فصلي"
        }

        const statusBadges = {
            draft: { label: "مسودة", cls: "bg-slate-100 text-slate-600" },
            scheduled: { label: "مجدول", cls: "bg-blue-50 text-blue-700" },
            ongoing: { label: "جارٍ الآن", cls: "bg-emerald-50 text-emerald-700" },
            completed: { label: "منتهٍ", cls: "bg-slate-100 text-slate-700" },
            graded: { label: "تم التصحيح", cls: "bg-amber-50 text-amber-700" },
            published: { label: "معلن النتائج", cls: "bg-purple-50 text-purple-700" }
        }

        const formatLabel = exam.format === "in_person" ? "حضوري" : "عن بُعد (إلكتروني)"
        const formatCls = exam.format === "in_person" ? "bg-amber-50 text-amber-800" : "bg-cyan-50 text-cyan-800"

        let targetDisplay = "عام لجميع الطلاب"
        if (exam.targetLevel) targetDisplay = `مستوى: ${exam.targetLevel.name || "محدد"}`
        else if (exam.targetMatn) targetDisplay = `متن: ${exam.targetMatn.name || "محدد"}`
        else if (exam.targetHalaqa) targetDisplay = `حلقة: ${exam.targetHalaqa.name || "محددة"}`

        const statusInfo = statusBadges[exam.status] || { label: exam.status, cls: "bg-slate-100 text-slate-600" }
        const teacherName = getTeacherName(exam.teacher)

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(exam.title)}</div>
                ${exam.description ? `<div class="text-xs text-slate-400 line-clamp-1">${escapeHTML(exam.description)}</div>` : ""}
            </td>
            <td class="px-6 py-4 text-xs font-semibold text-slate-600">
                ${escapeHTML(targetDisplay)}
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col gap-1">
                    <span class="inline-block w-fit rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                        ${examTypeLabels[exam.type] || exam.type}
                    </span>
                    <span class="inline-block w-fit rounded px-2 py-0.5 text-[11px] font-semibold ${formatCls}">
                        ${formatLabel}
                    </span>
                </div>
            </td>
            <td class="px-6 py-4 text-xs">
                <span class="font-bold text-slate-800">${exam.totalScore || 100} نقطة</span>
                <span class="text-slate-400 block">${exam.durationMinutes ? `${exam.durationMinutes} دقيقة` : "غير محدد"}</span>
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${escapeHTML(teacherName)}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${statusInfo.cls}">
                    ${statusInfo.label}
                </span>
                ${exam.isResultsPublished ? `<span class="block mt-1 text-[10px] text-purple-700 font-bold">✓ النتائج معلنة</span>` : ""}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        data-action="view-attempts"
                        data-id="${exam._id}"
                        title="عرض الإجابات والتصحيح"
                        class="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                        الإجابات (${exam.attemptsCount || 0})
                    </button>
                    ${!exam.isResultsPublished ? `
                        <button
                            data-action="publish-results"
                            data-id="${exam._id}"
                            title="إعلان النتائج"
                            class="rounded-lg bg-purple-50 px-2 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition">
                            نشر النتائج
                        </button>
                    ` : ""}
                    <button
                        data-action="edit-exam"
                        data-id="${exam._id}"
                        title="تعديل الامتحان"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        data-action="delete-exam"
                        data-id="${exam._id}"
                        title="حذف الامتحان"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `

        tbody.appendChild(tr)
    })
}

function setupExamsEvents() {
    $("admin-exams-search")?.addEventListener("input", filterAdminExams)
    $("admin-exams-type-filter")?.addEventListener("change", filterAdminExams)
    $("admin-exams-format-filter")?.addEventListener("change", filterAdminExams)
    $("admin-exams-status-filter")?.addEventListener("change", filterAdminExams)

    // Admin Exam Create / Edit Modal Events
    $("btn-admin-add-exam")?.addEventListener("click", () => openAdminExamModal())
    $("btn-close-exam-modal")?.addEventListener("click", closeAdminExamModal)
    $("btn-cancel-exam-modal")?.addEventListener("click", closeAdminExamModal)
    $("admin-exam-form")?.addEventListener("submit", handleSaveAdminExam)

    $("modal-exam-target-type")?.addEventListener("change", (e) => {
        updateAdminExamTargetSelect(e.target.value)
    })

    $("btn-admin-add-question")?.addEventListener("click", addAdminExamQuestion)

    $("admin-exams-table-body")?.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return
        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "view-attempts") {
            openAdminAttemptsModal(id)
        } else if (action === "publish-results") {
            handleAdminPublishResults(id)
        } else if (action === "edit-exam") {
            openAdminExamModal(id)
        } else if (action === "delete-exam") {
            openGenericDeleteModal({
                title: "حذف الامتحان",
                message: "هل أنت متأكد من رغبتك في حذف هذا الامتحان؟ سيتم حذف جميع الأسئلة المرتبطة به.",
                onConfirm: async () => {
                    await deleteExam(id)
                    await loadAdminExams()
                }
            })
        }
    })

    $("btn-close-attempts-modal")?.addEventListener("click", closeAdminAttemptsModal)
    $("btn-close-attempts-modal-footer")?.addEventListener("click", closeAdminAttemptsModal)
    $("btn-admin-publish-modal-results")?.addEventListener("click", () => {
        if (selectedExamForAttempts) {
            handleAdminPublishResults(selectedExamForAttempts._id)
        }
    })

    $("btn-close-grade-modal")?.addEventListener("click", closeGradeModal)
    $("btn-cancel-grade-modal")?.addEventListener("click", closeGradeModal)
    $("admin-grade-attempt-form")?.addEventListener("submit", handleSaveGradeAttempt)
}

function populateAdminExamTeacherOptions() {
    const select = $("modal-exam-teacher")
    if (!select) return
    const currentVal = select.value
    select.innerHTML = `<option value="">إدارة المدرسة (عام)</option>`
    allTeachers.forEach(t => {
        const opt = document.createElement("option")
        opt.value = t._id
        opt.textContent = t.name
        select.appendChild(opt)
    })
    if (currentVal) select.value = currentVal
}

function populateAdminExamTargetOptions() {
    const targetType = $("modal-exam-target-type")
    if (targetType) {
        updateAdminExamTargetSelect(targetType.value)
    }
}

function updateAdminExamTargetSelect(type, selectedVal = null) {
    const container = $("modal-exam-target-select-container")
    const label = $("modal-exam-target-label")
    const select = $("modal-exam-target-val")
    if (!container || !label || !select) return

    if (type === "all") {
        container.classList.add("hidden")
        select.innerHTML = `<option value="">عام لجميع الطلاب</option>`
        return
    }

    container.classList.remove("hidden")

    if (type === "level") {
        label.textContent = "اختر المستوى التعليمي *"
        select.innerHTML = `<option value="">اختر المستوى...</option>`
        allLevels.forEach(lvl => {
            const opt = document.createElement("option")
            opt.value = lvl._id
            opt.textContent = lvl.name
            select.appendChild(opt)
        })
    } else if (type === "matn") {
        label.textContent = "اختر المتن العلمي *"
        select.innerHTML = `<option value="">اختر المتن...</option>`
        allMatns.forEach(m => {
            const opt = document.createElement("option")
            opt.value = m._id
            opt.textContent = m.name
            select.appendChild(opt)
        })
    } else if (type === "halaqa") {
        label.textContent = "اختر الحلقة المستهدفة *"
        select.innerHTML = `<option value="">اختر الحلقة...</option>`
        allHalaqas.forEach(h => {
            const opt = document.createElement("option")
            opt.value = h._id
            opt.textContent = h.name
            select.appendChild(opt)
        })
    }

    if (selectedVal) {
        select.value = selectedVal
    }
}

function openAdminExamModal(examId = null) {
    editingExamId = examId
    const modal = $("modal-admin-create-exam")
    const form = $("admin-exam-form")
    const errBox = $("admin-exam-error")

    if (form) form.reset()
    if (errBox) errBox.classList.add("hidden")

    populateAdminExamTeacherOptions()

    if (examId) {
        setText("modal-exam-form-title", "تعديل الامتحان")
        const exam = allExams.find(e => e._id === examId)
        if (exam) {
            $("admin-exam-id").value = exam._id
            $("modal-exam-title").value = exam.title || ""
            $("modal-exam-type").value = exam.type || "quran"
            $("modal-exam-format").value = exam.format || "online"
            $("modal-exam-teacher").value = getId(exam.teacher) || ""
            $("modal-exam-duration").value = exam.durationMinutes || 30
            $("modal-exam-total-score").value = exam.totalScore || 20
            $("modal-exam-passing-score").value = exam.passingScore || 12
            if (exam.startDate) {
                try {
                    $("modal-exam-start-date").value = new Date(exam.startDate).toISOString().split("T")[0]
                } catch (_) {}
            }
            $("modal-exam-instructions").value = exam.description || exam.instructions || ""
            $("modal-exam-publish-now").checked = exam.status === "scheduled" || exam.status === "ongoing"

            if (exam.targetLevel) {
                $("modal-exam-target-type").value = "level"
                updateAdminExamTargetSelect("level", getId(exam.targetLevel))
            } else if (exam.targetMatn) {
                $("modal-exam-target-type").value = "matn"
                updateAdminExamTargetSelect("matn", getId(exam.targetMatn))
            } else if (exam.targetHalaqa) {
                $("modal-exam-target-type").value = "halaqa"
                updateAdminExamTargetSelect("halaqa", getId(exam.targetHalaqa))
            } else {
                $("modal-exam-target-type").value = "all"
                updateAdminExamTargetSelect("all")
            }

            if (Array.isArray(exam.questions) && exam.questions.length > 0) {
                examBuilderQuestions = exam.questions.map(q => ({
                    text: q.text || "",
                    type: q.type || "multiple_choice",
                    points: q.points || 5,
                    options: Array.isArray(q.options) && q.options.length ? [...q.options] : ["", "", "", ""],
                    correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : 0
                }))
            } else {
                examBuilderQuestions = [
                    {
                        text: "",
                        type: "multiple_choice",
                        points: 5,
                        options: ["", "", "", ""],
                        correctAnswer: 0
                    }
                ]
            }
        }
    } else {
        setText("modal-exam-form-title", "إنشاء امتحان جديد")
        $("admin-exam-id").value = ""
        $("modal-exam-start-date").value = new Date().toISOString().split("T")[0]
        $("modal-exam-target-type").value = "all"
        updateAdminExamTargetSelect("all")
        $("modal-exam-publish-now").checked = true

        examBuilderQuestions = [
            {
                text: "",
                type: "multiple_choice",
                points: 5,
                options: ["", "", "", ""],
                correctAnswer: 0
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
}

function addAdminExamQuestion() {
    examBuilderQuestions.push({
        text: "",
        type: "multiple_choice",
        points: 5,
        options: ["", "", "", ""],
        correctAnswer: 0
    })
    renderAdminExamQuestions()
}

function renderAdminExamQuestions() {
    const container = $("admin-exam-questions-list")
    if (!container) return

    if (!examBuilderQuestions || examBuilderQuestions.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">لا توجد أسئلة مضافة بعد. اضغط "+ إضافة سؤال" لإضافة أسئلة.</div>`
        return
    }

    container.innerHTML = examBuilderQuestions.map((q, idx) => {
        return `
            <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs" data-q-idx="${idx}">
                <div class="flex items-center justify-between">
                    <span class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">${idx + 1}</span>
                    <button type="button" class="btn-remove-q text-xs text-red-500 hover:text-red-700" data-idx="${idx}">حذف السؤال</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div class="sm:col-span-3">
                        <label class="block text-[11px] font-semibold text-slate-600 mb-1">نص السؤال *</label>
                        <input type="text" class="input-q-text w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white" data-idx="${idx}" value="${escapeHTML(q.text || "")}" placeholder="اكتب نص السؤال هنا..." required>
                    </div>
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-600 mb-1">الدرجة *</label>
                        <input type="number" min="1" max="100" class="input-q-points w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white" data-idx="${idx}" value="${q.points || 5}" required>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-600 mb-1">نوع السؤال</label>
                        <select class="select-q-type w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white" data-idx="${idx}">
                            <option value="multiple_choice" ${q.type === "multiple_choice" ? "selected" : ""}>اختيار من متعدد</option>
                            <option value="true_false" ${q.type === "true_false" ? "selected" : ""}>صح أو خطأ</option>
                            <option value="short_answer" ${q.type === "short_answer" ? "selected" : ""}>إجابة قصيرة</option>
                            <option value="essay" ${q.type === "essay" ? "selected" : ""}>سؤال مقالي / شرح</option>
                            <option value="oral_recitation" ${q.type === "oral_recitation" ? "selected" : ""}>تسميع شفوي حضوري</option>
                        </select>
                    </div>
                    <div>
                        ${renderAdminQuestionTypeDetail(q, idx)}
                    </div>
                </div>
            </div>
        `
    }).join("")

    attachAdminQuestionBuilderListeners()
}

function renderAdminQuestionTypeDetail(q, idx) {
    if (q.type === "multiple_choice") {
        const opts = q.options && q.options.length ? q.options : ["", "", "", ""]
        return `
            <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">الخيارات الأربعة (حدد الإجابة الصحيحة)</label>
                <div class="space-y-1">
                    ${opts.map((opt, oIdx) => `
                        <div class="flex items-center gap-1.5">
                            <input type="radio" name="admin-builder-correct-${idx}" value="${oIdx}" ${Number(q.correctAnswer) === oIdx ? "checked" : ""} class="radio-q-correct" data-idx="${idx}" data-oidx="${oIdx}">
                            <input type="text" class="input-q-option flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white" data-idx="${idx}" data-oidx="${oIdx}" value="${escapeHTML(opt)}" placeholder="الخيار ${oIdx + 1}" required>
                        </div>
                    `).join("")}
                </div>
            </div>
        `
    } else if (q.type === "true_false") {
        const isTrue = q.correctAnswer === true || q.correctAnswer === "true" || q.correctAnswer === 1 || q.correctAnswer === "1"
        return `
            <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">الإجابة الصحيحة</label>
                <select class="select-tf-correct w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white" data-idx="${idx}">
                    <option value="true" ${isTrue ? "selected" : ""}>صحيح (صح)</option>
                    <option value="false" ${!isTrue ? "selected" : ""}>خاطئ (خطأ)</option>
                </select>
            </div>
        `
    } else {
        return `
            <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">معيار الإجابة النموذجية أو توجيه التصحيح</label>
                <input type="text" class="input-q-guide w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white" data-idx="${idx}" value="${typeof q.correctAnswer === "string" ? escapeHTML(q.correctAnswer) : ""}" placeholder="معايير تقييم المعلم...">
            </div>
        `
    }
}

function attachAdminQuestionBuilderListeners() {
    const container = $("admin-exam-questions-list")
    if (!container) return

    container.querySelectorAll(".btn-remove-q").forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.idx)
            examBuilderQuestions.splice(idx, 1)
            renderAdminExamQuestions()
        }
    })

    container.querySelectorAll(".input-q-text").forEach(input => {
        input.oninput = () => {
            const idx = Number(input.dataset.idx)
            if (examBuilderQuestions[idx]) examBuilderQuestions[idx].text = input.value
        }
    })

    container.querySelectorAll(".input-q-points").forEach(input => {
        input.oninput = () => {
            const idx = Number(input.dataset.idx)
            if (examBuilderQuestions[idx]) examBuilderQuestions[idx].points = Number(input.value) || 1
        }
    })

    container.querySelectorAll(".select-q-type").forEach(select => {
        select.onchange = () => {
            const idx = Number(select.dataset.idx)
            const newType = select.value
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
                renderAdminExamQuestions()
            }
        }
    })

    container.querySelectorAll(".radio-q-correct").forEach(radio => {
        radio.onchange = () => {
            const idx = Number(radio.dataset.idx)
            const oidx = Number(radio.dataset.oidx)
            if (examBuilderQuestions[idx]) examBuilderQuestions[idx].correctAnswer = oidx
        }
    })

    container.querySelectorAll(".input-q-option").forEach(input => {
        input.oninput = () => {
            const idx = Number(input.dataset.idx)
            const oidx = Number(input.dataset.oidx)
            if (examBuilderQuestions[idx]) {
                if (!examBuilderQuestions[idx].options) examBuilderQuestions[idx].options = ["", "", "", ""]
                examBuilderQuestions[idx].options[oidx] = input.value
            }
        }
    })

    container.querySelectorAll(".select-tf-correct").forEach(select => {
        select.onchange = () => {
            const idx = Number(select.dataset.idx)
            if (examBuilderQuestions[idx]) examBuilderQuestions[idx].correctAnswer = select.value === "true"
        }
    })

    container.querySelectorAll(".input-q-guide").forEach(input => {
        input.oninput = () => {
            const idx = Number(input.dataset.idx)
            if (examBuilderQuestions[idx]) examBuilderQuestions[idx].correctAnswer = input.value
        }
    })
}

async function handleSaveAdminExam(e) {
    e.preventDefault()
    const errBox = $("admin-exam-error")
    const submitBtn = $("btn-submit-exam")

    const title = ($("modal-exam-title")?.value || "").trim()
    const type = $("modal-exam-type")?.value || "quran"
    const format = $("modal-exam-format")?.value || "online"
    const teacher = $("modal-exam-teacher")?.value || null
    const durationMinutes = Number($("modal-exam-duration")?.value) || 30
    const totalScore = Number($("modal-exam-total-score")?.value) || 20
    const passingScore = Number($("modal-exam-passing-score")?.value) || 12
    const startDate = $("modal-exam-start-date")?.value || null
    const instructions = ($("modal-exam-instructions")?.value || "").trim()
    const publishNow = $("modal-exam-publish-now")?.checked

    const targetType = $("modal-exam-target-type")?.value || "all"
    const targetVal = $("modal-exam-target-val")?.value || null

    if (!title) {
        showModalError(errBox, "يرجى إدخال عنوان الامتحان.")
        return
    }

    if (totalScore <= 0 || passingScore <= 0 || passingScore > totalScore) {
        showModalError(errBox, "يجب أن تكون علامة النجاح موجبة ولا تتجاوز مجموع الدرجات.")
        return
    }

    const payload = {
        title,
        type,
        format,
        durationMinutes,
        totalScore,
        passingScore,
        instructions,
        description: instructions,
        status: publishNow ? "scheduled" : "draft",
        questions: examBuilderQuestions.map(q => ({
            text: q.text,
            type: q.type,
            points: Number(q.points) || 1,
            options: q.type === "multiple_choice" ? q.options : [],
            correctAnswer: q.correctAnswer
        }))
    }

    if (startDate) payload.startDate = startDate
    if (teacher) payload.teacher = teacher

    if (targetType === "level" && targetVal) payload.targetLevel = targetVal
    else if (targetType === "matn" && targetVal) payload.targetMatn = targetVal
    else if (targetType === "halaqa" && targetVal) payload.targetHalaqa = targetVal

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."
    if (errBox) errBox.classList.add("hidden")

    try {
        if (editingExamId) {
            await updateExam(editingExamId, payload)
        } else {
            await createExam(payload)
        }
        closeAdminExamModal()
        await loadAdminExams()
    } catch (err) {
        console.error("Save exam error:", err)
        showModalError(errBox, err.message || "تعذر حفظ الامتحان.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ الامتحان"
    }
}

async function openAdminAttemptsModal(examId) {
    const modal = $("modal-admin-exam-attempts")
    const exam = allExams.find(e => e._id === examId)
    selectedExamForAttempts = exam

    setText("attempts-modal-title", `إجابات ونتائج: ${exam?.title || "الامتحان"}`)
    setText("attempts-modal-subtitle", `النوع: ${exam?.type || "عام"} | النمط: ${exam?.format === "in_person" ? "حضوري" : "عن بُعد"}`)

    const publishBtn = $("btn-admin-publish-modal-results")
    if (publishBtn) {
        if (exam?.isResultsPublished) {
            publishBtn.classList.add("hidden")
        } else {
            publishBtn.classList.remove("hidden")
        }
    }

    try {
        const attempts = await getExamAttempts(examId)
        selectedExamAttempts = Array.isArray(attempts) ? attempts : []
        renderAdminAttemptsList()

        if (modal) {
            modal.classList.remove("hidden")
            modal.classList.add("flex")
        }
    } catch (error) {
        console.error("Load attempts error:", error)
        alert(error.message || "تعذر تحميل إجابات الطلاب.")
    }
}

function closeAdminAttemptsModal() {
    const modal = $("modal-admin-exam-attempts")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    selectedExamForAttempts = null
}

function renderAdminAttemptsList() {
    const tbody = $("admin-attempts-table-body")
    const empty = $("admin-attempts-empty")
    const statsContainer = $("attempts-modal-stats")

    if (!tbody) return
    tbody.innerHTML = ""

    const total = selectedExamAttempts.length
    const submitted = selectedExamAttempts.filter(a => a.status === "submitted").length
    const graded = selectedExamAttempts.filter(a => a.status === "graded").length
    const passed = selectedExamAttempts.filter(a => a.passed).length

    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <span class="text-[11px] text-slate-400">إجمالي المشاركين</span>
                <div class="text-base font-bold text-slate-800">${total}</div>
            </div>
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                <span class="text-[11px] text-amber-700">بانتظار التصحيح</span>
                <div class="text-base font-bold text-amber-800">${submitted}</div>
            </div>
            <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
                <span class="text-[11px] text-blue-700">تم التصحيح</span>
                <div class="text-base font-bold text-blue-800">${graded}</div>
            </div>
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <span class="text-[11px] text-emerald-700">الناجحون</span>
                <div class="text-base font-bold text-emerald-800">${passed}</div>
            </div>
        `
    }

    if (total === 0) {
        if (empty) empty.classList.remove("hidden")
        return
    }
    if (empty) empty.classList.add("hidden")

    selectedExamAttempts.forEach(attempt => {
        const tr = document.createElement("tr")
        tr.className = "border-b border-slate-100 last:border-0 hover:bg-slate-50"

        const studentName = getStudentName(attempt.student)
        const dateStr = formatDate(attempt.submittedAt || attempt.createdAt)

        const statusBadges = {
            in_progress: { label: "قيد الإجابة", cls: "bg-blue-50 text-blue-700" },
            submitted: { label: "بانتظار التصحيح", cls: "bg-amber-50 text-amber-700" },
            graded: { label: "تم التصحيح", cls: "bg-emerald-50 text-emerald-700" }
        }
        const st = statusBadges[attempt.status] || { label: attempt.status, cls: "bg-slate-100 text-slate-600" }

        tr.innerHTML = `
            <td class="px-4 py-3 font-bold text-slate-800">${escapeHTML(studentName)}</td>
            <td class="px-4 py-3 text-slate-500">${dateStr}</td>
            <td class="px-4 py-3">
                <span class="inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${st.cls}">
                    ${st.label}
                </span>
            </td>
            <td class="px-4 py-3 font-bold text-slate-800">
                ${attempt.score !== undefined && attempt.score !== null ? `${attempt.score} / ${attempt.totalPossibleScore || 100}` : "—"}
            </td>
            <td class="px-4 py-3">
                ${attempt.percentage !== undefined && attempt.percentage !== null ? `
                    <span class="font-bold ${attempt.passed ? "text-emerald-700" : "text-red-600"}">${attempt.percentage}%</span>
                ` : "—"}
            </td>
            <td class="px-4 py-3 text-center">
                <button
                    type="button"
                    data-grade-attempt-id="${attempt._id}"
                    class="btn-open-grade-attempt rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 transition">
                    ${attempt.status === "graded" ? "مراجعة التصحيح" : "تصحيح الإجابة"}
                </button>
            </td>
        `
        tbody.appendChild(tr)
    })

    tbody.querySelectorAll(".btn-open-grade-attempt").forEach(btn => {
        btn.addEventListener("click", () => {
            const attemptId = btn.dataset.gradeAttemptId
            openGradeModal(attemptId)
        })
    })
}

function openGradeModal(attemptId) {
    const attempt = (selectedExamAttempts && selectedExamAttempts.find(a => a._id === attemptId)) ||
                    (allAdminAttempts && allAdminAttempts.find(a => a._id === attemptId))
    if (!attempt) return

    const modal = $("modal-admin-grade-attempt")
    const errBox = $("admin-grade-error")
    if (errBox) errBox.classList.add("hidden")

    $("grade-attempt-id").value = attemptId
    const maxScore = attempt.totalPossibleScore || (attempt.exam?.totalScore) || 100
    setText("grade-student-display", `الطالب: ${getStudentName(attempt.student)} | إجمالي الدرجة: ${maxScore}`)

    const feedbackInput = $("grade-feedback")
    if (feedbackInput) feedbackInput.value = attempt.feedback || ""

    const container = $("grade-questions-container")
    if (container) {
        container.innerHTML = ""

        if (Array.isArray(attempt.answers) && attempt.answers.length > 0) {
            attempt.answers.forEach((ans, idx) => {
                const qDiv = document.createElement("div")
                qDiv.className = "rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs"

                qDiv.innerHTML = `
                    <div class="flex items-center justify-between font-bold text-slate-800">
                        <span>سؤال ${idx + 1}: ${escapeHTML(ans.questionText || `السؤال رقم ${idx + 1}`)}</span>
                        <span class="text-slate-400">الدرجة القصوى: ${ans.maxScore || 10}</span>
                    </div>
                    <div class="rounded-lg bg-white p-2 border border-slate-200 text-slate-700">
                        <strong class="text-slate-500 block mb-1">إجابة الطالب:</strong>
                        <p class="whitespace-pre-wrap">${ans.studentAnswer !== undefined && ans.studentAnswer !== "" ? escapeHTML(ans.studentAnswer) : "<span class='text-slate-400 italic'>لم يُجب</span>"}</p>
                    </div>
                    <div class="flex items-center gap-3 pt-1">
                        <label class="font-semibold text-slate-600">الدرجة الممنوحة:</label>
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="${ans.maxScore || 10}"
                            data-answer-index="${idx}"
                            value="${ans.score !== undefined ? ans.score : 0}"
                            class="input-q-score w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-600 focus:outline-none">
                    </div>
                `
                container.appendChild(qDiv)
            })
        } else {
            container.innerHTML = `
                <div class="p-4 text-center text-slate-400 text-xs">
                    هذا الامتحان حضوري أو شفهي، يمكنك رصد الدرجة العامة للطالب في خانة الدرجة مباشرة.
                    <div class="mt-3 flex items-center justify-center gap-2">
                        <label class="font-bold text-slate-700">الدرجة الإجمالية:</label>
                        <input
                            id="direct-total-score"
                            type="number"
                            step="0.5"
                            min="0"
                            max="${maxScore}"
                            value="${attempt.score || 0}"
                            class="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-800 focus:border-emerald-600 focus:outline-none">
                    </div>
                </div>
            `
        }
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeGradeModal() {
    const modal = $("modal-admin-grade-attempt")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
}

async function handleSaveGradeAttempt(e) {
    e.preventDefault()
    const attemptId = $("grade-attempt-id")?.value
    const errBox = $("admin-grade-error")
    const saveBtn = $("btn-save-grade")

    const attempt = (selectedExamAttempts && selectedExamAttempts.find(a => a._id === attemptId)) ||
                    (allAdminAttempts && allAdminAttempts.find(a => a._id === attemptId))
    if (!attempt) return

    const feedback = ($("grade-feedback")?.value || "").trim()
    let gradedAnswers = []
    let manualScore = null

    const scoreInputs = document.querySelectorAll(".input-q-score")
    if (scoreInputs.length > 0) {
        scoreInputs.forEach(input => {
            const idx = Number(input.dataset.answerIndex)
            const scoreVal = Number(input.value) || 0
            if (attempt.answers && attempt.answers[idx]) {
                gradedAnswers.push({
                    questionIndex: idx,
                    score: scoreVal
                })
            }
        })
    } else {
        const directScore = Number($("direct-total-score")?.value)
        if (!isNaN(directScore)) manualScore = directScore
    }

    saveBtn.disabled = true
    saveBtn.textContent = "جاري الاعتماد..."
    if (errBox) errBox.classList.add("hidden")

    try {
        await gradeAttempt(attemptId, {
            answers: gradedAnswers,
            manualScore,
            feedback
        })

        closeGradeModal()

        // Refresh all attempts tables and stats
        await loadAdminAttempts()
        await loadAdminExams()

        if (selectedExamForAttempts) {
            const updatedAttempts = await getExamAttempts(selectedExamForAttempts._id)
            selectedExamAttempts = Array.isArray(updatedAttempts) ? updatedAttempts : []
            renderAdminAttemptsList()
        }
    } catch (error) {
        console.error("Grade attempt error:", error)
        showModalError(errBox, error.message || "تعذر اعتماد الدرجة والتصحيح.")
    } finally {
        saveBtn.disabled = false
        saveBtn.textContent = "اعتماد الدرجة والتصحيح"
    }
}

async function handleAdminPublishResults(examId) {
    if (!confirm("هل أنت متأكد من رغبتك في إعلان ونشر النتائج لجميع الطلاب؟ سيتمكن الطلاب من رؤية درجاتهم فوراً.")) return

    try {
        await publishExamResults(examId)
        alert("تم إعلان ونشر نتائج الامتحان بنجاح!")
        await loadAdminExams()
        await loadAdminAttempts()
        if (selectedExamForAttempts && selectedExamForAttempts._id === examId) {
            closeAdminAttemptsModal()
        }
    } catch (error) {
        console.error("Publish results error:", error)
        alert(error.message || "تعذر نشر النتائج.")
    }
}

/* =========================================================
   3. STUDENT EXAM ATTEMPTS & GRADING MANAGEMENT
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
        populateAdminAttemptsExamFilter()
        renderAdminAllAttemptsStats()
        renderAdminAllAttemptsTable()
    } catch (error) {
        console.error("Load all exam attempts error:", error)
    } finally {
        if (loading) {
            loading.classList.add("hidden")
            loading.classList.remove("flex")
        }
    }
}

function renderAdminAllAttemptsStats() {
    const total = allAdminAttempts.length
    const pending = allAdminAttempts.filter(a => a.status === "submitted").length
    const graded = allAdminAttempts.filter(a => a.status === "graded").length
    const passedCount = allAdminAttempts.filter(a => a.passed).length
    const passRate = total > 0 ? Math.round((passedCount / total) * 100) : 0

    setText("admin-all-attempts-total", total)
    setText("admin-all-attempts-pending", pending)
    setText("admin-all-attempts-graded", graded)
    setText("admin-all-attempts-pass-rate", `${passRate}%`)
}

function populateAdminAttemptsExamFilter() {
    const select = $("admin-attempts-filter-exam")
    if (!select) return
    const currentVal = select.value
    select.innerHTML = `<option value="">جميع الامتحانات</option>`
    allExams.forEach(e => {
        const opt = document.createElement("option")
        opt.value = e._id
        opt.textContent = `${e.title}${e.isResultsPublished ? " (نتائج معلنة)" : ""}`
        select.appendChild(opt)
    })
    if (currentVal) select.value = currentVal
    updatePublishSelectedExamBtnState()
}

function updatePublishSelectedExamBtnState() {
    const btn = $("btn-admin-publish-selected-exam")
    const selectedExamId = $("admin-attempts-filter-exam")?.value
    if (!btn) return
    if (selectedExamId) {
        const exam = allExams.find(e => e._id === selectedExamId)
        if (exam?.isResultsPublished) {
            btn.disabled = true
            btn.title = "تم إعلان نتائج هذا الامتحان بالفعل"
        } else {
            btn.disabled = false
            btn.title = "إعلان ونشر النتائج لهذا الامتحان"
        }
    } else {
        btn.disabled = false
        btn.title = "حدد امتحاناً من القائمة أولاً لإعلان نتائجه"
    }
}

function filterAdminAttempts() {
    const search = ($("admin-attempts-search")?.value || "").trim().toLowerCase()
    const examFilter = $("admin-attempts-filter-exam")?.value || ""
    const statusFilter = $("admin-attempts-filter-status")?.value || ""

    filteredAdminAttempts = allAdminAttempts.filter(attempt => {
        const studentName = getStudentName(attempt.student).toLowerCase()
        const examTitle = (attempt.exam?.title || "").toLowerCase()
        const matchesSearch = !search || studentName.includes(search) || examTitle.includes(search)
        const matchesExam = !examFilter || getId(attempt.exam) === examFilter
        const matchesStatus = !statusFilter || attempt.status === statusFilter
        return matchesSearch && matchesExam && matchesStatus
    })

    renderAdminAllAttemptsTable()
}

function renderAdminAllAttemptsTable() {
    const tbody = $("admin-all-attempts-table-body")
    const empty = $("admin-all-attempts-empty")
    const container = $("admin-all-attempts-table-container")

    if (!tbody) return
    tbody.innerHTML = ""
    setText("admin-all-attempts-filtered-count", filteredAdminAttempts.length)

    if (filteredAdminAttempts.length === 0) {
        if (container) container.classList.add("hidden")
        if (empty) empty.classList.remove("hidden")
        return
    }

    if (container) container.classList.remove("hidden")
    if (empty) empty.classList.add("hidden")

    filteredAdminAttempts.forEach(attempt => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0"

        const studentName = getStudentName(attempt.student)
        const studentHalaqa = getStudentHalaqa(attempt.student)
        const examTitle = attempt.exam?.title || "امتحان"
        const examFormat = attempt.exam?.format === "in_person" ? "حضوري" : "عن بُعد"
        const examFormatCls = attempt.exam?.format === "in_person" ? "bg-amber-50 text-amber-800" : "bg-cyan-50 text-cyan-800"
        const dateStr = formatDate(attempt.submittedAt || attempt.createdAt)

        const statusBadges = {
            in_progress: { label: "قيد الحل", cls: "bg-blue-50 text-blue-700" },
            submitted: { label: "بانتظار التصحيح", cls: "bg-amber-50 text-amber-700" },
            graded: { label: "تم التصحيح والاعتماد", cls: "bg-emerald-50 text-emerald-700" }
        }
        const st = statusBadges[attempt.status] || { label: attempt.status, cls: "bg-slate-100 text-slate-600" }

        const maxScore = attempt.totalPossibleScore || (attempt.exam?.totalScore) || 100
        const scoreDisplay = attempt.score !== undefined && attempt.score !== null 
            ? `${attempt.score} / ${maxScore}`
            : "—"
        
        const percentageDisplay = attempt.percentage !== undefined && attempt.percentage !== null
            ? `<span class="font-bold ${attempt.passed ? "text-emerald-700" : "text-red-600"}">${attempt.percentage}%</span>`
            : "—"

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(studentName)}</div>
                <div class="text-xs text-slate-400">${escapeHTML(studentHalaqa)}</div>
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-slate-700">${escapeHTML(examTitle)}</div>
                <span class="inline-block mt-0.5 rounded px-2 py-0.5 text-[10px] font-semibold ${examFormatCls}">
                    ${examFormat}
                </span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                ${dateStr}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2.5 py-1 text-xs font-semibold ${st.cls}">
                    ${st.label}
                </span>
            </td>
            <td class="px-6 py-4 text-xs">
                <span class="font-bold text-slate-800 block">${scoreDisplay}</span>
                <span class="text-xs">${percentageDisplay}</span>
            </td>
            <td class="px-6 py-4 text-center">
                <button
                    type="button"
                    data-action="grade-standalone"
                    data-attempt-id="${attempt._id}"
                    class="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 transition">
                    ${attempt.status === "graded" ? "مراجعة التصحيح" : "تصحيح الإجابة"}
                </button>
            </td>
        `
        tbody.appendChild(tr)
    })
}

function getStudentHalaqa(student) {
    if (!student) return "—"
    if (student.halaqa) return getHalaqaName(student.halaqa)
    const stId = getId(student)
    const h = allHalaqas.find(hal => Array.isArray(hal.students) && hal.students.some(s => getId(s) === stId))
    return h ? h.name : "—"
}

function setupAttemptsEvents() {
    $("admin-attempts-search")?.addEventListener("input", filterAdminAttempts)
    $("admin-attempts-filter-status")?.addEventListener("change", filterAdminAttempts)
    $("admin-attempts-filter-exam")?.addEventListener("change", () => {
        filterAdminAttempts()
        updatePublishSelectedExamBtnState()
    })

    $("btn-admin-publish-selected-exam")?.addEventListener("click", () => {
        const selectedExamId = $("admin-attempts-filter-exam")?.value
        if (!selectedExamId) {
            alert("يرجى اختيار امتحان من قائمة 'جميع الامتحانات' أولاً لنشر وإعلان نتائجه.")
            return
        }
        handleAdminPublishResults(selectedExamId)
    })

    $("admin-all-attempts-table-body")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action='grade-standalone']")
        if (!btn) return
        const attemptId = btn.dataset.attemptId
        if (attemptId) {
            openGradeModal(attemptId)
        }
    })
}

/* =========================================================
   3. MUTUN MEMORIZATION MANAGEMENT
========================================================= */
async function loadAdminMatns() {
    try {
        const [matnsData, progressData, levelsData] = await Promise.all([
            getMatns(),
            getMatnProgress(),
            getLevels()
        ])

        allMatns = Array.isArray(matnsData) ? matnsData : []
        allMatnProgress = Array.isArray(progressData) ? progressData : []
        filteredMatnProgress = [...allMatnProgress]
        allLevels = Array.isArray(levelsData) ? levelsData : []

        populateMatnLevelOptions()
        populateMatnFilterOptions()
        populateAdminMatnProgressMatnOptions()
        renderAdminMatnStats()
        renderAdminMatnsTable()
        renderAdminStudentMatnTable()
    } catch (error) {
        console.error("Load admin matns error:", error)
        alert(error.message || "تعذر تحميل بيانات المتون العلمية.")
    }
}

function renderAdminMatnStats() {
    const total = allMatns.length
    let totalChapters = 0
    allMatns.forEach(m => {
        if (Array.isArray(m.chapters)) totalChapters += m.chapters.length
        else if (m.totalSections) totalChapters += Number(m.totalSections)
    })
    const totalProgress = allMatnProgress.length

    setText("admin-matn-total", total)
    setText("admin-matn-chapters-total", totalChapters)
    setText("admin-matn-progress-total", totalProgress)
}

function populateMatnLevelOptions() {
    const select = $("matn-level-select")
    if (!select) return
    select.innerHTML = `<option value="">بدون تقييد بمستوى معين</option>`
    allLevels.forEach(lvl => {
        const opt = document.createElement("option")
        opt.value = lvl._id
        opt.textContent = lvl.name
        select.appendChild(opt)
    })
}

function populateMatnFilterOptions() {
    const select = $("admin-matn-filter-matn")
    if (!select) return
    select.innerHTML = `<option value="">جميع المتون</option>`
    allMatns.forEach(m => {
        const opt = document.createElement("option")
        opt.value = m._id
        opt.textContent = m.name
        select.appendChild(opt)
    })
}

function renderAdminMatnsTable() {
    const tbody = $("admin-matn-table-body")
    const empty = $("admin-matn-empty")
    const container = $("admin-matn-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (allMatns.length === 0) {
        if (container) container.classList.add("hidden")
        if (empty) empty.classList.remove("hidden")
        return
    }

    if (container) container.classList.remove("hidden")
    if (empty) empty.classList.add("hidden")

    allMatns.forEach(matn => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0"

        const chaptersCount = Array.isArray(matn.chapters) ? matn.chapters.length : (matn.totalSections || 0)
        let versesCount = 0
        if (Array.isArray(matn.chapters)) {
            versesCount = matn.chapters.reduce((acc, c) => acc + (Number(c.versesCount) || 0), 0)
        }

        const levelName = matn.level ? (typeof matn.level === "object" ? matn.level.name : "مستوى مرتبط") : "عام / غير محدد"

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(matn.name)}</div>
                ${matn.description ? `<div class="text-xs text-slate-400 line-clamp-1">${escapeHTML(matn.description)}</div>` : ""}
            </td>
            <td class="px-6 py-4 text-xs font-semibold text-slate-600">
                ${escapeHTML(levelName)}
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-700">
                <span>${chaptersCount} أبواب</span>
                ${versesCount > 0 ? `<span class="text-slate-400 block">${versesCount} بيتاً / سطراً</span>` : ""}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2 py-0.5 text-xs font-semibold ${matn.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}">
                    ${matn.isActive !== false ? "معتمد ونشط" : "معطل"}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        data-action="edit-matn"
                        data-id="${matn._id}"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition"
                        title="تعديل المتن">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        data-action="delete-matn"
                        data-id="${matn._id}"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition"
                        title="حذف المتن">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `
        tbody.appendChild(tr)
    })
}

function filterAdminStudentMatn() {
    const search = ($("admin-matn-student-search")?.value || "").trim().toLowerCase()
    const matnFilter = $("admin-matn-filter-matn")?.value || ""
    const statusFilter = $("admin-matn-filter-status")?.value || ""

    filteredMatnProgress = allMatnProgress.filter(p => {
        const studentName = getStudentName(p.student).toLowerCase()
        const matchesSearch = !search || studentName.includes(search)
        const matnId = getId(p.matn)
        const matchesMatn = !matnFilter || matnId === matnFilter
        const matchesStatus = !statusFilter || p.status === statusFilter
        return matchesSearch && matchesMatn && matchesStatus
    })

    renderAdminStudentMatnTable()
}

function renderAdminStudentMatnTable() {
    const tbody = $("admin-student-matn-table-body")
    const empty = $("admin-student-matn-empty")
    const container = $("admin-student-matn-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (filteredMatnProgress.length === 0) {
        if (container) container.classList.add("hidden")
        if (empty) empty.classList.remove("hidden")
        return
    }

    if (container) container.classList.remove("hidden")
    if (empty) empty.classList.add("hidden")

    filteredMatnProgress.forEach(item => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0"

        const studentName = getStudentName(item.student)
        const halaqaName = getHalaqaName(item.halaqa)
        const matnName = item.matn ? (typeof item.matn === "object" ? item.matn.name : "متن علمي") : "متن علمي"
        const teacherName = getTeacherName(item.teacher)

        const statusBadges = {
            in_progress: { label: "قيد الحفظ", cls: "bg-blue-50 text-blue-700" },
            completed: { label: "متمم للباب", cls: "bg-emerald-50 text-emerald-700" },
            reviewed: { label: "مراجع ومتقن", cls: "bg-purple-50 text-purple-700" }
        }
        const st = statusBadges[item.status] || { label: item.status, cls: "bg-slate-100 text-slate-600" }
        const dateStr = formatDate(item.recitationDate || item.createdAt)

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(studentName)}</div>
                <div class="text-xs text-slate-400">${escapeHTML(halaqaName)}</div>
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-slate-700">${escapeHTML(matnName)}</div>
                <div class="text-xs text-slate-400">${escapeHTML(item.currentSection || "الباب الأول")}</div>
            </td>
            <td class="px-6 py-4 text-xs font-semibold">
                <div class="flex items-center gap-2">
                    <div class="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full bg-emerald-600 rounded-full" style="width: ${Math.min(item.completionPercentage || 0, 100)}%"></div>
                    </div>
                    <span>${item.completionPercentage || 0}%</span>
                </div>
                ${item.masteryGrade ? `<span class="text-slate-500 block mt-1 font-bold">الدرجة: ${item.masteryGrade}/10</span>` : ""}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2.5 py-1 text-xs font-semibold ${st.cls}">
                    ${st.label}
                </span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                ${dateStr}
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${escapeHTML(teacherName)}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        data-action="edit-matn-progress"
                        data-id="${item._id}"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition"
                        title="تعديل سجل التسميع">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        data-action="delete-matn-progress"
                        data-id="${item._id}"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition"
                        title="حذف سجل التسميع">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `
        tbody.appendChild(tr)
    })
}

function setupMatnEvents() {
    $("btn-admin-add-matn")?.addEventListener("click", () => openMatnModal())
    $("btn-close-matn-modal")?.addEventListener("click", closeMatnModal)
    $("btn-cancel-matn-modal")?.addEventListener("click", closeMatnModal)
    $("admin-matn-form")?.addEventListener("submit", handleSaveMatn)

    $("btn-add-matn-chapter-row")?.addEventListener("click", () => addMatnChapterRow())

    $("admin-matn-table-body")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return
        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "edit-matn") {
            openMatnModal(id)
        } else if (action === "delete-matn") {
            openGenericDeleteModal({
                title: "حذف المتن العلمي",
                message: "هل أنت متأكد من رغبتك في حذف هذا المتن؟",
                onConfirm: async () => {
                    await deleteMatn(id)
                    await loadAdminMatns()
                }
            })
        }
    })

    // Student Matn Recitation Tracking Events
    $("btn-admin-add-matn-progress")?.addEventListener("click", () => openAdminMatnProgressModal())
    $("btn-close-matn-progress-modal")?.addEventListener("click", closeAdminMatnProgressModal)
    $("btn-cancel-matn-progress-modal")?.addEventListener("click", closeAdminMatnProgressModal)
    $("admin-matn-progress-form")?.addEventListener("submit", handleSaveAdminMatnProgress)

    $("modal-progress-matn")?.addEventListener("change", handleMatnSelectChange)

    $("admin-student-matn-table-body")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return
        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "edit-matn-progress") {
            openAdminMatnProgressModal(id)
        } else if (action === "delete-matn-progress") {
            openGenericDeleteModal({
                title: "حذف سجل تسميع المتن",
                message: "هل أنت متأكد من رغبتك في حذف هذا السجل للطالب؟",
                onConfirm: async () => {
                    await deleteStudentMatnProgress(id)
                    await loadAdminMatns()
                }
            })
        }
    })

    $("admin-matn-student-search")?.addEventListener("input", filterAdminStudentMatn)
    $("admin-matn-filter-matn")?.addEventListener("change", filterAdminStudentMatn)
    $("admin-matn-filter-status")?.addEventListener("change", filterAdminStudentMatn)
}

function handleMatnSelectChange(e) {
    const matnId = e.target.value
    if (!matnId) return
    const matn = allMatns.find(m => m._id === matnId)
    const sectionInput = $("modal-progress-section")
    if (matn && Array.isArray(matn.chapters) && matn.chapters.length > 0 && sectionInput && !sectionInput.value) {
        sectionInput.value = matn.chapters[0].title || "الباب الأول"
    }
}

function populateAdminMatnProgressStudentOptions() {
    const select = $("modal-progress-student")
    if (!select) return
    const currentVal = select.value
    select.innerHTML = `<option value="">اختر الطالب من القائمة...</option>`
    allStudents.forEach(st => {
        const opt = document.createElement("option")
        opt.value = st._id
        opt.textContent = st.name || `${st.firstName || ""} ${st.lastName || ""}`.trim() || "طالب"
        select.appendChild(opt)
    })
    if (currentVal) select.value = currentVal
}

function populateAdminMatnProgressMatnOptions() {
    const select = $("modal-progress-matn")
    if (!select) return
    const currentVal = select.value
    select.innerHTML = `<option value="">اختر المتن العلمي...</option>`
    allMatns.forEach(m => {
        const opt = document.createElement("option")
        opt.value = m._id
        opt.textContent = m.name
        select.appendChild(opt)
    })
    if (currentVal) select.value = currentVal
}

function populateAdminMatnProgressTeacherOptions() {
    const select = $("modal-progress-teacher")
    if (!select) return
    const currentVal = select.value
    select.innerHTML = `<option value="">إدارة المدرسة (تسميع مباشر مع الإدارة)</option>`
    allTeachers.forEach(t => {
        const opt = document.createElement("option")
        opt.value = t._id
        opt.textContent = t.name
        select.appendChild(opt)
    })
    if (currentVal) select.value = currentVal
}

function openAdminMatnProgressModal(progressId = null) {
    editingMatnProgressId = progressId
    const modal = $("modal-admin-matn-progress")
    const form = $("admin-matn-progress-form")
    const errBox = $("admin-matn-progress-error")

    if (form) form.reset()
    if (errBox) errBox.classList.add("hidden")

    populateAdminMatnProgressStudentOptions()
    populateAdminMatnProgressMatnOptions()
    populateAdminMatnProgressTeacherOptions()

    if (progressId) {
        setText("modal-matn-progress-title", "تعديل سجل تسميع متن")
        const item = allMatnProgress.find(p => p._id === progressId)
        if (item) {
            $("matn-progress-id").value = item._id
            $("modal-progress-student").value = getId(item.student) || ""
            $("modal-progress-matn").value = getId(item.matn) || ""
            $("modal-progress-section").value = item.section || item.currentSection || ""
            $("modal-progress-percentage").value = item.completionPercentage || item.progressPercentage || 0
            $("modal-progress-status").value = item.status || "in_progress"
            $("modal-progress-grade").value = item.masteryGrade || ""
            if (item.recitationDate || item.date) {
                try {
                    $("modal-progress-date").value = new Date(item.recitationDate || item.date).toISOString().split("T")[0]
                } catch (_) {}
            }
            $("modal-progress-teacher").value = getId(item.teacher) || ""
            $("modal-progress-notes").value = item.teacherNotes || item.notes || ""
        }
    } else {
        setText("modal-matn-progress-title", "تسجيل تسميع متن لطالب")
        $("matn-progress-id").value = ""
        $("modal-progress-date").value = new Date().toISOString().split("T")[0]
        $("modal-progress-percentage").value = 25
        $("modal-progress-status").value = "in_progress"
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeAdminMatnProgressModal() {
    const modal = $("modal-admin-matn-progress")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    editingMatnProgressId = null
}

async function handleSaveAdminMatnProgress(e) {
    e.preventDefault()
    const errBox = $("admin-matn-progress-error")
    const submitBtn = $("btn-submit-matn-progress")

    const student = $("modal-progress-student")?.value
    const matn = $("modal-progress-matn")?.value
    const section = ($("modal-progress-section")?.value || "").trim()
    const completionPercentage = Number($("modal-progress-percentage")?.value) || 0
    const status = $("modal-progress-status")?.value || "in_progress"
    const masteryGrade = ($("modal-progress-grade")?.value || "").trim()
    const recitationDate = $("modal-progress-date")?.value
    const teacher = $("modal-progress-teacher")?.value || null
    const teacherNotes = ($("modal-progress-notes")?.value || "").trim()

    if (!student || !matn || !recitationDate) {
        showModalError(errBox, "يرجى اختيار الطالب والمتن وتحديد تاريخ التسميع.")
        return
    }

    const payload = {
        student,
        studentId: student,
        matn,
        matnId: matn,
        section,
        currentSection: section,
        completionPercentage,
        progressPercentage: completionPercentage,
        status,
        masteryGrade,
        recitationDate,
        teacherNotes,
        notes: teacherNotes
    }

    if (teacher) {
        payload.teacher = teacher
        payload.teacherId = teacher
    }

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."
    if (errBox) errBox.classList.add("hidden")

    try {
        if (editingMatnProgressId) {
            await updateStudentMatnProgress(editingMatnProgressId, payload)
        } else {
            await createStudentMatnProgress(payload)
        }
        closeAdminMatnProgressModal()
        await loadAdminMatns()
    } catch (err) {
        console.error("Save matn progress error:", err)
        showModalError(errBox, err.message || "تعذر حفظ سجل التسميع.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ السجل"
    }
}

function openMatnModal(matnId = null) {
    editingMatnId = matnId
    const modal = $("modal-admin-matn")
    const form = $("admin-matn-form")
    const errBox = $("admin-matn-error")
    const chaptersList = $("matn-chapters-list")

    if (form) form.reset()
    if (errBox) errBox.classList.add("hidden")
    if (chaptersList) chaptersList.innerHTML = ""

    if (matnId) {
        setText("modal-matn-title", "تعديل المتن العلمي")
        const matn = allMatns.find(m => m._id === matnId)
        if (matn) {
            $("matn-id").value = matn._id
            $("matn-name").value = matn.name || ""
            $("matn-level-select").value = getId(matn.level) || ""
            $("matn-desc").value = matn.description || ""
            $("matn-is-active").checked = matn.isActive !== false

            if (Array.isArray(matn.chapters) && matn.chapters.length > 0) {
                matn.chapters.forEach(c => addMatnChapterRow(c.title, c.versesCount, c.order))
            } else {
                addMatnChapterRow("مقدمة المتن", 10, 1)
            }
        }
    } else {
        setText("modal-matn-title", "إضافة متن علمي جديد")
        $("matn-id").value = ""
        $("matn-is-active").checked = true
        addMatnChapterRow("مقدمة المتن", 10, 1)
        addMatnChapterRow("الباب الأول", 20, 2)
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeMatnModal() {
    const modal = $("modal-admin-matn")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    editingMatnId = null
}

function addMatnChapterRow(title = "", verses = 0, order = null) {
    const list = $("matn-chapters-list")
    if (!list) return

    const currentCount = list.children.length
    const rowOrder = order || currentCount + 1

    const row = document.createElement("div")
    row.className = "flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs"

    row.innerHTML = `
        <span class="w-6 text-center font-bold text-slate-400">${rowOrder}</span>
        <input
            type="text"
            required
            placeholder="عنوان الباب / الفصل"
            value="${escapeHTML(title)}"
            class="chapter-title-input flex-1 rounded border border-slate-200 px-2 py-1 focus:border-emerald-600 focus:outline-none">
        <input
            type="number"
            min="0"
            placeholder="عدد الأبيات"
            value="${verses || 0}"
            class="chapter-verses-input w-20 rounded border border-slate-200 px-2 py-1 focus:border-emerald-600 focus:outline-none">
        <button
            type="button"
            class="btn-remove-chapter-row text-red-500 hover:text-red-700 px-1"
            title="حذف هذا الباب">
            ✕
        </button>
    `

    row.querySelector(".btn-remove-chapter-row")?.addEventListener("click", () => {
        row.remove()
    })

    list.appendChild(row)
}

async function handleSaveMatn(e) {
    e.preventDefault()
    const errBox = $("admin-matn-error")
    const submitBtn = $("btn-submit-matn")

    const name = ($("matn-name")?.value || "").trim()
    const level = $("matn-level-select")?.value || null
    const description = ($("matn-desc")?.value || "").trim()
    const isActive = $("matn-is-active")?.checked

    if (!name) {
        showModalError(errBox, "يرجى كتابة اسم المتن.")
        return
    }

    const chapterRows = document.querySelectorAll("#matn-chapters-list > div")
    const chapters = []
    chapterRows.forEach((row, idx) => {
        const titleInput = row.querySelector(".chapter-title-input")
        const versesInput = row.querySelector(".chapter-verses-input")
        chapters.push({
            title: (titleInput?.value || `الباب ${idx + 1}`).trim(),
            versesCount: Number(versesInput?.value) || 0,
            order: idx + 1
        })
    })

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."
    if (errBox) errBox.classList.add("hidden")

    try {
        const payload = {
            name,
            level: level || null,
            description,
            chapters,
            isActive
        }

        if (editingMatnId) {
            await updateMatn(editingMatnId, payload)
        } else {
            await createMatn(payload)
        }

        closeMatnModal()
        await loadAdminMatns()
    } catch (error) {
        console.error("Save matn error:", error)
        showModalError(errBox, error.message || "تعذر حفظ المتن العلمي.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ المتن"
    }
}

/* =========================================================
   4. EDUCATIONAL LEVELS & PROMOTION HISTORY
========================================================= */
async function loadAdminLevels() {
    try {
        const [levelsData, promotionsData] = await Promise.all([
            getLevels(),
            getStudentLevelHistory("all")
        ])

        allLevels = Array.isArray(levelsData) ? levelsData : []
        allLevelPromotions = Array.isArray(promotionsData) ? promotionsData : []
        filteredLevelPromotions = [...allLevelPromotions]

        renderAdminLevelsStats()
        renderAdminLevelsTable()
        renderAdminPromotionsTable()
    } catch (error) {
        console.error("Load admin levels error:", error)
        alert(error.message || "تعذر تحميل المستويات التعليمية.")
    }
}

function renderAdminLevelsStats() {
    const totalLevels = allLevels.length
    const totalPromotions = allLevelPromotions.length

    setText("admin-levels-total", totalLevels)
    setText("admin-levels-students-total", totalLevels > 0 ? "نشط" : 0)
    setText("admin-levels-promotions-total", totalPromotions)
}

function renderAdminLevelsTable() {
    const tbody = $("admin-levels-table-body")
    const empty = $("admin-levels-empty")
    const container = $("admin-levels-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (allLevels.length === 0) {
        if (container) container.classList.add("hidden")
        if (empty) empty.classList.remove("hidden")
        return
    }

    if (container) container.classList.remove("hidden")
    if (empty) empty.classList.add("hidden")

    // Sort by order ascending
    const sortedLevels = [...allLevels].sort((a, b) => (a.order || 0) - (b.order || 0))

    sortedLevels.forEach(lvl => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0"

        tr.innerHTML = `
            <td class="px-6 py-4">
                <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-800">
                    ${lvl.order || 1}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(lvl.name)}</div>
                ${lvl.code ? `<span class="text-xs text-slate-400 font-mono">${escapeHTML(lvl.code)}</span>` : ""}
            </td>
            <td class="px-6 py-4 text-sm font-bold text-slate-700">
                ${lvl.passingScore || 60} / 100
            </td>
            <td class="px-6 py-4 text-xs text-slate-600">
                ${lvl.quranRequirements ? `<div class="font-medium text-emerald-800">📖 ${escapeHTML(lvl.quranRequirements)}</div>` : ""}
                ${lvl.matnRequirements ? `<div class="font-medium text-blue-800 mt-0.5">📜 ${escapeHTML(lvl.matnRequirements)}</div>` : ""}
                ${!lvl.quranRequirements && !lvl.matnRequirements ? `<span class="text-slate-400">—</span>` : ""}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2 py-0.5 text-xs font-semibold ${lvl.autoPromoteOnPass ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}">
                    ${lvl.autoPromoteOnPass ? "مفعلة تلقائياً" : "يدوية"}
                </span>
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2 py-0.5 text-xs font-semibold ${lvl.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}">
                    ${lvl.isActive !== false ? "نشط" : "معطل"}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        data-action="edit-level"
                        data-id="${lvl._id}"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition"
                        title="تعديل المستوى">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        data-action="delete-level"
                        data-id="${lvl._id}"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition"
                        title="حذف المستوى">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `
        tbody.appendChild(tr)
    })
}

function filterAdminPromotions() {
    const search = ($("admin-promotions-search")?.value || "").trim().toLowerCase()
    filteredLevelPromotions = allLevelPromotions.filter(p => {
        const studentName = getStudentName(p.student).toLowerCase()
        return !search || studentName.includes(search)
    })
    renderAdminPromotionsTable()
}

function renderAdminPromotionsTable() {
    const tbody = $("admin-promotions-table-body")
    const empty = $("admin-promotions-empty")
    const container = $("admin-promotions-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (filteredLevelPromotions.length === 0) {
        if (container) container.classList.add("hidden")
        if (empty) empty.classList.remove("hidden")
        return
    }

    if (container) container.classList.remove("hidden")
    if (empty) empty.classList.add("hidden")

    filteredLevelPromotions.forEach(item => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0"

        const studentName = getStudentName(item.student)
        const prevLevel = item.previousLevel ? (typeof item.previousLevel === "object" ? item.previousLevel.name : "المستوى السابق") : "بداية التسجيل"
        const newLevel = item.newLevel ? (typeof item.newLevel === "object" ? item.newLevel.name : "المستوى الجديد") : "المستوى الجديد"
        const dateStr = formatDate(item.changeDate || item.createdAt)
        const changedByName = getTeacherName(item.changedBy)

        tr.innerHTML = `
            <td class="px-6 py-4 font-bold text-slate-800">
                ${escapeHTML(studentName)}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2 text-xs font-semibold">
                    <span class="rounded bg-slate-100 px-2 py-0.5 text-slate-600">${escapeHTML(prevLevel)}</span>
                    <span class="text-emerald-600 font-bold">&larr;</span>
                    <span class="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">${escapeHTML(newLevel)}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                ${dateStr}
            </td>
            <td class="px-6 py-4 text-xs text-slate-600">
                ${item.reason ? escapeHTML(item.reason) : (item.exam ? `اجتياز: ${escapeHTML(item.exam.title || "امتحان المستوى")}` : "ترقية دورية")}
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-700">
                ${escapeHTML(changedByName)}
            </td>
        `
        tbody.appendChild(tr)
    })
}

function setupLevelsEvents() {
    $("btn-admin-add-level")?.addEventListener("click", () => openLevelModal())
    $("btn-close-level-modal")?.addEventListener("click", closeLevelModal)
    $("btn-cancel-level-modal")?.addEventListener("click", closeLevelModal)
    $("admin-level-form")?.addEventListener("submit", handleSaveLevel)

    $("admin-promotions-search")?.addEventListener("input", filterAdminPromotions)

    $("admin-levels-table-body")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return
        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "edit-level") {
            openLevelModal(id)
        } else if (action === "delete-level") {
            openGenericDeleteModal({
                title: "حذف المستوى التعليمي",
                message: "هل أنت متأكد من رغبتك في حذف هذا المستوى؟",
                onConfirm: async () => {
                    await deleteLevel(id)
                    await loadAdminLevels()
                }
            })
        }
    })
}

function openLevelModal(levelId = null) {
    editingLevelId = levelId
    const modal = $("modal-admin-level")
    const form = $("admin-level-form")
    const errBox = $("admin-level-error")

    if (form) form.reset()
    if (errBox) errBox.classList.add("hidden")

    if (levelId) {
        setText("modal-level-title", "تعديل المستوى التعليمي")
        const lvl = allLevels.find(l => l._id === levelId)
        if (lvl) {
            $("level-id").value = lvl._id
            $("level-name").value = lvl.name || ""
            $("level-order").value = lvl.order || 1
            $("level-code").value = lvl.code || ""
            $("level-passing-score").value = lvl.passingScore || 60
            $("level-quran-req").value = lvl.quranRequirements || ""
            $("level-matn-req").value = lvl.matnRequirements || ""
            $("level-desc").value = lvl.description || ""
            $("level-auto-promote").checked = Boolean(lvl.autoPromoteOnPass)
            $("level-is-active").checked = lvl.isActive !== false
        }
    } else {
        setText("modal-level-title", "إضافة مستوى تعليمي جديد")
        $("level-id").value = ""
        $("level-order").value = allLevels.length + 1
        $("level-passing-score").value = 60
        $("level-auto-promote").checked = false
        $("level-is-active").checked = true
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closeLevelModal() {
    const modal = $("modal-admin-level")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
    editingLevelId = null
}

async function handleSaveLevel(e) {
    e.preventDefault()
    const errBox = $("admin-level-error")
    const submitBtn = $("btn-submit-level")

    const name = ($("level-name")?.value || "").trim()
    const order = Number($("level-order")?.value)
    const code = ($("level-code")?.value || "").trim()
    const passingScore = Number($("level-passing-score")?.value)
    const quranRequirements = ($("level-quran-req")?.value || "").trim()
    const matnRequirements = ($("level-matn-req")?.value || "").trim()
    const description = ($("level-desc")?.value || "").trim()
    const autoPromoteOnPass = $("level-auto-promote")?.checked
    const isActive = $("level-is-active")?.checked

    if (!name || isNaN(order) || isNaN(passingScore)) {
        showModalError(errBox, "يرجى ملء جميع الحقول المطلوبة بشكل صحيح.")
        return
    }

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."
    if (errBox) errBox.classList.add("hidden")

    try {
        const payload = {
            name,
            order,
            code,
            passingScore,
            quranRequirements,
            matnRequirements,
            description,
            autoPromoteOnPass,
            isActive
        }

        if (editingLevelId) {
            await updateLevel(editingLevelId, payload)
        } else {
            await createLevel(payload)
        }

        closeLevelModal()
        await loadAdminLevels()
    } catch (error) {
        console.error("Save level error:", error)
        showModalError(errBox, error.message || "تعذر حفظ المستوى التعليمي.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ المستوى"
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
    if (!teacher) return "معلم غير محدد"
    if (typeof teacher === "string") {
        if (/^[0-9a-fA-F]{24}$/.test(teacher)) return "المعلم المشرف"
        return teacher
    }
    if (typeof teacher === "object") {
        return teacher.name || `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "المعلم المشرف"
    }
    return "معلم غير محدد"
}

function getTypeBadge(type) {
    if (type === "memorization") {
        return { label: "حفظ", bgClass: "bg-emerald-50 text-emerald-700" }
    }
    if (type === "recitation") {
        return { label: "تلاوة", bgClass: "bg-blue-50 text-blue-700" }
    }
    if (type === "tajweed") {
        return { label: "تجويد", bgClass: "bg-purple-50 text-purple-700" }
    }
    return { label: type || "—", bgClass: "bg-slate-100 text-slate-700" }
}

function getScoreBadge(score) {
    const s = Number(score)
    if (s >= 9) {
        return { label: "ممتاز", badgeClass: "bg-emerald-100 text-emerald-800" }
    }
    if (s >= 7.5) {
        return { label: "جيد جداً", badgeClass: "bg-blue-100 text-blue-800" }
    }
    if (s >= 5) {
        return { label: "جيد", badgeClass: "bg-amber-100 text-amber-800" }
    }
    return { label: "بحاجة لتحسين", badgeClass: "bg-red-100 text-red-800" }
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

function isToday(dateValue) {
    if (!dateValue) return false
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return false

    const today = new Date()
    return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
    )
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
    const el = $("evaluations-loading")
    if (el) {
        if (show) el.classList.remove("hidden"), el.classList.add("flex")
        else el.classList.add("hidden"), el.classList.remove("flex")
    }
}

function showError(msg) {
    const el = $("evaluations-error")
    if (el) {
        el.textContent = msg
        el.classList.remove("hidden")
    }
}

function hideError() {
    const el = $("evaluations-error")
    if (el) el.classList.add("hidden")
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
