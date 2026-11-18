/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-d667eb67'], (function (workbox) { 'use strict';

  self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "e9c404f41bc28b94d8b8d852ac736fb5"
  }, {
    "url": "pwa-512x512.png",
    "revision": "336fa94ad7d11b3cce0c4ceade749de3"
  }, {
    "url": "pwa-192x192.png",
    "revision": "08d78c2568bfeb32b44ef59a67d99288"
  }, {
    "url": "offline.html",
    "revision": "2726f0178fe5db14b59df68efd1f06bf"
  }, {
    "url": "logo.png",
    "revision": "08d78c2568bfeb32b44ef59a67d99288"
  }, {
    "url": "index.html",
    "revision": "b39cb2f073b8dfb45c7e081265a6e6db"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "bc7e6e7907c01f06d9d05c32934bd4e5"
  }, {
    "url": "avatars/avatar-6.jpg",
    "revision": "fb83809d5d04404449e1f6c25af297b3"
  }, {
    "url": "avatars/avatar-5.jpg",
    "revision": "5c13d3a96139dc1bd04f23f48762775f"
  }, {
    "url": "avatars/avatar-4.jpg",
    "revision": "0d6b9cefe32e664a180f8ab1a21d8a37"
  }, {
    "url": "avatars/avatar-3.jpg",
    "revision": "75b7873fe060a0d449ddaeabffab5b9d"
  }, {
    "url": "avatars/avatar-2.jpg",
    "revision": "9b71f751f438a8fd7073a252e410cea1"
  }, {
    "url": "avatars/avatar-1.jpg",
    "revision": "93ec189b6f8c1ab848ef7b131eec661f"
  }, {
    "url": "assets/web-sfT9YQc8.js",
    "revision": null
  }, {
    "url": "assets/web-B_n-J6V7.js",
    "revision": null
  }, {
    "url": "assets/tailor_embroidery_craft_1791698438179-9CQ9IcMz.jpg",
    "revision": null
  }, {
    "url": "assets/mahara_trades_hero_1791698414128-w15QG52V.jpg",
    "revision": null
  }, {
    "url": "assets/index-COcRvHuh.js",
    "revision": null
  }, {
    "url": "assets/index-B3RLU_Bp.css",
    "revision": null
  }, {
    "url": "assets/henna_beauty_craft_1791698427609-CguPx93K.jpg",
    "revision": null
  }, {
    "url": "assets/electrician_ac_repair_1791698448062-BU9RBjXO.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/mehani-icon-192_3c0832d2.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_f1dce030.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_74e22939.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_58a70a20.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-15_100116_fd5c1281.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "bc7e6e7907c01f06d9d05c32934bd4e5"
  }, {
    "url": "logo.png",
    "revision": "08d78c2568bfeb32b44ef59a67d99288"
  }, {
    "url": "pwa-192x192.png",
    "revision": "08d78c2568bfeb32b44ef59a67d99288"
  }, {
    "url": "pwa-512x512.png",
    "revision": "336fa94ad7d11b3cce0c4ceade749de3"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "e9c404f41bc28b94d8b8d852ac736fb5"
  }, {
    "url": "avatars/avatar-1.jpg",
    "revision": "93ec189b6f8c1ab848ef7b131eec661f"
  }, {
    "url": "avatars/avatar-2.jpg",
    "revision": "9b71f751f438a8fd7073a252e410cea1"
  }, {
    "url": "avatars/avatar-3.jpg",
    "revision": "75b7873fe060a0d449ddaeabffab5b9d"
  }, {
    "url": "avatars/avatar-4.jpg",
    "revision": "0d6b9cefe32e664a180f8ab1a21d8a37"
  }, {
    "url": "avatars/avatar-5.jpg",
    "revision": "5c13d3a96139dc1bd04f23f48762775f"
  }, {
    "url": "avatars/avatar-6.jpg",
    "revision": "fb83809d5d04404449e1f6c25af297b3"
  }, {
    "url": "manifest.json",
    "revision": "04549901751eade87cbad16b162f0d0f"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\.php/, /^\/\.well-known\//]
  }));
  workbox.registerRoute(/\/api\.php(\?.*)?$/i, new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
