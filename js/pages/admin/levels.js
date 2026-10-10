import {
    getLevels,
    getLevelById,
    createLevel,
    updateLevel,
    deleteLevel,
    getStudentsByLevel,
    assignStudentLevel,
    getStudentLevelHistory
} from "../../api/levelsApi.js"

import { getUsers } from "../../api/usersApi.js"
import { getHalaqas } from "../../api/halaqaApi.js"
import { getExams } from "../../api/examsApi.js"
import { getUser, protectPage, logout } from "../../auth/auth.js"
import { initNotificationBell } from "../../components/notificationBell.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")

/* =========================================================
   State
========================================================= */
let allLevels = []
let editingLevelId = null

let allUsers = []
let allStudents = []
let filteredStudents = []
let allHalaqas = []
let allExams = []

let allLevelPromotions = []
let filteredLevelPromotions = []

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

    setupLevelsEvents()
    setupPromoteEvents()

    try {
        await loadInitialDependencies()
        await Promise.all([
            loadAdminLevels(),
            loadAdminStudents(),
            loadAdminPromotions()
        ])
    } catch (err) {
        console.error("Initialization error:", err)
        showError("تعذر تحميل بيانات المستويات والترقيات بشكل كامل.")
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
        const [usersData, halaqasData, examsData] = await Promise.all([
            getUsers().catch(() => []),
            getHalaqas().catch(() => []),
            getExams().catch(() => [])
        ])

        allUsers = Array.isArray(usersData) ? usersData : []
        allStudents = allUsers.filter(u => u.role === "student")
        filteredStudents = [...allStudents]

        allHalaqas = Array.isArray(halaqasData) ? halaqasData : []
        allExams = Array.isArray(examsData) ? examsData : []

        populateExamSelectOptions()
    } catch (err) {
        console.warn("Dependencies load failed:", err)
    }
}

/* =========================================================
   1. LEVELS MODULE
========================================================= */
async function loadAdminLevels() {
    const loading = $("admin-levels-loading")
    if (loading) {
        loading.classList.remove("hidden")
        loading.classList.add("flex")
    }

    try {
        const data = await getLevels()
        allLevels = Array.isArray(data) ? data : []
        allLevels.sort((a, b) => (a.order || 0) - (b.order || 0))

        renderAdminLevelsStats()
        renderAdminLevelsTable()
        populateLevelDropdowns()
    } catch (err) {
        console.error("Load levels error:", err)
        showError("تعذر تحميل المستويات التعليمية.")
    } finally {
        if (loading) {
            loading.classList.add("hidden")
            loading.classList.remove("flex")
        }
    }
}

function renderAdminLevelsStats() {
    const totalLevels = allLevels.length
    const studentsWithLevel = allStudents.filter(s => s.currentLevel).length
    const totalPromotions = allLevelPromotions.length

    // Eligible students: students who have a level and can advance to the next level
    const eligibleCount = allStudents.filter(s => {
        if (!s.currentLevel) return false
        const lvlId = getId(s.currentLevel)
        const currentLvl = allLevels.find(l => getId(l) === lvlId)
        return currentLvl && (currentLvl.nextLevel || allLevels.some(nl => (nl.order || 0) > (currentLvl.order || 0)))
    }).length

    setText("admin-levels-total", totalLevels)
    setText("admin-levels-students-total", studentsWithLevel)
    setText("admin-levels-promotions-total", totalPromotions)
    setText("admin-levels-eligible-total", eligibleCount)
}

