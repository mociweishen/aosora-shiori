import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import GetMessage from './messages';
import { IsBinaryExecutablePlatform } from './utility';

//启动运行时（SSP）
export function LaunchDebuggerRuntime(extensionPath:string, runtimePath:string, ghostPath:string, projPath:string, onProcessExit?:()=>void){

	let runtimeResolvedPath = runtimePath;
	if(!path.isAbsolute(runtimePath)){
		runtimeResolvedPath = path.join(projPath, runtimePath);
	}
	if(IsBinaryExecutablePlatform() && !fs.existsSync(runtimeResolvedPath)){
		throw new Error(`${GetMessage().debugger001}: ${runtimeResolvedPath}`);
	}

	if(!fs.existsSync(ghostPath)){
		throw new Error(GetMessage().debugger002);
	}

	if(!fs.existsSync(projPath)){
		throw new Error(GetMessage().debugger003);
	}

	//进程启动
	const scriptPath = ((IsBinaryExecutablePlatform()) ? (extensionPath + "\\launch.bat") : ("aosora-launch.sh"));
	const command = `"${scriptPath}" "${runtimePath}" "${ghostPath}" "${projPath}"`;
	childProcess.exec(command, (error, stdout, stderr) => {
		if(error){
			console.error(error);
		}
		else {
			//流程正常结束
		}
		if(onProcessExit){
			onProcessExit();
		}
	});
}
