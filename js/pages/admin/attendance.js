import {
    getAttendances,
    getAttendanceById,
    createAttendance,
    updateAttendance,
    deleteAttendance
} from "../../api/attendanceApi.js"

import { getHalaqas } from "../../api/halaqaApi.js"
import { getUser, protectPage } from "../../auth/auth.js"
import { initNotificationBell } from "../../components/notificationBell.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")


/* =========================================================
   State
========================================================= */
let allAttendances = []
let filteredAttendances = []
let allHalaqas = []

let selectedAttendance = null
let attendanceToDeleteId = null


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
        loadAttendances(),
        loadHalaqas()
    ])
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
async function loadAttendances() {
    showLoading(true)
    hideError()

    try {
        const data = await getAttendances()
        allAttendances = Array.isArray(data) ? data : []
        filteredAttendances = [...allAttendances]

        renderStatistics()
        renderAttendances()
    } catch (error) {
        console.error("Load attendances error:", error)
        showError(error.message || "تعذر تحميل سجلات الحضور. يرجى المحاولة مرة أخرى.")
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


/* =========================================================
   Options Population
========================================================= */
function populateHalaqaFilters() {
    const filterSelect = $("attendance-halaqa-filter")
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
    const createSelect = $("create-att-halaqa")
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
    const studentSelect = $("create-att-student")
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


/* =========================================================
   Statistics
========================================================= */
function renderStatistics() {
    const total = allAttendances.length

    let present = 0
    let absent = 0
    let late = 0

    allAttendances.forEach(item => {
        if (item.status === "present") present++
        else if (item.status === "absent") absent++
        else if (item.status === "late") late++
    })

    setText("total-attendance-count", total)
    setText("present-attendance-count", present)
    setText("absent-attendance-count", absent)
    setText("late-attendance-count", late)
}


/* =========================================================
   Filtering
========================================================= */
function filterAttendances() {
    const searchQuery = ($("attendance-search")?.value || "").trim().toLowerCase()
    const statusFilter = $("attendance-status-filter")?.value || ""
    const halaqaFilter = $("attendance-halaqa-filter")?.value || ""
    const dateFilter = $("attendance-date-filter")?.value || ""

    filteredAttendances = allAttendances.filter(item => {
        const sName = getStudentName(item.student).toLowerCase()
        const hName = getHalaqaName(item.halaqa).toLowerCase()

        const matchesSearch = !searchQuery ||
            sName.includes(searchQuery) ||
            hName.includes(searchQuery)

        const matchesStatus = !statusFilter || item.status === statusFilter

        const itemHalaqaId = getId(item.halaqa)
        const matchesHalaqa = !halaqaFilter || itemHalaqaId === halaqaFilter

        let matchesDate = true
        if (dateFilter) {
            const itemDate = new Date(item.date).toISOString().split("T")[0]
            matchesDate = itemDate === dateFilter
        }

        return matchesSearch && matchesStatus && matchesHalaqa && matchesDate
    })

    renderAttendances()
}


/* =========================================================
   Render Table
========================================================= */
function renderAttendances() {
    const tbody = $("attendance-table-body")
    const emptyState = $("attendance-empty")
    const tableContainer = $("attendance-table-container")

    if (!tbody) return

    tbody.innerHTML = ""
    setText("filtered-attendance-count", filteredAttendances.length)

    if (filteredAttendances.length === 0) {
        if (tableContainer) tableContainer.classList.add("hidden")
        if (emptyState) emptyState.classList.remove("hidden")
        return
    }

    if (tableContainer) tableContainer.classList.remove("hidden")
    if (emptyState) emptyState.classList.add("hidden")

    filteredAttendances.forEach(attendance => {
        const tr = document.createElement("tr")
        tr.className = "transition hover:bg-slate-50 border-b border-slate-100 last:border-0"

        const studentName = getStudentName(attendance.student)
        const studentEmail = attendance.student?.email || ""
        const halaqaName = getHalaqaName(attendance.halaqa)
        const statusInfo = getStatusBadge(attendance.status)
        const dateStr = formatDate(attendance.date)

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(studentName)}</div>
                ${studentEmail ? `<div class="text-xs text-slate-400">${escapeHTML(studentEmail)}</div>` : ""}
            </td>
            <td class="px-6 py-4 font-medium text-slate-700">
                ${escapeHTML(halaqaName)}
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                ${dateStr}
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${statusInfo.badgeClass}">
                    <span class="h-1.5 w-1.5 rounded-full ${statusInfo.dotClass}"></span>
                    ${statusInfo.label}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        data-action="details"
                        data-id="${attendance._id}"
                        title="عرض التفاصيل"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                    </button>
                    <button
                        data-action="edit"
                        data-id="${attendance._id}"
                        title="تعديل الحالة"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button
                        data-action="delete"
                        data-id="${attendance._id}"
                        title="حذف السجل"
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


/* =========================================================
   Event Listeners
========================================================= */
function setupEvents() {
    $("attendance-search")?.addEventListener("input", filterAttendances)
    $("attendance-status-filter")?.addEventListener("change", filterAttendances)
    $("attendance-halaqa-filter")?.addEventListener("change", filterAttendances)
    $("attendance-date-filter")?.addEventListener("change", filterAttendances)

    // Dependent student select
    $("create-att-halaqa")?.addEventListener("change", (e) => {
        populateCreateStudentOptions(e.target.value)
    })

    // Open Create Modal
    $("open-create-attendance-btn")?.addEventListener("click", openCreateModal)
    $("close-create-modal")?.addEventListener("click", closeCreateModal)
    $("cancel-create-modal")?.addEventListener("click", closeCreateModal)
    $("create-attendance-form")?.addEventListener("submit", handleCreateAttendance)

    // Table Actions
    $("attendance-table-body")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return

        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "details") openDetailsModal(id)
        if (action === "edit") openEditModal(id)
        if (action === "delete") openDeleteModal(id)
    })

    // Details Modal Actions
    $("close-details-modal")?.addEventListener("click", closeDetailsModal)
    $("details-close-btn")?.addEventListener("click", closeDetailsModal)
    $("details-edit-btn")?.addEventListener("click", () => {
        if (selectedAttendance) {
            const id = selectedAttendance._id
            closeDetailsModal()
            openEditModal(id)
        }
    })

    // Edit Modal Actions
    $("close-edit-modal")?.addEventListener("click", closeEditModal)
    $("cancel-edit-modal")?.addEventListener("click", closeEditModal)
    $("edit-attendance-form")?.addEventListener("submit", handleEditAttendance)

    // Delete Modal Actions
    $("cancel-delete-modal")?.addEventListener("click", closeDeleteModal)
    $("confirm-delete-att-btn")?.addEventListener("click", handleConfirmDelete)

    // Escape Key to close all modals
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeCreateModal()
            closeEditModal()
            closeDetailsModal()
            closeDeleteModal()
        }
    })
}


