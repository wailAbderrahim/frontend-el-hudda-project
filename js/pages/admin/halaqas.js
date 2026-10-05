import {
    getHalaqas,
    getHalaqaById,
    createHalaqa,
    addStudentToHalaqa,
    removeStudentFromHalaqa,
    updateHalaqa,
    updateHalaqaStatus
} from "../../api/halaqaApi.js"

import { getUsers } from "../../api/usersApi.js"
import { getUser, protectPage, logout } from "../../auth/auth.js"

protectPage("admin")


let allHalaqas = []
let allUsers = []
let selectedHalaqa = null
let editingHalaqa = null


/* =========================
   Helpers
========================= */

function getTeacherName(teacher) {

    if (!teacher) {
        return "-"
    }

    return teacher.name || "-"
}


function getStudentName(student) {

    if (!student) {
        return "-"
    }

    return `
        ${student.firstName || student.name || "-"}
        ${student.lastName || ""}
    `
}


function getScheduleText(schedule) {

    if (!schedule || schedule.length === 0) {
        return "غير محدد"
    }

    return schedule.join(" - ")
}


/* =========================
   Modal Z-Index
========================= */

function setupModalLayers() {

    const detailsModal =
        document.getElementById(
            "halaqa-details-modal"
        )

    const formModal =
        document.getElementById(
            "halaqa-form-modal"
        )

    const addStudentModal =
        document.getElementById(
            "add-student-modal"
        )


    /*
        التفاصيل تكون في الطبقة الأساسية
    */

    if (detailsModal) {

        detailsModal.classList.add(
            "z-40"
        )
    }


    /*
        التعديل / الإضافة تكون فوق التفاصيل
    */

    if (formModal) {

        formModal.classList.add(
            "z-50"
        )
    }


    /*
        إضافة الطالب تكون فوق التفاصيل كذلك
    */

    if (addStudentModal) {

        addStudentModal.classList.add(
            "z-50"
        )
    }
}


/* =========================
   Load Halaqas
========================= */

async function loadHalaqas() {

    try {

        const halaqas = await getHalaqas()

        allHalaqas = halaqas

        console.log("Halaqas:", halaqas)

        document
            .getElementById("halaqas-loading")
            .classList.add("hidden")

        renderStatistics(halaqas)

        renderHalaqas(halaqas)

        document
            .getElementById("filtered-halaqas-count")
            .textContent = halaqas.length

    } catch (err) {

        console.error(
            "Error loading halaqas:",
            err
        )

        document
            .getElementById("halaqas-loading")
            .classList.add("hidden")

        document
            .getElementById("halaqas-error")
            .classList.remove("hidden")

        document
            .getElementById("halaqas-error-message")
            .textContent =
                err.message
    }
}


/* =========================
   Load Users
========================= */

async function loadUsers() {

    try {

        const users = await getUsers()

        allUsers = users

        console.log(
            "Users:",
            allUsers
        )

        renderTeacherOptions()

    } catch (err) {

        console.error(
            "Error loading users:",
            err
        )
    }
}


/* =========================
   Render Teacher Options
========================= */

function renderTeacherOptions(
    selectedTeacherId = ""
) {

    const select =
        document.getElementById(
            "halaqa-teacher"
        )

    if (!select) return


    select.innerHTML = `
        <option value="">
            اختر المعلم
        </option>
    `


    const teachers =
        allUsers.filter(
            user =>
                user.role === "teacher"
        )


    teachers.forEach(teacher => {

        const option =
            document.createElement(
                "option"
            )


        option.value =
            teacher._id


        option.textContent =
            `${teacher.firstName || teacher.name || "-"} ${teacher.lastName || ""}`


        if (
            teacher._id ===
            selectedTeacherId
        ) {

            option.selected = true
        }


        select.appendChild(
            option
        )
    })


    if (teachers.length === 0) {

        select.innerHTML = `
            <option value="">
                لا يوجد معلمون
            </option>
        `
    }
}


