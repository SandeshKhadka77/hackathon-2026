const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Tender = require('../models/Tender');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { extractDistrict } = require('./districts');
const { calculateMatchPercent } = require('./matching');
const { sendQuickMatchEmail, sendDigestEmail } = require('./email');
const {
  calculateAlertScore,
  calculateUrgencyScore,
  getAlertLevel,
  getDaysToDeadline,
} = require('./scoring');

const TARGET_URL = 'https://www.bolpatra.gov.np/egp/searchOpportunity';
const MAX_PAGES = 5;

function buildSourceFingerprint(item) {
  const key = `${item.tenderId}|${item.title}|${item.procuringEntity}|${item.deadline || ''}`;
  return crypto.createHash('sha1').update(key).digest('hex');
}

function calculateParseConfidence(item) {
  let score = 30;
  if (item.tenderId) score += 25;
  if (item.title) score += 20;
  if (item.deadlineAt) score += 10;
  if (item.procuringEntity && item.procuringEntity !== 'N/A') score += 10;
  if (item.district && item.district !== 'Unknown') score += 5;
  return Math.max(0, Math.min(100, score));
}

function mapCategoryFromTitle(title = '') {
  const normalized = title.toLowerCase();

  if (/construction|road|bridge|civil|building|rehabilitation|blacktop|paving|drainage|earthwork/.test(normalized)) {
    return 'Works';
  }

  if (/consult(ing|ancy)?|advisory|feasibility|survey|design|supervision|audit|training/.test(normalized)) {
    return 'Consulting';
  }

  if (/supply|procurement|goods|equipment|material|furniture|vehicle|medicine|hardware|tool|printing|stationery/.test(normalized)) {
    return 'Goods';
  }

  return 'Other';
}

function parseDeadline(value = '') {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, dd, mm, yyyy, hh, min] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

async function waitForTableData(page) {
  await page.waitForFunction(() => {
    const table = document.querySelector('#opportunityTable') || document.querySelector('#searchBidResult #dashBoardBidResult');
    return !!table;
  }, { timeout: 60000 });

  await page.waitForFunction(() => {
    const table = document.querySelector('#opportunityTable') || document.querySelector('#searchBidResult #dashBoardBidResult');
    if (!table) return false;
    return table.querySelectorAll('tbody tr').length > 0;
  }, { timeout: 60000 });
}

