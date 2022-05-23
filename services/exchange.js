const db = require('./db');
const helper = require('../helper');
const config = require('../config');
const auth = require('./auth');
const validator = require('./validator');

//Возвращает список предложений, отсортированных по дате/курсу
async function getMultiple(page = 1, sortby){
  const offset = helper.getOffset(page, config.listPerPage);
  let adsQuantity = await db.query(
    "SELECT COUNT(*) FROM ads"
  );
  adsQuantity = adsQuantity ? adsQuantity[0]['COUNT(*)']: 0;
  let queryParams = "date DESC";
  if (sortby === "currency") queryParams = "exchangeRate ASC";
  const query = `SELECT * FROM ads ORDER BY ${queryParams} LIMIT ${offset},${config.listPerPage}`;
  const rows = await db.query(query);
  const data = helper.emptyOrRows(rows);
  const meta = {page: page, total: adsQuantity};

  return {
    data,
    meta
  }
}
//Возвращает конкретное объявление по ID
async function getByID(props){
  let result = {message: 'Ошибка поиска по ID', status: 400, data: null};
  let verifiedData = validator.validateData('id', {id: props.id});
  if (verifiedData){
    const queryResult = await db.query(`SELECT * FROM ads WHERE id = ${verifiedData.id}`);
    if (queryResult.length){
      result = {message: 'Поиск по ID выполнен успешно', status: 200, data: queryResult[0]};
    }
    else result = {message: 'Ошибка поиска по ID: объявление не найдено!', status: 404, data: null};
  }
  return result;
}
//Возвращает все объявления конкретного автора
async function getMultipleByID(props){
  let result = {message: 'Ошибка поиска всех объявлений автора', status: 400, data: null};
  let verifiedData = validator.validateData('id', {id: props.id});
  if (verifiedData){
    const queryResult = await db.query(`SELECT * FROM ads WHERE author = ${verifiedData.id} ORDER BY date DESC`);
    if (queryResult.length){
      result = {message: 'Поиск выполнен успешно', status: 200, data: queryResult};
    }
    else result = {message: 'Ошибка поиска всех объявлений автора: объявления не найдены!', status: 404, data: null};
  }
  return result;
}
//Возвращает список объявлений, удовлетворяющих определенным критериям
async function getByParams(props){
  let result = {message: 'Ошибка поиска по параметрам', status: 400, data: null};
  let verifiedData = validator.validateData('searchParams', {currency: props.currency, amount: props.amount, 
    location: props.location});
  if (verifiedData){
    const offset = helper.getOffset(props.page, config.listPerPage);
    let sortParams = "date DESC";
    if (props.sortby === "currency") sortParams = "exchangeRate ASC";
    let curParams = JSON.parse(verifiedData.currency);
    let curParamsString = '';
    for(i = 0, f = false; i < curParams.length; i++){
      if (curParams[i]) {
        if (!f) {
          curParamsString = ` WHERE (currency = ${i}`;
          f = true;
        }
        else curParamsString += ` OR currency = ${i}`;
      }
    };
    if (verifiedData.amount) curParamsString = curParamsString.length ? `${curParamsString}) AND (amountMin <= ${verifiedData.amount} AND amountMax >= ${verifiedData.amount})`:
      `WHERE (amountMin <= ${verifiedData.amount} AND amountMax >= ${verifiedData.amount})`;
    if (verifiedData.location.length) curParamsString = curParamsString.length ? `${curParamsString} AND (location LIKE '%${verifiedData.location}%')`:
    `WHERE location LIKE '${verifiedData.location}'`;
    let query = curParamsString.length ? `SELECT * FROM ads ${curParamsString} ORDER BY ${sortParams} LIMIT ${offset},${config.listPerPage}`: `SELECT * FROM ads ORDER BY ${sortParams} LIMIT ${offset},${config.listPerPage}`;
    let countQuery = curParamsString.length ? `SELECT COUNT(*) FROM ads ${curParamsString}`: 'SELECT COUNT(*) FROM ads';
    let adsQuantity = await db.query(countQuery);
    adsQuantity = adsQuantity ? adsQuantity[0]['COUNT(*)']: 0;
    const queryResult = await db.query(query);
    if (queryResult.length){
      const meta = {page: props.page, total: adsQuantity};
      result = {message: 'Поиск по параметрам выполнен успешно', status: 200, data: queryResult, meta: meta};
    }
    else result = {message: 'Поиск по параметрам не дал результатов', status: 404, data: null};
  };
  return result;
}
//Создает новое объявление
async function create(exchangeOffer){
  let result = {message: 'Ошибка создания объявления!', status: 400};
  let verifiedData = validator.validateData('ad', {currency: exchangeOffer.currency, amountMin: exchangeOffer.amountMin, 
    amountMax: exchangeOffer.amountMax, exchangeRate: exchangeOffer.exchangeRate, location: exchangeOffer.location});
  const securityCheck = await auth.verifyToken(exchangeOffer.token);
  if (securityCheck.status === 200 && verifiedData){
    if ((verifiedData.amountMin <= verifiedData.amountMax) && (verifiedData.exchangeRate > 0)){
      const authorQueryResult = await db.query(`SELECT adsCounter FROM users WHERE id = ${securityCheck.id}`);
      if (authorQueryResult.length){
        if (authorQueryResult[0].adsCounter < config.adsLimit){
          const queryResult = await db.query(
            `INSERT INTO ads (currency, amountMin, amountMax, exchangeRate, location, author) 
            VALUES 
            (${verifiedData.currency}, ${verifiedData.amountMin}, ${verifiedData.amountMax}, ${verifiedData.exchangeRate},
              '${verifiedData.location}', ${securityCheck.id})`
          );
          if (queryResult.affectedRows) {
            await db.query(`UPDATE users SET adsCounter = ${authorQueryResult[0].adsCounter + 1} WHERE id = ${securityCheck.id}`);
            result = {message: 'Объявление создано успешно.', status: 200};
          };
        }
        else result = {message: `Максимум ${config.adsLimit} объявления!`, status: 405};
      }
    };
  }
  else result = {message: 'Недостаточно прав для создания объявления!', status: 403};
  return result;
}
//Обновляет существующее объявление
async function update(exchangeOffer){
  let result = {message: 'Ошибка редактирования объявления!', status: 400};
  const verifiedData = validator.validateData('ad', {currency: exchangeOffer.currency, amountMin: exchangeOffer.amountMin, 
    amountMax: exchangeOffer.amountMax, exchangeRate: exchangeOffer.exchangeRate, location: exchangeOffer.location, id: exchangeOffer.id});
  const securityCheck = await auth.verifyToken(exchangeOffer.token);
  if (securityCheck.status === 200 && verifiedData){
    if ((verifiedData.amountMin <= verifiedData.amountMax) && (verifiedData.exchangeRate > 0)){
      let currentAd = await db.query(`SELECT author FROM ads WHERE id = ${verifiedData.id}`);
      if (currentAd.length ){
        if (securityCheck.id === currentAd[0].author){
          const queryResult = await db.query(
            `UPDATE ads 
            SET currency=${verifiedData.currency}, amountMin=${verifiedData.amountMin}, amountMax=${verifiedData.amountMax}, 
            exchangeRate=${verifiedData.exchangeRate}, location='${verifiedData.location}' 
            WHERE id=${verifiedData.id}`
          );
          if (queryResult.affectedRows) {
            result = {message: 'Объявление отредактировано успешно.', status: 200};
          };
        }
        else result = {message: 'Недостаточно прав для редактирования объявления!', status: 403};
      }
      else result = {message: 'Объявление не найдено!', status: 403};
    };
  }
  return result;
}
//Удаляет объявление
async function remove(id, authorId, exchangeOffer){
  console.log(`Ads id: ${id}`);
  console.log(`Auth id: ${authorId}`);
  let result = {message: 'Ошибка удаления объявления!', status: 400};
  const verifiedID = validator.validateData('id', {id: id});
  const verifiedAuthorId = validator.validateData('id', {id: authorId});
  const securityCheck = await auth.verifyToken(exchangeOffer.token);
  if (securityCheck.status === 200 && verifiedID && verifiedAuthorId){
    const authorQueryResult = await db.query(`SELECT adsCounter FROM users WHERE id = ${securityCheck.id}`);
    const queryResult = await db.query(
      `DELETE FROM ads WHERE id = ${verifiedID.id}`
    );
    if (queryResult.affectedRows) {
      if (authorQueryResult[0].adsCounter > 0) await db.query(`UPDATE users SET adsCounter = ${authorQueryResult[0].adsCounter - 1} WHERE id = ${securityCheck.id}`);
      result = {message: 'Объявление удалено успешно.', status: 200};
    }
    else result = {message: 'Недостаточно прав для удаления объявления!', status: 403};
  }
  else result = {message: 'Объявление не найдено!', status: 404};
  /*
  const verifiedData = validator.validateData('id', {id: id});
  const securityCheck = await auth.verifyToken(exchangeOffer.token);
  if (securityCheck.status === 200 && verifiedData){
    let currentAd = await db.query(`SELECT author FROM ads WHERE id = ${verifiedData.id}`);
    if (currentAd.length){
      if (securityCheck.id === currentAd[0].author){
        const authorQueryResult = await db.query(`SELECT adsCounter FROM users WHERE id = ${securityCheck.id}`);
        const queryResult = await db.query(
          `DELETE FROM ads WHERE id = ${verifiedData.id}`
        );
        if (queryResult.affectedRows) {
          if (authorQueryResult[0].adsCounter > 0) await db.query(`UPDATE users SET adsCounter = ${authorQueryResult[0].adsCounter - 1} WHERE id = ${securityCheck.id}`);
          result = {message: 'Объявление удалено успешно.', status: 200};
        }
      }
      else result = {message: 'Недостаточно прав для удаления объявления!', status: 403};
    }
    else result = {message: 'Объявление не найдено!', status: 404};
  }
  */
  return result;
}

module.exports = {
  getMultiple,
  getByID,
  getMultipleByID,
  getByParams,
  create,
  update,
  remove
}