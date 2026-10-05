import {apiRequest} from './api.js';
import {getToken} from '../auth/auth.js';

export async function  createMemorization(student, halaqa, surah, fromVerse, toVerse, date) {
    const token = getToken();
    const data = await apiRequest('/memorization',{
        method: 'POST',
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            student: student,
            halaqa: halaqa,
            surah: surah,
            fromVerse: fromVerse,
            toVerse: toVerse,
            date: date
        })
    })
    return data;

}



export async function getMemorization() {
    const token = getToken();
    
    const data = await apiRequest('/memorization',{
        method: 'GET',
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    return data;    
}



export async function getMemorizationById(id) {
    const token = getToken();
    const data = await apiRequest(`/memorization/${id}`,{
        method: 'GET',
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    return data;    
}




export async function updateMemorization(id, surah, fromVerse, toVerse, date) {
    const token = getToken();
    const data = await apiRequest(`/memorization/${id}`,{
        method: 'PUT',
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            surah: surah,
            fromVerse: fromVerse,
            toVerse: toVerse,
            date: date
        })
    })
    return data;
}





export async function deleteMemorization(id) {
    const token = getToken();
    const data = await apiRequest(`/memorization/${id}`,{
        method: 'DELETE',
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    return data;
}   