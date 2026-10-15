"use client";
import { publicError } from "../lib/public-errors";
import {useBlockedEntry} from "./entry-safety";
import { useRef, useState } from "react";
import { sessionFetch } from "../lib/session-fetch";
import type { PackingItem, PackingRule, WorkItem } from "../lib/packing-plan";
export default function PackingRuleEditor({
  organization,
  work,
  rule,
  saved,
  busy,
  locked,
}: {
  organization: string;
  work: WorkItem;
  rule?: PackingRule;
  saved: () => void;
  busy: (saving: boolean) => void;
  locked: boolean;
}) {
  const [items, setItems] = useState<PackingItem[]>(
      () => rule?.items.map((v) => ({ ...v })) || [],
    ),
    [none, setNone] = useState(rule?.items.length === 0),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [unknown,setUnknown]=useState(false),
    [confirmed,setConfirmed]=useState(false);
  const retry=useRef<{body:string;revision:number}|null>(null);
  const sending=useRef(false);
  useBlockedEntry('packing:'+organization+':'+work.service+':'+work.task,pending||unknown);
  const change=(index:number,patch:Partial<PackingItem>)=>{
    if(unknown||pending||locked)return;
    setItems(previous=>previous.map((item,i)=>i===index?{...item,...patch}:item));
    setNone(false);setConfirmed(false);
  };
  async function sendExactAttempt(){
    if(sending.current||!retry.current)return;
    sending.current=true;setPending(true);busy(true);setError("");
    try{
      const response=await sessionFetch("/api/packing-rules",{method:"POST",headers:{"Content-Type":"application/json"},body:retry.current.body});
      if(response.status>=400&&response.status<500){
        const result=await response.json().catch(()=>null);
        if(unknown){setError("The first save is still unconfirmed. Please verify the saved list before editing or submitting a new request.");return;}
        retry.current=null;
        setError(typeof result?.error==='string'?result.error:"Packing changes were rejected. Nothing was discarded.");
        return;
      }
      if(!response.ok)throw Error('UNCONFIRMED');
      const result=await response.json();
      if(result?.ok!==true||result?.result?.saved!==true||result.result.revision!==retry.current.revision+1)throw Error('UNCONFIRMED');
      retry.current=null;setUnknown(false);setConfirmed(true);
      try{saved();}catch{setError("Packing list was saved, but the call sheet did not refresh. Refresh it before the next change.");}
    }catch{
      setUnknown(true);
      setError("We could not confirm whether the packing list was saved. Check the same saved attempt; your original items are locked to avoid duplicates.");
    }finally{sending.current=false;setPending(false);busy(false);}
  }
  function approve(){
    if(pending||unknown||locked||sending.current)return;
    if(items.length===0&&!none){setError("Add equipment or confirm this task needs no listed equipment.");return;}
    const value={organization,...work,revision:rule?.revision||0,items};
    retry.current={body:JSON.stringify({...value,key:crypto.randomUUID()}),revision:value.revision};
    void sendExactAttempt();
  }
  return (
    <details className="packing-editor day-plan-controls">
      <summary>
        {rule ? "Edit approved equipment" : "Set equipment"}: {work.service}
        {work.task ? ": " + work.task : ""}
      </summary>
      <p>
        These items apply to this exact task for future visits. Enter the
        quantity needed for one occurrence of the task. Reusable tools are
        combined using the largest quantity needed; consumables are added across
        tasks.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {unknown&&<button type="button" disabled={pending} onClick={()=>void sendExactAttempt()}>Check saved packing result</button>}
      {confirmed&&<p role="status">Approved packing rule saved.</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void approve();
        }}
      >
        <fieldset disabled={pending || locked || unknown || confirmed}>
          {items.map((item, index) => (
            <div className="packing-item" key={index}>
              <label>
                Equipment or supply
                <input
                  required
                  maxLength={80}
                  value={item.name}
                  onChange={(e) => change(index, { name: e.target.value })}
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  required
                  min={1}
                  max={1000}
                  step={1}
                  value={item.quantity}
                  onChange={(e) =>
                    change(index, { quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Unit
                <input
                  required
                  maxLength={24}
                  pattern="[A-Za-z][A-Za-z ]{0,23}"
                  placeholder="each, pair, bag"
                  value={item.unit}
                  onChange={(e) => change(index, { unit: e.target.value })}
                />
              </label>
              <label>
                Item type
                <select
                  value={item.consumed ? "consumed" : "reusable"}
                  onChange={(e) =>
                    change(index, { consumed: e.target.value === "consumed" })
                  }
                >
                  <option value="reusable">Reusable tool or equipment</option>
                  <option value="consumed">Supply used up on the task</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => setItems((v) => v.filter((_, i) => i !== index))}
              >
                Remove item
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={unknown || confirmed || items.length >= 40}
            className="secondary"
            onClick={() => {
              setItems((v) => [
                ...v,
                { name: "", quantity: 1, unit: "each", consumed: false },
              ]);
              setNone(false);
            }}
          >
            Add equipment or supply
          </button>
          {items.length === 0 && (
            <label className="check">
              <input
                type="checkbox"
                checked={none}
                onChange={(e) => setNone(e.target.checked)}
              />
              I reviewed this task; no listed equipment is needed.
            </label>
          )}
          <button type="submit" disabled={pending||unknown||confirmed}>
            {pending ? "Saving…" : "Approve this packing list"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
