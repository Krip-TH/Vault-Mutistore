import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import type { UserRole } from '../types/user.js';

export interface ManagedUser { id:number; name:string; email:string; role:UserRole; created_at:string; updated_at:string }
export interface ManagedBusiness { id:number; name:string; business_type:string; api_url:string; status:'active'|'inactive'|'unavailable'; last_checked_at:string|null; updated_at:string }
export interface ManagementRepository {
  listUsers():Promise<ManagedUser[]>; findUser(id:number):Promise<ManagedUser|null>; emailExists(email:string, exclude?:number):Promise<boolean>;
  createUser(v:{name:string;email:string;password_hash:string;role:UserRole}):Promise<ManagedUser>; updateUser(id:number,v:{name:string;email:string;role:UserRole;password_hash?:string}):Promise<ManagedUser|null>; deleteUser(id:number):Promise<boolean>;
  listBusinesses():Promise<ManagedBusiness[]>; findBusiness(id:number):Promise<ManagedBusiness|null>; updateBusiness(id:number,v:{name:string;api_url:string|null;status:ManagedBusiness['status']}):Promise<ManagedBusiness|null>;
}
const userSelect='SELECT id,name,email,role,created_at,updated_at FROM users';
const mapUser=(r:any):ManagedUser=>({...r,id:Number(r.id),created_at:new Date(r.created_at).toISOString(),updated_at:new Date(r.updated_at).toISOString()});
const mapBusiness=(r:any):ManagedBusiness=>({...r,id:Number(r.id),api_url:r.api_url||'',last_checked_at:r.last_checked_at?new Date(r.last_checked_at).toISOString():null,updated_at:new Date(r.updated_at).toISOString()});
export const managementRepository:ManagementRepository={
 async listUsers(){const [r]=await pool.query<RowDataPacket[]>(`${userSelect} ORDER BY id`);return r.map(mapUser)},
 async findUser(id){const [r]=await pool.execute<RowDataPacket[]>(`${userSelect} WHERE id=?`,[id]);return r[0]?mapUser(r[0]):null},
 async emailExists(email,exclude){const [r]=await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE email=? AND (? IS NULL OR id<>?) LIMIT 1',[email,exclude??null,exclude??null]);return !!r[0]},
 async createUser(v){const [x]=await pool.execute<ResultSetHeader>('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)',[v.name,v.email,v.password_hash,v.role]);return (await this.findUser(x.insertId))!},
 async updateUser(id,v){const sql=v.password_hash?'UPDATE users SET name=?,email=?,role=?,password_hash=? WHERE id=?':'UPDATE users SET name=?,email=?,role=? WHERE id=?';const p=v.password_hash?[v.name,v.email,v.role,v.password_hash,id]:[v.name,v.email,v.role,id];const [x]=await pool.execute<ResultSetHeader>(sql,p);return x.affectedRows?this.findUser(id):null},
 async deleteUser(id){const [x]=await pool.execute<ResultSetHeader>('DELETE FROM users WHERE id=?',[id]);return x.affectedRows===1},
 async listBusinesses(){const [r]=await pool.query<RowDataPacket[]>('SELECT id,name,business_type,api_url,status,last_checked_at,updated_at FROM businesses ORDER BY id');return r.map(mapBusiness)},
 async findBusiness(id){const [r]=await pool.execute<RowDataPacket[]>('SELECT id,name,business_type,api_url,status,last_checked_at,updated_at FROM businesses WHERE id=?',[id]);return r[0]?mapBusiness(r[0]):null},
 async updateBusiness(id,v){const [x]=await pool.execute<ResultSetHeader>('UPDATE businesses SET name=?,api_url=?,status=? WHERE id=?',[v.name,v.api_url,v.status,id]);return x.affectedRows?this.findBusiness(id):null},
};
