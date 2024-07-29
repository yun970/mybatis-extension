// The module 'vscode' contains the VS Code extensibility API

// import { text } from 'stream/consumers';

// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const { TextEncoder } = require('util'); 
const lodash = require('lodash');
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {


	const disposable = vscode.commands.registerCommand('mybatis-generator.generateMybatisQuery', async function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from mybatis generator!');
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

	const queryType = await vscode.window.showQuickPick(['SELECT', 'INSERT', 'UPDATE', 'DELETE'], {
        placeHolder: 'Select query type'
    });
	
	if (!queryType){
		return;
	}

	const tableName = await vscode.window.showInputBox({
        placeHolder: 'Input table name'
    });

	if (!tableName){
		return;
	}
	
	// 쿼리를 생성하기위해 드래그한 함수 ( 반환형 혐수명 매개변수 )
	const text = editor.document.getText(selection);

	const functionInfo = extractFunctionInfo(text);
	const xmlFile = await findOrCreateXmlFile(vscode);	

	const voFiles = await extractVoFiles(functionInfo);
	const voFields = await extractVoFields(voFiles);

	const query = await generateQuery(functionInfo, queryType, voFields, tableName);

	

	insertQueryToXml(xmlFile, query);

}
async function extractVoFiles(functionInfo){

	const voFiles = {
		returnVO: null,
		paramVO: null
	};

	if(functionInfo.returnType){
		const globPattern = `**\\${functionInfo.returnType}.java`; 
		const files = await vscode.workspace.findFiles(globPattern);
		voFiles.returnVO = files;
		
	}

	if(functionInfo.params[0]){
		const globPattern = `**\\${functionInfo.params[0]}.java`; 
		const files = await vscode.workspace.findFiles(globPattern);
		voFiles.paramVO = files;
	}

	return voFiles
}
function extractFunctionInfo(code) {

    // 정규 표현식 패턴
    const pattern = /(?:(?:static\s+)?(?:public|private|protected)?\s+)?(\w+(?:<.*?>)?)\s+(\w+)\s*\(\s*((?:\w+(?:<.*?>)?\s+\w+(?:\s*,\s*)?)*)\s*\)/;
  
    // 정규 표현식 실행
    const match = code.match(pattern);
  
    if (match) {
      // 매칭된 그룹 추출
      let [, returnType, functionName, parameterTypes] = match;
      console.log('파라미터즈',parameterTypes);
      // 파라미터 타입 처리
	  const params = parameterTypes ? parameterTypes.split(',').map(param => {
        // 제네릭 타입 추출
        const genericMatch = param.trim().match(/(\w+)\s*<([^>]*)>/);
        if (genericMatch && genericMatch[1] === 'List') { // List 타입인 경우에만 제네릭 타입 추출
          return genericMatch[2].trim(); // 제네릭 타입만 반환
        } else {
          return param.trim().split(/\s+/)[0]; // 일반 타입 반환
        }
      }) : [];

	  if(returnType.includes('List')){
		  returnType = returnType.split('<')[1].split('>')[0];
	  }
  

      return {
        functionName,
        returnType,
        params
      };
    }
  
    return null; // 매칭 실패 시 null 반환
  }

async function extractVoFields(voFiles){
 
	const regex = /^[ \t]*private [^;]+;/gm;
	const fields = {
		returnFieldsWithCamel: null,
		returnFieldsWithSnake: null,
		paramFieldsWithCamel: null,
		paramFieldsWithSnake: null
	};


	try{
		if(voFiles.returnVO){
			let uri = vscode.Uri.file(voFiles.returnVO[0].path);
			let data = await vscode.workspace.fs.readFile(uri);
			const text = new TextDecoder('utf-8').decode(data);
			let allFieldsWithCamelCase = text.match(regex).map(field => field.trim().split(' ')[2].replace(';',''))			;
			let allFieldsWithSnakeCase = allFieldsWithCamelCase.map(field => lodash.snakeCase(field));
			fields.paramFieldsWithCamel = allFieldsWithCamelCase;
			fields.paramFieldsWithSnake = allFieldsWithSnakeCase;

		}

		if(voFiles.paramVO){
			let uri = vscode.Uri.file(voFiles.paramVO[0].path);
			let data = await vscode.workspace.fs.readFile(uri);
			const text = new TextDecoder('utf-8').decode(data);
			let allFieldsWithCamelCase = text.match(regex).map(field => field.trim().split(' ')[2].replace(';',''))			;
			let allFieldsWithSnakeCase = allFieldsWithCamelCase.map(field => lodash.snakeCase(field));

			fields.returnFieldsWithCamel = allFieldsWithCamelCase;
			fields.returnFieldsWithSnake = allFieldsWithSnakeCase;
		}

		return fields
		
	}catch (error){
		throw error;
	}
}

//쿼리 생성
async function generateQuery(functionInfo, queryType, voFields, tableName){
	if(queryType == 'INSERT'){

		
		let query = `
			<insert id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]}">
				INSERT INTO ${tableName} (
${voFields.paramFieldsWithSnake.map(field => `\t\t\t\t\t${field}`).join(',\n')}
				)
				VALUES (
${voFields.paramFieldsWithCamel.map(field => `\t\t\t\t\t#\{${field}\}`).join(',\n')}
				)
			     
			</insert>`;
		return query;
	}

	if(queryType == 'SELECT'){
		
		if(functionInfo.functionName.includes("cnt") || functionInfo.functionName.includes("count")){
			let query=`
			<select id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]}" resultType="int">
				SELECT 
					count(*)
				  FROM ${tableName}
				 WHERE 1=1
			</select>`
		return query;
		}

		else{
			let query=`
			<select id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]}" resultType="${functionInfo.returnType}">
				SELECT 
