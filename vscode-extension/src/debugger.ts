import * as vscode from 'vscode';
import { Breakpoint, DebugSession, InitializedEvent,  LoadedSourceEvent,  OutputEvent,  Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread } from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { AosoraDebuggerInterface, LoadedSource, VariableInformation } from './debuggerInterface';
import { basename } from 'path';
import { LaunchDebuggerRuntime } from './debuggerRuntime';
import { LogLevel, LogOutputEvent } from '@vscode/debugadapter/lib/logger';
import { ProjectParser } from './projectParser';
import * as crypto from 'crypto';
import path = require('path');
import GetMessage from './messages';

const DEFAULT_PORT_NUMBER = 27016;

//面向aosora调试程序的设置信息
interface AosoraDebugConfiguration extends vscode.DebugConfiguration {
	port: number
};

//进行设定信息的补充、解决
export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: {}, token?: vscode.CancellationToken): vscode.ProviderResult<AosoraDebugConfiguration> {
		return {
			name: 'debug aosora',
			type: 'aosora',
			request: 'launch',
			port: DEFAULT_PORT_NUMBER,
			...config
		};
	}
}

export class DebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

	private extensionPath:string;
	public constructor(extensionPath:string){
		this.extensionPath = extensionPath;
	}

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new AosoraDebugSession(this.extensionPath));
	}
}


/**
 * 苍空调试会话
 */
class AosoraDebugSession extends DebugSession {

	private debugInterface: AosoraDebuggerInterface;
	private extensionPath: string;

	public constructor(extensionPath:string) {
		super();
		this.debugInterface = new AosoraDebuggerInterface();
		this.extensionPath = extensionPath;

		//配置各种回调
		this.debugInterface.onClose = () => {
			this.sendEvent(new TerminatedEvent());
		};

		this.debugInterface.onConnect = (editorDebuggerRevision:string, runtimeDebuggerRevision:string) => {
			if(editorDebuggerRevision !== runtimeDebuggerRevision){
				this.sendEvent(new OutputEvent("由于人格和VScode扩展的调试功能版本不同，可能无法正常通信。\n"));
			}
		}

		this.debugInterface.onNetworkError = () => {
			this.sendEvent(new OutputEvent("与人格通信时出错。", "stderr"));
		};

		this.debugInterface.onBreak = (errorMessage:string|null) => {
			const ev = new StoppedEvent('Breakpoint', 1, errorMessage ?? undefined);
			if(!errorMessage){
				ev.body.reason = 'breakpoint';
			}
			else {
				ev.body.reason = 'exception';
			}
			
			this.sendEvent(ev);
		};

		this.debugInterface.onMessage = (message:string, isError:boolean, filepath: string|null, line:number|null) => {

			const ev = new OutputEvent(message + "\n", isError ? 'stderr' : 'stdout') as DebugProtocol.OutputEvent ;
			if(line && filepath){
				ev.body.source = {
					path: filepath,
				};
				ev.body.line = line;
			}
			this.sendEvent(ev);
		}
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {


		response.body = {
			supportsExceptionInfoRequest: true,
			supportsLoadedSourcesRequest: true,
			supportsEvaluateForHovers: true,
			//supportsBreakpointLocationsRequest: true,
			supportedChecksumAlgorithms: ['MD5'],
			exceptionBreakpointFilters: [
				{
					label: GetMessage().debugger004,
					description: GetMessage().debugger005,
					filter: "all",
					default: false
				},
				{
					label: "未捕获的错误",
					description: "当运行时发生错误且未被捕获时，程序会中断执行。",
					filter: "uncaught",
					default: true
				}
			]
		};

		this.sendResponse(response);

		//準備完了
		this.sendEvent(new InitializedEvent());
	}

	protected terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request): void {
		this.debugInterface.Disconnect();
		this.sendResponse(response);
	}

