// The module 'vscode' contains the VS Code extensibility API

// import { text } from 'stream/consumers';

// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { TextEncoder } = require('util'); 
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('***************************************************Congratulations, your extension "mybatis-generator" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('mybatis-generator.generateMybatisQuery', async function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from mybatis generator!');
		await generateMybatisQuery();
	});

	context.subscriptions.push(disposable);
}

async function generateMybatisQuery(){

	const editor = vscode.window.activeTextEditor;
	if(!editor){
		vscode.window.showErrorMessage('활성화된 에디터가 없습니다');
		return;
	}

	const selection = editor.selection;

	// 쿼리를 생성하기위해 드래그한 함수 ( 반환형 혐수명 매개변수 )
	const text = editor.document.getText(selection);

	const functionInfo = extractFunctionInfo(text);

	const queryType = await vscode.window.showQuickPick(['SELECT', 'INSERT', 'UPDATE', 'DELETE'], {
        placeHolder: 'Select query type'
    });

	if (!queryType){
		return;
	}

	const vo = extractVO();

	const query = generateQuery(functionInfo, queryType);

	const xmlFile = await findOrCreateXmlFile(vscode);	

	insertQueryToXml(xmlFile, query);

}

function extractFunctionInfo(code) {

    // 정규 표현식 패턴
    const pattern = /(?:(?:static\s+)?(?:public|private|protected)?\s+)?(\w+(?:<.*?>)?)\s+(\w+)\s*\(\s*((?:\w+(?:<.*?>)?\s+\w+(?:\s*,\s*)?)*)\s*\)/;
  
    // 정규 표현식 실행
    const match = code.match(pattern);
  
    if (match) {
      // 매칭된 그룹 추출
      const [, returnType, functionName, parameterTypes] = match;
      console.log('파라미터즈',parameterTypes);
      // 파라미터 타입 처리
      const params = parameterTypes ? parameterTypes.split(',').map(param => param.trim().split(/\s+/)[0]) : [];
  
      return {
        functionName,
        returnType,
        params
      };
    }
  
    return null; // 매칭 실패 시 null 반환
  }

function extractVO(){

	const editor = vscode.window.activeTextEditor;
	const context = editor.document.getText();
	

}

//쿼리 생성
function generateQuery(functionInfo, queryType){
	if(queryType == 'INSERT'){
		let query = `
			<insert id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]}">
				INSERT INTO (
					
				)
				     VALUES (
				
					 )
			     
			</insert>
		`;
		return query;
	}

	if(queryType == 'SELECT'){
		let query=`
			<select id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]} resultType="${functionInfo.returnType}">
				SELECT * 
				  FROM
				 WHERE
			</select
		`
		return query;
	}

	if(queryType == 'UPDATE'){
		let query=`<update id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]}">
			UPDATE 
			   SET
			 WHERE
		</update>

		`;
		return query;
	}

	if(queryType == 'DELETE'){
		let query=`<delete id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]}">
			DELETE FROM 
			 WHERE
		</delete>`;
		return query;
	}

	
}
// mapper 파일 찾기 - 없을 시 생성
async function findOrCreateXmlFile(vscode){
	const workspaceFolders =  vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace is currently open');
        return;
    }

	const currrentFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
	const regex = /main\\java\\(.*)$/;
	const match = currrentFilePath.match(regex);
	if(!match){
		vscode.window.showErrorMessage('No workspace is currently open');
		return;
	}
	const extractedPatch = match[1];
	const modifiedPath = extractedPatch.replace('.java','').replace(/\\/g, '.');

	let fileName = currrentFilePath.split('\\').pop();
	fileName = fileName.substr(0,fileName.indexOf('Mapper.java')) + '_SQL.xml';

	const workspacePath = workspaceFolders[0].uri.fsPath; 
	const resourcesPath = workspacePath + '\\src\\main\\resources\\mappers\\' + fileName;


	const context = `<?xml version="1.0" encoding="UTF-8"?>
	<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
	<mapper namespace="${modifiedPath}">
	</mapper>`;
	
	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(resourcesPath))
	}catch(e){

		const encoder = new TextEncoder(); // TextEncoder 인스턴스 생성
        const uint8Array = encoder.encode(context); // 문자열을 Uint8Array로 변환
		await vscode.workspace.fs.writeFile(vscode.Uri.file(resourcesPath), uint8Array);
	}

	return resourcesPath;
    // const filePath = path.join(workspacePath, fileName);
}

// mapper 파일에 해당 쿼리 이어붙이기
function insertQueryToXml(xmlFile, query){

}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
