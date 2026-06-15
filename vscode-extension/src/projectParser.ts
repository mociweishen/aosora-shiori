import * as fs from "fs/promises";

export class ProjectParser {

	public runtimePath:string;	//运行时（SSP）路径
	//public enableDebug:boolean;

	public constructor(){
		this.runtimePath = "../../../../ssp.exe";	//推测默认SSP的相对路径
		//this.enableDebug = false;
	}

	public async Parse(filename:string){

		try{
			//分析Aosora项目数据
			const projectFile = await fs.readFile(filename, {encoding:"utf-8"});
			const lines = projectFile.split("\n");
			for(const line of lines){

				//删除注释
				const commentIndex = line.indexOf("//");
				const lineWithoutComment = commentIndex !== -1 ? line.substring(0, commentIndex) : line;

				//删除换行符和空格并用逗号分隔
				const items = lineWithoutComment.replace("\t", "").replace("\r", "").replace(" ", "").split(",");
				if(items.length !== 2){
					continue;
				}

				if(items[0] === 'debug.debugger.runtime'){
					//运行时指定
					this.runtimePath = items[1];
				}
				else if(items[0] === 'debug'){
					//因为现在没看所以暂时无视
					//this.enableDebug = this.SettingsToBool(items[1]);
				}
			}
		}
		catch {
			
		}
	}

	private SettingsToBool(s:string){
		if(s === '0'){
			return false;
		}
		else if(s.toLowerCase() === "false"){
			return false;
		}
		return true;
	}
}


