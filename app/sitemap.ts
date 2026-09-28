import type {MetadataRoute} from 'next';
import {services} from '@/lib/catalog';
export default function sitemap():MetadataRoute.Sitemap{return ['','/services','/pricing','/about','/request','/privacy','/terms','/accessibility','/service-agreement',...services.map(s=>'/services/'+s.id)].map(path=>({url:'https://yourneighborhoodserviceguy.com'+path}))}
