export async function boundedText(request:Request,limit:number){
 if(Number(request.headers.get('content-length')||0)>limit)throw Error('VALIDATION');
 if(!request.body)throw Error('VALIDATION');
 const reader=request.body.getReader(),parts:Uint8Array[]=[];let bytes=0;
 for(;;){const value=await reader.read();if(value.done)break;bytes+=value.value.byteLength;if(bytes>limit){await reader.cancel();throw Error('VALIDATION')}parts.push(value.value);}
 return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
}