/* =========================
   Statistics
========================= */

function renderStatistics(halaqas) {

    const total =
        halaqas.length


    const active =
        halaqas.filter(
            halaqa =>
                halaqa.isActive === true
        ).length


    const inactive =
        halaqas.filter(
            halaqa =>
                halaqa.isActive === false
        ).length


    document
        .getElementById(
            "halaqas-count"
        )
        .textContent =
            total


    document
        .getElementById(
            "active-halaqas-count"
        )
        .textContent =
            active


    document
        .getElementById(
            "inactive-halaqas-count"
        )
        .textContent =
            inactive
}


/* =========================
   Render Halaqas
========================= */

function renderHalaqas(halaqas) {

    const tableContainer =
        document.getElementById(
            "halaqas-table-container"
        )


    const tableBody =
        document.getElementById(
            "halaqas-table-body"
        )


    const emptyState =
        document.getElementById(
            "halaqas-empty"
        )


    tableBody.innerHTML = ""


    if (halaqas.length === 0) {

        tableContainer.classList.add(
            "hidden"
        )

        emptyState.classList.remove(
            "hidden"
        )

        return
    }


    emptyState.classList.add(
        "hidden"
    )

    tableContainer.classList.remove(
        "hidden"
    )


    halaqas.forEach(halaqa => {

        const row =
            document.createElement(
                "tr"
            )


        row.className =
            "transition hover:bg-slate-50"


        row.innerHTML = `

            <td class="px-6 py-4">

                <div class="font-semibold text-slate-700">

                    ${halaqa.name || "-"}

                </div>

            </td>


            <td class="px-6 py-4">

                <div class="text-sm text-slate-600">

                    ${getTeacherName(
                        halaqa.teacher
                    )}

                </div>

            </td>


            <td class="px-6 py-4">

                <span
                    class="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">

                    ${halaqa.students?.length || 0}

                </span>

            </td>


            <td class="px-6 py-4">

                <div class="max-w-xs text-sm text-slate-600">

                    ${getScheduleText(
                        halaqa.schedule
                    )}

                </div>

            </td>


            <td class="px-6 py-4">

                <span
                    class="text-sm font-medium ${
                        halaqa.isActive
                            ? "text-emerald-600"
                            : "text-red-500"
                    }">

                    ${
                        halaqa.isActive
                            ? "نشطة"
                            : "غير نشطة"
                    }

                </span>

            </td>


            <td class="px-6 py-4">

                <button
                    type="button"
                    class="view-halaqa-btn rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                    data-halaqa-id="${halaqa._id}">

                    عرض التفاصيل

                </button>

            </td>

        `


        tableBody.appendChild(
            row
        )
    })
}


/* =========================
   Render Halaqa Details
========================= */

function renderHalaqaDetails(halaqa) {

    selectedHalaqa = halaqa


    document
        .getElementById(
            "details-halaqa-name"
        )
        .textContent =
            halaqa.name || "-"


    document
        .getElementById(
            "details-name"
        )
        .textContent =
            halaqa.name || "-"


    document
        .getElementById(
            "details-teacher"
        )
        .textContent =
            getTeacherName(
                halaqa.teacher
            )


    document
        .getElementById(
            "details-students-count"
        )
        .textContent =
            halaqa.students?.length || 0


    document
        .getElementById(
            "details-status"
        )
        .textContent =
            halaqa.isActive
                ? "نشطة"
                : "غير نشطة"


    document
        .getElementById(
            "details-status"
        )
        .className =
            `mt-1 font-semibold ${
                halaqa.isActive
                    ? "text-emerald-600"
                    : "text-red-500"
            }`


    document
        .getElementById(
            "details-schedule"
        )
        .textContent =
            getScheduleText(
                halaqa.schedule
            )


    renderStudents(
        halaqa.students
    )


    updateToggleStatusButton(
        halaqa
    )


    const modal =
        document.getElementById(
            "halaqa-details-modal"
        )


    /*
        التفاصيل في الطبقة z-40
    */

    modal.classList.add(
        "z-40"
    )

    modal.classList.remove(
        "hidden"
    )

    modal.classList.add(
        "flex"
    )
}


