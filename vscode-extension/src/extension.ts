import * as vscode from 'vscode';
import {DebugSendProvider} from "./debugSendProvider";
import { DebugAdapterFactory, DebugConfigurationProvider } from './debugger';
import GetMessage from './messages';
import { SendScript } from './scriptPreview';

export function activate(context: vscode.ExtensionContext) {

	const createDiagnosticCollection = vscode.languages.createDiagnosticCollection("aosora-diagnostic");
	const debugSendProvider = new DebugSendProvider(context.extensionPath, createDiagnosticCollection);

	//向 Ghost 发送命令
	const sendToGhostCommand = vscode.commands.registerCommand('aosora-shiori.sendToGhost', async (sendScript:SendScript, isError:boolean) => {
		await debugSendProvider.SendToGhost(sendScript, isError);
	});

	//脚本错误显示关系
	context.subscriptions.push(sendToGhostCommand);
	context.subscriptions.push(vscode.languages.registerCodeLensProvider('aosora', debugSendProvider));

	//调试器
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('aosora', new DebugAdapterFactory(context.extensionPath)));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('aosora', new DebugConfigurationProvider() ));

	
	vscode.commands.registerCommand("aosora.sendcaret", async () => {
		await debugSendProvider.SendFromMenu();
	});
}

export function deactivate() {}
