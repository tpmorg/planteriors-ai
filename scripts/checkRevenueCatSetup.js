#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const API_BASE = 'https://api.revenuecat.com/v2';
const DEFAULT_PROJECT_NAME = 'Planterior';
const DEFAULT_ENTITLEMENT = 'Planterior Pro';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
    return [key, valueParts.join('=') || 'true'];
  })
);

const targetEnv = args.get('env') || process.env.APP_ENV || 'production';
const projectName = args.get('project-name') || process.env.REVENUECAT_PROJECT_NAME || DEFAULT_PROJECT_NAME;
const projectId = args.get('project-id') || process.env.REVENUECAT_PROJECT_ID || '';
const entitlementLookupKey =
  args.get('entitlement') || process.env.REVENUECAT_ENTITLEMENT_ID || DEFAULT_ENTITLEMENT;
const token =
  args.get('token') ||
  process.env.REVENUECAT_SECRET_API_KEY ||
  process.env.REVENUECAT_BEARER_TOKEN ||
  process.env.REVENUECAT_API_TOKEN ||
  '';

const expectedAppleKey =
  process.env.REVENUECAT_APPLE_API_KEY_PRODUCTION ||
  process.env.REVENUECAT_APPLE_API_KEY ||
  '';
const expectedGoogleKey =
  process.env.REVENUECAT_GOOGLE_API_KEY_PRODUCTION ||
  process.env.REVENUECAT_GOOGLE_API_KEY ||
  '';

const checks = [];

