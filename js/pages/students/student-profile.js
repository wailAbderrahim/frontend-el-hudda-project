import { protectPage, logout } from "../../auth/auth.js"
import { getProfile, updateProfile, changePassword } from "../../api/usersApi.js"
import { getStudentProgress } from "../../api/progressApi.js"

// Restrict to student role
protectPage("student")

// State
let currentProfile = null
let currentProgress = null

// DOM Elements
const sidebar = document.getElementById("sidebar")
const sidebarOverlay = document.getElementById("sidebar-overlay")
const menuBtn = document.getElementById("menu-btn")
const logoutBtn = document.getElementById("logout-btn")
const statusAlert = document.getElementById("status-alert")

const profileLoading = document.getElementById("profile-loading")
const profileContent = document.getElementById("profile-content")

// Header Elements
const studentNameHeader = document.getElementById("student-name-header")
const studentAvatarHeader = document.getElementById("student-avatar-header")

// Display Elements
const studentAvatarBadge = document.getElementById("student-avatar-badge")
const displayStudentName = document.getElementById("display-student-name")
const displayStudentEmail = document.getElementById("display-student-email")
const displayStudentPhone = document.getElementById("display-student-phone")
const displayStudentEducation = document.getElementById("display-student-education")
const displayStudentBirth = document.getElementById("display-student-birth")

// Halaqa Elements
const halaqaNameVal = document.getElementById("halaqa-name-val")
const halaqaTeacherVal = document.getElementById("halaqa-teacher-val")
const halaqaScheduleVal = document.getElementById("halaqa-schedule-val")

// Metrics Elements
const metricAttRate = document.getElementById("metric-att-rate")
const metricAttPresent = document.getElementById("metric-att-present")
const metricAttAbsent = document.getElementById("metric-att-absent")
const metricAttLate = document.getElementById("metric-att-late")

const metricMemCount = document.getElementById("metric-mem-count")
const metricMemLast = document.getElementById("metric-mem-last")

const metricEvalAvg = document.getElementById("metric-eval-avg")
const metricEvalTotal = document.getElementById("metric-eval-total")
const metricEvalLast = document.getElementById("metric-eval-last")

// Form Inputs
const inputStudName = document.getElementById("input-stud-name")
const inputStudFirstName = document.getElementById("input-stud-firstname")
const inputStudLastName = document.getElementById("input-stud-lastname")
const inputStudPhone = document.getElementById("input-stud-phone")
const inputStudEmail = document.getElementById("input-stud-email")

const editStudentForm = document.getElementById("edit-student-form")
const changeStudPasswordForm = document.getElementById("change-stud-password-form")
const btnSaveStudProfile = document.getElementById("btn-save-stud-profile")
const btnSaveStudPass = document.getElementById("btn-save-stud-pass")

/* ===================================================
   ALERTS
=================================================== */
function showAlert(message, type = "success") {
    if (!statusAlert) return
    statusAlert.className = `mb-6 rounded-2xl border p-4 text-xs font-semibold shadow-sm transition ${
        type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
    }`
    statusAlert.textContent = message
    statusAlert.classList.remove("hidden")

    setTimeout(() => {
        statusAlert.classList.add("hidden")
    }, 4500)
}

/* ===================================================
   SIDEBAR & LOGOUT
=================================================== */
function setupSidebar() {
    if (menuBtn && sidebar && sidebarOverlay) {
        menuBtn.addEventListener("click", () => {
            const isClosed = sidebar.classList.contains("translate-x-full")
            if (isClosed) {
                sidebar.classList.remove("translate-x-full")
                sidebarOverlay.classList.remove("hidden")
            } else {
                sidebar.classList.add("translate-x-full")
                sidebarOverlay.classList.add("hidden")
            }
        })

        const closeSidebar = () => {
            sidebar.classList.add("translate-x-full")
            sidebarOverlay.classList.add("hidden")
        }

        sidebarOverlay.addEventListener("click", closeSidebar)
        sidebar.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeSidebar)
        })
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
                logout()
            }
        })
    }
}

