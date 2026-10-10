
import {
    getUsers,
    updateUser,
    updateUserStatus
} from "../../api/usersApi.js"

import { getUser, protectPage, logout } from "../../auth/auth.js"
import { getStudentProgress } from "../../api/progressApi.js"
import { initNotificationBell } from "../../components/notificationBell.js"
import { parseBirthInfo, formatBirthDate } from "../../utils/birthUtils.js"
import { getLevels, assignStudentLevel } from "../../api/levelsApi.js"

protectPage("admin")


let allUsers = []
let selectedUser = null
let allLevels = []


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


    let teacherDisplayName = 'غير معين'
    const t = halaqa?.teacher
    if (t && typeof t === 'object') {
        teacherDisplayName = t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'غير معين'
    } else if (typeof t === 'string' && !/^[0-9a-fA-F]{24}$/.test(t)) {
        teacherDisplayName = t
    }

    document.getElementById(
        'progress-halaqa-teacher'
    ).textContent = teacherDisplayName

    /* =========================
       Current Educational Level
    ========================= */

    const curLevel = progress.currentLevel
    const lvlNameEl = document.getElementById('progress-current-level')
    const lvlBadgeEl = document.getElementById('progress-level-badge')
    if (lvlNameEl) {
        lvlNameEl.textContent = curLevel ? `${curLevel.name} (المستوى ${curLevel.order})` : 'غير محدد'
    }
    if (lvlBadgeEl) {
        lvlBadgeEl.textContent = curLevel?.passingScore ? `درجة النجاح: ${curLevel.passingScore}` : 'المستوى —'
    }

    const lvlSelect = document.getElementById('progress-assign-level-select')
    if (lvlSelect) {
        lvlSelect.innerHTML = `<option value="">اختر المستوى التعليمي</option>` +
            allLevels.map(lvl => `<option value="${lvl._id}" ${curLevel?._id === lvl._id ? 'selected' : ''}>${lvl.name} (المستوى ${lvl.order})</option>`).join('')
    }

    const histContainer = document.getElementById('progress-level-history-container')
    const histList = document.getElementById('progress-level-history-list')
    const history = progress.levelHistory || []
    if (history.length > 0 && histContainer && histList) {
        histContainer.classList.remove('hidden')
        histList.innerHTML = history.map(h => `
            <div class="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1 text-[10px] text-slate-600 border border-purple-50">
                <span>${h.fromLevel ? h.fromLevel.name : 'البداية'} ➔ <strong class="text-purple-800">${h.toLevel?.name || 'مستوى'}</strong> (${h.reason || 'ترقية'})</span>
                <span class="text-slate-400">${formatDate(h.promotedAt || h.createdAt)}</span>
            </div>
        `).join('')
    } else if (histContainer) {
        histContainer.classList.add('hidden')
    }

    // Matn Progress
    const matnListEl = document.getElementById('progress-matn-list')
    const matns = progress.matnProgress || []
    if (matnListEl) {
        if (matns.length === 0) {
            matnListEl.innerHTML = `<p class="text-slate-400 py-2 text-center text-[11px]">لا توجد متون مسجلة</p>`
        } else {
            matnListEl.innerHTML = matns.map(m => `
                <div class="rounded-xl border border-teal-100 bg-white p-2 text-xs">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-teal-800">${m.matn?.title || 'متن'}</span>
                        <span class="font-bold text-teal-600">${m.completionPercentage || 0}%</span>
                    </div>
                    <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div class="h-full rounded-full bg-teal-600" style="width: ${m.completionPercentage || 0}%"></div>
                    </div>
                    <div class="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                        <span>الباب: ${m.section || '—'}</span>
                        <span>الدرجة: ${m.masteryGrade || '—'}</span>
                    </div>
                </div>
            `).join('')
        }
    }

    // Exam Attempts
    const examsListEl = document.getElementById('progress-exams-list')
    const exams = progress.examAttempts || []
    if (examsListEl) {
        if (exams.length === 0) {
            examsListEl.innerHTML = `<p class="text-slate-400 py-2 text-center text-[11px]">لا توجد امتحانات مسجلة</p>`
        } else {
            examsListEl.innerHTML = exams.map(ea => {
                const passBadge = ea.isPassed
                    ? '<span class="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">ناجح</span>'
                    : '<span class="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">راسب</span>'
                return `
                    <div class="flex items-center justify-between rounded-xl border border-indigo-100 bg-white p-2 text-xs">
                        <div>
                            <p class="font-bold text-slate-800">${ea.exam?.title || 'امتحان'}</p>
                            <span class="text-[10px] text-slate-400">${formatDate(ea.submittedAt || ea.createdAt)}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="font-bold text-indigo-700">${ea.totalScoreAwarded || 0}/${ea.exam?.totalScore || 20}</span>
                            ${passBadge}
                        </div>
                    </div>
                `
            }).join('')
        }
    }

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


    const birthInfo = parseBirthInfo(user)

    const modalBirthDateEl = document.getElementById('modal-birth-date')
    if (modalBirthDateEl) {
        modalBirthDateEl.textContent = formatBirthDate(birthInfo.dateOfBirth)
    }

    document.getElementById(
        'modal-birth-place'
    ).textContent =
        birthInfo.placeOfBirth || '-'


    document.getElementById(
        'modal-birth-municipality'
    ).textContent =
        birthInfo.municipalityOfBirth || '-'


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
   Educational Levels
========================= */

async function loadLevels() {
    try {
        const res = await getLevels()
        allLevels = Array.isArray(res) ? res : res?.data || []
    } catch (e) {
        console.error("Error loading levels in users.js:", e)
        allLevels = []
    }
}

const btnAssignLevel = document.getElementById('btn-progress-assign-level')
if (btnAssignLevel) {
    btnAssignLevel.addEventListener('click', async () => {
        if (!selectedUser || selectedUser.role !== 'student') return
        const newLevelId = document.getElementById('progress-assign-level-select')?.value
        const reason = document.getElementById('progress-assign-level-reason')?.value?.trim() || "ترقية معتمدة من الإدارة"
        if (!newLevelId) {
            alert("يرجى اختيار المستوى التعليمي أولاً")
            return
        }
        try {
            await assignStudentLevel({
                studentId: selectedUser._id,
                newLevelId,
                reason
            })
            alert("تم تعيين / ترقية مستوى الطالب بنجاح")
            const updated = await getStudentProgress(selectedUser._id)
            renderStudentProgress(updated)
        } catch (err) {
            alert("فشل ترقية المستوى: " + err.message)
        }
    })
}


/* =========================
   Initial Load
========================= */

setupSidebar()
initNotificationBell()
loadUsers()
loadAdminInfo()
loadLevels()

