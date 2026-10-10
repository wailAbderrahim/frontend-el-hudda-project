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

import { getLevels } from "../../api/levelsApi.js"
import { getUsers } from "../../api/usersApi.js"
import { getHalaqas } from "../../api/halaqaApi.js"
import { getUser, protectPage, logout } from "../../auth/auth.js"
import { initNotificationBell } from "../../components/notificationBell.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")

/* =========================================================
   State
========================================================= */
let allMatns = []
let editingMatnId = null

let allMatnProgress = []
let filteredMatnProgress = []
let editingMatnProgressId = null

let allUsers = []
let allStudents = []
let allTeachers = []
let allLevels = []
let allHalaqas = []

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

    setupMatnEvents()
    setupMatnProgressEvents()

    try {
        await loadInitialDependencies()
        await Promise.all([
            loadAdminMatns(),
            loadAdminStudentMatn()
        ])
    } catch (err) {
        console.error("Initialization error:", err)
        showError("تعذر تحميل بيانات المتون العلمية والتسميع بشكل كامل.")
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
        const [levelsData, usersData, halaqasData] = await Promise.all([
            getLevels().catch(() => []),
            getUsers().catch(() => []),
            getHalaqas().catch(() => [])
        ])

        allLevels = Array.isArray(levelsData) ? levelsData : []
        allUsers = Array.isArray(usersData) ? usersData : []
        allStudents = allUsers.filter(u => u.role === "student")
        allTeachers = allUsers.filter(u => u.role === "teacher")
        allHalaqas = Array.isArray(halaqasData) ? halaqasData : []

        populateMatnLevelOptions()
        populateAdminMatnProgressStudentOptions()
        populateAdminMatnProgressTeacherOptions()
    } catch (err) {
        console.warn("Dependencies load failed:", err)
    }
}

/* =========================================================
   1. MUTUN CATALOG MODULE
========================================================= */
async function loadAdminMatns() {
    const loading = $("admin-matn-loading")
    if (loading) {
        loading.classList.remove("hidden")
        loading.classList.add("flex")
    }

    try {
        const data = await getMatns()
        allMatns = Array.isArray(data) ? data : []

        renderAdminMatnStats()
        renderAdminMatnsTable()
        populateMatnFilterOptions()
        populateAdminMatnProgressMatnOptions()
    } catch (err) {
        console.error("Load matns error:", err)
        showError("تعذر تحميل المتون العلمية.")
    } finally {
        if (loading) {
            loading.classList.add("hidden")
            loading.classList.remove("flex")
        }
    }
}

function renderAdminMatnStats() {
    const totalMatns = allMatns.length
    let totalChapters = 0
    allMatns.forEach(m => {
        if (Array.isArray(m.chapters)) totalChapters += m.chapters.length
    })

    const totalProgress = allMatnProgress.length
    const completedProgress = allMatnProgress.filter(p => p.status === "completed" || p.status === "reviewed" || p.status === "mastered").length

    setText("admin-matn-total", totalMatns)
    setText("admin-matn-chapters-total", totalChapters)
    setText("admin-matn-progress-total", totalProgress)
    setText("admin-matn-completed-total", completedProgress)
}

function populateMatnLevelOptions() {
    const select = $("matn-level-select")
    if (!select) return
    select.innerHTML = '<option value="">بدون تقييد بمستوى معين</option>'
    allLevels.forEach(lvl => {
        const opt = document.createElement("option")
        opt.value = getId(lvl)
        opt.textContent = lvl.name
        select.appendChild(opt)
    })
}

