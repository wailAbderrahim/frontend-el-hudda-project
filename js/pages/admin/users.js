
import {
    getUsers,
    updateUser,
    updateUserStatus
} from "../../api/usersApi.js"

import { getUser, protectPage, logout } from "../../auth/auth.js"
import { getStudentProgress } from "../../api/progressApi.js"
import { initNotificationBell } from "../../components/notificationBell.js"

protectPage("admin")


let allUsers = []
let selectedUser = null


/* =========================
   Helpers
========================= */

function getRoleLabel(role) {

    if (role === 'admin') return 'مدير'
    if (role === 'teacher') return 'معلم'
    if (role === 'student') return 'طالب'

    return '-'
}


function getEvaluationTypeLabel(type) {

    if (type === 'memorization') return 'حفظ'
    if (type === 'recitation') return 'تسميع'
    if (type === 'tajweed') return 'تجويد'

    return '-'
}


function formatDate(date) {

    if (!date) return '-'

    return new Date(date).toLocaleDateString('ar-DZ')
}


function formatScore(score) {

    if (score === null || score === undefined) {
        return '-'
    }

    return `${score}/10`
}


/* =========================
   Load Users
========================= */

async function loadUsers() {

    try {

        const users = await getUsers()

        allUsers = users

        document
            .getElementById('users-loading')
            .classList.add('hidden')

        document
            .getElementById('users-table-container')
            .classList.remove('hidden')

        renderStatistics(users)
        renderUsers(users)

        document.getElementById(
            'filtered-users-count'
        ).textContent = users.length

    } catch (err) {

        console.error('Error loading users:', err)

        document
            .getElementById('users-loading')
            .classList.add('hidden')

        document
            .getElementById('users-error')
            .classList.remove('hidden')

        document
            .getElementById('users-error-message')
            .textContent =
                err.message || 'حدث خطأ أثناء تحميل المستخدمين'

    }

}


/* =========================
   Statistics
========================= */

function renderStatistics(users) {

    const usersCount =
        document.getElementById('users-count')

    const studentsCount =
        document.getElementById('students-count')

    const teachersCount =
        document.getElementById('teachers-count')


    const students =
        users.filter(user => user.role === 'student')

    const teachers =
        users.filter(user => user.role === 'teacher')


    usersCount.textContent = users.length
    studentsCount.textContent = students.length
    teachersCount.textContent = teachers.length

}


/* =========================
   Render Users
========================= */

function renderUsers(users) {

    const tableBody =
        document.getElementById('users-table-body')

    const emptyState =
        document.getElementById('users-empty')

    const tableContainer =
        document.getElementById('users-table-container')


    tableBody.innerHTML = ''


    if (users.length === 0) {

        tableContainer.classList.add('hidden')
        emptyState.classList.remove('hidden')

        return
    }


    emptyState.classList.add('hidden')
    tableContainer.classList.remove('hidden')


    users.forEach(user => {

        const row =
            document.createElement('tr')


        row.innerHTML = `

            <td class="px-6 py-4">

                <div class="font-semibold text-slate-700">
                    ${user.firstName || user.name || '-'}
                    ${user.lastName || ''}
                </div>

            </td>


            <td class="px-6 py-4 text-sm text-slate-600">
                ${user.email || '-'}
            </td>


            <td class="px-6 py-4 text-sm text-slate-600">
                ${user.phone || '-'}
            </td>


            <td class="px-6 py-4">

                <span class="text-sm font-medium">
                    ${getRoleLabel(user.role)}
                </span>

            </td>


            <td class="px-6 py-4">
                ${user.educationLevel || '-'}
            </td>


            <td class="px-6 py-4">

                <span
                    class="text-sm font-medium ${
                        user.isActive
                            ? 'text-emerald-600'
                            : 'text-red-500'
                    }">

                    ${
                        user.isActive
                            ? 'نشط'
                            : 'غير نشط'
                    }

                </span>

            </td>


            <td class="px-6 py-4">

                <span
                    class="text-sm font-medium ${
                        user.isVerified
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                    }">

                    ${
                        user.isVerified
                            ? 'مؤكد'
                            : 'غير مؤكد'
                    }

                </span>

            </td>


            <td class="px-6 py-4">

                <button
                    type="button"
                    class="view-user-btn rounded-lg px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                    data-user-id="${user._id}"
                >
                    عرض التفاصيل
                </button>

            </td>

        `


        tableBody.appendChild(row)

    })

}


