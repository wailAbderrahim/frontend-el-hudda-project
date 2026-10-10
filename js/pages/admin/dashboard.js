
import { protectPage, getUser, logout } from "../../auth/auth.js"
import { getDashboardStats } from "../../api/dashboardApi.js"
import { initNotificationBell } from "../../components/notificationBell.js"


/* =========================================================
   Protect Page
========================================================= */

protectPage("admin")


/* =========================================================
   Elements
========================================================= */

let menuBtn
let sidebar
let overlay
let logoutBtn


/* =========================================================
   Sidebar State
========================================================= */

function openSidebar() {

    if (!sidebar || !overlay) return

    sidebar.classList.remove("translate-x-full")
    overlay.classList.remove("hidden")

    document.body.classList.add("overflow-hidden")
}


function closeSidebar() {

    if (!sidebar || !overlay) return

    sidebar.classList.add("translate-x-full")
    overlay.classList.add("hidden")

    document.body.classList.remove("overflow-hidden")
}


function toggleSidebar() {

    if (!sidebar) return

    const isClosed = sidebar.classList.contains("translate-x-full")

    if (isClosed) {
        openSidebar()
    } else {
        closeSidebar()
    }
}


/* =========================================================
   Setup Mobile Sidebar
========================================================= */

function setupSidebar() {

    menuBtn = document.getElementById("menu-btn")
    sidebar = document.getElementById("sidebar")
    overlay = document.getElementById("sidebar-overlay")
    logoutBtn = document.getElementById("logout-btn")


    console.log("Sidebar elements:", {
        menuBtn,
        sidebar,
        overlay,
        logoutBtn
    })


    /* -----------------------------------------------------
       Check Elements
    ----------------------------------------------------- */

    if (!menuBtn) {
        console.error("❌ menu-btn not found")
    }

    if (!sidebar) {
        console.error("❌ sidebar not found")
    }

    if (!overlay) {
        console.error("❌ sidebar-overlay not found")
    }


    /* -----------------------------------------------------
       Mobile Menu Button
    ----------------------------------------------------- */

    if (menuBtn && sidebar && overlay) {

        menuBtn.addEventListener("click", function (event) {

            event.preventDefault()
            event.stopPropagation()

            toggleSidebar()

        })

    }


    /* -----------------------------------------------------
       Overlay
    ----------------------------------------------------- */

    if (overlay) {

        overlay.addEventListener("click", function () {

            closeSidebar()

        })

    }


    /* -----------------------------------------------------
       Sidebar Links
    ----------------------------------------------------- */

    if (sidebar) {

        const links = sidebar.querySelectorAll("a")

        links.forEach(link => {

            link.addEventListener("click", function () {

                closeSidebar()

            })

        })

    }


    /* -----------------------------------------------------
       ESC Key
    ----------------------------------------------------- */

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            closeSidebar()

        }

    })


    /* -----------------------------------------------------
       Resize Protection
       Close sidebar when moving to desktop
    ----------------------------------------------------- */

    window.addEventListener("resize", function () {

        if (window.innerWidth >= 1024) {

            closeSidebar()

        }

    })


    /* -----------------------------------------------------
       Logout
    ----------------------------------------------------- */

    if (logoutBtn) {

        logoutBtn.addEventListener("click", function () {

            const confirmed = confirm(
                "هل أنت متأكد من رغبتك في تسجيل الخروج؟"
            )

            if (!confirmed) return

            try {

                logout()

            } catch (error) {

                console.error(
                    "Logout failed:",
                    error
                )

            }

        })

    }

}


/* =========================================================
   Load Dashboard Statistics
========================================================= */

async function loadDashboardStatsData() {

    const loading = document.getElementById("dashboard-loading")
    const errorBox = document.getElementById("dashboard-error")


    try {

        /* ---------------------------------------------
           Loading
        --------------------------------------------- */

        if (loading) {

            loading.classList.remove("hidden")

        }


        if (errorBox) {

            errorBox.classList.add("hidden")
            errorBox.textContent = ""

        }


        /* ---------------------------------------------
           API Request
        --------------------------------------------- */

        const stats = await getDashboardStats()


        if (!stats) {

            throw new Error(
                "لم يتم استلام بيانات من الخادم"
            )

        }


        console.log(
            "Dashboard statistics:",
            stats
        )


        /* ---------------------------------------------
           Helper
        --------------------------------------------- */

        function setValue(id, value) {

            const element =
                document.getElementById(id)

            if (!element) return


            if (
                value !== undefined &&
                value !== null
            ) {

                element.textContent = value

            } else {

                element.textContent = "0"

            }

        }


        /* ---------------------------------------------
           Main Statistics
        --------------------------------------------- */

        setValue(
            "students-count",
            stats.students
        )


        setValue(
            "teachers-count",
            stats.teachers
        )


        setValue(
            "halaqas-count",
            stats.halaqas
        )


        setValue(
            "attendance-rate",
            `${stats.attendanceRate ?? 0}%`
        )


        setValue(
            "memorizations-count",
            stats.memorizations
        )


        setValue(
            "evaluations-count",
            stats.evaluations
        )

        setValue(
            "levels-count",
            stats.levelsCount ?? 0
        )

        setValue(
            "active-matn-count",
            stats.activeMatnsCount ?? 0
        )

        setValue(
            "exams-count",
            stats.upcomingExamsCount ?? 0
        )

        setValue(
            "pending-grading-count",
            stats.pendingGradingExamsCount ?? 0
        )


        /* ---------------------------------------------
           Overview
        --------------------------------------------- */

        setValue(
            "overview-students",
            stats.students
        )


        setValue(
            "overview-teachers",
            stats.teachers
        )


        setValue(
            "overview-halaqas",
            stats.halaqas
        )

    } catch (error) {

        console.error(
            "Failed to load dashboard:",
            error
        )


        if (errorBox) {

            errorBox.textContent =
                "تعذر تحميل بيانات لوحة التحكم. " +
                (
                    error.message ||
                    "حاول تحديث الصفحة."
                )

            errorBox.classList.remove("hidden")

        }

    } finally {

        if (loading) {

            loading.classList.add("hidden")

        }

    }

}


/* =========================================================
   Load Admin Information
========================================================= */

function loadAdminInfo() {

    try {

        const user = getUser()


        if (!user) {

            console.warn(
                "No admin user found"
            )

            return

        }


        const adminName =
            document.getElementById("admin-name")


        const adminAvatar =
            document.getElementById("admin-avatar")


        /* ---------------------------------------------
           Determine Name
        --------------------------------------------- */

        const fullName =
            user.name ||
            `${user.firstName || ""} ${user.lastName || ""}`
                .trim() ||
            "المدير"


        /* ---------------------------------------------
           Name
        --------------------------------------------- */

        if (adminName) {

            adminName.textContent =
                fullName

        }


        /* ---------------------------------------------
           Avatar
        --------------------------------------------- */

        if (adminAvatar) {

            adminAvatar.textContent =
                fullName.charAt(0)

        }

    } catch (error) {

        console.error(
            "Failed to load admin info:",
            error
        )

    }

}


function initializeDashboard() {

    console.log(
        "Initializing admin dashboard..."
    )


    setupSidebar()

    initNotificationBell()

    loadAdminInfo()

    loadDashboardStatsData()


    console.log(
        "Admin dashboard initialized successfully"
    )

}


/* =========================================================
   Start
========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        { once: true }
    )

} else {

    initializeDashboard()

}

