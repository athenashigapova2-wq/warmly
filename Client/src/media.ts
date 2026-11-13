import {SupabaseClient} from '@supabase/supabase-js';
import {photoData} from './photo';
export async function prepareMedia(file:File,avatar=false):Promise<{blob:Blob;extension:string;type:'image'|'video'}>{
 if(file.type.startsWith('image/'))return {blob:await (await fetch(await photoData(file))).blob(),extension:'jpg',type:'image'};
 if(avatar||!['video/mp4','video/webm'].includes(file.type)||file.size>25*1024*1024)throw Error('Choose a JPG, PNG or WebP photo (10 MB max), or an MP4/WebM video (25 MB max).');
 return {blob:file,extension:file.type==='video/mp4'?'mp4':'webm',type:'video'};
}
export async function uploadMedia(client:SupabaseClient,me:string,media:{blob:Blob;extension:string},avatar=false){
 const path=`${me}/${crypto.randomUUID()}.${media.extension}`;
 const {error}=await client.storage.from(avatar?'warmly-avatars':'warmly-social').upload(path,media.blob,{contentType:media.blob.type,upsert:false});
 if(error)throw error;return path;
}
