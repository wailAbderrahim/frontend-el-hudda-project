import { apiRequest } from "./api.js"
import { getToken } from "../auth/auth.js"

export async function createHalaqa (name, teacher, schedule) {
    const token = getToken()
    const data = await apiRequest('/halaqa',{
        method:'POST',
        headers:{
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`            
        },
        body:JSON.stringify({
            name,
            teacher,
            schedule
        })
    })
    return data
}



export async function getHalaqas (){
    const data = await apiRequest('/halaqa',{
        method:'GET',

    })
    return data
}


export async function getHalaqaById (halaqaId){
    const token = getToken()
    const data = await apiRequest(`/halaqa/${halaqaId}`,{
        method:'GET',
        headers:{
            Authorization: `Bearer ${token}`            
        }
    })
    return data
}


export async function addStudentToHalaqa(halaqaId, studentId) {
    const token = getToken()
    return await apiRequest(
        `/halaqa/${halaqaId}/students`,
        {
            method: "POST",
            headers:{
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                 studentId
            })
        }
    )
}


export async function removeStudentFromHalaqa(halaqaId, studentId) {
    const token = getToken()
    const data = await apiRequest(
        `/halaqa/${halaqaId}/students/${studentId}`,
        {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    )

    return data
}


export async function updateHalaqa(halaqaId, halaqaData) {
    const token = getToken()
    const data = await apiRequest(`/halaqa/${halaqaId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(halaqaData)
    })

    return data
}


export async function updateHalaqaStatus(halaqaId, isActive) {
    const token = getToken()
    const data = await apiRequest(`/halaqa/${halaqaId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            isActive
        })
    })

    return data
}
