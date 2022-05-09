const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
/* Маршруты для работы с пользователями */
/* Регистрация нового пользователя */
router.post("/register", async (req, res, next) => {
    try {
        res.json(await auth.registerUser(req.body));
    } catch (err) {
        console.error(`Ошибка регистрации пользователя`, err.message);
        next(err);
    }
});
/* Авторизация пользователя по паролю */
router.post("/login", async (req, res, next) => {
    try {
        res.json(await auth.siginUser(req.body));
    } catch (err) {
        console.error(`Ошибка авторизации`, err.message);
        next(err);
    }
});
/* Авторизация пользователя по токену */
router.post("/loginwithtoken", async (req, res, next) => {
    try {
        res.json(await auth.signinTokenUser(req.body));
    } catch (err) {
        console.error(`Ошибка авторизации по токену`, err.message);
        next(err);
    }
});
/* Обновить токен(ы) */
router.post("/refreshtokens", async (req, res, next) => {
    try {
        res.json(await auth.refreshTokens(req.body));
    } catch (err) {
        console.error(`Ошибка обновления токенов`, err.message);
        next(err);
    }
});
/* Проверить, свободен ли логин */
router.post("/checklogin", async (req, res, next) => {
    try {
        res.json(await auth.checkLogin(req.body));
    } catch (err) {
        console.error(`Ошибка проверки логина`, err.message);
        next(err);
    }
});
/* Проверить, свободен ли email */
router.post("/checkemail", async (req, res, next) => {
    try {
        res.json(await auth.checkEmail(req.body));
    } catch (err) {
        console.error(`Ошибка проверки email`, err.message);
        next(err);
    }
});
/*
router.post("/welcome", async (req, res, next) => {
    try {
        const token = req.body.token || req.query.token || req.headers["x-access-token"];
        res.json(await auth.verifyToken(token));
    } catch (err) {
        console.error(`Error while checking user token`, err.message);
        next(err);
    }
});
*/
// Возвращает данные автора объявления
router.post('/getauthor', async function(req, res, next) {
    try {
      res.json(await auth.getAuthorData(req.body));
    } catch (err) {
      console.error(`Ошибка получения данных автора по ID`, err.message);
      next(err);
    }
});
// Возвращает массив с контактными данными авторов объявлений
router.get('/getallauthors', async function(req, res, next) {
    try {
        res.json(await auth.getAllAuthors());
    } catch (err) {
        console.error(`Ошибка получения списка авторов`, err.message);
        next(err);
    }
});
// Редактировать данные мессенджера
router.post('/editmessanger', async function(req, res, next) {
    try {
      res.json(await auth.editAuthMessanger(req.body));
    } catch (err) {
      console.error(`Ошибка редактирования данных пользователя`, err.message);
      next(err);
    }
});
// Редактировать пароль пользователя
router.post('/edituserpass', async function(req, res, next) {
    try {
      res.json(await auth.editAuthPass(req.body));
    } catch (err) {
      console.error(`Ошибка редактирования данных пользователя`, err.message);
      next(err);
    }
});

module.exports = router;