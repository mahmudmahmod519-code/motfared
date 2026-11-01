/**
 * The app <-> server contract, checked from the sources (no JDK needed). Ported from the legacy
 * backend's test/contract.test.js. `ApiClient.kt` is parsed with regular expressions (it is written
 * in one uniform style: one `request(` per function, `.put("field", …)` for the body,
 * `getX("field")` / `optX("field")` / `isNull("field")` / `optNullableString(obj, "field")` for the
 * reply), and every request the Android app makes is looked up in the NestJS /api/mobile routes:
 *
 *  - the path and method must be served (or be on the PENDING list of packages not built yet);
 *  - every request field must be known to the route (a DTO property or a word in the handler);
 *  - every reply field must be produced somewhere in the mobile module sources.
 *
 * PENDING is the progress meter for the port: a pending request that gets a route fails this test
 * until it is removed from the list, so the list can only shrink.
 */
import { bootstrap } from './harness';
import { ModulesContainer } from '@nestjs/core';
import { getMetadataStorage } from 'class-validator';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const KOTLIN = process.env.APICLIENT_PATH || resolve(__dirname, '../../../../lead-to-doctor/android-app/app/src/main/java/com/leadtodoctor/sales/data/ApiClient.kt');
const SRC = resolve(__dirname, '../../src/modules/mobile');
const available = existsSync(KOTLIN);

/** Android requests whose routes belong to later packages (B4 … B10). Remove an entry when its route lands. */
const PENDING = new Set<string>([
    'POST /call-results', 'POST /daily-stats',
  'POST /my/claim', 'GET /my/claim-status', 'POST /my/no-work', 'GET /my/worklist',
  'POST /bookings', 'GET /bookings/today', 'POST /bookings/1/reminder-message', 'POST /bookings/1/reminder-call',
  'POST /bookings/1/attendance', 'PATCH /bookings/1/case-name', 'GET /my/bookings-made', 'GET /my/target',
  'POST /reminders', 'DELETE /reminders/1',
  'GET /my/followups', 'GET /my/followups/counts', 'GET /my/plan-followups',
  'POST /my/plan-followups/1/outcome', 'POST /my/plan-cases/1/started',
  'GET /downloads/version.json',
]);

const kotlin = available ? readFileSync(KOTLIN, 'utf8') : '';
const sourceText = (dir: string): string =>
  readdirSync(dir)
    .map((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? sourceText(p) : p.endsWith('.ts') && !p.endsWith('.spec.ts') ? readFileSync(p, 'utf8') : '';
    })
    .join('\n');

