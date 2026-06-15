import * as util from './utility';

//ja-jp
const MessageJaJp = {
	scriptPreview001: "トーク送信がすでに実行中です。しばらく待ってお試しください。",
	scriptPreview002: "スクリプトの読み込みに失敗しました。エラーを修正してから試してみてください。",
	scriptPreview003: "<< ゴーストに送信",
	scriptPreview004: "この関数を実行してゴーストに送信します。",
	scriptPreview005: "スクリプトが読み込み失敗する状態のため送信できません。",

	debugger001: "debug.debugger.runtime で設定されたパスにファイルが見つかりませんでした",
	debugger002: "ゴーストフォルダを検出できませんでした。",
	debugger003: "aosora プロジェクトフォルダを検出できませんでした。",
	debugger004: "すべてのエラー",
	debugger005: "実行時にエラーが発生したとき、キャッチされるかどうかにかかわらず実行中断します。",
	//debugger006: "asprojファイルで debug 設定が有効化されていません。",
	debugger007: "SSPを起動して接続しています...",
	debugger008: "デバッガはゴーストへの接続に失敗しました。",
	debugger009: "asprojファイルに debug.debugger.runtime 設定が見つかりません。",
	debugger010: "ワークスペースに ghost.asproj が見つからないため起動できませんでした。",
	debugger011: "ワークスペースに複数のghost.asprojがあるため起動に使用する1つを特定できませんでした。",
	debugger012: "起動中のゴーストにアタッチしています...",
	debugger013: "Aosora Debugger は Pause をサポートしていません。"
};
type Messages = typeof MessageJaJp;

//zh-cn
const MessageZhCn: Messages = {
	...MessageJaJp,     // 以日文为后备

	scriptPreview001: "对话发送正在执行中，请稍后再试。",
	scriptPreview002: "脚本加载失败，请修复错误后重试。",
	scriptPreview003: "<< 发送到 Ghost",
	scriptPreview004: "执行此函数并发送到 Ghost。",
	scriptPreview005: "由于脚本加载失败，无法发送。",
	debugger001: "在 debug.debugger.runtime 设定的路径中找不到文件",
	debugger002: "无法检测到 Ghost 文件夹。",
	debugger003: "无法检测到 aosora 项目文件夹。",
	debugger004: "所有错误",
	debugger005: "运行时发生错误时，无论是否被捕获都会中断执行。",
	//debugger006: "未在 asproj 文件中启用调试设置。",
	debugger007: "正在启动 SSP 并连接...",
	debugger008: "调试器无法连接到 Ghost。",
	debugger009: "在 asproj 文件中找不到 debug.debugger.runtime 设置。",
	debugger010: "工作区中找不到 ghost.asproj，因此无法启动。",
	debugger011: "工作区中存在多个 ghost.asproj，无法确定使用哪一个进行启动。",
	debugger012: "正在附加到运行中的 Ghost...",
	debugger013: "Aosora Debugger 不支持暂停。"
};

//en-us
const MessageEnUs:Messages = {
	...MessageJaJp,     // fallback to japanese

	scriptPreview003: "<< send to Ghost",

	debugger004: "all errors"
};



//----------

export default function GetMessage(): Messages {
	if (util.IsJapaneseLanguage()) {
		return MessageJaJp;
	} 
	else if (util.IsChineseLanguage()) {
		return MessageZhCn;
	} 
	else {
		return MessageEnUs;
	}
}

