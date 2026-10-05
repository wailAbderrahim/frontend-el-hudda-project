import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function createEvaluation(evaluationData) {
    const token = getToken()
    const data = await apiRequest("/evaluation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(evaluationData)
    })
    return data
}

export async function getEvaluations() {
    const token = getToken()
    const data = await apiRequest("/evaluation", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function getEvaluationById(id) {
    const token = getToken()
    const data = await apiRequest(`/evaluation/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}

export async function updateEvaluation(id, evaluationData) {
    const token = getToken()
    const data = await apiRequest(`/evaluation/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(evaluationData)
    })
    return data
}

export async function deleteEvaluation(id) {
    const token = getToken()
    const data = await apiRequest(`/evaluation/${id}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    return data
}
