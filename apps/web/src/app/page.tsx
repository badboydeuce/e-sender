"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
type Device = { id:string; name:string; platform:string; active:boolean; lastSeenAt:string|null; createdAt:string };
function relativeTime(value:string|null) {
  if (!value) return "Never connected";
  const minutes=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
  if(minutes<1)return "Just now"; if(minutes<60)return minutes+"m ago";
  if(minutes<1440)return Math.floor(minutes/60)+"h ago"; return Math.floor(minutes/1440)+"d ago";
}
export default function Dashboard() {
  const [token,setToken]=useState(""); const [devices,setDevices]=useState<Device[]>([]);
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const [message,setMessage]=useState(""); const [lastUpdated,setLastUpdated]=useState<string|null>(null);
  const loadDevices=useCallback(async(quiet=false)=>{
    if(!token.trim()){setDevices([]);return;} if(!quiet)setLoading(true); setError("");
    try {
      const response=await fetch("/api/devices",{headers:{"x-admin-token":token.trim()},cache:"no-store"});
      const data=await response.json(); if(!response.ok)throw new Error(data.message??"Unable to load devices");
      setDevices(data as Device[]);setLastUpdated(new Date().toISOString());
    } catch(e){setError(e instanceof Error?e.message:"Unable to load devices");}
    finally{setLoading(false);}
  },[token]);
  useEffect(()=>{if(!token)return;void loadDevices();const timer=window.setInterval(()=>void loadDevices(true),30000);return()=>window.clearInterval(timer);},[token,loadDevices]);
  const online=useMemo(()=>devices.filter(d=>d.active&&d.lastSeenAt&&Date.now()-new Date(d.lastSeenAt).getTime()<120000).length,[devices]);
  const active=devices.filter(d=>d.active).length;const revoked=devices.length-active;
  async function revoke(device:Device){
    if(!window.confirm('Revoke access for "'+device.name+'"? This iPhone will need to enroll again.'))return;
    setMessage("");try{
      const response=await fetch("/api/devices/"+encodeURIComponent(device.id)+"/revoke",{method:"POST",headers:{"x-admin-token":token.trim()}});
      const data=await response.json();if(!response.ok)throw new Error(data.message??"Could not revoke device");
      setMessage(device.name+" access has been revoked.");await loadDevices(true);
    }catch(e){setError(e instanceof Error?e.message:"Could not revoke device");}
  }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">eS</div><span>eSENDER <span style={{color:"#8b9cff"}}>HQ</span></span></div>
      <div><p className="nav-label">Workspace</p><div className="nav-links">
        <div className="nav-item active">▦ <span>Overview</span></div><div className="nav-item">▣ <span>Devices</span></div><a className="nav-item" href="/campaigns" style={{textDecoration:"none",color:"inherit"}}>◉ <span>Campaigns</span></a><div className="nav-item">▤ <span>Reports</span></div>
      </div></div>
      <div className="sidebar-foot">MULTI-IPHONE CONTROL CENTER<br/>Messages are sent by enrolled iPhones using their own SIM/eSIM.</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">Command center / Overview</div><h1>Device overview</h1><div className="sub">Monitor your enrolled iPhones and their connection health.</div></div><div className="pill">● &nbsp; ADMIN CONSOLE</div></header>
      <div className="notice">Connect with your admin API token to load live device information. Your token is held in page memory only and is not saved in browser storage.</div>
      <section className="panel" style={{marginBottom:20}}>
        <div className="panel-head"><div><div className="panel-title">Admin authentication</div><div className="sub" style={{marginTop:5}}>Enter the ADMIN_API_TOKEN configured on your API service.</div></div><span className="pill">SECURE SESSION</span></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <input className="input" type="password" autoComplete="off" placeholder="Paste admin API token" value={token} onChange={e=>setToken(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void loadDevices();}}/>
          <button className="btn" onClick={()=>void loadDevices()} disabled={loading}>{loading?"Connecting…":"Connect dashboard"}</button>
          <button className="btn secondary" onClick={()=>{setToken("");setDevices([]);setError("");setMessage("");}}>Disconnect</button>
        </div>
        {error&&<p className="sub error" role="alert" style={{marginTop:12}}>{error}</p>}{message&&<p className="sub" style={{marginTop:12,color:"#72d8b6"}}>{message}</p>}
      </section>
      <section className="grid">
        <div className="stat"><div className="stat-label">Registered devices</div><div className="stat-value">{devices.length}</div><div className="stat-note">All enrolled iPhones</div></div>
        <div className="stat"><div className="stat-label">Online now</div><div className="stat-value">{online}</div><div className="stat-note">Heartbeat within 2 minutes</div></div>
        <div className="stat"><div className="stat-label">Active devices</div><div className="stat-value">{active}</div><div className="stat-note">Allowed to authenticate</div></div>
        <div className="stat"><div className="stat-label">Revoked</div><div className="stat-value">{revoked}</div><div className="stat-note">Access disabled</div></div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><div className="panel-title">Enrolled iPhones</div><div className="sub" style={{marginTop:5}}>Device heartbeats refresh automatically every 30 seconds.</div></div><button className="btn secondary" onClick={()=>void loadDevices()} disabled={!token||loading}>↻ Refresh</button></div>
        <div className="table-wrap"><table><thead><tr><th>Device</th><th>Platform</th><th>Connection</th><th>Last heartbeat</th><th>Access</th><th>Action</th></tr></thead>
          <tbody>{devices.map(device=>{const isOnline=!!device.lastSeenAt&&Date.now()-new Date(device.lastSeenAt).getTime()<120000;return <tr key={device.id}>
            <td><strong>{device.name}</strong><div style={{color:"#718099",fontSize:10,marginTop:5}}>{device.id}</div></td><td>{device.platform}</td>
            <td><span className={"status "+(isOnline&&device.active?"":"offline")}><span className="dot"/>{device.active&&isOnline?"Online":device.active?"Offline":"Revoked"}</span></td>
            <td>{relativeTime(device.lastSeenAt)}</td><td>{device.active?"Active":"Disabled"}</td><td>{device.active?<button className="btn danger" onClick={()=>void revoke(device)}>Revoke</button>:<span className="sub">—</span>}</td>
          </tr>;})}</tbody></table>
          {devices.length===0&&<div className="empty">{token?(loading?"Loading registered devices…":"No devices found. Enroll an iPhone to see it here."):"Authenticate above to view your enrolled iPhones."}</div>}
        </div>
        <div className="sub" style={{marginTop:14}}>{lastUpdated?"Last refreshed "+new Date(lastUpdated).toLocaleTimeString():"Waiting for connection"} · Online means a heartbeat was received within 2 minutes.</div>
      </section>
      <p className="sub" style={{marginTop:18,lineHeight:1.7}}>Campaign creation, batch approvals, command delivery and delivery reports are planned for the next migration stages. iOS Shortcuts check in when run; iOS does not guarantee continuous background execution.</p>
    </main>
  </div>;
}