function renderAdminLevelsTable() {
    const tbody = $("admin-levels-table-body")
    const empty = $("admin-levels-empty")
    const container = $("admin-levels-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (allLevels.length === 0) {
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        if (container) container.classList.add("hidden")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")
    if (container) container.classList.remove("hidden")

    allLevels.forEach((lvl, idx) => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50/80 transition"

        const lvlId = getId(lvl)
        const nextLvl = lvl.nextLevel ? (typeof lvl.nextLevel === "object" ? lvl.nextLevel.name : "مستوى تالٍ") : "—"

        // Count students in this level
        const countInLevel = allStudents.filter(s => getId(s.currentLevel) === lvlId).length

        tr.innerHTML = `
            <td class="px-6 py-4 font-bold text-slate-700">
                <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-800">
                    ${lvl.order || idx + 1}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-slate-800 text-sm">${escapeHTML(lvl.name)}</div>
                ${lvl.description ? `<div class="text-xs text-slate-400 mt-0.5 line-clamp-1">${escapeHTML(lvl.description)}</div>` : ''}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-bold text-emerald-700">${lvl.passingScore !== undefined ? lvl.passingScore : 60}%</div>
                <div class="text-[11px] text-slate-400">${lvl.requiredExamsCount || 1} امتحان مطلوب</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs text-slate-600 line-clamp-1 max-w-xs">
                    ${escapeHTML(lvl.requirements || "حفظ القرآن والمتون المقررة")}
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2 py-0.5 text-xs font-semibold ${lvl.autoPromoteOnPass ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}">
                    ${lvl.autoPromoteOnPass ? "ترقية تلقائية" : "يدوي"}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <span class="inline-block rounded-full ${lvl.isActive !== false ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"} px-2.5 py-0.5 text-[11px] font-semibold">
                        ${lvl.isActive !== false ? "نشط" : "معطل"}
                    </span>
                    <span class="text-xs text-slate-400 font-medium">${countInLevel} طالب</span>
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button
                        type="button"
                        data-action="edit-level"
                        data-id="${lvlId}"
                        class="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition"
                        title="تعديل المستوى">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        data-action="delete-level"
                        data-id="${lvlId}"
                        class="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition"
                        title="حذف المستوى">
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
    tbody.querySelectorAll("button[data-action=edit-level]").forEach(btn => {
        btn.addEventListener("click", () => openLevelModal(btn.dataset.id))
    })

    tbody.querySelectorAll("button[data-action=delete-level]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id
            const lvl = allLevels.find(l => getId(l) === id)
            openGenericDeleteModal({
                title: "حذف المستوى التعليمي",
                message: `هل أنت متأكد من حذف المستوى "${lvl?.name || ""}"؟ لا يمكن الحذف إذا كان هناك طلاب مسجلون به.`,
                onConfirm: async () => {
                    await deleteLevel(id)
                    await loadAdminLevels()
                    await loadAdminStudents()
                }
            })
        })
    })
}

function setupLevelsEvents() {
    $("btn-admin-add-level")?.addEventListener("click", () => openLevelModal(null))
    $("btn-close-level-modal")?.addEventListener("click", closeLevelModal)
    $("btn-cancel-level-modal")?.addEventListener("click", closeLevelModal)

    $("admin-level-form")?.addEventListener("submit", handleSaveLevel)
}

function openLevelModal(levelId = null) {
    editingLevelId = levelId
    const modal = $("modal-admin-level")
    const form = $("admin-level-form")
    const errBox = $("admin-level-error")
    if (errBox) errBox.classList.add("hidden")

    if (form) form.reset()

    if (levelId) {
        setText("modal-level-title", "تعديل المستوى التعليمي")
        const lvl = allLevels.find(l => getId(l) === levelId)
        if (lvl) {
            $("level-id").value = levelId
            $("level-name").value = lvl.name || ""
            $("level-order").value = lvl.order || 1
            $("level-passing-score").value = lvl.passingScore !== undefined ? lvl.passingScore : 60
            $("level-required-exams").value = lvl.requiredExamsCount || 1
            $("level-requirements").value = lvl.requirements || ""
            $("level-desc").value = lvl.description || ""
            $("level-auto-promote").checked = Boolean(lvl.autoPromoteOnPass)
            $("level-is-active").checked = lvl.isActive !== false
        }
    } else {
        setText("modal-level-title", "إضافة مستوى تعليمي جديد")
        $("level-id").value = ""
        $("level-order").value = allLevels.length + 1
        $("level-passing-score").value = 60
        $("level-required-exams").value = 1
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
    const submitBtn = $("btn-submit-level")
    const errBox = $("admin-level-error")
    if (errBox) errBox.classList.add("hidden")

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."

    try {
        const name = $("level-name")?.value.trim()
        const order = Number($("level-order")?.value) || 1
        const passingScore = Number($("level-passing-score")?.value) || 60
        const requiredExamsCount = Number($("level-required-exams")?.value) || 1
        const requirements = $("level-requirements")?.value.trim() || ""
        const description = $("level-desc")?.value.trim() || ""
        const autoPromoteOnPass = $("level-auto-promote")?.checked
        const isActive = $("level-is-active")?.checked

        if (!name) throw new Error("يرجى إدخال اسم المستوى.")

        const payload = {
            name,
            order,
            passingScore,
            requiredExamsCount,
            requirements,
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
        await loadAdminStudents()
    } catch (error) {
        console.error("Save level error:", error)
        showModalError(errBox, error.message || "تعذر حفظ المستوى التعليمي.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ المستوى"
    }
}

/* =========================================================
   2. STUDENTS CURRENT LEVELS & ELIGIBILITY MODULE
========================================================= */
async function loadAdminStudents() {
    try {
        const users = await getUsers()
        if (Array.isArray(users)) {
            allUsers = users
            allStudents = allUsers.filter(u => u.role === "student")
            filteredStudents = [...allStudents]
        }
        filterAdminStudents()
    } catch (err) {
        console.warn("Load students error:", err)
    }
}

function filterAdminStudents() {
    const search = ($("admin-students-search")?.value || "").trim().toLowerCase()
    const levelFilter = $("admin-students-level-filter")?.value || ""
    const eligibilityFilter = $("admin-students-eligibility-filter")?.value || ""

    filteredStudents = allStudents.filter(s => {
        const studentName = (s.name || `${s.firstName || ""} ${s.lastName || ""}`).toLowerCase()
        const halaqaName = getHalaqaName(s.halaqa).toLowerCase()
        const matchSearch = !search || studentName.includes(search) || halaqaName.includes(search)

        const studentLevelId = getId(s.currentLevel)
        const matchLevel = !levelFilter || studentLevelId === levelFilter

        let matchElig = true
        if (eligibilityFilter === "eligible") {
            matchElig = Boolean(studentLevelId) // Has current level to advance from
        } else if (eligibilityFilter === "assigned") {
            matchElig = Boolean(studentLevelId)
        } else if (eligibilityFilter === "unassigned") {
            matchElig = !studentLevelId
        }

        return matchSearch && matchLevel && matchElig
    })

    renderAdminStudentsTable()
}

function renderAdminStudentsTable() {
    const tbody = $("admin-students-table-body")
    const empty = $("admin-students-empty")
    const container = $("admin-students-table-container")

    if (!tbody) return
    tbody.innerHTML = ""

    if (filteredStudents.length === 0) {
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        if (container) container.classList.add("hidden")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")
    if (container) container.classList.remove("hidden")

    filteredStudents.forEach(st => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50/80 transition"

        const stId = getId(st)
        const currentLvlId = getId(st.currentLevel)
        const currentLvl = allLevels.find(l => getId(l) === currentLvlId)
        const currentLvlName = currentLvl ? currentLvl.name : (st.currentLevel?.name || "غير محدد")

        // Find next level by order
        let nextLvl = null
        if (currentLvl) {
            nextLvl = allLevels.find(l => (l.order || 0) > (currentLvl.order || 0))
        } else if (allLevels.length > 0) {
            nextLvl = allLevels[0]
        }

        const isEligible = Boolean(currentLvl)

        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-800">
                ${escapeHTML(getStudentName(st))}
            </td>
            <td class="px-6 py-4 text-xs text-slate-600">
                ${escapeHTML(getHalaqaName(st.halaqa))}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded-lg ${currentLvl ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-slate-100 text-slate-400"} px-2.5 py-1 text-xs">
                    ${escapeHTML(currentLvlName)}
                </span>
            </td>
            <td class="px-6 py-4 text-xs font-medium text-slate-600">
                ${nextLvl ? escapeHTML(nextLvl.name) : "أعلى مستوى"}
            </td>
            <td class="px-6 py-4">
                <span class="inline-block rounded px-2 py-0.5 text-xs font-semibold ${isEligible ? "bg-purple-50 text-purple-700" : "bg-amber-50 text-amber-700"}">
                    ${isEligible ? "مؤهل للترقية" : "بانتظار التعيين"}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                <button
                    type="button"
                    data-action="promote-student"
                    data-student-id="${stId}"
                    class="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-800 transition">
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>ترقية المستوى</span>
                </button>
            </td>
        `

        tbody.appendChild(tr)
    })

    tbody.querySelectorAll("button[data-action=promote-student]").forEach(btn => {
        btn.addEventListener("click", () => {
            const stId = btn.dataset.studentId
            openPromoteModal(stId)
        })
    })
}

