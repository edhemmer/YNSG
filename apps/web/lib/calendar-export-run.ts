type ExportDependencies={
 readConnection:()=>Promise<boolean>;
 sync:()=>Promise<{results:unknown[]}>;
 checkMaps:()=>Promise<string>;
};
// Optional export never controls the CRM schedule and never discards queued work.
export async function calendarExportRun(enabled:boolean,dependencies:ExportDependencies){
 if(!enabled)return {processed:0,status:'paused' as const};
 if(!await dependencies.readConnection())return {processed:0,status:'disconnected' as const};
 const result=await dependencies.sync();
 // A Maps health failure must not erase a completed export result.
 let maps='verification_unavailable';
 try{maps=await dependencies.checkMaps();}catch{/* Maps readiness is checked independently. */}
 return {processed:result.results.length,status:'completed' as const,maps};
}