async function extractCurrentPageRows(page) {
  const rows = await page.evaluate(() => {
    const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const parseMoney = (value) => {
      const raw = normalizeText(value);
      if (!raw) return 0;
      const numeric = raw.replace(/[^\d.]/g, '');
      const parsed = Number(numeric);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const classifyLink = (href = '', label = '') => {
      const joined = `${href} ${label}`.toLowerCase();
      if (joined.includes('.pdf') || /pdf|download/.test(joined)) return 'pdf';
      if (/detail|notice|view/.test(joined)) return 'detail';
      return 'other';
    };

    const toAbsoluteUrl = (href = '') => {
      if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
        return '';
      }

      try {
        return new URL(href, window.location.origin).toString();
      } catch (error) {
        return '';
      }
    };
    const table = document.querySelector('#opportunityTable') || document.querySelector('#searchBidResult #dashBoardBidResult');

    if (!table) return [];

    const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
      normalizeText(th.innerText).toLowerCase()
    );

    const bodyRows = Array.from(table.querySelectorAll('tbody tr')).filter((tr) => {
      const rowText = normalizeText(tr.innerText).toLowerCase();
      const isVisible = tr.offsetParent !== null;
      return isVisible && rowText && !rowText.includes('no data') && !rowText.includes('no records');
    });

    if (bodyRows.length === 0) return [];

    const findIndex = (patterns, fallbackIndex) => {
      const idx = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
      return idx >= 0 ? idx : fallbackIndex;
    };

    const tenderIdIndex = findIndex([/\bifb\b/, /\brfp\b/, /\beoi\b/, /\bpq\b/, /reference/, /ref\./], 1);
    const titleIndex = findIndex([/project\s*title/, /\btitle\b/, /name/, /description/, /opportunity/, /project/], 2);
    const procuringEntityIndex = findIndex([/public\s*entity/, /procuring/, /office/, /entity/], 3);
    const locationIndex = findIndex([/location/, /district/, /province/], 4);
    const deadlineIndex = findIndex([/last\s*date.*submission/, /deadline/, /closing/, /submission/, /end\s*date/, /last\s*date/], 7);
    const amountIndex = findIndex([/amount/, /estimate/, /cost/, /budget/, /value/, /price/], -1);

    return bodyRows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll('td')).map((td) => normalizeText(td.innerText));
        if (cells.length < 4) return null;

        const tenderId = cells[tenderIdIndex] || cells[0] || '';
        const title = cells[titleIndex] || cells[1] || '';
        const procuringEntity = cells[procuringEntityIndex] || 'N/A';
        const location = cells[locationIndex] || procuringEntity || 'N/A';
        const deadline = cells[deadlineIndex] || 'N/A';
        const amount = amountIndex >= 0 ? parseMoney(cells[amountIndex] || '') : 0;

        const links = Array.from(row.querySelectorAll('a[href]'))
          .map((anchor) => {
            const href = toAbsoluteUrl(anchor.getAttribute('href') || '');
            if (!href) return null;
            const label = normalizeText(anchor.textContent || anchor.getAttribute('title') || 'Open notice');
            return {
              label,
              url: href,
              type: classifyLink(href, label),
            };
          })
          .filter(Boolean);

        const noticeUrl = links.find((item) => item.type === 'pdf')?.url || '';
        const detailUrl =
          links.find((item) => item.type === 'detail')?.url ||
          links.find((item) => item.type === 'other')?.url ||
          '';

        return {
          tenderId,
          title,
          procuringEntity,
          sourceType: 'ppmo',
          organizationName: procuringEntity,
          location,
          deadline,
          amount,
          detailUrl,
          noticeUrl,
          documentLinks: links,
          sourceUrl: window.location.href,
        };
      })
      .filter((item) => item && item.tenderId && item.title);
  });

  return rows.map((item) => ({
    ...item,
    category: mapCategoryFromTitle(item.title),
    district: extractDistrict(`${item.location} ${item.procuringEntity}`),
    deadlineAt: parseDeadline(item.deadline),
    amount: Number(item.amount || 0),
  }));
}

async function clickNextPage(page, previousFirstRowKey, previousPageDisplay) {
  const nextMeta = await page.evaluate(() => {
    const candidates = [
      '#pager img.next',
      '#pager .next',
      'img.next',
      'a[aria-label="Next"]',
      'a[aria-label*="next" i]',
      'button[aria-label="Next"]',
      'button[aria-label*="next" i]',
      'a[title="Next"]',
      'a[title*="next" i]',
      'button[title="Next"]',
      'button[title*="next" i]',
      'li.next a',
      'a.next',
      '[id$="_next"] a',
      '[id$="_next"] button',
      '[id$="_next"]',
      '.paginate_button.next',
      '.dataTables_paginate .next',
      '.pagination .next a',
      '.p-paginator-next',
    ];

    let nextElement = null;

    for (const selector of candidates) {
      const found = document.querySelector(selector);
      if (found) {
        nextElement = found;
        break;
      }
    }

    if (!nextElement) {
      const allButtons = Array.from(document.querySelectorAll('a, button, img'));
      nextElement = allButtons.find((el) => {
        const text = (el.textContent || '').trim();
        const classes = (el.className || '').toString();
        const alt = el.getAttribute('alt') || '';
        const title = el.getAttribute('title') || '';
        return /^(next|>|»|›)$|next/i.test(`${text} ${classes} ${alt} ${title}`);
      });
    }

    if (!nextElement) {
      const active = document.querySelector(
        '.pagination .active, .pagination .current, .paginate_button.current, .paginate_button.active, .p-paginator-page.p-highlight'
      );

      const nextLi = active?.nextElementSibling;
      const siblingCandidate =
        nextLi?.matches('a, button, img') ? nextLi : nextLi?.querySelector('a, button, img');

      if (siblingCandidate) {
        nextElement = siblingCandidate;
      }
    }

    if (!nextElement) {
      return { found: false, disabled: true };
    }

    const className = (nextElement.className || '').toString().toLowerCase();
    const ariaDisabled = (nextElement.getAttribute('aria-disabled') || '').toLowerCase() === 'true';
    const hasDisabledClass = className.includes('disabled');
    const disabledProp = Boolean(nextElement.disabled);
    const styleOpacity = Number.parseFloat(nextElement.style?.opacity || '1');
    const stylePointerEvents = (nextElement.style?.pointerEvents || '').toLowerCase();

    const disabled =
      ariaDisabled ||
      hasDisabledClass ||
      disabledProp ||
      stylePointerEvents === 'none' ||
      (!Number.isNaN(styleOpacity) && styleOpacity <= 0.2);

    if (!disabled) {
      nextElement.click();
    }

    return { found: true, disabled };
  });

  if (!nextMeta.found || nextMeta.disabled) {
    return false;
  }

  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.waitForFunction(
        (oldKey, oldDisplay) => {
          const displayValue = (document.querySelector('#pager .pagedisplay')?.value || '').trim();
          const table = document.querySelector('#opportunityTable') || document.querySelector('#searchBidResult #dashBoardBidResult');
          const first = table?.querySelector('tbody tr td');
          const currentKey = (first?.innerText || '').replace(/\s+/g, ' ').trim();
          const tableChanged = currentKey && currentKey !== oldKey;
          const pagerChanged = displayValue && oldDisplay && displayValue !== oldDisplay;
          return tableChanged || pagerChanged;
        },
        { timeout: 20000 },
        previousFirstRowKey,
        previousPageDisplay
      ),
    ]);
  } catch (error) {
    // Continue even when explicit wait strategy times out; table wait below will retry.
  }

  await waitForTableData(page);
  return true;
}

