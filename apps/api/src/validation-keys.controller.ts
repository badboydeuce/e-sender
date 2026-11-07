import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from "@nestjs/common";
import { IsBoolean, IsString, MinLength } from "class-validator";
import { DevicesService } from "./devices.service";
import { ValidationKeysService } from "./validation-keys.service";
class ImportKeysDto { @IsString() @MinLength(1) keys_text!:string; }
class EnabledDto { @IsBoolean() enabled!:boolean; }
@Controller("admin/validation-keys")
export class ValidationKeysController {
 constructor(private readonly devices:DevicesService,private readonly keys:ValidationKeysService){}
 private admin(header?:string){this.devices.requireAdmin(header);}
 @Get() list(@Headers("authorization") auth?:string){this.admin(auth);return this.keys.list();}
 @Post("import") import(@Headers("authorization") auth:string|undefined,@Body() body:ImportKeysDto){this.admin(auth);return this.keys.importLines(body.keys_text);}
 @Post(":id/test") test(@Headers("authorization") auth:string|undefined,@Param("id") id:string){this.admin(auth);return this.keys.test(id);}
 @Patch(":id") enable(@Headers("authorization") auth:string|undefined,@Param("id") id:string,@Body() body:EnabledDto){this.admin(auth);return this.keys.setEnabled(id,body.enabled);}
 @Delete(":id") remove(@Headers("authorization") auth:string|undefined,@Param("id") id:string){this.admin(auth);return this.keys.remove(id);}
}