/* =========================
   Render Students
========================= */

function renderStudents(students) {

    const studentsList =
        document.getElementById(
            "students-list"
        )


    const studentsEmpty =
        document.getElementById(
            "students-empty"
        )


    studentsList.innerHTML = ""


    if (
        !students ||
        students.length === 0
    ) {

        studentsList.classList.add(
            "hidden"
        )

        studentsEmpty.classList.remove(
            "hidden"
        )

        return
    }


    studentsEmpty.classList.add(
        "hidden"
    )

    studentsList.classList.remove(
        "hidden"
    )


    students.forEach(student => {

        const studentRow =
            document.createElement(
                "div"
            )


        studentRow.className =
            "flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"


        studentRow.innerHTML = `

            <div class="min-w-0">

                <p class="truncate font-semibold text-slate-700">

                    ${getStudentName(
                        student
                    )}

                </p>


                <p class="mt-1 truncate text-xs text-slate-400">

                    ${
                        student.email ||
                        "لا يوجد بريد إلكتروني"
                    }

                </p>

            </div>


            <button
                type="button"
                class="remove-student-btn shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                data-student-id="${student._id}">

                إزالة

            </button>

        `


        studentsList.appendChild(
            studentRow
        )
    })
}


/* =========================
   Toggle Button UI
========================= */

function updateToggleStatusButton(halaqa) {

    const button =
        document.getElementById(
            "toggle-halaqa-status-btn"
        )


    if (!button) return


    if (halaqa.isActive) {

        button.textContent =
            "تعطيل الحلقة"


        button.classList.remove(
            "bg-emerald-600",
            "hover:bg-emerald-700"
        )


        button.classList.add(
            "bg-red-600",
            "hover:bg-red-700"
        )

    } else {

        button.textContent =
            "تفعيل الحلقة"


        button.classList.remove(
            "bg-red-600",
            "hover:bg-red-700"
        )


        button.classList.add(
            "bg-emerald-600",
            "hover:bg-emerald-700"
        )
    }
}


/* =========================
   Refresh Selected Halaqa
========================= */

async function refreshSelectedHalaqa() {

    if (!selectedHalaqa) {
        return null
    }


    const updatedHalaqa =
        await getHalaqaById(
            selectedHalaqa._id
        )


    selectedHalaqa =
        updatedHalaqa


    const index =
        allHalaqas.findIndex(
            halaqa =>
                halaqa._id ===
                updatedHalaqa._id
        )


    if (index !== -1) {

        allHalaqas[index] =
            updatedHalaqa
    }


    renderHalaqaDetails(
        updatedHalaqa
    )


    filterHalaqas()

    renderStatistics(
        allHalaqas
    )


    return updatedHalaqa
}


/* =========================
   View Halaqa
========================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".view-halaqa-btn"
            )


        if (!button) return


        const halaqaId =
            button.dataset.halaqaId


        const halaqa =
            allHalaqas.find(
                halaqa =>
                    halaqa._id ===
                    halaqaId
            )


        if (!halaqa) return


        renderHalaqaDetails(
            halaqa
        )
    }
)


/* =========================
   Close Details
========================= */

function closeHalaqaDetails() {

    const modal =
        document.getElementById(
            "halaqa-details-modal"
        )


    modal.classList.add(
        "hidden"
    )

    modal.classList.remove(
        "flex"
    )

    selectedHalaqa = null
}


document
    .getElementById(
        "close-halaqa-details"
    )
    .addEventListener(
        "click",
        closeHalaqaDetails
    )


/* =========================
   Filter
========================= */

