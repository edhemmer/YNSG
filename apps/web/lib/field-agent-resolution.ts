export type FieldResolution='completed'|'superseded'|'closed';
const order:Record<string,number>={schedule:1,quote:2,review:2,work:3,invoice:4,payment:5};
/** Only saved lifecycle advancement counts as completion. Disappearing tasks alone do not. */
export function taskResolution(previous:string,next:string|null,requestStatus:string):FieldResolution{
 if(['declined','canceled'].includes(requestStatus))return 'closed';
 if(!next)return 'completed'; // No next task only after saved settlement/closure.
 const before=order[previous],after=order[next];
 return before!==undefined&&after!==undefined&&after>before?'completed':'superseded';
}
