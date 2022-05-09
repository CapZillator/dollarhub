const db = require('./db');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require('dotenv').config({path: './.env'});
const validator = require('./validator');

function createPairOfTokens(id, username){
    const aToken = jwt.sign(//Access token
        { tokenType: 'a',
          username: username,
          id: id },
        dotenv.parsed.TOKEN_KEY,
        {
          expiresIn: "30m",
        }
    );
    const rToken = jwt.sign(//Refresh token
        { tokenType: 'r',
          username: username,
          id: id },
        dotenv.parsed.TOKEN_KEY,
        {
          expiresIn: "30d",
        }
    );
    const aTokenExp = Date.now() + 30 * 60 * 1000;
    const rTokenExp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return [aToken, rToken, aTokenExp, rTokenExp];
}
async function verifyToken(token){
    let response = {message: 'Ошибка верификации токена авторизации', status: 400, id: null};
    if (!token) {
        response = {message: 'Для аутентификации необходим токен', status: 404, id: null};
    }
    else {
        try {
            const decoded = jwt.verify(token, dotenv.parsed.TOKEN_KEY);
            if (decoded.tokenType === 'a') response = {message: 'Аутентификация прошла успешно', status: 200, id: decoded.id};
        } catch (err) {
            response = {message: 'Недействительный токен', status: 401, id: null};
        };
    };
    return response;
}
async function checkLogin(user){//Проверяет на уникальность логин
    let response = {message: 'Ошибка валидации логина!', status: 400};
    let validatedUserData = validator.validateData('login', {login: user.login});
    if (validatedUserData){
        const queryResult = await db.query(`SELECT username FROM users WHERE username = '${validatedUserData.login}'`);
        response = queryResult.length > 0 ? {message: 'Такой логин уже зарегистрирован!', status: 403}: {message: 'Логин валиден!', status: 200};
    }
    return response;
}

async function checkEmail(user){//Проверяет на уникальность email
    let response = {message: 'Ошибка валидации email!', status: 400};
    let validatedUserData = validator.validateData('email', {email: user.email});
    if (validatedUserData){
        const queryResult = await db.query(`SELECT email FROM users WHERE email = '${validatedUserData.email}'`);
        response = queryResult.length > 0 ? {message: 'Такой email уже зарегистрирован!', status: 403} : {message: 'Email валиден!', status: 200};
    }
    return response;
}

async function checkUser(user){//Проверяет на уникальность логин/email
    const {email, username } = user;
    const queryResult = await db.query(`SELECT email, username FROM users WHERE email = '${email}' || username = '${username}'`);
    const result = queryResult.length > 0 ? false : true;
    return result;
}
async function registerUser(user){//Регистрирует нового пользователя
    let response = {message: 'Ошибка создания учетной записи!', status: 400, tokens: {accessToken: null, refreshToken: null}, username: null, userid: null};
    let validatedUserData = validator.validateData('user', {email: user.email, username: user.username, pass: user.pass,
        mainContactVal: user.mainContactVal, mainContactType: user.mainContactType, reserveContactVal: user.reserveContactVal, 
        reserveContactType: user.reserveContactType});
    if (validatedUserData) {
        if (await checkUser(validatedUserData)){
            let {email, username, pass, mainContactVal, mainContactType} = validatedUserData;
            let passHash = await bcrypt.hash(pass, 10);
            let query = validatedUserData.reserveContactVal && validatedUserData.reserveContactType ? 
                `INSERT INTO users (email, username, pass, mainContactVal, mainContactType, reserveContactVal, reserveContactType) 
                VALUES ('${email}','${username}','${passHash}','${mainContactVal}','${mainContactType}',
                '${validatedUserData.reserveContactVal}','${validatedUserData.reserveContactType}')`:
                `INSERT INTO users (email, username, pass, mainContactVal, mainContactType) 
                VALUES ('${email}','${username}','${passHash}','${mainContactVal}','${mainContactType}')`;
            const result = await db.query(query);
            const userIdRequest = await db.query(`SELECT id, username FROM users WHERE email = '${email}'`);
            if (userIdRequest.length > 0 && result.affectedRows) {
                const [aToken, rToken, aTokenExp, rTokenExp] = createPairOfTokens(userIdRequest[0].id, userIdRequest[0].username);
                await db.query(`UPDATE users SET token = '${rToken}' WHERE id = ${userIdRequest[0].id}`);
                response = {message: 'Ползователь зарегистрирован успешно.', status: 200, 
                    tokens: {accessToken: {token: aToken, expires: aTokenExp},  refreshToken: {token: rToken, expires: rTokenExp}}, 
                    username: userIdRequest[0].username, userid: userIdRequest[0].id};
            }
        }
        else response = {message: 'Такой пользователь уже существует!', status: 400, tokens: {accessToken: null, refreshToken: null}, username: null, userid: null};
    }
    else {
        response = {message: 'Ошибка валидации!', status: 400, tokens: {accessToken: null, refreshToken: null}, username: null, userid: null};
    }
    return response;
}