function filterHalaqas() {

    const searchValue =
        document
            .getElementById(
                "search-halaqa"
            )
            .value
            .trim()
            .toLowerCase()


    const statusValue =
        document
            .getElementById(
                "status-filter"
            )
            .value


    const filteredHalaqas =
        allHalaqas.filter(
            halaqa => {

                const halaqaName =
                    (
                        halaqa.name ||
                        ""
                    ).toLowerCase()


                const teacherName =
                    getTeacherName(
                        halaqa.teacher
                    ).toLowerCase()


                const matchesSearch =
                    halaqaName.includes(
                        searchValue
                    ) ||
                    teacherName.includes(
                        searchValue
                    )


                const matchesStatus =
                    statusValue === "all" ||
                    (
                        statusValue === "active" &&
                        halaqa.isActive === true
                    ) ||
                    (
                        statusValue === "inactive" &&
                        halaqa.isActive === false
                    )


                return (
                    matchesSearch &&
                    matchesStatus
                )
            }
        )


    renderHalaqas(
        filteredHalaqas
    )


    document
        .getElementById(
            "filtered-halaqas-count"
        )
        .textContent =
            filteredHalaqas.length
}


/* =========================
   Student Options
========================= */

function renderStudentOptions() {

    const select =
        document.getElementById(
            "student-select"
        )


    select.innerHTML = `
        <option value="">
            اختر الطالب
        </option>
    `


    const currentStudentIds =
        selectedHalaqa?.students?.map(
            student =>
                student._id
        ) || []


    const availableStudents =
        allUsers.filter(
            student =>
                student.role === "student" &&
                !currentStudentIds.includes(
                    student._id
                )
        )


    availableStudents.forEach(
        student => {

            const option =
                document.createElement(
                    "option"
                )


            option.value =
                student._id


            option.textContent =
                `${student.firstName || student.name || "-"} ${student.lastName || ""}`


            select.appendChild(
                option
            )
        }
    )


    if (
        availableStudents.length === 0
    ) {

        select.innerHTML = `
            <option value="">
                لا يوجد طلاب متاحون للإضافة
            </option>
        `
    }
}


/* =========================
   Add Student Modal
========================= */

document
    .getElementById(
        "add-student-btn"
    )
    .addEventListener(
        "click",
        () => {

            if (!selectedHalaqa) {
                return
            }


            renderStudentOptions()

            const detailsModal =
                document.getElementById(
                    "halaqa-details-modal"
                )
            if (detailsModal) {
                detailsModal.classList.add("hidden")
                detailsModal.classList.remove("flex")
            }

            const modal =
                document.getElementById(
                    "add-student-modal"
                )

            modal.classList.add(
                "z-50"
            )

            modal.classList.remove(
                "hidden"
            )

            modal.classList.add(
                "flex"
            )
        }
    )


/* =========================
   Close Add Student Modal
========================= */

function closeAddStudentModal() {

    const modal =
        document.getElementById(
            "add-student-modal"
        )

    modal.classList.add(
        "hidden"
    )

    modal.classList.remove(
        "flex"
    )

    document
        .getElementById(
            "student-select"
        )
        .value = ""

    document
        .getElementById(
            "add-student-error"
        )
        .classList.add(
            "hidden"
        )

    if (selectedHalaqa) {
        const detailsModal =
            document.getElementById(
                "halaqa-details-modal"
            )
        if (detailsModal) {
            detailsModal.classList.remove("hidden")
            detailsModal.classList.add("flex")
        }
    }
}


document
    .getElementById(
        "close-add-student"
    )
    .addEventListener(
        "click",
        closeAddStudentModal
    )


document
    .getElementById(
        "cancel-add-student"
    )
    .addEventListener(
        "click",
        closeAddStudentModal
    )


/* =========================
   Confirm Add Student
========================= */

