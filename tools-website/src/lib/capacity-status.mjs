import {accessFetch} from './master-access.mjs';

export async function fetchCapacityStatus(){
 const response=await accessFetch('/api/capacity-status',{headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('Capacity unavailable');
 return response.json();
}
