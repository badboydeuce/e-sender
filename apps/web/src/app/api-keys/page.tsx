"use client";
import { useCallback,useEffect,useState,type CSSProperties } from "react";
type ApiKey={id:string;label:string;masked:string;enabled:boolean;status:string;request_count:number;failure_count:number;last_used_at:string|null;last_error:string|null;cooldown_until:string|null;created_at:string};
export default function ApiKeysPage(){
 const [token,setToken]=useState("");const [keys,setKeys]=useState<ApiKey[]>([]);const [input,setInput]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const headers={"Content-Type":"application/json","x-admin-token":token.trim()};
 const load=useCallback(async()=>{if(!token.trim())return;const r=await fetch("/api/validation-keys",{headers:{"x-admin-token":token.trim()},cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.message||"Unable to load API keys");setKeys(d);},[token]);
 useEffect(()=>{if(token.trim())void load().catch(e=>setError(e.message));},[token,load]);
 async function act(path:string,method:string,body?:unknown){setBusy(true);setError("");setNotice("");try{const r=await fetch("/api/validation-keys"+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Request failed");return d;}catch(e){setError(e instanceof Error?e.message:"Request failed");throw e;}finally{setBusy(false);}}
 async function importKeys(){try{const d=await act("/import","POST",{keys_text:input});setInput("");setNotice("Imported "+d.added+" keys; skipped "+d.skipped+" duplicates.");await load();}catch{}}
 async function toggle(k:ApiKey){try{await act("/"+encodeURIComponent(k.id),"PATCH",{enabled:!k.enabled});setNotice(k.enabled?"Key disabled.":"Key enabled.");await load();}catch{}}
 async function test(k:ApiKey){try{const d=await act("/"+encodeURIComponent(k.id)+"/test","POST");setNotice(d.message);await load();}catch{}}
 async function remove(k:ApiKey){if(!window.confirm("Permanently delete "+k.label+" ("+k.masked+")?"))return;try{await act("/"+encodeURIComponent(k.id),"DELETE");setNotice("API key deleted.");await load();}catch{}}
 return <main style={{maxWidth:1050,margin:"38px auto",padding:24,color:"#e8edf8",fontFamily:"Arial,sans-serif"}}>
  <a href="/" style={{color:"#9aaeff"}}>← Dashboard</a><h1>APILayer key manager</h1>
  <p style={{color:"#9aa7bd",lineHeight:1.6}}>Manage server-side Number Verification keys. Paste one key per line. Keys are encrypted before storage and are never displayed in full or sent to enrolled iPhones.</p>
  <section style={panel}><h2>Admin connection</h2><input type="password" autoComplete="off" placeholder="ADMIN_API_TOKEN" value={token} onChange={e=>setToken(e.target.value)} style={field}/></section>
  <section style={panel}><h2>Import API keys</h2><textarea rows={7} spellCheck={false} placeholder={"Paste APILayer API keys, one per line"} value={input} onChange={e=>setInput(e.target.value)} style={{...field,resize:"vertical"}}/><p style={{color:"#9aa7bd",fontSize:13}}>Blank lines are ignored and duplicate keys are skipped. Do not paste keys into chat or commit them to GitHub.</p><button disabled={!token.trim()||!input.trim()||busy} onClick={()=>void importKeys()} style={btn}>{busy?"Working…":"Import keys"}</button></section>
  {error&&<p role="alert" style={{color:"#ff9696"}}>{error}</p>}{notice&&<p role="status" style={{color:"#82e0ba"}}>{notice}</p>}
  <section style={panel}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><h2>Stored keys ({keys.length})</h2><button disabled={!token.trim()||busy} onClick={()=>void load().catch(e=>setError(e.message))} style={btn}>Refresh</button></div>
   {keys.length===0?<p style={{color:"#9aa7bd"}}>{token?"No API keys stored yet.":"Connect with your admin token to view stored keys."}</p>:keys.map(k=><div key={k.id} style={{padding:"16px 0",borderBottom:"1px solid #2a3548"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{k.label}</strong><div style={{fontFamily:"monospace",marginTop:5}}>{k.masked}</div><div style={{color:"#9aa7bd",fontSize:13,marginTop:6}}>Status: {k.status} · Requests: {k.request_count} · Failures: {k.failure_count}</div>{k.last_used_at&&<div style={{color:"#9aa7bd",fontSize:12,marginTop:4}}>Last used: {new Date(k.last_used_at).toLocaleString()}</div>}{k.last_error&&<div style={{color:"#ffb0a8",fontSize:12,marginTop:4}}>{k.last_error}</div>}{k.cooldown_until&&<div style={{color:"#e8c98b",fontSize:12,marginTop:4}}>Cooldown until {new Date(k.cooldown_until).toLocaleString()}</div>}</div>
     <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><button disabled={busy} onClick={()=>void test(k)} style={btn}>Test</button><button disabled={busy} onClick={()=>void toggle(k)} style={btn}>{k.enabled?"Disable":"Enable"}</button><button disabled={busy} onClick={()=>void remove(k)} style={{...btn,background:"#633b42"}}>Delete</button></div>
    </div></div>)}
  </section>
  <p style={{color:"#9aa7bd",fontSize:13,lineHeight:1.6}}>Rotation is performed by the API server. HTTP 429 and temporary provider failures put a key into cooldown so another enabled key can be tried. Multiple keys do not necessarily increase quota if they share one APILayer subscription.</p>
 </main>;
}
const panel:CSSProperties={background:"#151d2b",padding:20,borderRadius:14,marginBottom:18};
const field:CSSProperties={boxSizing:"border-box",width:"100%",padding:12,borderRadius:8,border:"1px solid #34425a",background:"#0d1420",color:"#eef3ff"};
const btn:CSSProperties={padding:"10px 15px",border:0,borderRadius:8,background:"#596ee8",color:"white",cursor:"pointer"};
