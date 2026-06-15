
// 检查当前平台是否能够运行 .exe 二进制文件
export function IsBinaryExecutablePlatform(): boolean {
    return process.platform === 'win32';
}

// 检测语言设置是否为日语
// VS Code 的环境配置比较麻烦，因此主语言设为英语，让海外用户始终看到英文界面
export function IsJapaneseLanguage(): boolean {
    const lang = (process.env.VSCODE_NLS_CONFIG && JSON.parse(process.env.VSCODE_NLS_CONFIG).locale) || '';
    return lang.startsWith('ja');
}

// 检测语言设置是否为中文（包括简体、繁体等）
export function IsChineseLanguage(): boolean {
    const lang = (process.env.VSCODE_NLS_CONFIG && JSON.parse(process.env.VSCODE_NLS_CONFIG).locale) || '';
    return lang.startsWith('zh');
}