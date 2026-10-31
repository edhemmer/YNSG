import {readFile} from 'node:fs/promises';
// Execute the actual recovery catalog inside the same disposable fixture
// transaction, while archived ready and unfinished network files coexist.
export async function withNetworkCatalog(source){
 if(!source.includes('-- NETWORK_CATALOG_ASSERTION'))return source;
 const query=(await readFile('scripts/recovery-file-catalog.sql','utf8')).replace(/;\s*$/,'');
 return source.replace('-- NETWORK_CATALOG_ASSERTION',`select pg_temp.assert_true((select (catalog_json::jsonb->>'readyCount')::int=1 and (catalog_json::jsonb->>'pendingCount')::int=1 and jsonb_array_length(catalog_json::jsonb->'files')=1 from (${query}) catalog(catalog_json)),'actual recovery catalog includes archived verified network photo, excludes pending bytes');`);
}
