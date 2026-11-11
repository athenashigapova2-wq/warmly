export function firstHello(name:string,kind:string|undefined,loaded:boolean,messageCount:number,draft:string){
 return loaded && kind==='direct' && messageCount===0 && !draft.trim() && name.trim() ? `Hello! I'm ${name.trim()}` : '';
}
