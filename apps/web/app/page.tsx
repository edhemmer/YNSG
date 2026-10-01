import Workspace from './workspace';import {configured} from '../lib/session';
export const dynamic='force-dynamic';
export default function Page(){return <Workspace configured={configured()}/>}