	//调试启动的请求（附加/Attach 是另外存在的）
	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: any) :Promise<void>{

		//解析项目文件
		const ghostProj = await vscode.workspace.findFiles("**/ghost.asproj");
		if(ghostProj.length == 1){
			//读取项目文件
			const project = new ProjectParser();
			const projPath = ghostProj[0].fsPath;
			const debugPath = path.join(path.dirname(projPath), "debug.asproj");
			await project.Parse(projPath);
			await project.Parse(debugPath);

			//启动
			if(project.runtimePath){
				const aosoraDir = path.dirname(projPath);
				const ghostPath = path.dirname(path.dirname(aosoraDir));	//项目上一层
				try{
					this.sendEvent(new OutputEvent(`${GetMessage().debugger007}\n`, "stdout"));
					LaunchDebuggerRuntime(this.extensionPath, project.runtimePath, ghostPath, aosoraDir, () => {
						this.sendEvent(new TerminatedEvent());
					});
				}
				catch(e){
					const err = e as Error
					vscode.window.showErrorMessage(err.message);
					this.sendEvent(new TerminatedEvent());	
					return;
				}

				try{
					await this.debugInterface.Connect();
				}
				catch{
					vscode.window.showErrorMessage(GetMessage().debugger008);
					this.sendEvent(new TerminatedEvent());	
					return;
				}
			}
			else {
				vscode.window.showErrorMessage(GetMessage().debugger009);
				this.sendEvent(new TerminatedEvent());
			}
		}
		else if(ghostProj.length == 0) {
			//触发terminate事件
			vscode.window.showErrorMessage(GetMessage().debugger010);
			this.sendEvent(new TerminatedEvent());
			return;
		}
		else {
			//触发terminate事件
			vscode.window.showErrorMessage(GetMessage().debugger011);
			this.sendEvent(new TerminatedEvent());
			return;
		}

		this.sendResponse(response);
	}

	//附加
	protected async attachRequest(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments, request?: DebugProtocol.Request) {

		this.sendEvent(new OutputEvent(`${GetMessage().debugger012}\n`, "stdout"));

		//纯粹连接的形式
		try{
			await this.debugInterface.Connect();
		}
		catch{
			vscode.window.showErrorMessage(GetMessage().debugger008);
			this.sendEvent(new TerminatedEvent());	
			return;
		}
		this.sendResponse(response);
	}

	//纯粹连接的形式
	protected async setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments, request?: DebugProtocol.Request): Promise<void> {
		await this.debugInterface.WaitForConnect();
		await this.debugInterface.SetExceptionBreakPoints(args.filters);
		this.sendResponse(response);
	}

	protected exceptionInfoRequest(response: DebugProtocol.ExceptionInfoResponse, args: DebugProtocol.ExceptionInfoArguments, request?: DebugProtocol.Request): void {
		const breakInfo = this.debugInterface.GetBreakInfo();
		response.body = {
			breakMode: 'unhandled',
			exceptionId: breakInfo?.errorType ?? '',
			description: breakInfo?.errorMessage ?? ''
		};
		this.sendResponse(response);
	}

	//断点
	protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request): Promise<void> {
		await this.debugInterface.WaitForConnect();

		//获取文件名和行号
		const filename = args.source.path ?? "";
		const lines = args.lines ?? [];

		//转换为发送给调试器的行数
		const debuggerBreakPoints = lines.map(o => {
			return this.convertClientLineToDebugger(o);
		})

		//设定要求
		const enabledLines = await this.debugInterface.SetBreakPoints(this.convertClientPathToDebugger(filename), debuggerBreakPoints);
		const enabledLinesSet = new Set<number>(enabledLines);

		//转换为发送给调试器的行数
		const editorBreeakPoints = lines.map(o => {
			const bp = new Breakpoint(enabledLinesSet.has(o-1), o);
			bp.setId(o);
			return bp;
		});

		//完成
		response.body = {
			breakpoints: editorBreeakPoints
		};
		this.sendResponse(response);
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse, request?: DebugProtocol.Request): void {
		//因为 Aosora 是单线程的，所以直接返回固定值。
		response.body = {
			threads: [
				new Thread(1, "Aosora MainThread")
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments, request?: DebugProtocol.Request): void {
		//返回跟踪信息
		response.body = {
			stackFrames: []
		};

		const breakInfo = this.debugInterface.GetBreakInfo();
		if (breakInfo) {
			response.body.stackFrames = breakInfo.stackTrace.map(o => {
				return new StackFrame(o.id, o.name, this.createSource(o.filename), this.convertDebuggerLineToClient(o.line));
			});
		}
		this.sendResponse(response);
	}

	//执行
	protected async continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments, request?: DebugProtocol.Request): Promise<void>{
		await this.debugInterface.Continue();
		this.sendResponse(response);
	}

	//布过
	protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.Request): Promise<void> {
		await this.debugInterface.StepOver();
		this.sendResponse(response);
	}

	//步入
	protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments, request?: DebugProtocol.Request): Promise<void> {
		await this.debugInterface.StepIn();
		this.sendResponse(response);
	}

	//步出
	protected async stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments, request?: DebugProtocol.Request): Promise<void> {
		await this.debugInterface.StepOut();
		this.sendResponse(response);
	}

	//切断
	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
		this.debugInterface.Disconnect();
		this.sendResponse(response);
	}

	protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request): void {
		vscode.window.showErrorMessage(GetMessage().debugger013);
		this.sendResponse(response);
	}

	//变量信息请求
	protected async scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments, request?: DebugProtocol.Request): Promise<void> {

		const scopes = await this.debugInterface.RequestEnumScopes(args.frameId);
		response.body = {
			scopes: scopes.map(o => new Scope(o.name, o.handle))
		};
		this.sendResponse(response);
	}

	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {

		//变量
		let variables: DebugProtocol.Variable[] = (await this.debugInterface.RequestObject(args.variablesReference)).map(o => this.convertVariable(o));

		response.body = {
			variables
		};
		this.sendResponse(response);
	}

	protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments, request?: DebugProtocol.Request): Promise<void> {

		if(args.frameId !== undefined){
			const expression = args.expression;
			const frameId = args.frameId;

			switch (args.context) {
				case 'watch':
				case 'hover':
					const result = await this.debugInterface.RequestEvaluateExpression(expression, frameId);

					if(result.value){
						const variable = this.convertVariable(result.value);
						response.body = {
							result: variable.value ?? "",
							variablesReference: variable.variablesReference,
							type: variable.type
						};
						this.sendResponse(response);
						return;
					}
					else if(result.exception && args.context !== 'hover') {
						const variable = this.convertVariable(result.exception);
						response.body = {
							result: (result.errorType ?? "Error") + ": " + (variable.value ?? ""),
							variablesReference: variable.variablesReference,
							type: variable.type
						};
						this.sendResponse(response);
						return;
					}
					
			}
		}

		if(args.context === 'hover'){
			//即使悬停时显示的信息不正确，也不做任何处理。
			this.sendResponse(response);
		}

		response.body = {
			result: 'not supported',
			variablesReference: 0
		};
		this.sendResponse(response);
	}

	//读取源码请求
	protected async loadedSourcesRequest(response: DebugProtocol.LoadedSourcesResponse, args: DebugProtocol.LoadedSourcesArguments, request?: DebugProtocol.Request): Promise<void> {
		await this.debugInterface.WaitForConnect();
		const sources = await this.debugInterface.RequestLoadedSource();
		response.body = {
			sources: sources.map(o => this.createLoadedsource(o))
		};
		this.sendResponse(response);
	}

	//中断位置请求
	//NOTE: 由于行为与预期不符（例如没有自动设为无效状态），因此将其保持为禁用状态。
	//		类似于收集行内断点可设置位置
	/*
	protected async breakpointLocationsRequest(response: DebugProtocol.BreakpointLocationsResponse, args: DebugProtocol.BreakpointLocationsArguments, request?: DebugProtocol.Request): Promise<void> {
		if(!args.source.path){
			response.body = {
				breakpoints: []
			};
			this.sendResponse(response);
		}
		else {
			const filename = this.convertDebuggerPathToClient(args.source.path);
			const lines = await this.debugInterface.RequestBreakpointLocations(filename);
			response.body = {
				breakpoints: lines.map(o => ({line: o+1}))
			};
			this.sendResponse(response);
		}
	}
	*/

	//辅助类
	private createSource(filename: string) {
		return new Source(basename(filename), this.convertDebuggerPathToClient(filename));
	}

	private createLoadedsource(source: LoadedSource):DebugProtocol.Source{
		return {
			path: source.path, 
			checksums: source.md5 ? [{algorithm: 'MD5', checksum: source.md5}] : undefined
		};
	}

	private convertVariable(v: VariableInformation): DebugProtocol.Variable {
		if(v.primitiveType == 'null'){
			return {
				name: v.key,
				value: 'null',
				type: 'null',
				variablesReference: -1,
			};
		}
		else if(v.primitiveType == 'string'){
			return {
				name: v.key,
				value: `"${v.value}"`,
				type: v.primitiveType,
				variablesReference: -1
			}
		}
		else if (v.primitiveType != 'object') {
			return {
				name: v.key,
				value: v.value?.toString() ?? null,
				type: v.primitiveType,
				variablesReference: -1
			};
		}
		else {
			return {
				name: v.key,
				value: `(${v.objectType})`,
				type: v.primitiveType,
				variablesReference: v.objectHandle
			};
		}
	}
}