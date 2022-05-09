const db = require('./db');

async function getList(){//Возвращает список городов из БД
    let result = {message: "Ошибка получения списка городов", status: 400, list: null};
    const query = await db.query(`SELECT * FROM cities`);
    if (query.length) result = {message: "Список городов успешно получен", status: 200, list: query};
    else result = {message: "Список городов пуст", status: 404, list: null};
    return result;
}
module.exports = {
    getList
}