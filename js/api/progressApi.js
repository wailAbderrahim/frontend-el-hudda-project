import { apiRequest } from './api.js'
import { getToken } from '../auth/auth.js'
export async function getStudentProgress(studentId) {
    const token = getToken()
    return await apiRequest(`/student-progress/${studentId}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
}