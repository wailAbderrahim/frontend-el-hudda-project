import {
    getMemorization,
    getMemorizationById,
    createMemorization,
    updateMemorization,
    deleteMemorization
} from "../../api/memorizationApi.js"

import { getHalaqas } from "../../api/halaqaApi.js"
import { getUser, protectPage, logout } from "../../auth/auth.js"
import { initNotificationBell } from "../../components/notificationBell.js"

protectPage("admin")


/* =========================================================
   State
========================================================= */

let allMemorizations = []
let filteredMemorizations = []
let allHalaqas = []

let selectedMemorization = null
let selectedMemorizationId = null

let currentMode = "create"


/* =========================================================
   DOM Helpers
========================================================= */

const $ = (id) => document.getElementById(id)

const setText = (id, value) => {
    const element = $(id)

    if (element) {
        element.textContent = value ?? "—"
    }
}


/* =========================================================
   Page Init
========================================================= */

async function initPage() {

    setupAdminInfo()
    setupSidebar()
    setupEvents()
    initNotificationBell()

    await Promise.all([
        loadMemorizations(),
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

    const name =
        user.name ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        "الإدارة"

    if (adminName) {
        adminName.textContent = name
    }

    if (adminAvatar) {
        adminAvatar.textContent = name.charAt(0)
    }
}


/* =========================================================
   Sidebar
========================================================= */

function setupSidebar() {

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

    const navLinks = sidebar.querySelectorAll("a")

    navLinks.forEach(link => {
        link.addEventListener("click", closeSidebar)
    })


    /* Logout */

    const logoutBtn = $("logout-btn")

    if (logoutBtn) {

        logoutBtn.addEventListener("click", () => {
            if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
                logout()
            }
        })
    }
}


/* =========================================================
   Load Memorization
========================================================= */

async function loadMemorizations() {

    showLoading(true)
    hideError()

    try {

        const data = await getMemorization()

        allMemorizations = Array.isArray(data)
            ? data
            : []

        filteredMemorizations = [...allMemorizations]

        renderStatistics()
        renderMemorizations()

    } catch (error) {

        console.error("Load memorization error:", error)

        showError(
            error.message ||
            "حدث خطأ أثناء تحميل سجلات الحفظ"
        )

    } finally {

        showLoading(false)
    }
}


/* =========================================================
   Load Halaqas
========================================================= */

async function loadHalaqas() {

    try {

        const data = await getHalaqas()

        allHalaqas = Array.isArray(data)
            ? data
            : []

        renderHalaqaFilter()
        populateHalaqaForm()

    } catch (error) {

        console.error("Load halaqas error:", error)

        /*
         لا نوقف الصفحة كاملة
         لأن سجلات الحفظ ممكن تكون محملة
        */
    }
}


/* =========================================================
   Statistics
========================================================= */

function renderStatistics() {

    const total = allMemorizations.length

    const today = allMemorizations.filter(item =>
        isToday(item.date)
    ).length


    const students = new Set()

    const halaqas = new Set()


    allMemorizations.forEach(item => {

        const studentId = getId(item.student)
        const halaqaId = getId(item.halaqa)

        if (studentId) {
            students.add(studentId)
        }

        if (halaqaId) {
            halaqas.add(halaqaId)
        }
    })


    setText(
        "total-memorization-count",
        total
    )

    setText(
        "today-memorization-count",
        today
    )

    setText(
        "students-with-memorization-count",
        students.size
    )

    setText(
        "halaqas-with-memorization-count",
        halaqas.size
    )
}


/* =========================================================
   Halaqa Filter
========================================================= */

function renderHalaqaFilter() {

    const select = $("halaqa-filter")

    if (!select) return

    select.innerHTML = `
        <option value="">
            جميع الحلقات
        </option>
    `

    allHalaqas.forEach(halaqa => {

        const option = document.createElement("option")

        option.value = halaqa._id
        option.textContent = halaqa.name

        select.appendChild(option)
    })
}


/* =========================================================
   Halaqa Form
========================================================= */

function populateHalaqaForm() {

    const select = $("memorization-halaqa")

    if (!select) return

    select.innerHTML = `
        <option value="">
            اختر الحلقة
        </option>
    `

    allHalaqas.forEach(halaqa => {

        const option = document.createElement("option")

        option.value = halaqa._id
        option.textContent = halaqa.name

        select.appendChild(option)
    })
}


/* =========================================================
   Students By Halaqa
========================================================= */

function populateStudents(halaqaId, selectedStudentId = "") {

    const studentSelect = $("memorization-student")

    if (!studentSelect) return

    studentSelect.innerHTML = `
        <option value="">
            اختر الطالب
        </option>
    `


    if (!halaqaId) {
        return
    }


    const halaqa = allHalaqas.find(
        item => item._id === halaqaId
    )

    if (!halaqa) {
        return
    }


    const students = Array.isArray(halaqa.students)
        ? halaqa.students
        : []


    students.forEach(student => {

        const studentId = getId(student)

        if (!studentId) return

        const option = document.createElement("option")

        option.value = studentId

        option.textContent =
            getStudentName(student)

        if (studentId === selectedStudentId) {
            option.selected = true
        }

        studentSelect.appendChild(option)
    })
}


/* =========================================================
   Render Table
========================================================= */

function renderMemorizations() {

    const tbody = $("memorization-table-body")
    const empty = $("memorization-empty")
    const table = $("memorization-table-container")

    if (!tbody) return


    tbody.innerHTML = ""


    setText(
        "filtered-memorization-count",
        filteredMemorizations.length
    )


    if (filteredMemorizations.length === 0) {

        if (table) {
            table.classList.remove("hidden")
        }

        if (empty) {
            empty.classList.remove("hidden")
        }

        return
    }


    if (empty) {
        empty.classList.add("hidden")
    }


    filteredMemorizations.forEach(memorization => {

        const row = createMemorizationRow(
            memorization
        )

        tbody.appendChild(row)
    })
}


/* =========================================================
   Create Table Row
========================================================= */

function createMemorizationRow(memorization) {

    const tr = document.createElement("tr")

    tr.className =
        "transition hover:bg-slate-50"


    const studentName =
        getStudentName(memorization.student)


    const halaqaName =
        getHalaqaName(memorization.halaqa)


    const verses =
        `${memorization.fromVerse} - ${memorization.toVerse}`


    const date =
        formatDate(memorization.date)


    tr.innerHTML = `

        <td class="whitespace-nowrap px-5 py-4">

            <div class="font-semibold text-slate-700">
                ${escapeHTML(studentName)}
            </div>

        </td>


        <td class="whitespace-nowrap px-5 py-4">

            <span class="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ${escapeHTML(halaqaName)}
            </span>

        </td>


        <td class="whitespace-nowrap px-5 py-4">

            <span class="font-semibold text-slate-700">
                ${escapeHTML(memorization.surah || "—")}
            </span>

        </td>


        <td class="whitespace-nowrap px-5 py-4">

            <span class="text-sm text-slate-600">
                ${escapeHTML(verses)}
            </span>

        </td>


        <td class="whitespace-nowrap px-5 py-4">

            <span class="text-sm text-slate-500">
                ${escapeHTML(date)}
            </span>

        </td>


        <td class="whitespace-nowrap px-5 py-4">

            <div class="flex items-center gap-2">


                <button
                    type="button"
                    data-id="${memorization._id}"
                    class="view-memorization-btn rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200">

                    تفاصيل

                </button>


                <button
                    type="button"
                    data-id="${memorization._id}"
                    class="edit-memorization-btn rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">

                    تعديل

                </button>


                <button
                    type="button"
                    data-id="${memorization._id}"
                    class="delete-memorization-btn rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">

                    حذف

                </button>

            </div>

        </td>
    `

    return tr
}


/* =========================================================
   Filters
========================================================= */

function applyFilters() {

    const searchValue =
        $("search-memorization")?.value
            ?.trim()
            .toLowerCase() || ""


    const halaqaValue =
        $("halaqa-filter")?.value || ""


    const dateValue =
        $("date-filter")?.value || ""


    filteredMemorizations =
        allMemorizations.filter(memorization => {


            /* Search */

            const studentName =
                getStudentName(
                    memorization.student
                ).toLowerCase()


            const surah =
                String(
                    memorization.surah || ""
                ).toLowerCase()


            const halaqaName =
                getHalaqaName(
                    memorization.halaqa
                ).toLowerCase()


            const matchesSearch =
                !searchValue ||
                studentName.includes(searchValue) ||
                surah.includes(searchValue) ||
                halaqaName.includes(searchValue)


            if (!matchesSearch) {
                return false
            }


            /* Halaqa */

            const memorizationHalaqaId =
                getId(memorization.halaqa)


            if (
                halaqaValue &&
                memorizationHalaqaId !== halaqaValue
            ) {
                return false
            }


            /* Date */

            if (dateValue) {

                const memorizationDate =
                    normalizeDate(
                        memorization.date
                    )

                if (
                    memorizationDate !== dateValue
                ) {
                    return false
                }
            }


            return true
        })


    renderMemorizations()
}


/* =========================================================
   Reset Filters
========================================================= */

function resetFilters() {

    const search = $("search-memorization")
    const halaqa = $("halaqa-filter")
    const date = $("date-filter")

    if (search) search.value = ""
    if (halaqa) halaqa.value = ""
    if (date) date.value = ""

    filteredMemorizations = [
        ...allMemorizations
    ]

    renderMemorizations()
}


/* =========================================================
   Create Modal
========================================================= */

function openCreateMemorizationModal() {

    currentMode = "create"

    selectedMemorization = null
    selectedMemorizationId = null


    const modal =
        $("memorization-form-modal")


    const form =
        $("memorization-form")


    if (!modal || !form) return


    form.reset()


    $("memorization-form-title").textContent =
        "تسجيل حفظ جديد"


    const student =
        $("memorization-student")

    if (student) {
        student.innerHTML = `
            <option value="">
                اختر الطالب
            </option>
        `
    }


    populateHalaqaForm()


    hideFormError()


    /* Default date = today */

    const dateInput =
        $("memorization-date")

    if (dateInput) {
        dateInput.value =
            getTodayDate()
    }


    enableCreateFields()


    closeDetailsModal()
    closeEditModal()
    closeDeleteModal()


    modal.classList.remove("hidden")
    modal.classList.add("flex")
}


/* =========================================================
   Open Edit Modal
========================================================= */

async function openEditMemorization(id) {

    try {

        let memorization =
            allMemorizations.find(
                item => item._id === id
            )


        if (!memorization) {
            memorization =
                await getMemorizationById(id)
        }


        if (!memorization) {
            throw new Error(
                "لم يتم العثور على سجل الحفظ"
            )
        }


        selectedMemorization =
            memorization

        selectedMemorizationId =
            id

        currentMode = "edit"


        $("edit-memorization-surah").value =
            memorization.surah || ""


        $("edit-memorization-from-verse").value =
            memorization.fromVerse || ""


        $("edit-memorization-to-verse").value =
            memorization.toVerse || ""


        $("edit-memorization-date").value =
            formatDateForInput(
                memorization.date
            )


        hideEditError()


        closeDetailsModal()
        closeFormModal()
        closeDeleteModal()


        const modal =
            $("edit-memorization-modal")

        if (modal) {
            modal.classList.remove("hidden")
            modal.classList.add("flex")
        }

    } catch (error) {

        console.error(
            "Open edit memorization error:",
            error
        )

        alert(
            error.message ||
            "حدث خطأ أثناء فتح التعديل"
        )
    }
}


/* =========================================================
   Create Memorization
========================================================= */

async function handleMemorizationSubmit(event) {

    event.preventDefault()

    hideFormError()


    const student =
        $("memorization-student")?.value


    const halaqa =
        $("memorization-halaqa")?.value


    const surah =
        $("memorization-surah")?.value
            ?.trim()


    const fromVerse =
        Number(
            $("memorization-from-verse")?.value
        )


    const toVerse =
        Number(
            $("memorization-to-verse")?.value
        )


    const date =
        $("memorization-date")?.value


    try {

        if (!student) {
            throw new Error(
                "يرجى اختيار الطالب"
            )
        }


        if (!halaqa) {
            throw new Error(
                "يرجى اختيار الحلقة"
            )
        }


        if (!surah) {
            throw new Error(
                "يرجى إدخال اسم السورة"
            )
        }


        if (
            !Number.isFinite(fromVerse) ||
            fromVerse <= 0
        ) {
            throw new Error(
                "رقم الآية الأولى غير صحيح"
            )
        }


        if (
            !Number.isFinite(toVerse) ||
            toVerse <= 0
        ) {
            throw new Error(
                "رقم الآية الأخيرة غير صحيح"
            )
        }


        if (fromVerse > toVerse) {
            throw new Error(
                "الآية الأولى يجب أن تكون أصغر أو تساوي الآية الأخيرة"
            )
        }


        if (!date) {
            throw new Error(
                "يرجى اختيار التاريخ"
            )
        }


        const saveButton =
            $("save-memorization-btn")


        if (saveButton) {
            saveButton.disabled = true
            saveButton.textContent =
                "جاري الحفظ..."
        }


        await createMemorization(
            student,
            halaqa,
            surah,
            fromVerse,
            toVerse,
            date
        )


        closeFormModal()


        await reloadData()


    } catch (error) {

        console.error(
            "Create memorization error:",
            error
        )

        showFormError(
            error.message ||
            "حدث خطأ أثناء تسجيل الحفظ"
        )

    } finally {

        const saveButton =
            $("save-memorization-btn")


        if (saveButton) {
            saveButton.disabled = false
            saveButton.textContent =
                "حفظ العملية"
        }
    }
}


/* =========================================================
   Update Memorization
========================================================= */

async function handleEditMemorizationSubmit(event) {

    event.preventDefault()

    hideEditError()


    if (!selectedMemorizationId) {
        showEditError(
            "لم يتم تحديد سجل الحفظ"
        )

        return
    }


    const surah =
        $("edit-memorization-surah")?.value
            ?.trim()


    const fromVerse =
        Number(
            $("edit-memorization-from-verse")?.value
        )


    const toVerse =
        Number(
            $("edit-memorization-to-verse")?.value
        )


    const date =
        $("edit-memorization-date")?.value


    try {

        if (!surah) {
            throw new Error(
                "يرجى إدخال اسم السورة"
            )
        }


        if (
            !Number.isFinite(fromVerse) ||
            fromVerse <= 0
        ) {
            throw new Error(
                "رقم الآية الأولى غير صحيح"
            )
        }


        if (
            !Number.isFinite(toVerse) ||
            toVerse <= 0
        ) {
            throw new Error(
                "رقم الآية الأخيرة غير صحيح"
            )
        }


        if (fromVerse > toVerse) {
            throw new Error(
                "الآية الأولى يجب أن تكون أصغر أو تساوي الآية الأخيرة"
            )
        }


        if (!date) {
            throw new Error(
                "يرجى اختيار التاريخ"
            )
        }


        const button =
            $("save-edit-memorization-btn")


        if (button) {
            button.disabled = true
            button.textContent =
                "جاري الحفظ..."
        }


        await updateMemorization(
            selectedMemorizationId,
            surah,
            fromVerse,
            toVerse,
            date
        )


        closeEditModal()


        await reloadData()


    } catch (error) {

        console.error(
            "Update memorization error:",
            error
        )

        showEditError(
            error.message ||
            "حدث خطأ أثناء تعديل سجل الحفظ"
        )

    } finally {

        const button =
            $("save-edit-memorization-btn")


        if (button) {
            button.disabled = false
            button.textContent =
                "حفظ التعديلات"
        }
    }
}


/* =========================================================
   Details
========================================================= */

async function openMemorizationDetails(id) {

    try {

        /*
         أولاً نأخذ السجل من القائمة الحالية.
         هذا مهم لأن getMemorization() يرجع
         student/halaqa populated.
        */

        let memorization =
            allMemorizations.find(
                item => item._id === id
            )


        /*
         نحاول جلب النسخة من API كذلك.
         إذا رجعت Raw IDs، نستخدم النسخة الموجودة
         في القائمة حتى لا يظهر الـmodal فارغاً.
        */

        try {

            const apiMemorization =
                await getMemorizationById(id)

            if (apiMemorization) {

                memorization = mergeMemorizationData(
                    memorization,
                    apiMemorization
                )
            }

        } catch (error) {

            console.warn(
                "Could not fetch memorization details, using list data:",
                error
            )
        }


        if (!memorization) {

            throw new Error(
                "لم يتم العثور على سجل الحفظ"
            )
        }


        selectedMemorization =
            memorization

        selectedMemorizationId =
            id


        /* =========================================
           Student
        ========================================= */

        const studentName =
            getStudentName(
                memorization.student
            )

        setText(
            "details-student",
            studentName
        )


        /* =========================================
           Halaqa
        ========================================= */

        const halaqaName =
            getHalaqaName(
                memorization.halaqa
            )

        setText(
            "details-halaqa",
            halaqaName
        )


        /* =========================================
           Surah
        ========================================= */

        setText(
            "details-surah",
            memorization.surah || "—"
        )


        /* =========================================
           Verses
        ========================================= */

        const verses =
            memorization.fromVerse &&
            memorization.toVerse
                ? `${memorization.fromVerse} - ${memorization.toVerse}`
                : "—"


        setText(
            "details-verses",
            verses
        )


        /* =========================================
           Date
        ========================================= */

        setText(
            "details-date",
            formatDate(
                memorization.date
            )
        )


        closeFormModal()
        closeEditModal()
        closeDeleteModal()


        const modal =
            $("memorization-details-modal")


        if (modal) {
            modal.classList.remove("hidden")
            modal.classList.add("flex")
        }


    } catch (error) {

        console.error(
            "Open details error:",
            error
        )

        alert(
            error.message ||
            "حدث خطأ أثناء عرض التفاصيل"
        )
    }
}


/* =========================================================
   Merge Details
========================================================= */

function mergeMemorizationData(
    oldData,
    newData
) {

    if (!oldData) {
        return newData
    }


    return {
        ...oldData,
        ...newData,

        /*
         إذا API رجع student كـ ObjectId فقط
         نخلي populated student القديمة.
        */

        student:
            isPopulatedObject(newData.student)
                ? newData.student
                : oldData.student,


        /*
         نفس الشيء للحلقة
        */

        halaqa:
            isPopulatedObject(newData.halaqa)
                ? newData.halaqa
                : oldData.halaqa
    }
}


/* =========================================================
   Delete
========================================================= */

function openDeleteModal(id) {

    selectedMemorizationId =
        id

    const memorization =
        allMemorizations.find(
            item => item._id === id
        )

    if (memorization) {
        selectedMemorization =
            memorization
    }


    closeDetailsModal()
    closeFormModal()
    closeEditModal()


    const modal =
        $("delete-memorization-modal")


    if (modal) {
        modal.classList.remove("hidden")
        modal.classList.add("flex")
    }
}


async function confirmDeleteMemorization() {

    if (!selectedMemorizationId) {
        return
    }


    const button =
        $("confirm-delete-memorization")


    try {

        if (button) {
            button.disabled = true
            button.textContent =
                "جاري الحذف..."
        }


        await deleteMemorization(
            selectedMemorizationId
        )


        closeDeleteModal()


        await reloadData()


    } catch (error) {

        console.error(
            "Delete memorization error:",
            error
        )

        alert(
            error.message ||
            "حدث خطأ أثناء حذف سجل الحفظ"
        )

    } finally {

        if (button) {
            button.disabled = false
            button.textContent =
                "حذف"
        }
    }
}


/* =========================================================
   Close Modals
========================================================= */

function closeFormModal() {

    const modal =
        $("memorization-form-modal")

    if (!modal) return

    modal.classList.add("hidden")
    modal.classList.remove("flex")
}


function closeDetailsModal() {

    const modal =
        $("memorization-details-modal")

    if (!modal) return

    modal.classList.add("hidden")
    modal.classList.remove("flex")
}


function closeEditModal() {

    const modal =
        $("edit-memorization-modal")

    if (!modal) return

    modal.classList.add("hidden")
    modal.classList.remove("flex")
}


function closeDeleteModal() {

    const modal =
        $("delete-memorization-modal")

    if (!modal) return

    modal.classList.add("hidden")
    modal.classList.remove("flex")
}


/* =========================================================
   Enable / Disable Create Fields
========================================================= */

function enableCreateFields() {

    const student =
        $("memorization-student")

    const halaqa =
        $("memorization-halaqa")


    if (student) {
        student.disabled = false
    }

    if (halaqa) {
        halaqa.disabled = false
    }
}


/* =========================================================
   Form Errors
========================================================= */

function showFormError(message) {

    const error =
        $("memorization-form-error")

    if (!error) return

    error.textContent =
        message

    error.classList.remove("hidden")
}


function hideFormError() {

    const error =
        $("memorization-form-error")

    if (!error) return

    error.textContent = ""

    error.classList.add("hidden")
}


function showEditError(message) {

    const error =
        $("edit-memorization-error")

    if (!error) return

    error.textContent =
        message

    error.classList.remove("hidden")
}


function hideEditError() {

    const error =
        $("edit-memorization-error")

    if (!error) return

    error.textContent = ""

    error.classList.add("hidden")
}


/* =========================================================
   Events
========================================================= */

function setupEvents() {

    /* =========================================
       Add
    ========================================= */

    $("add-memorization-btn")
        ?.addEventListener(
            "click",
            openCreateMemorizationModal
        )


    /* =========================================
       Create Form
    ========================================= */

    $("memorization-form")
        ?.addEventListener(
            "submit",
            handleMemorizationSubmit
        )


    /* =========================================
       Edit Form
    ========================================= */

    $("edit-memorization-form")
        ?.addEventListener(
            "submit",
            handleEditMemorizationSubmit
        )


    /* =========================================
       Halaqa Change
    ========================================= */

    $("memorization-halaqa")
        ?.addEventListener(
            "change",
            event => {

                populateStudents(
                    event.target.value
                )
            }
        )


    /* =========================================
       Search
    ========================================= */

    $("search-memorization")
        ?.addEventListener(
            "input",
            applyFilters
        )


    /* =========================================
       Halaqa Filter
    ========================================= */

    $("halaqa-filter")
        ?.addEventListener(
            "change",
            applyFilters
        )


    /* =========================================
       Date Filter
    ========================================= */

    $("date-filter")
        ?.addEventListener(
            "change",
            applyFilters
        )


    /* =========================================
       Reset Filters
    ========================================= */

    $("reset-filters-btn")
        ?.addEventListener(
            "click",
            resetFilters
        )


    /* =========================================
       Retry
    ========================================= */

    $("retry-memorization-btn")
        ?.addEventListener(
            "click",
            async () => {

                await Promise.all([
                    loadMemorizations(),
                    loadHalaqas()
                ])
            }
        )


    /* =========================================
       Close Create
    ========================================= */

    $("close-memorization-form")
        ?.addEventListener(
            "click",
            closeFormModal
        )


    $("cancel-memorization-form")
        ?.addEventListener(
            "click",
            closeFormModal
        )


    /* =========================================
       Close Details
    ========================================= */

    $("close-memorization-details")
        ?.addEventListener(
            "click",
            closeDetailsModal
        )


    /* =========================================
       Details Edit
    ========================================= */

    $("edit-memorization-btn")
        ?.addEventListener(
            "click",
            () => {

                if (
                    selectedMemorizationId
                ) {

                    openEditMemorization(
                        selectedMemorizationId
                    )
                }
            }
        )


    /* =========================================
       Details Delete
    ========================================= */

    $("delete-memorization-btn")
        ?.addEventListener(
            "click",
            () => {

                if (
                    selectedMemorizationId
                ) {

                    openDeleteModal(
                        selectedMemorizationId
                    )
                }
            }
        )


    /* =========================================
       Close Edit
    ========================================= */

    $("close-edit-memorization")
        ?.addEventListener(
            "click",
            closeEditModal
        )


    $("cancel-edit-memorization")
        ?.addEventListener(
            "click",
            closeEditModal
        )


    /* =========================================
       Delete
    ========================================= */

    $("confirm-delete-memorization")
        ?.addEventListener(
            "click",
            confirmDeleteMemorization
        )


    $("cancel-delete-memorization")
        ?.addEventListener(
            "click",
            closeDeleteModal
        )


    /* =========================================
       Table Actions
    ========================================= */

    $("memorization-table-body")
        ?.addEventListener(
            "click",
            event => {

                const viewButton =
                    event.target.closest(
                        ".view-memorization-btn"
                    )


                const editButton =
                    event.target.closest(
                        ".edit-memorization-btn"
                    )


                const deleteButton =
                    event.target.closest(
                        ".delete-memorization-btn"
                    )


                if (viewButton) {

                    const id =
                        viewButton.dataset.id

                    openMemorizationDetails(id)

                    return
                }


                if (editButton) {

                    const id =
                        editButton.dataset.id

                    openEditMemorization(id)

                    return
                }


                if (deleteButton) {

                    const id =
                        deleteButton.dataset.id

                    openDeleteModal(id)

                    return
                }
            }
        )


    /* =========================================
       Close modal by clicking overlay
    ========================================= */

    $("memorization-form-modal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "memorization-form-modal"
                ) {
                    closeFormModal()
                }
            }
        )


    $("memorization-details-modal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "memorization-details-modal"
                ) {
                    closeDetailsModal()
                }
            }
        )


    $("edit-memorization-modal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "edit-memorization-modal"
                ) {
                    closeEditModal()
                }
            }
        )


    $("delete-memorization-modal")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target.id ===
                    "delete-memorization-modal"
                ) {
                    closeDeleteModal()
                }
            }
        )


    /* =========================================
       Escape Key
    ========================================= */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return
            }

            closeFormModal()
            closeDetailsModal()
            closeEditModal()
            closeDeleteModal()
        }
    )
}


