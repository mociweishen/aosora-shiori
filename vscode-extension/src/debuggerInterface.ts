import { randomUUID } from 'crypto';
import {number, z} from 'zod';
import * as Net from 'net';
import { DEBUGGER_REVISION } from './version';

//Aosora调试器接口
type BreakPointRequest = {
	filename: string,
	lines: number[]
};

const DebuggerReceiveFormat = z.object({
	type: z.string(),
	responseId: z.string(),
	body: z.any()
})
type DebuggerReceiveFormat = z.infer<typeof DebuggerReceiveFormat>;

const StackFrame = z.object({
	id: z.number(),
	index: z.number(),
	name: z.string(),
	filename: z.string(),
	line: z.number()
});
type StackFrame = z.infer<typeof StackFrame>;

const BreakHitRequest = z.object({
	filename: z.string(),
	line: z.number(),
	stackTrace: z.array(StackFrame),
	errorMessage: z.nullable(z.string()),
	errorType: z.nullable(z.string())
});
type BreakHitRequest = z.infer<typeof BreakHitRequest>;

const MessageRequest = z.object({
	message: z.string(),
	isError: z.boolean(),
	filepath: z.optional(z.string()),
	line: z.optional(z.number())
});
type MessageRequest = z.infer<typeof MessageRequest>;

const VariableInformation = z.object({
	key: z.string(),
	primitiveType: z.string(),
	objectType: z.string(),
	objectHandle: z.number(),
	value: z.any()
});
export type VariableInformation = z.infer<typeof VariableInformation>;

const ScopeInformation = z.object({
	name: z.string(),
	handle: z.number()
});
export type ScopeInformation = z.infer<typeof ScopeInformation>;

const VariableScopeResponse = z.object({
	variables: z.array(VariableInformation)
});
export type VariableScopeResponse = z.infer<typeof VariableScopeResponse>;

const EnumScopeResponse = z.object({
	scopes: z.array(ScopeInformation)
});
export type EnumScopeResponse = z.infer<typeof EnumScopeResponse>;

const EvaliuateExpressionResponse = z.object({
	value: z.optional(VariableInformation),
	exception: z.optional(VariableInformation),
	errorType: z.optional(z.string())
});
export type EvaliuateExpressionResponse = z.infer<typeof EvaliuateExpressionResponse>;

const LoadedSource = z.object({
	path: z.string(), 
	md5: z.optional(z.string()),
});
export type LoadedSource = z.infer<typeof LoadedSource>;

const LoadedSourcesResponse = z.object({
	files: z.array(LoadedSource)
});
export type LoadedSourcesResponse = z.infer<typeof LoadedSourcesResponse>;

const BreakpointLocationsResponse = z.object({
	lines: z.array(z.number())
});
export type BreakpointLocationsResponse = z.infer<typeof BreakpointLocationsResponse>;

const VersionResponse = z.object({
	version: z.string(),
	debuggerRevision: z.string()
});
export type VersionResponse = z.infer<typeof VersionResponse>;

export class AosoraDebuggerInterface {

	public onConnect:(editorDebuggerRevision:string, runtimeDebuggerRevision:string) => void;
	public onClose:() => void;
	public onBreak:(errorMessage: string|null) => void;
	public onMessage:(message:string, isError:boolean, filepath:string|null, line:number|null) => void;
	public onNetworkError:() => void;

	private socketClient:Net.Socket|null;
	private breakInfo:BreakHitRequest|null;
	private connectWaitList:(()=>void)[];
	private isConnected = false;
	private isConnectCancel = false;

	//等待响应列表
	private responseMap:Map<string, (body:any, error: any) => void>;

	public constructor(){
		this.onConnect = () => {};
		this.onClose = () => {};
		this.onBreak = () => {};
		this.onMessage = () => {};
		this.onNetworkError = () => {};
		this.responseMap = new Map<string, ()=>void>();
		this.socketClient = null;
		this.breakInfo = null;
		this.connectWaitList = [];
	}

