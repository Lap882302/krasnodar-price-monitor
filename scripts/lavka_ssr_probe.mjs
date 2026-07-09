#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const DEFAULT_URL = "https://lavka.yandex.ru/";
const TERMS = [
  "помидор",
  "томат",
  "клубник",
  "картоф",
  "куриц",
  "огур",
  "череш",
  "лук",
  "перец",
  "морков",
  "укроп",
  "говядин"
];

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'");
}

function extractScriptJson(html, id) {
  const pattern = new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`);
  const match = html.match(pattern);
  if (!match) return null;
  return JSON.parse(decodeHtmlEntities(match[1].trim()));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function findProductCandidates(root) {
  const seen = new Set();
  const results = [];

  function maybeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function maybePrice(object) {
    const directKeys = [
      "price",
      "discountPrice",
      "oldPrice",
      "priceValue",
      "pricePerItem",
      "pricePerUnit"
    ];
    for (const key of directKeys) {
      const value = object[key];
      if (typeof value === "number") return value;
      if (isObject(value) && typeof value.value === "number") return value.value;
    }
    return undefined;
  }

  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const title = maybeText(value.title) || maybeText(value.name) || maybeText(value.text);
    const id = maybeText(value.id) || maybeText(value.productId) || maybeText(value.uuid);
    const searchable = `${title} ${maybeText(value.subtitle)} ${maybeText(value.description)}`.toLowerCase();
    const matched = title && TERMS.some(term => searchable.includes(term));
    const price = maybePrice(value);

    if (matched) {
      results.push({
        id,
        title,
        subtitle: maybeText(value.subtitle),
        price,
        unit: maybeText(value.unit) || maybeText(value.measure),
        source: "ssr"
      });
    }

    for (const child of Object.values(value)) visit(child);
  }

  visit(root);

  const unique = new Map();
  for (const item of results) {
    const key = `${item.id}|${item.title}|${item.price ?? ""}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return Array.from(unique.values());
}

async function loadHtml() {
  const htmlPath = argValue("--html");
  if (htmlPath) return readFile(htmlPath, "utf8");

  const cookie = process.env.LAVKA_COOKIE;
  const response = await fetch(argValue("--url") || DEFAULT_URL, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ru-RU,ru;q=0.9",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      ...(cookie ? { "cookie": cookie } : {})
    }
  });

  const html = await response.text();
  return html;
}

const html = await loadHtml();
const pageProps = extractScriptJson(html, "__page_props__-data");
const dehydratedState = extractScriptJson(html, "storedehydratedstate-data");
const captchaDetected = /showcaptcha|Вы не робот|smartcaptcha/i.test(html);

const pageEnv = pageProps?.pageEnv || {};
const serviceInfo = pageProps?.pageData?.serviceInfo || {};
const products = findProductCandidates({ pageProps, dehydratedState });

const summary = {
  ok: Boolean(pageProps || dehydratedState),
  captchaDetected,
  cityId: pageEnv.cityId,
  defaultCityId: pageEnv.defaultCityId,
  address: serviceInfo.address,
  depotAddress: serviceInfo.depotAddress,
  depotId: serviceInfo.depotId,
  serviceStatus: serviceInfo.status,
  csrfTokenPresent: Boolean(pageProps?.csrfToken),
  authProxyCsrfTokenPresent: Boolean(pageProps?.authProxyCsrfToken),
  productCandidates: products.slice(0, 50)
};

console.log(JSON.stringify(summary, null, 2));
