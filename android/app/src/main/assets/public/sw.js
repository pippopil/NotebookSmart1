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
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
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
    "revision": "130dab05e544b46f85acaa4905f7e741"
  }, {
    "url": "pwa-512x512.png",
    "revision": "130dab05e544b46f85acaa4905f7e741"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e0b2401a8bad805764f34fd67c4e4c50"
  }, {
    "url": "index.html",
    "revision": "bee67d97fbbed0f5a526fa2f3944b2b7"
  }, {
    "url": "icon.svg",
    "revision": "ef8380f38bb58e7ecfa27319002e1557"
  }, {
    "url": "favicon.ico",
    "revision": "89cfed42163f4a96dd46942abf884b36"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ecf0f17786f2c00b9cba69ddc253f0be"
  }, {
    "url": "assets/web-ccV3GhyX.js",
    "revision": null
  }, {
    "url": "assets/index-HU7AHZSr.js",
    "revision": null
  }, {
    "url": "assets/index-Cumd9tZ0.css",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ecf0f17786f2c00b9cba69ddc253f0be"
  }, {
    "url": "favicon.ico",
    "revision": "89cfed42163f4a96dd46942abf884b36"
  }, {
    "url": "icon.svg",
    "revision": "ef8380f38bb58e7ecfa27319002e1557"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e0b2401a8bad805764f34fd67c4e4c50"
  }, {
    "url": "pwa-512x512.png",
    "revision": "130dab05e544b46f85acaa4905f7e741"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "130dab05e544b46f85acaa4905f7e741"
  }, {
    "url": "manifest.webmanifest",
    "revision": "42a764545e9c429dafc2898dfcee2bfe"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