/* =========================================================
   Create Attendance Logic
========================================================= */
function openCreateModal() {
    const modal = $("create-attendance-modal")
    const form = $("create-attendance-form")
    const errBox = $("create-attendance-error")

    if (form) form.reset()
    if (errBox) {
        errBox.classList.add("hidden")
        errBox.textContent = ""
    }

    const dateInput = $("create-att-date")
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0]
    }

    populateCreateStudentOptions("")

    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeCreateModal() {
    const modal = $("create-attendance-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
}

async function handleCreateAttendance(e) {
    e.preventDefault()

    const errBox = $("create-attendance-error")
    const submitBtn = $("submit-create-attendance")

    const halaqa = $("create-att-halaqa")?.value
    const student = $("create-att-student")?.value
    const date = $("create-att-date")?.value
    const status = $("create-att-status")?.value

    if (errBox) errBox.classList.add("hidden")

    if (!halaqa || !student || !date || !status) {
        showModalError(errBox, "يرجى تعبئة جميع الحقول الإلزامية.")
        return
    }

    submitBtn.disabled = true
    submitBtn.textContent = "جاري التسجيل..."

    try {
        await createAttendance({
            halaqa,
            student,
            date,
            status
        })

        closeCreateModal()
        await loadAttendances()
    } catch (error) {
        console.error("Create attendance error:", error)
        showModalError(errBox, error.message || "فشل تسجيل الحضور. قد يكون مسجلاً مسبقاً لهذا التاريخ.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "تسجيل الحضور"
    }
}


/* =========================================================
   Details Attendance Logic
========================================================= */
async function openDetailsModal(id) {
    const modal = $("details-attendance-modal")

    selectedAttendance = allAttendances.find(item => item._id === id)

    try {
        if (!selectedAttendance) {
            selectedAttendance = await getAttendanceById(id)
        }
    } catch (error) {
        console.warn("Could not fetch fresh details:", error)
    }

    if (!selectedAttendance) return

    const studentName = getStudentName(selectedAttendance.student)
    const studentEmail = selectedAttendance.student?.email || "لا يوجد بريد إلكتروني"
    const halaqaName = getHalaqaName(selectedAttendance.halaqa)
    const statusInfo = getStatusBadge(selectedAttendance.status)

    setText("details-att-student-name", studentName)
    setText("details-att-student-email", studentEmail)
    setText("details-att-halaqa", halaqaName)
    setText("details-att-date", formatDate(selectedAttendance.date))
    setText("details-att-created", formatDateTime(selectedAttendance.createdAt))

    const badge = $("details-att-status-badge")
    if (badge) {
        badge.textContent = statusInfo.label
        badge.className = `inline-block rounded-xl px-3 py-1.5 text-xs font-bold ${statusInfo.badgeClass}`
    }

    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeDetailsModal() {
    const modal = $("details-attendance-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
    selectedAttendance = null
}


/* =========================================================
   Edit Attendance Logic
========================================================= */
async function openEditModal(id) {
    const modal = $("edit-attendance-modal")
    const errBox = $("edit-attendance-error")

    if (errBox) {
        errBox.classList.add("hidden")
        errBox.textContent = ""
    }

    selectedAttendance = allAttendances.find(item => item._id === id)
    if (!selectedAttendance) {
        try {
            selectedAttendance = await getAttendanceById(id)
        } catch (error) {
            console.error("Fetch attendance failed:", error)
            return
        }
    }

    if (!selectedAttendance) return

    setText("edit-att-student-name", getStudentName(selectedAttendance.student))
    setText("edit-att-halaqa-name", getHalaqaName(selectedAttendance.halaqa))
    setText("edit-att-date-display", formatDate(selectedAttendance.date))

    const statusSelect = $("edit-att-status")
    if (statusSelect) {
        statusSelect.value = selectedAttendance.status || "present"
    }

    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeEditModal() {
    const modal = $("edit-attendance-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
}

async function handleEditAttendance(e) {
    e.preventDefault()

    if (!selectedAttendance) return

    const errBox = $("edit-attendance-error")
    const submitBtn = $("submit-edit-attendance")
    const status = $("edit-att-status")?.value

    if (errBox) errBox.classList.add("hidden")

    submitBtn.disabled = true
    submitBtn.textContent = "جاري التحديث..."

    try {
        await updateAttendance(selectedAttendance._id, status)
        closeEditModal()
        await loadAttendances()
    } catch (error) {
        console.error("Update attendance error:", error)
        showModalError(errBox, error.message || "فشل تحديث حالة الحضور.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "تحديث الحالة"
    }
}


/* =========================================================
   Delete Attendance Logic
========================================================= */
function openDeleteModal(id) {
    attendanceToDeleteId = id
    const attItem = allAttendances.find(item => item._id === id)
    setText("delete-att-student-name", attItem ? getStudentName(attItem.student) : "هذا الطالب")

    const errBox = $("delete-attendance-error")
    if (errBox) {
        errBox.classList.add("hidden")
        errBox.textContent = ""
    }

    const modal = $("delete-attendance-modal")
    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeDeleteModal() {
    const modal = $("delete-attendance-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
    attendanceToDeleteId = null
}

async function handleConfirmDelete() {
    if (!attendanceToDeleteId) return

    const errBox = $("delete-attendance-error")
    const deleteBtn = $("confirm-delete-att-btn")

    deleteBtn.disabled = true
    deleteBtn.textContent = "جاري الحذف..."

    try {
        await deleteAttendance(attendanceToDeleteId)
        closeDeleteModal()
        await loadAttendances()
    } catch (error) {
        console.error("Delete attendance error:", error)
        showModalError(errBox, error.message || "تعذر حذف سجل الحضور.")
    } finally {
        deleteBtn.disabled = false
        deleteBtn.textContent = "حذف السجل"
    }
}


/* =========================================================
   Helpers & Formatters
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

function getStatusBadge(status) {
    if (status === "present") {
        return {
            label: "حاضر",
            badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
            dotClass: "bg-emerald-500"
        }
    }
    if (status === "absent") {
        return {
            label: "غائب",
            badgeClass: "bg-red-50 text-red-700 border border-red-200",
            dotClass: "bg-red-500"
        }
    }
    if (status === "late") {
        return {
            label: "متأخر",
            badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
            dotClass: "bg-amber-500"
        }
    }
    return {
        label: status || "—",
        badgeClass: "bg-slate-100 text-slate-700",
        dotClass: "bg-slate-400"
    }
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

function showLoading(show) {
    const el = $("attendance-loading")
    if (el) {
        if (show) el.classList.remove("hidden"), el.classList.add("flex")
        else el.classList.add("hidden"), el.classList.remove("flex")
    }
}

function showError(msg) {
    const el = $("attendance-error")
    if (el) {
        el.textContent = msg
        el.classList.remove("hidden")
    }
}

function hideError() {
    const el = $("attendance-error")
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