function populateMatnFilterOptions() {
    const select = $("admin-matn-filter-matn")
    if (!select) return
    const currentVal = select.value
    select.innerHTML = '<option value="">جميع المتون</option>'
    allMatns.forEach(m => {
        const opt = document.createElement("option")
        opt.value = getId(m)
        opt.textContent = m.name
        if (currentVal && currentVal === getId(m)) opt.selected = true
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
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        if (container) container.classList.add("hidden")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")
    if (container) container.classList.remove("hidden")

    allMatns.forEach(m => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50/80 transition"

        const matnId = getId(m)
        const lvlName = m.level ? (typeof m.level === "object" ? m.level.name : "مستوى محدد") : "عام / غير محدد"
        const chaptersCount = Array.isArray(m.chapters) ? m.chapters.length : 0
        const totalVerses = Array.isArray(m.chapters) ? m.chapters.reduce((sum, c) => sum + (Number(c.versesCount) || 0), 0) : 0

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800 text-sm">${escapeHTML(m.name)}</div>
                ${m.description ? `<div class="text-xs text-slate-400 mt-0.5 line-clamp-1">${escapeHTML(m.description)}</div>` : ''}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    ${escapeHTML(lvlName)}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-bold text-slate-700">${chaptersCount} باب / فصل</div>
                ${totalVerses > 0 ? `<div class="text-[11px] text-slate-400">${totalVerses} بيت / شطر</div>` : ''}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded-full ${m.isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"} px-2.5 py-0.5 text-[11px] font-semibold">
                    ${m.isActive !== false ? "معتمد ونشط" : "غير نشط"}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        type="button"
                        data-action="edit-matn"
                        data-id="${matnId}"
                        class="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition"
                        title="تعديل المتن">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        data-action="delete-matn"
                        data-id="${matnId}"
                        class="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition"
                        title="حذف المتن">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `

        tbody.appendChild(tr)
    })

    // Bind action buttons
    tbody.querySelectorAll("button[data-action=edit-matn]").forEach(btn => {
        btn.addEventListener("click", () => openMatnModal(btn.dataset.id))
    })

    tbody.querySelectorAll("button[data-action=delete-matn]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id
            const m = allMatns.find(item => getId(item) === id)
            openGenericDeleteModal({
                title: "حذف المتن العلمي",
                message: `هل أنت متأكد من حذف المتن "${m?.name || ""}"؟ سيتم حذف جميع الفصول وسجلات التسميع المرتبطة به.`,
                onConfirm: async () => {
                    await deleteMatn(id)
                    await loadAdminMatns()
                    await loadAdminStudentMatn()
                }
            })
        })
    })
}

function setupMatnEvents() {
    $("btn-admin-add-matn")?.addEventListener("click", () => openMatnModal(null))
    $("btn-close-matn-modal")?.addEventListener("click", closeMatnModal)
    $("btn-cancel-matn-modal")?.addEventListener("click", closeMatnModal)

    $("btn-add-matn-chapter-row")?.addEventListener("click", () => addMatnChapterRow())
    $("admin-matn-form")?.addEventListener("submit", handleSaveMatn)
}

function openMatnModal(matnId = null) {
    editingMatnId = matnId
    const modal = $("modal-admin-matn")
    const form = $("admin-matn-form")
    const chaptersContainer = $("matn-chapters-list")
    const errBox = $("admin-matn-error")
    if (errBox) errBox.classList.add("hidden")

    if (form) form.reset()
    if (chaptersContainer) chaptersContainer.innerHTML = ""

    if (matnId) {
        setText("modal-matn-title", "تعديل المتن العلمي")
        const m = allMatns.find(item => getId(item) === matnId)
        if (m) {
            $("matn-id").value = matnId
            $("matn-name").value = m.name || ""
            $("matn-level-select").value = getId(m.level) || ""
            $("matn-desc").value = m.description || ""
            $("matn-is-active").checked = m.isActive !== false

            if (Array.isArray(m.chapters) && m.chapters.length > 0) {
                m.chapters.forEach(c => addMatnChapterRow(c.name || c.title || "", c.versesCount || 0, c.order))
            } else {
                addMatnChapterRow("مقدمة المتن", 10, 1)
            }
        }
    } else {
        setText("modal-matn-title", "إضافة متن علمي جديد")
        $("matn-id").value = ""
        $("matn-is-active").checked = true
        addMatnChapterRow("مقدمة الناظم", 10, 1)
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
    const container = $("matn-chapters-list")
    if (!container) return

    const currentCount = container.children.length
    const rowOrder = order || currentCount + 1

    const row = document.createElement("div")
    row.className = "flex items-center gap-2"
    row.innerHTML = `
        <input type="number" min="1" value="${rowOrder}" class="w-14 rounded-lg border border-slate-200 p-1.5 text-center text-xs focus:border-emerald-600 focus:outline-none" title="الترتيب" data-chapter-order>
        <input type="text" value="${escapeHTML(title)}" placeholder="عنوان الباب أو الفصل..." class="flex-1 rounded-lg border border-slate-200 p-1.5 text-xs focus:border-emerald-600 focus:outline-none" required data-chapter-title>
        <input type="number" min="0" value="${verses}" placeholder="الأبيات" class="w-16 rounded-lg border border-slate-200 p-1.5 text-center text-xs focus:border-emerald-600 focus:outline-none" title="عدد الأبيات" data-chapter-verses>
        <button type="button" class="text-red-500 hover:text-red-700 px-1 text-sm font-bold" title="حذف الباب">×</button>
    `

    row.querySelector("button").addEventListener("click", () => row.remove())
    container.appendChild(row)
}

async function handleSaveMatn(e) {
    e.preventDefault()
    const submitBtn = $("btn-submit-matn")
    const errBox = $("admin-matn-error")
    if (errBox) errBox.classList.add("hidden")

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."

    try {
        const name = $("matn-name")?.value.trim()
        const level = $("matn-level-select")?.value || null
        const description = $("matn-desc")?.value.trim() || ""
        const isActive = $("matn-is-active")?.checked

        if (!name) throw new Error("يرجى إدخال اسم المتن.")

        // Collect chapters
        const chapterRows = $("matn-chapters-list")?.children || []
        const chapters = []
        for (let row of chapterRows) {
            const titleInput = row.querySelector("[data-chapter-title]")
            const orderInput = row.querySelector("[data-chapter-order]")
            const versesInput = row.querySelector("[data-chapter-verses]")
            if (titleInput && titleInput.value.trim()) {
                chapters.push({
                    name: titleInput.value.trim(),
                    order: Number(orderInput?.value) || chapters.length + 1,
                    versesCount: Number(versesInput?.value) || 0
                })
            }
        }

        const payload = {
            name,
            level,
            description,
            isActive,
            chapters
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
   2. STUDENT MATN PROGRESS TRACKING MODULE
========================================================= */
async function loadAdminStudentMatn() {
    try {
        const data = await getMatnProgress()
        allMatnProgress = Array.isArray(data) ? data : []
        filteredMatnProgress = [...allMatnProgress]

        renderAdminMatnStats()
        filterAdminStudentMatn()
    } catch (err) {
        console.warn("Load student matn progress error:", err)
    }
}

function filterAdminStudentMatn() {
    const search = ($("admin-matn-student-search")?.value || "").trim().toLowerCase()
    const matnFilter = $("admin-matn-filter-matn")?.value || ""
    const statusFilter = $("admin-matn-filter-status")?.value || ""

    filteredMatnProgress = allMatnProgress.filter(p => {
        const studentName = getStudentName(p.student).toLowerCase()
        const matnName = (p.matn?.name || "").toLowerCase()

        const matchSearch = !search || studentName.includes(search) || matnName.includes(search)
        const matchMatn = !matnFilter || getId(p.matn) === matnFilter
        const matchStatus = !statusFilter || p.status === statusFilter

        return matchSearch && matchMatn && matchStatus
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
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        if (container) container.classList.add("hidden")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")
    if (container) container.classList.remove("hidden")

    filteredMatnProgress.forEach(item => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50/80 transition"

        const progressId = getId(item)
        const matnTitle = item.matn?.name || "متن علمي"
        const sectionName = item.section || item.chapterName || "الباب المقرر"

        const statusBadges = {
            in_progress: { label: "قيد الحفظ", cls: "bg-amber-50 text-amber-700" },
            completed: { label: "متمم للباب", cls: "bg-blue-50 text-blue-700" },
            reviewed: { label: "مراجع ومتقن", cls: "bg-purple-50 text-purple-700" },
            mastered: { label: "متقن ومجاز", cls: "bg-emerald-100 text-emerald-800" }
        }
        const statusMeta = statusBadges[item.status] || { label: item.status || "—", cls: "bg-slate-100 text-slate-600" }

        const percentage = Number(item.completionPercentage) || 0

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800">${escapeHTML(getStudentName(item.student))}</div>
                <div class="text-xs text-slate-400">${escapeHTML(getHalaqaName(item.student?.halaqa))}</div>
            </td>
            <td class="px-6 py-4">
                <div class="font-semibold text-slate-700 text-xs">${escapeHTML(matnTitle)}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">${escapeHTML(sectionName)}</div>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <div class="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-emerald-600 h-1.5 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                    <span class="text-xs font-bold text-slate-700">${percentage}%</span>
                </div>
                ${item.masteryGrade ? `<div class="text-[11px] text-emerald-700 font-bold mt-0.5">درجة الإتقان: ${item.masteryGrade} / 10</div>` : ''}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2.5 py-0.5 text-xs font-semibold ${statusMeta.cls}">
                    ${statusMeta.label}
                </span>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500">
                ${formatDate(item.recitationDate || item.date || item.createdAt)}
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${escapeHTML(getTeacherName(item.teacher))}
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        type="button"
                        data-action="edit-progress"
                        data-id="${progressId}"
                        class="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition"
                        title="تعديل السجل">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        data-action="delete-progress"
                        data-id="${progressId}"
                        class="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition"
                        title="حذف السجل">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `

        tbody.appendChild(tr)
    })

    // Bind action buttons
    tbody.querySelectorAll("button[data-action=edit-progress]").forEach(btn => {
        btn.addEventListener("click", () => openAdminMatnProgressModal(btn.dataset.id))
    })

    tbody.querySelectorAll("button[data-action=delete-progress]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id
            openGenericDeleteModal({
                title: "حذف سجل التسميع",
                message: "هل أنت متأكد من حذف هذا السجل من سجلات تسميع الطالب؟",
                onConfirm: async () => {
                    await deleteStudentMatnProgress(id)
                    await loadAdminStudentMatn()
                }
            })
        })
    })
}

