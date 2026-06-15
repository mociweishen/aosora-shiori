import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import * as iconv from 'iconv-lite';
import { MessageOptions } from 'vscode';
import GetMessage from './messages';
import { IsBinaryExecutablePlatform } from './utility';

const ERROR_CODE_INVALID_ARGS = 1;
const ERROR_CODE_GHOST_NOT_FOUND = 2;
const ERROR_CODE_GHOST_SCRIPT_ERROR = 3;
const ERROR_CODE_PREVIEW_SCRIPT_ERROR = 4;

let isExecuting = false;

//因为追加了unit和use，所以发送给 ghost 时需要这些信息。
export type SendScript = {
	scriptBody: string,
	unit: string,
	uses: string[]
};


//脚本预览
export async function SendPreviewFunction(sendScript:SendScript, extensionPath:string){
	if(isExecuting){
		vscode.window.showErrorMessage(GetMessage().scriptPreview001);
	}

	isExecuting = true;
	try{
		const outPath = extensionPath + "/" + '_aosora_send_script_.as';
		const executablePath = ((IsBinaryExecutablePlatform()) ? (extensionPath + "/" + "aosora-sstp.exe") : ("aosora-sstp.sh"));
		let command = `"${executablePath}" "${outPath}"`;

		//如果有工作区，则添加到路径
		const projFiles = await vscode.workspace.findFiles("**/ghost.asproj", null, 1);
		if(projFiles.length > 0){
			const workspace = path.dirname(projFiles[0].fsPath);
			if (IsBinaryExecutablePlatform()) {
				command += ` ${workspace}\\\\`;
			}
			else {
				command += ` "${workspace}/"`;
			}
		}

		let functionBody = "";
		functionBody += `unit ${sendScript.unit};\r\n`;
		functionBody += sendScript.uses.map(o => `use ${o};`).join("\r\n");
		functionBody += "\r\n";
		functionBody += sendScript.scriptBody;

		//调用临时文件
		await fs.promises.writeFile(outPath, functionBody, 'utf-8');

		//等待执行
		await new Promise<void>(r  => {
			childProcess.exec(command, (error, stdout, stderr) => {
				if(error){
					vscode.window.showErrorMessage(ExitCodeToString(error.code) + stderr);
				}
				r();
			});
		});

		await fs.promises.rm(outPath);
	}
	catch{}
	finally{
		isExecuting = false;
	}
}

function ExitCodeToString(code?:number){
	if(code == ERROR_CODE_GHOST_NOT_FOUND) {
		return "找不到脚本目标的 ghost。";
	}
	else if(code == ERROR_CODE_GHOST_SCRIPT_ERROR) {
		return "脚本读取错误。请检查 ghost 脚本是否保存正确。";
	}
	else if(code == ERROR_CODE_PREVIEW_SCRIPT_ERROR) {
		return "预览脚本出现读取错误。";
	}
	
	return "发送预览时出错。";
}