const scrapePPMO = async () => {
  console.log('Starting scraper...');
  const scrapeRunId = `run-${Date.now()}`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const allTenders = [];

  try {
    await page.goto(TARGET_URL, {
      waitUntil: 'networkidle2',
      timeout: 90000,
    });

    await waitForTableData(page);

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
      let firstRowKey = '';
      let pageDisplay = '';

      try {
        await waitForTableData(page);

        pageDisplay = await page.evaluate(() => {
          return (document.querySelector('#pager .pagedisplay')?.value || '').trim();
        });

        firstRowKey = await page.evaluate(() => {
          const table = document.querySelector('#opportunityTable') || document.querySelector('#searchBidResult #dashBoardBidResult');
          const first = table?.querySelector('tbody tr td');
          return (first?.innerText || '').replace(/\s+/g, ' ').trim();
        });

        const pageRows = await extractCurrentPageRows(page);

        const withMeta = pageRows.map((item, index) => ({
          ...item,
          scrapeRunId,
          sourcePage: pageNo,
          sourcePosition: index + 1,
          sourceFingerprint: buildSourceFingerprint(item),
          parseConfidence: calculateParseConfidence(item),
        }));

        allTenders.push(...withMeta);

        console.log(`Page ${pageNo}: scraped ${withMeta.length} tenders.`);
      } catch (error) {
        console.error(`Page ${pageNo}: failed to scrape.`, error.message || error);
      }

      if (pageNo < MAX_PAGES) {
        try {
          const hasNextPage = await clickNextPage(page, firstRowKey, pageDisplay);
          if (!hasNextPage) {
            console.warn(`Pagination stopped at page ${pageNo}; no enabled Next button found.`);
            break;
          }
        } catch (error) {
          console.error(`Page ${pageNo}: failed to move to next page.`, error.message || error);
        }
      }
    }

        const dedupedById = Array.from(
          allTenders.reduce((acc, item) => {
            acc.set(item.tenderId.trim(), item);
            return acc;
          }, new Map()).values()
        );

        const outputPath = path.join(__dirname, '..', 'tenders_raw.json');
        fs.writeFileSync(outputPath, JSON.stringify(dedupedById, null, 2), 'utf-8');
        console.log(`Saved ${dedupedById.length} tenders to ${outputPath}`);

        return {
          scrapeRunId,
          items: dedupedById,
        };
  } catch (error) {
    console.error('Scraper failed:', error.message || error);
    const outputPath = path.join(__dirname, '..', 'tenders_raw.json');
    fs.writeFileSync(outputPath, JSON.stringify(allTenders, null, 2), 'utf-8');
    return {
      scrapeRunId,
      items: allTenders,
    };
  } finally {
    await browser.close();
  }
};