document
    .getElementById(
        "confirm-add-student"
    )
    .addEventListener(
        "click",
        async () => {

            const button =
                document.getElementById(
                    "confirm-add-student"
                )


            const select =
                document.getElementById(
                    "student-select"
                )


            const errorElement =
                document.getElementById(
                    "add-student-error"
                )


            const studentId =
                select.value


            errorElement.classList.add(
                "hidden"
            )


            if (!selectedHalaqa) {
                return
            }


            if (!studentId) {

                errorElement.textContent =
                    "يرجى اختيار طالب"

                errorElement.classList.remove(
                    "hidden"
                )

                return
            }


            try {

                button.disabled = true

                button.textContent =
                    "جاري الإضافة..."


                await addStudentToHalaqa(
                    selectedHalaqa._id,
                    studentId
                )


                await refreshSelectedHalaqa()


                closeAddStudentModal()

            } catch (err) {

                console.error(
                    "Error adding student:",
                    err
                )


                errorElement.textContent =
                    err.message ||
                    "حدث خطأ أثناء إضافة الطالب"


                errorElement.classList.remove(
                    "hidden"
                )

            } finally {

                button.disabled = false

                button.textContent =
                    "إضافة الطالب"
            }
        }
    )


/* =========================
   Remove Student
========================= */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                ".remove-student-btn"
            )


        if (!button) return

        if (!selectedHalaqa) return


        const studentId =
            button.dataset.studentId


        if (!studentId) return


        const confirmed =
            confirm(
                "هل أنت متأكد من إزالة الطالب من الحلقة؟"
            )


        if (!confirmed) {
            return
        }


        try {

            button.disabled = true

            button.textContent =
                "جاري الإزالة..."


            await removeStudentFromHalaqa(
                selectedHalaqa._id,
                studentId
            )


            await refreshSelectedHalaqa()

        } catch (err) {

            console.error(
                "Error removing student:",
                err
            )


            alert(
                err.message ||
                "حدث خطأ أثناء إزالة الطالب"
            )


            button.disabled = false

            button.textContent =
                "إزالة"
        }
    }
)


/* =========================
   Add Halaqa
========================= */

document
    .getElementById(
        "add-halaqa-btn"
    )
    .addEventListener(
        "click",
        () => {

            editingHalaqa = null


            document
                .getElementById(
                    "halaqa-form-title"
                )
                .textContent =
                    "إضافة حلقة"


            document
                .getElementById(
                    "halaqa-name"
                )
                .value = ""


            document
                .getElementById(
                    "halaqa-schedule"
                )
                .value = ""


            renderTeacherOptions()


            document
                .getElementById(
                    "halaqa-form-error"
                )
                .classList.add(
                    "hidden"
                )


            /*
                مودل الإضافة فوق أي مودل آخر
            */

            const modal =
                document.getElementById(
                    "halaqa-form-modal"
                )


            modal.classList.add(
                "z-50"
            )


            openHalaqaFormModal()
        }
    )


/* =========================
   Edit Halaqa
========================= */

document
    .getElementById(
        "edit-halaqa-btn"
    )
    .addEventListener(
        "click",
        () => {

            if (!selectedHalaqa) {
                return
            }


            editingHalaqa =
                selectedHalaqa


            document
                .getElementById(
                    "halaqa-form-title"
                )
                .textContent =
                    "تعديل الحلقة"


            document
                .getElementById(
                    "halaqa-name"
                )
                .value =
                    selectedHalaqa.name || ""


            const teacherId =
                selectedHalaqa.teacher?._id ||
                selectedHalaqa.teacher ||
                ""


            renderTeacherOptions(
                teacherId
            )


            document
                .getElementById(
                    "halaqa-schedule"
                )
                .value =
                    Array.isArray(
                        selectedHalaqa.schedule
                    )
                        ? selectedHalaqa.schedule.join(
                            " - "
                        )
                        : selectedHalaqa.schedule || ""


            document
                .getElementById(
                    "halaqa-form-error"
                )
                .classList.add(
                    "hidden"
                )


            /*
                مودل التعديل فوق مودل التفاصيل
            */

            const modal =
                document.getElementById(
                    "halaqa-form-modal"
                )


            modal.classList.add(
                "z-50"
            )


            openHalaqaFormModal()
        }
    )