/* =========================================================
   Reload
========================================================= */

async function reloadData() {

    await loadMemorizations()

    /*
     نعيد تحميل الحلقات كذلك لأن
     أسماء/طلاب الحلقات ممكن تتغير
    */

    await loadHalaqas()

    /*
     نطبق الفلاتر الحالية من جديد
    */

    applyFilters()
}


/* =========================================================
   Loading
========================================================= */

function showLoading(show) {

    const loading =
        $("memorization-loading")

    if (!loading) return

    if (show) {
        loading.classList.remove("hidden")
    } else {
        loading.classList.add("hidden")
    }
}


/* =========================================================
   Error
========================================================= */

function showError(message) {

    const error =
        $("memorization-error")


    const errorMessage =
        $("memorization-error-message")


    if (!error) return


    if (errorMessage) {
        errorMessage.textContent =
            message
    }


    error.classList.remove("hidden")
}


function hideError() {

    const error =
        $("memorization-error")

    if (!error) return

    error.classList.add("hidden")
}


/* =========================================================
   Helpers
========================================================= */

function getId(value) {

    if (!value) {
        return null
    }


    if (typeof value === "string") {
        return value
    }


    if (value._id) {
        return value._id
    }


    return null
}


function isPopulatedObject(value) {

    return (
        value &&
        typeof value === "object" &&
        Boolean(value._id)
    )
}