function setupMatnProgressEvents() {
    $("admin-matn-student-search")?.addEventListener("input", filterAdminStudentMatn)
    $("admin-matn-filter-matn")?.addEventListener("change", filterAdminStudentMatn)
    $("admin-matn-filter-status")?.addEventListener("change", filterAdminStudentMatn)

    $("btn-admin-add-matn-progress")?.addEventListener("click", () => openAdminMatnProgressModal(null))
    $("btn-close-matn-progress-modal")?.addEventListener("click", closeAdminMatnProgressModal)
    $("btn-cancel-matn-progress-modal")?.addEventListener("click", closeAdminMatnProgressModal)

    $("modal-progress-matn")?.addEventListener("change", handleMatnSelectChange)
    $("admin-matn-progress-form")?.addEventListener("submit", handleSaveAdminMatnProgress)
}

function handleMatnSelectChange(e) {
    const matnId = e.target.value
    const sectionInput = $("modal-progress-section")
    if (!sectionInput || !matnId) return

    const matn = allMatns.find(m => getId(m) === matnId)
    if (matn && Array.isArray(matn.chapters) && matn.chapters.length > 0) {
        sectionInput.placeholder = `مثال: ${matn.chapters[0].name || "الباب الأول"}`
    }
}

function populateAdminMatnProgressStudentOptions() {
    const select = $("modal-progress-student")
    if (!select) return
    select.innerHTML = '<option value="">اختر الطالب من القائمة...</option>'
    allStudents.forEach(st => {
        const opt = document.createElement("option")
        opt.value = getId(st)
        opt.textContent = `${getStudentName(st)} (${getHalaqaName(st.halaqa)})`
        select.appendChild(opt)
    })
}