${voFields.returnFieldsWithSnake.map(field => `\t\t\t\t\t${field}`).join(',\n')}
				  FROM ${tableName}
				 WHERE 1=1
			</select>`
		return query;
		}

	}

	if(queryType == 'UPDATE'){
		// 	${voFields.paramFieldsWithSnake.map(field => `${field}`)} = ${voFields.paramFieldsWithCamel.map(field => `#\{${field}\}`).join(',\n')}
		let fields = '';
		for(let i=0;i<voFields.paramFieldsWithCamel.length;i++){
			fields += `\t\t\t\t\t${voFields.paramFieldsWithSnake[i]} = #\{${voFields.paramFieldsWithCamel[i]}\},\n`;
		}
		let query=`
			<update id="${functionInfo.functionName}" parameterType="${functionInfo.params[0]}">
				UPDATE ${tableName}
				   SET 	
${fields}				
				 WHERE 1=1
			</update>`;
		return query;
	}

	if(queryType == 'DELETE'){
		let deleteField = voFields.paramFieldsWithCamel.find(field => field.includes('delYn') || field.includes('delete'));
		if(!deleteField){
			let id = voFields.paramFieldsWithCamel.find(field => field.includes('Id'));
			let idField = `${id} = #\{${lodash.snakeCase(id)}\}`;
			let query=`
			<delete id="${functionInfo.functionName}">
				DELETE FROM ${tableName}
				WHERE ${idField}
			</delete>`;
			return query;
		}

		// let fields = `${deleteField} = #\{${lodash.snakeCase(deleteField)}\}`;
		let query=`
			<delete id="${functionInfo.functionName}">
				UPDATE ${tableName}
				   SET ${deleteField} = 'Y'
				 WHERE 1=1
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

	const currentWorkspaceFolder = vscode.workspace.workspaceFolders[0];
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
async function insertQueryToXml(xmlFile, query){
	try{
		const document = await vscode.workspace.openTextDocument(vscode.Uri.file(xmlFile));
		const editor = await vscode.window.showTextDocument(document);

		// 마지막 줄의 끝 위치를 가져옵니다.
		const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
		const insertPosition = lastLine.range.end;

		// 쿼리 삽입
		editor.edit(editBuilder => {
		// 마지막 줄이 "</mapper>"인 경우 삭제
		if (lastLine.text.trim() === '</mapper>') {
			editBuilder.delete(lastLine.range);
		}
		// 쿼리 삽입
		editBuilder.insert(insertPosition, query);
		// "</mapper>" 추가
		editBuilder.insert(insertPosition, '\n</mapper>');
		});

		// 파일 저장
		await editor.document.save();
  } catch (error) {
    console.error('쿼리 삽입 중 오류 발생:', error);
    vscode.window.showErrorMessage('쿼리 삽입 중 오류 발생: ' + error.message);
  }
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