function getStudentName(student) {

    if (!student) {
        return "غير معروف"
    }


    /*
     populated student
    */

    if (
        typeof student === "object" &&
        student.name
    ) {
        return student.name
    }


    /*
     إذا student مجرد ID
     نحاول نلقاه داخل الحلقات
    */

    const studentId =
        getId(student)


    if (!studentId) {
        return "غير معروف"
    }


    for (const halaqa of allHalaqas) {

        const students =
            Array.isArray(halaqa.students)
                ? halaqa.students
                : []


        const found =
            students.find(
                item =>
                    getId(item) === studentId
            )


        if (found) {

            if (
                typeof found === "object" &&
                found.name
            ) {
                return found.name
            }
        }
    }


    /*
     نبحث كذلك داخل سجلات الحفظ
    */

    const memorization =
        allMemorizations.find(
            item =>
                getId(item.student) ===
                studentId &&
                isPopulatedObject(item.student)
        )


    if (
        memorization &&
        memorization.student?.name
    ) {
        return memorization.student.name
    }


    return "غير معروف"
}


function getHalaqaName(halaqa) {

    if (!halaqa) {
        return "غير معروف"
    }


    /*
     populated
    */

    if (
        typeof halaqa === "object" &&
        halaqa.name
    ) {
        return halaqa.name
    }


    const halaqaId =
        getId(halaqa)


    if (!halaqaId) {
        return "غير معروف"
    }


    /*
     البحث في allHalaqas
    */

    const found =
        allHalaqas.find(
            item =>
                item._id === halaqaId
        )


    if (found) {
        return found.name
    }


    /*
     البحث في سجلات الحفظ
    */

    const memorization =
        allMemorizations.find(
            item =>
                getId(item.halaqa) ===
                halaqaId &&
                isPopulatedObject(item.halaqa)
        )


    if (
        memorization &&
        memorization.halaqa?.name
    ) {
        return memorization.halaqa.name
    }


    return "غير معروف"
}


