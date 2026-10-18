import '../../practice-workspace.css';
import type {Metadata} from 'next';
import PracticeWorkspace from '../../practice-workspace';
export const metadata:Metadata={title:'Practice workspace — sample data only',robots:{index:false,follow:false}};
export default function PracticePage(){return <PracticeWorkspace/>;}