/* =========================================================
   3. PROMOTION MODAL & ASSIGNMENT
========================================================= */
function setupPromoteEvents() {
    $("admin-students-search")?.addEventListener("input", filterAdminStudents)
    $("admin-students-level-filter")?.addEventListener("change", filterAdminStudents)
    $("admin-students-eligibility-filter")?.addEventListener("change", filterAdminStudents)

    $("btn-admin-promote-student-direct")?.addEventListener("click", () => openPromoteModal(null))
    $("btn-close-promote-modal")?.addEventListener("click", closePromoteModal)
    $("btn-cancel-promote-modal")?.addEventListener("click", closePromoteModal)

    $("promote-student-select")?.addEventListener("change", handlePromoteStudentChange)
    $("admin-promote-form")?.addEventListener("submit", handleSavePromotion)

    $("admin-promotions-search")?.addEventListener("input", filterAdminPromotions)
}

function populateLevelDropdowns() {
    // 1. Filter dropdown
    const filterSelect = $("admin-students-level-filter")
    if (filterSelect) {
        const val = filterSelect.value
        filterSelect.innerHTML = '<option value="">جميع المستويات</option>'
        allLevels.forEach(lvl => {
            const opt = document.createElement("option")
            opt.value = getId(lvl)
            opt.textContent = lvl.name
            if (val === getId(lvl)) opt.selected = true
            filterSelect.appendChild(opt)
        })
    }

    // 2. Promotion modal target level dropdown
    const newLvlSelect = $("promote-new-level-select")
    if (newLvlSelect) {
        newLvlSelect.innerHTML = '<option value="">اختر المستوى الجديد...</option>'
        allLevels.forEach(lvl => {
            const opt = document.createElement("option")
            opt.value = getId(lvl)
            opt.textContent = `${lvl.order || 1}. ${lvl.name}`
            newLvlSelect.appendChild(opt)
        })
    }
}

