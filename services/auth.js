const db = require('./db');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validator = require('./validator');
const nodeMailer = require('nodemailer');

function createPairOfTokens(id, username){//Создает пару токенов (авторизации/обновления)
    const aToken = jwt.sign(//Access token
        { tokenType: 'a',
          username: username,
          id: id },
          process.env.TOKEN_KEY,
        {
          expiresIn: "30m",
        }
    );
    const rToken = jwt.sign(//Refresh token
        { tokenType: 'r',
          username: username,
          id: id },
          process.env.TOKEN_KEY,
        {
          expiresIn: "30d",
        }
    );
    const aTokenExp = Date.now() + 30 * 60 * 1000;
    const rTokenExp = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return [aToken, rToken, aTokenExp, rTokenExp];
}
async function verifyToken(token){//Верифицирует токен
    let response = {message: 'Ошибка верификации токена авторизации', status: 400, id: null};
    if (!token) {
        response = {message: 'Для аутентификации необходим токен', status: 404, id: null};
    }
    else {
        try {
            const decoded = jwt.verify(token, process.env.TOKEN_KEY);
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
            const activationCode = Math.floor(Math.random() * 1000000);
            const activationCodeHash = await bcrypt.hash(String(activationCode), 10);
            let query = validatedUserData.reserveContactVal && validatedUserData.reserveContactType ? 
                `INSERT INTO users (email, username, pass, mainContactVal, mainContactType, reserveContactVal, reserveContactType, status, activationCode) 
                VALUES ('${email}','${username}','${passHash}','${mainContactVal}','${mainContactType}',
                '${validatedUserData.reserveContactVal}','${validatedUserData.reserveContactType}', '1', '${activationCodeHash}')`:
                `INSERT INTO users (email, username, pass, mainContactVal, mainContactType, status, activationCode) 
                VALUES ('${email}','${username}','${passHash}','${mainContactVal}','${mainContactType}', '1', '${activationCodeHash}')`;
            const result = await db.query(query);
            const userIdRequest = await db.query(`SELECT id, username FROM users WHERE email = '${email}'`);
            if (userIdRequest.length > 0 && result.affectedRows) {
                /*
                const [aToken, rToken, aTokenExp, rTokenExp] = createPairOfTokens(userIdRequest[0].id, userIdRequest[0].username);
                await db.query(`UPDATE users SET token = '${rToken}' WHERE id = ${userIdRequest[0].id}`);
                response = {message: 'Ползователь зарегистрирован успешно.', status: 200, 
                    tokens: {accessToken: {token: aToken, expires: aTokenExp},  refreshToken: {token: rToken, expires: rTokenExp}}, 
                    username: userIdRequest[0].username, userid: userIdRequest[0].id};
                */
                await sendActivationEmail(email, `${activationCode}`);
                response = {message: 'Ползователь зарегистрирован успешно.', status: 200,  
                    username: userIdRequest[0].username, userid: userIdRequest[0].id, email: email};
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
                    /* userFromDB.status - статус аккаунта. Возможные значения:
                        0 - default
                        1 - зарегистрирован, не подтвержден
                        2 - активен
                        3 - заблокирован
                    */
                    if (userFromDB.status === 1){
                        response = {message: 'Аккаунт не активирован', status: 410, username: null, userid: null, tokens: null};
                    }
                    else if (userFromDB.status === 2){
                        const [aToken, rToken, aTokenExp, rTokenExp] = createPairOfTokens(uID, userData[0].username);
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
                    else if (userFromDB.status === 3){
                        response = {message: 'Аккаунт заблокирован', status: 413, username: null, userid: null, tokens: null};
                    }
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
            const decoded = jwt.verify(user.token, process.env.TOKEN_KEY);
            if (decoded.tokenType === 'a'){
                let status = await db.query(`SELECT status FROM users WHERE id = ${decoded.id}`);
                if (status.length){
                    if (status[0].status === 2){
                        response = {message: 'Аутентификация выполнена успешно', status: 200, username: decoded.username, userid: decoded.id};
                    };
                    /*
                    if (status[0].status === 1){
                        response = {message: 'Ошибка аутентификации: аккаунт не активирован!', status: 410, username: decoded.username, userid: decoded.id};
                    }
                    else if (status[0].status === 2){
                        response = {message: 'Аутентификация выполнена успешно', status: 200, username: decoded.username, userid: decoded.id};
                    }
                    else if (status[0].status === 3){
                        response = {message: 'Ошибка аутентификации: аккаунт заблокирован!', status: 413, username: decoded.username, userid: decoded.id};
                    }
                    */
                }
                else response = {message: 'Ошибка аутентификации: аккаунт не найден!', status: 414, username: null, userid: null};
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
            const decoded = jwt.verify(props.token, process.env.TOKEN_KEY);
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
              email: author[0].email,
              adsCounter: author[0].adsCounter
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
/* Генерирует новый код активации и оптправляет на почту пользователя */
async function refreshActivationCode(email){
    const activationCode = Math.floor(Math.random() * 1000000);
    const activationCodeHash = await bcrypt.hash(String(activationCode), 10);
    const result = await db.query(`UPDATE users SET activationCode = '${activationCodeHash}' WHERE email = '${email}'`);
    if (result.affectedRows){
        await sendActivationEmail(email, `${activationCode}`);
    };
}
/* Активирует аккаунт пользователя */
async function activateAccount(data){
    let result = {message: 'Ошибка активации аккаунта!', status: 400};
    let validatedEmail = validator.validateData('email', {email: data.email});
    let validatedCode = validator.validateData('code', {code: data.code});
    if (validatedEmail && validatedCode){
        const userData = await db.query(
            `SELECT * FROM users WHERE email = '${validatedEmail.email}' AND status = 1`
        );
        if (userData.length){
            const userFromDB = userData[0];
            if (await bcrypt.compare(validatedCode.code, userFromDB.activationCode)){
                const queryResult = await db.query(`UPDATE users SET status = 2 WHERE email = '${validatedEmail.email}'`);
                if (queryResult.affectedRows){
                    result = {message: 'Аккаунт активирован успешно', status: 200};
                };
            }
            else {
                result = {message: 'Ошибка активации аакаунта: неверный код!', status: 403};
                await refreshActivationCode(validatedEmail.email);
            };
        } 
        else result = {message: 'Ошибка активации аакаунта: пользователь не найден!', status: 404};
    }
    return result;
}
/* Отправляет письмо с кодом активации */
async function sendActivationEmail(to, code){
    let transporter = nodeMailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    });
    let mailOptions = {
        from: '"Dollarhub"', // sender address
        to: 'litehost.manager@yandex.ru', // list of receivers
        subject: 'Завершение регистрации.', // Subject line
        text: `Почти готово!
            Регистрация вашего аккаунта почти завершена. Просто укажите код активации, и можно начинать пользоваться сервисом.
            Код активации: ${code}
            Или перейдите по ссылке:https://dollarhub.me/confirm?email=${to}&code=${code}
            Спасибо, что выбрали Dollarhub!`, // plain text body
        html: `<!doctype html>
                <html lang="ru">
                    <body style="background-color: #444640;
                    color: #ffffff;
                    letter-spacing: 0.03rem;
                    padding: 1rem;
                    ">
                        <h1 style="text-align: center; margin-top: 1rem; color: #ffffff;">Почти готово!</h1>
                        <p style="margin: 1rem; font-size: 1.2em; color: #ffffff;">
                            Регистрация вашего аккаунта почти завершена. Просто укажите код активации, и можно начинать пользоваться сервисом.
                        </p>
                        <p style="margin: 1rem; font-size: 1.2em; color: #ffffff;">
                            Код активации: <span style="background-color: rgba(101,167,48,1);
                            padding: .25rem .5rem;
                            letter-spacing: 0.1em;
                            border-radius: 5%;">${code}</span>
                        </p>
                        <p style="margin: 1rem; font-size: 1.2em; color: #ffffff;">
                            Или перейдите по ссылке: <a href="https://dollarhub.me/confirm?email=${to}&code=${code}" style="position: relative;
                            color: rgb(183, 226, 74);
                            text-decoration: none;">завершить регистрацию</a>
                        </p>
                        <p style="margin: 1rem; font-size: 1.2em; margin-bottom: 2rem; color: #ffffff;">
                            Спасибо, что выбрали Dollarhub!
                        </p>
                    </body>
                </html>` // html body
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        }
    });
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
    editAuthPass,
    activateAccount
}