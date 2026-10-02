import {z} from 'zod';
import {companySettings} from './index.ts';
export const configurationCommand=z.object({organizationId:z.uuid(),expectedVersion:z.number().int().min(0),key:z.string().min(16).max(128),settings:companySettings,catalog:z.array(z.object({name:z.string().min(2).max(80),scope:z.string().min(10).max(4000),exclusions:z.string().min(10).max(4000),compliance:z.enum(['review','approved','held']),pricingMode:z.enum(['hourly','starting','quote','review'])}).strict()).max(100)}).strict();
export const jobAction=z.object({organizationId:z.uuid(),id:z.uuid(),revision:z.number().int().positive(),action:z.enum(['start','pause','resume']),key:z.string().min(16).max(128),note:z.string().trim().max(3000).default('')}).strict();
