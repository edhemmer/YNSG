/** Local matching of already authorized queue records. No remote calls or persistence. */
export function fieldSearchMatches(query:string,values:readonly string[]):boolean{
 const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en-US');
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 const text=normalize(values.join(' '));
 return terms.every(term=>text.includes(term));
}