/* =========================
   Filters
========================= */

function filterUsers() {

    const searchValue =
        document
            .getElementById('search-user')
            .value
            .trim()
            .toLowerCase()


    const roleValue =
        document.getElementById('role-filter').value


    const statusValue =
        document.getElementById('status-filter').value


    const filteredUsers =
        allUsers.filter(user => {

            const fullName = `
                ${user.name || ''}
                ${user.firstName || ''}
                ${user.lastName || ''}
            `.toLowerCase()


            const email =
                (user.email || '').toLowerCase()


            const matchesSearch =
                fullName.includes(searchValue) ||
                email.includes(searchValue)


            const matchesRole =
                roleValue === 'all' ||
                user.role === roleValue


            const matchesStatus =
                statusValue === 'all' ||
                (
                    statusValue === 'active' &&
                    user.isActive === true
                ) ||
                (
                    statusValue === 'inactive' &&
                    user.isActive === false
                )


            return (
                matchesSearch &&
                matchesRole &&
                matchesStatus
            )

        })


    renderUsers(filteredUsers)


    document.getElementById(
        'filtered-users-count'
    ).textContent = filteredUsers.length

}


/* =========================
   Filter Events
========================= */

document
    .getElementById('search-user')
    .addEventListener('input', filterUsers)

document
    .getElementById('role-filter')
    .addEventListener('change', filterUsers)

document
    .getElementById('status-filter')
    .addEventListener('change', filterUsers)


/* =========================
   Admin Info
========================= */

function loadAdminInfo() {

    const user = getUser()

    if (!user) return


    const adminName =
        document.getElementById('admin-name')

    const adminAvatar =
        document.getElementById('admin-avatar')


    adminName.textContent =
        user.name || '-'


    adminAvatar.textContent =
        user.name
            ? user.name.charAt(0)
            : 'أ'

}


/* =========================
   Open User Modal
========================= */

document.addEventListener('click', event => {

    const button =
        event.target.closest('.view-user-btn')


    if (!button) return


    const userId =
        button.dataset.userId


    const user =
        allUsers.find(
            user => user._id === userId
        )


    if (!user) return


    openUserModal(user)

})


/* =========================
   Reset Student Progress
========================= */

function resetStudentProgress() {

    const ids = [

        'progress-halaqa-name',
        'progress-halaqa-teacher',

        'progress-attendance-total',
        'progress-present',
        'progress-absent',
        'progress-late',
        'progress-attendance-rate',

        'progress-memorization-total',
        'progress-last-surah',
        'progress-last-memorization-date',
        'progress-last-from-verse',
        'progress-last-to-verse',

        'progress-evaluations-total',
        'progress-average-score',
        'progress-last-evaluation-type',
        'progress-last-evaluation-score',
        'progress-last-evaluation-notes',
        'progress-last-evaluation-date'

    ]


    ids.forEach(id => {

        const element =
            document.getElementById(id)

        if (element) {
            element.textContent = '-'
        }

    })

}


/* =========================
   Render Student Progress
========================= */

