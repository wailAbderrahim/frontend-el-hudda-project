import {
    getAnnouncements,
    getAnnouncementById,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
} from "../../api/announcementsApi.js"

import { getUser, protectPage } from "../../auth/auth.js"

/* =========================================================
   Protection
========================================================= */
protectPage("admin")


/* =========================================================
   State
========================================================= */
let allAnnouncements = []
let filteredAnnouncements = []

let selectedAnnouncement = null
let announcementToDeleteId = null


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

    await loadAnnouncements()
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
async function loadAnnouncements() {
    showLoading(true)
    hideError()

    try {
        const data = await getAnnouncements()
        allAnnouncements = Array.isArray(data) ? data : []
        filteredAnnouncements = [...allAnnouncements]

        renderStatistics()
        renderAnnouncements()
    } catch (error) {
        console.error("Load announcements error:", error)
        showError(error.message || "تعذر تحميل الإعلانات. يرجى المحاولة مرة أخرى.")
    } finally {
        showLoading(false)
    }
}


/* =========================================================
   Statistics
========================================================= */
function renderStatistics() {
    const total = allAnnouncements.length
    const now = new Date()

    let active = 0
    let inactive = 0
    let expired = 0

    allAnnouncements.forEach(item => {
        const isExp = item.expiresAt && new Date(item.expiresAt) < now

        if (isExp) {
            expired++
        }

        if (item.isActive && !isExp) {
            active++
        } else if (!item.isActive) {
            inactive++
        }
    })

    setText("total-announcements-count", total)
    setText("active-announcements-count", active)
    setText("inactive-announcements-count", inactive)
    setText("expired-announcements-count", expired)
}


/* =========================================================
   Filtering
========================================================= */
function filterAnnouncements() {
    const searchQuery = ($("announcements-search")?.value || "").trim().toLowerCase()
    const statusFilter = $("announcements-status-filter")?.value || ""

    filteredAnnouncements = allAnnouncements.filter(item => {
        const title = (item.title || "").toLowerCase()
        const content = (item.content || "").toLowerCase()

        const matchesSearch = !searchQuery ||
            title.includes(searchQuery) ||
            content.includes(searchQuery)

        let matchesStatus = true
        if (statusFilter === "active") {
            matchesStatus = item.isActive === true
        } else if (statusFilter === "inactive") {
            matchesStatus = item.isActive === false
        }

        return matchesSearch && matchesStatus
    })

    renderAnnouncements()
}