const KEYS_RE = /\.(?:get|opt)(?:String|Int|Long|Boolean|JSONObject|JSONArray|Double)\(\s*"([A-Za-z_]+)"/g;
const keysReadIn = (text: string) => {
  const keys = new Set<string>();
  for (const m of text.matchAll(KEYS_RE)) keys.add(m[1]);
  for (const m of text.matchAll(/\.isNull\(\s*"([A-Za-z_]+)"/g)) keys.add(m[1]);
  for (const m of text.matchAll(/optNullableString\(\s*\w+,\s*"([A-Za-z_]+)"/g)) keys.add(m[1]);
  return keys;
};

function parserHelpers() {
  const out: Record<string, Set<string>> = {};
  for (const m of kotlin.matchAll(/private fun (parse\w+)\(([^)]*)\)[^{=]*(?:=\s*|\{)/g)) {
    const rest = kotlin.slice(m.index! + m[0].length);
    const next = rest.search(/\n    (?:private |suspend |\/\*\*|fun |data class|class )/);
    out[m[1]] = keysReadIn(kotlin.slice(m.index!, next === -1 ? undefined : m.index! + m[0].length + next));
  }
  return out;
}

interface Req { fn: string; method: string; path: string; template: string; bodyKeys: Set<string>; replyKeys: Set<string> }
function clientRequests(): Req[] {
  const helpers = parserHelpers();
  const starts = [...kotlin.matchAll(/suspend fun (\w+)\(/g)].map((m) => ({ name: m[1], index: m.index! }));
  const requests: Req[] = [];
  starts.forEach((s, i) => {
    const body = kotlin.slice(s.index, i + 1 < starts.length ? starts[i + 1].index : undefined);
    const call = body.match(/request\(\s*([^,]+),\s*"(GET|POST|PUT|PATCH|DELETE)"/);
    if (!call) return;
    const literal = body.match(/"(\/[^"?]*)/);
    if (!literal) throw new Error(`${s.name}: could not find the request path`);
    const bodyKeys = new Set([...body.matchAll(/\.put\(\s*"([A-Za-z_]+)"/g)].map((m) => m[1]));
    const replyKeys = keysReadIn(body);
    for (const [name, keys] of Object.entries(helpers)) if (body.includes(`${name}(`)) keys.forEach((k) => replyKeys.add(k));
    bodyKeys.forEach((k) => replyKeys.delete(k));
    requests.push({ fn: s.name, method: call[2], path: literal[1].replace(/\$\{?\w+\}?/g, '1'), template: literal[1], bodyKeys, replyKeys });
  });
  return requests;
}

const RM = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD']; // Nest's RequestMethod enum order
const toRegex = (tpl: string) => new RegExp(`^${tpl.replace(/:[A-Za-z]+/g, '[^/]+').replace(/\./g, '\\.')}$`);

(available ? describe : describe.skip)('Android app <-> /api/mobile contract', () => {
  let h: Awaited<ReturnType<typeof bootstrap>>;
  const routes: { method: string; tpl: string; handler: Function; proto: any; key: string }[] = [];
  const mobileSources = available ? sourceText(SRC) : '';

  beforeAll(async () => {
    h = await bootstrap({ reset: true, noThrottle: true });
    for (const mod of h.app.get(ModulesContainer).values()) {
      for (const w of mod.controllers.values()) {
        const cls: any = w.metatype;
        const base = Reflect.getMetadata('path', cls);
        if (base !== 'mobile') continue;
        for (const key of Object.getOwnPropertyNames(cls.prototype)) {
          const handler = cls.prototype[key];
          const path = Reflect.getMetadata('path', handler);
          const method = Reflect.getMetadata('method', handler);
          if (path === undefined || method === undefined) continue;
          routes.push({ method: RM[method], tpl: `/${path}`.replace(/\/+/g, '/'), handler, proto: cls.prototype, key });
        }
      }
    }
  });
  afterAll(async () => { await h.app?.close(); });

  const requests = available ? clientRequests() : [];

  it('parses a plausible number of requests and routes', () => {
    expect(requests.length).toBeGreaterThanOrEqual(36);
    expect(routes.length).toBeGreaterThanOrEqual(8);
  });

  for (const r of requests) {
    const label = `${r.fn}: ${r.method} ${r.template}`;
    const key = `${r.method} ${r.path}`;
    // A literal route ("/leads/history") wins over a parameterised one ("/leads/:id") that would also match.
    const find = () => {
      const all = routes.filter((x) => x.method === r.method && toRegex(x.tpl).test(r.path));
      const fewest = Math.min(...all.map((x) => (x.tpl.match(/:/g) || []).length));
      return all.filter((x) => (x.tpl.match(/:/g) || []).length === fewest);
    };

    it(`${label} ${PENDING.has(key) ? 'is pending (no route yet)' : 'has exactly one route'}`, () => {
      const matches = find();
      if (PENDING.has(key)) {
        expect(matches.map((m) => m.tpl)).toEqual([]); // remove it from PENDING once the route exists
      } else {
        expect(matches.map((m) => m.tpl)).toHaveLength(1);
      }
    });

    if (PENDING.has(key)) continue;

    it(`${label}: every request field is known to the route`, () => {
      const [route] = find();
      if (!route) return; // reported by the previous test
      const types: any[] = Reflect.getMetadata('design:paramtypes', route.proto, route.key) || [];
      const dtoProps = new Set<string>();
      for (const t of types) {
        if (typeof t !== 'function' || ['String', 'Number', 'Object', 'Boolean'].includes(t.name)) continue;
        const collect = (cls: any, depth = 0) => {
          for (const meta of getMetadataStorage().getTargetValidationMetadatas(cls, '', false, false)) {
            dtoProps.add(meta.propertyName);
            // fields of a nested DTO (e.g. the entries of the call-log sync) are fields of the request too
            const nested = depth < 3 ? defaultMetadataStorage.findTypeMetadata(cls, meta.propertyName)?.typeFunction?.() : undefined;
            if (typeof nested === 'function') collect(nested, depth + 1);
          }
        };
        collect(t);
      }
      const handlerText = route.handler.toString();
      const missing = [...r.bodyKeys].filter((k) => !dtoProps.has(k) && !new RegExp(`\\b${k}\\b`).test(handlerText));
      expect(missing).toEqual([]);
    });

    it(`${label}: every reply field is produced by the server`, () => {
      const missing = [...r.replyKeys].filter((k) => !new RegExp(`\\b${k}\\b`).test(mobileSources));
      expect(missing).toEqual([]);
    });
  }

  it('the pending list has no stale entries (each entry still names a request the app makes)', () => {
    const made = new Set(requests.map((r) => `${r.method} ${r.path}`));
    expect([...PENDING].filter((k) => !made.has(k))).toEqual([]);
  });
});