function renderStudentProgress(progress) {

    const halaqa =
        progress.halaqa

    const attendance =
        progress.attendance

    const memorization =
        progress.memorization

    const evaluations =
        progress.evaluations


    const lastMemorization =
        memorization?.last

    const lastEvaluation =
        evaluations?.last


    /* =========================
       Halaqa
    ========================= */

    document.getElementById(
        'progress-halaqa-name'
    ).textContent =
        halaqa?.name || 'غير معين'


    document.getElementById(
        'progress-halaqa-teacher'
    ).textContent =

        halaqa?.teacher?.name ||
        halaqa?.teacher?.firstName ||
        halaqa?.teacher ||
        'غير معين'


    /* =========================
       Attendance
    ========================= */

    document.getElementById(
        'progress-attendance-total'
    ).textContent =
        attendance?.total ?? 0


    document.getElementById(
        'progress-present'
    ).textContent =
        attendance?.present ?? 0


    document.getElementById(
        'progress-absent'
    ).textContent =
        attendance?.absent ?? 0


    document.getElementById(
        'progress-late'
    ).textContent =
        attendance?.late ?? 0


    document.getElementById(
        'progress-attendance-rate'
    ).textContent =
        `${attendance?.attendanceRate ?? 0}%`


    /* =========================
       Memorization
    ========================= */

    document.getElementById(
        'progress-memorization-total'
    ).textContent =
        memorization?.total ?? 0


    document.getElementById(
        'progress-last-surah'
    ).textContent =
        lastMemorization?.surah || 'لا يوجد'


    document.getElementById(
        'progress-last-memorization-date'
    ).textContent =
        formatDate(
            lastMemorization?.date
        )


    document.getElementById(
        'progress-last-from-verse'
    ).textContent =
        lastMemorization?.fromVerse ?? '-'


    document.getElementById(
        'progress-last-to-verse'
    ).textContent =
        lastMemorization?.toVerse ?? '-'


    /* =========================
       Evaluations
    ========================= */

    document.getElementById(
        'progress-evaluations-total'
    ).textContent =
        evaluations?.total ?? 0


    document.getElementById(
        'progress-average-score'
    ).textContent =

        typeof evaluations?.averageScore === 'number'
            ? evaluations.averageScore.toFixed(2)
            : '0'


    document.getElementById(
        'progress-last-evaluation-type'
    ).textContent =
        getEvaluationTypeLabel(
            lastEvaluation?.type
        )


    document.getElementById(
        'progress-last-evaluation-score'
    ).textContent =
        formatScore(
            lastEvaluation?.score
        )


    document.getElementById(
        'progress-last-evaluation-notes'
    ).textContent =
        lastEvaluation?.notes ||
        'لا توجد ملاحظات'


    document.getElementById(
        'progress-last-evaluation-date'
    ).textContent =
        formatDate(
            lastEvaluation?.date
        )

}


/* =========================
   Update Modal User Info
========================= */

function updateModalUserInfo(user) {

    document.getElementById(
        'modal-role'
    ).textContent =
        getRoleLabel(user.role)


    document.getElementById(
        'modal-status'
    ).textContent =
        user.isActive
            ? 'نشط'
            : 'غير نشط'


    document.getElementById(
        'modal-verified'
    ).textContent =
        user.isVerified
            ? 'مؤكد'
            : 'غير مؤكد'


    document.getElementById(
        'modal-role-select'
    ).value =
        user.role


    updateStatusButton(user)

}


/* =========================
   Update Status Button
========================= */

function updateStatusButton(user) {

    const button =
        document.getElementById(
            'toggle-status-btn'
        )


    const description =
        document.getElementById(
            'modal-status-description'
        )


    if (user.isActive) {

        description.textContent =
            'الحساب نشط حاليا'

        button.textContent =
            'تعطيل الحساب'

        button.classList.remove(
            'bg-emerald-600',
            'hover:bg-emerald-700'
        )

        button.classList.add(
            'bg-red-600',
            'hover:bg-red-700'
        )

    } else {

        description.textContent =
            'الحساب معطل حاليا'

        button.textContent =
            'تفعيل الحساب'

        button.classList.remove(
            'bg-red-600',
            'hover:bg-red-700'
        )

        button.classList.add(
            'bg-emerald-600',
            'hover:bg-emerald-700'
        )

    }

}


/* =========================
   Open User Modal
========================= */

