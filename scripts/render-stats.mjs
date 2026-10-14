import {accounts} from '../stats/accounts.mjs';
import {snapshotText,validateSnapshot} from '../src/stats-model.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderStats(data,language='ru') {
  validateSnapshot(data);
  const en=language==='en',t=(ru,english)=>en?english:ru;
  const fields=snapshotText(data,language);
  const value=(key,tag='span',classes='')=>`<${tag} class="${classes}" data-stat="${key}">${esc(fields[key])}</${tag}>`;
  const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const metric=(key,label)=>`<div class="stat-total stat-total-${key}">${value(key,'strong','stat-number')}<span class="stat-label">${label}</span>${value(key+'-coverage','small')}</div>`;
  return `<section class="audience wrap section-space" id="numbers" aria-labelledby="numbers-title">
    <div class="audience-heading"><div><span class="eyebrow">${t('04 / ИСТОРИЯ В ЦИФРАХ','04 / THE STORY IN NUMBERS')}</span><h2 id="numbers-title">${t('Миры разные.<br><em>Мы — рядом.</em>','Different worlds.<br><em>Still connected.</em>')}</h2></div><div class="stats-stamp"><span class="stats-dot" aria-hidden="true"></span>${value('freshness')}<small>${value('checked')}</small></div></div>
    <div class="stats-overview">
      <div class="stats-overview-caption"><span>${t('СТОЛЬКО ВСЕГО НАС СВЯЗЫВАЕТ','SO MUCH CONNECTS US')}</span>${icon('star')}</div>
      <div class="stats-totals">
        ${metric('followers',t('подписок на площадках','subscriptions across platforms'))}
        ${metric('views',t('просмотров за всё время','all-time public views'))}
      </div>
      <div class="stats-growth"><span>${t('Прирост просмотров','View-count growth')}</span><div>${['week','year'].map((period,i)=>`<div class="stats-period"><span>${i?t('365 дней','365 days'):t('7 дней','7 days')}</span>${value(period+'-display','strong')}${value(period+'-coverage','small','sr-only')}</div>`).join('')}</div></div>
    </div>
    <details class="stats-breakdown"><summary><span>${t('Статистика по площадкам','Statistics by platform')}<small>${t('8 аккаунтов','8 accounts')}</small></span><span class="stats-breakdown-sign" aria-hidden="true">+</span></summary><div class="stats-breakdown-content">
    <div class="stats-channels-heading"><span class="eyebrow">${t('ВСЕ АККАУНТЫ','ALL ACCOUNTS')}</span><div><span>${t('Листай, чтобы узнать больше','Swipe to explore')}</span><button type="button" data-stats-step="-1" aria-label="${t('Предыдущие площадки','Previous accounts')}">←</button><button type="button" data-stats-step="1" aria-label="${t('Следующие площадки','Next accounts')}">→</button></div></div>
    <div class="stats-channels" tabindex="0" role="region" aria-label="${t('Публичная статистика по площадкам','Public statistics by account')}">
      ${accounts.map(account=>`<article class="stats-channel stats-channel-${account.platform}"><a href="${esc(account.url)}" target="_blank" rel="noopener noreferrer"><span class="channel-platform-icon">${icon(account.platform)}</span><span><strong>${en?account.en:account.label}</strong><small>${account.handle}</small></span>${icon('arrow')}</a><dl class="channel-numbers"><div><dt>${t('Подписки','Followers')}</dt><dd>${value(account.id+'-followers')}</dd></div><div><dt>${t('Просмотры · всего','Views · all time')}</dt><dd>${value(account.id+'-views')}</dd></div></dl><div class="channel-growth"><span>${t('Прирост просмотров','View-count growth')}</span><span>7${t('д','d')} ${value(account.id+'-week','strong')}</span><span>365${t('д','d')} ${value(account.id+'-year','strong')}</span></div>${value(account.id+'-date','small','channel-date')}</article>`).join('')}
    </div>
    <details class="stats-method"><summary>${t('О цифрах и источниках','About the numbers & sources')}<span aria-hidden="true">+</span></summary><div><p>${t('Только открытые страницы. Покрытие указано под каждой общей цифрой: недоступные счётчики не считаются нулём. Один человек может быть подписан в нескольких местах. Знак ≈ означает округление площадкой. Общие просмотры — сумма доступных счётчиков YouTube.','Public pages only. Coverage is shown under each total; unavailable counters are never treated as zero. One person may follow more than one account. The ≈ sign means a platform rounds its count. Total views sum the available YouTube counters.')}</p><p>${t('Прирост за 7 и 365 дней — разница публичных счётчиков на две даты, а не закрытый отчёт аналитики. Пока нет исходного снимка, накапливаем историю; в карточках стоит прочерк. Если счётчик уменьшился из-за удаления видео или пересчёта, прирост не показывается.','Growth over 7 and 365 days is the difference between two public counter snapshots, not a private analytics report. Until the baseline exists, we build history and show a dash in account cards. Growth is withheld when a counter decreases due to removals or corrections.')}</p><p>${t('При сбое остаётся последний успешный снимок с его датой. Данные старше двух дней исключаются из общей суммы. Музыкальные прослушивания и лайки не смешиваются с просмотрами.','If a source is unavailable, its last successful dated snapshot remains. Values older than two days are excluded from totals. Music streams and likes are not mixed with video views.')}</p></div></details>
    </div></details>
  </section>`;
}
