// Bounded diagnostic copies are test observations, not journal memory authority.
import {hash} from '/prototypes/evidence-indexeddb/contract.mjs';
export const SCOPE='native:fence',SESSION='1234567890abcdef1234567890abcdef';
export const initialContext=()=>({scope:SCOPE,generation:1,sourceIdentity:'disposable-guest:1'});
export const sourceKey=n=>`mkty_field_finale_${n}_v1`,storyKey=n=>`mkty_story_plan_${n}_v1`;
export const compact=head=>Object.fromEntries(['binding','root','ordinal','total'].map(key=>[key,head[key]]));
export const identityFor=(context,chapter,phase)=>hash(JSON.stringify(['invocation-fence-identity-v1',context.scope,context.generation,context.sourceIdentity,SESSION,chapter,phase]));
export async function audit(coordinator) {
  const items=[];let cursor=null,pages=0;
  do {
    if (++pages>8) throw Error('Bounded archive discovery exceeded');
    const page=await coordinator.recover({scope:SCOPE,maxHeads:1,maxBytes:8192,...(cursor?{cursor}:{})});
    if (page.status!=='page') throw Error('Archive diagnostic discovery '+page.reason);
    for (const item of page.heads) {
      if (!item.head.sealed||item.head.total>69660) throw Error('Diagnostic capture bound');
      let q={captureIdentity:item.captureIdentity,throughHead:item.head.token,afterOrdinal:-1,maxBytes:32768},parts=[],bytes=0;
      do {
        const read=await coordinator.readSegments(q);if(read.status!=='page')throw Error('Diagnostic read '+read.reason);
        for(const s of read.segments){bytes+=s.payload.length;parts.push({ordinal:s.ordinal,offset:s.offset,length:s.length,root:s.root,sha256:await hash(s.payload)});}
        if(parts.length>3||bytes>69660)throw Error('Diagnostic capture page bound');q=read.nextCursor;
      }while(q);
      items.push({descriptor:item.descriptor,head:item.head,parts});
    }
    cursor=page.nextCursor;
  }while(cursor);
  return items.sort((a,b)=>a.descriptor.run.localeCompare(b.descriptor.run));
}