/* =========================
   Open Form Modal
========================= */

function openHalaqaFormModal() {

    if (selectedHalaqa) {
        const detailsModal =
            document.getElementById(
                "halaqa-details-modal"
            )
        if (detailsModal) {
            detailsModal.classList.add("hidden")
            detailsModal.classList.remove("flex")
        }
    }

    const modal =
        document.getElementById(
            "halaqa-form-modal"
        )

    modal.classList.add(
        "z-50"
    )

    modal.classList.remove(
        "hidden"
    )

    modal.classList.add(
        "flex"
    )
}


/* =========================
   Close Form Modal
========================= */

function closeHalaqaFormModal() {

    const modal =
        document.getElementById(
            "halaqa-form-modal"
        )

    modal.classList.add(
        "hidden"
    )

    modal.classList.remove(
        "flex"
    )

    document
        .getElementById(
            "halaqa-form-error"
        )
        .classList.add(
            "hidden"
        )

    if (selectedHalaqa) {
        const detailsModal =
            document.getElementById(
                "halaqa-details-modal"
            )
        if (detailsModal) {
            detailsModal.classList.remove("hidden")
            detailsModal.classList.add("flex")
        }
    }
}


/* =========================
   Close Form
========================= */

document
    .getElementById(
        "close-halaqa-form"
    )
    .addEventListener(
        "click",
        closeHalaqaFormModal
    )


document
    .getElementById(
        "cancel-halaqa-form"
    )
    .addEventListener(
        "click",
        closeHalaqaFormModal
    )


/* =========================
   Save Halaqa
========================= */

document
    .getElementById(
        "halaqa-form"
    )
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault()


            const saveButton =
                document.getElementById(
                    "save-halaqa-btn"
                )


            const errorElement =
                document.getElementById(
                    "halaqa-form-error"
                )


            const name =
                document
                    .getElementById(
                        "halaqa-name"
                    )
                    .value
                    .trim()


            const teacher =
                document
                    .getElementById(
                        "halaqa-teacher"
                    )
                    .value


            const scheduleText =
                document
                    .getElementById(
                        "halaqa-schedule"
                    )
                    .value
                    .trim()


            errorElement.classList.add(
                "hidden"
            )


            if (!name) {

                errorElement.textContent =
                    "يرجى إدخال اسم الحلقة"

                errorElement.classList.remove(
                    "hidden"
                )

                return
            }


            if (!teacher) {

                errorElement.textContent =
                    "يرجى اختيار المعلم"

                errorElement.classList.remove(
                    "hidden"
                )

                return
            }


            const schedule =
                scheduleText
                    ? scheduleText
                        .split("-")
                        .map(
                            item =>
                                item.trim()
                        )
                        .filter(Boolean)
                    : []


            const isEditing =
                Boolean(editingHalaqa)


            /*
                نحفظ ID قبل أي تغيير
            */

            const editedHalaqaId =
                isEditing
                    ? editingHalaqa._id
                    : null


            try {

                saveButton.disabled = true

                saveButton.textContent =
                    isEditing
                        ? "جاري التعديل..."
                        : "جاري الحفظ..."


                if (isEditing) {

                    await updateHalaqa(
                        editedHalaqaId,
                        {
                            name,
                            teacher,
                            schedule
                        }
                    )

                } else {

                    await createHalaqa(
                        name,
                        teacher,
                        schedule
                    )
                }


                /*
                    نغلق مودل التعديل فقط
                    والتفاصيل تبقى مفتوحة
                */

                closeHalaqaFormModal()


                /*
                    إعادة تحميل القائمة
                */

                await loadHalaqas()


                /*
                    إذا كان تعديل:
                    نجيب البيانات الجديدة
                    ونفتح/نحدث التفاصيل
                */

                if (editedHalaqaId) {

                    const updatedHalaqa =
                        await getHalaqaById(
                            editedHalaqaId
                        )


                    const index =
                        allHalaqas.findIndex(
                            halaqa =>
                                halaqa._id ===
                                editedHalaqaId
                        )


                    if (index !== -1) {

                        allHalaqas[index] =
                            updatedHalaqa
                    }


                    selectedHalaqa =
                        updatedHalaqa


                    renderStatistics(
                        allHalaqas
                    )


                    filterHalaqas()


                    renderHalaqaDetails(
                        updatedHalaqa
                    )
                }

            } catch (err) {

                console.error(
                    "Error saving halaqa:",
                    err
                )


                errorElement.textContent =
                    err.message ||
                    "حدث خطأ أثناء حفظ الحلقة"


                errorElement.classList.remove(
                    "hidden"
                )

            } finally {

                saveButton.disabled = false

                saveButton.textContent =
                    "حفظ الحلقة"

                editingHalaqa = null
            }
        }
    )