/* =========================================================
   Render Table
========================================================= */
function renderAnnouncements() {
    const tbody = $("announcements-table-body")
    const emptyState = $("announcements-empty")
    const tableContainer = $("announcements-table-container")

    if (!tbody) return

    tbody.innerHTML = ""
    setText("filtered-announcements-count", filteredAnnouncements.length)

    if (filteredAnnouncements.length === 0) {
        if (tableContainer) tableContainer.classList.add("hidden")
        if (emptyState) emptyState.classList.remove("hidden")
        return
    }

    if (tableContainer) tableContainer.classList.remove("hidden")
    if (emptyState) emptyState.classList.add("hidden")

    filteredAnnouncements.forEach(announcement => {
        const tr = document.createElement("tr")
        tr.className = "transition hover:bg-slate-50 border-b border-slate-100 last:border-0"

        const authorName = announcement.createdBy?.name || "الإدارة"
        const dateStr = formatDate(announcement.createdAt)
        const expiresStr = announcement.expiresAt ? formatDate(announcement.expiresAt) : "دائم"
        const statusInfo = getAnnouncementStatusInfo(announcement)
        const contentPreview = (announcement.content || "").slice(0, 60) + ((announcement.content || "").length > 60 ? "..." : "")

        tr.innerHTML = `
            <td class="px-6 py-4 max-w-xs">
                <div class="font-bold text-slate-800">${escapeHTML(announcement.title)}</div>
                <div class="text-xs text-slate-400 line-clamp-1 mt-0.5">${escapeHTML(contentPreview)}</div>
            </td>
            <td class="px-6 py-4 font-medium text-slate-600 text-xs">
                ${escapeHTML(authorName)}
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                ${dateStr}
            </td>
            <td class="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                ${expiresStr}
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
                        data-id="${announcement._id}"
                        title="عرض التفاصيل"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                    </button>
                    <button
                        data-action="edit"
                        data-id="${announcement._id}"
                        title="تعديل الإعلان"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button
                        data-action="toggle"
                        data-id="${announcement._id}"
                        data-active="${announcement.isActive}"
                        title="${announcement.isActive ? 'تعطيل الإعلان' : 'تفعيل الإعلان'}"
                        class="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700 transition">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                        </svg>
                    </button>
                    <button
                        data-action="delete"
                        data-id="${announcement._id}"
                        title="حذف الإعلان"
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
    $("announcements-search")?.addEventListener("input", filterAnnouncements)
    $("announcements-status-filter")?.addEventListener("change", filterAnnouncements)

    // Open Create Modal
    $("open-create-announcement-btn")?.addEventListener("click", openCreateModal)
    $("close-create-modal")?.addEventListener("click", closeCreateModal)
    $("cancel-create-modal")?.addEventListener("click", closeCreateModal)
    $("create-announcement-form")?.addEventListener("submit", handleCreateAnnouncement)

    // Table Actions
    $("announcements-table-body")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]")
        if (!btn) return

        const action = btn.dataset.action
        const id = btn.dataset.id

        if (action === "details") openDetailsModal(id)
        if (action === "edit") openEditModal(id)
        if (action === "toggle") handleToggleStatus(id, btn.dataset.active === "true")
        if (action === "delete") openDeleteModal(id)
    })

    // Details Modal Actions
    $("close-details-modal")?.addEventListener("click", closeDetailsModal)
    $("details-close-btn")?.addEventListener("click", closeDetailsModal)
    $("details-edit-btn")?.addEventListener("click", () => {
        if (selectedAnnouncement) {
            const id = selectedAnnouncement._id
            closeDetailsModal()
            openEditModal(id)
        }
    })

    // Edit Modal Actions
    $("close-edit-modal")?.addEventListener("click", closeEditModal)
    $("cancel-edit-modal")?.addEventListener("click", closeEditModal)
    $("edit-announcement-form")?.addEventListener("submit", handleEditAnnouncement)

    // Delete Modal Actions
    $("cancel-delete-modal")?.addEventListener("click", closeDeleteModal)
    $("confirm-delete-ann-btn")?.addEventListener("click", handleConfirmDelete)

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
   Create Announcement Logic
========================================================= */
function openCreateModal() {
    const modal = $("create-announcement-modal")
    const form = $("create-announcement-form")
    const errBox = $("create-announcement-error")

    if (form) form.reset()
    if (errBox) {
        errBox.classList.add("hidden")
        errBox.textContent = ""
    }

    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeCreateModal() {
    const modal = $("create-announcement-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
}

async function handleCreateAnnouncement(e) {
    e.preventDefault()

    const errBox = $("create-announcement-error")
    const submitBtn = $("submit-create-announcement")

    const title = $("create-ann-title")?.value.trim()
    const content = $("create-ann-content")?.value.trim()
    const expiresAt = $("create-ann-expires")?.value || null

    if (errBox) errBox.classList.add("hidden")

    if (!title || !content) {
        showModalError(errBox, "العنوان والمحتوى كلاهما حقل إلزامي.")
        return
    }

    submitBtn.disabled = true
    submitBtn.textContent = "جاري النشر..."

    try {
        await createAnnouncement({
            title,
            content,
            expiresAt: expiresAt ? expiresAt : undefined
        })

        closeCreateModal()
        await loadAnnouncements()
    } catch (error) {
        console.error("Create announcement error:", error)
        showModalError(errBox, error.message || "فشل نشر الإعلان.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "نشر الإعلان"
    }
}


/* =========================================================
   Details Announcement Logic
========================================================= */
async function openDetailsModal(id) {
    const modal = $("details-announcement-modal")

    selectedAnnouncement = allAnnouncements.find(item => item._id === id)

    try {
        if (!selectedAnnouncement) {
            selectedAnnouncement = await getAnnouncementById(id)
        }
    } catch (error) {
        console.warn("Could not fetch fresh details:", error)
    }

    if (!selectedAnnouncement) return

    const author = selectedAnnouncement.createdBy?.name || "الإدارة"
    const statusInfo = getAnnouncementStatusInfo(selectedAnnouncement)

    setText("details-ann-title", selectedAnnouncement.title)
    setText("details-ann-author", author)
    setText("details-ann-content", selectedAnnouncement.content)
    setText("details-ann-created", formatDateTime(selectedAnnouncement.createdAt))
    setText("details-ann-expires", selectedAnnouncement.expiresAt ? formatDate(selectedAnnouncement.expiresAt) : "غير محدد (دائم)")
    setText("details-ann-updated", formatDateTime(selectedAnnouncement.updatedAt))

    const badge = $("details-ann-status-badge")
    if (badge) {
        badge.textContent = statusInfo.label
        badge.className = `inline-block rounded-xl px-3 py-1 text-xs font-bold ${statusInfo.badgeClass}`
    }

    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeDetailsModal() {
    const modal = $("details-announcement-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
    selectedAnnouncement = null
}


/* =========================================================
   Edit Announcement Logic
========================================================= */
async function openEditModal(id) {
    const modal = $("edit-announcement-modal")
    const errBox = $("edit-announcement-error")

    if (errBox) {
        errBox.classList.add("hidden")
        errBox.textContent = ""
    }

    selectedAnnouncement = allAnnouncements.find(item => item._id === id)
    if (!selectedAnnouncement) {
        try {
            selectedAnnouncement = await getAnnouncementById(id)
        } catch (error) {
            console.error("Fetch announcement failed:", error)
            return
        }
    }

    if (!selectedAnnouncement) return

    const titleInput = $("edit-ann-title")
    const contentInput = $("edit-ann-content")
    const expiresInput = $("edit-ann-expires")
    const activeSelect = $("edit-ann-is-active")

    if (titleInput) titleInput.value = selectedAnnouncement.title || ""
    if (contentInput) contentInput.value = selectedAnnouncement.content || ""
    if (activeSelect) activeSelect.value = selectedAnnouncement.isActive ? "true" : "false"

    if (expiresInput) {
        if (selectedAnnouncement.expiresAt) {
            const d = new Date(selectedAnnouncement.expiresAt)
            expiresInput.value = isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0]
        } else {
            expiresInput.value = ""
        }
    }

    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeEditModal() {
    const modal = $("edit-announcement-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
}

async function handleEditAnnouncement(e) {
    e.preventDefault()

    if (!selectedAnnouncement) return

    const errBox = $("edit-announcement-error")
    const submitBtn = $("submit-edit-announcement")

    const title = $("edit-ann-title")?.value.trim()
    const content = $("edit-ann-content")?.value.trim()
    const expiresAt = $("edit-ann-expires")?.value || null
    const isActive = $("edit-ann-is-active")?.value === "true"

    if (errBox) errBox.classList.add("hidden")

    if (!title || !content) {
        showModalError(errBox, "العنوان والمحتوى كلاهما حقل إلزامي.")
        return
    }

    submitBtn.disabled = true
    submitBtn.textContent = "جاري الحفظ..."

    try {
        await updateAnnouncement(selectedAnnouncement._id, {
            title,
            content,
            expiresAt,
            isActive
        })

        closeEditModal()
        await loadAnnouncements()
    } catch (error) {
        console.error("Update announcement error:", error)
        showModalError(errBox, error.message || "فشل تحديث الإعلان.")
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = "حفظ التعديلات"
    }
}

async function handleToggleStatus(id, currentActive) {
    try {
        await updateAnnouncement(id, {
            isActive: !currentActive
        })
        await loadAnnouncements()
    } catch (error) {
        console.error("Toggle status error:", error)
        alert(error.message || "تعذر تغيير حالة الإعلان.")
    }
}


/* =========================================================
   Delete Announcement Logic
========================================================= */
function openDeleteModal(id) {
    announcementToDeleteId = id
    const annItem = allAnnouncements.find(item => item._id === id)
    setText("delete-ann-title", annItem?.title || "هذا الإعلان")

    const errBox = $("delete-announcement-error")
    if (errBox) {
        errBox.classList.add("hidden")
        errBox.textContent = ""
    }

    const modal = $("delete-announcement-modal")
    modal?.classList.remove("hidden")
    modal?.classList.add("flex")
}

function closeDeleteModal() {
    const modal = $("delete-announcement-modal")
    modal?.classList.add("hidden")
    modal?.classList.remove("flex")
    announcementToDeleteId = null
}

async function handleConfirmDelete() {
    if (!announcementToDeleteId) return

    const errBox = $("delete-announcement-error")
    const deleteBtn = $("confirm-delete-ann-btn")

    deleteBtn.disabled = true
    deleteBtn.textContent = "جاري الحذف..."

    try {
        await deleteAnnouncement(announcementToDeleteId)
        closeDeleteModal()
        await loadAnnouncements()
    } catch (error) {
        console.error("Delete announcement error:", error)
        showModalError(errBox, error.message || "تعذر حذف الإعلان.")
    } finally {
        deleteBtn.disabled = false
        deleteBtn.textContent = "حذف الإعلان"
    }
}


/* =========================================================
   Helpers & Formatters
========================================================= */
function getAnnouncementStatusInfo(announcement) {
    const now = new Date()
    const isExpired = announcement.expiresAt && new Date(announcement.expiresAt) < now

    if (isExpired) {
        return {
            label: "منتهي",
            badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
            dotClass: "bg-amber-500"
        }
    }

    if (announcement.isActive) {
        return {
            label: "نشط",
            badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
            dotClass: "bg-emerald-500"
        }
    }

    return {
        label: "معطل",
        badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
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
    const el = $("announcements-loading")
    if (el) {
        if (show) el.classList.remove("hidden"), el.classList.add("flex")
        else el.classList.add("hidden"), el.classList.remove("flex")
    }
}

function showError(msg) {
    const el = $("announcements-error")
    if (el) {
        el.textContent = msg
        el.classList.remove("hidden")
    }
}

function hideError() {
    const el = $("announcements-error")
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