	private NotifyError():never{
		this.onNetworkError();
		throw new Error();
	}

	//获取中断信息
	public GetBreakInfo(){
		return this.breakInfo;
	}

	private async Wait(ms:number){
		return new Promise<void>(resolve => {
			setTimeout(() => resolve(), ms);
		});
	}

	//连接：内部
	private async ConnectInternal(){
		return new Promise<void>((resolve, reject) => {
				this.socketClient = Net.connect(27016, 'localhost', () => {
				resolve();
				for(const callback of this.connectWaitList){
					callback();
				}
				this.isConnected = true;
			});

			//接收
			this.socketClient.on('data', (data => {
				let offset = 0;
				while(true){
					const index = data.indexOf(0, offset);
					if(index < 0){
						break;
					}					

					//请求处理
					let requestObj = null;
					try{
						const dataStr = data.toString('utf8', offset, index);
						requestObj = JSON.parse(dataStr);
					}
					catch{
						console.log("json parse error");
					}
					this.Recv(requestObj);
					offset = index + 1;
				}
				
			}));

			//结束
			this.socketClient.on('close', () => {
				console.log('client-> connection is closed');
				if(!this.isConnected){
					//等待连接
					reject();
				}
				else{
					this.onClose();
				}
			});
		});
	}

	//连接
	public async Connect() {

		//等待30秒的形式
		for(let i = 0; i < 30; i++){
			if(this.isConnectCancel){
				return;
			}
			try{
				await this.ConnectInternal();

				//版本请求
				const versionInfo = await this.RequestVersion();	//接続成功
				this.onConnect(DEBUGGER_REVISION, versionInfo.debuggerRevision);
				return;
			}
			catch{
				//连接待机
				await this.Wait(1000);
			}
		}

		//连接失败
		throw new Error();
	}

	//如果正在连接，则等待
	public async WaitForConnect(){
		return new Promise<void>((resolve) => {
			if(!this.isConnected){
				this.connectWaitList.push(resolve);
			}
			else{
				resolve();
			}
		});
	}

	public IsConnectCancel(){
		return this.isConnectCancel;
	}

	//发送请求
	public Send(requestType:string, requestBody: {}, callback?: (response:any, error:any) => void ){
		const request = {
			type: requestType,
			body: requestBody,
			id: ""
		};

		if(callback){
			//如果是回调请求，则生成用于回调的唯一ID，并将其加入等待队列。
			request.id = randomUUID();
			this.responseMap.set(request.id, callback);
		}

		//发送请求时，在末尾添加0作为结束标志。
		const buff = (new TextEncoder).encode(JSON.stringify(request));
		const sendBuff = new Uint8Array(buff.length + 1);
		sendBuff.set(buff);
		sendBuff.set([0], buff.length);		//以0结尾发送
		this.socketClient?.write(sendBuff);
	}

	//Promise 版本的 Send
	public async SendPromise(requestType: string, requestBody: {}):Promise<any>{
		return new Promise((resolve, reject) => {
			this.Send(requestType, requestBody, (r, e) => {
				if(e){
					reject(e);
					return;
				}
				resolve(r);
			})
		});
	}

	private Recv(requestObj:any) {

		//接收时，需要判断是来自客户机的请求，还是监视的响应，如果是响应，则需要回调
		const parsedRequest = DebuggerReceiveFormat.safeParse(requestObj);
		if(!parsedRequest.success){
			return;
		}

		const req = parsedRequest.data;
		const body = parsedRequest.data.body;

		if(req.type == 'break'){
			const parsedBody = BreakHitRequest.safeParse(body);
			if(parsedBody.success){
				this.RecvBreak(parsedBody.data);
			}
		}
		else if(req.type == 'message'){
			const parsedMessage = MessageRequest.safeParse(body);
			if(parsedMessage.success){
				this.onMessage(parsedMessage.data.message, parsedMessage.data.isError,
					parsedMessage.data.filepath ?? null, parsedMessage.data.line ?? null
				);
			}
		}
		else if(req.type == "response"){
			const callback = this.responseMap.get(req.responseId);
			if(callback){
				this.responseMap.delete(req.responseId);
				callback(body, false);
			}
		}
		else if(req.type == "error_response"){
			const callback = this.responseMap.get(req.responseId);
			if(callback){
				this.responseMap.delete(req.responseId);
				callback(null, true);
			}
		}
	}