async function siginUser(user){//Авторизация по паролю
    let response = {message: 'Ошибка авторизации', status: 400, username: null, userid: null, tokens: null};
    const { email, pass } = user;
    try{
        let validatedUserData = validator.validateData('email', {email: email});
        if (validatedUserData){
            const userData = await db.query(
                `SELECT * FROM users WHERE email = '${email}'`
            );
            if (userData.length > 0){
                const userFromDB = userData[0];
                const uID = userData[0].id;
                if (userFromDB && (await bcrypt.compare(pass, userFromDB.pass))){
                    const [aToken, rToken, aTokenExp, rTokenExp] = createPairOfTokens(uID,  userData[0].username);
                    const result = await db.query(`UPDATE users SET token = '${rToken}' WHERE email = '${email}'`);
                    if (result.affectedRows) response = {
                        message: 'Авторизация прошла успешно', 
                        status: 200, 
                        username: userData[0].username,
                        userid: uID,
                        tokens: 
                            {accessToken: {token: aToken, expires: aTokenExp},  
                            refreshToken: {token: rToken, expires: rTokenExp}}};
                    else response = {message: 'Ошибка обращения к БД', status: 400, username: null, userid: null, tokens: null};
                }
                else response = {message: 'Ошибка авторизации: пароль указан неверно', status: 403, username: null, userid: null, tokens: null};
            }
            else response = {message: 'Ошибка авторизации: пользователь не найден', status: 404, username: null, userid: null, tokens: null};
        }
        else response = {message: 'Ошибка авторизации: формат email не верный', status: 403, username: null, userid: null, tokens: null};
    }
    catch (err){
        response = {message: `Ошибка авторизации: ${err.message}`, status: 400, username: null, userid: null, tokens: null};
    }
    return response;
}
async function signinTokenUser(user){//Авторизация через токен
    let response = {message: 'Ошибка авторизации', status: 400, username: null, userid: null};
    if (!user.token) {
        response = {message: 'Для аутентификации необходим токен!', status: 404, username: null, userid: null,};
    }
    else {
        try {
            const decoded = jwt.verify(user.token, dotenv.parsed.TOKEN_KEY);
            if (decoded.tokenType === 'a'){
                response = {message: 'Аутентификация выполнена успешно', status: 200, username: decoded.username, userid: decoded.id};
            }
            else response = {message: 'Неверный тип токена!', status: 403, tokens: null, username: null, userid: null};
        } catch (err) {
            if (err.name === 'TokenExpiredError') response = {message: 'Срок действия авторизационного токена истёк!', status: 301, username: null, userid: null};
            else response = {message: `Ошибка верификации токена: ${err.message}`, status: 403, username: null, userid: null};
        };
    };
    return response;
}

async function refreshTokens(props){//Обновляет токены, если их срок жизни истек
    let response = {message: 'Ошибка генерации токенов', status: 400, username: null, userid: null, tokens: null};
    if (!props.token) {
        response = {message: 'Для создания новой пары токенов необходим токен обновления', status: 404, username: null, userid: null, tokens: null};
    }
    else { 
        try {
            const decoded = jwt.verify(props.token, dotenv.parsed.TOKEN_KEY);
            const uID = decoded.id;
            if (decoded.tokenType === 'r'){
                const tokenRequest = await db.query(`SELECT username, token FROM users WHERE id = '${uID}'`);
                if (tokenRequest.length > 0) {
                    if (tokenRequest[0].token === props.token){
                        const [aToken, rToken, aTokenExp, rTokenExp] = createPairOfTokens(uID, tokenRequest[0].username);
                        const result = await db.query(`UPDATE users SET token = '${rToken}' WHERE id = ${uID}`);
                        if (result.affectedRows) response = {message: 'Новые токены сгенерированы успешно', status: 201, username: tokenRequest[0].username,
                            userid: uID,
                            tokens: {
                                accessToken: {token: aToken, expires: aTokenExp},  
                                refreshToken: {token: rToken, expires: rTokenExp}
                        }}
                        else response = {message: 'Ошибка записи токена в БД', status: 404, username: null, userid: null, tokens: null};
                    }
                    else response = {message: 'Ошибка аутентификации токена: токен клиента и токен из БД не совпадают!', status: 404, username: null, userid: null, tokens: null};
                }
                else response = {message: 'Ошибка БД: токен не найден', status: 404, username: null, userid: null, tokens: null};
            }
            else response = {message: 'Неверный тип токена!', status: 403, username: null, userid: null, tokens: null};
        } catch (err) {
            if (err.name === 'TokenExpiredError') response = {message: 'Срок действия токена обновления истёк!', status: 301, username: null, userid: null, tokens: null};
            else response = {message: `Ошибка верификации токена обновления: ${err.message}`, status: 403, username: null, userid: null, tokens: null};
        };
    };
    return response;
}

