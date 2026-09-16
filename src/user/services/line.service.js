const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

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