function populateExamSelectOptions() {
    const examSelect = $("promote-exam-select")
    if (!examSelect) return
    examSelect.innerHTML = '<option value="">بدون ربط بامتحان معين</option>'
    allExams.forEach(e => {
        const opt = document.createElement("option")
        opt.value = getId(e)
        opt.textContent = e.title
        examSelect.appendChild(opt)
    })
}

function populateStudentPromoteOptions(selectedStudentId = null) {
    const select = $("promote-student-select")
    if (!select) return
    select.innerHTML = '<option value="">اختر الطالب من القائمة...</option>'

    allStudents.forEach(st => {
        const opt = document.createElement("option")
        opt.value = getId(st)
        opt.textContent = `${getStudentName(st)} (${getHalaqaName(st.halaqa)})`
        if (selectedStudentId && selectedStudentId === getId(st)) opt.selected = true
        select.appendChild(opt)
    })
}

function handlePromoteStudentChange() {
    const stId = $("promote-student-select")?.value
    const display = $("promote-current-level-display")
    const newLvlSelect = $("promote-new-level-select")

    if (!stId) {
        if (display) display.textContent = "غير محدد"
        return
    }

    const student = allStudents.find(s => getId(s) === stId)
    if (!student) return

    const currentLvlId = getId(student.currentLevel)
    const currentLvl = allLevels.find(l => getId(l) === currentLvlId)

    if (display) {
        display.textContent = currentLvl ? currentLvl.name : (student.currentLevel?.name || "غير محدد حالياً")
    }

    // Auto-select next level
    if (newLvlSelect && currentLvl) {
        const nextLvl = allLevels.find(l => (l.order || 0) > (currentLvl.order || 0))
        if (nextLvl) {
            newLvlSelect.value = getId(nextLvl)
        }
    } else if (newLvlSelect && allLevels.length > 0) {
        newLvlSelect.value = getId(allLevels[0])
    }
}

function openPromoteModal(studentId = null) {
    const modal = $("modal-admin-promote-student")
    const form = $("admin-promote-form")
    const errBox = $("admin-promote-error")
    if (errBox) errBox.classList.add("hidden")

    if (form) form.reset()

    populateStudentPromoteOptions(studentId)
    if (studentId) {
        handlePromoteStudentChange()
    } else {
        setText("promote-current-level-display", "اختر طالباً لعرض مستواه الحالي")
    }

    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}

