export type RoleChoice='student'|'university'|'visitor';
export interface AccountRole {user_id:string;requested_role:RoleChoice;university_name:string;approved:boolean}
export function effectiveRole(role:AccountRole|null|undefined):RoleChoice {return !role || role.requested_role==='university'&&!role.approved?'visitor':role.requested_role;}
export function canSell(role:AccountRole|null|undefined){return ['student','university'].includes(effectiveRole(role));}
export function roleLabel(role:AccountRole|null|undefined){return role?.requested_role==='university'&&!role.approved?'University · awaiting approval':effectiveRole(role)==='university'?'University · approved':effectiveRole(role)==='student'?'Student':'Visitor';}
