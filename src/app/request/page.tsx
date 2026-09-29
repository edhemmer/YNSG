import type {Metadata} from 'next';
import {RequestForm} from '@/components/request-form';
export const metadata:Metadata={title:'Request service'};
export default function Request(){return <RequestForm/>}