function closePromoteModal() {
    const modal = $("modal-admin-promote-student")
    if (modal) {
        modal.classList.add("hidden")
        modal.classList.remove("flex")
    }
}

async function handleSavePromotion(e) {
    e.preventDefault()
    const submitBtn = $("btn-submit-promote")
    const errBox = $("admin-promote-error")
    if (errBox) errBox.classList.add("hidden")

    submitBtn.disabled = true
    submitBtn.textContent = "جاري تنفيذ الترقية..."

    try {
        const studentId = $("promote-student-select")?.value
        const newLevelId = $("promote-new-level-select")?.value
        const reason = $("promote-reason-select")?.value
        const examId = $("promote-exam-select")?.value || null
        const notes = $("promote-notes")?.value.trim() || ""

        if (!studentId) throw new Error("يرجى اختيار الطالب.")
        if (!newLevelId) throw new Error("يرجى اختيار المستوى الجديد.")

        await assignStudentLevel({
            studentId,
            newLevelId,
            reason,
            notes,
            examId
        })

        closePromoteModal()
        await Promise.all([
            loadAdminStudents(),
            loadAdminPromotions(),
            loadAdminLevels()
        ])
    } catch (err) {
        console.error("Promote student error:", err)
        showModalError(errBox, err.message || "تعذر إتمام ترقية الطالب.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "تأكيد ترقية الطالب"
    }
}

/* =========================================================
   4. PROMOTIONS HISTORY MODULE
========================================================= */
async function loadAdminPromotions() {
    try {
        const promotionsData = await getStudentLevelHistory("all")
        allLevelPromotions = Array.isArray(promotionsData) ? promotionsData : []
        filteredLevelPromotions = [...allLevelPromotions]

        renderAdminPromotionsStats()
        renderAdminPromotionsTable()
    } catch (err) {
        console.warn("Load promotions history error:", err)
    }
}

function renderAdminPromotionsStats() {
    setText("admin-levels-promotions-total", allLevelPromotions.length)
}

function filterAdminPromotions() {
    const search = ($("admin-promotions-search")?.value || "").trim().toLowerCase()
    filteredLevelPromotions = allLevelPromotions.filter(p => {
        const name = getStudentName(p.student).toLowerCase()
        return !search || name.includes(search)
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
        if (empty) empty.classList.remove("hidden"), empty.classList.add("flex")
        if (container) container.classList.add("hidden")
        return
    }

    if (empty) empty.classList.add("hidden"), empty.classList.remove("flex")
    if (container) container.classList.remove("hidden")

    filteredLevelPromotions.forEach(item => {
        const tr = document.createElement("tr")
        tr.className = "hover:bg-slate-50/80 transition"

        const prevName = item.previousLevel?.name || "المستوى الأولي"
        const newName = item.newLevel?.name || "مستوى جديد"
        const changedByName = getTeacherName(item.changedBy)

        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-slate-800">
                ${escapeHTML(getStudentName(item.student))}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2 text-xs">
                    <span class="rounded bg-slate-100 px-2 py-0.5 text-slate-600">${escapeHTML(prevName)}</span>
                    <span class="text-slate-400">←</span>
                    <span class="rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">${escapeHTML(newName)}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-xs text-slate-500">
                ${formatDate(item.changeDate || item.createdAt)}
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-semibold text-slate-700">${escapeHTML(item.reason || "اجتياز اختبار")}</div>
                ${item.exam?.title ? `<div class="text-[11px] text-slate-400 mt-0.5">امتحان: ${escapeHTML(item.exam.title)}</div>` : ''}
                ${item.notes ? `<div class="text-[11px] text-slate-400 mt-0.5 italic">ملاحظة: ${escapeHTML(item.notes)}</div>` : ''}
            </td>
            <td class="px-6 py-4 text-xs text-slate-600 font-medium">
                ${escapeHTML(changedByName)}
            </td>
        `

        tbody.appendChild(tr)
    })
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
    if (!teacher) return "الإدارة"
    if (typeof teacher === "string") {
        if (/^[0-9a-fA-F]{24}$/.test(teacher)) return "المعلم المشرف"
        return teacher
    }
    if (typeof teacher === "object") {
        return teacher.name || `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "المعلم المشرف"
    }
    return "الإدارة"
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
    const el = $("levels-error")
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

