const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';

function getLineChannelConfig() {
  const channelId = (process.env.LINE_CHANNEL_ID || process.env.LINE_CLIENT_ID || '').trim();
  const channelSecret = (
    process.env.LINE_CHANNEL_SECRET ||
    process.env.LINE_CLIENT_SECRET ||
    ''
  ).trim();

  if (!channelId || !channelSecret) {
    const err = new Error('LINE channel is not configured');
    err.status = 500;
    throw err;
  }

  return { channelId, channelSecret };
}

export async function exchangeLineCodeForAccessToken({
  code,
  redirectUri,
  codeVerifier,
} = {}) {
  if (!code || !redirectUri || !codeVerifier) {
    const err = new Error('Missing LINE authorization parameters');
    err.status = 400;
    throw err;
  }

  const { channelId, channelSecret } = getLineChannelConfig();
  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
      code_verifier: codeVerifier,
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    const err = new Error(
      body?.error_description || body?.error || 'Unable to exchange LINE access token'
    );
    err.status = 401;
    throw err;
  }

  return body.access_token;
}

export async function verifyLineAccessToken(accessToken) {
  const url = new URL(LINE_VERIFY_URL);
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error('Invalid LINE access token');
    err.status = 401;
    throw err;
  }

  return res.json();
}

export async function fetchLineProfile(accessToken) {
  const res = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = new Error('Invalid LINE access token');
    err.status = 401;
    throw err;
  }

  const data = await res.json();
  return {
    lineUserId: data.userId,
    displayName: data.displayName || '',
    avatarUrl: data.pictureUrl || '',
  };
}

export async function getVerifiedLineProfile(accessToken) {
  await verifyLineAccessToken(accessToken);
  return fetchLineProfile(accessToken);
}
