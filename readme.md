<div style="display:flex">
    <img src="assets/aosora-icon.svg" width="64">
    <div style="margin-left: 10px">
        <h2 style="display:inline">蒼空 / aosora-shiori</h2><br>
        试试制作书签吧项目
    </div>
</div>

## 这是什么？
这是用于伺か（Ukagaka）幽灵的 SHIORI「蒼空」的开发项目的中文化分支。

## 试试看
可以从 Release 页面下载演示幽灵或 SHIORI 本体 dll。
还有针对 VSCode 的小扩展功能。

[wiki页面](https://github.com/mociweishen/aosora-shiori/wiki) 上写有规格指南等，有兴趣的话可以看看。

## 使用条款等
分发的 aosora.dll 可作为伺か幽灵用的 SHIORI・SAORI 自由使用和分发。
源文件的许可证尚未确定，因此除个别许可的情况外，请仅用于个人使用或参与本项目的开发。
本程序无任何保证。作者对因本程序引发的任何现象不承担责任。

## 关于构建
* 启动仓库内的幽灵（/ssp/*）时
  * 需要构建 aosora.dll
* 构建 vscode 扩展（/vscode-extension/*）时
  * 需要构建 aosora-sstp.exe

请先构建 aosora-shiori.sln。  
构建产物会分别配置好所需的文件。

## 其他
* 月波 清火（@tukinami_seika@fedibird.com）先生/女士为我们设计了图标。

* 使用了 jsoncpp（https://github.com/open-source-parsers/jsoncpp）。这是一个公共领域的 JSON 序列化库。
