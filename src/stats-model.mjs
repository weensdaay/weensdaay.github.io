export const accountIds = ['youtube-science','tiktok-science','instagram-life','youtube-life','tiktok-life','telegram','youtube-archive','youtube-music'];
export const DAY = 86400000;
export const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e13;
export const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && new Date(value).toISOString() === value;
const only = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => keys.includes(key));
const metric = item => item === null || (only(item,['value','approximate','observedAt']) && count(item.value) && typeof item.approximate === 'boolean' && timestamp(item.observedAt));
const growth = item => only(item,['value','status','from','to']) && ['available','collecting','unavailable','adjusted'].includes(item.status) && (item.status === 'available' ? count(item.value) && timestamp(item.from) && timestamp(item.to) : item.value === null);

// Fail closed: numbers and known IDs only; never accept HTML, URLs or new accounts.
export function validateSnapshot(data) {
  if (!only(data,['version','checkedAt','accounts']) || data.version !== 1 || !timestamp(data.checkedAt) || !Array.isArray(data.accounts) || data.accounts.length !== accountIds.length) throw Error('Invalid statistics snapshot');
  const ids = new Set();
  for (const item of data.accounts) {
    if (!only(item,['id','status','followers','views','week','year']) || !accountIds.includes(item.id) || ids.has(item.id) || !['ok','unavailable'].includes(item.status) || !metric(item.followers) || !metric(item.views) || !growth(item.week) || !growth(item.year)) throw Error('Invalid account statistics');
    ids.add(item.id);
    for (const key of ['followers','views']) if (item[key] && item[key].observedAt > data.checkedAt) throw Error('Future observation');
    for (const [key,days] of [['week',7],['year',365]]) if(item[key].status==='available' && (item[key].to>data.checkedAt || new Date(Date.parse(item[key].to)-days*DAY).toISOString().slice(0,10)!==item[key].from.slice(0,10))) throw Error('Invalid comparison period');
  }
  return data;
}

export function summary(data, field, now = Date.now()) {
  const available = data.accounts.map(item => item[field]).filter(item => item && item.value !== null && now - Date.parse(item.observedAt || item.to) <= DAY * 2);
  return {value:available.length ? available.reduce((sum,item)=>sum+item.value,0) : null, coverage:available.length, approximate:available.some(item=>item.approximate)};
}

export function formatCount(value, approximate = false, language = 'ru', compact = true) {
  if (value === null) return '—';
  const number = new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ru-RU', compact && value >= 10000 ? {notation:'compact',maximumSignificantDigits:3} : {}).format(value);
  return `${approximate ? '≈ ' : ''}${number}`;
}

export function snapshotText(data, language = 'ru', now = Date.now()) {
  const en = language === 'en';
  const t = (ru,english) => en ? english : ru;
  const date = value => new Intl.DateTimeFormat(en?'en-GB':'ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(value));
  const fields = {};
  for (const field of ['followers','views','week','year']) {
    const metric = summary(data,field,now);
    fields[field] = formatCount(metric.value,metric.approximate,language);
    fields[`${field}-coverage`] = metric.coverage ? t(`По ${metric.coverage} из ${accountIds.length} аккаунтов`,`Across ${metric.coverage} of ${accountIds.length} accounts`) : t('Пока недостаточно данных','Not enough public data yet');
    if (['week','year'].includes(field) && !metric.coverage && data.accounts.some(item=>item[field].status === 'collecting')) fields[`${field}-coverage`] = t('Накапливается история','Building a daily history');
    if (['week','year'].includes(field)) {
      const collecting = data.accounts.some(item => item[field].status === 'collecting' && item.views && now-Date.parse(item.views.observedAt)<=DAY*2);
      fields[`${field}-display`] = metric.coverage ? '+'+fields[field] : collecting ? t('Копим историю','Building history') : t('Нет данных','Unavailable');
    }
  }
  fields.checked = t('Проверено ','Checked ') + date(data.checkedAt);
  fields.freshness = now-Date.parse(data.checkedAt)>DAY*2 ? t('Снимок устарел · ждём обновления','Older snapshot · awaiting an update') : t('Открытые данные · ежедневная проверка','Public data · checked daily');
  for (const account of data.accounts) {
    for (const key of ['followers','views']) {
      fields[`${account.id}-${key}`] = account[key] ? formatCount(account[key].value,account[key].approximate,language) : '—';
    }
    const measurements = [account.followers,account.views].filter(Boolean);
    const oldest = measurements.map(item=>item.observedAt).sort()[0];
    fields[`${account.id}-date`] = oldest ? t('Данные на ','As of ') + date(oldest) + (now-Date.parse(oldest)>DAY*2 ? t(' · устарели',' · older snapshot') : '') : t('Открытый счётчик недоступен','Public counter unavailable');
    for (const field of ['week','year']) fields[`${account.id}-${field}`] = account[field].value === null || now-Date.parse(account[field].to)>DAY*2 ? '—' : '+'+formatCount(account[field].value,false,language);
  }
  return fields;
}
