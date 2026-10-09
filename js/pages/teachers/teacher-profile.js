import { protectPage, logout } from "../../auth/auth.js"
import { getProfile, updateProfile, changePassword } from "../../api/usersApi.js"
import { parseBirthInfo, formatBirthDate, formatBirthPlaces } from "../../utils/birthUtils.js"

// Restrict to teacher role
protectPage("teacher")

// State
let currentProfile = null

// DOM Elements
const sidebar = document.getElementById("sidebar")
const sidebarOverlay = document.getElementById("sidebar-overlay")
const menuBtn = document.getElementById("menu-btn")
const logoutBtn = document.getElementById("logout-btn")
const statusAlert = document.getElementById("status-alert")

const profileLoading = document.getElementById("profile-loading")
const profileContent = document.getElementById("profile-content")

// Header Elements
const teacherNameHeader = document.getElementById("teacher-name-header")
const teacherAvatarHeader = document.getElementById("teacher-avatar-header")

// Display Elements
const profileAvatar = document.getElementById("profile-avatar")
const displayName = document.getElementById("display-name")
const displayEmail = document.getElementById("display-email")
const displayPhone = document.getElementById("display-phone")
const displayEducation = document.getElementById("display-education")
const displayBirthDate = document.getElementById("display-birth-date")
const displayBirth = document.getElementById("display-birth")

// Form Inputs
const inputName = document.getElementById("input-name")
const inputFirstName = document.getElementById("input-firstname")
const inputLastName = document.getElementById("input-lastname")
const inputPhone = document.getElementById("input-phone")
const inputEmail = document.getElementById("input-email")

const editProfileForm = document.getElementById("edit-profile-form")
const changePasswordForm = document.getElementById("change-password-form")
const btnSaveProfile = document.getElementById("btn-save-profile")
const btnSavePassword = document.getElementById("btn-save-password")

/* ===================================================
   ALERTS & HELPERS
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
   POPULATE PROFILE
=================================================== */
function populateProfileData(profile) {
    currentProfile = profile
    const initial = profile.firstName ? profile.firstName.charAt(0) : (profile.name ? profile.name.charAt(0) : "م")
    const fullName = profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "معلم"

    // Header
    if (teacherNameHeader) teacherNameHeader.textContent = fullName
    if (teacherAvatarHeader) teacherAvatarHeader.textContent = initial

    // Overview Card
    if (profileAvatar) profileAvatar.textContent = initial
    if (displayName) displayName.textContent = fullName
    if (displayEmail) displayEmail.textContent = profile.email || "—"
    if (displayPhone) displayPhone.textContent = profile.phone || "—"
    if (displayEducation) displayEducation.textContent = profile.educationLevel || "—"

    const birthInfo = parseBirthInfo(profile)
    if (displayBirthDate) displayBirthDate.textContent = formatBirthDate(birthInfo.dateOfBirth)
    if (displayBirth) displayBirth.textContent = formatBirthPlaces(profile)

    // Edit Inputs
    if (inputName) inputName.value = profile.name || ""
    if (inputFirstName) inputFirstName.value = profile.firstName || ""
    if (inputLastName) inputLastName.value = profile.lastName || ""
    if (inputPhone) inputPhone.value = profile.phone || ""
    if (inputEmail) inputEmail.value = profile.email || ""
}

/* ===================================================
   LOAD PROFILE
=================================================== */
async function loadTeacherProfile() {
    try {
        if (profileLoading) profileLoading.classList.remove("hidden")
        if (profileContent) profileContent.classList.add("hidden")

        const profile = await getProfile()
        populateProfileData(profile)

        if (profileLoading) profileLoading.classList.add("hidden")
        if (profileContent) profileContent.classList.remove("hidden")
    } catch (err) {
        console.error("Failed to load teacher profile:", err)
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
    if (editProfileForm) {
        editProfileForm.addEventListener("submit", async (e) => {
            e.preventDefault()

            const name = inputName.value.trim()
            const firstName = inputFirstName.value.trim()
            const lastName = inputLastName.value.trim()
            const phone = inputPhone.value.trim()

            if (!name || !firstName || !lastName || !phone) {
                showAlert("يرجى ملء جميع الحقول المطلوبة", "error")
                return
            }

            try {
                btnSaveProfile.disabled = true
                btnSaveProfile.textContent = "جاري الحفظ..."

                const updated = await updateProfile({
                    name,
                    firstName,
                    lastName,
                    phone
                })

                // Update stored user if present
                const storedUser = localStorage.getItem("user")
                if (storedUser) {
                    try {
                        const parsed = JSON.parse(storedUser)
                        Object.assign(parsed, updated)
                        localStorage.setItem("user", JSON.stringify(parsed))
                    } catch (_) {}
                }

                populateProfileData(updated)
                showAlert("تم تحديث البيانات الشخصية بنجاح")
            } catch (err) {
                console.error(err)
                showAlert(err.message || "حدث خطأ أثناء تحديث البيانات", "error")
            } finally {
                btnSaveProfile.disabled = false
                btnSaveProfile.textContent = "حفظ التغييرات"
            }
        })
    }

    // Change Password
    if (changePasswordForm) {
        changePasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault()

            const currPass = document.getElementById("input-curr-pass").value
            const newPass = document.getElementById("input-new-pass").value
            const confirmPass = document.getElementById("input-confirm-pass").value

            if (newPass !== confirmPass) {
                showAlert("كلمتا المرور الجديدتان غير متطابقتين", "error")
                return
            }

            if (newPass.length < 6) {
                showAlert("كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل", "error")
                return
            }

            try {
                btnSavePassword.disabled = true
                btnSavePassword.textContent = "جاري التحديث..."

                await changePassword(currPass, newPass)
                changePasswordForm.reset()
                showAlert("تم تغيير كلمة المرور بنجاح")
            } catch (err) {
                console.error(err)
                showAlert(err.message || "حدث خطأ أثناء تغيير كلمة المرور", "error")
            } finally {
                btnSavePassword.disabled = false
                btnSavePassword.textContent = "تحديث كلمة المرور"
            }
        })
    }
}

/* ===================================================
   INIT
=================================================== */
setupSidebar()
setupFormHandlers()
loadTeacherProfile()
