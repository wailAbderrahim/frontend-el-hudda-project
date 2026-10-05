

function getPathPrefix() {
    const path = window.location.pathname
    if (path.includes("/pages/")) {
        return "../"
    }
    return "pages/"
}

export function getToken(){
    return localStorage.getItem('token')
}

export function getUser(){
    const user = localStorage.getItem('user')
    try {
        return user ? JSON.parse(user) : null
    } catch (e) {
        console.error("Error parsing user from localStorage:", e)
        return null
    }
}

export function redirectByRole(role) {
    const prefix = getPathPrefix()

    if (role === "admin") {
        window.location.href = `${prefix}admin/dashboard.html`
        return
    }

    if (role === "teacher") {
        window.location.href = `${prefix}teachers/dashboard.html`
        return
    }

    if (role === "student") {
        window.location.href = `${prefix}students/dashboard.html`
        return
    }

    throw new Error("Unknown user role")
}

export function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.clear()
    const prefix = getPathPrefix()
    window.location.href = `${prefix}auth/login.html`
}

export function protectPage(requiredRoles){
    const token = getToken()
    const prefix = getPathPrefix()
    if(!token){
        window.location.href = `${prefix}auth/login.html`
        return
    }
    const user = getUser()
    if(!user){
        logout()
        return
    }
    if(user.isVerified === false){
        window.location.href = `${prefix}auth/verify-email.html?email=${encodeURIComponent(user.email || '')}`
        return
    }
    if(user.isActive === false){
        logout()
        return
    }
    const allowed = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
    if(!allowed.includes(user.role)){
        redirectByRole(user.role)
    }
}