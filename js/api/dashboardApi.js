import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function getDashboardStats(){
    const token = getToken()

    const data = await apiRequest('/dashboard', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'content-type': 'application/json'
                }
    })
    return data
}