function populateAdminMatnProgressMatnOptions() {
    const select = $("modal-progress-matn")
    if (!select) return
    select.innerHTML = '<option value="">اختر المتن العلمي...</option>'
    allMatns.forEach(m => {
        const opt = document.createElement("option")
        opt.value = getId(m)
        opt.textContent = m.name
        select.appendChild(opt)
    })
}

function populateAdminMatnProgressTeacherOptions() {
    const select = $("modal-progress-teacher")
    if (!select) return
    select.innerHTML = '<option value="">إدارة المدرسة (تسميع مباشر مع الإدارة)</option>'
    allTeachers.forEach(t => {
        const opt = document.createElement("option")
        opt.value = getId(t)
        opt.textContent = `${getStudentName(t)} (أستاذ)`
        select.appendChild(opt)
    })
}

function openAdminMatnProgressModal(progressId = null) {
    editingMatnProgressId = progressId
    const modal = $("modal-admin-matn-progress")
    const form = $("admin-matn-progress-form")
    const errBox = $("admin-matn-progress-error")
    if (errBox) errBox.classList.add("hidden")

    if (form) form.reset()

    if (progressId) {
        setText("modal-matn-progress-title", "تعديل سجل تسميع متن")
        const record = allMatnProgress.find(p => getId(p) === progressId)
        if (record) {
            $("matn-progress-id").value = progressId
            $("modal-progress-student").value = getId(record.student) || ""
            $("modal-progress-matn").value = getId(record.matn) || ""
            $("modal-progress-section").value = record.section || record.chapterName || ""
            $("modal-progress-percentage").value = record.completionPercentage || 0
            $("modal-progress-status").value = record.status || "in_progress"
            $("modal-progress-grade").value = record.masteryGrade || ""
            $("modal-progress-date").value = record.recitationDate ? record.recitationDate.substring(0, 10) : new Date().toISOString().substring(0, 10)
            $("modal-progress-teacher").value = getId(record.teacher) || ""
            $("modal-progress-notes").value = record.notes || ""
        }
    } else {
        setText("modal-matn-progress-title", "تسجيل تسميع متن لطالب")
        $("matn-progress-id").value = ""
        $("modal-progress-percentage").value = 25
        $("modal-progress-status").value = "in_progress"
        $("modal-progress-date").value = new Date().toISOString().substring(0, 10)
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
    const submitBtn = $("btn-submit-matn-progress")
    const errBox = $("admin-matn-progress-error")
    if (errBox) errBox.classList.add("hidden")

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."

    try {
        const student = $("modal-progress-student")?.value
        const matn = $("modal-progress-matn")?.value
        const section = $("modal-progress-section")?.value.trim() || ""
        const completionPercentage = Number($("modal-progress-percentage")?.value) || 0
        const status = $("modal-progress-status")?.value
        const masteryGrade = $("modal-progress-grade")?.value.trim() || null
        const recitationDate = $("modal-progress-date")?.value || new Date().toISOString()
        const teacher = $("modal-progress-teacher")?.value || null
        const notes = $("modal-progress-notes")?.value.trim() || ""

        if (!student) throw new Error("يرجى اختيار الطالب.")
        if (!matn) throw new Error("يرجى اختيار المتن العلمي.")

        const payload = {
            student,
            matn,
            section,
            completionPercentage,
            status,
            masteryGrade,
            recitationDate,
            teacher,
            notes
        }

        if (editingMatnProgressId) {
            await updateStudentMatnProgress(editingMatnProgressId, payload)
        } else {
            await createStudentMatnProgress(payload)
        }

        closeAdminMatnProgressModal()
        await loadAdminStudentMatn()
    } catch (error) {
        console.error("Save matn progress error:", error)
        showModalError(errBox, error.message || "تعذر حفظ سجل التسميع.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ السجل"
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
    const el = $("matn-error")
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