async function openUserModal(user) {

    selectedUser = user


    /* =========================
       Personal Information
    ========================= */

    document.getElementById(
        'modal-name'
    ).textContent =
        user.name || '-'


    document.getElementById(
        'modal-first-name'
    ).textContent =
        user.firstName || '-'


    document.getElementById(
        'modal-last-name'
    ).textContent =
        user.lastName || '-'


    document.getElementById(
        'modal-phone'
    ).textContent =
        user.phone || '-'


    document.getElementById(
        'modal-email'
    ).textContent =
        user.email || '-'


    document.getElementById(
        'modal-education'
    ).textContent =
        user.educationLevel || '-'


    document.getElementById(
        'modal-birth-place'
    ).textContent =
        user.placeOfBirth || '-'


    document.getElementById(
        'modal-birth-municipality'
    ).textContent =
        user.municipalityOfBirth || '-'


    /* =========================
       Account Information
    ========================= */

    document.getElementById(
        'modal-created-at'
    ).textContent =
        formatDate(user.createdAt)


    updateModalUserInfo(user)


    /* =========================
       Student Progress
    ========================= */

    const progressSection =
        document.getElementById(
            'student-progress-section'
        )


    resetStudentProgress()

    progressSection.classList.add('hidden')


    if (user.role === 'student') {

        progressSection.classList.remove('hidden')

    }


    /* =========================
       Open Modal
    ========================= */

    const modal =
        document.getElementById('user-modal')


    modal.classList.remove('hidden')
    modal.classList.add('flex')


    /* =========================
       Load Progress
    ========================= */

    if (user.role === 'student') {

        try {

            const progress =
                await getStudentProgress(
                    user._id
                )


            if (
                !selectedUser ||
                selectedUser._id !== user._id
            ) {
                return
            }


            renderStudentProgress(progress)

        } catch (err) {

            console.error(
                'Error loading student progress:',
                err
            )

        }

    }

}


/* =========================
   Change Role
========================= */

document
    .getElementById('change-role-btn')
    .addEventListener('click', async () => {

        if (!selectedUser) return


        const select =
            document.getElementById(
                'modal-role-select'
            )


        const newRole =
            select.value


        if (
            newRole === selectedUser.role
        ) {
            return
        }


        const button =
            document.getElementById(
                'change-role-btn'
            )


        try {

            button.disabled = true

            button.textContent =
                'جاري التغيير...'


            const updatedUser =
                await updateUser(
                    selectedUser._id,
                    {
                        role: newRole
                    }
                )


            const index =
                allUsers.findIndex(
                    user =>
                        user._id === selectedUser._id
                )


            if (index !== -1) {

                allUsers[index] = {
                    ...allUsers[index],
                    ...updatedUser
                }

                selectedUser =
                    allUsers[index]

            }


            updateModalUserInfo(
                selectedUser
            )


            renderStatistics(allUsers)
            filterUsers()


            alert(
                'تم تغيير دور المستخدم بنجاح'
            )


        } catch (err) {

            console.error(
                'Error changing role:',
                err
            )


            alert(
                err.message ||
                'حدث خطأ أثناء تغيير الدور'
            )

        } finally {

            button.disabled = false

            button.textContent =
                'تغيير الدور'

        }

    })


/* =========================
   Toggle User Status
========================= */

document
    .getElementById('toggle-status-btn')
    .addEventListener('click', async () => {

        if (!selectedUser) return


        const button =
            document.getElementById(
                'toggle-status-btn'
            )


        const newStatus =
            !selectedUser.isActive


        try {

            button.disabled = true

            button.textContent =
                'جاري التحديث...'


            const updatedUser =
                await updateUserStatus(
                    selectedUser._id,
                    newStatus
                )


            const index =
                allUsers.findIndex(
                    user =>
                        user._id === selectedUser._id
                )


            if (index !== -1) {

                allUsers[index] = {
                    ...allUsers[index],
                    ...updatedUser
                }

                selectedUser =
                    allUsers[index]

            }


            updateModalUserInfo(
                selectedUser
            )


            renderStatistics(allUsers)
            filterUsers()


            alert(
                newStatus
                    ? 'تم تفعيل الحساب بنجاح'
                    : 'تم تعطيل الحساب بنجاح'
            )


        } catch (err) {

            console.error(
                'Error updating user status:',
                err
            )


            alert(
                err.message ||
                'حدث خطأ أثناء تحديث حالة الحساب'
            )

        } finally {

            button.disabled = false

            updateStatusButton(
                selectedUser
            )

        }

    })


/* =========================
   Close Modal
========================= */

function closeUserModal() {

    const modal =
        document.getElementById(
            'user-modal'
        )


    modal.classList.add('hidden')
    modal.classList.remove('flex')


    selectedUser = null

}


/* =========================
   Close Button
========================= */

document
    .getElementById('close-user-modal')
    .addEventListener(
        'click',
        closeUserModal
    )


/* =========================
   Click Outside
========================= */

document
    .getElementById('user-modal')
    .addEventListener(
        'click',
        event => {

            if (
                event.target.id === 'user-modal'
            ) {

                closeUserModal()

            }

        }
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
initNotificationBell()
loadUsers()
loadAdminInfo()

