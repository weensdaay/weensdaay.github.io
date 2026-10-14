import {accounts} from '../stats/accounts.mjs';
import {snapshotText,validateSnapshot} from '../src/stats-model.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderStats(data,language='ru') {
  validateSnapshot(data);
  const en=language==='en',t=(ru,english)=>en?english:ru;
  const fields=snapshotText(data,language);
  const value=(key,tag='span',classes='')=>`<${tag} class="${classes}" data-stat="${key}">${esc(fields[key])}</${tag}>`;
  const metric=(key,label,detail)=>`<div class="stat-total stat-total-${key}">${value(key,'strong','stat-number')}<span class="stat-label">${label}</span>${value(key+'-coverage','small')}<p>${detail}</p></div>`;
  return `<section class="audience wrap section-space" id="numbers" aria-labelledby="numbers-title">
    <div class="audience-heading"><div><span class="eyebrow">${t('04 / ИСТОРИЯ В ЦИФРАХ','04 / THE STORY IN NUMBERS')}</span><h2 id="numbers-title">${t('Миры разные.<br><em>Мы — рядом.</em>','Different worlds.<br><em>Still connected.</em>')}</h2></div><div class="stats-stamp"><span class="stats-dot" aria-hidden="true"></span>${value('freshness')}<small>${value('checked')}</small></div></div>
    <div class="stats-totals">
      ${metric('followers',t('подписок на площадках','subscriptions across platforms'),t('Один человек может быть подписан в нескольких местах.','One person may follow more than one account.'))}
      ${metric('views',t('просмотров за всё время','all-time public views'),t('Сумма доступных счётчиков YouTube.','Sum of available YouTube view counters.'))}
      ${metric('week',t('прирост просмотров · 7 дней','view-count growth · 7 days'),t('По ежедневным публичным снимкам.','From daily public snapshots.'))}
      ${metric('year',t('прирост просмотров · 365 дней','view-count growth · 365 days'),t('По ежедневным публичным снимкам.','From daily public snapshots.'))}
    </div>
    <div class="stats-channels-heading"><span class="eyebrow">${t('КАЖДЫЙ МИР — БЛИЖЕ','A CLOSER LOOK AT EACH WORLD')}</span><div><span>${t('Листай площадки','Explore the accounts')}</span><button type="button" data-stats-step="-1" aria-label="${t('Предыдущие площадки','Previous accounts')}">←</button><button type="button" data-stats-step="1" aria-label="${t('Следующие площадки','Next accounts')}">→</button></div></div>
    <div class="stats-channels" tabindex="0" role="region" aria-label="${t('Публичная статистика по площадкам','Public statistics by account')}">
      ${accounts.map(account=>`<article class="stats-channel"><a href="${esc(account.url)}" target="_blank" rel="noopener noreferrer"><svg class="icon" aria-hidden="true"><use href="#i-${account.platform}"/></svg><span><strong>${en?account.en:account.label}</strong><small>${account.handle}</small></span><span aria-hidden="true">↗</span></a><div class="channel-main-number">${value(account.id+'-followers','strong')}<span>${t('подписчиков','followers')}</span></div><dl><div><dt>${t('Просмотры · всего','Views · all time')}</dt><dd>${value(account.id+'-views')}</dd></div><div><dt>${t('Прирост · 7 дней','Growth · 7 days')}</dt><dd>${value(account.id+'-week')}</dd></div><div><dt>${t('Прирост · 365 дней','Growth · 365 days')}</dt><dd>${value(account.id+'-year')}</dd></div></dl>${value(account.id+'-date','small','channel-date')}</article>`).join('')}
    </div>
    <details class="stats-method"><summary>${t('Откуда эти цифры?','Where do these numbers come from?')}<span aria-hidden="true">+</span></summary><div><p>${t('Только открытые страницы. Покрытие указано под каждой общей цифрой: недоступные счётчики не считаются нулём. Знак ≈ означает, что площадка округляет число подписчиков.','Public pages only. Coverage is shown under every total; unavailable counters are never treated as zero. The ≈ sign means a platform rounds its follower count.')}</p><p>${t('Прирост за 7 и 365 дней — разница публичных счётчиков на две даты, а не закрытый отчёт аналитики. Пока нет исходного снимка, стоит прочерк. Если счётчик уменьшился из-за удаления видео или пересчёта, прирост не показывается.','Growth over 7 and 365 days is the difference between two public counter snapshots, not a private analytics report. A dash appears until the baseline exists. Growth is withheld when a counter decreases due to removals or corrections.')}</p><p>${t('При сбое остаётся последний успешный снимок с его датой. Данные старше двух дней исключаются из общей суммы. Музыкальные прослушивания и лайки не смешиваются с просмотрами.','If a source is unavailable, its last successful dated snapshot remains. Values older than two days are excluded from totals. Music streams and likes are not mixed with video views.')}</p></div></details>
  </section>`;
}
