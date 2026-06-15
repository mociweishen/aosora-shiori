import * as vscode from 'vscode';
import { exec } from 'child_process';
import {z} from 'zod';
import {IsBinaryExecutablePlatform, IsJapaneseLanguage, IsChineseLanguage} from './utility';

const AnalyzedSourceRange = z.object({
	line: z.number(),
	column: z.number(),
	endLine: z.number(),
	endColumn: z.number()
});

const AnalyzeResult = z.object({
	error: z.boolean(),
	message: z.optional(z.string()),
	range: z.optional(AnalyzedSourceRange),
	functions: z.optional(z.array(z.object({
		range: AnalyzedSourceRange
	}))),
	unit: z.optional(z.string()),
	uses: z.optional(z.array(z.string()))
});

export type AnalyzedSourceRange = z.infer<typeof AnalyzedSourceRange>;
export type AnalyzeResult = z.infer<typeof AnalyzeResult>;


function AnalyzeScript(script:string, extensionPath:string):Promise<AnalyzeResult>{

	const executablePath = ((IsBinaryExecutablePlatform()) ? (extensionPath + "/" + "aosora-analyzer.exe") : ("aosora-analyzer"));
	let command = executablePath;

	//根据语言环境设置分析器的语言
	if(IsJapaneseLanguage()){
		command += " --language ja-jp";
	}
	else if(IsChineseLanguage()){
		command += " --language zh-cn";
	}
	else {
		command += " --language en-us";
	}

	return new Promise<string>((resolve, reject) => {
		const child = exec(command, (error, stdout) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(JSON.parse(stdout));
		});
		if (child.stdin) {
			child.stdin.write(script);
			child.stdin.end();
		}
	})
		.then(o => AnalyzeResult.parseAsync(o))
		.catch( () => ({error: true, message: "exec error"}));
}

//基于运行时的脚本分析器
export async function Analyze(document:vscode.TextDocument, extensionPath:string){
	const str = document.getText();
	return await AnalyzeScript(str,extensionPath);
}