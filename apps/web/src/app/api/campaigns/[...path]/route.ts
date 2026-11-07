import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
async function forward(request:NextRequest,context:{params:Promise<{path:string[]}>}){
 const token=request.headers.get("x-admin-token"),base=process.env.ESENDER_API_URL;
 if(!token)return NextResponse.json({message:"Admin token required"},{status:401});
 if(!base)return NextResponse.json({message:"ESENDER_API_URL is not configured"},{status:503});
 const {path}=await context.params;
 if(path.some(part=>part===".."||part.includes("/")))return NextResponse.json({message:"Invalid path"},{status:400});
 const method=request.method;
 const body=["POST","PATCH"].includes(method)?await request.text():undefined;
 try{
  const upstream=await fetch(base.replace(/\/$/,"")+"/api/admin/campaigns/"+path.map(encodeURIComponent).join("/"),{method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body,cache:"no-store"});
  const data=await upstream.json().catch(()=>({message:"Invalid API response"}));
  return NextResponse.json(data,{status:upstream.status});
 }catch{return NextResponse.json({message:"Could not reach the eSender API"},{status:502});}
}
export async function GET(request:NextRequest,context:{params:Promise<{path:string[]}>}){return forward(request,context);}
export async function POST(request:NextRequest,context:{params:Promise<{path:string[]}>}){return forward(request,context);}
export async function PATCH(request:NextRequest,context:{params:Promise<{path:string[]}>}){return forward(request,context);}
