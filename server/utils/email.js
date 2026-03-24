const nodemailer = require('nodemailer');

const isEmailEnabled = () => process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';

const createTransport = () => {
  if (!isEmailEnabled()) {
    return null;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('Email notifications enabled but SMTP config is incomplete. Emails will be skipped.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const transporter = createTransport();

const sendMail = async ({ to, subject, html }) => {
  if (!isEmailEnabled()) {
    return { sent: false, reason: 'email-disabled' };
  }

  if (!transporter) {
    return { sent: false, reason: 'smtp-missing' };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    return { sent: false, reason: 'from-missing' };
  }

  try {
    await transporter.sendMail({ from, to, subject, html });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error.message || 'smtp-send-failed' };
  }
};

const sendQuickMatchEmail = async ({ user, tender, matchPercent }) => {
  const subject = `Quick Match Alert: ${tender.category} tender (${matchPercent}%)`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.4;color:#1f2937">
      <h2 style="margin:0 0 12px">New Tender Match for ${user.name}</h2>
      <p>A new opportunity crossed your alert threshold.</p>
      <ul>
        <li><strong>Title:</strong> ${tender.title}</li>
        <li><strong>Entity:</strong> ${tender.procuringEntity}</li>
        <li><strong>Category:</strong> ${tender.category}</li>
        <li><strong>District:</strong> ${tender.district}</li>
        <li><strong>Deadline:</strong> ${tender.deadlineRaw || 'Check dashboard'}</li>
        <li><strong>Match Score:</strong> ${matchPercent}%</li>
      </ul>
      <p>Open your Avasar Patra dashboard to track and prepare the checklist.</p>
    </div>
  `;

  return sendMail({ to: user.email, subject, html });
};

const sendDigestEmail = async ({ user, items = [] }) => {
  const digestItems = items.slice(0, 12);
  const subject = `Daily Tender Digest: ${digestItems.length} prioritized opportunities`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.45;color:#1f2937">
      <h2 style="margin:0 0 10px">Daily Match Digest for ${user.name}</h2>
      <p style="margin:0 0 14px">Here are your top tenders based on match quality, urgency, and data confidence.</p>
      <ol style="padding-left:18px;margin:0">
        ${digestItems
          .map(
            (item) => `
          <li style="margin-bottom:10px">
            <strong>${item.title}</strong><br/>
            <span>Score: ${item.alertScore}% (${item.alertLevel}) | Match: ${item.matchPercent}%</span><br/>
            <span>Entity: ${item.procuringEntity} | Deadline: ${item.deadlineRaw || 'Check dashboard'}</span>
          </li>`
          )
          .join('')}
      </ol>
      <p style="margin-top:14px">Open your Avasar Patra dashboard to shortlist and assign tasks.</p>
    </div>
  `;

  return sendMail({ to: user.email, subject, html });
};

module.exports = {
  sendMail,
  sendQuickMatchEmail,
  sendDigestEmail,
  isEmailEnabled,
};
