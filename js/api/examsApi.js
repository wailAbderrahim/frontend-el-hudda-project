import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function getExams() {
    const token = getToken()
    return await apiRequest("/exams", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getExamById(id) {
    const token = getToken()
    return await apiRequest(`/exams/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function createExam(examData) {
    const token = getToken()
    return await apiRequest("/exams", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(examData)
    })
}

export async function updateExam(id, examData) {
    const token = getToken()
    return await apiRequest(`/exams/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(examData)
    })
}

export async function deleteExam(id) {
    const token = getToken()
    return await apiRequest(`/exams/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function startExamAttempt(id) {
    const token = getToken()
    return await apiRequest(`/exams/${id}/start`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function saveExamProgress(id, answers) {
    const token = getToken()
    return await apiRequest(`/exams/${id}/save-progress`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
    })
}

export async function submitExamAttempt(id, answers) {
    const token = getToken()
    return await apiRequest(`/exams/${id}/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
    })
}

export async function getExamAttempts(id) {
    const token = getToken()
    return await apiRequest(`/exams/${id}/attempts`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getAllExamAttempts(query = {}) {
    const token = getToken()
    const params = new URLSearchParams()
    if (query.examId) params.append("examId", query.examId)
    if (query.status) params.append("status", query.status)
    const qs = params.toString() ? `?${params.toString()}` : ""
    return await apiRequest(`/exams/all-attempts${qs}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function gradeAttempt(idOrAttemptId, maybeAttemptIdOrData, maybeData) {
    let attemptId = idOrAttemptId
    let gradeData = maybeAttemptIdOrData
    if (maybeData !== undefined) {
        attemptId = maybeAttemptIdOrData
        gradeData = maybeData
    }
    const token = getToken()
    return await apiRequest(`/exams/attempts/${attemptId}/grade`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(gradeData)
    })
}

export async function publishExamResults(id) {
    const token = getToken()
    return await apiRequest(`/exams/${id}/publish-results`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

export async function getStudentResults(studentId) {
    const token = getToken()
    return await apiRequest(`/exams/student-results/${studentId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
}

