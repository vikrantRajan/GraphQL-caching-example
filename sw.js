const QUERY_CACHE_KEY = 'CACHE_V_0';
const GRAPHQL_URL = 'https://example.com/graphql';


self.addEventListener('fetch', e => {
  if (isGraphql(e.request)) {
    handleGraphQL(e);
  }
});

export function hash(x) {
  let h, i, l;
  for (h = 5381 | 0, i = 0, l = x.length | 0; i < l; i++) {
    h = (h << 5) + h + x.charCodeAt(i);
  }

  return h >>> 0;
}

const isGraphql = request => {
  return request.url.startsWith(GRAPHQL_URL);
};

function handleGraphQL(e) {
  const exclude = [/query GetCart/, /mutation/, /query Identity/];
  const generateQueryId = e.request
    .clone()
    .json()
    .then(({ query, variables }) => {
      // skip mutation caching...
      if (exclude.some(r => r.test(query))) {
        return null;
      }

      // Mocks a request since `caches` only works with requests.
      return `https://query_${hash(JSON.stringify({ query, variables }))}`;
    });

  const networkResponse = fromNetwork(e.request);

  e.respondWith(
    (async () => {
      // get the request body.
      const queryId = await generateQueryId;
      const cachedResult = queryId && (await fromCache(queryId));
      if (cachedResult) {
        return cachedResult;
      }

      return networkResponse.then(res => res.clone());
    })()
  );

  e.waitUntil(
    (async () => {
      try {
        const res = await networkResponse.then(res => res.clone());
        const queryId = await generateQueryId;
        if (queryId) {
          await saveToCache(queryId, res);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(err);
      }
    })()
  );
}

async function fromCache(request) {
  const cache = await caches.open(QUERY_CACHE_KEY);
  const matching = await cache.match(request);

  return matching;
}

function fromNetwork(request) {
  return fetch(request);
}

async function saveToCache(request, response) {
  const cache = await caches.open(QUERY_CACHE_KEY);
  await cache.put(request, response);
}
