import * as vscode from 'vscode';
import {Analyze, AnalyzedSourceRange, AnalyzeResult} from './scriptAnalyzer';
import {IsBinaryExecutablePlatform} from './utility';
import GetMessage from './messages';
import {SendPreviewFunction, SendScript} from './scriptPreview';

const functionPattern = /(function|talk)/g;

export class DebugSendProvider implements vscode.CodeLensProvider{

	private extensionPath:string;
	private diag:vscode.DiagnosticCollection;
	private lastSuccessAnalyzeResult:AnalyzeResult|null;
	private isAnalyzeSuccess:boolean;

	constructor(extensionPath:string, diag: vscode.DiagnosticCollection){
		this.extensionPath = extensionPath;
		this.diag = diag;
		this.lastSuccessAnalyzeResult = null;
		this.isAnalyzeSuccess = false;
	}

	private MakeSourceRange(range:AnalyzedSourceRange):vscode.Range{
		return new vscode.Range(range.line, range.column, range.endLine, range.endColumn);
	}

	public async SendToGhost(scriptBody:SendScript, isError:boolean){
		if(!isError){
			if(scriptBody){
				await SendPreviewFunction(scriptBody, this.extensionPath);
			}
		}
		else{
			vscode.window.showErrorMessage(GetMessage().scriptPreview002);
		}
	}

	public async SendFromMenu() {

		if(!this.isAnalyzeSuccess){
			//无法发送
			return ;
		}

		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const position = editor.selection.active;

		if(this.lastSuccessAnalyzeResult && this.lastSuccessAnalyzeResult.functions){

			//检测函数组的位置
			for(const func of this.lastSuccessAnalyzeResult.functions){
				//检查光标是否包含在该位置范围内
				const r = this.MakeSourceRange(func.range);
				if(r.contains(position)){
					//发送对象
					const script = editor.document.getText(r);
					this.SendToGhost({
						scriptBody: script,
						unit: this.lastSuccessAnalyzeResult.unit!,
						uses: this.lastSuccessAnalyzeResult.uses!
					}, false);
					return;
				}
			}
		}
	}
	
	public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
		
		//启动aosora-analyzer
		const analyzeResult = await Analyze(document, this.extensionPath);
		if(!analyzeResult.error){
			//无错误
			this.diag.set(document.uri, []);
			this.lastSuccessAnalyzeResult = analyzeResult;
			this.isAnalyzeSuccess = true;
		}
		else {
			this.isAnalyzeSuccess = false;

			//如果抛出了可识别的错误，则说明是语法错误，因此需要将错误提示反映到编辑器中。
			if(analyzeResult.message && analyzeResult.range){
				const range = this.MakeSourceRange(analyzeResult.range);
				if(range){
				this.diag.set(document.uri, [
						{
							message: analyzeResult.message,
							range: range,
							severity: vscode.DiagnosticSeverity.Error
						}
					]);
				}
			}
			else {
				//无法识别的错误：没办法，只能忽略。
				this.diag.set(document.uri, []);
			}
		}

		//最后使用解析成功的信息来生成 CodeLens
		//因为如果在失败时将其禁用，在编写脚本时会导致显示内容不断闪烁
		if(this.lastSuccessAnalyzeResult && this.lastSuccessAnalyzeResult.functions){
			const result:vscode.CodeLens[] = [];
			for(const item of this.lastSuccessAnalyzeResult.functions){
				const scriptRange = this.MakeSourceRange(item.range);
				const script = document.getText(scriptRange);

				//如果存在 function 或 talk 关键字，则采用该结果
				//这样在解析报错时，既能保持函数行上的 CodeLens 显示，又能防止在明显不是函数的地方错误地显示发送提示。
				const keyWordRange = document.getWordRangeAtPosition(new vscode.Position(item.range.line, item.range.column), functionPattern);;
				if(keyWordRange){
					const codeLens = new vscode.CodeLens(keyWordRange);
					const sendScript:SendScript = {
						scriptBody: script,
						unit: this.lastSuccessAnalyzeResult.unit!,
						uses: this.lastSuccessAnalyzeResult.uses!
					};

					codeLens.command = {
						title: GetMessage().scriptPreview003,
						command: "aosora-shiori.sendToGhost",
						tooltip: !analyzeResult.error ? GetMessage().scriptPreview004 : GetMessage().scriptPreview005,
						arguments: [sendScript, analyzeResult.error]                        
					};
					result.push(codeLens);
				}
			}

			return result;
		}
		else {
			return [];
		}
	}

}