/* ===================================================
   POPULATE DATA
=================================================== */
function populateStudentData(profile, progress) {
    currentProfile = profile
    currentProgress = progress

    const initial = profile.firstName ? profile.firstName.charAt(0) : (profile.name ? profile.name.charAt(0) : "ط")
    const fullName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "طالب قرآن"

    // 1. Header
    if (studentNameHeader) studentNameHeader.textContent = fullName
    if (studentAvatarHeader) studentAvatarHeader.textContent = initial

    // 2. Identity Card
    if (studentAvatarBadge) studentAvatarBadge.textContent = initial
    if (displayStudentName) displayStudentName.textContent = fullName
    if (displayStudentEmail) displayStudentEmail.textContent = profile.email || "—"
    if (displayStudentPhone) displayStudentPhone.textContent = profile.phone || "—"
    if (displayStudentEducation) displayStudentEducation.textContent = profile.educationLevel || "—"

    const birth = [profile.placeOfBirth, profile.municipalityOfBirth].filter(Boolean).join(" - ")
    if (displayStudentBirth) displayStudentBirth.textContent = birth || "—"

    // 3. Halaqa Card
    const halaqa = progress?.halaqa
    if (halaqa) {
        if (halaqaNameVal) halaqaNameVal.textContent = halaqa.name || "حلقة قرآنية"
        if (halaqaTeacherVal) {
            const tName = halaqa.teacher?.name || "معلم معتمد"
            halaqaTeacherVal.textContent = tName
        }
        if (halaqaScheduleVal) {
            const sch = Array.isArray(halaqa.schedule) ? halaqa.schedule.join(" - ") : (halaqa.schedule || "حسب الجدول")
            halaqaScheduleVal.textContent = sch
        }
    }

    // 4. Progress Metrics
    const att = progress?.attendance
    if (att) {
        if (metricAttRate) metricAttRate.textContent = `${att.attendanceRate ?? 0}%`
        if (metricAttPresent) metricAttPresent.textContent = att.present ?? 0
        if (metricAttAbsent) metricAttAbsent.textContent = att.absent ?? 0
        if (metricAttLate) metricAttLate.textContent = att.late ?? 0
    }

    const mem = progress?.memorization
    if (mem) {
        if (metricMemCount) metricMemCount.textContent = mem.totalMemorization ?? 0
        if (metricMemLast) {
            if (mem.lastMemorization) {
                const lm = mem.lastMemorization
                metricMemLast.textContent = `سورة ${lm.surah || "—"} (الآيات ${lm.fromVerse || 1} إلى ${lm.toVerse || "—"})`
            } else {
                metricMemLast.textContent = "لا يوجد بعد"
            }
        }
    }

    const ev = progress?.evaluations
    if (ev) {
        if (metricEvalAvg) metricEvalAvg.textContent = `${ev.averageScore ?? 0} / 100`
        if (metricEvalTotal) metricEvalTotal.textContent = ev.totalEvaluations ?? 0
        if (metricEvalLast) {
            if (ev.lastEvaluation) {
                metricEvalLast.textContent = `${ev.lastEvaluation.score ?? 0} / 100`
            } else {
                metricEvalLast.textContent = "—"
            }
        }
    }

    // 5. Fill Edit Form
    if (inputStudName) inputStudName.value = profile.name || ""
    if (inputStudFirstName) inputStudFirstName.value = profile.firstName || ""
    if (inputStudLastName) inputStudLastName.value = profile.lastName || ""
    if (inputStudPhone) inputStudPhone.value = profile.phone || ""
    if (inputStudEmail) inputStudEmail.value = profile.email || ""
}

/* ===================================================
   LOAD DATA
=================================================== */
async function loadStudentProfile() {
    try {
        if (profileLoading) profileLoading.classList.remove("hidden")
        if (profileContent) profileContent.classList.add("hidden")

        const profile = await getProfile()

        let progress = null
        if (profile?._id) {
            try {
                const progRes = await getStudentProgress(profile._id)
                progress = progRes?.data || progRes
            } catch (pErr) {
                console.warn("Could not load student progress:", pErr)
            }
        }

        populateStudentData(profile, progress)

        if (profileLoading) profileLoading.classList.add("hidden")
        if (profileContent) profileContent.classList.remove("hidden")
    } catch (err) {
        console.error("Failed to load student profile:", err)
        if (profileLoading) {
            profileLoading.innerHTML = `
                <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
                    <p>تعذر تحميل بيانات الملف الشخصي: ${err.message || "خطأ غير متوقع"}</p>
                    <button onclick="location.reload()" class="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700">
                        إعادة المحاولة
                    </button>
                </div>
            `
        }
    }
}

/* ===================================================
   FORM HANDLERS
=================================================== */
function setupFormHandlers() {
    // Edit Profile
    if (editStudentForm) {
        editStudentForm.addEventListener("submit", async (e) => {
            e.preventDefault()

            const name = inputStudName.value.trim()
            const firstName = inputStudFirstName.value.trim()
            const lastName = inputStudLastName.value.trim()
            const phone = inputStudPhone.value.trim()

            if (!name || !firstName || !lastName || !phone) {
                showAlert("يرجى ملء جميع الحقول المطلوبة", "error")
                return
            }

            try {
                btnSaveStudProfile.disabled = true
                btnSaveStudProfile.textContent = "جاري الحفظ..."

                const updated = await updateProfile({
                    name,
                    firstName,
                    lastName,
                    phone
                })

                // Update stored user
                const storedUser = localStorage.getItem("user")
                if (storedUser) {
                    try {
                        const parsed = JSON.parse(storedUser)
                        Object.assign(parsed, updated)
                        localStorage.setItem("user", JSON.stringify(parsed))
                    } catch (_) {}
                }

                populateStudentData(updated, currentProgress)
                showAlert("تم حفظ وتحديث بياناتك الشخصية بنجاح")
            } catch (err) {
                console.error(err)
                showAlert(err.message || "حدث خطأ أثناء تحديث البيانات", "error")
            } finally {
                btnSaveStudProfile.disabled = false
                btnSaveStudProfile.textContent = "حفظ التغييرات"
            }
        })
    }

    // Change Password
    if (changeStudPasswordForm) {
        changeStudPasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault()

            const currPass = document.getElementById("input-stud-curr-pass").value
            const newPass = document.getElementById("input-stud-new-pass").value
            const confirmPass = document.getElementById("input-stud-confirm-pass").value

            if (newPass !== confirmPass) {
                showAlert("كلمتا المرور الجديدتان غير متطابقتين", "error")
                return
            }

            if (newPass.length < 6) {
                showAlert("كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل", "error")
                return
            }

            try {
                btnSaveStudPass.disabled = true
                btnSaveStudPass.textContent = "جاري التحديث..."

                await changePassword(currPass, newPass)
                changeStudPasswordForm.reset()
                showAlert("تم تغيير كلمة المرور بنجاح")
            } catch (err) {
                console.error(err)
                showAlert(err.message || "حدث خطأ أثناء تغيير كلمة المرور", "error")
            } finally {
                btnSaveStudPass.disabled = false
                btnSaveStudPass.textContent = "تحديث كلمة المرور"
            }
        })
    }
}

/* ===================================================
   INIT
=================================================== */
setupSidebar()
setupFormHandlers()
loadStudentProfile()