/* =========================
   Toggle Halaqa Status
========================= */

document
    .getElementById(
        "toggle-halaqa-status-btn"
    )
    .addEventListener(
        "click",
        async () => {

            if (!selectedHalaqa) {
                return
            }


            const button =
                document.getElementById(
                    "toggle-halaqa-status-btn"
                )


            const newStatus =
                !selectedHalaqa.isActive


            const actionText =
                newStatus
                    ? "تفعيل"
                    : "تعطيل"


            const confirmed =
                confirm(
                    `هل أنت متأكد من ${actionText} الحلقة؟`
                )


            if (!confirmed) {
                return
            }


            try {

                button.disabled = true

                button.textContent =
                    `جاري ${actionText}...`


                await updateHalaqaStatus(
                    selectedHalaqa._id,
                    newStatus
                )


                await refreshSelectedHalaqa()

            } catch (err) {

                console.error(
                    "Error updating halaqa status:",
                    err
                )


                alert(
                    err.message ||
                    `حدث خطأ أثناء ${actionText} الحلقة`
                )

            } finally {

                button.disabled = false


                if (selectedHalaqa) {

                    updateToggleStatusButton(
                        selectedHalaqa
                    )
                }
            }
        }
    )


/* =========================
   Admin Info
========================= */

function loadAdminInfo() {

    const user = getUser()

    if (!user) return


    document
        .getElementById(
            "admin-name"
        )
        .textContent =
            user.name || "-"


    document
        .getElementById(
            "admin-avatar"
        )
        .textContent =
            user.name
                ? user.name.charAt(0)
                : "A"
}


/* =========================
   Search
========================= */

document
    .getElementById(
        "search-halaqa"
    )
    .addEventListener(
        "input",
        filterHalaqas
    )


document
    .getElementById(
        "status-filter"
    )
    .addEventListener(
        "change",
        filterHalaqas
    )


/* =========================
   Sidebar & Logout
========================= */

function setupSidebar() {
    const menuBtn = document.getElementById("menu-btn")
    const sidebar = document.getElementById("sidebar")
    const overlay = document.getElementById("sidebar-overlay")

    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener("click", () => {
            const isClosed = sidebar.classList.contains("translate-x-full")
            if (isClosed) {
                sidebar.classList.remove("translate-x-full")
                overlay.classList.remove("hidden")
            } else {
                sidebar.classList.add("translate-x-full")
                overlay.classList.add("hidden")
            }
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

    const logoutBtn = document.getElementById("logout-btn")
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
                logout()
            }
        })
    }
}


/* =========================
   Initial Load
========================= */

setupSidebar()
setupModalLayers()
loadHalaqas()
loadUsers()
loadAdminInfo()