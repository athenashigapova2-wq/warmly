export function universityName(value:string) { return value.trim().replace(/\s+/g,' '); }
export function literalLike(value:string) { return value.replace(/[\\%_]/g,'\\$&'); }
export function universityOptions(values:string[]) {
 const names=new Map<string,string>();
 for(const value of values){const name=universityName(value);if(name&&!names.has(name.toLowerCase()))names.set(name.toLowerCase(),name);}
 return [...names.values()].sort((a,b)=>a.localeCompare(b));
}