async function getAuthorData(data){//Возвращает данные автора объявления по ID
    let result = {message: 'Ошибка получения данных автора!', status: 400, data: null};
    const verifiedData = validator.validateData('id', {id: data.id});
    if (verifiedData){
      let author = await db.query(`SELECT * FROM users WHERE id = ${verifiedData.id}`);
      if (author.length){
        result = {message: 'Данные автора получены успешно.', status: 200, 
          data: {
              username: author[0].username,
              mainContactType: author[0].mainContactType,
              mainContactVal: author[0].mainContactVal,
              email: author[0].email
            }};
      }
      else result = {message: 'Данные автора не найдены!', status: 404, data: null};
    }
    return result;
}

async function getAllAuthors(){//Возвращает список всех авторов
    let result = {message: 'Ошибка получения списка авторов!', status: 400, data: null};
    let authors = await db.query(`SELECT * FROM users`);
    if (authors && authors.length){
        result = {message: 'Список авторов получен успешно.', status: 200, data: authors};
    }
    else result = {message: 'Список авторов пуст!', status: 404, data: null};
    return result;
}

async function editAuthMessanger(data){//Редактирует способ связи с пользователем (мессенджер)
    let result = {message: 'Ошибка редактирования персональных данных!', status: 400};
    const verifiedData = validator.validateData('messanger', {mainContactVal: data.mainContactVal, mainContactType: data.mainContactType});
    const securityCheck = await verifyToken(data.token);
    if (securityCheck.status === 200 && verifiedData){
        let author = await db.query(`SELECT id FROM users WHERE id = ${securityCheck.id}`);
        if (author.length){
            if (securityCheck.id === author[0].id){
                const queryResult = await db.query(
                    `UPDATE users SET mainContactVal='${verifiedData.mainContactVal}', mainContactType=${verifiedData.mainContactType} WHERE id=${securityCheck.id}`
                );
                if (queryResult.affectedRows){
                    result = {message: 'Данные пользователя отредактированы успешно.', status: 200};
                };
            }
            else result = {message: 'Недостаточно прав для редактирования!', status: 403};
        }
        else result = {message: 'Ошибка редактирования пользователя: пользователь не найден!', status: 404};
    }
    else result = {message: 'Ошибка верификации пользователя!', status: 403};
    return result;
}

async function editAuthPass(data){//Редактирует пароль пользователя
    let result = {message: 'Ошибка редактирования персональных данных!', status: 400};
    const verifiedId = validator.validateData('id', {id: data.id});
    const verifiedPass = validator.validateData('pass', {pass: data.pass});
    const verifiedNewPass = validator.validateData('pass', {pass: data.newPass});
    if (verifiedPass && verifiedId){
        const userData = await db.query(
            `SELECT * FROM users WHERE id = ${verifiedId.id}`
        );
        if (userData.length){
            const userFromDB = userData[0];
            if (await bcrypt.compare(verifiedPass.pass, userFromDB.pass)){
                let passHash = await bcrypt.hash(verifiedNewPass.pass, 10);
                const queryResult = await db.query(`UPDATE users SET pass = '${passHash}' WHERE id = ${verifiedId.id}`);
                if (queryResult.affectedRows){
                    result = {message: 'Пароль изменен успешно', status: 200};
                };
            }
            else result = {message: 'Ошибка редактирования пароля: доступ запрещен!', status: 403};
        } 
        else result = {message: 'Ошибка редактирования пароля: пользователь не найден!', status: 404};
    }
    else result = {message: 'Ошибка редактирования пароля: пароль не прошел верификацию!', status: 400};
    return result;
}

module.exports = {
    checkEmail,
    checkLogin,
    registerUser,
    checkUser,
    siginUser,
    signinTokenUser,
    refreshTokens,
    verifyToken,
    getAuthorData,
    getAllAuthors,
    editAuthMessanger,
    editAuthPass
}