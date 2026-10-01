import Workspace from './workspace';import {configured} from '../lib/session';
export default function Page(){return <Workspace configured={configured()}/>}
