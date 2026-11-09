/// <reference lib="webworker" />
/**
 * Service worker do app instalável.
 *
 * O sistema guarda dado de saúde (dado pessoal sensível, LGPD): nenhuma resposta de API, de autenticação,
 * de upload ou de página com dado pessoal é guardada aqui. Só entram em cache os arquivos do build
 * (precache com hash) e os modelos do MediaPipe (versionados por pasta). Tudo o que não casa com uma rota
 * abaixo nem passa pelo service worker: vai direto para a rede.
 */
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

const NAVIGATION_TIMEOUT_MS = 3500;
const APP_SHELL = "/index.html";
const OFFLINE_PAGE = "/offline.html";

/** Caminhos do mesmo domínio que nunca podem ser servidos pelo app shell nem guardados. */
const NEVER_HANDLE = [/^\/api(\/|$)/, /^\/auth\/callback/, /^\/uploads?\//, /^\/storage\//, /^\/sw\.js$/, /\/[^/?]+\.[a-z0-9]{2,5}$/i];

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

/**
 * Navegação: rede primeiro. Rede lenta (passou do teto) → app shell do precache, que não tem dado pessoal.
 * Sem rede nenhuma → /offline.html. O app shell não é servido quando a rede caiu de vez porque o
 * login do app descarta o token quando não consegue falar com a API, e isso deslogaria o usuário.
 */
registerRoute(
  new NavigationRoute(
    async ({ request, event }) => {
      const network = fetch(request);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), NAVIGATION_TIMEOUT_MS);
      });
      try {
        const first = await Promise.race([network, timeout]);
        if (first !== "timeout") return first;
        const shell = await matchPrecache(APP_SHELL);
        if (shell) {
          (event as FetchEvent).waitUntil(network.then(() => undefined, () => undefined));
          return shell;
        }
        return await network;
      } catch {
        return (await matchPrecache(OFFLINE_PAGE)) ?? Response.error();
      } finally {
        clearTimeout(timer);
      }
    },
    { denylist: NEVER_HANDLE },
  ),
);

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url, request }) =>
    request.method === "GET" && url.origin === self.location.origin && url.pathname.startsWith("/mediapipe/"),
  new CacheFirst({
    cacheName: "bh-static-mediapipe-v1",
    plugins: [new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90, purgeOnQuotaError: true })],
  }),
);

const KNOWN_CACHE_PREFIXES = ["workbox-precache", "bh-static-mediapipe-v1"];

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !KNOWN_CACHE_PREFIXES.some((p) => n.startsWith(p))).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});
