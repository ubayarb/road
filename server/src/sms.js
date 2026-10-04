// Twilio Programmable Messaging over plain HTTPS (no SDK dependency).
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM.
// SMS_DEFAULT_COUNTRY_CODE (default +976) is prefixed to numbers stored without a country code.

const TWILIO_TIMEOUT_MS = 10000;

function assertTwilioConfig(env = process.env) {
  const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'].filter((key) => !env[key]);
  if (!env.TWILIO_MESSAGING_SERVICE_SID && !env.TWILIO_FROM) missing.push('TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM');
  if (missing.length) throw new Error(`OTP_MODE=twilio requires ${missing.join(', ')}.`);
}

// Phones are stored as entered digits (e.g. 99112233); Twilio needs E.164 (+97699112233).
function toE164(phone, countryCode = process.env.SMS_DEFAULT_COUNTRY_CODE || '+976') {
  return phone.startsWith('+') ? phone : `${countryCode}${phone}`;
}

async function sendSms(to, body, env = process.env) {
  const params = new URLSearchParams({ To: to, Body: body });
  if (env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  else params.set('From', env.TWILIO_FROM);

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(`Twilio ${response.status}: ${data.code || ''} ${data.message || 'request failed'}`.trim());
    error.twilioCode = data.code;
    throw error;
  }
  return response.json();
}

module.exports = { assertTwilioConfig, sendSms, toE164 };
