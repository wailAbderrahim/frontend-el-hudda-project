import {
    getEvaluations,
    getEvaluationById,
    createEvaluation,
    updateEvaluation,
    deleteEvaluation
} from "../../api/evaluationsApi.js"

import { getHalaqas } from "../../api/halaqaApi.js"
import { getUsers } from "../../api/usersApi.js"
import { getUser, protectPage, logout } from "../../auth/auth.js"
import { initNotificationBell } from "../../components/notificationBell.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")

/* =========================================================
   State
========================================================= */
let allEvaluations = []
let filteredEvaluations = []
let allHalaqas = []
let allUsers = []
let allStudents = []
let allTeachers = []
let selectedEvaluation = null
let evaluationToDeleteId = null

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
    initNotificationBell()

    await Promise.all([
        loadHalaqas(),
        loadUsers()
    ])

    await loadEvaluations()
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
            logout()
            window.location.href = "../auth/login.html"
        })
    }
}

/* =========================================================
   1. DAILY EVALUATIONS DATA & CRUD
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
