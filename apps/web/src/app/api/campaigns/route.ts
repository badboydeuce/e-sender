import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
async function proxy(request: NextRequest, method: "GET" | "POST", body?: unknown) {
  const token=request.headers.get("x-admin-token"), base=process.env.ESENDER_API_URL;
  if(!token)return NextResponse.json({message:"Admin token required"},{status:401});
  if(!base)return NextResponse.json({message:"ESENDER_API_URL is not configured"},{status:503});
  try {
    const response=await fetch(base.replace(/\/$/,"")+"/api/admin/campaigns",{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
    const data=await response.json().catch(()=>({message:"Invalid API response"}));
    return NextResponse.json(data,{status:response.status});
  } catch { return NextResponse.json({message:"Could not reach the eSender API"},{status:502}); }
}
export async function GET(request:NextRequest){return proxy(request,"GET");}
export async function POST(request:NextRequest){const body=await request.json().catch(()=>null);return proxy(request,"POST",body);}