/* =========================================================
   Date Helpers
========================================================= */

function isToday(dateValue) {

    if (!dateValue) {
        return false
    }


    const date =
        new Date(dateValue)


    if (isNaN(date.getTime())) {
        return false
    }


    const today =
        new Date()


    return (
        date.getFullYear() ===
            today.getFullYear() &&

        date.getMonth() ===
            today.getMonth() &&

        date.getDate() ===
            today.getDate()
    )
}


function getTodayDate() {

    const date =
        new Date()


    const year =
        date.getFullYear()


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0")


    const day =
        String(
            date.getDate()
        ).padStart(2, "0")


    return `${year}-${month}-${day}`
}


function normalizeDate(dateValue) {

    if (!dateValue) {
        return ""
    }


    /*
     إذا كانت أصلاً YYYY-MM-DD
    */

    if (
        typeof dateValue === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(
            dateValue
        )
    ) {
        return dateValue
    }


    const date =
        new Date(dateValue)


    if (isNaN(date.getTime())) {
        return ""
    }


    const year =
        date.getFullYear()


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0")


    const day =
        String(
            date.getDate()
        ).padStart(2, "0")


    return `${year}-${month}-${day}`
}


function formatDateForInput(dateValue) {

    return normalizeDate(dateValue)
}


function formatDate(dateValue) {

    if (!dateValue) {
        return "—"
    }


    const date =
        new Date(dateValue)


    if (isNaN(date.getTime())) {
        return "—"
    }


    return new Intl.DateTimeFormat(
        "ar-DZ",
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    ).format(date)
}


/* =========================================================
   Escape HTML
========================================================= */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return ""
    }


    return String(value)
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