	//中断请求
	private RecvBreak(request: BreakHitRequest){
		this.breakInfo = request;
		this.onBreak(this.breakInfo.errorMessage);
	}

	//-- 编辑器接口

	//断点设置（由于编辑器方面的原因，每个文件替换的形式）
	public async SetBreakPoints(filename: string, lines: number[]):Promise<number[]>{
		const requestBody = {
			filename:  filename.replace("\\\\", "\\"),
			lines
		};
		const response = await this.SendPromise('set_breakpoints', requestBody);
		const parsedResponse = BreakpointLocationsResponse.safeParse(response);
		if(parsedResponse.success){
			return parsedResponse.data.lines;
		}
		this.NotifyError();
	}

	//异常断点设置
	public async SetExceptionBreakPoints(exceptions: string[]){
		const requestBody = {
			filters: exceptions
		};
		this.SendPromise('set_exception_breakpoint', requestBody);
	}

	public RequestEnumScopes(stackIndex:number){
		return new Promise<ScopeInformation[]>((resolve, reject) => {
			this.Send('scopes',{stackIndex: stackIndex}, (response, error) => {
				if(error){
					reject();
				}

				const parsedScopes = EnumScopeResponse.safeParse(response);
				if(parsedScopes.success){
					resolve(parsedScopes.data.scopes);
				}
				else {
					reject();
				}
			});
		});
	}

	public RequestObject(handle:number){
		return new Promise<VariableInformation[]>((resolve, reject) => {
			this.Send('members', {handle: handle}, (response, error) => {
				if(error){
					reject();
				}

				const parsedVariables = VariableScopeResponse.safeParse(response);
				if(parsedVariables.success){
					resolve(parsedVariables.data.variables);
				}
				else {
					reject();
				}

			});
		});
	}

	public RequestEvaluateExpression(expression:string, stackIndex:number){
		return new Promise<EvaliuateExpressionResponse>((resolve, reject) => {
			this.Send('evaluate', {expression, stackIndex}, (response, error) => {
				if(error){
					reject();
				}

				const parsedVariable = EvaliuateExpressionResponse.safeParse(response);
				if(parsedVariable.success){
					resolve(parsedVariable.data);
				}
				else {
					reject();
				}
			})
		});
	}

	//继续调试
	public async Continue(){
		await this.SendPromise("continue", {});
	}

	public async StepIn(){
		await this.SendPromise("stepin", {});
	}

	public async StepOut(){
		await this.SendPromise("stepout", {});
	}

	public async StepOver(){
		await this.SendPromise("stepover", {});
	}

	public async RequestLoadedSource(){
		const response = await this.SendPromise("loaded_sources", {});
		const parsedResponse = LoadedSourcesResponse.safeParse(response);
		if(parsedResponse.success){
			return parsedResponse.data.files;
		}
		this.NotifyError();
	}

	public async RequestBreakpointLocations(filename:string){
		const response = await this.SendPromise("breakpoint_locations", {
			filename:  filename.replace("\\\\", "\\"),
		});
		const parsedResponse = BreakpointLocationsResponse.safeParse(response);
		if(parsedResponse.success){
			return parsedResponse.data.lines;
		}
		this.NotifyError();
	}

	public async RequestVersion() {
		const response = await this.SendPromise("version", {});
		const parsedResponse = VersionResponse.safeParse(response);
		if(parsedResponse.success){
			return parsedResponse.data;
		}
		this.NotifyError();
	}

	//切断
	public Disconnect(){
		this.isConnectCancel = true;
		this.socketClient?.end();
	}
}