const upsertTenders = async (items = [], scrapeRunId = '') => {
  let createdCount = 0;
  let qualitySum = 0;

  for (const item of items) {
    const existing = await Tender.findOne({ tenderId: item.tenderId }).select('_id');

    const payload = {
      tenderId: item.tenderId,
      title: item.title,
      procuringEntity: item.procuringEntity,
      location: item.location,
      district: item.district,
      category: item.category,
      amount: item.amount || 0,
      deadlineRaw: item.deadline,
      deadlineAt: item.deadlineAt,
      detailUrl: item.detailUrl || '',
      noticeUrl: item.noticeUrl || '',
      documentLinks: Array.isArray(item.documentLinks) ? item.documentLinks : [],
      sourceUrl: item.sourceUrl,
      sourceFingerprint: item.sourceFingerprint || '',
      scrapeRunId: item.scrapeRunId || scrapeRunId,
      parseConfidence: item.parseConfidence || calculateParseConfidence(item),
      sourcePage: item.sourcePage || 1,
      sourcePosition: item.sourcePosition || 1,
      lastSeenAt: new Date(),
      scrapedAt: new Date(),
      isActive: true,
    };

    await Tender.updateOne({ tenderId: item.tenderId }, { $set: payload }, { upsert: true });

    if (!existing) {
      createdCount += 1;
    }

    qualitySum += payload.parseConfidence || 0;
  }

  if (scrapeRunId) {
    await Tender.updateMany(
      {
        isActive: true,
        scrapeRunId: { $ne: scrapeRunId },
        lastSeenAt: { $lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      { $set: { isActive: false } }
    );
  }

  return {
    createdCount,
    totalProcessed: items.length,
    avgParseConfidence: items.length ? Math.round(qualitySum / items.length) : 0,
  };
};

const createNotificationsForNewTenders = async () => {
  const users = await User.find().select('_id name email district category capacity notificationPreferences');
  const recentTenders = await Tender.find({
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    isActive: true,
  });

  let created = 0;
  let emailed = 0;
  let throttled = 0;

  for (const user of users) {
    const prefs = user.notificationPreferences || {};
    if (!prefs.inAppEnabled && !prefs.emailEnabled) {
      continue;
    }

    const minimumMatchPercent = Number(prefs.minimumMatchPercent || 60);
    const maxAlertsPerRun = Math.max(1, Math.min(30, Number(prefs.maxAlertsPerRun || 8)));

    const scored = recentTenders
      .map((tender) => {
        const matchPercent = calculateMatchPercent(tender, user);
        if (matchPercent < minimumMatchPercent) {
          return null;
        }

        const alertScore = calculateAlertScore({
          matchPercent,
          deadlineAt: tender.deadlineAt,
          parseConfidence: tender.parseConfidence,
        });

        return {
          tender,
          matchPercent,
          alertScore,
          alertLevel: getAlertLevel(alertScore),
          urgencyScore: calculateUrgencyScore(tender.deadlineAt),
          daysToDeadline: getDaysToDeadline(tender.deadlineAt),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.alertScore - a.alertScore || b.matchPercent - a.matchPercent);

    throttled += Math.max(0, scored.length - maxAlertsPerRun);
    const shortlisted = scored.slice(0, maxAlertsPerRun);

    for (const item of shortlisted) {
      try {
        const notification = await Notification.create({
          user: user._id,
          tender: item.tender._id,
          title: `${item.alertLevel.toUpperCase()} match: ${item.tender.category} tender`,
          reason: `Match ${item.matchPercent}% | Alert score ${item.alertScore}% | Deadline in ${item.daysToDeadline ?? 'N/A'} day(s).`,
          type: 'match',
          channels: [
            ...(prefs.inAppEnabled !== false ? ['in_app'] : []),
            ...(prefs.emailEnabled ? ['email'] : []),
          ],
          emailStatus: prefs.emailEnabled ? 'pending' : 'skipped',
          metadata: {
            matchPercent: item.matchPercent,
            alertScore: item.alertScore,
            alertLevel: item.alertLevel,
            urgencyScore: item.urgencyScore,
            daysToDeadline: item.daysToDeadline,
            threshold: minimumMatchPercent,
          },
        });

        const canSendQuickEmail = prefs.emailEnabled && prefs.quickMatchAlerts !== false && item.alertScore >= 50;

        if (canSendQuickEmail) {
          const emailResult = await sendQuickMatchEmail({
            user,
            tender: item.tender,
            matchPercent: item.matchPercent,
          });
          notification.emailStatus = emailResult.sent ? 'sent' : 'failed';
          notification.emailedAt = emailResult.sent ? new Date() : null;
          notification.metadata = {
            ...(notification.metadata || {}),
            emailReason: emailResult.reason || null,
          };
          await notification.save();

          if (emailResult.sent) {
            emailed += 1;
          }
        }

        created += 1;
      } catch (error) {
        // Skip duplicates due to unique user+tender constraint.
      }
    }
  }

  return { created, emailed, throttled };
};

const sendDailyDigests = async ({ force = false } = {}) => {
  const users = await User.find({
    'notificationPreferences.emailEnabled': true,
    'notificationPreferences.digestEnabled': true,
  }).select('_id name email notificationPreferences notificationLastCheckedAt');

  const now = new Date();
  const currentHour = now.getHours();
  let attempted = 0;
  let sent = 0;

  for (const user of users) {
    const prefs = user.notificationPreferences || {};
    const digestHour = Math.max(0, Math.min(23, Number(prefs.digestHour ?? 8)));
    const lastChecked = user.notificationLastCheckedAt ? new Date(user.notificationLastCheckedAt).getTime() : 0;
    const hoursSinceCheck = (Date.now() - lastChecked) / (1000 * 60 * 60);

    if (!force) {
      if (currentHour < digestHour) {
        continue;
      }

      if (hoursSinceCheck < 20) {
        continue;
      }
    }

    const recentNotifications = await Notification.find({
      user: user._id,
      type: 'match',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(40)
      .populate('tender');

    const digestItems = recentNotifications
      .map((item) => ({
        title: item.tender?.title || item.title,
        procuringEntity: item.tender?.procuringEntity || 'N/A',
        deadlineRaw: item.tender?.deadlineRaw || '',
        matchPercent: Number(item.metadata?.matchPercent || 0),
        alertScore: Number(item.metadata?.alertScore || 0),
        alertLevel: item.metadata?.alertLevel || 'low',
      }))
      .sort((a, b) => b.alertScore - a.alertScore || b.matchPercent - a.matchPercent)
      .slice(0, 12);

    if (!digestItems.length) {
      user.notificationLastCheckedAt = now;
      await user.save();
      continue;
    }

    attempted += 1;
    const result = await sendDigestEmail({ user, items: digestItems });
    if (result.sent) {
      sent += 1;
    }

    user.notificationLastCheckedAt = now;
    await user.save();
  }

  return {
    consideredUsers: users.length,
    attempted,
    sent,
  };
};

const runScraperAndUpsert = async () => {
  const { scrapeRunId, items } = await scrapePPMO();
  const { createdCount, totalProcessed, avgParseConfidence } = await upsertTenders(items, scrapeRunId);
  const notificationResult = await createNotificationsForNewTenders();
  const digestResult = await sendDailyDigests();

  return {
    scrapeRunId,
    totalScraped: items.length,
    totalProcessed,
    createdCount,
    avgParseConfidence,
    notificationCount: notificationResult.created,
    emailedCount: notificationResult.emailed,
    throttledAlerts: notificationResult.throttled,
    digestAttempted: digestResult.attempted,
    digestSent: digestResult.sent,
  };
};

module.exports = {
  scrapePPMO,
  runScraperAndUpsert,
  sendDailyDigests,
  mapCategoryFromTitle,
};