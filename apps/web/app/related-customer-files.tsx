'use client';
import {useCustomerFilePage} from './use-customer-file-page';
import PrivateFileDownload from './private-file-download';
type Props={organization:string;customer:string;targets:{kind:'job'|'invoice';id:string}[];disabled?:boolean;onManage?:()=>void};
export default function RelatedCustomerFiles(props:Props){return <RelatedFiles key={props.organization+':'+props.customer+':'+JSON.stringify(props.targets)} {...props}/>;}
function RelatedFiles({organization,customer,targets,disabled=false,onManage}:Props){
 const jobs=[...new Set(targets.filter(t=>t.kind==='job').map(t=>t.id))].sort().join(','),invoices=[...new Set(targets.filter(t=>t.kind==='invoice').map(t=>t.id))].sort().join(',');
 const list=useCustomerFilePage(organization,customer,{...(jobs?{jobs}:{}),...(invoices?{invoices}:{})}),busy=list.loading,files=list.page?.files;
 const validTargets=targets.length>0&&targets.filter(t=>t.kind==='job').length<=100&&targets.filter(t=>t.kind==='invoice').length<=100;
 return <details className="workflow-private-files"><summary>Private photos &amp; receipts for this work</summary><p>Only authorized owners can open these files. Manage uploads and record links in the customer record.</p>
  <button type="button" className="secondary" disabled={disabled||busy||!validTargets} onClick={()=>void (list.readFailed?list.retry():list.reset())}>{busy?'Checking linked files…':list.readFailed?'Retry linked file page':'Load linked files'}</button>
  {onManage&&<button type="button" className="secondary" disabled={disabled||busy} onClick={onManage}>Manage customer attachments</button>}
  {list.error&&<p role="alert">{list.error}</p>}
  {list.page&&<nav className="actions" aria-label="Linked attachment pages"><button type="button" className="secondary" disabled={disabled||busy||list.readFailed||!list.index} onClick={()=>void list.previous()}>Previous linked files</button><span role="status">Page {list.index+1}</span><button type="button" className="secondary" disabled={disabled||busy||list.readFailed||!list.page.hasMore} onClick={()=>void list.next()}>Next linked files</button></nav>}
  {files&&(!files.length&&!list.readFailed?<p>No files are linked to these jobs or invoices on this page.</p>:files.map(f=><div className="customer-item" key={f.id}><strong>{f.name}</strong><p>{f.link?.label}</p><PrivateFileDownload key={organization+':'+f.id} organization={organization} file={f.id} disabled={disabled||busy||list.readFailed}/></div>))}
 </details>;
}