function mask(value) {
  if (!value) return '(missing)';
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

function addCheck(ok, label, detail = '') {
  checks.push({ ok, label, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${label}${detail ? ` - ${detail}` : ''}`);
}

function warn(label, detail = '') {
  checks.push({ ok: true, label, detail, warning: true });
  console.log(`WARN ${label}${detail ? ` - ${detail}` : ''}`);
}

async function revenueCat(pathname) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const message = body?.message || body?.error || body?.raw || `${res.status} ${res.statusText}`;
    throw new Error(`RevenueCat API failed for ${pathname}: ${message}`);
  }

  return body;
}

function itemList(body) {
  return Array.isArray(body?.items) ? body.items : [];
}

function collectPackageProducts(offering) {
  const products = [];
  for (const pkg of offering?.packages?.items || []) {
    for (const productRef of pkg.products?.items || []) {
      const product = productRef.product || productRef;
      if (product?.id) {
        products.push({
          packageLookupKey: pkg.lookup_key,
          packageDisplayName: pkg.display_name,
          packageId: pkg.id,
          product,
        });
      }
    }
  }
  return products;
}

async function main() {
  console.log('RevenueCat setup preflight');
  console.log(`Target env: ${targetEnv}`);
  console.log(`Project: ${projectId || projectName}`);
  console.log(`Entitlement: ${entitlementLookupKey}`);
  console.log(`Expected iOS key: ${mask(expectedAppleKey)}`);
  console.log(`Expected Android key: ${mask(expectedGoogleKey)}`);
  console.log('');

  addCheck(!!token, 'Secret API token is available', token ? 'from env/arg' : 'set REVENUECAT_SECRET_API_KEY');
  addCheck(!!expectedAppleKey, 'Expected iOS public key is configured', mask(expectedAppleKey));
  addCheck(!!expectedGoogleKey, 'Expected Android public key is configured', mask(expectedGoogleKey));

  if (!token) {
    throw new Error('Missing RevenueCat secret API token');
  }

  const projects = itemList(await revenueCat('/projects?limit=100'));
  const project = projectId
    ? projects.find((item) => item.id === projectId)
    : projects.find((item) => item.name === projectName);

  addCheck(
    !!project,
    'RevenueCat project is accessible',
    project ? `${project.name} (${project.id})` : 'not found'
  );
  if (!project) {
    throw new Error('RevenueCat project not found');
  }

  const [entitlementsBody, offeringsBody] = await Promise.all([
    revenueCat(`/projects/${project.id}/entitlements?limit=100&expand=items.product`),
    revenueCat(
      `/projects/${project.id}/offerings?limit=100&expand=items.package&expand=items.package.product`
    ),
  ]);

  const entitlements = itemList(entitlementsBody);
  const entitlement = entitlements.find((item) => item.lookup_key === entitlementLookupKey);
  addCheck(
    !!entitlement,
    'Expected entitlement exists',
    entitlement ? `${entitlement.lookup_key} (${entitlement.id})` : 'not found'
  );
  addCheck(
    entitlement?.state === 'active',
    'Expected entitlement is active',
    entitlement ? `state=${entitlement.state}` : 'missing'
  );

  const entitlementProducts = itemList(entitlement?.products);
  addCheck(
    entitlementProducts.length > 0,
    'Entitlement has attached products',
    `${entitlementProducts.length} product(s)`
  );

  const offerings = itemList(offeringsBody);
  const currentOffering = offerings.find((item) => item.is_current);
  addCheck(
    !!currentOffering,
    'Current offering exists',
    currentOffering ? `${currentOffering.lookup_key} (${currentOffering.id})` : 'not found'
  );
  addCheck(
    currentOffering?.state === 'active',
    'Current offering is active',
    currentOffering ? `state=${currentOffering.state}` : 'missing'
  );

  const packages = itemList(currentOffering?.packages);
  addCheck(packages.length > 0, 'Current offering has packages', `${packages.length} package(s)`);
  addCheck(
    packages.some((pkg) => pkg.lookup_key === '$rc_monthly'),
    'Monthly package exists',
    packages.map((pkg) => pkg.lookup_key).join(', ') || 'none'
  );
  addCheck(
    packages.some((pkg) => pkg.lookup_key === '$rc_annual'),
    'Annual package exists',
    packages.map((pkg) => pkg.lookup_key).join(', ') || 'none'
  );

  const packageProducts = collectPackageProducts(currentOffering);
  addCheck(
    packageProducts.length > 0,
    'Current offering packages have products',
    `${packageProducts.length} product attachment(s)`
  );

  const appIds = [...new Set(packageProducts.map((item) => item.product.app_id).filter(Boolean))];
  const appKeyEntries = [];
  for (const appId of appIds) {
    const keysBody = await revenueCat(`/projects/${project.id}/apps/${appId}/public_api_keys`);
    for (const key of itemList(keysBody)) {
      appKeyEntries.push({ appId, ...key });
    }
  }

  const appleAppKey = appKeyEntries.find((entry) => entry.key === expectedAppleKey);
  const googleAppKey = appKeyEntries.find((entry) => entry.key === expectedGoogleKey);

  addCheck(
    !!appleAppKey,
    'Configured iOS public key belongs to a package app',
    appleAppKey ? `app=${appleAppKey.appId}` : mask(expectedAppleKey)
  );
  addCheck(
    !!googleAppKey,
    'Configured Android public key belongs to a package app',
    googleAppKey ? `app=${googleAppKey.appId}` : mask(expectedGoogleKey)
  );

  const appleProducts = packageProducts.filter((item) => item.product.app_id === appleAppKey?.appId);
  const googleProducts = packageProducts.filter((item) => item.product.app_id === googleAppKey?.appId);

  addCheck(
    appleProducts.length >= 2,
    'iOS app has monthly/annual package products',
    appleProducts.map((item) => item.product.store_identifier).join(', ') || 'none'
  );
  addCheck(
    googleProducts.length >= 2,
    'Android app has monthly/annual package products',
    googleProducts.map((item) => item.product.store_identifier).join(', ') || 'none'
  );

  const entitlementProductIds = new Set(entitlementProducts.map((product) => product.id));
  const packageProductsMissingEntitlement = packageProducts.filter(
    (item) => !entitlementProductIds.has(item.product.id)
  );
  addCheck(
    packageProductsMissingEntitlement.length === 0,
    'All package products grant the expected entitlement',
    packageProductsMissingEntitlement.map((item) => item.product.store_identifier).join(', ') || 'all attached'
  );

  const unknownStateProducts = packageProducts.filter((item) => item.product.state !== 'active');
  addCheck(
    unknownStateProducts.length === 0,
    'All package products are active in RevenueCat',
    unknownStateProducts.map((item) => `${item.product.store_identifier}:${item.product.state}`).join(', ') ||
      'all active'
  );

  const productsWithoutDuration = packageProducts.filter(
    (item) => item.product.type === 'subscription' && !item.product.subscription?.duration
  );
  if (productsWithoutDuration.length > 0) {
    warn(
      'Some subscription products do not expose duration via RevenueCat API',
      productsWithoutDuration.map((item) => item.product.store_identifier).join(', ')
    );
  }

  const failures = checks.filter((check) => !check.ok);
  console.log('');
  if (failures.length > 0) {
    console.error(`RevenueCat preflight failed: ${failures.length} failed check(s).`);
    process.exit(1);
  }

  console.log('RevenueCat preflight passed.');
}

main().catch((error) => {
  console.error('');
  console.error(error.message || error);
  process.exit(1);
});
